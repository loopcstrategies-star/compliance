import { createHash, randomUUID } from 'crypto';
import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import path from 'path';
import { BadRequestException } from '@nestjs/common';
import { MAX_UPLOAD_BYTES } from '../domain';

const EICAR = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';
const PDF_ACTION = /\/JavaScript|\/JS\b|\/Launch|\/OpenAction/;

export type AllowedKind = 'document' | 'image';

export function storageRoot(): string {
  return process.env.FILE_STORAGE_DIR || path.resolve(process.cwd(), 'storage');
}

export function detectMediaType(bytes: Buffer): string | null {
  if (bytes.length >= 4 && bytes.subarray(0, 4).toString('ascii') === '%PDF') {
    return 'application/pdf';
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png';
  }
  return null;
}

export function assertUpload(bytes: Buffer, kind: AllowedKind): string {
  if (bytes.length === 0 || bytes.length > MAX_UPLOAD_BYTES) {
    throw new BadRequestException('File is too large');
  }
  const mediaType = detectMediaType(bytes);
  const allowed =
    kind === 'image' ? ['image/jpeg', 'image/png'] : ['application/pdf', 'image/jpeg', 'image/png'];
  if (!mediaType || !allowed.includes(mediaType)) {
    throw new BadRequestException('File type is not allowed');
  }
  if (bytes.toString('latin1').includes(EICAR)) {
    throw new BadRequestException('File was rejected');
  }
  if (mediaType === 'application/pdf' && PDF_ACTION.test(bytes.toString('latin1'))) {
    throw new BadRequestException('File was rejected');
  }
  return mediaType;
}

export function writePrivateFile(bytes: Buffer): { storageKey: string; sha256: string } {
  const storageKey = randomUUID();
  mkdirSync(storageRoot(), { recursive: true });
  writeFileSync(path.join(storageRoot(), storageKey), bytes);
  return { storageKey, sha256: createHash('sha256').update(bytes).digest('hex') };
}

export function removePrivateFile(storageKey: string): void {
  if (!/^[0-9a-f-]{36}$/i.test(storageKey)) {
    throw new BadRequestException('File was rejected');
  }
  unlinkSync(path.join(storageRoot(), storageKey));
}

export function readPrivateFile(storageKey: string): Buffer {
  if (!/^[0-9a-f-]{36}$/i.test(storageKey)) {
    throw new BadRequestException('File was rejected');
  }
  return readFileSync(path.join(storageRoot(), storageKey));
}
