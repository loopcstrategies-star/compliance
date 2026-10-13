import { BadRequestException, ConflictException, Injectable, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService, type Tx } from '../prisma/prisma.service';
import type { AuthState } from '../auth/auth.types';
import { visibleApplication } from '../documents/application-access';

const OPEN_REVIEW = ['submitted', 'maker_review', 'checker_review'] as const;
const STAGE_ROLE: Record<(typeof OPEN_REVIEW)[number], string> = {
  submitted: 'maker',
  maker_review: 'checker',
  checker_review: 'authorised_approver',
};

type Policy = {
  makerHours: number;
  checkerHours: number;
  approverHours: number;
  draftReminderDays: number;
  expiryLeadDays: number;
  escalationEmail: string;
};

@Injectable()
export class OperationsService implements OnModuleInit, OnModuleDestroy {
  private timer: NodeJS.Timeout | undefined;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit(): void {
    if (process.env.OPERATIONS_TICK !== 'true') {
      return;
    }
    this.timer = setInterval(() => {
      void this.run(new Date());
    }, 60_000);
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  async dashboard(auth: AuthState, now = new Date()) {
    return this.prisma.withTenant(auth.tenantId, async (tx) => {
      const policy = await this.ensurePolicy(tx, auth.tenantId);
      const applications = await tx.application.findMany({
        where: { tenantId: auth.tenantId },
        select: {
          id: true,
          status: true,
          statusChangedAt: true,
          assigneeId: true,
          customer: { select: { legalName: true } },
        },
      });
      const counts = {
        draft: 0,
        submitted: 0,
        makerReview: 0,
        checkerReview: 0,
        approved: 0,
        correction: 0,
        reassessment: 0,
        overdue: 0,
      };
      for (const item of applications) {
        if (item.status === 'draft') counts.draft += 1;
        if (item.status === 'submitted') counts.submitted += 1;
        if (item.status === 'maker_review') counts.makerReview += 1;
        if (item.status === 'checker_review') counts.checkerReview += 1;
        if (item.status === 'approved') counts.approved += 1;
        if (item.status === 'correction') counts.correction += 1;
        if (item.status === 'reassessment') counts.reassessment += 1;
        if (isOverdue(item.status, item.statusChangedAt, policy, now)) counts.overdue += 1;
      }
      const lead = new Date(now.getTime() + policy.expiryLeadDays * 24 * 60 * 60 * 1000);
      const expiringDocuments = await tx.document.count({
        where: { tenantId: auth.tenantId, expiresOn: { lte: lead, not: null } },
      });
      return {
        ...counts,
        expiringDocuments,
        cases: applications
          .filter((item) => OPEN_REVIEW.includes(item.status as (typeof OPEN_REVIEW)[number]))
          .map((item) => ({
            id: item.id,
            status: item.status,
            legalName: item.customer.legalName,
            assigneeId: item.assigneeId,
          })),
      };
    });
  }

  async assign(auth: AuthState, applicationId: string, assigneeId: string) {
    return this.prisma.withTenant(auth.tenantId, async (tx) => {
      const application = await visibleApplication(tx, auth, applicationId);
      const role = STAGE_ROLE[application.status as (typeof OPEN_REVIEW)[number]];
      if (!role) {
        throw new BadRequestException('This stage cannot be assigned');
      }
      const assignee = await tx.user.findFirst({
        where: { id: assigneeId, tenantId: auth.tenantId },
        include: { roles: { include: { role: true } } },
      });
      if (!assignee) {
        throw new NotFoundException('Not found');
      }
      if (!assignee.roles.some((item) => item.role.key === role)) {
        throw new ConflictException('Assignee cannot take this stage');
      }
      return tx.application.update({
        where: { id: applicationId },
        data: { assigneeId },
        select: { id: true, assigneeId: true, status: true },
      });
    });
  }

  async processing(auth: AuthState) {
    return this.prisma.withTenant(auth.tenantId, async (tx) => {
      const submissions = await tx.submission.findMany({
        where: { tenantId: auth.tenantId, supersededAt: null },
        include: { decisions: { where: { supersededAt: null, outcome: 'accept' } } },
      });
      const buckets: Record<string, number[]> = { maker: [], checker: [], authorised_approver: [], approval: [] };
      for (const submission of submissions) {
        for (const decision of submission.decisions) {
          const hours = (decision.createdAt.getTime() - submission.createdAt.getTime()) / 3_600_000;
          if (buckets[decision.stage]) {
            buckets[decision.stage].push(hours);
          }
          if (decision.stage === 'authorised_approver') {
            buckets.approval.push(hours);
          }
        }
      }
      return {
        makerHours: average(buckets.maker),
        checkerHours: average(buckets.checker),
        approverHours: average(buckets.authorised_approver),
        approvalHours: average(buckets.approval),
      };
    });
  }

  async exportCsv(auth: AuthState): Promise<string> {
    return this.prisma.withTenant(auth.tenantId, async (tx) => {
      const rows = await tx.application.findMany({
        where: { tenantId: auth.tenantId },
        select: {
          id: true,
          status: true,
          documentVersion: true,
          statusChangedAt: true,
          assigneeId: true,
          customer: { select: { legalName: true, customerType: true } },
        },
        orderBy: { createdAt: 'asc' },
      });
      await tx.auditEvent.create({
        data: {
          tenantId: auth.tenantId,
          actorId: auth.userId,
          action: 'report.export',
          targetType: 'application',
        },
      });
      const lines = ['id,status,legalName,customerType,documentVersion,assigneeId,statusChangedAt'];
      for (const row of rows) {
        lines.push(
          [
            row.id,
            row.status,
            csv(row.customer.legalName),
            row.customer.customerType,
            String(row.documentVersion),
            row.assigneeId ?? '',
            row.statusChangedAt.toISOString(),
          ].join(','),
        );
      }
      return lines.join('\n');
    });
  }

  async getPolicy(tenantId: string) {
    return this.prisma.withTenant(tenantId, (tx) => this.ensurePolicy(tx, tenantId));
  }

  async updatePolicy(tenantId: string, input: Policy) {
    const hours = [input.makerHours, input.checkerHours, input.approverHours, input.draftReminderDays, input.expiryLeadDays];
    if (hours.some((value) => !Number.isInteger(value) || value < 1) || typeof input.escalationEmail !== 'string') {
      throw new BadRequestException('Operations settings are required');
    }
    return this.prisma.withTenant(tenantId, async (tx) => {
      await this.ensurePolicy(tx, tenantId);
      return tx.operationsPolicy.update({
        where: { tenantId },
        data: { ...input, escalationEmail: input.escalationEmail.trim() },
      });
    });
  }

  async run(now: Date): Promise<void> {
    const tenants = await this.prisma.tenant.findMany({ where: { isSystem: false }, select: { id: true } });
    for (const tenant of tenants) {
      await this.prisma.withTenant(tenant.id, (tx) => this.runTenant(tx, tenant.id, now));
    }
  }

  private async runTenant(tx: Tx, tenantId: string, now: Date): Promise<void> {
    const policy = await this.ensurePolicy(tx, tenantId);
    const day = now.toISOString().slice(0, 10);
    const applications = await tx.application.findMany({
      where: { tenantId },
      include: { customer: { include: { user: true } }, assignee: true },
    });
    for (const application of applications) {
      const customerEmail = application.customer.user?.email ?? '';
      if (application.status === 'draft' || application.status === 'correction') {
        const idleMs = policy.draftReminderDays * 24 * 60 * 60 * 1000;
        if (now.getTime() - application.statusChangedAt.getTime() >= idleMs) {
          await this.record(tx, tenantId, application.id, application.status === 'draft' ? 'draft_idle' : 'correction', day, customerEmail);
        }
      }
      if (isOverdue(application.status, application.statusChangedAt, policy, now)) {
        await this.record(tx, tenantId, application.id, 'review_overdue', day, application.assignee?.email ?? customerEmail);
        const limit = hoursFor(application.status, policy) * 2 * 60 * 60 * 1000;
        if (now.getTime() - application.statusChangedAt.getTime() >= limit) {
          await this.record(tx, tenantId, application.id, 'review_escalation', day, policy.escalationEmail);
        }
      }
    }
    const lead = new Date(now.getTime() + policy.expiryLeadDays * 24 * 60 * 60 * 1000);
    const expiring = await tx.document.findMany({
      where: { tenantId, expiresOn: { lte: lead, not: null } },
      select: { applicationId: true },
    });
    const seen = new Set<string>();
    for (const document of expiring) {
      if (seen.has(document.applicationId)) continue;
      seen.add(document.applicationId);
      const application = applications.find((item) => item.id === document.applicationId);
      await this.record(tx, tenantId, document.applicationId, 'document_expiry', day, application?.customer.user?.email ?? '');
    }
  }

  private async record(tx: Tx, tenantId: string, applicationId: string, kind: string, day: string, recipient: string) {
    const idempotencyKey = `${tenantId}:${applicationId}:${kind}:${day}`;
    const existing = await tx.delivery.findUnique({ where: { idempotencyKey } });
    if (existing) {
      return;
    }
    const status = recipient ? 'sent' : 'suppressed';
    await tx.delivery.create({
      data: { tenantId, applicationId, kind, idempotencyKey, recipient, status },
    });
  }

  private async ensurePolicy(tx: Tx, tenantId: string) {
    const existing = await tx.operationsPolicy.findUnique({ where: { tenantId } });
    if (existing) {
      return existing;
    }
    return tx.operationsPolicy.create({ data: { tenantId } });
  }
}

function hoursFor(status: string, policy: Policy): number {
  if (status === 'maker_review') return policy.checkerHours;
  if (status === 'checker_review') return policy.approverHours;
  return policy.makerHours;
}

function isOverdue(status: string, changedAt: Date, policy: Policy, now: Date): boolean {
  if (!OPEN_REVIEW.includes(status as (typeof OPEN_REVIEW)[number])) {
    return false;
  }
  return changedAt.getTime() + hoursFor(status, policy) * 60 * 60 * 1000 < now.getTime();
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100;
}

function csv(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}
