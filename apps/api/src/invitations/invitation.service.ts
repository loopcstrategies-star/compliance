import { BadRequestException, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { randomBytes } from 'crypto';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { hashToken } from '../crypto/secrets';
import { redact } from '../common/redact';
import { CUSTOMER_TYPES, INVITATION_TTL_MS, type CustomerType } from '../domain';
import { hashPassword, AuthService } from '../auth/auth.service';
import type { AuthState } from '../auth/auth.types';

const INVALID = 'Invitation is not valid';

@Injectable()
export class InvitationService {
  private readonly logger = new Logger(InvitationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
  ) {}

  async create(auth: AuthState, input: { email: string; legalName: string; customerType: string }) {
    const email = input.email.trim().toLowerCase();
    const legalName = input.legalName.trim();
    if (!email || !legalName || !isCustomerType(input.customerType)) {
      throw new BadRequestException('Email, legal name, and customer type are required');
    }
    const raw = randomBytes(32).toString('base64url');
    const invitation = await this.prisma.withTenant(auth.tenantId, (tx) =>
      tx.invitation.create({
        data: {
          tenantId: auth.tenantId,
          email,
          legalName,
          customerType: input.customerType,
          tokenHash: hashToken(raw),
          expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
        },
      }),
    );
    this.logger.log(JSON.stringify(redact({ invitationId: invitation.id, token: raw })));
    return {
      id: invitation.id,
      acceptPath: `/accept?token=${encodeURIComponent(raw)}`,
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

  async accept(
    current: AuthState | null,
    input: { token?: string; password?: string; displayName?: string },
    res: Response,
  ) {
    if (typeof input.token !== 'string' || typeof input.password !== 'string' || input.password.length < 10) {
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
    const passwordHash = await hashPassword(input.password);
    const role = await this.prisma.role.findUniqueOrThrow({ where: { key: 'customer' } });
    const user = await this.prisma.withTenant(invitation.tenantId, async (tx) => {
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
      const customer = await tx.customer.create({
        data: {
          tenantId: invitation.tenantId,
          userId: created.id,
          legalName: invitation.legalName,
          customerType: invitation.customerType,
        },
      });
      await tx.application.create({
        data: { tenantId: invitation.tenantId, customerId: customer.id, schemaVersion: 1, status: 'draft' },
      });
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
