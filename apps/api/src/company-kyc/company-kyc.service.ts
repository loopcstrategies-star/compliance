import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import type { Response } from 'express';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthState } from '../auth/auth.types';
import { hashToken } from '../crypto/secrets';
import { ensureFormCatalogue } from '../seed/form-catalogue';
import { FileService } from '../files/file.service';
import { readPrivateFile } from '../files/storage';

const SHARE_COOKIE = 'myka_share';
const ACCESS_MS = 60 * 60 * 1000;

@Injectable()
export class CompanyKycService {
  private readonly attempts = new Map<string, number[]>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly files: FileService,
  ) {}

  async get(auth: AuthState, tenantId: string) {
    this.assertTenant(auth, tenantId);
    return this.prisma.withTenant(tenantId, async (tx) => this.present(tx, tenantId));
  }

  async save(auth: AuthState, tenantId: string, input: { answers?: Record<string, unknown>; status?: string }) {
    this.assertTenant(auth, tenantId);
    if (!input?.answers || typeof input.answers !== 'object' || Array.isArray(input.answers)) {
      throw new BadRequestException('Answers are required');
    }
    const status = input.status === 'ready' ? 'ready' : 'draft';
    await ensureFormCatalogue(this.prisma);
    return this.prisma.withTenant(tenantId, async (tx) => {
      const allowed = new Set((await tx.formField.findMany({ select: { fieldKey: true } })).map((field) => field.fieldKey));
      for (const key of Object.keys(input.answers!)) {
        if (!allowed.has(key)) {
          throw new BadRequestException('Unknown field');
        }
      }
      const profile = await tx.companyKycProfile.upsert({
        where: { tenantId },
        create: { tenantId, status, reviewedAt: status === 'ready' ? new Date() : null },
        update: { status, reviewedAt: status === 'ready' ? new Date() : undefined },
      });
      for (const [fieldKey, value] of Object.entries(input.answers!)) {
        await tx.companyKycAnswer.upsert({
          where: { profileId_fieldKey: { profileId: profile.id, fieldKey } },
          create: { tenantId, profileId: profile.id, fieldKey, value: value as Prisma.InputJsonValue },
          update: { value: value as Prisma.InputJsonValue },
        });
      }
      await tx.auditEvent.create({
        data: { tenantId, actorId: auth.userId, action: 'company_kyc.save', targetType: 'company_kyc', targetId: profile.id },
      });
      return this.present(tx, tenantId);
    });
  }

  async addEvidence(
    auth: AuthState,
    tenantId: string,
    input: { documentType?: string; issuedOn?: string; expiresOn?: string },
    bytes: Buffer,
  ) {
    this.assertTenant(auth, tenantId);
    const documentType = input.documentType?.trim() ?? '';
    if (!documentType) {
      throw new BadRequestException('Document type is required');
    }
    const stored = await this.files.store(tenantId, bytes, 'document');
    return this.prisma.withTenant(tenantId, async (tx) => {
      const profile = await tx.companyKycProfile.upsert({
        where: { tenantId },
        create: { tenantId },
        update: {},
      });
      const evidence = await tx.companyEvidence.create({
        data: {
          tenantId,
          profileId: profile.id,
          documentType,
          fileId: stored.id,
          issuedOn: parseDate(input.issuedOn),
          expiresOn: parseDate(input.expiresOn),
        },
        select: { id: true, documentType: true, fileId: true, issuedOn: true, expiresOn: true },
      });
      await tx.auditEvent.create({
        data: { tenantId, actorId: auth.userId, action: 'company_kyc.evidence', targetType: 'company_evidence', targetId: evidence.id },
      });
      return evidence;
    });
  }

  async share(
    auth: AuthState,
    tenantId: string,
    input: {
      confirm?: boolean;
      recipientName?: string;
      recipientContact?: string;
      purpose?: string;
      fieldKeys?: string[];
      evidenceIds?: string[];
      expiresInDays?: number;
    },
  ) {
    this.assertTenant(auth, tenantId);
    if (input.confirm !== true) {
      throw new BadRequestException('Confirmation is required');
    }
    const recipientName = input.recipientName?.trim() ?? '';
    const recipientContact = input.recipientContact?.trim() ?? '';
    const purpose = input.purpose?.trim() ?? '';
    const fieldKeys = Array.isArray(input.fieldKeys) ? input.fieldKeys.filter((key) => typeof key === 'string') : [];
    const evidenceIds = Array.isArray(input.evidenceIds) ? input.evidenceIds.filter((key) => typeof key === 'string') : [];
    if (!recipientName || !recipientContact || !purpose || (fieldKeys.length === 0 && evidenceIds.length === 0)) {
      throw new BadRequestException('Recipient, purpose, and a selection are required');
    }
    const days = input.expiresInDays === 7 || input.expiresInDays === 30 ? input.expiresInDays : 7;
    const raw = randomBytes(32).toString('base64url');
    return this.prisma.withTenant(tenantId, async (tx) => {
      const profile = await tx.companyKycProfile.findUnique({ where: { tenantId }, include: { answers: true, evidence: true } });
      if (!profile) {
        throw new NotFoundException('Not found');
      }
      const knownFields = new Set(profile.answers.map((answer) => answer.fieldKey));
      const knownEvidence = new Set(profile.evidence.map((item) => item.id));
      if (fieldKeys.some((key) => !knownFields.has(key)) || evidenceIds.some((id) => !knownEvidence.has(id))) {
        throw new BadRequestException('Selection is not on this profile');
      }
      const grant = await tx.profileShareGrant.create({
        data: {
          tenantId,
          profileId: profile.id,
          createdById: auth.userId,
          recipientName,
          recipientContact,
          tokenHash: hashToken(raw),
          fieldKeys,
          evidenceIds,
          expiresAt: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
        },
      });
      await tx.auditEvent.create({
        data: {
          tenantId,
          actorId: auth.userId,
          action: 'company_kyc.share',
          targetType: 'profile_share',
          targetId: grant.id,
          purpose,
        },
      });
      return { id: grant.id, acceptPath: `/share?token=${encodeURIComponent(raw)}`, emailSent: false, expiresAt: grant.expiresAt };
    });
  }

  async revoke(auth: AuthState, tenantId: string, grantId: string) {
    this.assertTenant(auth, tenantId);
    const updated = await this.prisma.withTenant(tenantId, (tx) =>
      tx.profileShareGrant.updateMany({ where: { id: grantId, tenantId, revokedAt: null }, data: { revokedAt: new Date() } }),
    );
    if (updated.count !== 1) {
      throw new NotFoundException('Not found');
    }
    return { ok: true };
  }

  async accept(token: string | undefined, res: Response) {
    if (typeof token !== 'string' || !token) {
      throw new BadRequestException('Invitation is not valid');
    }
    this.limit(hashToken(token));
    const grant = await this.prisma.withGrantLookup(hashToken(token), (tx) =>
      tx.profileShareGrant.findUnique({ where: { tokenHash: hashToken(token) } }),
    );
    if (!grant || grant.revokedAt || grant.expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException('Invitation is not valid');
    }
    const access = randomBytes(32).toString('base64url');
    const accessExpiresAt = new Date(Date.now() + ACCESS_MS);
    await this.prisma.withTenant(grant.tenantId, (tx) =>
      tx.profileShareGrant.update({ where: { id: grant.id }, data: { accessHash: hashToken(access), accessExpiresAt } }),
    );
    res.cookie(SHARE_COOKIE, access, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.COOKIE_SECURE === 'true',
      path: '/',
      expires: accessExpiresAt,
    });
    return { ok: true };
  }

  async current(accessToken: string | undefined) {
    const grant = await this.openGrant(accessToken);
    return this.prisma.withTenant(grant.tenantId, async (tx) => {
      const answers = await tx.companyKycAnswer.findMany({
        where: { profileId: grant.profileId, fieldKey: { in: stringList(grant.fieldKeys) } },
        select: { fieldKey: true, value: true },
      });
      const evidence = await tx.companyEvidence.findMany({
        where: { id: { in: stringList(grant.evidenceIds) }, profileId: grant.profileId },
        select: { id: true, documentType: true, fileId: true, issuedOn: true, expiresOn: true },
      });
      return {
        recipientName: grant.recipientName,
        expiresAt: grant.expiresAt,
        answers,
        evidence,
      };
    });
  }

  async download(accessToken: string | undefined, fileId: string) {
    const grant = await this.openGrant(accessToken);
    return this.prisma.withTenant(grant.tenantId, async (tx) => {
      const evidence = await tx.companyEvidence.findFirst({
        where: { fileId, profileId: grant.profileId, id: { in: stringList(grant.evidenceIds) } },
        include: { file: true },
      });
      if (!evidence) {
        throw new NotFoundException('Not found');
      }
      await tx.auditEvent.create({
        data: {
          tenantId: grant.tenantId,
          actorId: grant.createdById,
          action: 'company_kyc.download',
          targetType: 'company_evidence',
          targetId: evidence.id,
          purpose: grant.recipientContact,
        },
      });
      return { bytes: readPrivateFile(evidence.file.storageKey), mediaType: evidence.file.mediaType };
    });
  }

  private async openGrant(accessToken: string | undefined) {
    if (!accessToken) {
      throw new UnauthorizedException();
    }
    const grant = await this.prisma.withGrantLookup(hashToken(accessToken), (tx) =>
      tx.profileShareGrant.findUnique({ where: { accessHash: hashToken(accessToken) } }),
    );
    if (!grant || grant.revokedAt || grant.expiresAt.getTime() <= Date.now() || !grant.accessExpiresAt || grant.accessExpiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException();
    }
    return grant;
  }

  private async present(tx: Prisma.TransactionClient, tenantId: string) {
    const profile = await tx.companyKycProfile.findUnique({
      where: { tenantId },
      include: {
        answers: { select: { fieldKey: true, value: true } },
        evidence: { select: { id: true, documentType: true, fileId: true, issuedOn: true, expiresOn: true, createdAt: true } },
        grants: { select: { id: true, recipientName: true, recipientContact: true, expiresAt: true, revokedAt: true, createdAt: true } },
      },
    });
    if (!profile) {
      return { status: 'draft', reviewedAt: null, updatedAt: null, answers: [], evidence: [], grants: [] };
    }
    return {
      status: profile.status,
      reviewedAt: profile.reviewedAt,
      updatedAt: profile.updatedAt,
      answers: profile.answers,
      evidence: profile.evidence,
      grants: profile.grants,
    };
  }

  private assertTenant(auth: AuthState, tenantId: string) {
    if (tenantId !== auth.tenantId && !auth.permissions.includes('tenant.manage')) {
      throw new NotFoundException('Not found');
    }
  }

  private limit(key: string) {
    const now = Date.now();
    const recent = (this.attempts.get(key) ?? []).filter((stamp) => now - stamp < 60_000);
    if (recent.length >= 10) {
      throw new BadRequestException('Too many requests');
    }
    recent.push(now);
    this.attempts.set(key, recent);
  }
}

function parseDate(value: string | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function stringList(value: Prisma.JsonValue): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}
