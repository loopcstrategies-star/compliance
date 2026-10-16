import { ForbiddenException, Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService, type Tx } from '../prisma/prisma.service';
import type { AuthState } from '../auth/auth.types';
import { redact } from '../common/redact';
import { assertUpload, readPrivateFile, writePrivateFile, type AllowedKind } from './storage';

const IDENTITY_DOCUMENT_KEYS = new Set(['kyc.docs.8', 'kyc.docs.9', 'kyc.docs.10', 'kyc.docs.11']);

@Injectable()
export class FileService {
  private readonly logger = new Logger(FileService.name);

  constructor(private readonly prisma: PrismaService) {}

  async store(tenantId: string, bytes: Buffer, kind: AllowedKind) {
    const mediaType = assertUpload(bytes, kind);
    const written = writePrivateFile(bytes);
    const file = await this.prisma.withTenant(tenantId, (tx) =>
      tx.storedFile.create({
        data: {
          tenantId,
          storageKey: written.storageKey,
          mediaType,
          byteSize: bytes.length,
          sha256: written.sha256,
          scanStatus: 'clean',
        },
      }),
    );
    this.logger.log(JSON.stringify(redact({ fileId: file.id, outcome: 'stored' })));
    return file;
  }

  async storeGenerated(tenantId: string, bytes: Buffer) {
    const written = writePrivateFile(bytes);
    return this.prisma.withTenant(tenantId, (tx) =>
      tx.storedFile.create({
        data: {
          tenantId,
          storageKey: written.storageKey,
          mediaType: 'application/pdf',
          byteSize: bytes.length,
          sha256: written.sha256,
          scanStatus: 'clean',
        },
      }),
    );
  }

  async download(auth: AuthState, fileId: string, purpose?: string) {
    if (auth.roles.includes('customer')) {
      if (!auth.permissions.includes('document.read')) {
        throw new ForbiddenException();
      }
      const file = await this.loadClean(auth.tenantId, fileId);
      const owns = await this.prisma.withTenant(auth.tenantId, (tx) => this.customerOwns(tx, auth.userId, fileId));
      if (!owns) {
        throw new NotFoundException('Not found');
      }
      this.logger.log(JSON.stringify(redact({ fileId: file.id, outcome: 'downloaded' })));
      return this.payload(file);
    }
    const canReadCase = auth.permissions.includes('document.read');
    const canReadIdentity = auth.permissions.includes('identity_file.read');
    if (!canReadCase && !canReadIdentity) {
      throw new ForbiddenException();
    }
    const file = await this.loadClean(auth.tenantId, fileId);
    const identity = await this.prisma.withTenant(auth.tenantId, (tx) => this.isIdentityEvidence(tx, fileId));
    if (identity) {
      if (!auth.permissions.includes('identity_file.read')) {
        throw new ForbiddenException();
      }
      if (!purpose?.trim()) {
        throw new BadRequestException('Purpose is required');
      }
      await this.prisma.withTenant(auth.tenantId, (tx) =>
        tx.auditEvent.create({
          data: {
            tenantId: auth.tenantId,
            actorId: auth.userId,
            action: 'identity_file.access',
            targetType: 'stored_file',
            targetId: file.id,
            purpose: purpose.trim(),
          },
        }),
      );
    } else if (!auth.permissions.includes('document.read')) {
      throw new ForbiddenException();
    }
    this.logger.log(JSON.stringify(redact({ fileId: file.id, outcome: 'downloaded' })));
    return this.payload(file);
  }

  private async isIdentityEvidence(tx: Tx, fileId: string) {
    const documents = await tx.document.findMany({ where: { fileId }, select: { fieldKey: true } });
    return documents.some((item) => IDENTITY_DOCUMENT_KEYS.has(item.fieldKey));
  }

  private async loadClean(tenantId: string, fileId: string) {
    const file = await this.prisma.withTenant(tenantId, (tx) =>
      tx.storedFile.findFirst({ where: { id: fileId, tenantId, scanStatus: 'clean', quarantinedAt: null } }),
    );
    if (!file) {
      throw new NotFoundException('Not found');
    }
    return file;
  }

  private payload(file: { storageKey: string; mediaType: string; sha256: string; id: string }) {
    return {
      bytes: readPrivateFile(file.storageKey),
      mediaType: file.mediaType,
      sha256: file.sha256,
    };
  }

  private async customerOwns(tx: Tx, userId: string, fileId: string) {
    const where = { fileId, application: { customer: { userId } } };
    const [document, signature, generated] = await Promise.all([
      tx.document.findFirst({ where }),
      tx.signatureEvidence.findFirst({ where }),
      tx.generatedPackage.findFirst({ where }),
    ]);
    return Boolean(document || signature || generated);
  }
}

export function sha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}
