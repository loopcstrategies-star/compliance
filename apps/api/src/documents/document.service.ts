import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthState } from '../auth/auth.types';
import { SIGNATURE_CONSENT, SIGNATURE_STATEMENT } from '../domain';
import { ensureFormCatalogue } from '../seed/form-catalogue';
import { FileService } from '../files/file.service';
import { assertDocumentField, signatureFieldFor, visibleApplication } from './application-access';
import { isTemplateRequired } from './applicability';
import { supersedeIfMaterial } from '../reviews/material-change';

@Injectable()
export class DocumentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly files: FileService,
  ) {}

  async list(auth: AuthState, applicationId: string) {
    await ensureFormCatalogue(this.prisma);
    return this.prisma.withTenant(auth.tenantId, async (tx) => {
      await visibleApplication(tx, auth, applicationId);
      return tx.document.findMany({
        where: { applicationId, tenantId: auth.tenantId },
        select: {
          id: true,
          fieldKey: true,
          fileId: true,
          expiresOn: true,
          file: { select: { mediaType: true, byteSize: true, scanStatus: true } },
        },
        orderBy: { fieldKey: 'asc' },
      });
    });
  }

  async upload(auth: AuthState, applicationId: string, fieldKey: string, bytes: Buffer, expiresOn?: string) {
    await ensureFormCatalogue(this.prisma);
    const application = await this.prisma.withTenant(auth.tenantId, (tx) => visibleApplication(tx, auth, applicationId));
    const kind = await this.prisma.withTenant(auth.tenantId, (tx) =>
      assertDocumentField(tx, auth.tenantId, application.customer.customerType, application.schemaVersion, fieldKey),
    );
    const expiry = parseExpiry(expiresOn);
    const file = await this.files.store(auth.tenantId, bytes, kind);
    return this.prisma.withTenant(auth.tenantId, async (tx) => {
      const saved = await tx.document.upsert({
        where: { applicationId_fieldKey: { applicationId, fieldKey } },
        create: { tenantId: auth.tenantId, applicationId, fieldKey, fileId: file.id, expiresOn: expiry },
        update: { fileId: file.id, ...(expiresOn !== undefined ? { expiresOn: expiry } : {}) },
        select: { id: true, fieldKey: true, fileId: true, expiresOn: true },
      });
      await supersedeIfMaterial(tx, application);
      return saved;
    });
  }

  async sign(auth: AuthState, applicationId: string, templateId: string, bytes: Buffer, authorised: boolean, consent: boolean) {
    if (authorised !== true || consent !== true) {
      throw new BadRequestException('Authorisation and consent are required');
    }
    await ensureFormCatalogue(this.prisma);
    const fieldKey = signatureFieldFor(templateId);
    await this.prisma.withTenant(auth.tenantId, async (tx) => {
      const application = await visibleApplication(tx, auth, applicationId);
      if (!(await isTemplateRequired(tx, auth.tenantId, application.customer.customerType, templateId))) {
        throw new BadRequestException('Field is not applicable');
      }
    });
    const file = await this.files.store(auth.tenantId, bytes, 'image');
    const created = await this.prisma.withTenant(auth.tenantId, async (tx) => {
      const application = await visibleApplication(tx, auth, applicationId);
      const row = await tx.signatureEvidence.create({
        data: {
          tenantId: auth.tenantId,
          applicationId,
          templateId,
          method: 'image',
          authorisedAt: new Date(),
          consentText: SIGNATURE_CONSENT,
          statement: SIGNATURE_STATEMENT,
          fileId: file.id,
        },
        select: {
          id: true,
          templateId: true,
          method: true,
          statement: true,
          consentText: true,
          fileId: true,
        },
      });
      await supersedeIfMaterial(tx, application);
      return row;
    });
    return { ...created, fieldKey };
  }
}

function parseExpiry(value: string | undefined): Date | null {
  if (value === undefined || value === '') {
    return null;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new BadRequestException('Expiry date is invalid');
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException('Expiry date is invalid');
  }
  return parsed;
}
