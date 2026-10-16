import { existsSync } from 'fs';
import path from 'path';
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
import { writePrivateFile } from '../src/files/storage';
import { resetTenantData } from './reset-data';

const PASSWORD = 'CorrectHorseBattery1';

describe('administration and retention', () => {
  let app: INestApplication;
  let admin: PrismaClient;
  let secretA: string;
  let secretB: string;
  let employeeSecret: string;
  let tenantA: { id: string };
  let system: { id: string };
  let adminA: { id: string };
  let adminB: { id: string };
  let employee: { id: string };
  let applicationA: { id: string };
  let heldFile: { id: string; storageKey: string };
  let purgeFile: { id: string; storageKey: string };

  beforeAll(async () => {
    admin = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
    await admin.$connect();
    await ensureCatalogue(admin);
    await resetTenantData(admin);
    tenantA = await admin.tenant.create({ data: { name: 'Admin Tenant A' } });
    const tenantB = await admin.tenant.create({ data: { name: 'Admin Tenant B' } });
    system = await admin.tenant.create({ data: { name: 'Platform', isSystem: true } });
    const roles = Object.fromEntries((await admin.role.findMany()).map((role) => [role.key, role.id]));
    const passwordHash = await hashPassword(PASSWORD);
    secretA = new OTPAuth.Secret({ size: 20 }).base32;
    secretB = new OTPAuth.Secret({ size: 20 }).base32;
    employeeSecret = new OTPAuth.Secret({ size: 20 }).base32;
    adminA = await createUser(admin, system.id, 'admin-a@example.com', passwordHash, roles.super_admin, secretA);
    adminB = await createUser(admin, system.id, 'admin-b@example.com', passwordHash, roles.super_admin, secretB);
    employee = await createUser(admin, tenantA.id, 'employee-admin@example.com', passwordHash, roles.employee, employeeSecret);
    const customerUser = await createUser(admin, tenantA.id, 'customer-admin@example.com', passwordHash, roles.customer, null);
    const customerB = await createUser(admin, tenantB.id, 'customer-b-admin@example.com', passwordHash, roles.customer, null);
    const partyA = await admin.customer.create({
      data: { tenantId: tenantA.id, userId: customerUser.id, legalName: 'Admin Metals', customerType: 'local_company' },
    });
    const partyB = await admin.customer.create({
      data: { tenantId: tenantB.id, userId: customerB.id, legalName: 'Other Admin Metals', customerType: 'local_company' },
    });
    applicationA = await admin.application.create({ data: { tenantId: tenantA.id, customerId: partyA.id } });
    await admin.application.create({ data: { tenantId: tenantB.id, customerId: partyB.id } });
    heldFile = await saveFile(admin, tenantA.id, applicationA.id, 'kyc.docs.2');
    purgeFile = await saveFile(admin, tenantA.id, applicationA.id, 'kyc.docs.3');
    await admin.auditEvent.create({
      data: { tenantId: tenantA.id, actorId: adminA.id, action: 'marker.a', purpose: 'tenant-a-marker', createdAt: new Date(Date.now() - 10 * 86400000) },
    });
    await admin.auditEvent.create({
      data: { tenantId: tenantB.id, actorId: adminA.id, action: 'marker.b', purpose: 'tenant-b-marker' },
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

  it('overrides required forms for one tenant and revokes staff access', async () => {
    const customer = await login('customer-admin@example.com');
    const before = await customer.get(`/applications/${applicationA.id}/completeness`).expect(200);
    expect(before.body.missingAnswers.some((key: string) => key.startsWith('kyc.'))).toBe(true);
    const platform = await login('admin-a@example.com');
    await platform
      .post(`/tenants/${tenantA.id}/applicability`)
      .send({ customerType: 'local_company', templateId: 'kyc', required: false })
      .expect(201);
    const after = await customer.get(`/applications/${applicationA.id}/completeness`).expect(200);
    expect(after.body.missingAnswers.some((key: string) => key.startsWith('kyc.'))).toBe(false);
    const other = await login('customer-b-admin@example.com');
    const otherGaps = await other.get('/applications/current').expect(200);
    expect(otherGaps.body.templates.some((item: { templateId: string }) => item.templateId === 'kyc')).toBe(true);

    await platform.post(`/tenants/${tenantA.id}/users/${employee.id}/roles`).send({ role: 'maker' }).expect(201);
    await platform.delete(`/tenants/${tenantA.id}/users/${employee.id}/roles/maker`).expect(200);
    const staff = await login('employee-admin@example.com');
    await staff.get('/auth/me').expect(200);
    await platform.post(`/tenants/${tenantA.id}/users/${employee.id}/revoke-sessions`).expect(201);
    await staff.get('/auth/me').expect(401);
    await platform.delete(`/tenants/${system.id}/users/${adminB.id}/roles/super_admin`).expect(200);
    await platform.delete(`/tenants/${system.id}/users/${adminA.id}/roles/super_admin`).expect(403);
  });

  it('refuses a held file, quarantines an approved deletion, and purges only after retention', async () => {
    const role = await admin.role.findUniqueOrThrow({ where: { key: 'super_admin' } });
    await admin.userRole.upsert({
      where: { userId_roleId: { userId: adminB.id, roleId: role.id } },
      create: { tenantId: system.id, userId: adminB.id, roleId: role.id },
      update: {},
    });
    const first = await login('admin-a@example.com');
    const second = await login('admin-b@example.com');
    await first.post(`/tenants/${tenantA.id}/holds`).send({ targetType: 'stored_file', targetId: heldFile.id, reason: 'dispute' }).expect(201);
    const held = await first
      .post(`/tenants/${tenantA.id}/deletions`)
      .send({ targetType: 'stored_file', targetId: heldFile.id, reason: 'remove' })
      .expect(201);
    await first.post(`/tenants/${tenantA.id}/deletions/${held.body.id}/approve`).expect(403);
    const refused = await second.post(`/tenants/${tenantA.id}/deletions/${held.body.id}/approve`).expect(201);
    expect(refused.body.status).toBe('refused');
    const customer = await login('customer-admin@example.com');
    await customer.get(`/files/${heldFile.id}`).expect(200);

    await first
      .post(`/tenants/${tenantA.id}/retention`)
      .send({ category: 'document', retentionDays: 1, effectiveFrom: '2020-01-01' })
      .expect(201);
    const open = await first
      .post(`/tenants/${tenantA.id}/deletions`)
      .send({ targetType: 'stored_file', targetId: purgeFile.id, reason: 'aged' })
      .expect(201);
    await second.post(`/tenants/${tenantA.id}/deletions/${open.body.id}/approve`).expect(201);
    await customer.get(`/files/${purgeFile.id}`).expect(404);
    await first.post(`/tenants/${tenantA.id}/purge`).expect(201);
    expect(existsSync(path.join(process.env.FILE_STORAGE_DIR!, purgeFile.storageKey))).toBe(true);
    await admin.storedFile.update({ where: { id: purgeFile.id }, data: { quarantinedAt: new Date(Date.now() - 3 * 86400000) } });
    const purged = await first.post(`/tenants/${tenantA.id}/purge`).expect(201);
    expect(purged.body.removed).toBe(1);
    expect(existsSync(path.join(process.env.FILE_STORAGE_DIR!, purgeFile.storageKey))).toBe(false);
    expect(existsSync(path.join(process.env.FILE_STORAGE_DIR!, heldFile.storageKey))).toBe(true);
  });

  it('lists one tenant audit trail and keeps a held event', async () => {
    const platform = await login('admin-a@example.com');
    await platform
      .post(`/tenants/${tenantA.id}/retention`)
      .send({ category: 'audit', retentionDays: 1, effectiveFrom: '2020-01-01' })
      .expect(201);
    const listed = await platform.get(`/audit`).query({ tenantId: tenantA.id }).expect(200);
    expect(JSON.stringify(listed.body)).not.toContain('tenant-b-marker');
    const old = listed.body.find((item: { action: string }) => item.action === 'marker.a');
    expect(old.quarantined).toBe(true);
    await platform.post(`/tenants/${tenantA.id}/holds`).send({ targetType: 'audit', targetId: old.id, reason: 'keep' }).expect(201);
    const again = await platform.get(`/audit`).query({ tenantId: tenantA.id }).expect(200);
    expect(again.body.find((item: { id: string }) => item.id === old.id).quarantined).toBe(false);
  });

  it('copies configuration onto a new tenant without applications or users', async () => {
    const platform = await login('admin-a@example.com');
    await platform.put(`/tenants/${tenantA.id}/profile`).send({ displayName: 'Admin Metals', country: 'AE' }).expect(200);
    const cloned = await platform
      .post(`/tenants/${tenantA.id}/clone`)
      .send({ name: 'Copied Metals', confirm: true, copyProfile: true, copyApplicability: true })
      .expect(201);
    expect(cloned.body.isSystem).toBe(false);
    expect(cloned.body.applications).toBe(0);
    expect(cloned.body.users).toBe(0);
    expect(cloned.body.files).toBe(0);
    const profile = await platform.get(`/tenants/${cloned.body.id}/profile`).expect(200);
    expect(profile.body.displayName).toBe('Admin Metals');
    expect(profile.body.country).toBe('AE');
    await platform.post(`/tenants/${tenantA.id}/clone`).send({ name: 'Unconfirmed', confirm: false }).expect(400);
  });

  it('stores a company KYC profile outside the applicant queues', async () => {
    const platform = await login('admin-a@example.com');
    const before = await platform.get('/applications').query({ view: 'dashboard', tenantId: tenantA.id }).expect(200);
    await platform
      .put(`/tenants/${tenantA.id}/company-kyc`)
      .send({
        status: 'draft',
        answers: {
          'kyc.entity.name': 'Admin Metals KYC',
          'kyc.shareholder_entity.rows': [{ name: 'Holding Co' }],
          'kyc.bank.iban': 'AE070331234567890123456',
        },
      })
      .expect(200);
    const after = await platform.get('/applications').query({ view: 'dashboard', tenantId: tenantA.id }).expect(200);
    expect(after.body.counts.requests).toBe(before.body.counts.requests);
    expect(after.body.counts.total).toBe(before.body.counts.total);
    const loaded = await platform.get(`/tenants/${tenantA.id}/company-kyc`).expect(200);
    expect(loaded.body.answers.some((answer: { value: string }) => answer.value === 'Admin Metals KYC')).toBe(true);
    expect(JSON.stringify(loaded.body.answers)).toContain('Holding Co');
    await platform
      .post(`/tenants/${tenantA.id}/company-kyc/shares`)
      .send({ confirm: false, recipientName: 'Other', recipientContact: 'other@example.com', fieldKeys: ['kyc.entity.name'] })
      .expect(400);
    const shared = await platform
      .post(`/tenants/${tenantA.id}/company-kyc/shares`)
      .send({
        confirm: true,
        recipientName: 'Other Co',
        recipientContact: 'other@example.com',
        purpose: 'Counterparty KYC request',
        fieldKeys: ['kyc.entity.name'],
      })
      .expect(201);
    expect(shared.body.emailSent).toBe(false);
    const token = new URL(`http://localhost${shared.body.acceptPath}`).searchParams.get('token');
    const recipient = request.agent(app.getHttpServer());
    await recipient.post('/company-kyc/accept').send({ token }).expect(201);
    const pack = await recipient.get('/company-kyc/current').expect(200);
    expect(JSON.stringify(pack.body)).toContain('Admin Metals KYC');
    await platform.post(`/tenants/${tenantA.id}/company-kyc/shares/${shared.body.id}/revoke`).expect(201);
    await recipient.post('/company-kyc/accept').send({ token }).expect(400);
    const outsider = await login('customer-b-admin@example.com');
    await outsider.get(`/tenants/${tenantA.id}/company-kyc`).expect(403);
  });

  async function login(email: string) {
    const agent = request.agent(app.getHttpServer());
    const response = await agent.post('/auth/login').send({ email, password: PASSWORD });
    expect(response.status).toBe(201);
    return agent;
  }

});

async function saveFile(admin: PrismaClient, tenantId: string, applicationId: string, fieldKey: string) {
  const written = writePrivateFile(Buffer.from('%PDF-1.1\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF'));
  const file = await admin.storedFile.create({
    data: {
      tenantId,
      storageKey: written.storageKey,
      mediaType: 'application/pdf',
      byteSize: 40,
      sha256: written.sha256,
      scanStatus: 'clean',
    },
  });
  await admin.document.create({ data: { tenantId, applicationId, fieldKey, fileId: file.id } });
  return file;
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
