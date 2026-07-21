import 'server-only';
import { env } from '../env';

/**
 * Sending mail, with a fallback that keeps development moving.
 *
 * If RESEND_API_KEY is set, mail goes out through Resend. If it is not — which is
 * the state at launch, before the domain is verified — the code is logged to the
 * server console instead. That is deliberately not silent: it means signup and
 * verification are testable end to end with zero email setup, and the one thing
 * you must never do (let a failure here appear to succeed) is impossible because
 * the branch is loud.
 *
 * Never Supabase's built-in mailer: it is capped at 2 messages/hour, so the
 * second signup in any hour silently never arrives.
 */
export async function sendVerificationEmail(to: string, code: string): Promise<void> {
  const e = env();

  if (!e.RESEND_API_KEY) {
    console.warn(
      `\n[email] RESEND_API_KEY not set — not sending.\n` +
        `[email] Verification code for ${to}: ${code}\n`,
    );
    return;
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${e.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: e.EMAIL_FROM,
      to,
      subject: 'Your Starry verification code',
      text: `Your code is ${code}. It expires in 10 minutes.\n\nIf you did not sign up for Starry, ignore this.`,
    }),
  });

  if (!res.ok) {
    // Surface the failure — a verification email that silently fails to send is
    // a user who can never sign in and never knows why.
    const detail = await res.text().catch(() => '');
    throw new Error(`Resend failed (${res.status}): ${detail.slice(0, 200)}`);
  }
}
