import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/server/auth/session';

export const metadata: Metadata = { title: 'Admin' };

export default async function AdminPage() {
  // Second, independent check: the (app) layout guarantees a signed-in user, but
  // only this asserts the admin role on the server. The proxy's role cookie is a
  // routing hint and is never trusted here.
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role !== 'admin') redirect('/desk');

  return (
    <main className="app-main">
      <p className="app-kicker">Admin</p>
      <h1 className="app-h1">The editor’s desk.</h1>
      <p className="app-lede">
        From here you will see everyone on the platform, review what they submit, and decide what
        reaches the library — plus manage genres and pull anything down.
      </p>
      <div className="app-placeholder">
        <strong>Coming next.</strong> The review queue and the user list arrive with the publishing
        pipeline. Right now this page exists to prove the admin gate works: you are seeing it because
        your account is an admin, and nobody else can.
      </div>
    </main>
  );
}
