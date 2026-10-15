import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthState } from '../auth/auth.types';
import { visibleApplication } from '../documents/application-access';
import { isTemplateRequired } from '../documents/applicability';
import { ensureFormCatalogue } from '../seed/form-catalogue';

const STAGES = {
  maker: { from: 'submitted', to: 'maker_review', permission: 'review.maker' },
  checker: { from: 'maker_review', to: 'checker_review', permission: 'review.checker' },
  authorised_approver: { from: 'checker_review', to: 'approved', permission: 'review.approve' },
} as const;

type Stage = keyof typeof STAGES;
const SUBMITTABLE = new Set(['draft', 'correction', 'reassessment']);
const REQUEST_STATUSES = ['submitted'];
const WAITING_STATUSES = ['maker_review', 'checker_review', 'correction', 'reassessment'];
const CUSTOMER_STATUSES = ['approved'];
const STATUSES_FOR: Record<string, string[]> = {
  requests: REQUEST_STATUSES,
  waiting: WAITING_STATUSES,
  customers: CUSTOMER_STATUSES,
};

function isQueueOverdue(
  status: string,
  changedAt: Date,
  hours: { makerHours: number; checkerHours: number; approverHours: number },
  now: number,
): boolean {
  if (!['maker_review', 'checker_review', 'reassessment'].includes(status)) {
    return false;
  }
  const limit = status === 'maker_review' ? hours.checkerHours : status === 'checker_review' ? hours.approverHours : hours.makerHours;
  return changedAt.getTime() + limit * 60 * 60 * 1000 < now;
}

@Injectable()
export class ReviewService {
  constructor(private readonly prisma: PrismaService) {}

  async list(auth: AuthState) {
    return this.prisma.withTenant(auth.tenantId, (tx) =>
      tx.application.findMany({
        where: {
          tenantId: auth.tenantId,
          ...(auth.roles.includes('customer') ? { customer: { userId: auth.userId } } : {}),
          ...queueFilter(auth.roles),
        },
        select: {
          id: true,
          status: true,
          documentVersion: true,
          customer: { select: { legalName: true, customerType: true } },
        },
        orderBy: { createdAt: 'asc' },
      }),
    );
  }

