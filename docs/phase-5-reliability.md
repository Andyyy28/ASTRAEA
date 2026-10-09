# Phase 5 reliability rollout

Phase 5 is an additive application and database hardening release. It does not
reset a database or change production data by itself.

## Deployment order

1. Rotate any credentials that were previously exposed, then configure only
   `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and the Turnstile site key in
   browser build settings. Keep service-role, Turnstile secret, cleanup, and
   Telegram values in server/Edge Function secrets.
2. Back up the database and apply `20261003000200_phase5_reliability.sql` only
   after Phases 2–4 are recorded. Its preflight aborts if checkout or ledger
   objects are missing.
3. Build and deploy the storefront and functions together. Verify the new
   admin dashboard RPC, catalog archive action, date checks, and private proof
   viewing in staging.
4. Run `npm run cleanup:catalog-images` as a dry run. For an approved cleanup,
   pause catalog edits and submissions, then pass `--apply
   --maintenance-confirmed --project=<exact-project-host>` with a service-role
   secret. The utility rescans references immediately before deletion and only
   deletes managed UUID catalog objects older than 24 hours.

## Verification

Run `npm run lint`, `npm run check:secrets`, `npm run test:security`,
`npm audit --omit=dev --audit-level=high`, and `npm run build`. Test checkout
and admin flows in an isolated Supabase/Vercel preview with Manila timezone
boundaries, expired quotes, concurrent edits, and unavailable storage. The
Phase 5 migration has not been applied to production by this source change.

Tailwind 3's development-only file-watching dependency chain still reports
high npm audit advisories; upgrading to Tailwind 4 is a breaking configuration
change and must be validated separately before adopting it.

## Recovery and rollout requirements

Checkout persists its exact request before the commit call. A lost response
opens a recovery screen that replays the same UUID and payload, without another
proof upload or Turnstile initiation. Do not clear that browser record or start
a replacement order until the earlier attempt is confirmed. A persistent
rejection currently requires store assistance; automatic rejection recovery is
still outstanding. Browsers that cannot persist session storage cannot submit
orders, because reliable reload recovery cannot be guaranteed.

Before production cutover: rotate exposed credentials, back up database and
storage, review admin membership, verify proof migration, and physically
reconcile inventory. Browser reservation history is not a trustworthy stock
count. Pause submissions, keep legacy stock/upload grants revoked, apply
reconciled stock with version checks, then enable the coordinated backend and
frontend. Use synthetic records and a separate notification destination in
staging; never send production customer data in test notifications.

Rollback retains private proof storage, revoked credentials, and restrictive
policies. It must never restore public upload/stock RPC compatibility paths.
Monitor checkout failures, inventory invariant violations, overdue outbox
events, denied access, and cleanup failures. Pause submissions if invariants
fail. Catalog cleanup is dry-run by default and must run under maintenance
when deletion is enabled.

## Outstanding acceptance gates

See `tests/database/README.md` for the unexecuted database/HTTP concurrency and
permission matrix. A grant/RLS smoke script is prepared in
`tests/database/permissions.sql`; it has not been executed. Real fresh-install
and synthetic-legacy upgrade tests, worker overlap/crash tests, storage races,
staging mobile/accessibility tests, and live deployment header verification
are still required. Responsive image variants and complete contrast/form
accessibility verification also remain outstanding. The main browser chunk
still exceeds Vite's default 500 kB warning threshold.

Local checks use synthetic public build settings. A successful synthetic build
does not validate deployment credentials; the real Turnstile site key must be
configured. Production builds deliberately reject missing/placeholder required
values. No production migration, cleanup, deployment, or data mutation was
performed as part of this implementation.
