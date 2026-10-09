# Isolated database acceptance gate

The Node security tests use mocks. They do not prove SQL transactions, RLS,
storage policies, or migration validity. `permissions.sql` is a prepared smoke
test and has not been executed locally: PostgreSQL, Supabase CLI, and Docker are
not installed in the current workspace environment.

Use a separate Supabase project containing only synthetic data and a separate
notification destination. Apply the canonical fresh-install chain on one
database and the upgrade chain on a second database seeded with synthetic legacy
orders. Never point these tests at production. Run with `ON_ERROR_STOP=1`:

```sh
psql "$ISOLATED_DATABASE_URL" -v ON_ERROR_STOP=1 -f tests/database/permissions.sql
```

Before rollout, implement and execute the remaining integration scenarios below
using independent database connections and real HTTP identities. Record results
for both installations; these are outstanding tests, not passing assertions.

| Scenario | Required assertion |
| --- | --- |
| Two buyers, last unit | Exactly one committed order; stock never negative; one deduction/outbox event |
| Repeated product lines and custom components | Aggregate all quantities before locking/deducting; preserve canonical snapshots |
| Concurrent identical UUID | Both retries eventually return the same order/reference/total; no duplicate deduction |
| Same UUID, changed input | Rejected; original order unchanged |
| Lost response then expired quote / midnight Manila | Exact replay returns committed result; new checkout with past date denied |
| Cancellation retries | Restore each recorded movement once; completed/cancelled orders cannot reopen |
| Concurrent admin edits | Atomic deltas retained; stale absolute correction rejected |
| Anonymous / ordinary / expired / admin HTTP identities | Tables, RPCs, storage and Edge endpoints allow only intended operations; timeouts deny access |
| Proof upload racing checkout and cleanup | No committed proof deleted; wrong-session proof rejected; signed URLs expire after five minutes |
| Outbox worker overlap and crash | One active lease; retry recovers abandoned lease; no acknowledgement before successful send |
| Synthetic legacy orders | References/prices survive upgrade; incomplete movement quantities flagged rather than invented |

Also verify mobile storefront/admin flows in a Vercel preview at 360, 390, 768,
and 1280 CSS pixels, keyboard-only navigation, deployed CSP/realtime/Turnstile,
and storage-denied behavior. Deployment remains blocked until these checks pass.
