import { createHash } from 'crypto';
import { INestApplication, Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import * as OTPAuth from 'otpauth';
import { decodePDFRawStream, PDFDocument, PDFRawStream } from 'pdf-lib';
import { AppModule } from '../src/app.module';
import { hashPassword } from '../src/auth/auth.service';
import { encryptSecret } from '../src/crypto/secrets';
import { MAX_UPLOAD_BYTES } from '../src/domain';
import { ensureCatalogue } from '../src/seed/catalogue';
import { resetTenantData } from './reset-data';

const PASSWORD = 'CorrectHorseBattery1';
const MARKER = 'MARKER_PHASE4_BYTES';
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

describe('packages and uploads', () => {
  let app: INestApplication;
  let admin: PrismaClient;
  let tenantA: { id: string };
  let tenantB: { id: string };
  let adminSecret: string;
  let applicationA: { id: string };
  let applicationB: { id: string };

  beforeAll(async () => {
    admin = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
    await admin.$connect();
    await ensureCatalogue(admin);
    await resetTenantData(admin);
    tenantA = await admin.tenant.create({ data: { name: 'Package Tenant A' } });
    tenantB = await admin.tenant.create({ data: { name: 'Package Tenant B' } });
    const system = await admin.tenant.create({ data: { name: 'Platform', isSystem: true } });
    const roles = Object.fromEntries((await admin.role.findMany()).map((role) => [role.key, role.id]));
    const passwordHash = await hashPassword(PASSWORD);
    adminSecret = new OTPAuth.Secret({ size: 20 }).base32;
    const localUser = await createUser(admin, tenantA.id, 'local-docs@example.com', 'Local Docs', passwordHash, roles.customer, null);
    const foreignUser = await createUser(admin, tenantB.id, 'foreign-docs@example.com', 'Foreign Docs', passwordHash, roles.customer, null);
    await createUser(admin, system.id, 'admin@example.com', 'Platform Admin', passwordHash, roles.super_admin, adminSecret);
    const identityPermission = await admin.permission.findUniqueOrThrow({ where: { key: 'identity_file.read' } });
    const readerRole = await admin.role.create({ data: { key: 'identity_reader_test' } });
    await admin.rolePermission.create({ data: { roleId: readerRole.id, permissionId: identityPermission.id } });
    await createUser(admin, tenantA.id, 'reader-a@example.com', 'Reader A', passwordHash, readerRole.id, null);
    const localCustomer = await admin.customer.create({
      data: { tenantId: tenantA.id, userId: localUser.id, legalName: 'Local Docs LLC', customerType: 'local_company' },
    });
    const foreignCustomer = await admin.customer.create({
      data: { tenantId: tenantB.id, userId: foreignUser.id, legalName: 'Foreign Docs LLC', customerType: 'foreign_company' },
    });
    applicationA = await admin.application.create({ data: { tenantId: tenantA.id, customerId: localCustomer.id } });
    applicationB = await admin.application.create({ data: { tenantId: tenantB.id, customerId: foreignCustomer.id } });

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    await admin?.$disconnect();
  });

  it('rejects a bad upload and keeps file bytes out of the log', async () => {
    const local = await login('local-docs@example.com');
    const foreign = await login('foreign-docs@example.com');
    const logs: string[] = [];
    const spy = jest.spyOn(Logger.prototype, 'log').mockImplementation((message: unknown) => {
      logs.push(String(message));
    });

    await local
      .post(`/applications/${applicationA.id}/documents`)
      .field('fieldKey', 'kyc.docs.1')
      .attach('file', Buffer.from('GIF89a not allowed'), 'notes.gif')
      .expect(400);
    await local
      .post(`/applications/${applicationA.id}/documents`)
      .field('fieldKey', 'kyc.docs.1')
      .attach('file', Buffer.concat([Buffer.from('%PDF-1.1\n'), Buffer.alloc(MAX_UPLOAD_BYTES, 0x20)]), 'big.pdf')
      .expect(413);
    await local
      .post(`/applications/${applicationA.id}/documents`)
      .field('fieldKey', 'kyc.docs.1')
      .attach('file', Buffer.from('%PDF-1.1\nX5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*\n%%EOF'), 'eicar.pdf')
      .expect(400);
    await local
      .post(`/applications/${applicationA.id}/documents`)
      .field('fieldKey', 'kyc.docs.1')
      .attach('file', Buffer.from('%PDF-1.1\n/JavaScript (alert)\n%%EOF'), 'script.pdf')
      .expect(400);
    await foreign
      .post(`/applications/${applicationB.id}/documents`)
      .field('fieldKey', 'kyc.docs.12')
      .attach('file', Buffer.from('%PDF-1.4\n%%EOF'), 'vat.pdf')
      .expect(400);

    const stored = await local
      .post(`/applications/${applicationA.id}/documents`)
      .field('fieldKey', 'kyc.docs.1')
      .attach('file', Buffer.from(`%PDF-1.4\n%${MARKER}\n%%EOF`), 'licence.pdf')
      .expect(201);
    const downloaded = await local.get(`/files/${stored.body.fileId}`).expect(200);
    expect(downloaded.body.includes(MARKER)).toBe(true);
    expect(logs.join('\n')).not.toContain(MARKER);
    expect(logs.join('\n')).not.toContain('EICAR');
    spy.mockRestore();

    const missing = await local.get('/files/11111111-1111-1111-1111-111111111111').expect(404);
    expect(JSON.stringify(missing.body)).not.toContain(MARKER);
    await local.get(`/storage/${stored.body.fileId}`).expect(404);
  });

  it('hides another tenant file and requires purpose for an identity-file reader', async () => {
    const local = await login('local-docs@example.com');
    const foreign = await login('foreign-docs@example.com');
    const documents = await local.get(`/applications/${applicationA.id}/documents`).expect(200);
    const fileId = documents.body[0].fileId as string;
    const hidden = await foreign.get(`/files/${fileId}`).expect(404);
    expect(JSON.stringify(hidden.body)).not.toContain('Local Docs');

    const platform = await login('admin@example.com');
    await satisfyMfa(platform, adminSecret);
    await platform.get(`/files/${fileId}`).expect(403);

    const reader = await login('reader-a@example.com');
    await reader.get(`/files/${fileId}`).expect(400);
    const allowed = await reader.get(`/files/${fileId}?purpose=case-review`).expect(200);
    expect(allowed.body.includes(MARKER)).toBe(true);
    const audit = await admin.auditEvent.findFirst({
      where: { action: 'identity_file.access', targetId: fileId },
      orderBy: { createdAt: 'desc' },
    });
    expect(audit?.purpose).toBe('case-review');
  });

  it('keeps default packages equal to the registered templates and records image signatures', async () => {
    const local = await login('local-docs@example.com');
    await local
      .post(`/applications/${applicationA.id}/signatures`)
      .field('templateId', 'kyc')
      .field('authorised', 'false')
      .field('consent', 'false')
      .attach('file', PNG, 'sign.png')
      .expect(400);
    const evidence = await local
      .post(`/applications/${applicationA.id}/signatures`)
      .field('templateId', 'kyc')
      .field('authorised', 'true')
      .field('consent', 'true')
      .attach('file', PNG, 'sign.png')
      .expect(201);
    expect(evidence.body.method).toBe('image');
    expect(evidence.body.statement).toContain('not a qualified electronic signature');

    await local
      .put(`/applications/${applicationA.id}/answers`)
      .send({ answers: { 'kyc.entity.name': 'Local Docs LLC' } })
      .expect(200);

    for (const templateId of ['kyc', 'pep-declaration', 'pep-questionnaire', 'responsible-sourcing']) {
      const preview = await local.get(`/applications/${applicationA.id}/package-preview?templateId=${templateId}`).expect(200);
      expect(preview.body.pages).toHaveLength(preview.body.pageCount);
      expect(preview.body.pages.flatMap((page: { painted: unknown[] }) => page.painted)).toEqual([]);
      const generated = await local.post(`/applications/${applicationA.id}/packages`).send({ templateId }).expect(201);
      expect(generated.body.blocked.map((slot: { fieldKey: string }) => slot.fieldKey)).toContain(
        templateId === 'kyc' ? 'kyc.signature.image' : preview.body.pages[0].blocked[0].fieldKey,
      );
      expect(
        generated.body.painted.filter((slot: { fieldKey: string }) => /signature|stamp/i.test(slot.fieldKey)),
      ).toEqual([]);
      const downloaded = await local.get(`/files/${generated.body.fileId}`).expect(200);
      expect(createHash('sha256').update(downloaded.body).digest('hex')).toBe(generated.body.templateSha256);
      const foreign = await login('foreign-docs@example.com');
      await foreign.get(`/files/${generated.body.fileId}`).expect(404);
    }
  });

  it('draws customer letterhead only inside the measured KYC rectangle', async () => {
    const local = await login('local-docs@example.com');
    const platform = await login('admin@example.com');
    await satisfyMfa(platform, adminSecret);
    const originals = Object.fromEntries(
      (await admin.templateVersion.findMany()).map((template) => [template.templateId, template.sha256]),
    );
    const owners = Object.fromEntries(
      (await admin.templateVersion.findMany()).map((template) => [template.templateId, template.letterheadOwner]),
    );
    try {
      await platform
        .post(`/tenants/${tenantA.id}/letterhead`)
        .attach('file', PNG, 'logo.png')
        .expect(201);
      const unchanged = await local.post(`/applications/${applicationA.id}/packages`).send({ templateId: 'kyc' }).expect(201);
      const unchangedBytes = await local.get(`/files/${unchanged.body.fileId}`).expect(200);
      expect(createHash('sha256').update(unchangedBytes.body).digest('hex')).toBe(originals.kyc);

      await platform.patch('/templates/kyc').send({ letterheadOwner: 'customer' }).expect(200);
      const painted = await local.post(`/applications/${applicationA.id}/packages`).send({ templateId: 'kyc' }).expect(201);
      expect(painted.body.painted[0]).toMatchObject({ x: 36.55, y: 734.62, width: 123.75, height: 78.6, page: 1 });
      const paintedBytes = await local.get(`/files/${painted.body.fileId}`).expect(200);
      expect(createHash('sha256').update(paintedBytes.body).digest('hex')).not.toBe(originals.kyc);
      expect(await contentText(paintedBytes.body)).toContain('123.75 0 0 78.6 36.55 734.62 cm');

      await platform.patch('/templates/responsible-sourcing').send({ letterheadOwner: 'customer' }).expect(200);
      const policy = await local.post(`/applications/${applicationA.id}/packages`).send({ templateId: 'responsible-sourcing' }).expect(201);
      const policyBytes = await local.get(`/files/${policy.body.fileId}`).expect(200);
      expect(createHash('sha256').update(policyBytes.body).digest('hex')).toBe(originals['responsible-sourcing']);
      expect(policy.body.blocked.map((slot: { fieldKey: string }) => slot.fieldKey)).toContain('rspolicy.letterhead');

      await admin.templateVersion.update({
        where: { templateId_version: { templateId: 'kyc', version: 1 } },
        data: { sha256: '0'.repeat(64) },
      });
      await local.post(`/applications/${applicationA.id}/packages`).send({ templateId: 'kyc' }).expect(400);
    } finally {
      for (const [templateId, sha256] of Object.entries(originals)) {
        await admin.templateVersion.update({
          where: { templateId_version: { templateId, version: 1 } },
          data: { sha256, letterheadOwner: owners[templateId] },
        });
      }
    }
  });

  async function login(email: string) {
    const agent = request.agent(app.getHttpServer());
    const response = await agent.post('/auth/login').send({ email, password: PASSWORD });
    expect(response.status).toBe(201);
    return agent;
  }

  async function satisfyMfa(agent: request.Agent, secret: string) {
    const code = new OTPAuth.TOTP({
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(secret),
    }).generate();
    await agent.post('/auth/mfa').send({ code }).expect(201);
  }
});

async function contentText(bytes: Buffer): Promise<string> {
  const pdf = await PDFDocument.load(bytes);
  const parts: string[] = [];
  for (const [, object] of pdf.context.enumerateIndirectObjects()) {
    if (object instanceof PDFRawStream) {
      try {
        parts.push(Buffer.from(decodePDFRawStream(object).decode()).toString('latin1'));
      } catch {
        parts.push('');
      }
    }
  }
  return parts.join('\n');
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
