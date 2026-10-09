# Phase 1 security preparation

This change fixes browser credential exposure and fail-open admin authentication,
and prepares trusted notification/proof-viewing handlers. It does **not** change
checkout, inventory, SQL migrations, production configuration, or existing proofs.
Do not deploy the frontend until its backend prerequisites are satisfied.

## Credentials and administrator provisioning

1. Revoke the previously exposed Telegram token through BotFather. A code change
   cannot invalidate credentials in old deployments, browser caches, or downloaded
   bundles. Replace it in Supabase Edge secrets, never frontend environment variables.
2. Remove obsolete browser Telegram variables and the development admin bypass from
   Vercel and local environment configuration. Rotate any password using the published
   default using Supabase's secure account-management workflow.
3. Review administrator membership explicitly. Preserve verified legitimate admins;
   do not automatically revoke or grant membership based on email strings.
4. Enroll only a selected, verified Auth UUID with `npm run create-admin -- --user-id UUID`.
   Existing accounts are not modified. `--create` needs explicit ADMIN_EMAIL and a
   random password of at least 20 characters; it creates an unverified **non-admin**
   account and does not send a confirmation email. Arrange email ownership verification
   through the supported Supabase invitation/confirmation workflow before enrollment.
   Use the dashboard invitation workflow instead when email delivery is required.

The browser now denies admin access if membership cannot be verified. This does
not replace database RLS. Do not disable RLS or restore fail-open checks to resolve
a deployment permission problem. Public catalog reads must remain functional.

## Edge Function configuration

Install/deploy functions using a separately configured Supabase CLI environment.
The repository's config.toml configures functions only; it is not a repaired
database bootstrap. No CLI installation or deployment is performed by this change.

| Secret | Consumer |
| --- | --- |
| TELEGRAM_BOT_TOKEN | notification-worker only |
| TELEGRAM_CHAT_ID | notification-worker only |
| NOTIFICATION_WORKER_SECRET | Independent random scheduler bearer secret, at least 32 characters |
| ALLOWED_ORIGINS | Exact comma-separated frontend origins for admin-payment-proof |
| ALLOW_LEGACY_PUBLIC_PROOFS | Optional temporary `true` for existing public proofs; default false |

SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are supplied by the deployed Supabase
runtime. Service-role clients do not persist sessions and are never returned to
callers. Never place these credentials into VITE_ variables. Do not put secret
values in shell command arguments, checked-in files, scheduler SQL, or logs.
Keep scheduler invocation credentials in Vault; use the custom bearer credential
in the request Authorization header. The worker rejects unauthenticated callers
and accepts no customer payload or arbitrary notification target.

`admin-payment-proof` keeps platform JWT verification enabled and also verifies
the token through Auth before checking administrator membership. Its body is
only `{ "order_id": "UUID" }`. It returns a five-minute signed URL with no-store
response headers. It never signs a path supplied by the request.

## Deferred notification database contract — deployment blocker

No SQL is included/applied in this phase. The worker deliberately returns 503 when
the following backend-only RPCs are unavailable:

- `claim_notification_events(p_limit integer, p_lease_seconds integer)` returns at
  most five leased events: id UUID, event_type (`order.created` or `review.created`),
  entity_id UUID, claim_token UUID, attempts integer. It atomically claims due events
  using row locks with SKIP LOCKED, counts attempts, and reclaims expired leases.
- `complete_notification_event(p_id UUID, p_claim_token UUID)` returns boolean;
  mark delivered only if the matching lease is current and unexpired.
- `retry_notification_event(p_id UUID, p_claim_token UUID,
  p_retry_after_seconds integer, p_error_code text)` returns boolean; release only
  a matching current lease, set the next attempt, and retain a sanitized error code.
  Stop automatic retries after ten attempts and expose dead-letter events for
  operational review. Clamp retry delays between 60 seconds and one day.

The outbox needs unique `(event_type, entity_id)` entries inserted in the same
transaction as new orders/reviews. Do not generate entries for existing rows or
every edit. Revoke all outbox/RPC access from PUBLIC, anon, and authenticated;
grant only to service_role. Validate RPC limits and lease ownership server-side.
Use a SECURITY DEFINER implementation with a fixed safe search_path if required.

