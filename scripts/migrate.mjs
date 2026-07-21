/**
 * Migration runner.
 *
 *   npm run db:migrate          apply every pending migration
 *   npm run db:migrate:status   list applied vs pending, apply nothing
 *
 * Runs each `src/server/db/migrations/*.sql` in filename order, once, inside a
 * transaction, recording it in `schema_migrations`. Re-running is a no-op.
 *
 * It connects on DIRECT_URL (a real session connection, port 5432), NOT the
 * transaction pooler the app uses: DDL and multi-statement transactions want a
 * session, and prepared statements work there. If the direct db.<ref> host
 * refuses to connect from your machine (Supabase's direct endpoint is IPv6-only
 * on the free tier), set DIRECT_URL to the **Session pooler** string from
 * Supabase → Connect (port 5432, host aws-0-<region>.pooler.supabase.com), which
 * is IPv4.
 */
import postgres from 'postgres';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { config } from 'dotenv';

config({ path: '.env.local' });

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'server', 'db', 'migrations');
const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
const statusOnly = process.argv.includes('--status');

if (!url) {
  console.error('No DIRECT_URL or DATABASE_URL in .env.local. Fill it in first.');
  process.exit(1);
}

const sql = postgres(url, { max: 1, connect_timeout: 20, onnotice: () => {} });

try {
  await sql`
    create table if not exists schema_migrations (
      name text primary key,
      applied_at timestamptz not null default now()
    )`;

  const applied = new Set(
    (await sql`select name from schema_migrations`).map((r) => r.name),
  );
  const files = readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort();

  const pending = files.filter((f) => !applied.has(f));
  console.log(`${applied.size} applied, ${pending.length} pending`);

  if (statusOnly) {
    for (const f of files) console.log(`  ${applied.has(f) ? '✓' : '·'} ${f}`);
    process.exit(0);
  }

  for (const file of pending) {
    const text = readFileSync(join(DIR, file), 'utf8');
    process.stdout.write(`  applying ${file} … `);
    // The migration and its bookkeeping row commit together or not at all.
    await sql.begin(async (tx) => {
      await tx.unsafe(text);
      await tx`insert into schema_migrations (name) values (${file})`;
    });
    console.log('ok');
  }
  console.log(pending.length ? 'done' : 'nothing to do');
} catch (err) {
  console.error('\nmigration failed:', err.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
