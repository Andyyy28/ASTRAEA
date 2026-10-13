# Checkout backend repair

The production storefront called `guest-api`, but the Supabase project had no
Edge Functions. The request returned `404 NOT_FOUND`. Checkout hid this response
behind a generic security-verification error, even when the Turnstile widget had
succeeded. The project also lacked the checkout session/rate-limit tables and
the quote/commit RPCs required by the deployed frontend.

`20261013122406_repair_guest_checkout.sql` restores these prerequisites without
rewriting existing orders, stock counts, or admin catalog controls. It uses the
existing transactional quote/commit implementation, adds schedule validation,
and locks the session before checking an idempotent retry. New checkout tables
and RPCs are accessible only to `service_role`.

The `guest-api` deployment has JWT gateway verification disabled because guests
authenticate with server-verified Turnstile and opaque checkout session tokens.
Its default allowed origin and expected Turnstile hostname are the exact live
storefront, `https://astraeacollection.vercel.app`. `ALLOWED_ORIGINS` and
`TURNSTILE_EXPECTED_HOSTNAME` secrets can override these for another deployment.
`TURNSTILE_SECRET_KEY` remains required and must match the public widget key in
the storefront build. Never use a Cloudflare test secret in production.

Checkout now reads known error codes from Supabase HTTP responses and distinguishes
missing backend/configuration, rate limits, and expired verification. Unknown
server messages are not shown to customers. Existing order recovery remains
unchanged.

Verification: `npm run test:ci`, focused guest API tests, live CORS preflight,
and `tests/database/checkout_repair.sql` inside `BEGIN`/`ROLLBACK`. The database
test creates only synthetic records, checks catalog pricing, a successful cash
checkout, stock/outbox/ledger writes, idempotent replay, and private permissions.
It must always be rolled back. The repair migration and guest Edge Function were
applied to the connected production project; frontend error handling is deployed
through Vercel. A real customer checkout still requires the customer's live
Turnstile challenge.
