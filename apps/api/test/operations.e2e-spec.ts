import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import * as OTPAuth from 'otpauth';
import { AppModule } from '../src/app.module';
import { hashPassword } from '../src/auth/auth.service';
import { encryptSecret } from '../src/crypto/secrets';
import { ensureCatalogue } from '../src/seed/catalogue';
import { OperationsService } from '../src/operations/operations.service';
import { resetTenantData } from './reset-data';

const PASSWORD = 'CorrectHorseBattery1';
const HOUR = 60 * 60 * 1000;

describe('employee operations', () => {
  let app: INestApplication;
  let admin: PrismaClient;
  let employeeSecret: string;
  let makerSecret: string;
  let tenantA: { id: string };
  let submittedId: string;
  let reviewId: string;
  let makerId: string;
  let checkerId: string;
  let outsiderId: string;

  beforeAll(async () => {
    admin = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
    await admin.$connect();
    await ensureCatalogue(admin);
    await resetTenantData(admin);
    tenantA = await admin.tenant.create({ data: { name: 'Ops Tenant A' } });
    const tenantB = await admin.tenant.create({ data: { name: 'Ops Tenant B' } });
    const roles = Object.fromEntries((await admin.role.findMany()).map((role) => [role.key, role.id]));
    const passwordHash = await hashPassword(PASSWORD);
    employeeSecret = new OTPAuth.Secret({ size: 20 }).base32;
    makerSecret = new OTPAuth.Secret({ size: 20 }).base32;
    const employee = await createUser(admin, tenantA.id, 'employee-ops@example.com', passwordHash, roles.employee, employeeSecret);
    const maker = await createUser(admin, tenantA.id, 'maker-ops@example.com', passwordHash, roles.maker, makerSecret);
    const checker = await createUser(admin, tenantA.id, 'checker-ops@example.com', passwordHash, roles.checker, new OTPAuth.Secret({ size: 20 }).base32);
    const outsider = await createUser(admin, tenantB.id, 'maker-other-ops@example.com', passwordHash, roles.maker, new OTPAuth.Secret({ size: 20 }).base32);
    makerId = maker.id;
    checkerId = checker.id;
    outsiderId = outsider.id;
    const customerUser = await createUser(admin, tenantA.id, 'customer-ops@example.com', passwordHash, roles.customer, null);
    const customer = await admin.customer.create({
      data: { tenantId: tenantA.id, userId: customerUser.id, legalName: 'Ops Metals', customerType: 'local_company' },
    });
    const otherCustomer = await admin.customer.create({
      data: { tenantId: tenantB.id, legalName: 'Foreign Desk', customerType: 'foreign_company' },
    });
    const now = Date.now();
    await createCase(admin, tenantA.id, customer.id, 'draft', new Date(now));
    await createCase(admin, tenantA.id, customer.id, 'draft', new Date(now - 8 * 24 * HOUR));
    await createCase(admin, tenantA.id, customer.id, 'submitted', new Date(now - 100 * HOUR));
    submittedId = (await createCase(admin, tenantA.id, customer.id, 'submitted', new Date(now))).id;
    reviewId = (await createCase(admin, tenantA.id, customer.id, 'maker_review', new Date(now))).id;
    const approved = await createCase(admin, tenantA.id, customer.id, 'approved', new Date(now));
    await createCase(admin, tenantA.id, customer.id, 'correction', new Date(now));
    await createCase(admin, tenantA.id, customer.id, 'reassessment', new Date(now));
    await createCase(admin, tenantB.id, otherCustomer.id, 'draft', new Date(now));
    const opened = new Date(now - 6 * HOUR);
    const submission = await admin.submission.create({
      data: { tenantId: tenantA.id, applicationId: approved.id, documentVersion: 1, packageIds: [], createdAt: opened },
    });
    await admin.reviewDecision.create({
      data: decision(tenantA.id, submission.id, 'maker', maker.id, new Date(opened.getTime() + 2 * HOUR)),
    });
    await admin.reviewDecision.create({
      data: decision(tenantA.id, submission.id, 'checker', checker.id, new Date(opened.getTime() + 4 * HOUR)),
    });
    await admin.reviewDecision.create({
      data: decision(tenantA.id, submission.id, 'authorised_approver', employee.id, new Date(opened.getTime() + 6 * HOUR)),
    });
    const near = await admin.storedFile.create({ data: file(tenantA.id) });
    const far = await admin.storedFile.create({ data: file(tenantA.id) });
    await admin.document.create({
      data: {
        tenantId: tenantA.id,
        applicationId: approved.id,
        fieldKey: 'kyc.docs.2',
        fileId: near.id,
        expiresOn: new Date(now + 10 * 24 * HOUR),
      },
    });
    await admin.document.create({
      data: {
        tenantId: tenantA.id,
        applicationId: submittedId,
        fieldKey: 'kyc.docs.3',
        fileId: far.id,
        expiresOn: new Date(now + 90 * 24 * HOUR),
      },
    });

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    await admin?.$disconnect();
  });

  it('counts one tenant, separates queues, and rejects a bad assignment', async () => {
    const employee = await login('employee-ops@example.com');
    const dashboard = await employee.get('/dashboard').expect(200);
    expect(dashboard.body).toMatchObject({
      draft: 2,
      submitted: 2,
      makerReview: 1,
      checkerReview: 0,
      approved: 1,
      correction: 1,
      reassessment: 1,
      overdue: 1,
      expiringDocuments: 1,
    });
    expect(JSON.stringify(dashboard.body)).not.toContain('Foreign Desk');

    const maker = await login('maker-ops@example.com');
    const queue = await maker.get('/applications').expect(200);
    const ids = queue.body.map((item: { id: string }) => item.id);
    expect(ids).toContain(submittedId);
    expect(ids).not.toContain(reviewId);

    await employee.post(`/applications/${submittedId}/assignment`).send({ assigneeId: makerId }).expect(201);
    await employee.post(`/applications/${submittedId}/assignment`).send({ assigneeId: checkerId }).expect(409);
    await employee.post(`/applications/${submittedId}/assignment`).send({ assigneeId: outsiderId }).expect(404);
  });

  it('reports processing time, expiry, reminders, and a tenant export', async () => {
    const employee = await login('employee-ops@example.com');
    const report = await employee.get('/reports/processing').expect(200);
    expect(report.body).toMatchObject({ makerHours: 2, checkerHours: 4, approverHours: 6, approvalHours: 6 });

    const ops = app.get(OperationsService);
    const now = new Date();
    await ops.run(now);
    await ops.run(now);
    const first = await admin.delivery.count({ where: { tenantId: tenantA.id, kind: 'draft_idle' } });
    expect(first).toBe(1);
    const escalation = await admin.delivery.findFirst({
      where: { tenantId: tenantA.id, kind: 'review_escalation' },
    });
    expect(escalation?.status).toBe('suppressed');
    await ops.run(new Date(now.getTime() + 24 * HOUR));
    const second = await admin.delivery.count({ where: { tenantId: tenantA.id, kind: 'draft_idle' } });
    expect(second).toBe(2);

    const exported = await employee.get('/reports/export').expect(200);
    expect(exported.headers['content-type']).toContain('text/csv');
    expect(exported.text).toContain('Ops Metals');
    expect(exported.text).not.toContain('Foreign Desk');
    expect(exported.text).not.toContain('sha256');
    const audits = await admin.auditEvent.count({ where: { tenantId: tenantA.id, action: 'report.export' } });
    expect(audits).toBe(1);
  });

  async function login(email: string) {
    const agent = request.agent(app.getHttpServer());
    const response = await agent.post('/auth/login').send({ email, password: PASSWORD });
    expect(response.status).toBe(201);
    return agent;
  }

});

