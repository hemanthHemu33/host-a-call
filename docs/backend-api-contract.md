# Backend API Contract

Date: 2026-08-21

This repository now contains a deployable API (`backend/apps/api`), a deployable worker
scaffold (`backend/apps/worker`), generated `/v1` contracts, and a shared backend
runtime package (`backend/packages/backend-runtime`). The generated source of truth is
`docs/contracts/openapi-v1.json`; this page summarizes the runtime surfaces.
Canonical backend aggregates and command state machines live in
`@connecto/domain` under the `canonicalModels` and `canonicalStateMachines`
namespaces so they do not collide with frontend DTO names.

## Current Scaffold Endpoints

| Surface | Method | Path                | Purpose                                                |
| ------- | ------ | ------------------- | ------------------------------------------------------ |
| API     | `GET`  | `/`                 | Stage/status entrypoint for the backend scaffold       |
| API     | `GET`  | `/v1/app/bootstrap` | Server-owned public/authenticated bootstrap projection |
| API     | `GET`  | `/livez`            | Process liveness only                                  |
| API     | `GET`  | `/readyz`           | PostgreSQL, Redis, and provider readiness              |
| API     | `GET`  | `/healthz`          | Combined runtime health and provider mode summary      |
| API     | `GET`  | `/__architecture`   | Machine-readable topology, module, and metric snapshot |
| Worker  | `GET`  | `/livez`            | Worker process liveness on `WORKER_HEALTH_PORT`        |
| Worker  | `GET`  | `/readyz`           | Worker PostgreSQL, Redis, and provider readiness       |
| Worker  | `GET`  | `/healthz`          | Worker combined health summary                         |

Readiness must fail closed when PostgreSQL, Redis, or a required provider is
unavailable. Liveness stays process-only so an orchestrator can distinguish a
dead process from an external dependency outage.

## Current Persistence Contract

`backend/packages/backend-runtime/migrations/0001_backend_bootstrap.sql` creates
idempotency records, provider callback capture, transactional outbox events,
immutable ledger accounts/entries/postings, and deterministic seed markers.
Ledger money is stored as integer paise and ledger rows are protected from
update/delete by database triggers.

`backend/packages/backend-runtime/migrations/0002_configuration_secrets_and_flags.sql`
creates locked product-rule records and immutable configuration change audit
records for feature-flag, runtime-config, and secret-ref changes.

`backend/packages/backend-runtime/migrations/0003_idempotency_response_headers.sql`
stores replay headers for idempotent command responses.

`backend/packages/backend-runtime/migrations/0004_admin_audit_log.sql` creates durable
admin command audit records for `/v1/admin/*`.

`backend/packages/backend-runtime/migrations/0005_v1_domain_state_and_admin_rbac.sql`
adds PostgreSQL-backed v1 customer, host, call, payment, withdrawal, refund,
report, support, media, notification, push-token, and admin RBAC/session state.

`backend/packages/backend-runtime/migrations/0006_canonical_domain_state_machines.sql`
adds canonical aggregate tables, immutable pricing/ledger/rank snapshots,
transition definitions, transition history, and domain audit events. It also
widens earlier status/rank checks to match the canonical enums.

`backend/packages/backend-runtime/migrations/0007_host_verification_status_alignment.sql`
aligns host verification statuses with the canonical host application machine
and adds the ringing call-intent cancellation transition used by the existing
release route.

`backend/packages/backend-runtime/migrations/0008_media_review_and_worker_reconciliation.sql`
adds signed upload asset owner/expiry/redaction/review fields, redacted admin
media review records, worker billing reconciliation records, discovery cache
invalidation records, and provider smoke attempt metadata.

`backend/packages/backend-runtime/migrations/0009_schema_safeguards_and_access_paths.sql`
adds database-owned sortable UUID values, refresh-token family uniqueness,
published daily audio-status uniqueness, connected-call rating uniqueness,
provider-event/referral uniqueness, deferred balanced-ledger enforcement,
private host verification storage, and the `public_host_profiles` projection.
These safeguards do not change the public `/v1` response DTOs.

Root commands:

- `pnpm db:validate-migrations`
- `pnpm db:migrate`
- `pnpm db:seed`
- `pnpm db:smoke:migrate-seed`
- `pnpm providers:smoke`
- `pnpm check:backend`

## Required Public Endpoints

