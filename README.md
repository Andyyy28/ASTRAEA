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

Database setup has separate fresh-install and upgrade procedures. Do not run
`supabase/schema.sql` or `supabase db reset` against an existing database; the
schema contains historical clean-slate drops.

- For a brand-new empty project, follow
  [`supabase/fresh-install/README.md`](supabase/fresh-install/README.md).
- For an existing project, apply only unapplied files under
  `supabase/migrations/` in their timestamp order through a reviewed staging
  deployment. Phase 4 must run after Phase 2 and Phase 3. Follow the
  [Phase 4 rollout runbook](docs/phase-4-migration-rollout.md).

The additive chain preserves existing orders, references, prices, and stock;
the Phase 4 migration fails before commit if required schema, data, publication,
or policy preconditions are not met.

## Admin Setup

There are no default administrator credentials or browser signup/bypass paths.
Create and verify an Auth user through Supabase's invitation/confirmation workflow,
then select that user's UUID explicitly:

```sh
npm run create-admin -- --user-id AUTH_USER_UUID
```

The script requires VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the ignored
local .env. It enrolls only a verified non-anonymous email account, and never changes
an existing password or confirms its email. Keep service-role keys out of Vercel
frontend configuration and all VITE_ variables.

Optional account creation is explicit: set ADMIN_EMAIL and a unique randomly
generated ADMIN_PASSWORD (at least 20 characters), then run
`npm run create-admin -- --create`. This creates an unverified account without
admin membership. Complete Supabase email verification, then enroll its UUID.
No password-reset operation is provided. Remove local provisioning secrets when
finished; never commit them.

## Phase 1 security preparation

See [the Phase 1 runbook](docs/phase-1-security.md) before deploying these changes.
Browser Telegram sending is disabled. The replacement worker needs a deferred
database outbox and scheduler; notification delivery is not enabled by code alone.
Admin proof viewing requires the new authorized Edge Function. Existing payment
proofs remain public until their separate migration and checkout integration.
Database migrations, checkout, inventory, and live settings were not changed in
this phase. The separate fresh-install and upgrade procedures below are the
canonical database bootstrap after Phase 4.

## Phase 2 customer API and payment proofs

Apply `supabase/migrations/20261001_phase2_customer_security.sql` after the existing
migrations in staging, then configure and deploy the `guest-api`,
`admin-payment-proof`, and `cleanup-payment-proofs` Edge Functions. Set their
service-role, Turnstile, exact `ALLOWED_ORIGINS`, and cleanup secrets; set only the
public `VITE_TURNSTILE_SITE_KEY` in the storefront build. Follow the complete
[Phase 2 rollout runbook](docs/phase-2-customer-security.md), including the dry-run
proof migration before any optional deletion of public originals.

## Phase 3 transactional checkout and inventory

Apply `supabase/migrations/20261002_phase3_transactional_checkout.sql` only after
Phase 2 in staging. It adds quote-backed checkout, idempotent transactional
stock deductions, cancellation reversal, inventory reconciliation, and the
notification outbox. Follow the [Phase 3 runbook](docs/phase-3-transactional-checkout.md).

## Phase 4 migration and rollout safety

Apply `supabase/migrations/20261003000100_rollout_hardening.sql` after Phase 3.
It is additive, checks the live schema and policies before commit, preserves
historical migration files, and keeps old public stock RPCs disabled. Follow
the [Phase 4 rollout runbook](docs/phase-4-migration-rollout.md).