Schedule the worker every minute. Batch size is five and lease duration is 120
seconds. Test overlapping workers, worker crashes, late acknowledgements, retry
exhaustion, and Telegram rate limits. Worker HTTP calls have bounded timeouts.
Notification errors do not roll back committed customer submissions. An ambiguous
delivery/acknowledgement failure can duplicate a Telegram message; delivery is
at-least-once, not exactly-once. Keep messages bounded, escaped, and free of proof URLs.

The browser compatibility notification exports return `client-disabled` and make
no requests. **Deploying the frontend without a working outbox stops notifications.**
Configure the backend first, stop legacy frontend submissions briefly at cutover,
then enable event enqueueing and release the new frontend together to avoid double
notifications from old browser clients. Do not restore the exposed token.

## Deferred database/storage permissions — deployment blocker

Review actual grants and all permissive/restrictive policies on the existing
project before preparing a separate hardening migration. This phase does not
alter historical migrations or policies:

- Enable/retain RLS on protected tables. Only verified admin membership may manage
  catalog, inventory, orders, reviews, and settings. Public reads remain limited
  to intended catalog/displayed-review data. Authenticated users may read their
  own membership only; service_role manages enrollment. Harden is_admin with a
  fixed safe search_path and no anonymous execution dependency in public policies.
- Catalog buckets bouquets, images, addons, and other-products remain public for
  retrieval. Authenticated INSERT/UPDATE/DELETE must require admin membership in
  both applicable USING and WITH CHECK clauses. Remove overlapping broad policies.
- Keep checkout RPC access unchanged until the later checkout security cutover;
  do not revoke it in this phase and break existing orders. Existing public stock
  RPC vulnerabilities remain unresolved until the inventory phase.

## Deferred proof privacy and compatibility

Create a separate private payment-proofs bucket with a five-MiB size limit and
JPEG/PNG/WebP MIME restrictions. The later trusted upload handler must additionally
validate signatures and ownership; bucket MIME restrictions alone are insufficient.
Use random UUID filenames. The current viewer recognizes private references as
`payment-proofs/<UUID>.<jpg|jpeg|png|webp>` stored in the existing payment_proof_url
field; it signs the object inside the separate payment-proofs bucket. A future
dedicated path column can be introduced in the later migration, with matching viewer
changes. The handler verifies that this bucket is actually private before signing.

The existing checkout still uploads public proofs to bouquets. To preserve viewing
until the separately authorized migration, deploy admin-payment-proof with
ALLOW_LEGACY_PUBLIC_PROOFS=true. Only exact URLs from this project's public bouquets
payment-proofs prefix are recognized. Other origins, query parameters, traversal,
and caller-supplied paths are rejected. The returned signed URL **does not privatize
the original**. No proof content has been copied or deleted by this phase.

Before declaring proof privacy fixed: implement the checkout integration, migrate
and verify existing objects/references, remove public originals, revoke anonymous
legacy uploads, and set ALLOW_LEGACY_PUBLIC_PROOFS=false. Never privatize the shared
bouquets bucket, which would break catalog images. Do not publish proof information
through tracking or notification payloads. Preserve existing proof data until copy
verification succeeds.

## Validation and staged deployment

Run `npm run test:security`, changed-file lint, full lint, and a production build
outside the checkout. Full lint has previously reported unrelated failures; those
remain deferred rather than suppressed. Verify browser assets contain no Telegram
token or admin password and cannot expose non-public environment variables.

Use staging for function deployment and database policy tests with anonymous,
ordinary authenticated, expired-session, and verified-admin identities. Ordinary
users must not modify catalog images/data or self-enroll; non-admin sessions must
not obtain signed proofs. Test membership removal and missing-RPC failures.

Deploy admin-payment-proof before the updated admin frontend. Check signed URL
refresh and legacy viewing. Activate the notification outbox/worker before browser
notification removal reaches production. Production rollout remains blocked while
the deferred SQL/proof prerequisites are unavailable. Keep secure policies and
revoked credentials in any rollback; never restore vulnerable client sending.
