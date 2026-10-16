import { BadRequestException, ForbiddenException, HttpException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import type { Response } from 'express';
import { PrismaService, type Tx } from '../prisma/prisma.service';
import { hashToken } from '../crypto/secrets';
import { redact } from '../common/redact';
import { CUSTOMER_TYPES, INVITATION_TTL_MS, type CustomerType } from '../domain';
import { hashPassword, AuthService } from '../auth/auth.service';
import type { AuthState } from '../auth/auth.types';

const INVALID = 'Invitation is not valid';

@Injectable()
export class InvitationService {
  private readonly logger = new Logger(InvitationService.name);
  private readonly resumeAttempts = new Map<string, number[]>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
  ) {}

  async create(auth: AuthState, input: { email: string; legalName: string; customerType: string; tenantId?: string }) {
    const email = input.email.trim().toLowerCase();
    const legalName = input.legalName.trim();
    if (!email || !legalName || !isCustomerType(input.customerType)) {
      throw new BadRequestException('Email, legal name, and customer type are required');
    }
    const tenantId = await this.targetTenant(auth, input.tenantId);
    const raw = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);
    const invitation = await this.prisma.withTenant(tenantId, (tx) =>
      tx.invitation.create({
        data: {
          tenantId,
          email,
          legalName,
          customerType: input.customerType,
          tokenHash: hashToken(raw),
          expiresAt,
        },
      }),
    );
    this.logger.log(JSON.stringify(redact({ invitationId: invitation.id, token: raw })));
    return {
      id: invitation.id,
      acceptPath: `/accept?token=${encodeURIComponent(raw)}`,
      expiresAt: invitation.expiresAt,
      emailSent: false,
    };
  }

  async revoke(auth: AuthState, id: string): Promise<void> {
    const updated = await this.prisma.withTenant(auth.tenantId, (tx) =>
      tx.invitation.updateMany({
        where: { id, tenantId: auth.tenantId, usedAt: null, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    );
    if (updated.count !== 1) {
      throw new BadRequestException(INVALID);
    }
  }

  async resume(auth: AuthState, email: string, tenantId?: string) {
    const normalised = email.trim().toLowerCase();
    if (!normalised) {
      throw new BadRequestException('Email is required');
    }
    const target = await this.targetTenant(auth, tenantId);
    const key = `${target}:${normalised}`;
    const now = Date.now();
    const recent = (this.resumeAttempts.get(key) ?? []).filter((stamp) => now - stamp < 60_000);
    if (recent.length >= 3) {
      throw new HttpException('Too many requests', 429);
    }
    recent.push(now);
    this.resumeAttempts.set(key, recent);
    const prior = await this.prisma.withTenant(target, (tx) =>
      tx.invitation.findFirst({
        where: { tenantId: target, email: normalised },
        orderBy: { createdAt: 'desc' },
      }),
    );
    if (!prior) {
      throw new NotFoundException('Invitation is not valid');
    }
    return this.create(auth, {
      email: prior.email,
      legalName: prior.legalName,
      customerType: prior.customerType,
      tenantId: target,
    });
  }

  private async targetTenant(auth: AuthState, requested?: string) {
    const requestedId = requested?.trim() ?? '';
    if (requestedId && requestedId !== auth.tenantId && !auth.permissions.includes('tenant.manage')) {
      throw new ForbiddenException('Permission denied');
    }
    const tenantId = requestedId || auth.tenantId;
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true, isSystem: true } });
    if (!tenant || tenant.isSystem) {
      throw new BadRequestException('Select an onboarding company');
    }
    if (tenant.id !== auth.tenantId && !auth.permissions.includes('tenant.manage')) {
      throw new ForbiddenException('Permission denied');
    }
    return tenant.id;
  }

  async accept(
    current: AuthState | null,
    input: { token?: string; password?: string; displayName?: string },
    res: Response,
  ) {
    const password = typeof input.password === 'string' ? input.password : '';
    if (typeof input.token !== 'string' || (password.length > 0 && password.length < 10)) {
      throw new BadRequestException(INVALID);
    }
    const invitation = await this.prisma.withInvitationLookup(hashToken(input.token), (tx) =>
      tx.invitation.findUnique({ where: { tokenHash: hashToken(input.token as string) } }),
    );
    if (!invitation || invitation.usedAt || invitation.revokedAt || invitation.expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException(INVALID);
    }
    if (current && current.tenantId !== invitation.tenantId) {
      throw new ForbiddenException('Tenant mismatch');
    }
    const displayName = input.displayName?.trim() || invitation.legalName;
    const passwordHash = await hashPassword(password || randomBytes(32).toString('base64url'));
    const role = await this.prisma.role.findUniqueOrThrow({ where: { key: 'customer' } });
    const user = await this.prisma.withTenant(invitation.tenantId, async (tx) => {
      const existing = await tx.user.findUnique({ where: { email: invitation.email } });
      if (existing) {
        if (existing.tenantId !== invitation.tenantId) {
          throw new ForbiddenException('Tenant mismatch');
        }
        await ensureDraft(tx, invitation, existing.id);
        await tx.invitation.update({ where: { id: invitation.id }, data: { usedAt: new Date() } });
        return existing;
      }
      const created = await tx.user.create({
        data: {
          tenantId: invitation.tenantId,
          email: invitation.email,
          displayName,
          passwordHash,
        },
      });
      await tx.userRole.create({
        data: { tenantId: invitation.tenantId, userId: created.id, roleId: role.id },
      });
      await ensureDraft(tx, invitation, created.id);
      await tx.invitation.update({ where: { id: invitation.id }, data: { usedAt: new Date() } });
      return created;
    });
    if (!current) {
      await this.auth.startSession(user.id, invitation.tenantId, res);
    }
    return { userId: user.id, tenantId: invitation.tenantId };
  }
}

function isCustomerType(value: string): value is CustomerType {
  return (CUSTOMER_TYPES as readonly string[]).includes(value);
}

async function ensureDraft(
  tx: Tx,
  invitation: { tenantId: string; legalName: string; customerType: string },
  userId: string,
) {
  const customer =
    (await tx.customer.findUnique({ where: { userId } })) ??
    (await tx.customer.create({
      data: {
        tenantId: invitation.tenantId,
        userId,
        legalName: invitation.legalName,
        customerType: invitation.customerType,
      },
    }));
  if (customer.tenantId !== invitation.tenantId) {
    throw new ForbiddenException('Tenant mismatch');
  }
  const application = await tx.application.findFirst({
    where: { tenantId: invitation.tenantId, customerId: customer.id },
    select: { id: true },
  });
  if (!application) {
    await tx.application.create({
      data: { tenantId: invitation.tenantId, customerId: customer.id, schemaVersion: 1, status: 'draft' },
    });
  }
}