  async board(auth: AuthState, view: string, requestedTenantId?: string, daysRaw?: string) {
    const tenantId = this.targetTenant(auth, requestedTenantId);
    const statuses = STATUSES_FOR[view];
    if (!statuses && view !== 'dashboard') {
      throw new BadRequestException('Queue is invalid');
    }
    const windowDays = daysRaw === '60' ? 60 : daysRaw === '90' ? 90 : 30;
    return this.prisma.withTenant(tenantId, async (tx) => {
      const policy = await tx.operationsPolicy.findUnique({ where: { tenantId } });
      const hours = {
        makerHours: policy?.makerHours ?? 48,
        checkerHours: policy?.checkerHours ?? 48,
        approverHours: policy?.approverHours ?? 48,
      };
      const rows = await tx.application.findMany({
        where: {
          tenantId,
          ...(auth.roles.includes('customer') ? { customer: { userId: auth.userId } } : {}),
        },
        select: {
          id: true,
          status: true,
          documentVersion: true,
          createdAt: true,
          statusChangedAt: true,
          assignee: { select: { displayName: true } },
          customer: { select: { legalName: true, customerType: true } },
        },
        orderBy: { statusChangedAt: 'asc' },
      });
      const now = Date.now();
      const decorated = rows.map((row) => ({
        id: row.id,
        status: row.status,
        documentVersion: row.documentVersion,
        createdAt: row.createdAt,
        statusChangedAt: row.statusChangedAt,
        legalName: row.customer.legalName,
        customerType: row.customer.customerType,
        assignee: row.assignee?.displayName ?? '',
        overdue: isQueueOverdue(row.status, row.statusChangedAt, hours, now),
        dueAt: dueAtFor(row.status, row.statusChangedAt, hours),
      }));
      const counts = {
        requests: decorated.filter((row) => REQUEST_STATUSES.includes(row.status)).length,
        waiting: decorated.filter((row) => WAITING_STATUSES.includes(row.status)).length,
        corrections: decorated.filter((row) => row.status === 'correction').length,
        customers: decorated.filter((row) => CUSTOMER_STATUSES.includes(row.status)).length,
        overdue: decorated.filter((row) => row.overdue).length,
      };
      const items =
        view === 'dashboard'
          ? []
          : decorated.filter((row) => statuses!.includes(row.status));
      if (view !== 'dashboard') {
        return { tenantId, counts, items };
      }
      const windowStart = now - windowDays * 24 * 60 * 60 * 1000;
      const opened = decorated.filter((row) => row.createdAt.getTime() >= windowStart);
      const distribution = distributionFor(opened);
      const recent = [...opened].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 8);
      const waitingPreview = decorated.filter((row) => WAITING_STATUSES.includes(row.status)).slice(0, 8);
      const leadDays = policy?.expiryLeadDays ?? 30;
      const lead = new Date(now + leadDays * 24 * 60 * 60 * 1000);
      const expiring = await tx.document.findMany({
        where: { tenantId, expiresOn: { lte: lead, not: null } },
        select: {
          id: true,
          fieldKey: true,
          expiresOn: true,
          application: { select: { id: true, customer: { select: { legalName: true } } } },
        },
        orderBy: { expiresOn: 'asc' },
        take: 8,
      });
      return {
        tenantId,
        windowDays,
        counts: { ...counts, total: opened.length },
        items,
        distribution,
        recent,
        waitingPreview,
        expiring: expiring.map((item) => ({
          id: item.id,
          applicationId: item.application.id,
          legalName: item.application.customer.legalName,
          document: item.fieldKey,
          expiresOn: item.expiresOn,
          status: item.expiresOn && item.expiresOn.getTime() < now ? 'expired' : 'due_soon',
        })),
      };
    });
  }

  async dossier(auth: AuthState, applicationId: string, requestedTenantId?: string) {
    const tenantId = this.targetTenant(auth, requestedTenantId);
    await ensureFormCatalogue(this.prisma);
    return this.prisma.withTenant(tenantId, async (tx) => {
      const application = await tx.application.findFirst({
        where: {
          id: applicationId,
          tenantId,
          ...(auth.roles.includes('customer') ? { customer: { userId: auth.userId } } : {}),
        },
        include: {
          customer: { select: { legalName: true, customerType: true } },
          assignee: { select: { displayName: true } },
          answers: { select: { fieldKey: true, value: true } },
          documents: { select: { id: true, fieldKey: true, expiresOn: true, fileId: true } },
          generatedPackages: {
            select: { id: true, templateId: true, version: true, fileId: true, templateSha256: true, blocked: true },
            orderBy: { version: 'desc' },
          },
          submissions: { select: { id: true, documentVersion: true, createdAt: true }, orderBy: { createdAt: 'desc' } },
        },
      });
      if (!application) {
        throw new NotFoundException('Not found');
      }
      const fields = await tx.formField.findMany({
        where: { schema: { version: application.schemaVersion } },
        select: { fieldKey: true, label: true, sortOrder: true },
        orderBy: { sortOrder: 'asc' },
      });
      const decisions = await tx.reviewDecision.findMany({
        where: { tenantId, submission: { applicationId } },
        select: {
          id: true,
          stage: true,
          outcome: true,
          reason: true,
          documentVersion: true,
          createdAt: true,
          actor: { select: { displayName: true } },
        },
        orderBy: { createdAt: 'asc' },
      });
      const answers = new Map(application.answers.map((answer) => [answer.fieldKey, answer.value]));
      const sections = ['kyc', 'ownership', 'pep', 'financial', 'documents', 'other'] as const;
      const grouped = Object.fromEntries(sections.map((section) => [section, [] as { fieldKey: string; label: string; value: unknown }[]]));
      for (const field of fields) {
        const section = sectionFor(field.fieldKey);
        grouped[section].push({
          fieldKey: field.fieldKey,
          label: field.label,
          value: answers.has(field.fieldKey) ? answers.get(field.fieldKey) : null,
        });
      }
      return {
        id: application.id,
        status: application.status,
        documentVersion: application.documentVersion,
        createdAt: application.createdAt,
        statusChangedAt: application.statusChangedAt,
        legalName: application.customer.legalName,
        customerType: application.customer.customerType,
        assignee: application.assignee?.displayName ?? '',
        sections: grouped,
        documents: application.documents.map((item) => ({
          id: item.id,
          fieldKey: item.fieldKey,
          fileId: item.fileId,
          expiresOn: item.expiresOn,
        })),
        packages: application.generatedPackages,
        submissions: application.submissions,
        decisions: decisions.map((decision) => ({
          id: decision.id,
          stage: decision.stage,
          outcome: decision.outcome,
          reason: decision.reason,
          documentVersion: decision.documentVersion,
          createdAt: decision.createdAt,
          actor: decision.actor.displayName,
        })),
      };
    });
  }

  async summary(auth: AuthState, applicationId: string, requestedTenantId?: string) {
    const tenantId = this.targetTenant(auth, requestedTenantId);
    const row = await this.prisma.withTenant(tenantId, (tx) =>
      tx.application.findFirst({
        where: {
          id: applicationId,
          tenantId,
          ...(auth.roles.includes('customer') ? { customer: { userId: auth.userId } } : {}),
        },
        select: {
          id: true,
          status: true,
          documentVersion: true,
          createdAt: true,
          statusChangedAt: true,
          assignee: { select: { displayName: true } },
          customer: { select: { legalName: true, customerType: true } },
        },
      }),
    );
    if (!row) {
      throw new NotFoundException('Not found');
    }
    return {
      id: row.id,
      status: row.status,
      documentVersion: row.documentVersion,
      createdAt: row.createdAt,
      statusChangedAt: row.statusChangedAt,
      legalName: row.customer.legalName,
      customerType: row.customer.customerType,
      assignee: row.assignee?.displayName ?? '',
    };
  }

  private targetTenant(auth: AuthState, requestedTenantId?: string): string {
    if (!requestedTenantId || requestedTenantId === auth.tenantId) {
      return auth.tenantId;
    }
    if (!auth.permissions.includes('tenant.manage')) {
      throw new ForbiddenException('Permission denied');
    }
    return requestedTenantId;
  }

  async submit(auth: AuthState, applicationId: string) {
    return this.prisma.withTenant(auth.tenantId, async (tx) => {
      const application = await visibleApplication(tx, auth, applicationId);
      if (!SUBMITTABLE.has(application.status)) {
        throw new BadRequestException('This case cannot be submitted');
      }
      const packages = await tx.generatedPackage.findMany({
        where: { applicationId, tenantId: auth.tenantId },
        orderBy: { version: 'desc' },
      });
      const latest = new Map<string, string>();
      for (const item of packages) {
        if (!latest.has(item.templateId)) {
          latest.set(item.templateId, item.id);
        }
      }
      const submission = await tx.submission.create({
        data: {
          tenantId: auth.tenantId,
          applicationId,
          documentVersion: application.documentVersion,
          packageIds: [...latest.values()],
        },
      });
      const updated = await tx.application.update({
        where: { id: applicationId },
        data: { status: 'submitted', statusChangedAt: new Date() },
        select: { id: true, status: true, documentVersion: true },
      });
      return { ...updated, submissionId: submission.id };
    });
  }

  async decide(
    auth: AuthState,
    applicationId: string,
    input: { stage?: string; outcome?: string; reason?: string; documentVersion?: number; tenantId?: string },
  ) {
    if (input.tenantId && input.tenantId !== auth.tenantId) {
      throw new ForbiddenException('Tenant mismatch');
    }
    const stage = input.stage as Stage;
    const rule = STAGES[stage];
    if (!rule) {
      throw new BadRequestException('Stage is invalid');
    }
    const reason = input.reason?.trim() ?? '';
    if (!reason || (input.outcome !== 'accept' && input.outcome !== 'return')) {
      throw new BadRequestException('Reason and outcome are required');
    }
    const outcome = input.outcome;
    if (typeof input.documentVersion !== 'number') {
      throw new BadRequestException('Document version is required');
    }
    return this.prisma.withTenant(auth.tenantId, async (tx) => {
      const application = await visibleApplication(tx, auth, applicationId);
      if (!auth.permissions.includes(rule.permission)) {
        throw new ForbiddenException();
      }
      const submission = await tx.submission.findFirst({
        where: { applicationId, tenantId: auth.tenantId, supersededAt: null },
        orderBy: { createdAt: 'desc' },
      });
      if (
        !submission ||
        input.documentVersion !== submission.documentVersion ||
        application.documentVersion !== submission.documentVersion
      ) {
        throw new ConflictException('Document version is stale');
      }
      if (application.status !== rule.from) {
        throw new BadRequestException('This stage is not open');
      }
      await this.assertSegregation(tx, auth.tenantId, submission.id, stage, auth.userId);
      const [documents, packages] = await Promise.all([
        tx.document.findMany({ where: { applicationId }, select: { id: true } }),
        tx.generatedPackage.findMany({ where: { applicationId }, select: { id: true } }),
      ]);
      const decision = await tx.reviewDecision.create({
        data: {
          tenantId: auth.tenantId,
          submissionId: submission.id,
          stage,
          outcome,
          actorId: auth.userId,
          reason,
          evidenceIds: [...documents.map((item) => item.id), ...packages.map((item) => item.id)],
          documentVersion: submission.documentVersion,
        },
        select: { id: true, stage: true, outcome: true, documentVersion: true, reason: true },
      });
      if (outcome === 'return') {
        const now = new Date();
        await tx.reviewDecision.updateMany({
          where: { submissionId: submission.id, supersededAt: null },
          data: { supersededAt: now },
        });
        await tx.submission.update({ where: { id: submission.id }, data: { supersededAt: now } });
        await tx.application.update({
          where: { id: applicationId },
          data: { status: 'correction', statusChangedAt: new Date() },
        });
        return { ...decision, status: 'correction' };
      }
      const updated = await tx.application.update({
        where: { id: applicationId },
        data: { status: rule.to, statusChangedAt: new Date() },
        select: { status: true },
      });
      return { ...decision, status: updated.status };
    });
  }

  async completeness(auth: AuthState, applicationId: string) {
    await ensureFormCatalogue(this.prisma);
    return this.prisma.withTenant(auth.tenantId, async (tx) => {
      const application = await visibleApplication(tx, auth, applicationId);
      const rules = await tx.applicabilityRule.findMany({ where: { customerType: application.customer.customerType } });
      const fields = await tx.formField.findMany({
        where: { schema: { version: application.schemaVersion } },
        include: { schema: true },
        orderBy: { sortOrder: 'asc' },
      });
      const answers = await tx.answer.findMany({ where: { applicationId } });
      const documents = await tx.document.findMany({ where: { applicationId }, select: { fieldKey: true } });
      const answered = new Set(answers.filter((answer) => !emptyValue(answer.value)).map((answer) => answer.fieldKey));
      const uploaded = new Set(documents.map((item) => item.fieldKey));
      const missingAnswers: string[] = [];
      const missingUploads: string[] = [];
      for (const field of fields) {
        if (!(await isTemplateRequired(tx, auth.tenantId, application.customer.customerType, field.schema.templateId))) {
          continue;
        }
        const fieldRule = rules.find((rule) => rule.templateId === field.schema.templateId && rule.fieldKey === field.fieldKey);
        if (fieldRule && !fieldRule.required) {
          continue;
        }
        if (field.fieldKey.startsWith('kyc.docs.')) {
          if (!uploaded.has(field.fieldKey)) {
            missingUploads.push(field.fieldKey);
          }
          continue;
        }
        if (!answered.has(field.fieldKey)) {
          missingAnswers.push(field.fieldKey);
        }
      }
      return {
        applicationId,
        status: application.status,
        missingAnswers,
        missingUploads,
      };
    });
  }

  async getPolicy(tenantId: string) {
    return this.prisma.withTenant(tenantId, (tx) => this.ensurePolicy(tx, tenantId));
  }

  async updatePolicy(
    tenantId: string,
    input: { makerDistinctFromChecker?: boolean; checkerDistinctFromApprover?: boolean; makerDistinctFromApprover?: boolean },
  ) {
    if (
      typeof input.makerDistinctFromChecker !== 'boolean' ||
      typeof input.checkerDistinctFromApprover !== 'boolean' ||
      typeof input.makerDistinctFromApprover !== 'boolean'
    ) {
      throw new BadRequestException('Segregation switches are required');
    }
    return this.prisma.withTenant(tenantId, async (tx) => {
      await this.ensurePolicy(tx, tenantId);
      return tx.segregationPolicy.update({
        where: { tenantId },
        data: input,
      });
    });
  }

  private async ensurePolicy(tx: Prisma.TransactionClient, tenantId: string) {
    const existing = await tx.segregationPolicy.findUnique({ where: { tenantId } });
    if (existing) {
      return existing;
    }
    return tx.segregationPolicy.create({ data: { tenantId } });
  }

  private async assertSegregation(tx: Prisma.TransactionClient, tenantId: string, submissionId: string, stage: Stage, actorId: string) {
    const policy = await this.ensurePolicy(tx, tenantId);
    const prior = await tx.reviewDecision.findMany({
      where: { submissionId, supersededAt: null, outcome: 'accept' },
    });
    const maker = prior.find((item) => item.stage === 'maker')?.actorId;
    const checker = prior.find((item) => item.stage === 'checker')?.actorId;
    const conflict =
      (stage === 'checker' && policy.makerDistinctFromChecker && maker === actorId) ||
      (stage === 'authorised_approver' && policy.checkerDistinctFromApprover && checker === actorId) ||
      (stage === 'authorised_approver' && policy.makerDistinctFromApprover && maker === actorId);
    if (conflict) {
      throw new ConflictException('Segregation policy rejects this assignment');
    }
  }
}

