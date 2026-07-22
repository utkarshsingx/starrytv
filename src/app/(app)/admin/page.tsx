import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/server/auth/session';
import { listQueue } from '@/server/ugc/service';
import { stats, listAudit } from '@/server/admin/repo';

export const metadata: Metadata = { title: 'Control room' };
export const dynamic = 'force-dynamic';

function decisionTime(sec: number | null): string {
  if (sec == null) return '—';
  if (sec < 3600) return `${Math.round(sec / 60)}m`;
  if (sec < 86400) return `${(sec / 3600).toFixed(1)}h`;
  return `${(sec / 86400).toFixed(1)}d`;
}

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role !== 'admin') redirect('/desk');

  const [queue, s, audit] = await Promise.all([listQueue(), stats(), listAudit(12)]);

  const tiles = [
    { href: '/admin/reviews', n: queue.length, label: 'Waiting in the queue' },
    { href: '/admin/users', n: s.users, label: 'Readers' },
    { href: '/admin/hub', n: s.published, label: 'Live on the hub' },
    { href: '/admin/genres', n: null as number | null, label: 'Genres & channels', sub: 'manage →' },
  ];

  return (
    <main className="app-main">
      <p className="app-kicker">The control room</p>
      <h1 className="app-h1">The editor’s desk.</h1>

      <div style={{ marginTop: '1.5rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(13rem, 1fr))', gap: '1px', background: '#e6e2d6', border: '1px solid #e6e2d6' }}>
        {tiles.map((t) => (
          <Link key={t.href} href={t.href} style={{ background: '#fff', padding: '1.25rem', textDecoration: 'none', color: 'inherit' }}>
            <div style={{ fontSize: 26, fontWeight: 700, color: '#141414' }}>{t.n ?? t.sub}</div>
            <div style={{ fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#a09b8e', marginTop: '0.2rem' }}>{t.label}</div>
          </Link>
        ))}
      </div>

      <div className="desk-section-head"><h2>This week</h2><Link href="/admin/settings" className="count">settings →</Link></div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem', fontSize: 13 }}>
        <span><strong style={{ fontSize: 20 }}>{s.submittedThisWeek}</strong><br /><span style={{ color: '#a09b8e', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.14em' }}>submitted</span></span>
        <span><strong style={{ fontSize: 20 }}>{decisionTime(s.medianDecisionSec)}</strong><br /><span style={{ color: '#a09b8e', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.14em' }}>median decision</span></span>
        <span><strong style={{ fontSize: 20 }}>{s.rejected}</strong><br /><span style={{ color: '#a09b8e', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.14em' }}>rejected all-time</span></span>
      </div>

      <div className="desk-section-head"><h2>Recent activity</h2></div>
      <div style={{ fontSize: 12.5, color: '#55524b', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        {audit.length === 0 && <span style={{ color: '#a09b8e' }}>Nothing yet.</span>}
        {audit.map((a) => (
          <div key={a.id} style={{ display: 'flex', gap: '0.8rem' }}>
            <span style={{ color: '#a09b8e', minWidth: '9rem' }}>{new Date(a.createdAt).toLocaleString()}</span>
            <span><strong>{a.actorName}</strong> · {a.action}{a.reason ? ` — ${a.reason}` : ''}</span>
          </div>
        ))}
      </div>
    </main>
  );
}
