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
  let employeeA2: { id: string; email: string };
  let employeeB: { id: string; email: string };
  let employeeB2: { id: string; email: string };
  let employeeC: { id: string; email: string };
  let systemAdmin: { id: string; email: string };
  let customerA: { id: string; email: string };
  const agents = new Map<string, ReturnType<typeof request.agent>>();

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
    employeeA2 = await createUser(admin, tenantA.id, 'net-a2@example.com', 'Net A2', passwordHash, roles.employee);
    employeeB = await createUser(admin, tenantB.id, 'net-b@example.com', 'Net B', passwordHash, roles.employee);
    employeeB2 = await createUser(admin, tenantB.id, 'net-b2@example.com', 'Net B2', passwordHash, roles.employee);
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
    await agentB
      .put('/company-network/me')
      .send({
        headline: 'Beta headline',
        industry: 'Trading',
        city: 'Dubai',
        country: 'AE',
        productsServices: 'ZYXREFINE99 wholesale',
        capabilities: 'bullion assay',
      })
      .expect(200);
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

    const byIndustry = await agentA.get('/company-network/discover?industry=Trading&page=1&pageSize=10').expect(200);
    expect(byIndustry.body.page).toBe(1);
    expect(byIndustry.body.pageSize).toBe(10);
    expect(byIndustry.body.totalPages).toBeGreaterThanOrEqual(1);
    expect(byIndustry.body.items.every((item: { industry: string }) => item.industry.toLowerCase().includes('trading'))).toBe(
      true,
    );

    const byKeyword = await agentA.get('/company-network/discover?q=Beta').expect(200);
    expect(byKeyword.body.items.some((item: { tenantId: string }) => item.tenantId === tenantB.id)).toBe(true);
    expect(byKeyword.body.items.every((item: { tenantId: string }) => item.tenantId !== tenantA.id)).toBe(true);

    const byProducts = await agentA.get('/company-network/discover?q=ZYXREFINE99').expect(200);
    expect(byProducts.body.items.some((item: { tenantId: string }) => item.tenantId === tenantB.id)).toBe(true);
    expect(byProducts.body.items.every((item: { tenantId: string }) => item.tenantId !== tenantA.id)).toBe(true);

    const byCountry = await agentA.get('/company-network/discover?country=AE').expect(200);
    expect(byCountry.body.items.length).toBeGreaterThan(0);
    expect(byCountry.body.items.every((item: { country: string }) => item.country.toLowerCase() === 'ae')).toBe(true);
    expect(byCountry.body.items.every((item: { tenantId: string }) => item.tenantId !== tenantA.id)).toBe(true);

    const byCity = await agentA.get('/company-network/discover?city=Dubai').expect(200);
    expect(byCity.body.items.length).toBeGreaterThan(0);
    expect(byCity.body.items.every((item: { city: string }) => item.city.toLowerCase().includes('dubai'))).toBe(true);

    const pageOne = await agentA.get('/company-network/discover?page=1&pageSize=1').expect(200);
    expect(pageOne.body.page).toBe(1);
    expect(pageOne.body.pageSize).toBe(1);
    expect(pageOne.body.total).toBeGreaterThanOrEqual(1);
    expect(pageOne.body.items).toHaveLength(Math.min(1, pageOne.body.total));
    expect(pageOne.body.totalPages).toBe(Math.max(1, Math.ceil(pageOne.body.total / 1)));
    const beyond = await agentA
      .get(`/company-network/discover?page=${pageOne.body.totalPages + 1}&pageSize=1`)
      .expect(200);
    expect(beyond.body.total).toBe(pageOne.body.total);
    expect(beyond.body.items).toHaveLength(0);

    const withStatus = listed.body.items.find((item: { tenantId: string }) => item.tenantId === tenantB.id);
    expect(withStatus).toBeTruthy();
    expect(withStatus.connectionStatus).toBe('none');
    expect(withStatus.connectionId).toBeNull();
  });

  it('returns network home aggregate from authorized data only', async () => {
    const agentA = await login(employeeA.email);
    const home = await agentA.get('/company-network/home').expect(200);
    expect(home.body.profile.tenantId).toBe(tenantA.id);
    expect(home.body.profile.completion.missing).toEqual(expect.any(Array));
    expect(home.body.suggestionTotal).toEqual(expect.any(Number));
    expect(Array.isArray(home.body.suggestions)).toBe(true);
    expect(home.body.suggestions.every((item: { tenantId: string }) => item.tenantId !== tenantA.id)).toBe(true);
    expect(Array.isArray(home.body.receivedRequests)).toBe(true);
    expect(Array.isArray(home.body.recentConversations)).toBe(true);
    expect(home.body.unreadCount).toEqual(expect.any(Number));
    expect(JSON.stringify(home.body)).not.toContain('registrationId');
    expect(JSON.stringify(home.body)).not.toContain('complianceEmail');
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

    const pendingDiscover = await agentA.get('/company-network/discover').expect(200);
    const pendingPeer = pendingDiscover.body.items.find((item: { tenantId: string }) => item.tenantId === tenantB.id);
    expect(pendingPeer?.connectionStatus).toBe('pending_outgoing');
    expect(pendingPeer?.connectionId).toBe(requestId);

    await agentA.post(`/company-network/requests/${requestId}/accept`).expect(403);
    await agentB.post(`/company-network/requests/${requestId}/accept`).expect(201);

    const connectedDiscover = await agentA.get('/company-network/discover').expect(200);
    const connectedPeer = connectedDiscover.body.items.find((item: { tenantId: string }) => item.tenantId === tenantB.id);
    expect(connectedPeer?.connectionStatus).toBe('connected');
    expect(connectedPeer?.connectionId).toBe(requestId);

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

    const toDecline = await agentA.post('/company-network/requests').send({ tenantId: tenantB.id }).expect(201);
    expect(toDecline.body.status).toBe('pending');
    await agentB.post(`/company-network/requests/${toDecline.body.id}/decline`).expect(201);
    const received = await agentB.get('/company-network/requests/received').expect(200);
    expect(received.body.some((row: { id: string }) => row.id === toDecline.body.id)).toBe(false);
    const peer = await agentA.get(`/company-network/companies/${tenantB.id}`).expect(200);
    expect(peer.body.connectionStatus).toBe('declined');
  });

  it('updates members/me profile and preferences without 500', async () => {
    const agentA = await login(employeeA.email);
    const initial = await agentA.get('/company-network/members/me').expect(200);
    expect(initial.body.userId).toBe(employeeA.id);
    expect(initial.body.notifyMessages).toBe(true);
    expect(initial.body.notifyConnections).toBe(true);
    expect(initial.body.notifyFeed).toBe(true);

    const saved = await agentA
      .put('/company-network/members/me')
      .send({
        jobTitle: 'Compliance Lead',
        department: 'Risk',
        introduction: 'Networking member bio',
        notifyMessages: false,
        notifyConnections: true,
        notifyFeed: false,
      })
      .expect(200);
    expect(saved.body.jobTitle).toBe('Compliance Lead');
    expect(saved.body.department).toBe('Risk');
    expect(saved.body.notifyMessages).toBe(false);
    expect(saved.body.notifyFeed).toBe(false);

    const again = await agentA.get('/company-network/members/me').expect(200);
    expect(again.body.jobTitle).toBe('Compliance Lead');
    expect(again.body.notifyMessages).toBe(false);
    expect(again.body.notifyFeed).toBe(false);
    expect(again.body.notifyConnections).toBe(true);

    await agentA
      .put('/company-network/members/me')
      .send({ notifyMessages: true, notifyFeed: true, notifyConnections: true })
      .expect(200);

    const members = await agentA.get('/company-network/members').expect(200);
    expect(members.body.some((row: { userId: string }) => row.userId === employeeA.id)).toBe(true);
  });

  it('fans out connection_request to addressee staff and respects notifyConnections', async () => {
    const agentA = await login(employeeA.email);
    const agentB = await login(employeeB.email);
    const agentB2 = await login(employeeB2.email);

    await ensureNoPendingBetween(agentA, agentB, tenantA.id, tenantB.id);

    await agentB.put('/company-network/members/me').send({ notifyConnections: true }).expect(200);
    await agentB2.put('/company-network/members/me').send({ notifyConnections: false }).expect(200);

    await agentB.post('/company-network/notifications/read').send({ all: true }).expect(201);
    await agentB2.post('/company-network/notifications/read').send({ all: true }).expect(201);

    const request = await agentA.post('/company-network/requests').send({ tenantId: tenantB.id }).expect(201);

    const notesB = await agentB.get('/company-network/notifications').expect(200);
    expect(
      notesB.body.items.some(
        (row: { type: string; readAt: string | null; payload: { connectionId?: string } }) =>
          !row.readAt &&
          row.type === 'connection_request' &&
          row.payload?.connectionId === request.body.id,
      ),
    ).toBe(true);

    const notesB2 = await agentB2.get('/company-network/notifications').expect(200);
    expect(
      notesB2.body.items.some(
        (row: { type: string; readAt: string | null; payload: { connectionId?: string } }) =>
          !row.readAt &&
          row.type === 'connection_request' &&
          row.payload?.connectionId === request.body.id,
      ),
    ).toBe(false);

    const notesA = await agentA.get('/company-network/notifications').expect(200);
    expect(
      notesA.body.items.some(
        (row: { type: string; payload: { connectionId?: string } }) =>
          row.type === 'connection_request' && row.payload?.connectionId === request.body.id,
      ),
    ).toBe(false);

    await agentA.post(`/company-network/requests/${request.body.id}/cancel`).expect(201);
    await agentB2.put('/company-network/members/me').send({ notifyConnections: true }).expect(200);
  });

  it('notifies requester on accept and peer staff on new_message', async () => {
    const agentA = await login(employeeA.email);
    const agentA2 = await login(employeeA2.email);
    const agentB = await login(employeeB.email);
    const agentB2 = await login(employeeB2.email);

    await ensureNoPendingBetween(agentA, agentB, tenantA.id, tenantB.id);

    await agentA.put('/company-network/members/me').send({ notifyConnections: true, notifyMessages: true }).expect(200);
    await agentB.put('/company-network/members/me').send({ notifyMessages: true }).expect(200);
    await agentB2.put('/company-network/members/me').send({ notifyMessages: false }).expect(200);

    await agentA.post('/company-network/notifications/read').send({ all: true }).expect(201);
    await agentB.post('/company-network/notifications/read').send({ all: true }).expect(201);
    await agentB2.post('/company-network/notifications/read').send({ all: true }).expect(201);

    const request = await agentA.post('/company-network/requests').send({ tenantId: tenantB.id }).expect(201);
    await agentB.post(`/company-network/requests/${request.body.id}/accept`).expect(201);

    const notesA = await agentA.get('/company-network/notifications').expect(200);
    expect(
      notesA.body.items.some(
        (row: { type: string; payload: { connectionId?: string } }) =>
          row.type === 'connection_accepted' && row.payload?.connectionId === request.body.id,
      ),
    ).toBe(true);

    const conversations = await agentA.get('/company-network/conversations').expect(200);
    const conversationId = conversations.body.find((row: { peerTenantId: string }) => row.peerTenantId === tenantB.id)?.id;
    expect(conversationId).toBeTruthy();

    await agentA
      .post('/company-network/messages')
      .send({ conversationId, body: 'Notify peer staff please' })
      .expect(201);
    await agentA
      .post('/company-network/messages')
      .send({ conversationId, body: 'Second message for cursor paging' })
      .expect(201);

    const notesB = await agentB.get('/company-network/notifications').expect(200);
    expect(
      notesB.body.items.some(
        (row: { type: string; readAt: string | null; payload: { conversationId?: string } }) =>
          !row.readAt &&
          row.type === 'new_message' &&
          row.payload?.conversationId === conversationId,
      ),
    ).toBe(true);

    const notesB2 = await agentB2.get('/company-network/notifications').expect(200);
    expect(
      notesB2.body.items.some(
        (row: { type: string; readAt: string | null; payload: { conversationId?: string } }) =>
          !row.readAt &&
          row.type === 'new_message' &&
          row.payload?.conversationId === conversationId,
      ),
    ).toBe(false);

    const notesSender = await agentA.get('/company-network/notifications').expect(200);
    expect(
      notesSender.body.items.some(
        (row: { type: string; payload: { conversationId?: string } }) =>
          row.type === 'new_message' && row.payload?.conversationId === conversationId,
      ),
    ).toBe(false);

    const page = await agentA.get(`/company-network/conversations/${conversationId}/messages?limit=1`).expect(200);
    expect(page.body.items).toHaveLength(1);
    expect(page.body.nextCursor).toBeTruthy();
    const older = await agentA
      .get(`/company-network/conversations/${conversationId}/messages?limit=10&cursor=${encodeURIComponent(page.body.nextCursor)}`)
      .expect(200);
    expect(older.body.items.every((row: { id: string }) => row.id !== page.body.items[0].id)).toBe(true);

    await agentA2.get('/company-network/notifications').expect(200);
    await agentB2.put('/company-network/members/me').send({ notifyMessages: true }).expect(200);
  });

  it('notifies post author on comment using notifyFeed', async () => {
    const agentA = await login(employeeA.email);
    const agentB = await login(employeeB.email);

    await agentA.put('/company-network/members/me').send({ notifyFeed: true }).expect(200);
    await agentA.post('/company-network/notifications/read').send({ all: true }).expect(201);

    const post = await agentA
      .post('/company-network/posts')
      .send({ body: 'Shipping refined gold updates this week', postType: 'news' })
      .expect(201);

    await agentB.post(`/company-network/posts/${post.body.id}/reactions`).send({ reactionType: 'like' }).expect(201);
    await agentB
      .post(`/company-network/posts/${post.body.id}/comments`)
      .send({ body: 'Interesting update' })
      .expect(201);

    const notesA = await agentA.get('/company-network/notifications').expect(200);
    expect(
      notesA.body.items.some(
        (row: { type: string; payload: { postId?: string } }) =>
          row.type === 'feed_comment' && row.payload?.postId === post.body.id,
      ),
    ).toBe(true);

    await agentA.put('/company-network/members/me').send({ notifyFeed: false }).expect(200);
    await agentA.post('/company-network/notifications/read').send({ all: true }).expect(201);
    await agentB
      .post(`/company-network/posts/${post.body.id}/comments`)
      .send({ body: 'Second comment should be silent' })
      .expect(201);
    const silent = await agentA.get('/company-network/notifications').expect(200);
    expect(
      silent.body.items.some(
        (row: { type: string; readAt: string | null }) => !row.readAt && row.type === 'feed_comment',
      ),
    ).toBe(false);

    await agentA.post(`/company-network/posts/${post.body.id}/comments`).send({ body: 'Self comment' }).expect(201);
    const afterSelf = await agentA.get('/company-network/notifications').expect(200);
    expect(
      afterSelf.body.items.some(
        (row: { type: string; readAt: string | null }) => !row.readAt && row.type === 'feed_comment',
      ),
    ).toBe(false);

    await agentA.put('/company-network/members/me').send({ notifyFeed: true }).expect(200);
  });

  it('hides private tenant posts from non-connected feed and blocks comment/react', async () => {
    const agentA = await login(employeeA.email);
    const agentC = await login(employeeC.email);

    await agentC.put('/company-network/me/visibility').send({ discoverable: false, visibility: 'private' }).expect(200);
    const privatePost = await agentC
      .post('/company-network/posts')
      .send({ body: 'Internal-only private tenant update', postType: 'announcement' })
      .expect(201);

    const feedA = await agentA.get('/company-network/feed').expect(200);
    expect(feedA.body.items.some((row: { id: string }) => row.id === privatePost.body.id)).toBe(false);

    await agentA.post(`/company-network/posts/${privatePost.body.id}/comments`).send({ body: 'nope' }).expect(404);
    await agentA.post(`/company-network/posts/${privatePost.body.id}/reactions`).send({ reactionType: 'like' }).expect(404);
  });

  it('allows only author to edit or soft-delete a post', async () => {
    const agentA = await login(employeeA.email);
    const agentB = await login(employeeB.email);

    const post = await agentA
      .post('/company-network/posts')
      .send({ body: 'Editable announcement', postType: 'announcement' })
      .expect(201);

    await agentB.patch(`/company-network/posts/${post.body.id}`).send({ body: 'Hijack' }).expect(404);
    await agentB.delete(`/company-network/posts/${post.body.id}`).expect(404);

    const edited = await agentA
      .patch(`/company-network/posts/${post.body.id}`)
      .send({ body: 'Edited announcement' })
      .expect(200);
    expect(edited.body.body).toBe('Edited announcement');

    await agentA.delete(`/company-network/posts/${post.body.id}`).expect(200);
    const feed = await agentA.get('/company-network/feed').expect(200);
    expect(feed.body.items.some((row: { id: string }) => row.id === post.body.id)).toBe(false);
  });

  it('scopes notifications list and mark-read to the authenticated user', async () => {
    const agentA = await login(employeeA.email);
    const agentA2 = await login(employeeA2.email);
    const agentB = await login(employeeB.email);

    await agentA.put('/company-network/members/me').send({ notifyConnections: true }).expect(200);
    await agentA2.put('/company-network/members/me').send({ notifyConnections: true }).expect(200);
    await agentA.post('/company-network/notifications/read').send({ all: true }).expect(201);
    await agentA2.post('/company-network/notifications/read').send({ all: true }).expect(201);

    await ensureNoPendingBetween(agentA, agentB, tenantA.id, tenantB.id);
    const connections = await agentA.get('/company-network/connections').expect(200);
    const withB = connections.body.find((row: { peerTenantId: string }) => row.peerTenantId === tenantB.id);
    if (withB) {
      await agentA.post(`/company-network/requests/${withB.id}/disconnect`).expect(201);
    }

    const request = await agentB.post('/company-network/requests').send({ tenantId: tenantA.id }).expect(201);

    const notesA = await agentA.get('/company-network/notifications').expect(200);
    const notesA2 = await agentA2.get('/company-network/notifications').expect(200);
    expect(
      notesA.body.items.some(
        (row: { type: string; readAt: string | null; payload: { connectionId?: string } }) =>
          !row.readAt &&
          row.type === 'connection_request' &&
          row.payload?.connectionId === request.body.id,
      ),
    ).toBe(true);
    expect(
      notesA2.body.items.some(
        (row: { type: string; readAt: string | null; payload: { connectionId?: string } }) =>
          !row.readAt &&
          row.type === 'connection_request' &&
          row.payload?.connectionId === request.body.id,
      ),
    ).toBe(true);

    const aIds = notesA.body.items.map((row: { id: string }) => row.id);
    expect(notesA2.body.items.every((row: { id: string }) => !aIds.includes(row.id))).toBe(true);

    await agentA.post('/company-network/notifications/read').send({ all: true }).expect(201);
    const unreadA = await agentA.get('/company-network/notifications/unread-count').expect(200);
    const unreadA2 = await agentA2.get('/company-network/notifications/unread-count').expect(200);
    expect(unreadA.body.count).toBe(0);
    expect(unreadA2.body.count).toBeGreaterThan(0);

    await agentB.post(`/company-network/requests/${request.body.id}/cancel`).expect(201);
  });

  async function ensureNoPendingBetween(
    agentLeft: ReturnType<typeof request.agent>,
    agentRight: ReturnType<typeof request.agent>,
    leftTenantId: string,
    rightTenantId: string,
  ) {
    const sentLeft = await agentLeft.get('/company-network/requests/sent').expect(200);
    for (const row of sentLeft.body as Array<{ id: string; addresseeTenantId: string; status: string }>) {
      if (row.addresseeTenantId === rightTenantId && row.status === 'pending') {
        await agentLeft.post(`/company-network/requests/${row.id}/cancel`).expect(201);
      }
    }
    const sentRight = await agentRight.get('/company-network/requests/sent').expect(200);
    for (const row of sentRight.body as Array<{ id: string; addresseeTenantId: string; status: string }>) {
      if (row.addresseeTenantId === leftTenantId && row.status === 'pending') {
        await agentRight.post(`/company-network/requests/${row.id}/cancel`).expect(201);
      }
    }
  }

  async function login(email: string) {
    const cached = agents.get(email);
    if (cached) {
      return cached;
    }
    const agent = request.agent(app.getHttpServer());
    const response = await agent.post('/auth/login').send({ email, password: PASSWORD });
    expect(response.status).toBe(201);
    agents.set(email, agent);
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