function decision(tenantId: string, submissionId: string, stage: string, actorId: string, createdAt: Date) {
  return {
    tenantId,
    submissionId,
    stage,
    outcome: 'accept',
    actorId,
    reason: 'timed',
    evidenceIds: [],
    documentVersion: 1,
    createdAt,
  };
}

function file(tenantId: string) {
  return {
    tenantId,
    storageKey: crypto.randomUUID(),
    mediaType: 'application/pdf',
    byteSize: 10,
    sha256: crypto.randomUUID().replaceAll('-', ''),
    scanStatus: 'clean',
  };
}

async function createCase(
  admin: PrismaClient,
  tenantId: string,
  customerId: string,
  status: string,
  statusChangedAt: Date,
) {
  return admin.application.create({
    data: { tenantId, customerId, status, statusChangedAt },
  });
}

async function createUser(
  admin: PrismaClient,
  tenantId: string,
  email: string,
  passwordHash: string,
  roleId: string,
  mfaBase32: string | null,
) {
  const user = await admin.user.create({
    data: {
      tenantId,
      email,
      displayName: email,
      passwordHash,
      mfaSecret: mfaBase32 ? encryptSecret(mfaBase32) : null,
    },
  });
  await admin.userRole.create({ data: { tenantId, userId: user.id, roleId } });
  return user;
}
