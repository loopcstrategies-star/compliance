import type { Tx } from '../prisma/prisma.service';

/** Serialize draft create/resume for a customer within the current tenant transaction. */
export async function lockCustomerForDraft(tx: Tx, customerId: string): Promise<void> {
  await tx.$queryRaw`SELECT id FROM customers WHERE id = CAST(${customerId} AS uuid) FOR UPDATE`;
}