| Service       | Method  | Path                                                  |
| ------------- | ------- | ----------------------------------------------------- |
| Auth          | `GET`   | `/v1/auth/session`                                    |
| Auth          | `POST`  | `/v1/auth/otp`                                        |
| Auth          | `POST`  | `/v1/auth/otp/verify`                                 |
| Auth          | `POST`  | `/v1/auth/sign-out`                                   |
| Analytics     | `POST`  | `/v1/analytics/events`                                |
| App Bootstrap | `GET`   | `/v1/app/bootstrap`                                   |
| Accounts      | `GET`   | `/v1/accounts/me/status`                              |
| Calls         | `GET`   | `/v1/calls?userId=:userId`                            |
| Calls         | `POST`  | `/v1/calls/token`                                     |
| Calls         | `POST`  | `/v1/calls/:callId/complete`                          |
| Customers     | `GET`   | `/v1/customers/:customerId`                           |
| Customers     | `GET`   | `/v1/customers/me/delete-account`                     |
| Customers     | `POST`  | `/v1/customers/me/delete-account`                     |
| Customers     | `POST`  | `/v1/customers/onboarding/match-tags`                 |
| Hosts         | `GET`   | `/v1/hosts`                                           |
| Hosts         | `GET`   | `/v1/hosts/:hostId`                                   |
| Hosts         | `GET`   | `/v1/hosts/:hostId/application`                       |
| Hosts         | `POST`  | `/v1/hosts/:hostId/application/agreement`             |
| Hosts         | `POST`  | `/v1/hosts/:hostId/application/identity-verification` |
| Hosts         | `GET`   | `/v1/hosts/:hostId/application/voice-verification`    |
| Hosts         | `POST`  | `/v1/hosts/:hostId/application/voice-verification`    |
| Hosts         | `GET`   | `/v1/hosts/:hostId/dashboard`                         |
| Hosts         | `GET`   | `/v1/hosts/:hostId/daily-status`                      |
| Hosts         | `PUT`   | `/v1/hosts/:hostId/daily-status`                      |
| Hosts         | `GET`   | `/v1/hosts/:hostId/earnings`                          |
| Hosts         | `GET`   | `/v1/hosts/:hostId/self-introduction`                 |
| Hosts         | `PUT`   | `/v1/hosts/:hostId/self-introduction`                 |
| Hosts         | `PATCH` | `/v1/hosts/:hostId/availability`                      |
| Notifications | `GET`   | `/v1/notifications?recipientId=:recipientId`          |
| Notifications | `POST`  | `/v1/notifications/:notificationId/read`              |
| Payments      | `POST`  | `/v1/payments`                                        |
| Payments      | `POST`  | `/v1/payments/:paymentId/verify`                      |
| Referrals     | `GET`   | `/v1/referrals?customerId=:customerId`                |
| Reports       | `GET`   | `/v1/reports`                                         |
| Reports       | `POST`  | `/v1/reports`                                         |
| Support       | `GET`   | `/v1/support/tickets?requesterId=:requesterId`        |
| Support       | `POST`  | `/v1/support/tickets`                                 |
| Tags          | `GET`   | `/v1/tags`                                            |
| Wallet        | `GET`   | `/v1/wallets?customerId=:customerId`                  |
| Wallet        | `GET`   | `/v1/wallets/:walletId/transactions`                  |
| Withdrawals   | `GET`   | `/v1/withdrawals?hostId=:hostId`                      |
| Withdrawals   | `POST`  | `/v1/withdrawals`                                     |

## Required Admin Endpoints

| Service        | Method  | Path                                         |
| -------------- | ------- | -------------------------------------------- |
| Admin          | `GET`   | `/v1/admin/audit-log`                        |
| Admin          | `GET`   | `/v1/admin/dashboard`                        |
| Admin hosts    | `GET`   | `/v1/admin/hosts`                            |
| Admin hosts    | `POST`  | `/v1/admin/hosts/:hostId/application-review` |
| Admin media    | `GET`   | `/v1/admin/media-reviews`                    |
| Admin media    | `GET`   | `/v1/admin/media-reviews/:reviewId`          |
| Admin media    | `POST`  | `/v1/admin/media-reviews/:reviewId/decision` |
| Admin payments | `GET`   | `/v1/admin/payments`                         |
| Admin payments | `POST`  | `/v1/admin/payments/:paymentId/reconcile`    |
| Admin refunds  | `GET`   | `/v1/admin/refunds`                          |
| Admin refunds  | `POST`  | `/v1/admin/refunds/:refundId/approve`        |
| Admin refunds  | `POST`  | `/v1/admin/refunds/:refundId/reject`         |
| Admin reports  | `GET`   | `/v1/admin/reports`                          |
| Admin reports  | `POST`  | `/v1/admin/reports/:reportId/decision`       |
| Admin settings | `GET`   | `/v1/admin/settings`                         |
| Admin settings | `PATCH` | `/v1/admin/settings/feature-flags/:flagKey`  |

Responses must match the Zod schemas exported from `@connecto/domain`. The
frontend `HttpClient` rejects invalid JSON and contract mismatches before
screens receive data.

Async follow-up work for payments, payouts, notifications, moderation,
analytics, audit, billing reconciliation, media review, and discovery cache
invalidation must run through the worker and transactional outbox, even when
the initiating request lands on the API.

## Domain Command Policy

State transitions are defined as named backend commands, not as controller-local
status assignments. Prompt 06 introduces canonical machines for account, account
deletion, host application, voice verification, call intent, live call/media,
payment, refund, earning settlement, withdrawal, referral qualification, and
report state. Invalid commands throw typed domain errors; rejected
security-sensitive commands carry redacted audit event metadata.

`recordDomainTransitionWithOutbox` writes transition history and an
`outbox_events` row through the same PostgreSQL transaction client. Worker
dispatch remains the only publishing path, so domain events are visible to
consumers only after the transaction commits.

Provider webhooks must supply an idempotency key and provider event id. Current
RTC, Razorpay, payout, object storage, and FCM finalizers verify
`X-Provider-Signature` before they can mutate state; fake mode accepts
deterministic local signatures, while sandbox/live modes resolve provider
webhook secrets through the server-side secret store.

## Secrets Boundary

Never expose OTP provider secrets, Razorpay secret, Agora certificate, signing
keys, payment verification credentials, payout credentials, FCM service
identity, storage credentials, encryption keys, private analytics tokens, or
database credentials to either frontend app. Frontend apps may only receive
production-safe public values through `EXPO_PUBLIC_CONNECTO_*`,
`NEXT_PUBLIC_CONNECTO_*`, and `GET /v1/app/bootstrap`.

`GET /v1/app/bootstrap` returns minimum and blocked build versions, store URLs,
maintenance state, legal policy versions, supported languages, backend-owned
feature availability, and cache/version metadata. The client may submit
platform/build metadata, but update requirements are computed by the server.
