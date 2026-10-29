import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AuthState } from '../auth/auth.types';
import { FileService } from '../files/file.service';
import { PrismaService, type Tx } from '../prisma/prisma.service';

const POST_TYPES = new Set(['announcement', 'news', 'product', 'event']);
const MAX_POST = 4000;
const MAX_COMMENT = 2000;
const PAGE_DEFAULT = 20;
const PAGE_MAX = 50;

@Injectable()
export class CompanyNetworkSocialService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly files: FileService,
  ) {}

  async getMyMemberProfile(auth: AuthState) {
    await this.assertEligible(auth.tenantId);
    return this.prisma.withTenant(auth.tenantId, async (tx) => {
      const profile = await this.ensureMember(tx, auth.tenantId, auth.userId);
      return this.memberDto(profile, {
        id: auth.userId,
        displayName: auth.displayName,
        email: auth.email,
      });
    });
  }

  async updateMyMemberProfile(auth: AuthState, body: Record<string, unknown>) {
    await this.assertEligible(auth.tenantId);
    return this.prisma.withTenant(auth.tenantId, async (tx) => {
      await this.ensureMember(tx, auth.tenantId, auth.userId);
      const data: Prisma.MemberNetworkProfileUpdateInput = {};
      for (const key of ['jobTitle', 'department', 'introduction'] as const) {
        if (body[key] !== undefined) {
          if (typeof body[key] !== 'string') {
            throw new BadRequestException(`${key} is invalid`);
          }
          data[key] = body[key].trim().slice(0, key === 'introduction' ? 2000 : 160);
        }
      }
      for (const key of ['notifyMessages', 'notifyConnections', 'notifyFeed'] as const) {
        if (typeof body[key] === 'boolean') {
          data[key] = body[key];
        }
      }
      const profile = await tx.memberNetworkProfile.update({
        where: { userId_tenantId: { userId: auth.userId, tenantId: auth.tenantId } },
        data,
      });
      return this.memberDto(profile, {
        id: auth.userId,
        displayName: auth.displayName,
        email: auth.email,
      });
    });
  }

  async uploadMemberPhoto(auth: AuthState, bytes: Buffer) {
    await this.assertEligible(auth.tenantId);
    const stored = await this.files.store(auth.tenantId, bytes, 'image');
    return this.prisma.withTenant(auth.tenantId, async (tx) => {
      await this.ensureMember(tx, auth.tenantId, auth.userId);
      const profile = await tx.memberNetworkProfile.update({
        where: { userId_tenantId: { userId: auth.userId, tenantId: auth.tenantId } },
        data: { photoFileId: stored.id },
      });
      return { photoFileId: profile.photoFileId, mediaType: stored.mediaType };
    });
  }

  async listOwnMembers(auth: AuthState) {
    await this.assertEligible(auth.tenantId);
    return this.prisma.withTenant(auth.tenantId, async (tx) => {
      const users = await tx.user.findMany({
        where: { tenantId: auth.tenantId },
        select: { id: true, displayName: true, email: true },
        orderBy: { displayName: 'asc' },
      });
      const profiles = await tx.memberNetworkProfile.findMany({
        where: { tenantId: auth.tenantId },
      });
      const map = new Map(profiles.map((p) => [p.userId, p]));
      return users.map((user) => {
        const profile = map.get(user.id);
        return {
          userId: user.id,
          displayName: user.displayName,
          email: user.email,
          jobTitle: profile?.jobTitle ?? '',
          department: profile?.department ?? '',
          introduction: profile?.introduction ?? '',
          hasPhoto: Boolean(profile?.photoFileId),
        };
      });
    });
  }

  async listCompanyMembers(auth: AuthState, peerTenantId: string) {
    await this.assertEligible(auth.tenantId);
    await this.assertCanViewCompany(auth, peerTenantId);
    return this.prisma.withTenant(auth.tenantId, async (tx) => {
      const profiles = await tx.memberNetworkProfile.findMany({
        where: { tenantId: peerTenantId },
        take: 50,
      });
      const users = await tx.user.findMany({
        where: { id: { in: profiles.map((p) => p.userId) } },
        select: { id: true, displayName: true },
      });
      const userMap = new Map(users.map((u) => [u.id, u]));
      return profiles
        .map((profile) => {
          const user = userMap.get(profile.userId);
          if (!user) {
            return {
              userId: profile.userId,
              displayName: 'Member',
              jobTitle: profile.jobTitle,
              department: profile.department,
              introduction: profile.introduction,
              hasPhoto: Boolean(profile.photoFileId),
            };
          }
          return {
            userId: profile.userId,
            displayName: user.displayName,
            jobTitle: profile.jobTitle,
            department: profile.department,
            introduction: profile.introduction,
            hasPhoto: Boolean(profile.photoFileId),
          };
        });
    });
  }

  async listFeed(auth: AuthState, query: { page?: string; pageSize?: string; tenantId?: string }) {
    await this.assertEligible(auth.tenantId);
    const page = Math.max(1, Number.parseInt(query.page ?? '1', 10) || 1);
    const pageSize = Math.min(PAGE_MAX, Math.max(1, Number.parseInt(query.pageSize ?? String(PAGE_DEFAULT), 10) || PAGE_DEFAULT));
    const filterTenant = typeof query.tenantId === 'string' ? query.tenantId.trim() : '';

    return this.prisma.withTenant(auth.tenantId, async (tx) => {
      const where: Prisma.CompanyPostWhereInput = {
        deletedAt: null,
        ...(filterTenant ? { tenantId: filterTenant } : {}),
      };
      const total = await tx.companyPost.count({ where });
      const posts = await tx.companyPost.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          _count: { select: { comments: true, reactions: true } },
        },
      });
      return {
        items: await this.presentPosts(tx, auth, posts),
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize) || 1),
      };
    });
  }

  async createPost(auth: AuthState, body: { body?: string; postType?: string }) {
    await this.assertEligible(auth.tenantId);
    const text = typeof body?.body === 'string' ? body.body.trim() : '';
    if (!text) {
      throw new BadRequestException('Post body is required');
    }
    if (text.length > MAX_POST) {
      throw new BadRequestException('Post is too long');
    }
    const postType = typeof body?.postType === 'string' ? body.postType : 'announcement';
    if (!POST_TYPES.has(postType)) {
      throw new BadRequestException('Post type is invalid');
    }
    return this.prisma.withTenant(auth.tenantId, async (tx) => {
      const post = await tx.companyPost.create({
        data: {
          tenantId: auth.tenantId,
          authorUserId: auth.userId,
          body: text,
          postType,
        },
        include: { _count: { select: { comments: true, reactions: true } } },
      });
      await tx.auditEvent.create({
        data: {
          tenantId: auth.tenantId,
          actorId: auth.userId,
          action: 'company_network.post.create',
          targetType: 'company_post',
          targetId: post.id,
        },
      });
      const items = await this.presentPosts(tx, auth, [post]);
      return items[0];
    });
  }

  async updatePost(auth: AuthState, postId: string, body: { body?: string; postType?: string }) {
    await this.assertEligible(auth.tenantId);
    return this.prisma.withTenant(auth.tenantId, async (tx) => {
      const existing = await tx.companyPost.findUnique({ where: { id: postId } });
      if (!existing || existing.deletedAt || existing.tenantId !== auth.tenantId) {
        throw new NotFoundException('Post was not found');
      }
      if (existing.authorUserId !== auth.userId) {
        throw new ForbiddenException('Only the author can edit this post');
      }
      const data: Prisma.CompanyPostUpdateInput = {};
      if (body?.body !== undefined) {
        if (typeof body.body !== 'string' || !body.body.trim()) {
          throw new BadRequestException('Post body is required');
        }
        data.body = body.body.trim().slice(0, MAX_POST);
      }
      if (body?.postType !== undefined) {
        if (!POST_TYPES.has(body.postType)) {
          throw new BadRequestException('Post type is invalid');
        }
        data.postType = body.postType;
      }
      const post = await tx.companyPost.update({
        where: { id: postId },
        data,
        include: { _count: { select: { comments: true, reactions: true } } },
      });
      const items = await this.presentPosts(tx, auth, [post]);
      return items[0];
    });
  }

  async deletePost(auth: AuthState, postId: string) {
    await this.assertEligible(auth.tenantId);
    return this.prisma.withTenant(auth.tenantId, async (tx) => {
      const existing = await tx.companyPost.findUnique({ where: { id: postId } });
      if (!existing || existing.deletedAt || existing.tenantId !== auth.tenantId) {
        throw new NotFoundException('Post was not found');
      }
      if (existing.authorUserId !== auth.userId) {
        throw new ForbiddenException('Only the author can delete this post');
      }
      await tx.companyPost.update({ where: { id: postId }, data: { deletedAt: new Date() } });
      return { id: postId, deleted: true };
    });
  }

  async addComment(auth: AuthState, postId: string, body: { body?: string }) {
    await this.assertEligible(auth.tenantId);
    const text = typeof body?.body === 'string' ? body.body.trim() : '';
    if (!text) {
      throw new BadRequestException('Comment body is required');
    }
    if (text.length > MAX_COMMENT) {
      throw new BadRequestException('Comment is too long');
    }
    const result = await this.prisma.withTenant(auth.tenantId, async (tx) => {
      const post = await tx.companyPost.findUnique({ where: { id: postId } });
      if (!post || post.deletedAt) {
        throw new NotFoundException('Post was not found');
      }
      const comment = await tx.companyPostComment.create({
        data: {
          postId,
          authorTenantId: auth.tenantId,
          authorUserId: auth.userId,
          body: text,
        },
      });
      return { comment, post };
    });
    if (result.post.authorUserId !== auth.userId) {
      await this.notifyUsers(
        result.post.tenantId,
        [result.post.authorUserId],
        'feed_comment',
        {
          postId,
          fromTenantId: auth.tenantId,
          fromUserId: auth.userId,
          preview: text.slice(0, 120),
        },
        'feed',
      );
    }
    const user = await this.prisma.user.findUnique({
      where: { id: auth.userId },
      select: { displayName: true },
    });
    return {
      id: result.comment.id,
      postId,
      body: result.comment.body,
      authorUserId: auth.userId,
      authorName: user?.displayName ?? 'User',
      authorTenantId: auth.tenantId,
      createdAt: result.comment.createdAt,
    };
  }

  async toggleReaction(auth: AuthState, postId: string, body: { reactionType?: string }) {
    await this.assertEligible(auth.tenantId);
    const reactionType = typeof body?.reactionType === 'string' ? body.reactionType : 'like';
    return this.prisma.withTenant(auth.tenantId, async (tx) => {
      const post = await tx.companyPost.findUnique({ where: { id: postId } });
      if (!post || post.deletedAt) {
        throw new NotFoundException('Post was not found');
      }
      const existing = await tx.companyPostReaction.findUnique({
        where: {
          postId_actorTenantId_actorUserId: {
            postId,
            actorTenantId: auth.tenantId,
            actorUserId: auth.userId,
          },
        },
      });
      if (existing) {
        await tx.companyPostReaction.delete({ where: { id: existing.id } });
        return { postId, reacted: false, reactionType: existing.reactionType };
      }
      await tx.companyPostReaction.create({
        data: {
          postId,
          actorTenantId: auth.tenantId,
          actorUserId: auth.userId,
          reactionType,
        },
      });
      return { postId, reacted: true, reactionType };
    });
  }

  async listNotifications(auth: AuthState, query: { page?: string; pageSize?: string }) {
    await this.assertEligible(auth.tenantId);
    const page = Math.max(1, Number.parseInt(query.page ?? '1', 10) || 1);
    const pageSize = Math.min(PAGE_MAX, Math.max(1, Number.parseInt(query.pageSize ?? '20', 10) || 20));
    return this.prisma.withTenant(auth.tenantId, async (tx) => {
      const where = { recipientTenantId: auth.tenantId, recipientUserId: auth.userId };
      const total = await tx.companyNotification.count({ where });
      const items = await tx.companyNotification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      });
      return {
        items: items.map((row) => ({
          id: row.id,
          type: row.type,
          payload: row.payload,
          readAt: row.readAt,
          createdAt: row.createdAt,
        })),
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize) || 1),
      };
    });
  }

  async unreadNotificationCount(auth: AuthState) {
    await this.assertEligible(auth.tenantId);
    return this.prisma.withTenant(auth.tenantId, async (tx) => {
      const count = await tx.companyNotification.count({
        where: { recipientTenantId: auth.tenantId, recipientUserId: auth.userId, readAt: null },
      });
      return { count };
    });
  }

  async markNotificationsRead(auth: AuthState, body: { ids?: string[]; all?: boolean }) {
    await this.assertEligible(auth.tenantId);
    return this.prisma.withTenant(auth.tenantId, async (tx) => {
      const where: Prisma.CompanyNotificationWhereInput = {
        recipientTenantId: auth.tenantId,
        recipientUserId: auth.userId,
        readAt: null,
        ...(body?.all
          ? {}
          : {
              id: {
                in: Array.isArray(body?.ids) ? body.ids.filter((id) => typeof id === 'string') : [],
              },
            }),
      };
      if (!body?.all && (!Array.isArray(body?.ids) || body.ids.length === 0)) {
        throw new BadRequestException('Notification ids are required');
      }
      const result = await tx.companyNotification.updateMany({
        where,
        data: { readAt: new Date() },
      });
      return { updated: result.count };
    });
  }

  /** Notify staff users in a tenant (respects member notify prefs when profile exists). */
  async notifyUsers(
    recipientTenantId: string,
    userIds: string[] | 'all-staff',
    type: string,
    payload: Record<string, unknown>,
    channel: 'messages' | 'connections' | 'feed' = 'connections',
  ) {
    await this.prisma.withTenant(recipientTenantId, async (tx) => {
      const users =
        userIds === 'all-staff'
          ? await tx.user.findMany({
              where: {
                tenantId: recipientTenantId,
                roles: {
                  some: {
                    role: { key: { in: ['employee', 'maker', 'checker', 'authorised_approver', 'super_admin'] } },
                  },
                },
              },
              select: { id: true },
            })
          : userIds.map((id) => ({ id }));

      if (users.length === 0) {
        return;
      }

      const profiles = await tx.memberNetworkProfile.findMany({
        where: { tenantId: recipientTenantId, userId: { in: users.map((u) => u.id) } },
      });
      const prefs = new Map(profiles.map((p) => [p.userId, p]));
      const rows = users
        .filter((user) => {
          const pref = prefs.get(user.id);
          if (!pref) {
            return true;
          }
          if (channel === 'messages') {
            return pref.notifyMessages;
          }
          if (channel === 'feed') {
            return pref.notifyFeed;
          }
          return pref.notifyConnections;
        })
        .map((user) => ({
          recipientTenantId,
          recipientUserId: user.id,
          type,
          payload: payload as Prisma.InputJsonValue,
        }));
      if (rows.length) {
        await tx.companyNotification.createMany({ data: rows });
      }
    });
  }

  private async presentPosts(
    tx: Tx,
    auth: AuthState,
    posts: Array<{
      id: string;
      tenantId: string;
      authorUserId: string;
      body: string;
      postType: string;
      createdAt: Date;
      updatedAt: Date;
      _count: { comments: number; reactions: number };
    }>,
  ) {
    const tenantIds = [...new Set(posts.map((p) => p.tenantId))];
    const userIds = [...new Set(posts.map((p) => p.authorUserId))];
    const tenants = await this.prisma.tenant.findMany({
      where: { id: { in: tenantIds } },
      select: { id: true, name: true, displayName: true },
    });
    const users = await tx.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, displayName: true },
    });
    const myReactions = await tx.companyPostReaction.findMany({
      where: {
        postId: { in: posts.map((p) => p.id) },
        actorTenantId: auth.tenantId,
        actorUserId: auth.userId,
      },
    });
    const reacted = new Set(myReactions.map((r) => r.postId));
    const tenantMap = new Map(tenants.map((t) => [t.id, t]));
    const userMap = new Map(users.map((u) => [u.id, u]));
    return posts.map((post) => {
      const tenant = tenantMap.get(post.tenantId);
      const author = userMap.get(post.authorUserId);
      return {
        id: post.id,
        tenantId: post.tenantId,
        companyName: tenant ? tenant.displayName || tenant.name : 'Company',
        authorUserId: post.authorUserId,
        authorName:
          author?.displayName ??
          (post.authorUserId === auth.userId ? auth.displayName : 'User'),
        body: post.body,
        postType: post.postType,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt,
        commentCount: post._count.comments,
        reactionCount: post._count.reactions,
        reactedByMe: reacted.has(post.id),
        canEdit: post.tenantId === auth.tenantId && post.authorUserId === auth.userId,
      };
    });
  }

  private async ensureMember(tx: Tx, tenantId: string, userId: string) {
    return tx.memberNetworkProfile.upsert({
      where: { userId_tenantId: { userId, tenantId } },
      create: { tenantId, userId },
      update: {},
    });
  }

  private memberDto(
    profile: {
      jobTitle: string;
      department: string;
      introduction: string;
      photoFileId: string | null;
      notifyMessages: boolean;
      notifyConnections: boolean;
      notifyFeed: boolean;
    },
    user: { id: string; displayName: string; email: string },
  ) {
    return {
      userId: user.id,
      displayName: user.displayName,
      email: user.email,
      jobTitle: profile.jobTitle,
      department: profile.department,
      introduction: profile.introduction,
      hasPhoto: Boolean(profile.photoFileId),
      notifyMessages: profile.notifyMessages,
      notifyConnections: profile.notifyConnections,
      notifyFeed: profile.notifyFeed,
    };
  }

  private async assertEligible(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { isSystem: true },
    });
    if (!tenant || tenant.isSystem) {
      throw new ForbiddenException('System tenants cannot use company networking');
    }
  }

  private async assertCanViewCompany(auth: AuthState, peerTenantId: string) {
    if (peerTenantId === auth.tenantId) {
      return;
    }
    await this.prisma.withTenant(auth.tenantId, async (tx) => {
      const profile = await tx.companyNetworkProfile.findUnique({ where: { tenantId: peerTenantId } });
      if (!profile) {
        throw new NotFoundException('Company was not found');
      }
      const connection = await tx.companyConnection.findFirst({
        where: {
          status: 'accepted',
          OR: [
            { requesterTenantId: auth.tenantId, addresseeTenantId: peerTenantId },
            { requesterTenantId: peerTenantId, addresseeTenantId: auth.tenantId },
          ],
        },
      });
      const ok =
        (profile.discoverable && profile.visibility === 'public') ||
        (profile.visibility === 'connections' && Boolean(connection));
      if (!ok) {
        throw new NotFoundException('Company was not found');
      }
    });
  }
}
