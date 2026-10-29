import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AuthState } from '../auth/auth.types';
import { FileService } from '../files/file.service';
import { PrismaService, type Tx } from '../prisma/prisma.service';
import { readPrivateFile } from '../files/storage';

const VISIBILITY = new Set(['private', 'connections', 'public']);
const MAX_MESSAGE_LENGTH = 4000;
const PAGE_SIZE_DEFAULT = 20;
const PAGE_SIZE_MAX = 50;
const NETWORK_ASSET_TYPES = new Set(['logo', 'cover']);

type ConnectionStatus = 'pending' | 'accepted' | 'declined' | 'cancelled' | 'disconnected';

@Injectable()
export class CompanyNetworkService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly files: FileService,
  ) {}

  async getMyProfile(auth: AuthState) {
    await this.assertEligibleTenant(auth.tenantId);
    return this.prisma.withTenant(auth.tenantId, async (tx) => {
      const profile = await this.ensureProfile(tx, auth.tenantId);
      const tenant = await this.prisma.tenant.findUniqueOrThrow({
        where: { id: auth.tenantId },
        select: { id: true, name: true, displayName: true, isSystem: true },
      });
      const connectionCount = await tx.companyConnection.count({
        where: {
          status: 'accepted',
          OR: [{ requesterTenantId: auth.tenantId }, { addresseeTenantId: auth.tenantId }],
        },
      });
      const assets = await this.listNetworkAssets(tx, auth.tenantId);
      return {
        ...this.toOwnDto(profile, tenant),
        connectionCount,
        hasLogo: assets.includes('logo'),
        hasCover: assets.includes('cover'),
        completion: this.completion(profile, tenant.displayName || tenant.name),
      };
    });
  }

  async updateMyProfile(auth: AuthState, body: Record<string, unknown>) {
    await this.assertEligibleTenant(auth.tenantId);
    const data = this.parseProfileInput(body, true);
    return this.prisma.withTenant(auth.tenantId, async (tx) => {
      await this.ensureProfile(tx, auth.tenantId);
      const profile = await tx.companyNetworkProfile.update({
        where: { tenantId: auth.tenantId },
        data,
      });
      await tx.auditEvent.create({
        data: {
          tenantId: auth.tenantId,
          actorId: auth.userId,
          action: 'company_network.profile.update',
          targetType: 'company_network_profile',
          targetId: profile.id,
        },
      });
      const tenant = await this.prisma.tenant.findUniqueOrThrow({
        where: { id: auth.tenantId },
        select: { id: true, name: true, displayName: true, isSystem: true },
      });
      const assets = await this.listNetworkAssets(tx, auth.tenantId);
      return {
        ...this.toOwnDto(profile, tenant),
        hasLogo: assets.includes('logo'),
        hasCover: assets.includes('cover'),
        completion: this.completion(profile, tenant.displayName || tenant.name),
      };
    });
  }

  async updateVisibility(
    auth: AuthState,
    body: { discoverable?: boolean; visibility?: string; messagingEnabled?: boolean },
  ) {
    await this.assertEligibleTenant(auth.tenantId);
    const visibility = typeof body?.visibility === 'string' ? body.visibility : undefined;
    if (visibility !== undefined && !VISIBILITY.has(visibility)) {
      throw new BadRequestException('Visibility is invalid');
    }
    return this.prisma.withTenant(auth.tenantId, async (tx) => {
      await this.ensureProfile(tx, auth.tenantId);
      const profile = await tx.companyNetworkProfile.update({
        where: { tenantId: auth.tenantId },
        data: {
          ...(typeof body?.discoverable === 'boolean' ? { discoverable: body.discoverable } : {}),
          ...(visibility ? { visibility } : {}),
          ...(typeof body?.messagingEnabled === 'boolean' ? { messagingEnabled: body.messagingEnabled } : {}),
        },
      });
      await tx.auditEvent.create({
        data: {
          tenantId: auth.tenantId,
          actorId: auth.userId,
          action: 'company_network.visibility.update',
          targetType: 'company_network_profile',
          targetId: profile.id,
        },
      });
      const tenant = await this.prisma.tenant.findUniqueOrThrow({
        where: { id: auth.tenantId },
        select: { id: true, name: true, displayName: true, isSystem: true },
      });
      return this.toOwnDto(profile, tenant);
    });
  }

  async uploadAsset(auth: AuthState, assetTypeRaw: string, bytes: Buffer) {
    await this.assertEligibleTenant(auth.tenantId);
    if (!NETWORK_ASSET_TYPES.has(assetTypeRaw)) {
      throw new BadRequestException('Company asset type is invalid');
    }
    const stored = await this.files.store(auth.tenantId, bytes, 'image');
    return this.prisma.withTenant(auth.tenantId, async (tx) => {
      await this.ensureProfile(tx, auth.tenantId);
      await tx.tenantCompanyAsset.upsert({
        where: { tenantId_assetType: { tenantId: auth.tenantId, assetType: assetTypeRaw } },
        create: { tenantId: auth.tenantId, assetType: assetTypeRaw, fileId: stored.id },
        update: { fileId: stored.id },
      });
      return {
        assetType: assetTypeRaw,
        fileId: stored.id,
        mediaType: stored.mediaType,
        byteSize: stored.byteSize,
        uploadedAt: stored.createdAt,
      };
    });
  }

  async discover(
    auth: AuthState,
    query: { q?: string; country?: string; city?: string; industry?: string; page?: string; pageSize?: string },
  ) {
    await this.assertEligibleTenant(auth.tenantId);
    const page = Math.max(1, Number.parseInt(query.page ?? '1', 10) || 1);
    const pageSize = Math.min(PAGE_SIZE_MAX, Math.max(1, Number.parseInt(query.pageSize ?? String(PAGE_SIZE_DEFAULT), 10) || PAGE_SIZE_DEFAULT));
    const q = (query.q ?? '').trim();
    const country = (query.country ?? '').trim();
    const city = (query.city ?? '').trim();
    const industry = (query.industry ?? '').trim();

    const systemIds = (
      await this.prisma.tenant.findMany({ where: { isSystem: true }, select: { id: true } })
    ).map((row) => row.id);

    return this.prisma.withTenant(auth.tenantId, async (tx) => {
      const where: Prisma.CompanyNetworkProfileWhereInput = {
        discoverable: true,
        visibility: 'public',
        tenantId: { notIn: [auth.tenantId, ...systemIds] },
        ...(country ? { country: { equals: country, mode: 'insensitive' } } : {}),
        ...(city ? { city: { contains: city, mode: 'insensitive' } } : {}),
        ...(industry ? { industry: { contains: industry, mode: 'insensitive' } } : {}),
      };

      const profiles = await tx.companyNetworkProfile.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
      });

      const tenantIds = profiles.map((p) => p.tenantId);
      const tenants = await this.prisma.tenant.findMany({
        where: { id: { in: tenantIds }, isSystem: false },
        select: { id: true, name: true, displayName: true },
      });
      const tenantMap = new Map(tenants.map((t) => [t.id, t]));

      let filtered = profiles.filter((p) => tenantMap.has(p.tenantId));
      if (q) {
        const needle = q.toLowerCase();
        filtered = filtered.filter((p) => {
          const tenant = tenantMap.get(p.tenantId)!;
          const label = (tenant.displayName || tenant.name).toLowerCase();
          return label.includes(needle) || p.headline.toLowerCase().includes(needle) || p.industry.toLowerCase().includes(needle);
        });
      }

      const total = filtered.length;
      const slice = filtered.slice((page - 1) * pageSize, page * pageSize);
      const connections = await tx.companyConnection.findMany({
        where: {
          OR: [
            { requesterTenantId: auth.tenantId, addresseeTenantId: { in: slice.map((p) => p.tenantId) } },
            { addresseeTenantId: auth.tenantId, requesterTenantId: { in: slice.map((p) => p.tenantId) } },
          ],
        },
      });
      const connectionByPeer = new Map<string, (typeof connections)[number]>();
      for (const connection of connections) {
        const peer =
          connection.requesterTenantId === auth.tenantId ? connection.addresseeTenantId : connection.requesterTenantId;
        connectionByPeer.set(peer, connection);
      }

      const items = slice.map((profile) => {
        const tenant = tenantMap.get(profile.tenantId)!;
        const connection = connectionByPeer.get(profile.tenantId) ?? null;
        return {
          ...this.toPublicDto(profile, tenant),
          connectionStatus: this.connectionStatusForViewer(auth.tenantId, connection),
          connectionId: connection?.id ?? null,
        };
      });

      return { items, page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
    });
  }

  async getCompany(auth: AuthState, peerTenantId: string) {
    await this.assertEligibleTenant(auth.tenantId);
    if (peerTenantId === auth.tenantId) {
      return this.getMyProfile(auth);
    }
    const peer = await this.prisma.tenant.findUnique({
      where: { id: peerTenantId },
      select: { id: true, name: true, displayName: true, isSystem: true },
    });
    if (!peer || peer.isSystem) {
      throw new NotFoundException('Company was not found');
    }

    const viewed = await this.prisma.withTenant(auth.tenantId, async (tx) => {
      const profile = await tx.companyNetworkProfile.findUnique({ where: { tenantId: peerTenantId } });
      if (!profile) {
        throw new NotFoundException('Company was not found');
      }
      const connection = await tx.companyConnection.findFirst({
        where: {
          OR: [
            { requesterTenantId: auth.tenantId, addresseeTenantId: peerTenantId },
            { requesterTenantId: peerTenantId, addresseeTenantId: auth.tenantId },
          ],
        },
      });
      const accepted = connection?.status === 'accepted';
      if (!this.canViewNetworkProfile(profile, accepted)) {
        throw new NotFoundException('Company was not found');
      }
      const connectionCount = accepted
        ? await tx.companyConnection.count({
            where: {
              status: 'accepted',
              OR: [{ requesterTenantId: peerTenantId }, { addresseeTenantId: peerTenantId }],
            },
          })
        : undefined;
      return {
        profile,
        connection,
        accepted,
        connectionCount,
      };
    });

    const assets = await this.prisma.withTenant(peerTenantId, (peerTx) =>
      this.listNetworkAssets(peerTx, peerTenantId),
    );
    return {
      ...this.toPublicDto(viewed.profile, peer),
      hasLogo: assets.includes('logo'),
      hasCover: assets.includes('cover'),
      connectionStatus: this.connectionStatusForViewer(auth.tenantId, viewed.connection),
      connectionId: viewed.connection?.id ?? null,
      ...(viewed.connectionCount !== undefined ? { connectionCount: viewed.connectionCount } : {}),
      canMessage: viewed.accepted && viewed.profile.messagingEnabled,
    };
  }

  async getAssetContent(auth: AuthState, peerTenantId: string, assetType: string) {
    if (!NETWORK_ASSET_TYPES.has(assetType)) {
      throw new BadRequestException('Company asset type is invalid');
    }
    await this.assertEligibleTenant(auth.tenantId);
    await this.assertCanViewCompany(auth, peerTenantId);
    const file = await this.prisma.withTenant(peerTenantId, async (tx) => {
      const row = await tx.tenantCompanyAsset.findUnique({
        where: { tenantId_assetType: { tenantId: peerTenantId, assetType } },
        include: { file: true },
      });
      return row?.file ?? null;
    });
    if (!file || file.scanStatus !== 'clean' || file.quarantinedAt) {
      throw new NotFoundException('Company asset was not found');
    }
    return { buffer: readPrivateFile(file.storageKey), mediaType: file.mediaType };
  }

  private async assertCanViewCompany(auth: AuthState, peerTenantId: string) {
    await this.assertEligibleTenant(auth.tenantId);
    if (peerTenantId === auth.tenantId) {
      return;
    }
    const peer = await this.prisma.tenant.findUnique({
      where: { id: peerTenantId },
      select: { id: true, isSystem: true },
    });
    if (!peer || peer.isSystem) {
      throw new NotFoundException('Company was not found');
    }
    await this.prisma.withTenant(auth.tenantId, async (tx) => {
      const profile = await tx.companyNetworkProfile.findUnique({ where: { tenantId: peerTenantId } });
      if (!profile) {
        throw new NotFoundException('Company was not found');
      }
      const connection = await tx.companyConnection.findFirst({
        where: {
          OR: [
            { requesterTenantId: auth.tenantId, addresseeTenantId: peerTenantId },
            { requesterTenantId: peerTenantId, addresseeTenantId: auth.tenantId },
          ],
        },
      });
      const accepted = connection?.status === 'accepted';
      if (!this.canViewNetworkProfile(profile, accepted)) {
        throw new NotFoundException('Company was not found');
      }
    });
  }

  private canViewNetworkProfile(
    profile: { discoverable: boolean; visibility: string },
    accepted: boolean,
  ): boolean {
    return (
      (profile.discoverable && profile.visibility === 'public') ||
      (profile.visibility === 'connections' && accepted)
    );
  }

  async sendRequest(auth: AuthState, targetTenantId: string) {
    await this.assertEligibleTenant(auth.tenantId);
    if (!targetTenantId || targetTenantId === auth.tenantId) {
      throw new BadRequestException('Cannot connect to your own company');
    }
    const peer = await this.prisma.tenant.findUnique({
      where: { id: targetTenantId },
      select: { id: true, isSystem: true },
    });
    if (!peer || peer.isSystem) {
      throw new BadRequestException('Company cannot receive connection requests');
    }
    const [low, high] = orderedPair(auth.tenantId, targetTenantId);

    return this.prisma.withTenant(auth.tenantId, async (tx) => {
      const existing = await tx.companyConnection.findUnique({
        where: { tenantLowId_tenantHighId: { tenantLowId: low, tenantHighId: high } },
      });
      if (existing) {
        if (existing.status === 'accepted') {
          throw new ConflictException('Companies are already connected');
        }
        if (existing.status === 'pending') {
          throw new ConflictException('A connection request already exists');
        }
        if (existing.status === 'declined' || existing.status === 'cancelled' || existing.status === 'disconnected') {
          const updated = await tx.companyConnection.update({
            where: { id: existing.id },
            data: {
              requesterTenantId: auth.tenantId,
              addresseeTenantId: targetTenantId,
              status: 'pending',
              requestedByUserId: auth.userId,
              respondedByUserId: null,
              respondedAt: null,
            },
          });
          await tx.auditEvent.create({
            data: {
              tenantId: auth.tenantId,
              actorId: auth.userId,
              action: 'company_network.connect',
              targetType: 'company_connection',
              targetId: updated.id,
            },
          });
          return this.connectionDto(auth.tenantId, updated);
        }
      }

      try {
        const created = await tx.companyConnection.create({
          data: {
            requesterTenantId: auth.tenantId,
            addresseeTenantId: targetTenantId,
            tenantLowId: low,
            tenantHighId: high,
            status: 'pending',
            requestedByUserId: auth.userId,
          },
        });
        await tx.auditEvent.create({
          data: {
            tenantId: auth.tenantId,
            actorId: auth.userId,
            action: 'company_network.connect',
            targetType: 'company_connection',
            targetId: created.id,
          },
        });
        return this.connectionDto(auth.tenantId, created);
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          throw new ConflictException('A connection request already exists');
        }
        throw error;
      }
    });
  }

  async listConnections(auth: AuthState) {
    await this.assertEligibleTenant(auth.tenantId);
    return this.prisma.withTenant(auth.tenantId, async (tx) => {
      const rows = await tx.companyConnection.findMany({
        where: {
          status: 'accepted',
          OR: [{ requesterTenantId: auth.tenantId }, { addresseeTenantId: auth.tenantId }],
        },
        orderBy: { updatedAt: 'desc' },
      });
      return this.presentConnections(tx, auth.tenantId, rows);
    });
  }

  async listReceived(auth: AuthState) {
    await this.assertEligibleTenant(auth.tenantId);
    return this.prisma.withTenant(auth.tenantId, async (tx) => {
      const rows = await tx.companyConnection.findMany({
        where: { addresseeTenantId: auth.tenantId, status: 'pending' },
        orderBy: { createdAt: 'desc' },
      });
      return this.presentConnections(tx, auth.tenantId, rows);
    });
  }

  async listSent(auth: AuthState) {
    await this.assertEligibleTenant(auth.tenantId);
    return this.prisma.withTenant(auth.tenantId, async (tx) => {
      const rows = await tx.companyConnection.findMany({
        where: { requesterTenantId: auth.tenantId, status: 'pending' },
        orderBy: { createdAt: 'desc' },
      });
      return this.presentConnections(tx, auth.tenantId, rows);
    });
  }

  async accept(auth: AuthState, connectionId: string) {
    await this.assertEligibleTenant(auth.tenantId);
    return this.prisma.withTenant(auth.tenantId, async (tx) => {
      const connection = await tx.companyConnection.findUnique({ where: { id: connectionId } });
      if (!connection || connection.addresseeTenantId !== auth.tenantId) {
        throw new ForbiddenException('Only the recipient can accept this request');
      }
      if (connection.status !== 'pending') {
        throw new BadRequestException('Connection request is not pending');
      }
      const updated = await tx.companyConnection.update({
        where: { id: connectionId },
        data: {
          status: 'accepted',
          respondedByUserId: auth.userId,
          respondedAt: new Date(),
        },
      });
      await tx.companyConversation.upsert({
        where: { connectionId },
        create: {
          connectionId,
          tenantLowId: connection.tenantLowId,
          tenantHighId: connection.tenantHighId,
        },
        update: {},
      });
      await tx.auditEvent.create({
        data: {
          tenantId: auth.tenantId,
          actorId: auth.userId,
          action: 'company_network.accept',
          targetType: 'company_connection',
          targetId: connectionId,
        },
      });
      return this.connectionDto(auth.tenantId, updated);
    });
  }

  async decline(auth: AuthState, connectionId: string) {
    await this.assertEligibleTenant(auth.tenantId);
    return this.transitionAsAddressee(auth, connectionId, 'declined', 'company_network.decline');
  }

  async cancel(auth: AuthState, connectionId: string) {
    await this.assertEligibleTenant(auth.tenantId);
    return this.prisma.withTenant(auth.tenantId, async (tx) => {
      const connection = await tx.companyConnection.findUnique({ where: { id: connectionId } });
      if (!connection || connection.requesterTenantId !== auth.tenantId) {
        throw new ForbiddenException('Only the sender can cancel this request');
      }
      if (connection.status !== 'pending') {
        throw new BadRequestException('Connection request is not pending');
      }
      const updated = await tx.companyConnection.update({
        where: { id: connectionId },
        data: { status: 'cancelled', respondedByUserId: auth.userId, respondedAt: new Date() },
      });
      await tx.auditEvent.create({
        data: {
          tenantId: auth.tenantId,
          actorId: auth.userId,
          action: 'company_network.cancel',
          targetType: 'company_connection',
          targetId: connectionId,
        },
      });
      return this.connectionDto(auth.tenantId, updated);
    });
  }

  async disconnect(auth: AuthState, connectionId: string) {
    await this.assertEligibleTenant(auth.tenantId);
    return this.prisma.withTenant(auth.tenantId, async (tx) => {
      const connection = await tx.companyConnection.findUnique({ where: { id: connectionId } });
      if (
        !connection ||
        (connection.requesterTenantId !== auth.tenantId && connection.addresseeTenantId !== auth.tenantId)
      ) {
        throw new ForbiddenException('Not allowed to disconnect this relationship');
      }
      if (connection.status !== 'accepted') {
        throw new BadRequestException('Companies are not connected');
      }
      const updated = await tx.companyConnection.update({
        where: { id: connectionId },
        data: { status: 'disconnected', respondedByUserId: auth.userId, respondedAt: new Date() },
      });
      await tx.auditEvent.create({
        data: {
          tenantId: auth.tenantId,
          actorId: auth.userId,
          action: 'company_network.disconnect',
          targetType: 'company_connection',
          targetId: connectionId,
        },
      });
      return this.connectionDto(auth.tenantId, updated);
    });
  }

  async listConversations(auth: AuthState) {
    await this.assertEligibleTenant(auth.tenantId);
    return this.prisma.withTenant(auth.tenantId, async (tx) => {
      const conversations = await tx.companyConversation.findMany({
        where: {
          OR: [{ tenantLowId: auth.tenantId }, { tenantHighId: auth.tenantId }],
          connection: { status: 'accepted' },
        },
        include: {
          connection: true,
          messages: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
        orderBy: [{ lastMessageAt: 'desc' }, { updatedAt: 'desc' }],
      });
      const peerIds = conversations.map((c) =>
        c.tenantLowId === auth.tenantId ? c.tenantHighId : c.tenantLowId,
      );
      const tenants = await this.prisma.tenant.findMany({
        where: { id: { in: peerIds } },
        select: { id: true, name: true, displayName: true },
      });
      const tenantMap = new Map(tenants.map((t) => [t.id, t]));
      const unread = await tx.companyMessage.groupBy({
        by: ['conversationId'],
        where: {
          conversationId: { in: conversations.map((c) => c.id) },
          senderTenantId: { not: auth.tenantId },
          readAt: null,
        },
        _count: { _all: true },
      });
      const unreadMap = new Map(unread.map((row) => [row.conversationId, row._count._all]));

      return conversations.map((conversation) => {
        const peerId = conversation.tenantLowId === auth.tenantId ? conversation.tenantHighId : conversation.tenantLowId;
        const peer = tenantMap.get(peerId);
        const last = conversation.messages[0] ?? null;
        return {
          id: conversation.id,
          connectionId: conversation.connectionId,
          peerTenantId: peerId,
          peerName: peer ? peer.displayName || peer.name : 'Company',
          lastMessageAt: conversation.lastMessageAt,
          lastMessage: last
            ? {
                id: last.id,
                body: last.body,
                senderTenantId: last.senderTenantId,
                createdAt: last.createdAt,
              }
            : null,
          unreadCount: unreadMap.get(conversation.id) ?? 0,
        };
      });
    });
  }

  async listMessages(auth: AuthState, conversationId: string, query: { cursor?: string; limit?: string }) {
    await this.assertEligibleTenant(auth.tenantId);
    const limit = Math.min(PAGE_SIZE_MAX, Math.max(1, Number.parseInt(query.limit ?? '30', 10) || 30));
    return this.prisma.withTenant(auth.tenantId, async (tx) => {
      const conversation = await this.requireAcceptedConversation(tx, auth.tenantId, conversationId);
      const messages = await tx.companyMessage.findMany({
        where: {
          conversationId: conversation.id,
          ...(query.cursor ? { createdAt: { lt: new Date(query.cursor) } } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: limit + 1,
      });
      const hasMore = messages.length > limit;
      const page = hasMore ? messages.slice(0, limit) : messages;
      const users = await this.prisma.user.findMany({
        where: { id: { in: [...new Set(page.map((m) => m.senderUserId))] } },
        select: { id: true, displayName: true },
      });
      const userMap = new Map(users.map((u) => [u.id, u.displayName]));
      return {
        items: page.reverse().map((message) => ({
          id: message.id,
          body: message.body,
          senderTenantId: message.senderTenantId,
          senderUserId: message.senderUserId,
          senderName: userMap.get(message.senderUserId) ?? 'User',
          createdAt: message.createdAt,
          readAt: message.readAt,
          mine: message.senderTenantId === auth.tenantId,
        })),
        nextCursor: hasMore ? page[0]?.createdAt.toISOString() ?? null : null,
      };
    });
  }

  async sendMessage(auth: AuthState, body: { conversationId?: string; connectionId?: string; body?: string }) {
    await this.assertEligibleTenant(auth.tenantId);
    const text = typeof body?.body === 'string' ? body.body.trim() : '';
    if (!text) {
      throw new BadRequestException('Message body is required');
    }
    if (text.length > MAX_MESSAGE_LENGTH) {
      throw new BadRequestException('Message is too long');
    }

    const prepared = await this.prisma.withTenant(auth.tenantId, async (tx) => {
      let conversationId = typeof body.conversationId === 'string' ? body.conversationId : '';
      if (!conversationId && typeof body.connectionId === 'string') {
        const connection = await tx.companyConnection.findUnique({ where: { id: body.connectionId } });
        if (
          !connection ||
          connection.status !== 'accepted' ||
          (connection.requesterTenantId !== auth.tenantId && connection.addresseeTenantId !== auth.tenantId)
        ) {
          throw new ForbiddenException('Messaging requires an accepted connection');
        }
        const ensured = await tx.companyConversation.upsert({
          where: { connectionId: connection.id },
          create: {
            connectionId: connection.id,
            tenantLowId: connection.tenantLowId,
            tenantHighId: connection.tenantHighId,
          },
          update: {},
        });
        conversationId = ensured.id;
      }
      if (!conversationId) {
        throw new BadRequestException('Conversation is required');
      }
      const conversation = await this.requireAcceptedConversation(tx, auth.tenantId, conversationId);
      const peerId =
        conversation.tenantLowId === auth.tenantId ? conversation.tenantHighId : conversation.tenantLowId;
      const mine = await tx.companyNetworkProfile.findUnique({ where: { tenantId: auth.tenantId } });
      if (mine && !mine.messagingEnabled) {
        throw new ForbiddenException('Messaging is disabled for your company');
      }
      return { conversationId: conversation.id, peerId };
    });

    const peerMessagingEnabled = await this.prisma.withTenant(prepared.peerId, async (peerTx) => {
      const peer = await peerTx.companyNetworkProfile.findUnique({
        where: { tenantId: prepared.peerId },
        select: { messagingEnabled: true },
      });
      return peer?.messagingEnabled === true;
    });
    if (!peerMessagingEnabled) {
      throw new ForbiddenException('Messaging is disabled for this company');
    }

    return this.prisma.withTenant(auth.tenantId, async (tx) => {
      const conversation = await this.requireAcceptedConversation(tx, auth.tenantId, prepared.conversationId);
      const message = await tx.companyMessage.create({
        data: {
          conversationId: conversation.id,
          senderTenantId: auth.tenantId,
          senderUserId: auth.userId,
          body: text,
        },
      });
      await tx.companyConversation.update({
        where: { id: conversation.id },
        data: { lastMessageAt: message.createdAt },
      });
      await tx.auditEvent.create({
        data: {
          tenantId: auth.tenantId,
          actorId: auth.userId,
          action: 'company_network.message',
          targetType: 'company_message',
          targetId: message.id,
        },
      });
      return {
        id: message.id,
        conversationId: conversation.id,
        body: message.body,
        senderTenantId: message.senderTenantId,
        senderUserId: message.senderUserId,
        senderName: auth.displayName,
        createdAt: message.createdAt,
        readAt: message.readAt,
        mine: true,
      };
    });
  }

  async markRead(auth: AuthState, conversationId: string) {
    await this.assertEligibleTenant(auth.tenantId);
    return this.prisma.withTenant(auth.tenantId, async (tx) => {
      await this.requireAcceptedConversation(tx, auth.tenantId, conversationId);
      const result = await tx.companyMessage.updateMany({
        where: {
          conversationId,
          senderTenantId: { not: auth.tenantId },
          readAt: null,
        },
        data: { readAt: new Date() },
      });
      return { updated: result.count };
    });
  }

  async unreadCount(auth: AuthState) {
    await this.assertEligibleTenant(auth.tenantId);
    return this.prisma.withTenant(auth.tenantId, async (tx) => {
      const count = await tx.companyMessage.count({
        where: {
          senderTenantId: { not: auth.tenantId },
          readAt: null,
          conversation: {
            OR: [{ tenantLowId: auth.tenantId }, { tenantHighId: auth.tenantId }],
            connection: { status: 'accepted' },
          },
        },
      });
      return { count };
    });
  }

  private async transitionAsAddressee(
    auth: AuthState,
    connectionId: string,
    status: ConnectionStatus,
    action: string,
  ) {
    return this.prisma.withTenant(auth.tenantId, async (tx) => {
      const connection = await tx.companyConnection.findUnique({ where: { id: connectionId } });
      if (!connection || connection.addresseeTenantId !== auth.tenantId) {
        throw new ForbiddenException('Only the recipient can update this request');
      }
      if (connection.status !== 'pending') {
        throw new BadRequestException('Connection request is not pending');
      }
      const updated = await tx.companyConnection.update({
        where: { id: connectionId },
        data: { status, respondedByUserId: auth.userId, respondedAt: new Date() },
      });
      await tx.auditEvent.create({
        data: {
          tenantId: auth.tenantId,
          actorId: auth.userId,
          action,
          targetType: 'company_connection',
          targetId: connectionId,
        },
      });
      return this.connectionDto(auth.tenantId, updated);
    });
  }

  private async requireAcceptedConversation(tx: Tx, tenantId: string, conversationId: string) {
    const conversation = await tx.companyConversation.findUnique({
      where: { id: conversationId },
      include: { connection: true },
    });
    if (
      !conversation ||
      (conversation.tenantLowId !== tenantId && conversation.tenantHighId !== tenantId) ||
      conversation.connection.status !== 'accepted'
    ) {
      throw new ForbiddenException('Conversation is not available');
    }
    return conversation;
  }

  private async assertEligibleTenant(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { isSystem: true },
    });
    if (!tenant || tenant.isSystem) {
      throw new ForbiddenException('System tenants cannot use company networking');
    }
  }

  private async ensureProfile(tx: Tx, tenantId: string) {
    return tx.companyNetworkProfile.upsert({
      where: { tenantId },
      create: { tenantId },
      update: {},
    });
  }

  private async listNetworkAssets(tx: Tx, tenantId: string) {
    const assets = await tx.tenantCompanyAsset.findMany({
      where: { tenantId, assetType: { in: [...NETWORK_ASSET_TYPES] } },
      include: { file: { select: { scanStatus: true, quarantinedAt: true } } },
    });
    return assets
      .filter((asset) => asset.file.scanStatus === 'clean' && asset.file.quarantinedAt === null)
      .map((asset) => asset.assetType);
  }

  private async presentConnections(
    tx: Tx,
    viewerTenantId: string,
    rows: Array<{
      id: string;
      requesterTenantId: string;
      addresseeTenantId: string;
      status: string;
      createdAt: Date;
      updatedAt: Date;
      respondedAt: Date | null;
    }>,
  ) {
    const peerIds = rows.map((row) =>
      row.requesterTenantId === viewerTenantId ? row.addresseeTenantId : row.requesterTenantId,
    );
    const tenants = await this.prisma.tenant.findMany({
      where: { id: { in: peerIds } },
      select: { id: true, name: true, displayName: true },
    });
    const profiles = peerIds.length
      ? await tx.companyNetworkProfile.findMany({
          where: { tenantId: { in: peerIds } },
          select: { tenantId: true, headline: true, industry: true, city: true, country: true },
        })
      : [];
    const tenantMap = new Map(tenants.map((t) => [t.id, t]));
    const profileMap = new Map(profiles.map((p) => [p.tenantId, p]));
    return rows.map((row) => {
      const peerId = row.requesterTenantId === viewerTenantId ? row.addresseeTenantId : row.requesterTenantId;
      const peer = tenantMap.get(peerId);
      const profile = profileMap.get(peerId);
      return {
        ...this.connectionDto(viewerTenantId, row),
        peerTenantId: peerId,
        peerName: peer ? peer.displayName || peer.name : 'Company',
        headline: profile?.headline ?? '',
        industry: profile?.industry ?? '',
        city: profile?.city ?? '',
        country: profile?.country ?? '',
      };
    });
  }

  private connectionDto(
    viewerTenantId: string,
    row: {
      id: string;
      requesterTenantId: string;
      addresseeTenantId: string;
      status: string;
      createdAt: Date;
      updatedAt: Date;
      respondedAt: Date | null;
    },
  ) {
    return {
      id: row.id,
      status: row.status,
      direction: row.requesterTenantId === viewerTenantId ? 'outgoing' : 'incoming',
      requesterTenantId: row.requesterTenantId,
      addresseeTenantId: row.addresseeTenantId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      respondedAt: row.respondedAt,
      connectionStatus: this.connectionStatusForViewer(viewerTenantId, row),
    };
  }

  private connectionStatusForViewer(
    viewerTenantId: string,
    connection: { requesterTenantId: string; addresseeTenantId: string; status: string } | null,
  ): string {
    if (!connection) {
      return 'none';
    }
    if (connection.status === 'accepted') {
      return 'connected';
    }
    if (connection.status === 'pending') {
      return connection.requesterTenantId === viewerTenantId ? 'pending_outgoing' : 'pending_incoming';
    }
    return connection.status;
  }

  private parseProfileInput(body: Record<string, unknown>, partial: boolean) {
    if (!body || typeof body !== 'object') {
      throw new BadRequestException('Profile payload is required');
    }
    const data: Record<string, unknown> = {};
    const assignText = (key: string, max: number) => {
      if (body[key] === undefined) {
        if (!partial) {
          data[key] = '';
        }
        return;
      }
      data[key] = text(body[key], max);
    };
    assignText('headline', 160);
    assignText('introduction', 4000);
    assignText('industry', 120);
    assignText('city', 120);
    assignText('country', 120);
    assignText('website', 300);
    assignText('publicEmail', 200);
    assignText('publicPhone', 60);
    assignText('productsServices', 4000);
    assignText('capabilities', 4000);
    assignText('companySize', 80);

    if (body.businessCategories !== undefined) {
      const categories = body.businessCategories;
      if (Array.isArray(categories)) {
        data.businessCategories = categories.map((item) => String(item).trim()).filter(Boolean).slice(0, 20);
      } else if (typeof categories === 'string') {
        data.businessCategories = categories
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)
          .slice(0, 20);
      } else {
        throw new BadRequestException('Business categories are invalid');
      }
    }

    if (body.yearEstablished === null || body.yearEstablished === '') {
      data.yearEstablished = null;
    } else if (body.yearEstablished !== undefined) {
      const year = Number(body.yearEstablished);
      if (!Number.isInteger(year) || year < 1800 || year > new Date().getFullYear() + 1) {
        throw new BadRequestException('Year established is invalid');
      }
      data.yearEstablished = year;
    }
    return data;
  }

  private toOwnDto(
    profile: {
      id: string;
      tenantId: string;
      headline: string;
      introduction: string;
      industry: string;
      businessCategories: Prisma.JsonValue;
      city: string;
      country: string;
      website: string;
      publicEmail: string;
      publicPhone: string;
      productsServices: string;
      capabilities: string;
      companySize: string;
      yearEstablished: number | null;
      discoverable: boolean;
      visibility: string;
      messagingEnabled: boolean;
      updatedAt: Date;
    },
    tenant: { id: string; name: string; displayName: string; isSystem: boolean },
  ) {
    return {
      tenantId: tenant.id,
      companyName: tenant.displayName || tenant.name,
      legalName: tenant.name,
      headline: profile.headline,
      introduction: profile.introduction,
      industry: profile.industry,
      businessCategories: asStringArray(profile.businessCategories),
      city: profile.city,
      country: profile.country,
      website: profile.website,
      publicEmail: profile.publicEmail,
      publicPhone: profile.publicPhone,
      productsServices: profile.productsServices,
      capabilities: profile.capabilities,
      companySize: profile.companySize,
      yearEstablished: profile.yearEstablished,
      discoverable: profile.discoverable,
      visibility: profile.visibility,
      messagingEnabled: profile.messagingEnabled,
      updatedAt: profile.updatedAt,
    };
  }

  private toPublicDto(
    profile: {
      tenantId: string;
      headline: string;
      introduction: string;
      industry: string;
      businessCategories: Prisma.JsonValue;
      city: string;
      country: string;
      website: string;
      publicEmail: string;
      publicPhone: string;
      productsServices: string;
      capabilities: string;
      companySize: string;
      yearEstablished: number | null;
      visibility: string;
      messagingEnabled: boolean;
    },
    tenant: { id: string; name: string; displayName: string },
  ) {
    return {
      tenantId: tenant.id,
      companyName: tenant.displayName || tenant.name,
      headline: profile.headline,
      introduction: profile.introduction,
      industry: profile.industry,
      businessCategories: asStringArray(profile.businessCategories),
      city: profile.city,
      country: profile.country,
      website: profile.website,
      publicEmail: profile.publicEmail,
      publicPhone: profile.publicPhone,
      productsServices: profile.productsServices,
      capabilities: profile.capabilities,
      companySize: profile.companySize,
      yearEstablished: profile.yearEstablished,
      visibility: profile.visibility,
      messagingEnabled: profile.messagingEnabled,
    };
  }

  private completion(
    profile: {
      headline: string;
      introduction: string;
      industry: string;
      city: string;
      country: string;
      website: string;
      productsServices: string;
    },
    companyName: string,
  ) {
    const checks = [
      Boolean(companyName.trim()),
      Boolean(profile.headline.trim()),
      Boolean(profile.introduction.trim()),
      Boolean(profile.industry.trim()),
      Boolean(profile.city.trim() && profile.country.trim()),
      Boolean(profile.website.trim()),
      Boolean(profile.productsServices.trim()),
    ];
    const done = checks.filter(Boolean).length;
    return { done, total: checks.length, percent: Math.round((done / checks.length) * 100) };
  }
}

function orderedPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

function text(value: unknown, max: number): string {
  if (value === undefined) {
    return '';
  }
  if (typeof value !== 'string') {
    throw new BadRequestException('Invalid text field');
  }
  return value.trim().slice(0, max);
}

function asStringArray(value: Prisma.JsonValue): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => String(item)).filter(Boolean);
}
