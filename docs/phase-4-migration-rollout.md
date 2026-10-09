# Phase 4: migration and rollout safety

Phase 4 adds `supabase/migrations/20261003000100_rollout_hardening.sql`. It is
an additive upgrade. It does not reset tables, delete customer data, rewrite
historical migration files, or change inventory quantities.

## Before production

1. Take the normal provider backup and record the current migration history.
2. Restore a recent backup into a staging project and apply the unapplied
   migrations in order through Phase 3.
3. Apply `20261003000100_rollout_hardening.sql` in staging. Its preflight checks
   stop the transaction if required tables/columns are missing, existing data
   violates the new checks, the realtime publication is absent, or an unsafe
   policy remains. A failed transaction leaves the database unchanged.
4. Verify the policy catalog, function privileges, indexes, constraints, and
   realtime publication entries listed in the migration.
5. Deploy the Edge Functions with service-role credentials only on the server.
   Run the security tests and a read-only storefront/admin smoke test before
   promoting the migration.

## Existing-database upgrade

Use the linked project's normal migration command or apply only the pending
files from `supabase/migrations/` in a reviewed deployment. Never run
`supabase db reset`, `DROP TABLE`, or `supabase/schema.sql` against an existing
database. If the Phase 4 preflight reports a policy or data problem, stop,
review the named catalog/data rows in staging, remediate them with a separate
reviewed migration, and retry.

## Fresh installation

For a genuinely empty database, follow
[`supabase/fresh-install/README.md`](../supabase/fresh-install/README.md).
That runbook is separate because `supabase/schema.sql` contains the historical
clean-slate drops needed to make a disposable database repeatable.

## Objects hardened

The migration adds or verifies quote/idempotency checks, expiry/order indexes,
inventory cancellation and reconciliation indexes, notification outbox
indexes, order/order-item realtime publication entries, server-only function
grants, private payment-proof storage, and removal of live anonymous/public
customer-write policies discovered from `pg_policies`.

The migration does not publish internal checkout, inventory-ledger, or
notification-outbox tables to realtime. Old public stock RPC execute grants
are revoked and are not used as fallbacks.

## Rollback and data protection

Do not reverse the migration by restoring stock snapshots or deleting ledger
rows. If deployment must be rolled back, deploy the previous application code
while leaving the additive schema and restrictive grants in place. Resolve any
preflight failure in staging first; no production SQL is run by this source
change.
