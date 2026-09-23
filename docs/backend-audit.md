# Backend Audit

Date: 2026-08-21

Audit stage: Prompt 01, repository audit and frontend contract map.

## Scope

This audit inspected the completed frontend repository and converted the current
UI, mock adapters, domain schemas, routes, deep links, environment contract, and
the 18 August 2026 screenshot manifest into backend integration work. It does
not delete or replace customer, host, admin, or shared frontend flows.

The audit started from a frontend-heavy repository. The backend now includes a
modular-monolith API, a separate worker scaffold, generated `/v1` contracts,
runtime configuration, persistent idempotency storage, provider registry
boundaries, database-backed v1 state for call/money/rank/payout/refund/support
flows, persisted admin RBAC/audit storage, canonical backend aggregates,
command state machines, immutable financial/call snapshots, and compatibility
handlers for every generated `/v1` route. Production backend work remains a
modular monolith with a separate worker process.
PostgreSQL is the source of truth; Redis may only support ephemeral presence,
locks, throttles, cache, Socket.IO coordination, and queues.

## Inventory

| Area                   | Current state                                                                                                                                                                                                              |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Package manager        | `pnpm@11.7.0` in a private monorepo                                                                                                                                                                                        |
| Workspaces             | `apps/*`, `packages/*`                                                                                                                                                                                                     |
| Apps                   | `apps/mobile` Expo Router app, `apps/admin` Next app, `backend/apps/api` Node `/v1` API with PostgreSQL-backed domain store, `backend/apps/worker` Node worker scaffold                                                    |
| Packages               | `@connecto/backend-architecture`, `@connecto/backend-runtime`, `@connecto/domain` with canonical models/state machines, `@connecto/design-tokens`, `@connecto/eslint-config`, `@connecto/test-utils`, `@connecto/tsconfig` |
| Mobile routes          | 82 Expo route files plus 6 layout files under `apps/mobile/src/app`                                                                                                                                                        |
| Mobile route registry  | 82 `appRoutes` entries in `apps/mobile/src/navigation/routes.ts`                                                                                                                                                           |
| Admin routes           | 3 route pages: health `/`, service-backed `/operations` using admin services, internal `/token-gallery`                                                                                                                    |
| Screenshot manifest    | `C:\Users\heman\Desktop\connecto-backend-flow-screenshots-20260817-235953\manifest.csv`                                                                                                                                    |
| Captured states        | 151 manifest rows across 80 unique deep-link routes                                                                                                                                                                        |
| Frontend service root  | `backend/packages/domain/src/data-layer.ts`                                                                                                                                                                                |
| Feature-local adapters | Auth, onboarding, finance, calls, customer account, referrals, post-call                                                                                                                                                   |
| Runtime config         | Root/admin/mobile env examples plus a real mobile `.env` inspected with values redacted                                                                                                                                    |
| Git metadata           | `.git` exists but is empty in this environment; `git status` cannot run                                                                                                                                                    |

## Manifest Coverage

| Section               | Rows |
| --------------------- | ---: |
| `public`              |   14 |
| `public_links`        |    5 |
| `auth_flow`           |    4 |
| `customer_onboarding` |   13 |
| `host_flow`           |    1 |
| `customer`            |   42 |
| `customer_calls`      |    9 |
| `host_onboarding`     |   14 |
| `host`                |   23 |
| `host_calls`          |    9 |
| `internal`            |   17 |

Every row is mapped in `docs/ui-backend-traceability.md`.

## Service Surfaces Found

Shared service interfaces from `@connecto/domain`:

- Auth, Customer, Host, Call, Payment, Wallet, Referral, Earnings, Withdrawal,
  Report, Support, Notification, and Analytics services.
- HTTP-backed services now use `/v1` paths in `createHttpFrontendServices`;
  mutating commands receive deterministic `Idempotency-Key` headers and
  editable writes receive default `If-Match` protection.
- Mock services are deterministic but locally mutate money, payment, report,
  withdrawal, notification, support, and session state.

Feature-local adapters:

- `CustomerAuthAdapter` has richer OTP and referral behavior than the shared
  auth service.
