# Telegram notification repair

An order successfully committed an `order.created` notification event, but no
worker attempted it. The deployed project lacked `notification-worker`, the
claim/acknowledge/retry RPCs, and a scheduled invocation.

`20261013124740_repair_telegram_notifications.sql` installs the missing queue
functions and prepares the `astraea-telegram-notifications` cron job to run each
minute. A new installation starts with the job inactive until the configured
Telegram destination has been checked and delivery enabled. Reapplying the setup
preserves an existing job's activation state. Orders and inventory are untouched.

The scheduler's dedicated random credential is generated inside Supabase Vault.
The worker validates its hash through a service-role-only RPC. Plaintext is never
exported to source files, tool output, or browser code. An optional
`NOTIFICATION_WORKER_SECRET` Edge secret still supports direct authenticated
invocation. The bot token and destination must be configured as
`TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` in Edge Function secrets.

The cron transport sends an empty JSON object. The worker accepts this and still
rejects caller-supplied order IDs, message text, or recipient overrides. A dry run
authenticates and calls only Telegram `getMe`/`getChat`; it neither claims an event
nor sends a message:

```sql
select public.dispatch_notification_worker(true);
```

Inspect the returned request ID in `net._http_response` for HTTP 200 with
`{"ready":true}`. Responses distinguish missing Telegram settings, an unavailable
bot, and an unavailable chat without returning credentials or raw fetch errors.

After delivery is authorized, enable the prepared job and dispatch the pending
queue once:

```sql
select cron.alter_job(
  (select jobid from cron.job where jobname='astraea-telegram-notifications'),
  active := true
);
select public.dispatch_notification_worker();
```

Monitor `notification_events.completed_at`, `attempts`, and `last_error` along
with cron/HTTP responses. Claims use expiring leases; stale workers cannot
acknowledge another worker's lease. Retries are delayed and stop after ten
attempts. An ambiguous Telegram send followed by a lost acknowledgement can
still produce duplicate alerts, since Telegram delivery is at least once.

Verification uses the focused Node worker tests and the rollback-only
`tests/database/notification_repair.sql` checks. These cover authentication,
empty-body transport, dry runs, abandoned leases, wrong/expired acknowledgements,
retries, and access restrictions. They do not claim to prove simultaneous workers
or exactly-once Telegram delivery.

## Server read permissions

The live queue initially failed with `record_unavailable` even after the bot and
chat settings were saved. The existing `service_role` bypassed RLS but lacked
SQL SELECT privileges on the canonical order, item, catalog, and review tables.
`20261028093557_grant_notification_worker_reads.sql` restores those server-only
read permissions. It grants no browser access or write privileges.

The repair was checked with rollback-only queries under `SET LOCAL ROLE
service_role`, including the order-item catalog joins. Live verification then
returned `delivered: 2, retrying: 0`, with no pending events and a successful
scheduled cron run. Telegram credentials remain in Edge Function secrets and
are not part of repository files.
