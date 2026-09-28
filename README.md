# Astraea Collection

React/Vite storefront and staff panel backed by Supabase. Public storefront: https://astraeacollection.vercel.app/ . Staff entry: `/admin`.

## Local setup

1. Install Node.js 22.12+ and run `npm ci`.
2. Copy `.env.example` to `.env`; set the project URL and public Supabase anon key. Never put a service-role key or Telegram token in a `VITE_` variable.
3. Run `npm run dev`. Use `npm run build`, `npm run lint`, and `npm test` for verification.
4. `/share` displays a downloadable QR code. `VITE_PUBLIC_SITE_URL` controls its destination; default is the deployed public storefront. Admin paths, queries and fragments are stripped.
5. `npm run qr` generates print-ready PNG and SVG files in `public/` for the default storefront URL. Change `DEFAULT_SITE_URL` before regenerating if the domain changes.

Without a valid Supabase key, the static UI and QR are available but catalog, checkout and staff data are not connected.

## Database installation

For an EMPTY development database only, run `supabase/schema.sql`, followed by every SQL file in `supabase/migrations/` in filename order. **schema.sql drops existing tables: never run it against a populated project.**

For an existing database, back up first and apply only missing migrations in filename order. The new migration is `20260928_preparation_and_security.sql`. It must be installed before deploying this frontend. The local integration test applies the entire sequence in an isolated PostgreSQL-compatible PGlite engine with Supabase auth/storage platform tables stubbed; this does not verify a hosted Supabase deployment.

Coordinate the migration and frontend release during a maintenance window: older clients use the now-revoked stock reservation functions and public proof uploads. Ask customers to reload. The new cart uses `astraea_cart_v2` and does not import legacy reservations. Staff must reconcile physical bouquet stock against open orders and abandoned old carts before reopening orders; the database cannot safely infer old reservation ownership.

New payment proofs go into the private `payment-proofs` bucket, limited to JPEG/PNG/WebP and 5 MB. Staff previews use signed URLs valid for ten minutes; reload the order to renew them. Existing proof URLs remain supported but old objects in public buckets must be reviewed and migrated separately; this release does not delete or relocate existing customer files.

## Preparation and handoff workflow

- The designer and checkout show provisional work estimates. Formula: 20 minutes + 8 per stem + 5 per flower entry + 3 per filler unit + 10 per selected add-on + 15 for medium / 30 for large + 10 for a wrapper + 30 for special design instructions. Round each custom bouquet up to 15 minutes, then multiply by order quantity. Ready-made items use 15 minutes each. These are uncalibrated planning defaults, not measured florist times.
- The same formula runs in PostgreSQL. Checkout requires a requested date/time in Asia/Manila and rejects requests earlier than now plus total preparation time. Multiple items are treated as sequential work.
- Same-day pickup can be requested if the estimate fits. Staff review actual design difficulty, stock, opening hours and the queue before confirming. Hours, holidays, queue capacity and delivery travel times are not automatically scheduled.
- In Admin > Orders > an order, enter the confirmed collection/delivery time and a customer-visible note. Customers see it through Track Order after verifying their reference and contact detail. Confirming a time does not automatically change order status or send a message.
- Staff mark an order Ready only when physically prepared. Ready means collection is possible, or a delivery order is prepared for dispatch. Completed means handed over. Cancelled/completed orders cannot be reopened via the status RPC.
- Stock is deducted transactionally on submission, not in the cart. Cancellation restores quantities once, including filler units and other products.

## Admin setup

Create an Auth user in the Supabase dashboard and enroll its UUID in `public.admin_users`. Alternatively set `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_EMAIL` and a unique `ADMIN_PASSWORD` locally and run `npm run create-admin`. Remove setup secrets afterward. No password is supplied by the repository.

## Notifications

Browser Telegram notifications are intentionally disabled because Vite variables are public. If a bot token was deployed previously, rotate it through BotFather. Implement notifications in a server-side function or database webhook triggered by verified order events, with retries and deduplication. Do not restore the client token approach.

## Deployment

Apply and verify the migration in staging, configure Vercel's public Supabase variables and `VITE_PUBLIC_SITE_URL`, then deploy the matching frontend. Test a cash pickup, a private GCash proof, an intricate custom order, staff timing confirmation, tracking and cancellation against staging before production. The feature branch is pushed; no production database migration has been run or verified.

The rollout branch is `feature/preparation-rollout`. The live `main` branch has the standalone QR page. The preparation flow was held because production Supabase did not yet have the new timing RPC (`PGRST202` on 2026-09-28). This branch is ready for staging review; it must not be merged or deployed until the database migration and verification steps above are complete. See `AUDIT.md` for findings and recommendations.
