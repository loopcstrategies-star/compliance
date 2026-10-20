'use client';

import { useState } from 'react';

export function StaffAvatar({ initials }: { initials: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <span className="avatar" aria-hidden="true">
        {initials || 'LC'}
      </span>
    );
  }
  return (
    <img
      className="avatar avatar-photo"
      src="/images/loopc-admin-avatar.png"
      alt="Administrator profile photo"
      width={38}
      height={38}
      onError={() => setFailed(true)}
    />
  );
}
