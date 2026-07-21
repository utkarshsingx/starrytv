'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, isOk } from '@/lib/api';

type Me = { id: string; displayName: string; role: 'user' | 'admin' } | null;

/**
 * The account controls in the hub's top bar.
 *
 * A client island on purpose. The hub is a static, crawlable, cached page, and
 * reading the session on the server would force every request to render fresh —
 * so the session is checked here, after load, instead. The signed-out links are
 * the default render, which is both the safe default and the common case for a
 * public page, so anonymous visitors see no flash; a signed-in visitor's chip
 * swaps in a moment later.
 */
export function AccountChip() {
  const [me, setMe] = useState<Me | 'loading'>('loading');

  useEffect(() => {
    let alive = true;
    api<{ user: Me }>('/api/v1/auth/me').then((res) => {
      if (alive) setMe(isOk(res) ? res.data.user : null);
    });
    return () => {
      alive = false;
    };
  }, []);

  if (me && me !== 'loading') {
    return (
      <span className="account-chip">
        <Link href={me.role === 'admin' ? '/admin' : '/desk'} className="account-chip-link">
          {me.displayName.split(' ')[0]}’s desk
        </Link>
      </span>
    );
  }

  // Signed out, or still checking — show the way in either way.
  return (
    <span className="account-chip">
      <Link href="/login" className="account-chip-link">Sign in</Link>
      <Link href="/signup" className="account-chip-cta">Create account</Link>
    </span>
  );
}
