# API Compatibility Policy

Date: 2026-08-21

This policy governs Host a Call REST, WebSocket, provider webhook, and
asynchronous worker-event contracts for `/v1`.

## Source Of Truth

- Canonical route and event declarations live in
  `backend/packages/api-contracts/src`.
- Generated artifacts live in `docs/contracts`:
  - `openapi-v1.json`
  - `openapi-v1.baseline.json`
  - `contract-manifest.json`
  - `v1-client.ts`
- Root commands:
  - `pnpm contracts:generate`
  - `pnpm contracts:lint`
  - `pnpm contracts:check-diff`
  - `pnpm test:api-contracts`

## Versioning

- All production REST and webhook paths are under `/v1`.
- Database models are never response schemas.
- Backwards-compatible changes are additive: new optional response fields, new
  enum values only when clients already handle unknown values, new endpoints,
  new events, new optional request fields, and new pagination filters.
- Breaking changes require a new API or event version plus an entry in
  `docs/api-migration-notes.md`.

## Request And Error Contract

- Every response carries `X-Request-Id`.
- Mutating HTTP commands require `Idempotency-Key`.
- Provider webhooks require a provider event id such as
  `X-Provider-Event-Id` and provider signature verification.
- Current RTC, Razorpay, payout, object storage, and FCM callback handlers read
  `X-Provider-Signature`; fake mode accepts deterministic local signatures and
  sandbox/live modes resolve provider webhook secrets server-side.
- Editable resources expose opaque `ETag` values and require `If-Match` for
  optimistic concurrency where marked in OpenAPI.
- Errors use `application/problem+json` with `type`, `title`, `status`,
  `code`, `requestId`, and `instance`.
- Money is integer paise with `currency: "INR"`.
- Storage timestamps are UTC ISO-8601. India currency/time display formatting
  belongs at client presentation edges.

## WebSocket And Async Events

All emitted WebSocket and worker/provider event envelopes use version `1` and
must include:

- `eventId`
- `eventType`
- `occurredAt`
- `aggregateId`
- `aggregateVersion`
- `correlationId`
- `payload`
- `version`

Controllers and Socket.IO handlers may only translate transport input/output.
Financial and call lifecycle invariants live in domain/application services.

## Deprecation

- Deprecated fields stay readable for at least two mobile release trains and
  one admin release train.
- Deprecated endpoints return `Deprecation` and `Sunset` headers once a
  replacement is production-ready.
- Removal requires a migration note and either a new `/vN` REST version or a
  new event `version`.

## Deep Links

Deep-link resolution is server-owned at open time through
`POST /v1/deep-links/resolve`. The allowlist covers referral, support ticket,
payment result, notification destination, call invitation, legal, invalid, and
expired states. Login restoration is represented by an opaque restore token;
resource authorization is checked again after login.
