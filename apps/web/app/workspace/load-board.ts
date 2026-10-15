import { apiGet } from '../../lib/api';
import type { Me } from '../../lib/session';
import type { QueueItem } from './queue';

export type Board = {
  tenantId: string;
  windowDays?: number;
  counts: { requests: number; waiting: number; corrections: number; customers: number; overdue: number; total?: number };
  items: QueueItem[];
  distribution?: { status: string; count: number }[];
  recent?: QueueItem[];
  waitingPreview?: (QueueItem & { dueAt?: string | null })[];
  expiring?: { id: string; applicationId: string; legalName: string; document: string; expiresOn: string; status: string }[];
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

export async function loadBoard(view: string, tenantId: string, days = 30): Promise<Board | null> {
  const window = view === 'dashboard' ? `&days=${days}` : '';
  return apiGet<Board>(`/applications?view=${encodeURIComponent(view)}&tenantId=${encodeURIComponent(tenantId)}${window}`);
}
