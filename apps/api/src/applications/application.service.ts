import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { isTemplateRequired } from '../documents/applicability';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthState } from '../auth/auth.types';
import { ensureFormCatalogue, FORM_SCHEMA_VERSION } from '../seed/form-catalogue';
import { supersedeIfMaterial } from '../reviews/material-change';

const TEMPLATE_TITLES: Record<string, string> = {
  kyc: 'Customer due diligence',
  'pep-declaration': 'PEP declaration',
  'pep-questionnaire': 'PEP questionnaire',
  'responsible-sourcing': 'Responsible sourcing acknowledgement',
};

@Injectable()
export class ApplicationService {
  constructor(private readonly prisma: PrismaService) {}

  async current(auth: AuthState) {
    await ensureFormCatalogue(this.prisma);
    return this.prisma.withTenant(auth.tenantId, async (tx) => {
      const customer = await tx.customer.findFirst({
        where: { tenantId: auth.tenantId, userId: auth.userId },
      });
      if (!customer) {
        throw new NotFoundException('Not found');
      }
      let application = await tx.application.findFirst({
        where: { tenantId: auth.tenantId, customerId: customer.id },
        orderBy: { createdAt: 'asc' },
      });
      if (!application) {
        application = await tx.application.create({
          data: {
            tenantId: auth.tenantId,
            customerId: customer.id,
            schemaVersion: FORM_SCHEMA_VERSION,
            status: 'draft',
          },
        });
      }
      return this.present(tx, auth.tenantId, application.id, customer.customerType);
    });
  }

  async get(auth: AuthState, id: string) {
    await ensureFormCatalogue(this.prisma);
    return this.prisma.withTenant(auth.tenantId, async (tx) => {
      const application = await this.visible(tx, auth, id);
      return this.present(tx, auth.tenantId, application.id, application.customer.customerType);
    });
  }

  async save(auth: AuthState, id: string, answers: Record<string, unknown>) {
    await ensureFormCatalogue(this.prisma);
    return this.prisma.withTenant(auth.tenantId, async (tx) => {
      const application = await this.visible(tx, auth, id);
      const allowed = await this.allowedKeys(tx, auth.tenantId, application.schemaVersion);
      for (const [fieldKey, value] of Object.entries(answers)) {
        const field = allowed.get(fieldKey);
        if (!field) {
          throw new BadRequestException('Unknown field');
        }
        if (field.repeatable && !Array.isArray(value)) {
          throw new BadRequestException('Repeating answers must be a list');
        }
        await tx.answer.upsert({
          where: { applicationId_fieldKey: { applicationId: application.id, fieldKey } },
          create: {
            tenantId: auth.tenantId,
            applicationId: application.id,
            fieldKey,
            value: value as Prisma.InputJsonValue,
          },
          update: { value: value as Prisma.InputJsonValue },
        });
      }
      await supersedeIfMaterial(tx, application);
      return this.present(tx, auth.tenantId, application.id, application.customer.customerType);
    });
  }

  private async visible(
    tx: Prisma.TransactionClient,
    auth: AuthState,
    id: string,
  ) {
    const application = await tx.application.findFirst({
      where: { id, tenantId: auth.tenantId },
      include: { customer: true },
    });
    const owns = application?.customer.userId === auth.userId;
    const staff = !auth.roles.includes('customer');
    if (!application || (auth.roles.includes('customer') && !owns) || (!staff && !owns)) {
      throw new NotFoundException('Not found');
    }
    return application;
  }

  private async allowedKeys(tx: Prisma.TransactionClient, tenantId: string, schemaVersion: number) {
    const fields = await tx.formField.findMany({
      where: { schema: { version: schemaVersion } },
      select: { fieldKey: true, repeatable: true },
    });
    const extras = await tx.checklistCategory.findMany({ where: { tenantId } });
    const allowed = new Map(fields.map((field) => [field.fieldKey, field]));
    for (const extra of extras) {
      allowed.set(`extra.${extra.id}`, { fieldKey: `extra.${extra.id}`, repeatable: false });
    }
    return allowed;
  }

  private async present(
    tx: Prisma.TransactionClient,
    tenantId: string,
    applicationId: string,
    customerType: string,
  ) {
    const application = await tx.application.findFirstOrThrow({
      where: { id: applicationId, tenantId },
      include: { answers: true },
    });
    const schemas = await tx.formSchema.findMany({
      where: { version: application.schemaVersion },
      include: { fields: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { templateId: 'asc' },
    });
    const rules = await tx.applicabilityRule.findMany({ where: { customerType } });
    const extras = await tx.checklistCategory.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
    });
    const answers: Record<string, unknown> = {};
    for (const answer of application.answers) {
      answers[answer.fieldKey] = answer.value;
    }
    return {
      application: {
        id: application.id,
        status: application.status,
        documentVersion: application.documentVersion,
        schemaVersion: application.schemaVersion,
        customerType,
      },
      templates: (await Promise.all(schemas.map(async (schema) => {
          if (!(await isTemplateRequired(tx, tenantId, customerType, schema.templateId))) {
            return null;
          }
          return {
            templateId: schema.templateId,
            title: TEMPLATE_TITLES[schema.templateId] ?? schema.templateId,
            required: true,
            fields: schema.fields.map((field) => {
              const fieldRule = rules.find(
                (rule) => rule.templateId === schema.templateId && rule.fieldKey === field.fieldKey,
              );
              return {
                fieldKey: field.fieldKey,
                label: field.label,
                widget: field.widget,
                repeatable: field.repeatable,
                required: fieldRule ? fieldRule.required : true,
                options: field.options,
                columns: field.columns,
              };
            }),
          };
        }))).filter((template) => template !== null),
      extras: extras.map((extra) => ({
        id: extra.id,
        label: extra.label,
        fieldKey: `extra.${extra.id}`,
      })),
      answers,
    };
  }
}