- `CustomerOnboardingAdapter` covers profile, languages, permissions, image
  selection/crop, host voice verification, approval polling, and host agreement.
- Call preconnect and active-call adapters already define HTTP endpoints for
  call intents, ringing, RTC token requests, session ending, video upgrade,
  fallback, and remote-video confirmation.
- `financePaymentAdapter` wraps create order, native checkout handoff, duplicate
  callback simulation, polling, and verification.
- Customer account adapters own notification preferences, local notification
  previews, blocked hosts, support drafts/tickets, report history, attachments,
  and delete-account requests.
- Referral adapters and contract client own overview, detail, invite resolution,
  referral validation, share/copy bridges, anti-abuse review, and ledger links.
- Post-call adapters own pending/finalized call records, charge breakdowns,
  rating, evidence metadata, and support tickets.

## Production Gaps

These gaps are product or integration tasks, not hidden frontend assumptions:

| Gap                                  | Current assumption                                                                                      | Backend task                                                                                                                                           |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Selfie and identity verification     | Host verification screens now have production routes and signed upload review storage.                  | Run provider-backed storage/moderation smoke once accounts exist and add signed read URLs for approved admin viewers.                                  |
| Self-intro and daily status          | Host summaries include `voiceIntro`; self-introduction and daily-status routes persist PostgreSQL rows. | Discovery invalidation is worker-owned; add moderation expiry policy and failed-invalidation alerts.                                                   |
| Mind-text/tag matching               | Customer match tags are now server-persisted, but ranking may still read older mock assumptions.        | Feed `tags`, `mind_posts`, and joins into ranking jobs and migrate existing mock-only selections.                                                      |
| Money authority                      | Mock wallet/payment services can still run in non-production.                                           | Ledger, payment/refund/withdrawal state, canonical money machines, snapshots, and provider-authenticated callbacks now gate DB-backed money mutations. |
| Call authority                       | Active call timers, summaries, video states, and some report context are locally reconstructed.         | Call intent/live-call machines, authenticated RTC callbacks, snapshots, billing events, and worker reconciliation exist; add richer summary context.   |
| Duplicated onboarding captures       | Customer host-applicant conversion and standalone host onboarding both exist.                           | Host application and verification aggregates now exist; migrate frontend routes onto one explicit application intent.                                  |
| Guarded host-onboarding placeholders | Host onboarding route files are captured, but production service backing is incomplete.                 | Wire host application draft endpoints, signed media uploads, payout method tokenization, and admin review.                                             |
| Empty call summaries                 | Manifest rows 136 and 137 show blank host call summary content.                                         | Require `GET /calls/:callId/post-call` and typed empty/error states before production.                                                                 |
| Missing call context                 | Manifest rows 134 and 135 show report screens with no call context.                                     | Require route-safe call/report context lookup and server-side report evidence binding.                                                                 |
| Internal scenario data               | Developer scenarios, galleries, labs, and token routes are captured as internal.                        | They are now production-disabled by route guards; keep them development/preview only.                                                                  |

## Admin Expectations

The six production admin modules are dashboard, hosts, payments, refunds,
reports, and settings. Current UI only implements:

- `/` admin health page.
- `/operations` service-backed control room reading the six admin module
  families: dashboard, hosts, payments, refunds, reports, and settings.
- `/token-gallery`, now disabled in production.

Production admin backend now exposes `/v1/admin/*` endpoints with persisted
admin sessions, role grants, permission checks, command audit writes, and
`GET /v1/admin/audit-log`. The remaining production hardening is redacted
detail responses for host identity, bank/UPI data, phone numbers, safety
reports, transcripts, and provider secrets.

## Runtime Configuration

Admin public env keys:

