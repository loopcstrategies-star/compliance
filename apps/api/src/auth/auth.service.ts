import {
  Injectable,
  Logger,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { verify } from 'argon2';
import { hashPassword } from './password';
import * as OTPAuth from 'otpauth';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { decryptSecret, encryptSecret, hashToken } from '../crypto/secrets';
import { redact } from '../common/redact';
import { PRIVILEGED_ROLES, SESSION_COOKIE, SESSION_TTL_MS } from '../domain';
import type { AuthState } from './auth.types';
const WINDOW_MS = 60_000;
const MAX_ATTEMPTS = 10;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly attempts = new Map<string, number[]>();

  constructor(private readonly prisma: PrismaService) {}

  async login(
    email: string,
    password: string,
    requestedTenantId: string | undefined,
    res: Response,
  ): Promise<{ mfaRequired: boolean }> {
    const normalized = email.trim().toLowerCase();
    this.assertWithinRateLimit(normalized);
    const user = await this.prisma.withEmailLookup(normalized, (tx) =>
      tx.user.findUnique({ where: { email: normalized } }),
    );
    const passwordOk = user ? await verify(user.passwordHash, password) : false;
    if (!user || !passwordOk) {
      this.logger.log(JSON.stringify(redact({ email: normalized, password, outcome: 'denied' })));
      throw new UnauthorizedException('Invalid email or password');
    }
    if (requestedTenantId && requestedTenantId !== user.tenantId) {
      this.logger.log(JSON.stringify(redact({ email: normalized, outcome: 'tenant_mismatch' })));
      throw new ForbiddenException('Tenant mismatch');
    }

    const raw = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    await this.prisma.withTenant(user.tenantId, (tx) =>
      tx.session.create({
        data: {
          tenantId: user.tenantId,
          userId: user.id,
          tokenHash: hashToken(raw),
          expiresAt,
          mfaSatisfied: true,
        },
      }),
    );
    this.setCookie(res, raw, expiresAt);
    this.logger.log(JSON.stringify(redact({ userId: user.id, outcome: 'session_created' })));
    return { mfaRequired: false };
  }

  async confirmMfa(auth: AuthState, code: string): Promise<{ mfaSatisfied: true }> {
    const normalized = code.trim();
    if (!/^\d{6}$/.test(normalized)) {
      throw new BadRequestException('Enter the 6-digit code from your authenticator.');
    }
    this.assertWithinRateLimit(`mfa:${auth.userId}`);
    const user = await this.prisma.withTenant(auth.tenantId, (tx) =>
      tx.user.findUnique({ where: { id: auth.userId } }),
    );
    if (!user?.mfaSecret) {
      throw new ForbiddenException('MFA is not enrolled');
    }
    let secret: OTPAuth.Secret;
    try {
      secret = OTPAuth.Secret.fromBase32(decryptSecret(user.mfaSecret));
    } catch {
      throw new UnauthorizedException('The authenticator enrollment cannot be read. Recover this account before trying again.');
    }
    const totp = new OTPAuth.TOTP({
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret,
    });
    if (totp.validate({ token: normalized, window: 1 }) === null) {
      throw new UnauthorizedException('That code is wrong or outside the 30-second clock-drift window.');
    }
    await this.prisma.withTenant(auth.tenantId, async (tx) => {
      await tx.session.update({ where: { id: auth.sessionId }, data: { mfaSatisfied: true } });
      if (!user.mfaEnrolledAt) {
        await tx.user.update({ where: { id: user.id }, data: { mfaEnrolledAt: new Date() } });
      }
    });
    return { mfaSatisfied: true };
  }

  async setupMfa(auth: AuthState): Promise<{ otpauthUri: string }> {
    if (!auth.privileged) {
      throw new NotFoundException('Not found');
    }
    return this.prisma.withTenant(auth.tenantId, async (tx) => {
      const user = await tx.user.findFirst({ where: { id: auth.userId, tenantId: auth.tenantId } });
      if (!user || user.mfaEnrolledAt) {
        throw new NotFoundException('Not found');
      }
      let plain = user.mfaSecret ? decryptSecret(user.mfaSecret) : new OTPAuth.Secret({ size: 20 }).base32;
      if (!user.mfaSecret) {
        const saved = await tx.user.updateMany({
          where: { id: user.id, mfaSecret: null },
          data: { mfaSecret: encryptSecret(plain) },
        });
        if (saved.count === 0) {
          const current = await tx.user.findFirst({ where: { id: user.id, tenantId: auth.tenantId } });
          if (!current?.mfaSecret) {
            throw new NotFoundException('Not found');
          }
          plain = decryptSecret(current.mfaSecret);
        }
      }
      const totp = new OTPAuth.TOTP({
        issuer: 'LoopC',
        label: user.email,
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        secret: OTPAuth.Secret.fromBase32(plain),
      });
      return { otpauthUri: totp.toString() };
    });
  }

  async logout(auth: AuthState | null, res: Response): Promise<void> {
    if (auth) {
      await this.prisma.withTenant(auth.tenantId, (tx) =>
        tx.session.update({ where: { id: auth.sessionId }, data: { revokedAt: new Date() } }),
      );
    }
    res.clearCookie(SESSION_COOKIE, { path: '/' });
  }

  async fromCookie(raw: string): Promise<AuthState | null> {
    const tokenHash = hashToken(raw);
    const session = await this.prisma.withSessionLookup(tokenHash, (tx) =>
      tx.session.findUnique({ where: { tokenHash } }),
    );
    if (!session || session.revokedAt || session.expiresAt.getTime() <= Date.now()) {
      return null;
    }
    return this.loadProfile(session.userId, session.tenantId, session);
  }

  private async loadProfile(
    userId: string,
    tenantId: string,
    session?: { id: string; mfaSatisfied: boolean },
  ): Promise<AuthState> {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const user = await tx.user.findFirst({
        where: { id: userId, tenantId },
        include: {
          roles: {
            include: {
              role: { include: { permissions: { include: { permission: true } } } },
            },
          },
        },
      });
      if (!user) {
        throw new UnauthorizedException();
      }
      const roles = user.roles.map((row) => row.role.key);
      const permissions = [
        ...new Set(user.roles.flatMap((row) => row.role.permissions.map((item) => item.permission.key))),
      ];
      return {
        sessionId: session?.id ?? '',
        userId: user.id,
        tenantId: user.tenantId,
        email: user.email,
        displayName: user.displayName,
        roles,
        permissions,
        mfaSatisfied: session?.mfaSatisfied ?? false,
        mfaEnrolled: Boolean(user.mfaEnrolledAt),
        privileged: roles.some((role) => PRIVILEGED_ROLES.has(role)),
      };
    });
  }

  async startSession(userId: string, tenantId: string, res: Response): Promise<void> {
    const raw = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    await this.prisma.withTenant(tenantId, (tx) =>
      tx.session.create({
        data: {
          tenantId,
          userId,
          tokenHash: hashToken(raw),
          expiresAt,
          mfaSatisfied: true,
        },
      }),
    );
    this.setCookie(res, raw, expiresAt);
  }

  private setCookie(res: Response, raw: string, expiresAt: Date): void {
    res.cookie(SESSION_COOKIE, raw, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.COOKIE_SECURE === 'true',
      path: '/',
      expires: expiresAt,
    });
  }

  private assertWithinRateLimit(email: string): void {
    const now = Date.now();
    const recent = (this.attempts.get(email) ?? []).filter((at) => now - at < WINDOW_MS);
    if (recent.length >= MAX_ATTEMPTS) {
      const retryAfterSeconds = Math.max(1, Math.ceil((WINDOW_MS - (now - recent[0])) / 1000));
      const message = email.startsWith('mfa:')
        ? 'Too many verification attempts. Wait a minute and try again.'
        : 'Too many login attempts';
      throw new HttpException({ message, retryAfterSeconds }, HttpStatus.TOO_MANY_REQUESTS);
    }
    recent.push(now);
    this.attempts.set(email, recent);
  }
}

export { hashPassword };
