/**
 * Environment, read and validated in one place.
 *
 * Server-only. Nothing here may ever be imported into a Client Component — this
 * module reads the Supabase connection string and the OAuth secret, and a stray
 * `'use client'` import would try (and, thankfully, fail) to bundle them into
 * the browser. The values are read lazily, on first use, so that `next build`
 * collecting types on a machine without a full `.env.local` does not fall over.
 */
import 'server-only';

type Env = {
  DATABASE_URL: string;
  DIRECT_URL: string;
  JWT_ACCESS_SECRET: string;
  ARGON2_PEPPER: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GOOGLE_CALLBACK_URL: string;
  APP_ORIGIN: string;
  RESEND_API_KEY: string | undefined;
  EMAIL_FROM: string;
  isProd: boolean;
};

let cached: Env | null = null;

function required(name: string, min = 1): string {
  const v = process.env[name];
  if (!v || v.length < min) {
    throw new Error(
      `Missing or too-short env var ${name}` +
        (min > 1 ? ` (needs at least ${min} characters)` : '') +
        `. Copy .env.example to .env.local and fill it in.`,
    );
  }
  return v;
}

export function env(): Env {
  if (cached) return cached;
  cached = {
    DATABASE_URL: required('DATABASE_URL'),
    // Migrations need a session connection; the app itself never touches this.
    DIRECT_URL: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? '',
    JWT_ACCESS_SECRET: required('JWT_ACCESS_SECRET', 32),
    ARGON2_PEPPER: required('ARGON2_PEPPER', 16),
    GOOGLE_CLIENT_ID: required('GOOGLE_CLIENT_ID'),
    GOOGLE_CLIENT_SECRET: required('GOOGLE_CLIENT_SECRET'),
    GOOGLE_CALLBACK_URL: required('GOOGLE_CALLBACK_URL'),
    APP_ORIGIN: process.env.APP_ORIGIN ?? 'http://localhost:3000',
    RESEND_API_KEY: process.env.RESEND_API_KEY || undefined,
    EMAIL_FROM: process.env.EMAIL_FROM ?? 'Starry <onboarding@resend.dev>',
    isProd: process.env.NODE_ENV === 'production',
  };
  return cached;
}
