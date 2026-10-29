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

describe('company networking', () => {
  let app: INestApplication;
  let admin: PrismaClient;
  let tenantA: { id: string };
  let tenantB: { id: string };
  let tenantC: { id: string };
  let system: { id: string };
  let employeeA: { id: string; email: string };
  let employeeB: { id: string; email: string };
  let employeeC: { id: string; email: string };
  let systemAdmin: { id: string; email: string };
  let customerA: { id: string; email: string };

  beforeAll(async () => {
    admin = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
    await admin.$connect();
    await ensureCatalogue(admin);
    await resetTenantData(admin);

    system = await admin.tenant.create({ data: { name: 'Platform', isSystem: true } });
    tenantA = await admin.tenant.create({ data: { name: 'Alpha Metals', displayName: 'Alpha Metals LLC' } });
    tenantB = await admin.tenant.create({ data: { name: 'Beta Trading', displayName: 'Beta Trading Co' } });
    tenantC = await admin.tenant.create({ data: { name: 'Gamma Hidden', displayName: 'Gamma Hidden' } });
    const roles = Object.fromEntries((await admin.role.findMany()).map((role) => [role.key, role.id]));
    const passwordHash = await hashPassword(PASSWORD);

    employeeA = await createUser(admin, tenantA.id, 'net-a@example.com', 'Net A', passwordHash, roles.employee);
    employeeB = await createUser(admin, tenantB.id, 'net-b@example.com', 'Net B', passwordHash, roles.employee);
    employeeC = await createUser(admin, tenantC.id, 'net-c@example.com', 'Net C', passwordHash, roles.employee);
    systemAdmin = await createUser(admin, system.id, 'net-system@example.com', 'System Admin', passwordHash, roles.super_admin);
    customerA = await createUser(admin, tenantA.id, 'net-customer@example.com', 'Customer', passwordHash, roles.customer);

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    await admin?.$disconnect();
  });

  it('lets a company update its own networking profile and blocks peer edits', async () => {
    const agentA = await login(employeeA.email);
    const saved = await agentA
      .put('/company-network/me')
      .send({
        headline: 'Responsible sourcing partner',
        introduction: 'We trade responsibly.',
        industry: 'Metals',
        city: 'Dubai',
        country: 'AE',
        website: 'https://alpha.example',
        productsServices: 'Gold refining',
        publicEmail: 'hello@alpha.example',
      })
      .expect(200);
    expect(saved.body.companyName).toBe('Alpha Metals LLC');
    expect(saved.body.headline).toBe('Responsible sourcing partner');
    expect(saved.body.registrationId).toBeUndefined();
    expect(saved.body.complianceEmail).toBeUndefined();
    expect(JSON.stringify(saved.body)).not.toContain('companyKyc');

    await agentA
      .put('/company-network/me/visibility')
      .send({ discoverable: true, visibility: 'public', messagingEnabled: true })
      .expect(200);

    const agentB = await login(employeeB.email);
    await agentB.put('/company-network/me').send({ headline: 'Beta headline', industry: 'Trading' }).expect(200);
    await agentB.put('/company-network/me/visibility').send({ discoverable: true, visibility: 'public' }).expect(200);

    const mine = await agentA.get('/company-network/me').expect(200);
    expect(mine.body.headline).toBe('Responsible sourcing partner');
    expect(mine.body.tenantId).toBe(tenantA.id);
  });

  it('discovers opt-in companies, excludes opt-outs and system tenants', async () => {
    const agentA = await login(employeeA.email);
    await login(employeeC.email).then((agent) =>
      agent.put('/company-network/me/visibility').send({ discoverable: false, visibility: 'private' }),
    );

    const listed = await agentA.get('/company-network/discover').expect(200);
    const ids = listed.body.items.map((item: { tenantId: string }) => item.tenantId);
    expect(ids).toContain(tenantB.id);
    expect(ids).not.toContain(tenantA.id);
    expect(ids).not.toContain(tenantC.id);
    expect(ids).not.toContain(system.id);
    expect(JSON.stringify(listed.body)).not.toContain('registrationId');
    expect(JSON.stringify(listed.body)).not.toContain('complianceEmail');
  });

  it('prevents self-connect, duplicates, and opposite-direction races', async () => {
    const agentA = await login(employeeA.email);
    await agentA.post('/company-network/requests').send({ tenantId: tenantA.id }).expect(400);

    const first = await agentA.post('/company-network/requests').send({ tenantId: tenantB.id }).expect(201);
    expect(first.body.status).toBe('pending');
    await agentA.post('/company-network/requests').send({ tenantId: tenantB.id }).expect(409);

    const agentB = await login(employeeB.email);
    await agentB.post('/company-network/requests').send({ tenantId: tenantA.id }).expect(409);
  });

  it('only the recipient can accept, then both see the connection and can message', async () => {
    const agentA = await login(employeeA.email);
    const agentB = await login(employeeB.email);

    const sent = await agentA.get('/company-network/requests/sent').expect(200);
    const requestId = sent.body[0].id;

    await agentA.post(`/company-network/requests/${requestId}/accept`).expect(403);
    await agentB.post(`/company-network/requests/${requestId}/accept`).expect(201);

    const connectionsA = await agentA.get('/company-network/connections').expect(200);
    const connectionsB = await agentB.get('/company-network/connections').expect(200);
    expect(connectionsA.body.some((row: { peerTenantId: string }) => row.peerTenantId === tenantB.id)).toBe(true);
    expect(connectionsB.body.some((row: { peerTenantId: string }) => row.peerTenantId === tenantA.id)).toBe(true);

    const conversations = await agentA.get('/company-network/conversations').expect(200);
    expect(conversations.body).toHaveLength(1);
    const conversationId = conversations.body[0].id;

    const sentMessage = await agentA
      .post('/company-network/messages')
      .send({ conversationId, body: 'Hello from Alpha' })
      .expect(201);
    expect(sentMessage.body.body).toBe('Hello from Alpha');

    const unread = await agentB.get('/company-network/unread-count').expect(200);
    expect(unread.body.count).toBeGreaterThanOrEqual(1);

    const history = await agentB.get(`/company-network/conversations/${conversationId}/messages`).expect(200);
    expect(history.body.items.some((row: { body: string }) => row.body === 'Hello from Alpha')).toBe(true);

    await agentB.post(`/company-network/conversations/${conversationId}/read`).expect(201);
    const cleared = await agentB.get('/company-network/unread-count').expect(200);
    expect(cleared.body.count).toBe(0);
  });

  it('hides private profiles and blocks messaging without an accepted connection', async () => {
    const agentA = await login(employeeA.email);
    const agentC = await login(employeeC.email);

    await agentC.put('/company-network/me').send({ headline: 'Secret', industry: 'Private' }).expect(200);
    await agentC.put('/company-network/me/visibility').send({ discoverable: false, visibility: 'private' }).expect(200);

    await agentA.get(`/company-network/companies/${tenantC.id}`).expect(404);

    const agentB = await login(employeeB.email);
    await agentB.post('/company-network/requests').send({ tenantId: tenantC.id }).expect(201);
    const received = await agentC.get('/company-network/requests/received').expect(200);
    expect(received.body).toHaveLength(1);

    await agentB
      .post('/company-network/messages')
      .send({ connectionId: received.body[0].id, body: 'Should fail' })
      .expect(403);
  });

  it('denies customers and prevents non-participants from reading conversations', async () => {
    const customer = await login(customerA.email);
    await customer.get('/company-network/me').expect(403);

    const agentA = await login(employeeA.email);
    const conversations = await agentA.get('/company-network/conversations').expect(200);
    const conversationId = conversations.body[0]?.id;
    expect(conversationId).toBeTruthy();

    const agentC = await login(employeeC.email);
    await agentC.get(`/company-network/conversations/${conversationId}/messages`).expect(403);
    await agentC.post('/company-network/messages').send({ conversationId, body: 'intrusion' }).expect(403);
  });

  it('denies system-tenant staff from networking APIs and public assets', async () => {
    const systemAgent = await login(systemAdmin.email);
    await systemAgent.get('/company-network/me').expect(403);
    await systemAgent.get('/company-network/discover').expect(403);
    await systemAgent.get('/company-network/connections').expect(403);
    await systemAgent.get(`/company-network/companies/${tenantB.id}`).expect(403);
    await systemAgent.get(`/company-network/companies/${tenantB.id}/logo`).expect(403);
  });

  it('enforces connections visibility and keeps private profiles hidden from connections', async () => {
    const agentA = await login(employeeA.email);
    const agentB = await login(employeeB.email);
    const agentC = await login(employeeC.email);

    await agentC
      .put('/company-network/me/visibility')
      .send({ discoverable: false, visibility: 'connections', messagingEnabled: true })
      .expect(200);

    await agentA.get(`/company-network/companies/${tenantC.id}`).expect(404);

    const pending = await agentB.get('/company-network/requests/sent').expect(200);
    const toC = pending.body.find((row: { addresseeTenantId: string }) => row.addresseeTenantId === tenantC.id);
    expect(toC).toBeTruthy();
    await agentA.post(`/company-network/requests/${toC.id}/decline`).expect(403);
    await agentC.post(`/company-network/requests/${toC.id}/accept`).expect(201);

    const visibleToB = await agentB.get(`/company-network/companies/${tenantC.id}`).expect(200);
    expect(visibleToB.body.companyName).toBe('Gamma Hidden');
    await agentA.get(`/company-network/companies/${tenantC.id}`).expect(404);

    await agentB
      .put('/company-network/me/visibility')
      .send({ discoverable: false, visibility: 'private', messagingEnabled: true })
      .expect(200);
    await agentA.get(`/company-network/companies/${tenantB.id}`).expect(404);
  });

  it('blocks messaging when the peer disables messaging, including private visibility', async () => {
    const agentA = await login(employeeA.email);
    const agentB = await login(employeeB.email);

    await agentB
      .put('/company-network/me/visibility')
      .send({ discoverable: false, visibility: 'private', messagingEnabled: false })
      .expect(200);

    const conversations = await agentA.get('/company-network/conversations').expect(200);
    const withB = conversations.body.find((row: { peerTenantId: string }) => row.peerTenantId === tenantB.id);
    expect(withB).toBeTruthy();
    await agentA.post('/company-network/messages').send({ conversationId: withB.id, body: 'blocked' }).expect(403);

    await agentB
      .put('/company-network/me/visibility')
      .send({ discoverable: true, visibility: 'public', messagingEnabled: true })
      .expect(200);
  });

  it('enforces cancel authorization and denies messaging after disconnect', async () => {
    const agentA = await login(employeeA.email);
    const agentB = await login(employeeB.email);

    const connections = await agentA.get('/company-network/connections').expect(200);
    const withB = connections.body.find((row: { peerTenantId: string }) => row.peerTenantId === tenantB.id);
    expect(withB).toBeTruthy();
    const conversationId = (await agentA.get('/company-network/conversations').expect(200)).body.find(
      (row: { peerTenantId: string }) => row.peerTenantId === tenantB.id,
    ).id;

    await agentA.post(`/company-network/requests/${withB.id}/disconnect`).expect(201);
    await agentA.post('/company-network/messages').send({ conversationId, body: 'after disconnect' }).expect(403);
    await agentA.get(`/company-network/conversations/${conversationId}/messages`).expect(403);
    const after = await agentA.get('/company-network/conversations').expect(200);
    expect(after.body.some((row: { peerTenantId: string }) => row.peerTenantId === tenantB.id)).toBe(false);

    const reRequest = await agentA.post('/company-network/requests').send({ tenantId: tenantB.id }).expect(201);
    await agentB.post(`/company-network/requests/${reRequest.body.id}/cancel`).expect(403);
    await agentA.post(`/company-network/requests/${reRequest.body.id}/cancel`).expect(201);
  });

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
) {
  const secret = new OTPAuth.Secret({ size: 20 }).base32;
  const user = await admin.user.create({
    data: {
      tenantId,
      email,
      displayName,
      passwordHash,
      mfaSecret: encryptSecret(secret),
    },
  });
  await admin.userRole.create({ data: { tenantId, userId: user.id, roleId } });
  return user;
}
