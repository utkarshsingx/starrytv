'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api, isOk } from '@/lib/api';
import { AuthBrand, GoogleButton, ERROR_COPY } from '../parts';

export function LoginForm() {
  const params = useSearchParams();
  const next = params.get('next') || '/desk';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  // A code arriving in the URL (e.g. from the Google callback) shows first.
  const [error, setError] = useState<string | null>(() => {
    const e = params.get('error');
    return e ? (ERROR_COPY[e] ?? 'Sign-in did not complete.') : null;
  });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await api<{ user: { role: string } }>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (isOk(res)) {
      // A hard navigation, not router.push — the middleware reads the freshly
      // set st_role cookie to route, and we want a clean server render of the
      // signed-in surface rather than client state carried over.
      window.location.assign(res.data.user.role === 'admin' ? '/admin' : next);
      return;
    }
    setError(ERROR_COPY[res.error.code] ?? res.error.message);
    setBusy(false);
  }

  return (
    <div className="auth-card">
      <AuthBrand />
      <h1 className="auth-title">Sign in</h1>
      <p className="auth-stand">Your shelf, your quotes, and everything you have been reading.</p>

      {error && <p className="auth-error" role="alert">{error}</p>}

      <GoogleButton next={next} />
      <div className="auth-or">or</div>

      <form onSubmit={onSubmit} noValidate>
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
            id="password" type="password" autoComplete="current-password" required
            value={password} onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <button className="auth-btn" type="submit" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <p className="auth-alt">
        New here? <Link href={next !== '/desk' ? `/signup?next=${encodeURIComponent(next)}` : '/signup'}>Create an account</Link>
      </p>
    </div>
  );
}