function dueAtFor(
  status: string,
  changedAt: Date,
  hours: { makerHours: number; checkerHours: number; approverHours: number },
): string | null {
  if (!['maker_review', 'checker_review', 'reassessment'].includes(status)) {
    return null;
  }
  const limit = status === 'maker_review' ? hours.checkerHours : status === 'checker_review' ? hours.approverHours : hours.makerHours;
  return new Date(changedAt.getTime() + limit * 60 * 60 * 1000).toISOString();
}

function distributionFor(rows: { status: string }[]): { status: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    counts.set(row.status, (counts.get(row.status) ?? 0) + 1);
  }
  return [...counts.entries()].map(([status, count]) => ({ status, count }));
}

function sectionFor(fieldKey: string): 'kyc' | 'ownership' | 'pep' | 'financial' | 'documents' | 'other' {
  if (fieldKey.includes('shareholder') || fieldKey.includes('ubo') || fieldKey.includes('management')) {
    return 'ownership';
  }
  if (fieldKey.includes('pep') || fieldKey.includes('aml')) {
    return 'pep';
  }
  if (fieldKey.includes('fund') || fieldKey.includes('wealth') || fieldKey.includes('bank') || fieldKey.startsWith('rspolicy')) {
    return 'financial';
  }
  if (fieldKey.startsWith('kyc.docs')) {
    return 'documents';
  }
  if (fieldKey.startsWith('pep')) {
    return 'pep';
  }
  if (fieldKey.startsWith('kyc.')) {
    return 'kyc';
  }
  return 'other';
}

function queueFilter(roles: string[]): { status?: { in: string[] } } {
  if (roles.includes('customer') || roles.includes('employee') || roles.includes('super_admin')) {
    return {};
  }
  const statuses: string[] = [];
  if (roles.includes('maker')) {
    statuses.push('submitted');
  }
  if (roles.includes('checker')) {
    statuses.push('maker_review');
  }
  if (roles.includes('authorised_approver')) {
    statuses.push('checker_review');
  }
  return statuses.length > 0 ? { status: { in: statuses } } : {};
}

function emptyValue(value: Prisma.JsonValue): boolean {
  if (value === null || value === '') {
    return true;
  }
  if (Array.isArray(value)) {
    return value.length === 0;
  }
  if (typeof value === 'object') {
    return Object.values(value).every((item) => item === '' || item === null);
  }
  return false;
}
