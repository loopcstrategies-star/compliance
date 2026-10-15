export function Icon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    home: 'M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z',
    building: 'M4 20h16M6 20V6a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v14M14 10h4a1 1 0 0 1 1 1v9M9 9h2M9 13h2M9 17h2',
    file: 'M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM14 3v5h5',
    clock: 'M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
    hourglass: 'M8 3h8M8 21h8M8 3c0 4 8 5 8 9s-8 5-8 9M16 3c0 4-8 5-8 9s8 5 8 9',
    users: 'M16 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM20 20v-1a3.5 3.5 0 0 0-2.5-3.35M16.5 4.13a3.5 3.5 0 0 1 0 6.74',
    settings: 'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM19.4 15a7.8 7.8 0 0 0 .1-2l2-1.2-2-3.4-2.3.6a8 8 0 0 0-1.7-1L15 4h-4l-.5 2.4a8 8 0 0 0-1.7 1L6.5 6.8l-2 3.4L6.5 11a7.8 7.8 0 0 0 .1 2l-2 1.2 2 3.4 2.3-.6a8 8 0 0 0 1.7 1L11 20h4l.5-2.4a8 8 0 0 0 1.7-1l2.3.6 2-3.4z',
    scroll: 'M8 4h9a2 2 0 0 1 2 2v14l-3-2-3 2-3-2-3 2V6a2 2 0 0 1 2-2z',
    help: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.5 9a2.5 2.5 0 1 1 3.2 2.4c-.7.3-1.2.9-1.2 1.6V14M12 17h.01',
    'sign-out': 'M10 7V5a2 2 0 0 1 2-2h7v18h-7a2 2 0 0 1-2-2v-2M15 12H3m0 0 3-3m-3 3 3 3',
    chart: 'M4 19V5M4 19h16M8 16v-5M12 16V8M16 16v-3',
    calendar: 'M7 3v3M17 3v3M4 8h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z',
    alert: 'M12 9v4M12 17h.01M10.3 4.8 2.8 18a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3L13.7 4.8a2 2 0 0 0-3.4 0z',
    check: 'M20 7 9 18l-5-5',
    plus: 'M12 5v14M5 12h14',
    send: 'M4 12 20 4l-6 16-2-7z',
    upload: 'M12 16V5M7 9l5-5 5 5M5 19h14',
    bars: 'M4 19V10M10 19V5M16 19v-7M22 19H2',
  };
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="icon">
      <path d={paths[name] ?? paths.file} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const ICONS: Record<string, string> = {
  '/workspace/dashboard': 'home',
  '/workspace/company': 'building',
  '/workspace/requests': 'file',
  '/workspace/waiting': 'clock',
  '/workspace/customers': 'users',
  '/workspace/settings': 'settings',
  '/workspace/audit': 'scroll',
  '/workspace/help': 'help',
};

export function iconFor(href: string): string {
  return ICONS[href] ?? 'file';
}
