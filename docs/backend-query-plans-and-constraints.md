# Backend Schema Constraints And Query Plans

Date: 2026-08-23

Prompt 07 adds
`backend/packages/backend-runtime/migrations/0009_schema_safeguards_and_access_paths.sql`.
It is expand-only: new columns, tables, indexes, triggers, and views are added
without dropping production UI-owned data or renaming existing v1 contract
columns.

## Migration Rules

- Migration files are append-only and checksum tracked in `app_migrations`.
- Runtime migration application takes a bounded PostgreSQL advisory lock named
  `connecto_migrations`; concurrent migrators fail on lock timeout instead of
  running duplicate DDL.
- Seed data stays in `backend/packages/backend-runtime/src/seed.ts`; migrations
  create structure and guarded product rules only.
- A migration that discovers unsafe previous data raises an explicit
  forward-fix error. It does not delete, merge, or rewrite user data.
- Rollback is operationally forward-fix only after production exposure. Add the
  next migration to repair data or relax an unsafe assumption.

## Database-Owned IDs

`app_uuid_v7()` creates sortable, non-guessable UUID values using millisecond
time bits plus random bytes from `pgcrypto`. Existing text identifiers remain
for frontend/API compatibility, while durable tables also receive unique
`database_id` values for future internal joins, support tooling, and extraction
prep.

## Constraint Probes

`pnpm db:smoke:migrate-seed` now runs these probes automatically after
migration and seed. `pnpm db:probe-constraints` runs the same checks as a
standalone command. Every probe runs inside a transaction, must fail with
SQLSTATE `23505` or `23514`, and is rolled back.

```sql
begin;

insert into refresh_token_families (
  account_id,
  device_id_hash,
  token_family_hash,
  status
)
values (
  'account_customer_1',
  repeat('e', 64),
  repeat('z', 64),
  'active'
);
-- expected: 23505 through refresh_token_families_one_active_per_device_uidx

rollback;
```

```sql
begin;

insert into audio_statuses (
  audio_status_id,
  host_id,
  status,
  last_checked_at,
  publication_status,
  version
)
values (
  'audio_status_duplicate',
  'host_anjali',
  'available',
  '2026-08-18T10:00:00.000Z',
  'published',
  1
);
-- expected: 23505 through audio_statuses_one_published_per_host_india_date_uidx

rollback;
```

```sql
begin;

insert into call_ratings (
  call_id,
  customer_id,
  host_id,
  rating
)
values (
  'call_1',
  'customer_1',
  'host_anjali',
  5
);
-- expected: 23505 through call_ratings_one_customer_rating_per_call_uidx

rollback;
```

```sql
begin;

insert into ledger_entries (
  entry_id,
  idempotency_scope,
  idempotency_key,
  entry_type,
  occurred_at
)
values (
  'entry_unbalanced_probe',
  'probe',
  'entry_unbalanced_probe',
  'wallet-credit',
  now()
);

insert into ledger_postings (
  posting_id,
  entry_id,
  account_id,
  direction,
  amount_paise
)
values (
  'posting_unbalanced_probe',
  'entry_unbalanced_probe',
  'acct_customer_wallet_customer_1',
  'credit',
  100
);
-- expected at commit: 23514 through ledger_entries_balance_constraint
-- or ledger_postings_balance_constraint

commit;
```

```sql
begin;

insert into payments (
  payment_id,
  customer_id,
  amount_paise,
  status,
  provider,
  provider_order_id
)
values (
  'payment_invalid_money_probe',
  'customer_1',
  -1,
  'created',
  'fake',
  'order_invalid_money_probe'
);
-- expected: 23514 through payments amount_paise checks

rollback;
```

## Access Paths

Representative production list and reconciliation queries should use these
indexes. The exact row estimates depend on data volume; the important property
is that the planner has a selective index and avoids full scans for common
operator paths. `pnpm db:explain-plans` captures these plans against whichever
PostgreSQL database `DATABASE_URL` points at; use a sanitized staging snapshot
for production-like estimates.

| Query family             | Representative query                                                                                                                                            | Expected index                            |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| Host discovery           | `select * from public_host_profiles where verification_status = 'verified' and availability in ('online','busy') order by language, rank, rating desc limit 20` | `hosts_discovery_idx`                     |
| Customer call history    | `select * from call_records where customer_id = $1 order by created_at desc limit 20`                                                                           | `call_records_customer_idx`               |
| Call finalization review | `select * from call_records where status = 'completed' order by ended_at desc limit 100`                                                                        | `call_records_status_ended_idx`           |
| Payment reconciliation   | `select * from payments where status in ('pending','verification-pending') order by updated_at asc limit 100`                                                   | `payments_status_updated_idx`             |
| Withdrawal operations    | `select * from withdrawals where status in ('requested','compliance-review','processing') order by requested_at asc limit 100`                                  | `withdrawals_status_requested_idx`        |
| Safety case lookup       | `select * from reports where kind = $1 and target_id = $2 order by created_at desc limit 50`                                                                    | `reports_target_idx`                      |
| Support queue            | `select * from support_tickets where status in ('open','waiting-on-support') order by created_at asc limit 100`                                                 | `support_tickets_status_created_idx`      |
| Outbox dispatch          | `select * from outbox_events where status in ('pending','failed') and available_at <= now() order by available_at, created_at limit 50`                         | `outbox_events_pending_idx`               |
| Media review queue       | `select * from media_asset_reviews where status = 'queued' order by submitted_at, priority limit 50`                                                            | `media_asset_reviews_queue_idx`           |
| Billing reconciliation   | `select * from call_billing_reconciliations where status = 'pending' order by created_at limit 100`                                                             | `call_billing_reconciliations_status_idx` |

## Privacy Boundary

`public_host_profiles` is the allowed profile projection for discovery and
public host reads. `host_private_verification_data` stores only hashes and media
asset references for legal identity, selfie, identity documents, and payout
metadata. Admin review surfaces must join through explicit review records and
redaction policies, not public profile lists.
