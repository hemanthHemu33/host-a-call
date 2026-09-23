# Backend Workspace

Date: 2026-08-21

The backend bootstrap adds one API process, one worker process, one shared
backend runtime package, PostgreSQL, Redis, and Azurite-compatible local object
storage. It remains a modular monolith; the worker is a separate process for
background jobs, not a separate service boundary.

All backend-owned deployables and backend-only platform packages live under the
top-level `backend/` folder. Shared contracts and domain packages that are used
by frontend and backend stay in root `packages/`.

## Local Commands

| Command                       | Purpose                                                               |
| ----------------------------- | --------------------------------------------------------------------- |
| `pnpm install`                | Install the monorepo from the deterministic lockfile                  |
| `pnpm infra:backend:up`       | Start PostgreSQL, Redis, and Azurite with Docker Compose              |
| `pnpm db:validate-migrations` | Validate SQL migration filenames and duplicate versions               |
| `pnpm db:migrate`             | Apply pending backend SQL migrations to PostgreSQL                    |
| `pnpm db:seed`                | Insert deterministic local seed data with no PII fixtures             |
| `pnpm db:probe-constraints`   | Apply migrations/seed and verify DB constraints reject invalid writes |
| `pnpm db:explain-plans`       | Capture `EXPLAIN ANALYZE` plans for key backend access paths          |
| `pnpm db:smoke:migrate-seed`  | Apply migrations, seed, probe constraints, and capture query plans    |
| `pnpm providers:smoke`        | Exercise all configured provider boundaries in fake/sandbox/live mode |
| `pnpm dev:api`                | Run the API from `backend/apps/api`                                   |
| `pnpm dev:worker`             | Run the worker from `backend/apps/worker`                             |
| `pnpm dev:backend`            | Run API and worker together                                           |
| `pnpm check:backend`          | Validate migrations, run backend tests, and build backend             |
| `pnpm infra:backend:down`     | Stop local backend infrastructure                                     |
| `pnpm docker:backend:config`  | Validate the Compose file when Docker is installed                    |

Redis coordination is specified in
[`docs/backend-redis-coordination.md`](backend-redis-coordination.md). Redis is
limited to host presence, OTP and HTTP throttles, idempotency acceleration, call
signaling room metadata, worker duplicate-suppression locks, BullMQ key
namespacing, and short-lived read caches. PostgreSQL remains authoritative.

## Workspaces

| Workspace                        | Role                                                                                |
| -------------------------------- | ----------------------------------------------------------------------------------- |
| `@connecto/api`                  | HTTP ingress for REST commands, future Socket.IO, and provider callbacks            |
| `@connecto/worker`               | Transactional outbox polling, reconciliation, moderation, notification, payout jobs |
| `@connecto/backend-runtime`      | Runtime config, redacted logging, health checks, Postgres, Redis, fakes, migration  |
| `@connecto/backend-architecture` | Canonical module graph, dependency rules, topology, and environment schema          |
| `@connecto/domain`               | Frontend DTOs plus backend canonical aggregates and command state machines          |

Backend code must not import mobile or admin platform UI packages.

## Backend Source Layout

The deployable backend apps keep process bootstrapping separate from application
code:

```text
backend/apps/api/src/
  index.ts                 API process composition root and shutdown handling
  app/server.ts            HTTP server, CORS, health, bootstrap, architecture
  modules/v1/router.ts     v1 contract router, idempotency, ETags, audit hooks
  modules/v1/domain-store.ts PostgreSQL-backed v1 domain route implementations

backend/apps/worker/src/
  index.ts                 Worker process composition root and shutdown handling
  app/worker.ts            Outbox polling loop and worker lifecycle
  modules/outbox/jobs.ts   Worker-owned side effects for dispatched outbox events
```

`src/index.ts` stays intentionally thin in both deployables. New product
behavior should land under the owning module folder or a shared backend package,
not directly in the process entrypoint.

## Health And Readiness

The API exposes:

- `GET /livez`: process liveness only.
- `GET /readyz`: PostgreSQL, Redis, and configured provider readiness.
- `GET /healthz`: combined health summary for operators.
- `GET /__architecture`: module graph and topology snapshot.
- `GET /v1/app/bootstrap`: server-owned app bootstrap projection for public or
  authenticated clients.

The worker exposes the same liveness/readiness contract on
`WORKER_HEALTH_HOST:WORKER_HEALTH_PORT`, defaulting to `0.0.0.0:4001`.

Provider readiness is configuration-driven. Local development uses deterministic
fakes for OTP, RTC, Razorpay, payout, moderation, tagging, and FCM, plus
Azurite for object storage. Provider modes are `fake`, `sandbox`, and `live`;
staging rejects fake modes and production requires live modes.

## Persistence

The first migration is
`backend/packages/backend-runtime/migrations/0001_backend_bootstrap.sql`. It creates:

- `idempotency_records` for mutating HTTP commands and provider webhooks.
- `ledger_accounts`, `ledger_entries`, and `ledger_postings` for immutable
  double-entry postings in integer paise.
- database triggers that reject updates and deletes to ledger entries/postings.
- `outbox_events` for worker-owned asynchronous follow-up.
- `provider_callbacks` for idempotent callback capture.
- `seed_markers` for deterministic local seeding.

The second migration is
`backend/packages/backend-runtime/migrations/0002_configuration_secrets_and_flags.sql`.
It creates:

- `locked_product_rules` for non-silent product safety constraints.
- `configuration_change_audit` for feature flag, runtime config, and secret ref
  changes with idempotency keys.

The third migration is
`backend/packages/backend-runtime/migrations/0003_idempotency_response_headers.sql`.
It stores replay headers for idempotent responses such as ETags.

