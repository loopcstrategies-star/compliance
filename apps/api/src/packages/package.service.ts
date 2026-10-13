import { BadRequestException, Injectable } from '@nestjs/common';
import { readFileSync } from 'fs';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthState } from '../auth/auth.types';
import { ensureFormCatalogue } from '../seed/form-catalogue';
import { ensureTemplateCatalogue, sourcePdfPath } from '../seed/template-catalogue';
import { FileService, sha256 } from '../files/file.service';
import { readPrivateFile } from '../files/storage';
import { visibleApplication } from '../documents/application-access';
import { isTemplateRequired } from '../documents/applicability';
import { paintLetterhead, type Rect } from './paint-letterhead';
import { supersedeIfMaterial } from '../reviews/material-change';

type Slot = { fieldKey: string; reason: string };
type Painted = Rect & { fieldKey: string; page: number };

@Injectable()
export class PackageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly files: FileService,
  ) {}

  async preview(auth: AuthState, applicationId: string, templateId: string) {
    const plan = await this.plan(auth, applicationId, templateId, false);
    return {
      templateId: plan.templateId,
      pageCount: plan.pageCount,
      letterheadOwner: plan.letterheadOwner,
      pages: plan.pages,
    };
  }

  async generate(auth: AuthState, applicationId: string, templateId: string) {
    const plan = await this.plan(auth, applicationId, templateId, true);
    const file = await this.files.storeGenerated(auth.tenantId, plan.bytes);
    const version = await this.prisma.withTenant(auth.tenantId, async (tx) => {
      const count = await tx.generatedPackage.count({ where: { applicationId, templateId } });
      const created = await tx.generatedPackage.create({
        data: {
          tenantId: auth.tenantId,
          applicationId,
          templateId,
          templateSha256: plan.templateSha256,
          version: count + 1,
          fileId: file.id,
          painted: plan.painted as unknown as Prisma.InputJsonValue,
          blocked: plan.blocked as unknown as Prisma.InputJsonValue,
        },
        select: { id: true, templateId: true, version: true, fileId: true, templateSha256: true, painted: true, blocked: true },
      });
      const application = await tx.application.findFirst({ where: { id: applicationId, tenantId: auth.tenantId } });
      if (application) {
        await supersedeIfMaterial(tx, application);
      }
      return created;
    });
    return version;
  }

  async list(auth: AuthState, applicationId: string) {
    await ensureTemplateCatalogue(this.prisma);
    return this.prisma.withTenant(auth.tenantId, async (tx) => {
      await visibleApplication(tx, auth, applicationId);
      return tx.generatedPackage.findMany({
        where: { applicationId, tenantId: auth.tenantId },
        select: { id: true, templateId: true, version: true, fileId: true, templateSha256: true },
        orderBy: [{ templateId: 'asc' }, { version: 'asc' }],
      });
    });
  }

  private async plan(auth: AuthState, applicationId: string, templateId: string, write: boolean) {
    await ensureFormCatalogue(this.prisma);
    await ensureTemplateCatalogue(this.prisma);
    return this.prisma.withTenant(auth.tenantId, async (tx) => {
      const application = await visibleApplication(tx, auth, applicationId);
      const template = await tx.templateVersion.findUnique({
        where: { templateId_version: { templateId, version: 1 } },
        include: { placements: true },
      });
      if (!template) {
        throw new BadRequestException('Unknown field');
      }
      if (!(await isTemplateRequired(tx, auth.tenantId, application.customer.customerType, templateId))) {
        throw new BadRequestException('Field is not applicable');
      }
      const source = readFileSync(sourcePdfPath(template.sourceFile));
      const actual = sha256(source);
      if (actual !== template.sha256) {
        throw new BadRequestException('Template hash mismatch');
      }
      const fields = await tx.formField.findMany({
        where: { schema: { templateId, version: application.schemaVersion } },
        orderBy: { sortOrder: 'asc' },
      });
      const blocked: Slot[] = fields.map((field) => ({ fieldKey: field.fieldKey, reason: 'unresolved' }));
      const painted: Painted[] = [];
      let bytes: Buffer = source;
      const placement = template.placements.find((item) => item.fieldKey.includes('letterhead'));
      const rect = asRect(placement?.rect ?? null);
      if (template.letterheadOwner === 'customer') {
        if (placement?.status === 'measured' && rect) {
          const letterhead = await tx.letterhead.findUnique({ where: { tenantId: auth.tenantId }, include: { file: true } });
          if (letterhead && write) {
            const image = readPrivateFile(letterhead.file.storageKey);
            bytes = Buffer.from(await paintLetterhead(source, image, letterhead.file.mediaType, rect));
            for (let page = 1; page <= template.pageCount; page += 1) {
              painted.push({ fieldKey: placement.fieldKey, page, ...rect });
            }
          } else if (!letterhead) {
            blocked.push({ fieldKey: placement.fieldKey, reason: 'unresolved' });
          } else {
            for (let page = 1; page <= template.pageCount; page += 1) {
              painted.push({ fieldKey: placement.fieldKey, page, ...rect });
            }
          }
        } else {
          blocked.push({ fieldKey: placement?.fieldKey ?? `${templateId}.letterhead`, reason: 'unresolved' });
        }
      }
      const pages = Array.from({ length: template.pageCount }, (_, index) => ({
        page: index + 1,
        painted: painted.filter((slot) => slot.page === index + 1),
        blocked,
      }));
      return {
        templateId,
        pageCount: template.pageCount,
        letterheadOwner: template.letterheadOwner,
        templateSha256: template.sha256,
        pages,
        painted,
        blocked,
        bytes,
      };
    });
  }
}

function asRect(value: Prisma.JsonValue | null): Rect | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const rect = value as Rect;
  if ([rect.x, rect.y, rect.width, rect.height].every((item) => typeof item === 'number')) {
    return rect;
  }
  return null;
}
