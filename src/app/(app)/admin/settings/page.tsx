import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/server/auth/session';
import { getReviewWindow } from '@/server/settings';
import { SettingsForm } from './SettingsForm';
import '../../desk/desk.css';

export const metadata: Metadata = { title: 'Settings' };
export const dynamic = 'force-dynamic';

export default async function AdminSettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role !== 'admin') redirect('/desk');
  const window = await getReviewWindow();

  return (
    <main className="app-main">
      <p className="app-kicker"><Link href="/admin" style={{ color: 'inherit', textDecoration: 'none' }}>Control room</Link> / Settings</p>
      <h1 className="app-h1">The house format</h1>
      <p className="app-lede">
        The window every submitted review must fit. Changing it moves the composer’s live counter and
        the server’s enforcement at the same time — no deploy. The outer rails (hook ≤14, body 30–120)
        are fixed in the database.
      </p>
      <SettingsForm initial={window} />
    </main>
  );
}
