'use client';

import { FormEvent, useEffect, useState } from 'react';

type MemberProfile = {
  userId: string;
  displayName: string;
  email: string;
  jobTitle: string;
  department: string;
  introduction: string;
  hasPhoto: boolean;
  notifyMessages: boolean;
  notifyConnections: boolean;
  notifyFeed: boolean;
};

type MemberRow = {
  userId: string;
  displayName: string;
  email?: string;
  jobTitle: string;
  department: string;
  introduction: string;
  hasPhoto: boolean;
};

export function MemberProfileEditor({ showPrefs = false }: { showPrefs?: boolean }) {
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    const [mine, list] = await Promise.all([
      fetch('/api/company-network/members/me'),
      fetch('/api/company-network/members'),
    ]);
    if (mine.ok) {
      setProfile(await mine.json());
    }
    if (list.ok) {
      setMembers(await list.json());
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile) {
      return;
    }
    setBusy(true);
    setMessage('');
    setError('');
    const form = new FormData(event.currentTarget);
    const response = await fetch('/api/company-network/members/me', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        jobTitle: form.get('jobTitle'),
        department: form.get('department'),
        introduction: form.get('introduction'),
        ...(showPrefs
          ? {
              notifyMessages: form.get('notifyMessages') === 'on',
              notifyConnections: form.get('notifyConnections') === 'on',
              notifyFeed: form.get('notifyFeed') === 'on',
            }
          : {}),
      }),
    });
    setBusy(false);
    if (!response.ok) {
      setError('Member profile was not saved.');
      return;
    }
    setProfile(await response.json());
    setMessage('Member profile saved.');
    await load();
  }

  async function onPhoto(file: File | null) {
    if (!file) {
      return;
    }
    const body = new FormData();
    body.set('file', file);
    const response = await fetch('/api/company-network/members/me/photo', { method: 'POST', body });
    if (!response.ok) {
      setError('Photo upload failed.');
      return;
    }
    setMessage('Photo uploaded.');
    await load();
  }

  if (!profile) {
    return <p className="notice">Loading member profile…</p>;
  }

  return (
    <div className="network-member-block">
      <form className="panel network-form" onSubmit={onSubmit}>
        <h4>Your member profile</h4>
        {message ? <p className="notice success">{message}</p> : null}
        {error ? <p className="notice error">{error}</p> : null}
        <p className="muted-line">
          {profile.displayName} · {profile.email}
        </p>
        <label>
          Job title
          <input name="jobTitle" defaultValue={profile.jobTitle} />
        </label>
        <label>
          Department
          <input name="department" defaultValue={profile.department} />
        </label>
        <label>
          Professional introduction
          <textarea name="introduction" defaultValue={profile.introduction} rows={3} />
        </label>
        <label>
          Profile photo
          <input type="file" accept="image/png,image/jpeg" onChange={(e) => onPhoto(e.target.files?.[0] ?? null)} />
        </label>
        {showPrefs ? (
          <>
            <label className="checkbox-row">
              <input name="notifyMessages" type="checkbox" defaultChecked={profile.notifyMessages} />
              Notify me about new messages
            </label>
            <label className="checkbox-row">
              <input name="notifyConnections" type="checkbox" defaultChecked={profile.notifyConnections} />
              Notify me about connection requests
            </label>
            <label className="checkbox-row">
              <input name="notifyFeed" type="checkbox" defaultChecked={profile.notifyFeed} />
              Notify me about feed activity
            </label>
          </>
        ) : null}
        <button type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Save member profile'}
        </button>
      </form>
      <section className="panel">
        <h4>Company representatives</h4>
        {members.length === 0 ? <p className="notice">No members listed yet.</p> : null}
        <ul className="network-list">
          {members.map((member) => (
            <li key={member.userId}>
              <div>
                <strong>{member.displayName}</strong>
                <p className="muted-line">
                  {[member.jobTitle, member.department].filter(Boolean).join(' · ') || 'No title set'}
                </p>
                <p>{member.introduction || ''}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
