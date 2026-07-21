import type { Metadata } from 'next';
import { getCurrentUser } from '@/server/auth/session';

export const metadata: Metadata = { title: 'Your desk' };

export default async function DeskPage() {
  const user = (await getCurrentUser())!; // layout already guaranteed this
  const firstName = user.displayName.split(' ')[0];

  return (
    <main className="app-main">
      <p className="app-kicker">Your desk</p>
      <h1 className="app-h1">Evening, {firstName}.</h1>
      <p className="app-lede">
        This is where your reading lives — what you are in the middle of, the shelf of what you have
        finished, the quotes you kept, and the reviews you are drafting for the library.
      </p>
      <div className="app-placeholder">
        <strong>Coming next.</strong> The reading log lands in the next phase: add a book, mark where
        you are in it, keep quotes and images from it, then write it up and send it to the editor for
        the hub. For now, your account is set up and signed in.
      </div>
    </main>
  );
}
