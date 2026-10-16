import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService, type Tx } from '../prisma/prisma.service';
import type { AuthState } from '../auth/auth.types';
import { CUSTOMER_TYPES, STAFF_ROLES } from '../domain';
import { removePrivateFile } from '../files/storage';
import { assertUniqueTenantName, duplicateNameError } from '../tenants/tenant-name';

const TEMPLATES = ['kyc', 'pep-declaration', 'pep-questionnaire', 'responsible-sourcing'];
const CATEGORIES = ['application', 'document', 'audit'];
const DAY = 24 * 60 * 60 * 1000;

@Injectable()
export class AdministrationService {
  constructor(private readonly prisma: PrismaService) {}

  async renameTenant(id: string, name: string) {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new BadRequestException('Name is required');
    }
    await assertUniqueTenantName(this.prisma, trimmed, id);
    try {
      return await this.prisma.tenant.update({
        where: { id },
        data: { name: trimmed },
        select: { id: true, name: true, isSystem: true },
      });
    } catch (error) {
      throw duplicateNameError(error);
    }
  }

  setApplicability(tenantId: string, customerType: string, templateId: string, required: boolean) {
    if (!(CUSTOMER_TYPES as readonly string[]).includes(customerType) || !TEMPLATES.includes(templateId) || typeof required !== 'boolean') {
      throw new BadRequestException('Applicability is invalid');
    }
    return this.prisma.withTenant(tenantId, (tx) =>
      tx.tenantApplicability.upsert({
        where: { tenantId_customerType_templateId: { tenantId, customerType, templateId } },
        create: { tenantId, customerType, templateId, required },
        update: { required },
      }),
    );
  }

  async grantRole(tenantId: string, userId: string, roleKey: string) {
    if (!(STAFF_ROLES as readonly string[]).includes(roleKey)) {
      throw new BadRequestException('Role is invalid');
    }
    return this.prisma.withTenant(tenantId, async (tx) => {
      const user = await tx.user.findFirst({ where: { id: userId, tenantId } });
      const role = await tx.role.findUnique({ where: { key: roleKey } });
      if (!user || !role) {
        throw new NotFoundException('Not found');
      }
      await tx.userRole.upsert({
        where: { userId_roleId: { userId, roleId: role.id } },
        create: { tenantId, userId, roleId: role.id },
        update: {},
      });
      return { userId, role: roleKey };
    });
  }

  async removeRole(tenantId: string, userId: string, roleKey: string) {
    if (!(STAFF_ROLES as readonly string[]).includes(roleKey)) {
      throw new BadRequestException('Role is invalid');
    }
    return this.prisma.withTenant(tenantId, async (tx) => {
      const tenant = await tx.tenant.findUnique({ where: { id: tenantId } });
      const role = await tx.role.findUnique({ where: { key: roleKey } });
      const user = await tx.user.findFirst({ where: { id: userId, tenantId } });
      if (!tenant || !role || !user) {
        throw new NotFoundException('Not found');
      }
      if (tenant.isSystem && roleKey === 'super_admin') {
        const holders = await tx.userRole.count({ where: { tenantId, roleId: role.id } });
        if (holders <= 1) {
          throw new ForbiddenException('The last super-admin cannot be removed');
        }
      }
      await tx.userRole.deleteMany({ where: { tenantId, userId, roleId: role.id } });
      return { userId, role: roleKey };
    });
  }

  async revokeSessions(tenantId: string, userId: string) {
    const result = await this.prisma.withTenant(tenantId, async (tx) => {
      const user = await tx.user.findFirst({ where: { id: userId, tenantId } });
      if (!user) {
        throw new NotFoundException('Not found');
      }
      return tx.session.updateMany({
        where: { tenantId, userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });
    return { revoked: result.count };
  }

  saveRetention(tenantId: string, category: string, retentionDays: number, effectiveFrom: string) {
    if (!CATEGORIES.includes(category) || !Number.isInteger(retentionDays) || retentionDays < 1 || !/^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom)) {
      throw new BadRequestException('Retention policy is invalid');
    }
    const effective = new Date(`${effectiveFrom}T00:00:00.000Z`);
    return this.prisma.withTenant(tenantId, (tx) =>
      tx.retentionPolicy.upsert({
        where: { tenantId_category: { tenantId, category } },
        create: { tenantId, category, retentionDays, effectiveFrom: effective },
        update: { retentionDays, effectiveFrom: effective },
      }),
    );
  }

  hold(tenantId: string, targetType: string, targetId: string, reason: string) {
    if (!reason.trim() || !targetId) {
      throw new BadRequestException('Hold reason is required');
    }
    return this.prisma.withTenant(tenantId, (tx) =>
      tx.legalHold.create({
        data: { tenantId, targetType, targetId, reason: reason.trim() },
        select: { id: true, targetType: true, targetId: true },
      }),
    );
  }

  requestDeletion(auth: AuthState, tenantId: string, targetType: string, targetId: string, reason: string) {
    if (!reason.trim() || targetType !== 'stored_file' || !targetId) {
      throw new BadRequestException('Deletion request is invalid');
    }
    return this.prisma.withTenant(tenantId, async (tx) => {
      const file = await tx.storedFile.findFirst({ where: { id: targetId, tenantId } });
      if (!file) {
        throw new NotFoundException('Not found');
      }
      return tx.deletionRequest.create({
        data: {
          tenantId,
          targetType,
          targetId,
          requesterId: auth.userId,
          status: 'requested',
          reason: reason.trim(),
        },
        select: { id: true, status: true },
      });
    });
  }

  approveDeletion(auth: AuthState, tenantId: string, id: string) {
    return this.prisma.withTenant(tenantId, (tx) => this.decide(tx, auth, tenantId, id, true));
  }

  rejectDeletion(auth: AuthState, tenantId: string, id: string) {
    return this.prisma.withTenant(tenantId, (tx) => this.decide(tx, auth, tenantId, id, false));
  }

  async purge(tenantId: string, now = new Date()) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const policy = await tx.retentionPolicy.findUnique({ where: { tenantId_category: { tenantId, category: 'document' } } });
      const files = await tx.storedFile.findMany({ where: { tenantId, quarantinedAt: { not: null }, scanStatus: 'clean' } });
      let removed = 0;
      for (const file of files) {
        if (!policy || policy.effectiveFrom.getTime() > now.getTime()) {
          continue;
        }
        if (file.quarantinedAt!.getTime() + policy.retentionDays * DAY > now.getTime()) {
          continue;
        }
        if (await this.activeHold(tx, tenantId, 'stored_file', file.id)) {
          continue;
        }
        removePrivateFile(file.storageKey);
        await tx.storedFile.update({
          where: { id: file.id },
          data: { scanStatus: 'purged', byteSize: 0 },
        });
        removed += 1;
      }
      return { removed };
    });
  }

  async audit(tenantId: string, now = new Date()) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const policy = await tx.retentionPolicy.findUnique({ where: { tenantId_category: { tenantId, category: 'audit' } } });
      const events = await tx.auditEvent.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' } });
      const rows = [];
      for (const event of events) {
        const held = await this.activeHold(tx, tenantId, 'audit', event.id);
        const expired = Boolean(
          policy &&
            policy.effectiveFrom.getTime() <= now.getTime() &&
            event.createdAt.getTime() + policy.retentionDays * DAY < now.getTime(),
        );
        rows.push({
          id: event.id,
          action: event.action,
          targetType: event.targetType,
          targetId: event.targetId,
          createdAt: event.createdAt,
          quarantined: expired && !held,
        });
      }
      return rows;
    });
  }

  private async decide(tx: Tx, auth: AuthState, tenantId: string, id: string, approve: boolean) {
    const request = await tx.deletionRequest.findFirst({ where: { id, tenantId } });
    if (!request || request.status !== 'requested') {
      throw new NotFoundException('Not found');
    }
    if (request.requesterId === auth.userId) {
      throw new ForbiddenException('The requester cannot approve this deletion');
    }
    if (!approve) {
      return tx.deletionRequest.update({ where: { id }, data: { status: 'rejected', approverId: auth.userId } });
    }
    if (await this.activeHold(tx, tenantId, request.targetType, request.targetId)) {
      return tx.deletionRequest.update({ where: { id }, data: { status: 'refused', approverId: auth.userId } });
    }
    await tx.storedFile.update({ where: { id: request.targetId }, data: { quarantinedAt: new Date() } });
    return tx.deletionRequest.update({ where: { id }, data: { status: 'quarantined', approverId: auth.userId } });
  }

  private async activeHold(tx: Tx, tenantId: string, targetType: string, targetId: string) {
    const hold = await tx.legalHold.findFirst({ where: { tenantId, targetType, targetId, releasedAt: null } });
    return Boolean(hold);
  }
}