- `NEXT_PUBLIC_CONNECTO_ENV`
- `NEXT_PUBLIC_CONNECTO_MOCK_MODE`
- `NEXT_PUBLIC_CONNECTO_PROVIDER`
- `NEXT_PUBLIC_CONNECTO_API_BASE_URL`
- `NEXT_PUBLIC_CONNECTO_SENTRY_DSN`
- `NEXT_PUBLIC_CONNECTO_ENABLE_RIVE`
- `NEXT_PUBLIC_CONNECTO_ENABLE_SKIA_HEAVY_VISUALS`
- `NEXT_PUBLIC_CONNECTO_ENABLE_VIDEO_UPGRADE`
- `NEXT_PUBLIC_CONNECTO_ENABLE_REFERRALS`
- `NEXT_PUBLIC_CONNECTO_ENABLE_ANALYTICS`

Mobile public env keys:

- Core: `EXPO_PUBLIC_CONNECTO_ENV`,
  `EXPO_PUBLIC_CONNECTO_MOCK_MODE`, `EXPO_PUBLIC_CONNECTO_PROVIDER`,
  `EXPO_PUBLIC_CONNECTO_API_BASE_URL`, `EXPO_PUBLIC_CONNECTO_AGORA_APP_ID`,
  `EXPO_PUBLIC_CONNECTO_RAZORPAY_KEY_ID`,
  `EXPO_PUBLIC_CONNECTO_SENTRY_DSN`,
  `EXPO_PUBLIC_CONNECTO_DEEP_LINK_HOST`,
  `EXPO_PUBLIC_CONNECTO_ANDROID_UPDATE_URL`,
  `EXPO_PUBLIC_CONNECTO_IOS_UPDATE_URL`.
- Feature flags: `EXPO_PUBLIC_CONNECTO_ENABLE_RIVE`,
  `EXPO_PUBLIC_CONNECTO_ENABLE_SKIA_HEAVY_VISUALS`,
  `EXPO_PUBLIC_CONNECTO_ENABLE_VIDEO_UPGRADE`,
  `EXPO_PUBLIC_CONNECTO_ENABLE_REFERRALS`,
  `EXPO_PUBLIC_CONNECTO_ENABLE_ANALYTICS`.
- Mock simulation controls: onboarding, call, active-call media/backend,
  audio metering, permissions, ring/video outcomes, and payment provider keys
  listed in `docs/runtime-configuration.md`.

No private backend secrets may enter frontend env files.

## Backend Implementation Plan

1. Add a backend workspace for the modular monolith and worker.
2. Add PostgreSQL migrations for identity, sessions, OTP, customers, hosts,
   onboarding drafts, media, devices, notifications, wallets, ledger postings,
   payments, refunds, calls, call events, video upgrades, ratings, reports,
   support, referrals, earnings, payout methods, withdrawals, legal documents,
   feature flags, and admin audit logs.
3. Deterministic local fakes now exist for OTP, Agora, Razorpay, payout, object
   storage, moderation, tagging, and FCM; sandbox/live provider calls are wired
   behind the central registry and server-only secret store.
4. Idempotency middleware now reserves and replays every mutating HTTP command
   and provider webhook through canonical request hashes; production startup
   uses PostgreSQL `idempotency_records`.
5. Canonical backend aggregates and state machines now exist in
   `@connecto/domain`; DB-backed call, money, host review, host verification,
   account deletion, and safety mutations now record canonical transitions and
   outbox events.
6. Implement shared Zod/OpenAPI contracts from `@connecto/domain` plus the
   feature-local contracts documented in
   `docs/frontend-backend-contract-map.md`.
7. Add Socket.IO or SSE for session/account, host availability, call, wallet,
   video upgrade, support, report, referral, withdrawal, and notification
   events.
8. Add worker jobs for OTP expiry, payment reconciliation, call finalization,
   ledger settlement, referral qualification, moderation/tagging, payout
   processing, notification delivery, and retention/redaction.
9. Admin `/v1/admin/*` modules now have PostgreSQL-backed persisted sessions,
   role grants, permission checks, command audit writes, and an audit-log route;
   production still needs redacted sensitive detail views.
10. Switch frontend provider modes to staging only after contract tests pass
    against the backend fakes.

## Verification Record

Command results from this stage are recorded after the docs are updated in the
completion report. This repo currently cannot provide a Git diff because the
visible `.git` directory is empty.
