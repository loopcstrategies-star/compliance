import type { Tx } from '../prisma/prisma.service';

export async function isTemplateRequired(tx: Tx, tenantId: string, customerType: string, templateId: string): Promise<boolean> {
  const override = await tx.tenantApplicability.findUnique({
    where: { tenantId_customerType_templateId: { tenantId, customerType, templateId } },
  });
  if (override) {
    return override.required;
  }
  const rule = await tx.applicabilityRule.findFirst({ where: { customerType, templateId, fieldKey: '' } });
  return Boolean(rule?.required);
}
