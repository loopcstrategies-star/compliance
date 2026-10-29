'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import type { ConversationRow, MessageRow } from './network-types';

export function MessagesClient({
  initialConversations,
  initialConversationId,
  peerTenantId,
  peerConnectionId,
  peerName,
}: {
  initialConversations: ConversationRow[];
  initialConversationId?: string;
  peerTenantId?: string;
  peerConnectionId?: string;
  peerName?: string;
}) {
  const [conversations, setConversations] = useState(initialConversations);
  const [activeId, setActiveId] = useState(initialConversationId || '');
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [pendingPeer, setPendingPeer] = useState(
    Boolean(peerConnectionId && peerTenantId && !initialConversationId),
  );
  const active = conversations.find((row) => row.id === activeId);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return conversations;
    }
    return conversations.filter((row) =>
      [row.peerName, row.lastMessage?.body].filter(Boolean).join(' ').toLowerCase().includes(needle),
    );
  }, [conversations, query]);

  async function loadConversations() {
    const response = await fetch('/api/company-network/conversations');
    if (!response.ok) {
      return;
    }
    setConversations(await response.json());
  }

  async function loadMessages(conversationId: string, silent = false) {
    if (!conversationId) {
      setMessages([]);
      return;
    }
    if (!silent) {
      setLoading(true);
    }
    setError('');
    const response = await fetch(`/api/company-network/conversations/${conversationId}/messages`);
    if (!response.ok) {
      if (!silent) {
        setLoading(false);
      }
      setError('Messages could not be loaded.');
      return;
    }
    const payload = await response.json();
    setMessages(payload.items ?? []);
    await fetch(`/api/company-network/conversations/${conversationId}/read`, { method: 'POST' });
    setConversations((rows) =>
      rows.map((row) => (row.id === conversationId ? { ...row, unreadCount: 0 } : row)),
    );
    if (!silent) {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (activeId) {
      void loadMessages(activeId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  useEffect(() => {
    const timer = setInterval(() => {
      void loadConversations();
      if (activeId) {
        void loadMessages(activeId, true);
      }
    }, 15000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  async function onSend(event: FormEvent) {
    event.preventDefault();
    if (!body.trim()) {
      return;
    }
    setError('');
    const payload =
      activeId
        ? { conversationId: activeId, body }
        : peerConnectionId
          ? { connectionId: peerConnectionId, body }
          : null;
    if (!payload) {
      return;
    }
    const response = await fetch('/api/company-network/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      setError('The message was not sent.');
      return;
    }
    const message = await response.json();
    setBody('');
    if (pendingPeer && message.conversationId) {
      setPendingPeer(false);
      setActiveId(message.conversationId);
      setMessages([message]);
      await loadConversations();
      return;
    }
    await loadConversations();
    setMessages((rows) => [...rows, message]);
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

  const threadTitle = active?.peerName || peerName || 'Messages';
  const canCompose = Boolean(activeId || (pendingPeer && peerConnectionId));

  return (
    <div className="messages-layout">
      <aside className="panel messages-list">
        <h3>Conversations</h3>
        <label>
          Search
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search conversations" />
        </label>
        {filtered.length === 0 ? <p className="notice">No conversations yet. Connect with a company first.</p> : null}
        <ul>
          {filtered.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                className={row.id === activeId ? 'is-active' : undefined}
                onClick={() => {
                  setPendingPeer(false);
                  setActiveId(row.id);
                }}
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
        <div className="messages-thread-head">
          <h3>{threadTitle}</h3>
          {(active?.peerTenantId || peerTenantId) && (
            <Link
              className="button-link button-link--outline"
              href={`/workspace/company/discover/${active?.peerTenantId || peerTenantId}`}
            >
              View profile
            </Link>
          )}
        </div>
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
          {!loading && canCompose && messages.length === 0 ? (
            <p className="notice">
              {pendingPeer ? `Start a conversation with ${peerName || 'this company'}.` : 'Start the conversation.'}
            </p>
          ) : null}
          {!canCompose ? (
            <p className="notice">Select a conversation or open Message from a connected company profile.</p>
          ) : null}
        </div>
        {canCompose ? (
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
