import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';

export const DUPLICATE_COMPANY = 'A company with this name already exists';

export async function assertUniqueTenantName(prisma: PrismaService, name: string, exceptId?: string) {
  const existing = await prisma.tenant.findFirst({
    where: {
      name: { equals: name, mode: 'insensitive' },
      ...(exceptId ? { id: { not: exceptId } } : {}),
    },
    select: { id: true },
  });
  if (existing) {
    throw new BadRequestException(DUPLICATE_COMPANY);
  }
}

export function duplicateNameError(error: unknown): unknown {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    return new BadRequestException(DUPLICATE_COMPANY);
  }
  return error;
}
