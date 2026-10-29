'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

export type FeedPost = {
  id: string;
  tenantId: string;
  companyName: string;
  authorName: string;
  body: string;
  postType: string;
  createdAt: string;
  commentCount: number;
  reactionCount: number;
  reactedByMe: boolean;
  canEdit: boolean;
};

export function FeedClient({
  initialItems = [],
  compose = false,
  tenantId,
}: {
  initialItems?: FeedPost[];
  compose?: boolean;
  tenantId?: string;
}) {
  const [items, setItems] = useState<FeedPost[]>(initialItems);
  const [body, setBody] = useState('');
  const [postType, setPostType] = useState('announcement');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});

  const reload = useCallback(async () => {
    const params = new URLSearchParams({ page: '1', pageSize: '20' });
    if (tenantId) {
      params.set('tenantId', tenantId);
    }
    const response = await fetch(`/api/company-network/feed?${params.toString()}`);
    if (!response.ok) {
      setError('Activity feed could not be loaded.');
      return;
    }
    const payload = await response.json();
    setItems(payload.items ?? []);
  }, [tenantId]);

  useEffect(() => {
    if (!initialItems.length) {
      void reload();
    }
  }, [initialItems.length, reload]);

  async function onCompose(event: FormEvent) {
    event.preventDefault();
    if (!body.trim()) {
      return;
    }
    setBusy(true);
    setError('');
    const response = await fetch('/api/company-network/posts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ body, postType }),
    });
    setBusy(false);
    if (!response.ok) {
      setError('The update was not published.');
      return;
    }
    setBody('');
    await reload();
  }

  async function onReact(postId: string) {
    await fetch(`/api/company-network/posts/${postId}/reactions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reactionType: 'like' }),
    });
    await reload();
  }

  async function onComment(postId: string) {
    const text = (commentDrafts[postId] ?? '').trim();
    if (!text) {
      return;
    }
    const response = await fetch(`/api/company-network/posts/${postId}/comments`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ body: text }),
    });
    if (!response.ok) {
      setError('Comment was not saved.');
      return;
    }
    setCommentDrafts((drafts) => ({ ...drafts, [postId]: '' }));
    await reload();
  }

  async function onDelete(postId: string) {
    await fetch(`/api/company-network/posts/${postId}`, { method: 'DELETE' });
    await reload();
  }

  return (
    <section className="panel network-feed">
      <div className="network-section-head">
        <h3>Company activity</h3>
      </div>
      {error ? <p className="notice error">{error}</p> : null}
      {compose ? (
        <form className="network-form" onSubmit={onCompose}>
          <label>
            Update type
            <select value={postType} onChange={(event) => setPostType(event.target.value)}>
              <option value="announcement">Announcement</option>
              <option value="news">News</option>
              <option value="product">Product / service</option>
              <option value="event">Event</option>
            </select>
          </label>
          <label>
            Share an update
            <textarea value={body} onChange={(event) => setBody(event.target.value)} rows={3} maxLength={4000} />
          </label>
          <button type="submit" disabled={busy || !body.trim()}>
            {busy ? 'Publishing…' : 'Publish'}
          </button>
        </form>
      ) : null}
      {items.length === 0 ? <p className="notice">No company updates yet.</p> : null}
      <ul className="network-list network-feed-list">
        {items.map((post) => (
          <li key={post.id}>
            <div>
              <p>
                <Link href={`/workspace/company/discover/${post.tenantId}`}>
                  <strong>{post.companyName}</strong>
                </Link>{' '}
                <span className="muted-line">
                  · {post.postType} · {post.authorName} · {new Date(post.createdAt).toLocaleString()}
                </span>
              </p>
              <p>{post.body}</p>
              <div className="connection-actions">
                <button type="button" className="button-secondary" onClick={() => void onReact(post.id)}>
                  {post.reactedByMe ? 'Unlike' : 'Like'} ({post.reactionCount})
                </button>
                <span className="muted-line">{post.commentCount} comments</span>
                {post.canEdit ? (
                  <button type="button" className="button-secondary" onClick={() => void onDelete(post.id)}>
                    Delete
                  </button>
                ) : null}
              </div>
              <div className="network-feed-comment">
                <input
                  value={commentDrafts[post.id] ?? ''}
                  onChange={(event) =>
                    setCommentDrafts((drafts) => ({ ...drafts, [post.id]: event.target.value }))
                  }
                  placeholder="Add a comment"
                />
                <button type="button" className="button-secondary" onClick={() => void onComment(post.id)}>
                  Comment
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
