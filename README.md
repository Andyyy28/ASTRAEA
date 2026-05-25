# Astraea Collection

React/Vite storefront and admin panel backed by Supabase.

## Local Setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env`.
3. Set `VITE_SUPABASE_ANON_KEY` to the Supabase project's public anon key.
4. Start the app with `npm run dev`.

The configured Supabase project URL is:

```text
https://svldipwhfcguqsqlvhdt.supabase.co
```

## Database Setup

For a new Supabase project, run these SQL files in order in the SQL editor:

1. `supabase/schema.sql`
2. `supabase/migrations/20260525_secure_database.sql`

For an existing Astraea database that already has the application tables, run only:

```text
supabase/migrations/20260525_secure_database.sql
```

The migration enables row-level security and creates:

- Public read access for storefront catalog and reviews.
- Admin-only table management using `public.admin_users`.
- `place_order`, which inserts an order and its items transactionally and calculates prices in PostgreSQL.
- `track_order`, which requires a reference number plus matching email address or phone number.

## Admin Setup

Create an admin Auth user through Supabase Authentication, or set `ADMIN_EMAIL`
and `ADMIN_PASSWORD` in `.env` and run:

```sh
npm run create-admin
```

After the Auth user exists, enroll that user's UUID as an administrator in the
Supabase SQL editor:

```sql
INSERT INTO public.admin_users (user_id)
VALUES ('AUTH_USER_UUID')
ON CONFLICT (user_id) DO NOTHING;
```

Only authenticated users enrolled in `public.admin_users` can use admin data
operations. Do not store service-role keys in this frontend project.
