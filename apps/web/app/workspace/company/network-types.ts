export type NetworkProfile = {
  tenantId: string;
  companyName: string;
  legalName?: string;
  headline: string;
  introduction: string;
  industry: string;
  businessCategories: string[];
  city: string;
  country: string;
  website: string;
  publicEmail: string;
  publicPhone: string;
  productsServices: string;
  capabilities: string;
  companySize: string;
  yearEstablished: number | null;
  discoverable?: boolean;
  visibility: string;
  messagingEnabled: boolean;
  connectionCount?: number;
  hasLogo?: boolean;
  hasCover?: boolean;
  completion?: { done: number; total: number; percent: number };
  connectionStatus?: string;
  connectionId?: string | null;
  canMessage?: boolean;
};

export type ConnectionRow = {
  id: string;
  status: string;
  direction: string;
  connectionStatus: string;
  peerTenantId: string;
  peerName: string;
  headline: string;
  industry: string;
  city: string;
  country: string;
  createdAt: string;
};

export type ConversationRow = {
  id: string;
  connectionId: string;
  peerTenantId: string;
  peerName: string;
  lastMessageAt: string | null;
  lastMessage: { id: string; body: string; senderTenantId: string; createdAt: string } | null;
  unreadCount: number;
};

export type MessageRow = {
  id: string;
  body: string;
  senderTenantId: string;
  senderUserId: string;
  senderName: string;
  createdAt: string;
  readAt: string | null;
  mine: boolean;
};
