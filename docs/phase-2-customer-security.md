# Phase 2 customer API and payment-proof rollout

This phase moves guest writes behind the `guest-api` Supabase Edge Function. The browser no longer calls order, review, stock, tracking, or storage write APIs directly. The function uses the service role only after validating the request, Cloudflare Turnstile, the checkout session, and rate limits.

## Deployment order

1. Apply `supabase/migrations/20261001_phase2_customer_security.sql` in staging after every existing migration. It creates private checkout sessions and rate-limit tables, revokes anonymous RPC/table writes, makes `payment-proofs` private, and limits catalog storage writes to `public.is_admin()` members.
2. Configure Edge Function secrets. `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are required. Set `ALLOWED_ORIGINS` to the exact HTTPS storefront origin (comma-separated for approved preview origins), `TURNSTILE_SECRET_KEY`, and `TURNSTILE_EXPECTED_HOSTNAME`. Set `CLEANUP_SECRET` for the cleanup function. Do not put any of these values in Vite variables.
3. Configure `VITE_TURNSTILE_SITE_KEY` in the storefront build environment. If it is absent, checkout and review remain unavailable by design.
4. Deploy `guest-api`, `admin-payment-proof`, and `cleanup-payment-proofs`. Keep `ALLOW_LEGACY_PUBLIC_PROOFS=true` only during the migration window.
5. Run the migration utility in dry-run mode first:

   ```text
   npm run migrate:payment-proofs
   ```

   Review the count and skipped records. Copy and verify proofs with `--apply`; retain public originals until the verified rollout is complete. Only then, after an independent backup, use `--apply --delete-verified --confirm-delete`.

6. Schedule an authenticated POST to `cleanup-payment-proofs` with `Authorization: Bearer <CLEANUP_SECRET>` at least daily. It removes only stale objects in expired or missing checkout-session folders and never removes a proof belonging to a completed checkout.
7. After all references are private, remove `ALLOW_LEGACY_PUBLIC_PROOFS` and redeploy. Public legacy objects can then be deleted according to the approved retention plan.

The migration and utility do not modify production data automatically. The utility writes only when `--apply` is supplied and records resumable progress in the local checkpoint path.

## Request contract

`guest-api` accepts JSON actions `start-checkout`, `quote`, `checkout`, `review`, and `track`. Payment proofs use multipart form data with `action=proof-upload`, the checkout session id/token, and one file. The server accepts only JPEG, PNG, or WebP files up to 5 MiB and checks their signatures before writing a random path under `payment-proofs/<checkout-session-id>/`.

The tracking response contains order and item details only. It never returns payment-proof paths or URLs. Administrators use `admin-payment-proof` with a verified Supabase session and current `admin_users` membership; returned signed URLs expire after five minutes.

Bouquet cart reservations also use the guest function. A random reservation token is issued by the server and is required for a matching release; direct anonymous stock RPC execution is revoked. Unclaimed reservations expire after 30 minutes and are released by the cleanup function.

## Rollback

Rollback is a deployment rollback only. Do not re-grant anonymous RPC, review, or storage write permissions. If the guest function is unavailable, restore the function deployment and fix its configuration. Keep the migration applied so private objects and rate-limit data are not exposed.
