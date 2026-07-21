'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api, isOk } from '@/lib/api';
import { AuthBrand, ERROR_COPY } from '../parts';

export function VerifyForm() {
  const email = useSearchParams().get('email') || '';
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resent, setResent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await api<{ user: { role: string } }>('/api/v1/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ email, code }),
    });
    if (isOk(res)) {
      // Verifying signs you in — go straight to the desk.
      window.location.assign(res.data.user.role === 'admin' ? '/admin' : '/desk');
      return;
    }
    setError(ERROR_COPY[res.error.code] ?? res.error.message);
    setBusy(false);
  }

  async function resend() {
    setResent(true);
    await api('/api/v1/auth/resend-otp', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  return (
    <div className="auth-card">
      <AuthBrand />
      <h1 className="auth-title">Check your email</h1>
      <p className="auth-note">
        We sent a six-digit code to <strong>{email || 'your email'}</strong>. Enter it below. It
        expires in ten minutes.
      </p>

      {error && <p className="auth-error" role="alert">{error}</p>}

      <form onSubmit={onSubmit} noValidate>
        <div className="auth-field">
          <label htmlFor="code">Verification code</label>
          <input
            id="code"
            className="auth-code-input"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            required
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          />
        </div>
        <button className="auth-btn" type="submit" disabled={busy || code.length < 6}>
          {busy ? 'Verifying…' : 'Verify'}
        </button>
      </form>

      <p className="auth-alt">
        {resent ? (
          'A new code is on its way.'
        ) : (
          <button
            type="button"
            onClick={resend}
            style={{ background: 'none', border: 0, color: '#0b3ecc', cursor: 'pointer', padding: 0, font: 'inherit' }}
          >
            Didn’t get it? Send another
          </button>
        )}
      </p>
    </div>
  );
}
