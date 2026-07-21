import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/server/auth/session';
import { AppBar } from './AppBar';
import './app.css';

/**
 * The frame for every signed-in page.
 *
 * The `getCurrentUser` here is the real gate — the proxy only reads a hint
 * cookie for routing, and this is where the verified access token is actually
 * checked. A forged role cookie gets a visitor past the proxy and straight into
 * this redirect. Rendered on the server, so a signed-out visitor never receives
 * a byte of the protected markup.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  return (
    <div className="app">
      <AppBar user={{ displayName: user.displayName, role: user.role }} />
      {children}
    </div>
  );
}
