'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { api } from '@/lib/api';

/** The signed-in top bar. Sign-out hits the route then hard-navigates home, so
 *  no client state or API-layer latch survives the transition. */
export function AppBar({ user }: { user: { displayName: string; role: 'user' | 'admin' } }) {
  const path = usePathname();
  const link = (href: string, label: string) => (
    <Link href={href} className={path === href || path.startsWith(href + '/') ? 'is-active' : ''}>
      {label}
    </Link>
  );

  async function signOut() {
    await api('/api/v1/auth/logout', { method: 'POST' });
    window.location.assign('/');
  }

  return (
    <header className="app-bar">
      <Link href="/" className="app-bar-brand">Starry</Link>
      <nav className="app-bar-nav">
        {link('/desk', 'Desk')}
        {link('/library', 'My library')}
        {user.role === 'admin' && link('/admin', 'Admin')}
      </nav>
      <span className="app-bar-spacer" />
      <span className="app-bar-who">
        <strong>{user.displayName}</strong>
      </span>
      <button className="app-bar-signout" onClick={signOut}>Sign out</button>
    </header>
  );
}
