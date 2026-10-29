import { apiGet } from '../../../../lib/api';
import { requireArea } from '../../../../lib/session';
import { CompanyShell } from '../company-shell';
import { MessagesClient } from '../messages-client';
import type { ConnectionRow, ConversationRow } from '../network-types';
import { NetworkUnavailable } from '../network-unavailable';

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ peer?: string }>;
}) {
  const me = await requireArea(['employee', 'maker', 'checker', 'authorised_approver', 'super_admin']);
  const params = await searchParams;
  const conversations = await apiGet<ConversationRow[]>('/company-network/conversations');
  if (!conversations) {
    return (
      <CompanyShell me={me}>
        <NetworkUnavailable title="Messaging is not available for this account" />
      </CompanyShell>
    );
  }

  let initial = params.peer
    ? conversations.find((row) => row.peerTenantId === params.peer)?.id
    : conversations[0]?.id;

  let peerConnectionId: string | undefined;
  let peerTenantId = params.peer;
  let peerName: string | undefined;

  if (params.peer && !initial) {
    const connected = (await apiGet<ConnectionRow[]>('/company-network/connections')) ?? [];
    const peer = connected.find((row) => row.peerTenantId === params.peer);
    if (peer) {
      peerConnectionId = peer.id;
      peerName = peer.peerName;
    }
  }

  return (
    <CompanyShell me={me}>
      <MessagesClient
        initialConversations={conversations}
        initialConversationId={initial}
        peerTenantId={peerTenantId}
        peerConnectionId={peerConnectionId}
        peerName={peerName}
      />
    </CompanyShell>
  );
}
