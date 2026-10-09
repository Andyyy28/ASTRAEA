# Phase 3: transactional checkout and inventory

`20261002_phase3_transactional_checkout.sql` is an additive migration that must
be applied after the Phase 2 migration. It adds quote snapshots to checkout
sessions, request UUID idempotency to orders, canonical order item snapshots,
stock versions, the inventory movement and reconciliation ledgers, and a
durable notification outbox.

The guest API now creates an opaque quote token, and `commit_checkout` is the
only customer order write. The function verifies the session and quote expiry,
rechecks stock under deterministic locks, deducts all product types, records
movements, persists canonical descriptions and customization instructions,
enqueues `order.created`, and marks the session used in one transaction.

Cart changes are local only. Admin stock changes use the adjustment RPC or a
version-checked absolute correction; product edits do not write stock. Status
updates and cancellation use the guarded transition RPC, and payment status
uses its own admin RPC.

Legacy movement preparation is read-only. It creates movements only for
derivable non-cancelled records and writes reconciliation tasks for ambiguous
or historically unprovable deductions. It does not alter existing stock or
orders. The proof migration remains a separate resumable utility.

## Rollout and rollback

Apply the migration in staging, deploy the Edge API and frontend, run the
security tests, and verify notification worker claims/acknowledgements before
production. No production data is modified by this source change. A rollback
can deploy the previous API while leaving the additive columns and ledgers in
place; do not restore stock snapshots or delete historical movements. The old
reservation rows may be cleaned after their existing expiry window, once the
new API is confirmed in production.

After Phase 3 is recorded as applied, run the additive Phase 4 hardening
migration and its preflight checks from
[`docs/phase-4-migration-rollout.md`](phase-4-migration-rollout.md).
