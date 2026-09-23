# Frontend Data Layer

Date: 2026-07-16

## Runtime Shape

The canonical frontend data contracts live in `backend/packages/domain`.

- `HttpClient` validates every response with a caller-provided Zod schema before data crosses into app code.
- `createMockFrontendServices` serves deterministic fixtures through service interfaces.
- `createHttpFrontendServices` maps the same interfaces to typed HTTP calls for staging and production APIs.
- `normalizeApiError` converts thrown values into UI-safe retryable/non-retryable errors.
- `queryKeys`, `invalidationPolicy`, and `optimisticUpdateRules` define cache ownership outside screens.

Apps choose providers through runtime configuration:

- Mobile: `apps/mobile/src/services/data.ts`
- Admin: `apps/admin/src/services/data.ts`

Switching from mock to HTTP should be a config change through `EXPO_PUBLIC_CONNECTO_PROVIDER` or `NEXT_PUBLIC_CONNECTO_PROVIDER`; screens should keep calling `frontendServices`.

Current service-backed screens:

- Mobile customer: home, wallet, calls, profile, filters, add money, payment result, referrals, refunds, support.
- Mobile host: dashboard, calls, earnings, leaderboard, profile.
- Admin web: `/operations` reads host dashboard, reports, support tickets, and withdrawals through TanStack Query.

## Query Responsibilities

TanStack Query owns server-shaped asynchronous data:

- profiles, host lists, calls, wallet ledger, payment status, referrals, reports, support tickets, notifications;
- retry and stale-time policy;
- invalidation after mutations;
- normalized async error handling.

Zustand owns local UI/session state:

- mobile auth/session snapshot;
- active call state-machine snapshot;
- wallet display cache and local payment/withdrawal/referral states;
- UI preferences;
- non-production developer scenarios and simulation controls.

Screens must not import fixture files directly. They should use `frontendServices`, query keys, and app stores.

## Mock Controls

The mock data layer supports:

- latency: `latencyMs`;
- failure: `mode: "failure"`;
- empty collection responses: `mode: "empty"`;
- offline responses: `mode: "offline"`;
- partial data responses: `mode: "partial-data"`;
- seeded scenarios for role, wallet balance, host availability/rank, network quality, payment result, report history, and host application status.

Mobile exposes these controls at `/developer-scenarios` in development and preview builds only.

## Backend Prerequisites

The frontend HTTP contract is listed in `docs/backend-api-contract.md`. Server secrets remain backend-only: OTP provider credentials, Razorpay secret, Agora certificate, signing keys, private analytics tokens, and payment verification credentials must never enter frontend env files.
