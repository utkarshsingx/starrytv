'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, isOk } from '@/lib/api';
import { AuthBrand, GoogleButton, ERROR_COPY } from '../parts';

export function SignupForm() {
  const router = useRouter();
  const next = useSearchParams().get('next') || '/desk';

  const [displayName, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await api('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, displayName }),
    });
    if (isOk(res)) {
      // The account exists but is unverified; the code has been sent. Carry the
      // email to the verify step so the user does not retype it.
      router.push(`/verify?email=${encodeURIComponent(email)}`);
      return;
    }
    setError(ERROR_COPY[res.error.code] ?? res.error.message);
    setBusy(false);
  }

  return (
    <div className="auth-card">
      <AuthBrand />
      <h1 className="auth-title">Create an account</h1>
      <p className="auth-stand">
        Keep a shelf, mark what you are reading, and publish reviews to the library once an editor
        clears them.
      </p>

      {error && <p className="auth-error" role="alert">{error}</p>}

      <GoogleButton next={next} />
      <div className="auth-or">or</div>

      <form onSubmit={onSubmit} noValidate>
        <div className="auth-field">
          <label htmlFor="name">Name</label>
          <input
            id="name" type="text" autoComplete="name" required
            value={displayName} onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="auth-field">
          <label htmlFor="email">Email</label>
          <input
            id="email" type="email" autoComplete="email" required
            value={email} onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="auth-field">
          <label htmlFor="password">Password</label>
          <input
            id="password" type="password" autoComplete="new-password" required
            value={password} onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <button className="auth-btn" type="submit" disabled={busy}>
          {busy ? 'Creating…' : 'Create account'}
        </button>
      </form>

      <p className="auth-alt">
        Already have one? <Link href={next !== '/desk' ? `/login?next=${encodeURIComponent(next)}` : '/login'}>Sign in</Link>
      </p>
    </div>
  );
}
