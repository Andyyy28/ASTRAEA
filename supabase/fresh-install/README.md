# Canonical fresh-install chain

The files in `migrations/` are immutable copies of the application migrations
with unique timestamp versions. They are kept outside `supabase/migrations/`
so the Supabase CLI does not apply the same SQL twice to an existing project.

Use this chain only for a brand-new, empty Supabase database:

1. Apply `../schema.sql` once in the empty database.
2. Apply every file in `migrations/` in lexicographic order.
3. Configure Edge Function secrets and deploy the functions listed in
   `supabase/config.toml`.

`schema.sql` contains clean-slate table drops for historical compatibility. It
must never be used to upgrade an existing database or production project.

## Versioned order

| Version | Source migration |
| --- | --- |
| `20261004000100` | `20260525_secure_database.sql` |
| `20261004000200` | `20260529_admin_permissions_fix.sql` |
| `20261004000300` | `20260529_storage_buckets_and_policies.sql` |
| `20261004000400` | `20260530_bouquet_stock_monitoring.sql` |
| `20261004000500` | `20260530_custom_builder_inventory.sql` |
| `20261004000600` | `20260531_checkout_payment_and_facebook.sql` |
| `20261004000700` | `20260531_other_products.sql` |
| `20261004000800` | `20260531_reviews_feedback.sql` |
| `20261004000900` | `20260606_add_addon_images.sql` |
| `20261004001000` | `20260606_filler_colors_and_quantities.sql` |
| `20261004001100` | `20260606_remove_wrapper_price.sql` |
| `20261004001200` | `20261001_phase2_customer_security.sql` |
| `20261004001300` | `20261002_phase3_transactional_checkout.sql` |
| `20261004001400` | `20261003000100_rollout_hardening.sql` |
| `20261004001500` | `20261003000200_phase5_reliability.sql` |

For an existing database, do not run this chain or `schema.sql`. Apply only the
unapplied files under `supabase/migrations/` through the normal migration
deployment process, beginning with `20261003000100_rollout_hardening.sql`
after Phase 2 and Phase 3 are already recorded as applied, followed by
`20261003000200_phase5_reliability.sql`.
