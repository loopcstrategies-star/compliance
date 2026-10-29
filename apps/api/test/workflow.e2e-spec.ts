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
import { resetTenantData } from './reset-data';

const PASSWORD = 'CorrectHorseBattery1';

describe('maker checker workflow', () => {
  let app: INestApplication;
  let admin: PrismaClient;
  let tenantA: { id: string };
  let makerSecret: string;
  let checkerSecret: string;
  let approverSecret: string;
  let dualSecret: string;
  let applicationA: { id: string };
  let applicationB: { id: string };
  let applicationC: { id: string };

  beforeAll(async () => {
    admin = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
    await admin.$connect();
    await ensureCatalogue(admin);
    await resetTenantData(admin);
    tenantA = await admin.tenant.create({ data: { name: 'Review Tenant A' } });
    const tenantB = await admin.tenant.create({ data: { name: 'Review Tenant B' } });
    const roles = Object.fromEntries((await admin.role.findMany()).map((role) => [role.key, role.id]));
    const passwordHash = await hashPassword(PASSWORD);
    makerSecret = new OTPAuth.Secret({ size: 20 }).base32;
    checkerSecret = new OTPAuth.Secret({ size: 20 }).base32;
    approverSecret = new OTPAuth.Secret({ size: 20 }).base32;
    dualSecret = new OTPAuth.Secret({ size: 20 }).base32;
    const customerA = await createUser(admin, tenantA.id, 'customer-review@example.com', 'Customer Review', passwordHash, roles.customer, null);
    const customerB = await createUser(admin, tenantB.id, 'customer-other@example.com', 'Customer Other', passwordHash, roles.customer, null);
    await createUser(admin, tenantA.id, 'maker-review@example.com', 'Maker', passwordHash, roles.maker, makerSecret);
    await createUser(admin, tenantA.id, 'checker-review@example.com', 'Checker', passwordHash, roles.checker, checkerSecret);
    await createUser(admin, tenantA.id, 'approver-review@example.com', 'Approver', passwordHash, roles.authorised_approver, approverSecret);
    const dual = await createUser(admin, tenantA.id, 'dual-review@example.com', 'Dual', passwordHash, roles.maker, dualSecret);
    await admin.userRole.create({ data: { tenantId: tenantA.id, userId: dual.id, roleId: roles.checker } });
    const partyA = await admin.customer.create({
      data: { tenantId: tenantA.id, userId: customerA.id, legalName: 'Review Metals', customerType: 'local_company' },
    });
    const partyB = await admin.customer.create({
      data: { tenantId: tenantB.id, userId: customerB.id, legalName: 'Other Metals', customerType: 'foreign_company' },
    });
    applicationA = await admin.application.create({ data: { tenantId: tenantA.id, customerId: partyA.id } });
    applicationB = await admin.application.create({ data: { tenantId: tenantA.id, customerId: partyA.id } });
    applicationC = await admin.application.create({ data: { tenantId: tenantB.id, customerId: partyB.id } });

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    await admin?.$disconnect();
  });

  it('rejects self-approval, overlapping roles, and another tenant', async () => {
    const customer = await login('customer-review@example.com');
    const other = await login('customer-other@example.com');
    const gaps = await customer.get(`/applications/${applicationA.id}/completeness`).expect(200);
    expect(gaps.body.status).toBe('draft');
    expect(gaps.body.missingAnswers.length).toBeGreaterThan(0);
    expect(gaps.body.status).not.toBe('approved');
    const stillDraft = await customer.get(`/applications/${applicationA.id}`).expect(200);
    expect(stillDraft.body.application.status).toBe('draft');

    const hidden = await other.get(`/applications/${applicationA.id}`).expect(404);
    expect(hidden.body.message).toBe('Not found');
    await other
      .post(`/applications/${applicationA.id}/decisions`)
      .send({ stage: 'maker', outcome: 'accept', reason: 'no', documentVersion: 1 })
      .expect(404);

    const refused = await customer.post(`/applications/${applicationA.id}/submit`).expect(400);
    expect(refused.body.missingAnswers.length).toBeGreaterThan(0);
    expect(refused.body.blockedPlacements.length).toBeGreaterThan(0);
    expect(await admin.submission.count({ where: { applicationId: applicationA.id } })).toBe(0);
    const stayed = await customer.get(`/applications/${applicationA.id}`).expect(200);
    expect(stayed.body.application.status).toBe('draft');
    const submitted = await openSubmitted(applicationA.id);
    const maker = await login('maker-review@example.com');
    await maker
      .post(`/applications/${applicationA.id}/decisions`)
      .send({ stage: 'authorised_approver', outcome: 'accept', reason: 'final', documentVersion: submitted.documentVersion })
      .expect(403);

    const dual = await login('dual-review@example.com');
    await dual
      .post(`/applications/${applicationA.id}/decisions`)
      .send({ stage: 'maker', outcome: 'accept', reason: 'maker accept', documentVersion: submitted.documentVersion })
      .expect(201);
    const overlap = await dual
      .post(`/applications/${applicationA.id}/decisions`)
      .send({ stage: 'checker', outcome: 'accept', reason: 'same person', documentVersion: submitted.documentVersion })
      .expect(409);
    expect(overlap.body.message).toBe('Segregation policy rejects this assignment');

    const checker = await login('checker-review@example.com');
    await checker
      .post(`/applications/${applicationA.id}/decisions`)
      .send({ stage: 'checker', outcome: 'accept', reason: 'checker accept', documentVersion: submitted.documentVersion })
      .expect(201);
    await maker
      .post(`/applications/${applicationA.id}/decisions`)
      .send({ stage: 'authorised_approver', outcome: 'accept', reason: 'own work', documentVersion: submitted.documentVersion })
      .expect(403);
  });

  it('does not let a return skip ahead, and a new package invalidates the open version', async () => {
    const customer = await login('customer-review@example.com');
    const submitted = await openSubmitted(applicationB.id);
    const maker = await login('maker-review@example.com');
    await maker
      .post(`/applications/${applicationB.id}/decisions`)
      .send({ stage: 'maker', outcome: 'return', reason: 'missing licence', documentVersion: submitted.documentVersion })
      .expect(201);
    const decisions = await admin.reviewDecision.findMany({ where: { submission: { applicationId: applicationB.id } } });
    expect(decisions.every((item) => item.supersededAt)).toBe(true);
    const checker = await login('checker-review@example.com');
    await checker
      .post(`/applications/${applicationB.id}/decisions`)
      .send({ stage: 'checker', outcome: 'accept', reason: 'too soon', documentVersion: submitted.documentVersion })
      .expect(409);

    const generated = await customer.post(`/applications/${applicationA.id}/packages`).send({ templateId: 'kyc' }).expect(201);
    const before = await admin.storedFile.findUniqueOrThrow({ where: { id: generated.body.fileId } });
    const approver = await login('approver-review@example.com');
    const stale = await approver
      .post(`/applications/${applicationA.id}/decisions`)
      .send({ stage: 'authorised_approver', outcome: 'accept', reason: 'old version', documentVersion: 1 })
      .expect(409);
    expect(stale.body.message).toBe('Document version is stale');
    const after = await admin.storedFile.findUniqueOrThrow({ where: { id: generated.body.fileId } });
    expect(after.sha256).toBe(before.sha256);
    const current = await customer.get(`/applications/${applicationA.id}`).expect(200);
    expect(current.body.application.status).not.toBe('approved');
  });

  it('opens reassessment after approval without changing the approved package', async () => {
    const customer = await login('customer-review@example.com');
    const current = await customer.get(`/applications/${applicationA.id}`).expect(200);
    const refused = await customer.post(`/applications/${applicationA.id}/submit`).expect(400);
    expect(refused.body.blockedPlacements.length).toBeGreaterThan(0);
    expect(current.body.application.status).toBe('correction');
    const resubmitted = await openSubmitted(applicationA.id, current.body.application.documentVersion + 1, 'reassessment');
    const version = resubmitted.documentVersion;
    const maker = await login('maker-review@example.com');
    const waiting = await maker.get('/applications?view=waiting').expect(200);
    expect(waiting.body.items.some((row: { id: string; status: string }) => row.id === applicationA.id && row.status === 'reassessment')).toBe(true);
    const checker = await login('checker-review@example.com');
    const approver = await login('approver-review@example.com');
    expect(current.body.application.status).toBe('correction');
    await maker
      .post(`/applications/${applicationA.id}/decisions`)
      .send({ stage: 'maker', outcome: 'accept', reason: 'ready', documentVersion: version })
      .expect(201);
    await checker
      .post(`/applications/${applicationA.id}/decisions`)
      .send({ stage: 'checker', outcome: 'accept', reason: 'ready', documentVersion: version })
      .expect(201);
    await approver
      .post(`/applications/${applicationA.id}/decisions`)
      .send({ stage: 'authorised_approver', outcome: 'accept', reason: 'approved', documentVersion: version })
      .expect(201);
    const approved = await customer.get(`/applications/${applicationA.id}`).expect(200);
    expect(approved.body.application.status).toBe('approved');
    expect(approved.body.editable).toBe(true);
    const file = await admin.storedFile.findFirstOrThrow({
      where: { packages: { some: { applicationId: applicationA.id } } },
      orderBy: { createdAt: 'desc' },
    });
    const materialEdit = await customer
      .put(`/applications/${applicationA.id}/answers`)
      .send({ answers: { 'kyc.entity.name': 'Review Metals LLC' } })
      .expect(200);
    expect(materialEdit.body.message).not.toBe('This application can no longer be edited');
    expect(materialEdit.body.application.status).toBe('reassessment');
    const reopened = await customer.get(`/applications/${applicationA.id}`).expect(200);
    expect(reopened.body.application.status).toBe('reassessment');
    expect(reopened.body.editable).toBe(false);
    const blocked = await customer
      .put(`/applications/${applicationA.id}/answers`)
      .send({ answers: { 'kyc.entity.name': 'Should not apply' } })
      .expect(409);
    expect(blocked.body.message).toBe('This application can no longer be edited');
    const unchanged = await admin.storedFile.findUniqueOrThrow({ where: { id: file.id } });
    expect(unchanged.sha256).toBe(file.sha256);
    expect(applicationC.id).toBeTruthy();
  });

  it('lets the same actor take the next stage when the three switches are off', async () => {
    await admin.segregationPolicy.upsert({
      where: { tenantId: tenantA.id },
      create: {
        tenantId: tenantA.id,
        makerDistinctFromChecker: false,
        checkerDistinctFromApprover: false,
        makerDistinctFromApprover: false,
      },
      update: {
        makerDistinctFromChecker: false,
        checkerDistinctFromApprover: false,
        makerDistinctFromApprover: false,
      },
    });
    const customerRow = await admin.user.findUniqueOrThrow({ where: { email: 'customer-review@example.com' } });
    const party = await admin.customer.findFirstOrThrow({ where: { userId: customerRow.id } });
    const application = await admin.application.create({ data: { tenantId: tenantA.id, customerId: party.id } });
    const customer = await login('customer-review@example.com');
    const submitted = await openSubmitted(application.id);
    const dual = await login('dual-review@example.com');
    const version = submitted.documentVersion;
    await dual
      .post(`/applications/${application.id}/decisions`)
      .send({ stage: 'maker', outcome: 'accept', reason: 'maker accept', documentVersion: version })
      .expect(201);
    await dual
      .post(`/applications/${application.id}/decisions`)
      .send({ stage: 'checker', outcome: 'accept', reason: 'same authorised person', documentVersion: version })
      .expect(201);
    const rows = await admin.reviewDecision.findMany({
      where: { submission: { applicationId: application.id } },
      orderBy: { createdAt: 'asc' },
    });
    expect(rows.map((row) => row.stage)).toEqual(['maker', 'checker']);
    expect(new Set(rows.map((row) => row.actorId)).size).toBe(1);
    expect(rows.every((row) => row.outcome === 'accept' && row.reason.length > 0 && row.createdAt instanceof Date)).toBe(true);
  });

  async function openSubmitted(applicationId: string, documentVersion = 1, status = 'submitted') {
    await admin.application.update({
      where: { id: applicationId },
      data: { status, documentVersion, statusChangedAt: new Date() },
    });
    await admin.submission.create({
      data: { tenantId: tenantA.id, applicationId, documentVersion, packageIds: [] },
    });
    return { documentVersion };
  }

  async function login(email: string) {
    const agent = request.agent(app.getHttpServer());
    const response = await agent.post('/auth/login').send({ email, password: PASSWORD });
    expect(response.status).toBe(201);
    return agent;
  }

});

async function createUser(
  admin: PrismaClient,
  tenantId: string,
  email: string,
  displayName: string,
  passwordHash: string,
  roleId: string,
  mfaBase32: string | null,
) {
  const user = await admin.user.create({
    data: {
      tenantId,
      email,
      displayName,
      passwordHash,
      mfaSecret: mfaBase32 ? encryptSecret(mfaBase32) : null,
    },
  });
  await admin.userRole.create({ data: { tenantId, userId: user.id, roleId } });
  return user;
}
