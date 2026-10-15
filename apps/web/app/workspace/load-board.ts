import { apiGet } from '../../lib/api';
import type { Me } from '../../lib/session';
import type { QueueItem } from './queue';

export type Board = {
  tenantId: string;
  counts: { requests: number; waiting: number; corrections: number; customers: number; overdue: number };
  items: QueueItem[];
};

type Tenant = { id: string; name: string; isSystem: boolean };

export async function resolveTenant(me: Me, requested?: string): Promise<{ tenantId: string; tenants: Tenant[]; failed: boolean }> {
  if (!me.roles.includes('super_admin')) {
    return { tenantId: me.tenantId, tenants: [], failed: false };
  }
  const tenants = await apiGet<Tenant[]>('/tenants');
  if (!tenants) {
    return { tenantId: me.tenantId, tenants: [], failed: true };
  }
  const match = requested && tenants.some((tenant) => tenant.id === requested) ? requested : undefined;
  return {
    tenantId: match ?? tenants.find((tenant) => !tenant.isSystem)?.id ?? me.tenantId,
    tenants,
    failed: false,
  };
}

export async function loadBoard(view: string, tenantId: string): Promise<Board | null> {
  return apiGet<Board>(`/applications?view=${encodeURIComponent(view)}&tenantId=${encodeURIComponent(tenantId)}`);
}
