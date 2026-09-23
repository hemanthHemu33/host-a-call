# API Migration Notes

Date: 2026-08-21

## API version 1.0.0

Initial `/v1` contract baseline for the completed frontend integration work.
No breaking migration is active at creation time.

## Completed Adapter Migrations

- Shared HTTP services plus feature-local call/referral adapters now call
  `/v1` paths.
- Shared list methods consume `{ items, pageInfo }` cursor envelopes while
  preserving existing array-returning service methods for UI callers.
- Shared mutating HTTP requests now send deterministic `Idempotency-Key`
  headers when a caller has not supplied one.
- Shared `PATCH`/`PUT` requests now send default `If-Match: *`; production UI
  flows should replace this with resource ETags where user-facing conflict
  resolution is required.
- DB-backed `/v1` call, payment, withdrawal, refund, report, account deletion,
  host review, and host verification mutations now run canonical command
  helpers and persist domain transition/outbox records.
- Account status, delete-account, match-tag, host self-introduction, host daily
  status, voice verification, identity verification, and host agreement routes
  are now production contract entries.
- Provider callback finalizers for RTC, Razorpay, payout, object storage, and
  FCM now require provider event id plus signature verification.
- Signed upload assets now persist owner, expiry, redaction, and review status;
  redacted admin media review routes are available at `/v1/admin/media-reviews`.
- Worker dispatch now handles billing reconciliation, media review queueing, and
  discovery cache invalidation from PostgreSQL outbox rows.
- Fake-mode provider smoke checks are executable with `pnpm providers:smoke`.
- Docker/Postgres-backed migrate+seed smoke is executable in CI through
  `.github/workflows/backend-db-smoke.yml`.
- Prompt 07 schema safeguards are now encoded in migration `0009`: sortable
  database IDs, refresh-token family uniqueness, one published daily audio
  status per host, connected-call rating uniqueness, unique provider event IDs,
  unique referral attribution, deferred balanced-ledger enforcement, private
  host verification storage, and documented query-plan probes.
- `POST /v1/calls/:callId/rating` now persists through `call_ratings`, hashes
  optional comments instead of storing free text, relies on the DB connected-call
  constraint, and emits `call.rating_submitted`.
- `pnpm db:smoke:migrate-seed` now runs migration, seed, canonical row checks,
  Prompt 07 constraint probes, and `EXPLAIN ANALYZE` plan capture.

## Pending Migrations

- Provide real sandbox/live accounts and server-only secrets for Agora,
  Razorpay, payout, storage, moderation, tagging, and FCM, then run
  `pnpm providers:smoke` with those provider modes.
- Run `pnpm db:explain-plans` against a sanitized staging snapshot by pointing
  `DATABASE_URL` at that snapshot before production rollout.
