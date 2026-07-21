/**
 * Promote an account to admin.
 *
 *   npm run seed:admin -- you@example.com
 *
 * The first admin cannot be made through the app — there is no admin yet to do
 * it — so it is done here, directly against the database, on purpose. After
 * that, admins are managed from the console. Run it against an account that has
 * already signed up.
 */
import postgres from 'postgres';
import { config } from 'dotenv';

config({ path: '.env.local' });

const email = process.argv[2];
if (!email) {
  console.error('Usage: npm run seed:admin -- <email>');
  process.exit(1);
}

const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!url) {
  console.error('No DIRECT_URL or DATABASE_URL in .env.local.');
  process.exit(1);
}

const sql = postgres(url, { max: 1, connect_timeout: 20, prepare: false });
try {
  const rows = await sql`
    update users set role = 'admin', updated_at = now()
    where email = ${email.toLowerCase()} and deleted_at is null
    returning email, role`;
  if (rows.length === 0) {
    console.error(`No account found for ${email}. Sign up first, then run this.`);
    process.exitCode = 1;
  } else {
    console.log(`${rows[0].email} is now ${rows[0].role}.`);
  }
} finally {
  await sql.end();
}
