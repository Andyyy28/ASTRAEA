# Astraea Collection audit — 2026-09-28

The checkout and order timing changes are on `feature/preparation-and-qr`. They are not running safely in production yet. The new frontend briefly reached `main` while the production Supabase project still lacked `estimate_preparation_minutes` (`PGRST202`); `main` was restored. The production domain returned HTTP 200, but browser automation did not attach, so no claim is made about a complete live order.

## Completed on the feature branch

| Area | Finding and change |
| --- | --- |
| Custom design time | The builder and checkout show a provisional estimate based on stems, varieties, fillers, size, add-ons, wrapper, instructions and quantity. The database recomputes it and rejects a requested time that is too soon. Staff can confirm an actual time, which appears in tracking. Pickup or delivery remains a request until confirmed. |
| Website QR | `/share` and print-ready PNG/SVG files encode `https://astraeacollection.vercel.app/`, never `/admin`. The QR was decoded in an automated test. |
| Stock | The old cart reserved bouquet stock with no expiry and exposed release RPCs to anonymous callers. The feature branch checks availability in the cart and deducts stock transactionally at order placement. Cancellation restores quantities once. Old cart reservations need manual reconciliation before rollout. |
| Payment privacy | New proofs upload to a private bucket, capped at 5 MB, using short-lived staff preview links. Existing public proofs remain in their old bucket until migrated. |
| Bot credentials | The browser Telegram client has been disabled. Previous `VITE_TELEGRAM_BOT_TOKEN` deployments may have disclosed the token; rotate it and replace notifications with a server-side implementation. |
| Quality | Fixed four pre-existing lint errors, added integration checks for migration order, anonymous access, timing, stock rollback, cancellation, proof storage, and QR decode. Customer/admin routes are split into smaller bundles. |

## Release blockers

1. Apply `supabase/migrations/20260928_preparation_and_security.sql` to a staging copy first, then inspect existing stock and legacy payment proofs. Do not run `schema.sql` on the production database; it drops tables.
2. Verify cash and GCash orders, custom designs, staff timing, tracking, cancellation and actual bucket access against staging Supabase. The PGlite suite uses platform stubs and cannot replace this check.
3. Calibrate the minute formula with the florist. No real production-time measurements or opening hours were supplied. Staff still must check the queue, holidays, materials and delivery route.
4. Coordinate database and frontend deployment. Old clients call stock reservation functions that the new migration revokes. Prompt them to reload before accepting orders.

## Recommended next improvements

1. Add staff-defined opening hours, daily capacity and delivery travel zones, then offer only feasible slots. Distinguish the preparation finish from driver arrival.
2. Send an automatic confirmation when staff approve or change the ready time, using a server-side queue or webhook. Keep retries and deduplication so a notification failure does not duplicate orders.
3. Move GCash payment after staff confirms the design and slot, or provide a clear refund/change policy. Currently a customer can pay before the requested time is accepted.
4. Add rate limits and bot checks to public order, tracking and proof-upload endpoints. Add an idempotency key to checkout to prevent duplicate submissions after retry.
5. Migrate and delete old public proof files after confirming each copy and retention policy. Rotate the Telegram bot token if it was ever configured through a public Vite variable.
6. Measure QR scans on a real phone and print sample. Add an accessible fallback link and keep the branded URL visible beside the code.
7. Test mobile checkout and tracking with a production-like Supabase project and check keyboard navigation, date/time controls, payment error recovery and slow-network behavior.

## Verification

- The final frontend build completed with Vite after page splitting; the shared entry bundle is about 476 kB before gzip. Individual checkout, builder and staff pages load on demand.
- ESLint passed after the pre-existing errors were fixed.
- Five automated tests passed, including migration application in PGlite, order and stock behavior, and QR decode.
- The live production database timing RPC was missing on 2026-09-28, so this branch must remain out of production until the migration is installed.
- Dependency audit recorded ten advisories before dependency updates: six high, two moderate, two low. `npm audit fix` updated the lockfile within declared version ranges and then reported zero vulnerabilities. This has not been deployed.
