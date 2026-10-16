import { INestApplication, Logger } from '@nestjs/common';
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

describe('drafts and invitations', () => {
  let app: INestApplication;
  let admin: PrismaClient;
  let tenantA: { id: string };
  let tenantB: { id: string };
  let system: { id: string };
  let employeeSecret: string;
  let employeeBSecret: string;
  let adminSecret: string;

  beforeAll(async () => {
    admin = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
    await admin.$connect();
    await ensureCatalogue(admin);
    await resetTenantData(admin);

    tenantA = await admin.tenant.create({ data: { name: 'Draft Tenant A' } });
    tenantB = await admin.tenant.create({ data: { name: 'Draft Tenant B' } });
    system = await admin.tenant.create({ data: { name: 'Platform', isSystem: true } });
    const roles = Object.fromEntries((await admin.role.findMany()).map((role) => [role.key, role.id]));
    const passwordHash = await hashPassword(PASSWORD);
    employeeSecret = new OTPAuth.Secret({ size: 20 }).base32;
    employeeBSecret = new OTPAuth.Secret({ size: 20 }).base32;
    adminSecret = new OTPAuth.Secret({ size: 20 }).base32;
    await createUser(admin, tenantA.id, 'employee-a@example.com', 'Employee A', passwordHash, roles.employee, employeeSecret);
    await createUser(admin, tenantB.id, 'employee-b@example.com', 'Employee B', passwordHash, roles.employee, employeeBSecret);
    await createUser(admin, system.id, 'admin@example.com', 'Platform Admin', passwordHash, roles.super_admin, adminSecret);

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    await admin?.$disconnect();
  });

  it('rejects a used, revoked, or expired invitation and keeps the raw token out of the log', async () => {
    const logs: string[] = [];
    const spy = jest.spyOn(Logger.prototype, 'log').mockImplementation((message: unknown) => {
      logs.push(String(message));
    });
    const employee = await login('employee-a@example.com');

    const created = await employee
      .post('/invitations')
      .send({ email: 'local@example.com', legalName: 'Local Metals LLC', customerType: 'local_company' })
      .expect(201);
    const token = new URL(`http://localhost${created.body.acceptPath}`).searchParams.get('token');
    expect(created.body.acceptPath).toMatch(/^\/accept\?token=/);
    expect(created.body.emailSent).toBe(false);
    expect(created.body.expiresAt).toBeTruthy();
    expect(token).toBeTruthy();
    expect(logs.join('\n')).not.toContain(token);
    expect(logs.join('\n')).toContain('[redacted]');
    spy.mockRestore();

    const other = await login('employee-b@example.com');
    await other
      .post('/invitations/accept')
      .send({ token, password: PASSWORD, displayName: 'Should Stay' })
      .expect(403);
    const stillOpen = await admin.invitation.findUniqueOrThrow({ where: { id: created.body.id } });
    expect(stillOpen.usedAt).toBeNull();

    const customer = request.agent(app.getHttpServer());
    await customer.post('/invitations/accept').send({ token, password: PASSWORD, displayName: 'Local Metals' }).expect(201);
    await customer.post('/invitations/accept').send({ token, password: PASSWORD, displayName: 'Local Metals' }).expect(400);

    const revoked = await employee
      .post('/invitations')
      .send({ email: 'revoked@example.com', legalName: 'Revoked Co', customerType: 'mine' })
      .expect(201);
    await employee.post(`/invitations/${revoked.body.id}/revoke`).expect(201);
    const revokedToken = new URL(`http://localhost${revoked.body.acceptPath}`).searchParams.get('token');
    await request(app.getHttpServer())
      .post('/invitations/accept')
      .send({ token: revokedToken, password: PASSWORD })
      .expect(400);

    const expiring = await employee
      .post('/invitations')
      .send({ email: 'expired@example.com', legalName: 'Expired Co', customerType: 'individual' })
      .expect(201);
    await admin.invitation.update({
      where: { id: expiring.body.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const expiredToken = new URL(`http://localhost${expiring.body.acceptPath}`).searchParams.get('token');
    await request(app.getHttpServer())
      .post('/invitations/accept')
      .send({ token: expiredToken, password: PASSWORD })
      .expect(400);
  });

  it('hides another tenant draft and rejects an unknown field', async () => {
    const local = await login('local@example.com');
    const own = await local.get('/applications/current').expect(200);
    expect(own.body.application.customerType).toBe('local_company');

    const employeeB = await login('employee-b@example.com');
    const foreignInvite = await employeeB
      .post('/invitations')
      .send({ email: 'foreign@example.com', legalName: 'Foreign Metals', customerType: 'foreign_company' })
      .expect(201);
    const foreignToken = new URL(`http://localhost${foreignInvite.body.acceptPath}`).searchParams.get('token');
    const foreign = request.agent(app.getHttpServer());
    await foreign
      .post('/invitations/accept')
      .send({ token: foreignToken, password: PASSWORD, displayName: 'Foreign Metals' })
      .expect(201);

    const missing = await foreign.get(`/applications/${own.body.application.id}`).expect(404);
    expect(missing.body.message).toBe('Not found');
    expect(JSON.stringify(missing.body)).not.toContain('Local Metals');
    const denied = await foreign
      .put(`/applications/${own.body.application.id}/answers`)
      .send({ answers: { 'kyc.entity.name': 'Taken' } })
      .expect(404);
    expect(denied.body.message).toBe('Not found');

    await local
      .put(`/applications/${own.body.application.id}/answers`)
      .send({ answers: { 'kyc.not-a-field': 'no' } })
      .expect(400);
    const saved = await local
      .put(`/applications/${own.body.application.id}/answers`)
      .send({ answers: { 'kyc.entity.name': 'Local Metals LLC' } })
      .expect(200);
    expect(saved.body.answers['kyc.entity.name']).toBe('Local Metals LLC');
    const reloaded = await local.get('/applications/current').expect(200);
    expect(reloaded.body.answers['kyc.entity.name']).toBe('Local Metals LLC');
  });

  it('requires the domestic VAT row only for a local company and keeps the source label', async () => {
    const local = await login('local@example.com');
    const foreign = await login('foreign@example.com');
    const localDraft = await local.get('/applications/current').expect(200);
    const foreignDraft = await foreign.get('/applications/current').expect(200);
    const localVat = vatField(localDraft.body);
    const foreignVat = vatField(foreignDraft.body);
    expect(localVat.required).toBe(true);
    expect(foreignVat.required).toBe(false);
    expect(localVat.label).toBe('VAT Certificate – For Domestic Customers Only');
    expect(foreignVat.label).toBe(localVat.label);
    const docs8 = localDraft.body.templates
      .find((template: { templateId: string }) => template.templateId === 'kyc')
      .fields.find((field: { fieldKey: string }) => field.fieldKey === 'kyc.docs.8');
    expect(docs8.label).toContain('For Domestic Customers');
    expect(docs8.label).toContain('For International Customers');
  });

  it('shows an extra checklist category only in the tenant that owns it', async () => {
    const platform = await login('admin@example.com');
    const created = await platform
      .post('/checklist-categories')
      .send({ tenantId: tenantA.id, label: 'Site visit notes' })
      .expect(201);
    const local = await login('local@example.com');
    const foreign = await login('foreign@example.com');
    const localDraft = await local.get('/applications/current').expect(200);
    const foreignDraft = await foreign.get('/applications/current').expect(200);
    expect(localDraft.body.extras).toEqual([
      { id: created.body.id, label: 'Site visit notes', fieldKey: `extra.${created.body.id}` },
    ]);
    expect(foreignDraft.body.extras).toEqual([]);
  });

  it('opens an invitation from the link and issues a fresh resume link', async () => {
    const employee = await login('employee-a@example.com');
    const created = await employee
      .post('/invitations')
      .send({ email: 'link@example.com', legalName: 'Link Metals', customerType: 'local_company' })
      .expect(201);
    const token = new URL(`http://localhost${created.body.acceptPath}`).searchParams.get('token');
    const customer = request.agent(app.getHttpServer());
    await customer.post('/invitations/accept').send({ token }).expect(201);
    await request(app.getHttpServer()).post('/invitations/accept').send({ token }).expect(400);
    const resumed = await employee.post('/invitations/resume').send({ email: 'link@example.com' }).expect(201);
    const next = new URL(`http://localhost${resumed.body.acceptPath}`).searchParams.get('token');
    expect(next).toBeTruthy();
    expect(next).not.toBe(token);
    expect(resumed.body.emailSent).toBe(false);
    const resumedCustomer = request.agent(app.getHttpServer());
    await resumedCustomer.post('/invitations/accept').send({ token: next }).expect(201);
    expect(await admin.user.count({ where: { email: 'link@example.com' } })).toBe(1);
    await resumedCustomer.get('/applications/current').expect(200);
  });

  it('keeps an employee inside their company and lets a super admin choose one', async () => {
    const employee = await login('employee-a@example.com');
    await employee
      .post('/invitations')
      .send({ email: 'crossed@example.com', legalName: 'Crossed Metals', customerType: 'local_company', tenantId: tenantB.id })
      .expect(403);
    const own = await employee
      .post('/invitations')
      .send({ email: 'own-company@example.com', legalName: 'Own Metals', customerType: 'mine' })
      .expect(201);
    expect((await admin.invitation.findUniqueOrThrow({ where: { id: own.body.id } })).tenantId).toBe(tenantA.id);

    const platform = await login('admin@example.com');
    await platform
      .post('/invitations')
      .send({ email: 'platform@example.com', legalName: 'Platform Applicant', customerType: 'individual' })
      .expect(400);
    await platform
      .post('/invitations')
      .send({ email: 'platform@example.com', legalName: 'Platform Applicant', customerType: 'individual', tenantId: system.id })
      .expect(400);
    const selected = await platform
      .post('/invitations')
      .send({ email: 'chosen@example.com', legalName: 'Chosen Metals', customerType: 'foreign_company', tenantId: tenantA.id })
      .expect(201);
    expect(selected.body.emailSent).toBe(false);
    expect(selected.body.acceptPath).toMatch(/^\/accept\?token=/);
    expect((await admin.invitation.findUniqueOrThrow({ where: { id: selected.body.id } })).tenantId).toBe(tenantA.id);
  });

  async function login(email: string) {
    const agent = request.agent(app.getHttpServer());
    const response = await agent.post('/auth/login').send({ email, password: PASSWORD });
    expect(response.status).toBe(201);
    return agent;
  }


});

function vatField(body: { templates: { templateId: string; fields: { fieldKey: string; label: string; required: boolean }[] }[] }) {
  const kyc = body.templates.find((template) => template.templateId === 'kyc');
  const field = kyc?.fields.find((item) => item.fieldKey === 'kyc.docs.12');
  if (!field) {
    throw new Error('VAT row missing');
  }
  return field;
}

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