The fourth migration is
`backend/packages/backend-runtime/migrations/0004_admin_audit_log.sql`. It creates
`admin_audit_log` for `/v1/admin/*` command audit records.

The fifth migration is
`backend/packages/backend-runtime/migrations/0005_v1_domain_state_and_admin_rbac.sql`.
It adds PostgreSQL-backed v1 customer, host, call, payment, withdrawal, refund,
report, support, media, notification, push-token, and admin RBAC/session state.

The sixth migration is
`backend/packages/backend-runtime/migrations/0006_canonical_domain_state_machines.sql`.
It adds canonical aggregate tables for accounts, profiles, host applications,
voice verification, self-introductions, audio status, mind posts, tags,
availability, call participants, media segments, earnings, rank snapshots,
referrals, configuration versions, domain audit events, transition definitions,
and transition history. It also adds immutable pricing and ledger transaction
snapshot storage and widens prior status/rank checks to canonical enum values.

The seventh migration is
`backend/packages/backend-runtime/migrations/0007_host_verification_status_alignment.sql`.
It aligns existing host verification statuses with canonical application states
and adds the call-intent ringing cancellation transition consumed by the
release route.

The eighth migration is
`backend/packages/backend-runtime/migrations/0008_media_review_and_worker_reconciliation.sql`.
It hardens signed upload asset storage with owner, expiry, redaction, and review
state, adds redacted `media_asset_reviews`, records worker-owned
`call_billing_reconciliations`, tracks processed
`discovery_cache_invalidations`, and stores provider smoke attempt metadata.

The ninth migration is
`backend/packages/backend-runtime/migrations/0009_schema_safeguards_and_access_paths.sql`.
It adds the sortable `app_uuid_v7()` database ID strategy, unique internal
`database_id` values on durable tables, refresh-token family uniqueness, one
published audio status per host per India date, connected-call rating
constraints, globally unique provider event IDs, unique referral attribution,
deferred ledger balance enforcement, private host verification storage, the
`public_host_profiles` view, and access-path indexes for discovery,
reconciliation, safety, support, and operations queues.

The seed command creates system/customer/host ledger accounts, deterministic
customer/host/call/money/support/admin rows, persisted local admin sessions,
one active refresh-token family, one redacted private host verification record,
one connected-call rating, one redacted voice-intro media review, one billing
reconciliation row, one discovery invalidation row, and one bootstrap outbox
event. It intentionally avoids phone numbers, raw legal identity, UPI, bank
data, raw safety-report free text beyond safe fixture subjects, audio
transcripts, tokens, and provider secrets.

`.github/workflows/backend-db-smoke.yml` runs
`pnpm db:smoke:migrate-seed` with PostgreSQL and Redis service containers for
CI environments where Docker is available. The command applies migrations,
seeds deterministic rows, checks canonical row counts, verifies Prompt 07
constraint probes, and logs `EXPLAIN ANALYZE` plans for key query families.

Detailed constraint probes and expected query indexes are documented in
`docs/backend-query-plans-and-constraints.md`.

## Local Providers

| Boundary       | Local provider + mode                          | Notes                                         |
| -------------- | ---------------------------------------------- | --------------------------------------------- |
| OTP            | `OTP_PROVIDER=fake`, `OTP_PROVIDER_MODE=fake`  | deterministic code `246810`                   |
| RTC            | `RTC_PROVIDER=fake`, `RTC_PROVIDER_MODE=fake`  | deterministic Agora-compatible token envelope |
| Payments       | `PAYMENTS_PROVIDER=fake`, mode `fake`          | deterministic Razorpay-compatible order       |
| Payout         | `PAYOUT_PROVIDER=fake`, mode `fake`            | deterministic payout reference                |
| Object storage | `OBJECT_STORAGE_PROVIDER=azurite`, mode `fake` | readiness checks the configured endpoint      |
| Moderation     | `MODERATION_PROVIDER=fake`, mode `fake`        | deterministic allow/review outcome            |
| Tagging        | `TAGGING_PROVIDER=fake`, mode `fake`           | deterministic normalized tag output           |
| Notification   | `NOTIFICATION_PROVIDER=fake`, mode `fake`      | deterministic FCM-compatible response         |

Production provider credentials are not committed. They must be supplied by the
deployment environment and resolved through the runtime secret store; fake,
sandbox, and live provider selection remains centralized in
`@connecto/backend-runtime`.

Provider webhooks for RTC, payments, payouts, object storage, and notification
receipts must include `X-Provider-Event-Id` and `X-Provider-Signature`. Local
fake mode accepts `fake` or a deterministic HMAC. Sandbox/live modes verify
against server-only provider webhook secrets resolved at request time.

`pnpm providers:smoke` executes OTP, RTC token/webhook, payment order/webhook,
payout create/webhook, storage upload/webhook, moderation, tagging, and
notification token/webhook checks against the configured provider registry. With
the default local env it uses deterministic fakes and requires no external
accounts; sandbox/live mode intentionally fails if required credentials or
webhook secrets are missing.

## App Bootstrap

`GET /v1/app/bootstrap?platform=android&buildNumber=1` returns only public-safe
configuration: minimum build, blocked builds, platform store URL, maintenance
state, legal policy versions, supported languages, backend-owned feature flags,
and cache metadata. The client cannot force its own update state; the server
computes `update.required` from the configured minimum and blocked builds.

## Secrets

The parsed runtime config contains `secretRefs`, not plaintext secrets.
`SECRET_STORE_PROVIDER=env` resolves values lazily from process env.
`SECRET_STORE_PROVIDER=azure-key-vault` stores Key Vault names and optional
versions so rotation can change a ref without logging the secret value.
