import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import path from 'path';
import { Prisma, PrismaClient } from '@prisma/client';

export const TEMPLATE_SPECS = [
  {
    templateId: 'kyc',
    pageCount: 9,
    letterheadOwner: 'myka',
    sourceFile: 'MYKA_KYC_Form.pdf',
    letterheadField: 'kyc.letterhead.myka',
    letterheadStatus: 'measured',
    rect: { x: 36.55, y: 734.62, width: 123.75, height: 78.6 },
  },
  {
    templateId: 'pep-declaration',
    pageCount: 1,
    letterheadOwner: 'none',
    sourceFile: 'MYKA_PEP_DECLARATION_FORM_V1_01.04.24.pdf',
    letterheadField: 'pepdec.letterhead',
    letterheadStatus: 'none',
    rect: null,
  },
  {
    templateId: 'pep-questionnaire',
    pageCount: 1,
    letterheadOwner: 'none',
    sourceFile: 'MYKA_PEP_QUESTIONNAIRE_V1_01.04.24.pdf',
    letterheadField: 'pepquest.letterhead',
    letterheadStatus: 'none',
    rect: null,
  },
  {
    templateId: 'responsible-sourcing',
    pageCount: 2,
    letterheadOwner: 'none',
    sourceFile: 'MYKA_RESPONSIBLE_SOURCING_POLICY_V_1.1.11.2024_FOR_CLIENTS.pdf',
    letterheadField: 'rspolicy.letterhead',
    letterheadStatus: 'none',
    rect: null,
  },
] as const;

export function sourcePdfPath(sourceFile: string): string {
  return path.resolve(process.cwd(), '../../docs/templates/source', sourceFile);
}

export async function ensureTemplateCatalogue(prisma: PrismaClient): Promise<void> {
  for (const spec of TEMPLATE_SPECS) {
    const existing = await prisma.templateVersion.findUnique({
      where: { templateId_version: { templateId: spec.templateId, version: 1 } },
    });
    if (existing) {
      continue;
    }
    const bytes = readFileSync(sourcePdfPath(spec.sourceFile));
    const created = await prisma.templateVersion.create({
      data: {
        templateId: spec.templateId,
        version: 1,
        pageCount: spec.pageCount,
        sha256: createHash('sha256').update(bytes).digest('hex'),
        letterheadOwner: spec.letterheadOwner,
        sourceFile: spec.sourceFile,
      },
    });
    await prisma.placement.create({
      data: {
        templateVersionId: created.id,
        fieldKey: spec.letterheadField,
        status: spec.letterheadStatus,
        rect: (spec.rect as Prisma.InputJsonValue | null) ?? undefined,
      },
    });
  }
}
