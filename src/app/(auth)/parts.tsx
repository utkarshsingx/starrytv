import Link from 'next/link';

/** Human copy for the error codes the auth routes return. Anything unmapped
 *  falls back to its own message from the server, then to a generic line. */
export const ERROR_COPY: Record<string, string> = {
  BAD_CREDENTIALS: 'Email or password is incorrect.',
  USE_GOOGLE: 'This account signs in with Google. Use the button above.',
  EMAIL_NOT_VERIFIED: 'Check your email for a verification code first.',
  EMAIL_IN_USE: 'An account with that email already exists. Try signing in.',
  WEAK_PASSWORD: 'Use 8–128 characters, with at least one letter and one number.',
  INVALID_EMAIL: 'That does not look like an email address.',
  INVALID_CODE: 'That code is wrong or has expired.',
  SUSPENDED: 'This account has been suspended.',
  RATE_LIMITED: 'Too many attempts. Wait a minute and try again.',
  NETWORK: 'Could not reach the server. Check your connection.',
  google_cancelled: 'Google sign-in was cancelled.',
  google_state: 'That sign-in link expired. Try again.',
  google_failed: 'Google sign-in did not complete. Try again.',
  google_unverified: 'That Google account has an unverified email.',
};

export function AuthBrand() {
  return (
    <p className="auth-brand">
      <Link href="/">Starry ↩ back to the library</Link>
    </p>
  );
}

export function GoogleButton({ next }: { next?: string }) {
  const href = next ? `/api/v1/auth/google?next=${encodeURIComponent(next)}` : '/api/v1/auth/google';
  return (
    // A plain link, not fetch — the Google flow is a full-page redirect, so the
    // browser must actually navigate to it.
    <a className="auth-google" href={href}>
      <GoogleMark />
      Continue with Google
    </a>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  );
}
