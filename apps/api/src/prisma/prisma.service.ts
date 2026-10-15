import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { requireTenantContext } from '../tenant/tenant-context';

export type Tx = Prisma.TransactionClient;

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      datasources: { db: { url: process.env.APP_DATABASE_URL } },
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
    } catch (error) {
      const code = error instanceof Prisma.PrismaClientInitializationError ? error.errorCode : undefined;
      console.error(code ? `Application database connection failed (${code})` : 'Application database connection failed');
      throw error;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  async withTenant<T>(tenantId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
    const tenant = requireTenantContext(tenantId);
    return this.$transaction(async (tx) => {
      await applySettings(tx, { tenantId: tenant });
      return fn(tx);
    });
  }

  async withEmailLookup<T>(email: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
    return this.$transaction(async (tx) => {
      await applySettings(tx, { lookupEmail: email });
      return fn(tx);
    });
  }

  async withSessionLookup<T>(tokenHash: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
    return this.$transaction(async (tx) => {
      await applySettings(tx, { sessionLookup: tokenHash });
      return fn(tx);
    });
  }

  async withInvitationLookup<T>(tokenHash: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
    return this.$transaction(async (tx) => {
      await applySettings(tx, { invitationLookup: tokenHash });
      return fn(tx);
    });
  }

  async withGrantLookup<T>(tokenHash: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
    return this.$transaction(async (tx) => {
      await applySettings(tx, { grantLookup: tokenHash });
      return fn(tx);
    });
  }
}

async function applySettings(
  tx: Tx,
  settings: { tenantId?: string; lookupEmail?: string; sessionLookup?: string; invitationLookup?: string; grantLookup?: string },
): Promise<void> {
  await tx.$executeRaw`SELECT set_config('app.tenant_id', ${settings.tenantId ?? ''}, true)`;
  await tx.$executeRaw`SELECT set_config('app.lookup_email', ${settings.lookupEmail ?? ''}, true)`;
  await tx.$executeRaw`SELECT set_config('app.session_lookup', ${settings.sessionLookup ?? ''}, true)`;
  await tx.$executeRaw`SELECT set_config('app.invitation_lookup', ${settings.invitationLookup ?? ''}, true)`;
  await tx.$executeRaw`SELECT set_config('app.grant_lookup', ${settings.grantLookup ?? ''}, true)`;
}
