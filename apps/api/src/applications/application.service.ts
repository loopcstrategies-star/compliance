import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { isTemplateRequired } from '../documents/applicability';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthState } from '../auth/auth.types';
import { ensureFormCatalogue, FORM_SCHEMA_VERSION } from '../seed/form-catalogue';
import { supersedeIfMaterial } from '../reviews/material-change';
import {
  WIZARD_SECTIONS,
  fieldBelongsToSection,
  keysForSection,
  type SectionStatus,
} from './wizard-sections';
import { lockCustomerForDraft } from './draft-lock';

const TEMPLATE_TITLES: Record<string, string> = {
  kyc: 'Customer due diligence',
  'pep-declaration': 'PEP declaration',
  'pep-questionnaire': 'PEP questionnaire',
  'responsible-sourcing': 'Responsible sourcing acknowledgement',
};

/** Prefer these when resuming the customer's active draft/correction case. */
const DRAFT_RESUME_STATUSES = new Set(['draft', 'correction']);

/**
 * Statuses that may receive answer writes.
 * - draft / correction: normal customer editing
 * - approved: material change opens reassessment via supersedeIfMaterial
 * submitted / maker_review / checker_review / reassessment stay locked.
 */
const ANSWER_EDITABLE_STATUSES = new Set(['draft', 'correction', 'approved']);

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
      // Lock before find-or-create so concurrent GET /current cannot insert duplicate drafts.
      await lockCustomerForDraft(tx, customer.id);
      let application = await tx.application.findFirst({
        where: {
          tenantId: auth.tenantId,
          customerId: customer.id,
          status: { in: [...DRAFT_RESUME_STATUSES] },
        },
        orderBy: { createdAt: 'desc' },
      });
      if (!application) {
        application = await tx.application.findFirst({
          where: { tenantId: auth.tenantId, customerId: customer.id },
          orderBy: { createdAt: 'desc' },
        });
      }
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
      this.assertEditable(application.status);
      await this.upsertAnswers(tx, auth.tenantId, application.id, application.schemaVersion, answers);
      await supersedeIfMaterial(tx, application);
      return this.present(tx, auth.tenantId, application.id, application.customer.customerType);
    });
  }

  async saveSection(
    auth: AuthState,
    id: string,
    sectionKey: string,
    answers: Record<string, unknown>,
    markComplete = false,
  ) {
    await ensureFormCatalogue(this.prisma);
    const section = WIZARD_SECTIONS.find((item) => item.sectionKey === sectionKey);
    if (!section) {
      throw new BadRequestException('Unknown section');
    }
    return this.prisma.withTenant(auth.tenantId, async (tx) => {
      const application = await this.visible(tx, auth, id);
      this.assertEditable(application.status);
      for (const fieldKey of Object.keys(answers)) {
        if (!fieldBelongsToSection(fieldKey, section)) {
          throw new BadRequestException('Field does not belong to this section');
        }
      }
      await this.upsertAnswers(tx, auth.tenantId, application.id, application.schemaVersion, answers);
      const existing = await tx.applicationSectionProgress.findUnique({
        where: { applicationId_sectionKey: { applicationId: application.id, sectionKey } },
      });
      if (markComplete) {
        await this.assertSectionComplete(tx, auth.tenantId, application, sectionKey, answers);
      }
      const status: SectionStatus = markComplete
        ? 'completed'
        : existing?.status === 'completed'
          ? 'completed'
          : 'in_progress';
      const completedAt =
        status === 'completed' ? (markComplete ? new Date() : existing?.completedAt ?? new Date()) : null;
      await tx.applicationSectionProgress.upsert({
        where: {
          applicationId_sectionKey: { applicationId: application.id, sectionKey },
        },
        create: {
          tenantId: auth.tenantId,
          applicationId: application.id,
          sectionKey,
          status,
          schemaVersion: application.schemaVersion,
          completedAt,
        },
        update: {
          status,
          schemaVersion: application.schemaVersion,
          completedAt,
        },
      });
      await tx.auditEvent.create({
        data: {
          tenantId: auth.tenantId,
          actorId: auth.userId,
          action: markComplete ? 'application.section.completed' : 'application.section.saved',
          targetType: 'application_section',
          targetId: application.id,
          purpose: sectionKey,
        },
      });
      await supersedeIfMaterial(tx, application);
      return this.present(tx, auth.tenantId, application.id, application.customer.customerType);
    });
  }

  private async upsertAnswers(
    tx: Prisma.TransactionClient,
    tenantId: string,
    applicationId: string,
    schemaVersion: number,
    answers: Record<string, unknown>,
  ) {
    const allowed = await this.allowedKeys(tx, tenantId, schemaVersion);
    for (const [fieldKey, value] of Object.entries(answers)) {
      const field = allowed.get(fieldKey);
      if (!field) {
        throw new BadRequestException('Unknown field');
      }
      if (field.repeatable && !Array.isArray(value)) {
        throw new BadRequestException('Repeating answers must be a list');
      }
      await tx.answer.upsert({
        where: { applicationId_fieldKey: { applicationId, fieldKey } },
        create: {
          tenantId,
          applicationId,
          fieldKey,
          value: value as Prisma.InputJsonValue,
        },
        update: { value: value as Prisma.InputJsonValue },
      });
    }
  }

  private async assertSectionComplete(
    tx: Prisma.TransactionClient,
    tenantId: string,
    application: { id: string; schemaVersion: number; customer: { customerType: string } },
    sectionKey: string,
    incoming: Record<string, unknown>,
  ) {
    const presented = await this.present(tx, tenantId, application.id, application.customer.customerType);
    const merged = { ...presented.answers, ...incoming };
    const sectionFields = presented.templates
      .flatMap((template) => template.fields)
      .filter((field) => keysForSection(sectionKey, [field.fieldKey]).length > 0);
    const missing: string[] = [];
    for (const field of sectionFields) {
      if (!field.required) {
        continue;
      }
      if (!isAnswered(merged[field.fieldKey], field.widget)) {
        missing.push(field.fieldKey);
      }
    }
    if (sectionKey === 'rspolicy') {
      if (merged['rspolicy.ack.accepted'] !== true) {
        missing.push('rspolicy.ack.accepted');
      }
      const version = merged['rspolicy.ack.policy_version'];
      if (typeof version !== 'string' || !version.trim()) {
        missing.push('rspolicy.ack.policy_version');
      }
    }
    if (missing.length > 0) {
      throw new BadRequestException({ message: 'Section is incomplete', missingAnswers: missing });
    }
  }

  private assertEditable(status: string) {
    if (!ANSWER_EDITABLE_STATUSES.has(status)) {
      throw new ConflictException('This application can no longer be edited');
    }
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
      include: {
        answers: true,
        submissions: {
          where: { supersededAt: null },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { createdAt: true },
        },
      },
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
    const progressRows = await tx.applicationSectionProgress.findMany({
      where: { applicationId, tenantId },
    });
    const progressByKey = new Map(progressRows.map((row) => [row.sectionKey, row]));
    const templates = (
      await Promise.all(
        schemas.map(async (schema) => {
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
        }),
      )
    ).filter((template) => template !== null);

    const allFieldKeys = templates.flatMap((template) => template.fields.map((field) => field.fieldKey));
    const sections = WIZARD_SECTIONS.map((def) => {
      const row = progressByKey.get(def.sectionKey);
      const sectionKeys = keysForSection(def.sectionKey, allFieldKeys);
      const applicable = sectionKeys.length > 0;
      let status: SectionStatus = (row?.status as SectionStatus) ?? 'not_started';
      if (!applicable) {
        status = 'completed';
      } else if (!row && sectionKeys.some((key) => answers[key] !== undefined)) {
        status = 'in_progress';
      }
      return {
        sectionKey: def.sectionKey,
        title: def.title,
        status,
        completedAt: row?.completedAt ?? null,
        applicable,
        fieldKeys: sectionKeys,
      };
    });
    const resumeSectionKey =
      sections.find((section) => section.applicable && section.status !== 'completed')?.sectionKey ??
      sections[0]?.sectionKey ??
      null;

    const editable = ANSWER_EDITABLE_STATUSES.has(application.status);
    const submittedAt = application.submissions[0]?.createdAt ?? null;

    return {
      application: {
        id: application.id,
        status: application.status,
        documentVersion: application.documentVersion,
        schemaVersion: application.schemaVersion,
        customerType,
      },
      templates,
      extras: extras.map((extra) => ({
        id: extra.id,
        label: extra.label,
        fieldKey: `extra.${extra.id}`,
      })),
      answers,
      sections,
      resumeSectionKey,
      policyVersion: String(FORM_SCHEMA_VERSION),
      editable,
      submittedAt,
    };
  }
}

function isAnswered(value: unknown, widget: string): boolean {
  if (value === null || value === undefined) {
    return false;
  }
  if (typeof value === 'string') {
    return value.trim().length > 0;
  }
  if (typeof value === 'boolean') {
    return widget === 'declaration' ? value === true : true;
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (widget === 'yes_no_details' || widget === 'yes_no_comments' || widget === 'duration_comments') {
      const answer = record.answer ?? record.value ?? record.choice;
      if (typeof answer !== 'string' || !answer.trim()) {
        return false;
      }
      return true;
    }
    if (widget === 'declaration') {
      return record.accepted === true || record.value === true;
    }
    if (widget === 'single_choice' || widget === 'yes_no') {
      const choice = record.value ?? record.choice ?? record.answer;
      return typeof choice === 'string' ? choice.trim().length > 0 : Boolean(choice);
    }
    return Object.keys(record).length > 0;
  }
  return true;
}
