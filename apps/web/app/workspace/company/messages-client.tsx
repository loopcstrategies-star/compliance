'use client';

import { FormEvent, useEffect, useState } from 'react';
import type { ConversationRow, MessageRow } from './network-types';

export function MessagesClient({
  initialConversations,
  initialConversationId,
}: {
  initialConversations: ConversationRow[];
  initialConversationId?: string;
}) {
  const [conversations, setConversations] = useState(initialConversations);
  const [activeId, setActiveId] = useState(initialConversationId || initialConversations[0]?.id || '');
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const active = conversations.find((row) => row.id === activeId);

  async function loadMessages(conversationId: string) {
    if (!conversationId) {
      setMessages([]);
      return;
    }
    setLoading(true);
    setError('');
    const response = await fetch(`/api/company-network/conversations/${conversationId}/messages`);
    if (!response.ok) {
      setLoading(false);
      setError('Messages could not be loaded.');
      return;
    }
    const payload = await response.json();
    setMessages(payload.items ?? []);
    await fetch(`/api/company-network/conversations/${conversationId}/read`, { method: 'POST' });
    setConversations((rows) =>
      rows.map((row) => (row.id === conversationId ? { ...row, unreadCount: 0 } : row)),
    );
    setLoading(false);
  }

  useEffect(() => {
    void loadMessages(activeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  async function onSend(event: FormEvent) {
    event.preventDefault();
    if (!activeId || !body.trim()) {
      return;
    }
    setError('');
    const response = await fetch('/api/company-network/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ conversationId: activeId, body }),
    });
    if (!response.ok) {
      setError('The message was not sent.');
      return;
    }
    const message = await response.json();
    setMessages((rows) => [...rows, message]);
    setBody('');
    setConversations((rows) =>
      rows.map((row) =>
        row.id === activeId
          ? {
              ...row,
              lastMessageAt: message.createdAt,
              lastMessage: {
                id: message.id,
                body: message.body,
                senderTenantId: message.senderTenantId,
                createdAt: message.createdAt,
              },
            }
          : row,
      ),
    );
  }

  return (
    <div className="messages-layout">
      <aside className="panel messages-list">
        <h3>Conversations</h3>
        {conversations.length === 0 ? <p className="notice">No conversations yet. Connect with a company first.</p> : null}
        <ul>
          {conversations.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                className={row.id === activeId ? 'is-active' : undefined}
                onClick={() => setActiveId(row.id)}
              >
                <strong>{row.peerName}</strong>
                <span>{row.lastMessage?.body || 'No messages yet'}</span>
                {row.unreadCount > 0 ? <em className="unread-pill">{row.unreadCount}</em> : null}
              </button>
            </li>
          ))}
        </ul>
      </aside>
      <section className="panel messages-thread">
        {active ? <h3>{active.peerName}</h3> : <h3>Messages</h3>}
        {loading ? <p className="notice">Loading messages…</p> : null}
        {error ? <p className="notice error">{error}</p> : null}
        <div className="message-history">
          {messages.map((message) => (
            <article key={message.id} className={message.mine ? 'mine' : 'theirs'}>
              <header>
                <strong>{message.senderName}</strong>
                <time dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleString()}</time>
              </header>
              <p>{message.body}</p>
            </article>
          ))}
          {!loading && active && messages.length === 0 ? <p className="notice">Start the conversation.</p> : null}
        </div>
        {active ? (
          <form className="message-composer" onSubmit={onSend}>
            <label>
              Message
              <textarea value={body} onChange={(event) => setBody(event.target.value)} rows={3} maxLength={4000} />
            </label>
            <button type="submit">Send</button>
          </form>
        ) : null}
      </section>
    </div>
  );
}
