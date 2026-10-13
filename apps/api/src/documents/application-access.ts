import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { AuthState } from '../auth/auth.types';
import type { Tx } from '../prisma/prisma.service';
import { isTemplateRequired } from './applicability';

export async function visibleApplication(tx: Tx, auth: AuthState, id: string) {
  const application = await tx.application.findFirst({
    where: { id, tenantId: auth.tenantId },
    include: { customer: true },
  });
  if (!application || (auth.roles.includes('customer') && application.customer.userId !== auth.userId)) {
    throw new NotFoundException('Not found');
  }
  return application;
}

const SIGNATURE_IMAGES = new Set([
  'kyc.signature.image',
  'pepdec.signature.image',
  'pepquest.signature.image',
  'rspolicy.ack.signature',
]);

export async function assertDocumentField(tx: Tx, tenantId: string, customerType: string, schemaVersion: number, fieldKey: string) {
  if (SIGNATURE_IMAGES.has(fieldKey)) {
    throw new BadRequestException('Signature images require authorisation and consent');
  }
  if (fieldKey.startsWith('extra.')) {
    const category = await tx.checklistCategory.findFirst({
      where: { id: fieldKey.slice('extra.'.length), tenantId },
    });
    if (!category) {
      throw new BadRequestException('Unknown field');
    }
    return 'document' as const;
  }
  const field = await tx.formField.findFirst({
    where: { fieldKey, schema: { version: schemaVersion } },
    include: { schema: true },
  });
  if (!field) {
    throw new BadRequestException('Unknown field');
  }
  if (!(await isTemplateRequired(tx, tenantId, customerType, field.schema.templateId))) {
    throw new BadRequestException('Field is not applicable');
  }
  const fieldRule = await tx.applicabilityRule.findFirst({
    where: { customerType, templateId: field.schema.templateId, fieldKey },
  });
  if (fieldRule && !fieldRule.required) {
    throw new BadRequestException('Field is not applicable');
  }
  return fieldKey.includes('stamp') ? ('image' as const) : ('document' as const);
}

export function signatureFieldFor(templateId: string): string {
  const fields: Record<string, string> = {
    kyc: 'kyc.signature.image',
    'pep-declaration': 'pepdec.signature.image',
    'pep-questionnaire': 'pepquest.signature.image',
    'responsible-sourcing': 'rspolicy.ack.signature',
  };
  const fieldKey = fields[templateId];
  if (!fieldKey) {
    throw new BadRequestException('Unknown field');
  }
  return fieldKey;
}
