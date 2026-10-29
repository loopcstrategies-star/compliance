import { apiGet } from '../../../../lib/api';
import { requireArea } from '../../../../lib/session';
import { CompanyShell } from '../company-shell';
import { MessagesClient } from '../messages-client';
import type { ConversationRow } from '../network-types';

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ peer?: string }>;
}) {
  const me = await requireArea(['employee', 'maker', 'checker', 'authorised_approver', 'super_admin']);
  const params = await searchParams;
  const conversations = (await apiGet<ConversationRow[]>('/company-network/conversations')) ?? [];
  const initial = params.peer
    ? conversations.find((row) => row.peerTenantId === params.peer)?.id
    : conversations[0]?.id;

  return (
    <CompanyShell me={me}>
      <MessagesClient initialConversations={conversations} initialConversationId={initial} />
    </CompanyShell>
  );
}
