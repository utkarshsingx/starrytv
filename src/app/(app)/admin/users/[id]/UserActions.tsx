'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, isOk } from '@/lib/api';

/** Suspend / restore / promote / demote / force-logout. Each asks for a reason,
 *  which lands in the audit log. Guarded against acting on your own account. */
export function UserActions({ userId, status, role, isSelf }: { userId: string; status: string; role: string; isSelf: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function act(action: string, needsReason = false) {
    let reason = '';
    if (needsReason) {
      reason = prompt('Reason (recorded in the audit log):') ?? '';
      if (reason === '') return;
    }
    setBusy(true); setMsg(null);
    const res = await api(`/api/v1/admin/users/${userId}`, { method: 'POST', auth: true, body: JSON.stringify({ action, reason }) });
    setBusy(false);
    if (isOk(res)) { setMsg('Done.'); router.refresh(); }
    else setMsg((res as { error: { message: string } }).error.message);
  }

  if (isSelf) return <p style={{ fontSize: 12, color: '#a09b8e', margin: '1rem 0' }}>This is your own account.</p>;

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', margin: '1rem 0' }}>
      {status === 'SUSPENDED'
        ? <button className="btn ghost" disabled={busy} onClick={() => act('restore', true)}>Restore</button>
        : <button className="btn ghost" disabled={busy} style={{ color: '#8a3a2a', borderColor: '#e0c4bd' }} onClick={() => act('suspend', true)}>Suspend</button>}
      {role === 'admin'
        ? <button className="btn ghost" disabled={busy} onClick={() => act('make-user', true)}>Remove admin</button>
        : <button className="btn ghost" disabled={busy} onClick={() => act('make-admin', true)}>Make admin</button>}
      <button className="btn ghost" disabled={busy} onClick={() => act('force-logout')}>Force logout</button>
      {msg && <span style={{ fontSize: 12, color: '#55524b', alignSelf: 'center' }}>{msg}</span>}
    </div>
  );
}
