import 'server-only';
import { OAuth2Client } from 'google-auth-library';
import { env } from '../env';
import { unauthorized } from './errors';

/**
 * Google, both halves of the redirect code flow.
 *
 * Redirect flow, not GIS One Tap: it works in every browser and every in-app
 * webview, the tokens never touch client JavaScript, and it needs no FedCM
 * (which One Tap depends on and which fails silently under Safari ITP and in
 * several webviews — it would work on a laptop and quietly miss a chunk of
 * mobile readers).
 */

let client: OAuth2Client | null = null;
function oauth(): OAuth2Client {
  if (!client) {
    const e = env();
    client = new OAuth2Client(e.GOOGLE_CLIENT_ID, e.GOOGLE_CLIENT_SECRET, e.GOOGLE_CALLBACK_URL);
  }
  return client;
}

/** The URL to send the browser to. `state` is the CSRF nonce we set as a cookie
 *  and re-check on the way back. */
export function googleAuthUrl(state: string): string {
  return oauth().generateAuthUrl({
    access_type: 'online',
    scope: ['openid', 'email', 'profile'],
    state,
    prompt: 'select_account',
  });
}

export type GoogleProfile = {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string;
  picture?: string;
};

/**
 * Exchange the callback code for an id_token and verify it LOCALLY against
 * Google's JWKS — not by calling the tokeninfo endpoint, which Google labels
 * "for development and debugging", adds a network round trip to every login, is
 * rate-limited, and (as the sibling does) tends to skip the iss/email_verified
 * checks. `verifyIdToken` checks the signature, `aud` and `exp` itself; we
 * assert `iss` and `email_verified` on top.
 */
export async function exchangeGoogleCode(code: string): Promise<GoogleProfile> {
  const c = oauth();
  let idToken: string | undefined;
  try {
    const { tokens } = await c.getToken(code);
    idToken = tokens.id_token ?? undefined;
  } catch {
    throw unauthorized('GOOGLE_FAILED', 'Could not complete Google sign-in.');
  }
  if (!idToken) throw unauthorized('GOOGLE_FAILED', 'Google returned no identity token.');

  const ticket = await c.verifyIdToken({ idToken, audience: env().GOOGLE_CLIENT_ID });
  const p = ticket.getPayload();

  if (!p || !p.sub || !p.email) {
    throw unauthorized('GOOGLE_FAILED', 'Google identity was incomplete.');
  }
  if (p.iss !== 'accounts.google.com' && p.iss !== 'https://accounts.google.com') {
    throw unauthorized('GOOGLE_FAILED', 'Google token issuer was not recognised.');
  }
  if (p.email_verified !== true) {
    throw unauthorized('GOOGLE_UNVERIFIED', 'That Google account has an unverified email.');
  }

  return {
    sub: p.sub,
    email: p.email,
    emailVerified: true,
    name: p.name ?? p.email.split('@')[0],
    picture: p.picture,
  };
}
