# Backend Feature Matrix

> **Historical matrix.** It measures the retired PostgreSQL `/v1` design, not
> Samvad implementation readiness. Use [API source of truth](./api-source-of-truth.md)
> and the Samvad Swagger document for active integration planning.

Date: 2026-08-21

Status values:

- `implemented`: frontend has a typed HTTP method for the capability.
- `mocked`: UI exists but production data is local/mock.
- `missing`: backend contract or route is absent.
- `changed`: production rule must replace current frontend behavior.
- `client-only`: device/UI behavior can remain client-owned.
- `non-production`: internal tooling, disabled in production.

| Feature area                 | Frontend surface                                                       | Current status                             | Production backend owner                                           |
| ---------------------------- | ---------------------------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------ |
| Backend API runtime          | `backend/apps/api`, `/livez`, `/readyz`, `/healthz`, `/__architecture` | implemented                                | API process edge for REST, webhooks, and future Socket.IO          |
| Backend API contracts        | `@connecto/api-contracts`, `docs/contracts/openapi-v1.json`            | implemented                                | `/v1` OpenAPI, generated route client, lint, diff gate             |
| Backend worker runtime       | `backend/apps/worker`, worker `/livez`, `/readyz`, `/healthz`          | implemented                                | Worker for outbox, reconciliation, moderation, and notifications   |
| Backend runtime package      | `@connecto/backend-runtime`                                            | implemented                                | Runtime config, redacted logs, health, fakes, migrations, seed     |
| Backend secret boundary      | `SECRET_STORE_PROVIDER=env` or `azure-key-vault`                       | implemented                                | Server-only secret refs, lazy resolution, redacted diagnostics     |
| Backend feature flags        | `/v1/app/bootstrap`, `configuration_change_audit`                      | implemented                                | Server-owned feature availability and audited changes              |
| Backend module graph         | `@connecto/backend-architecture`                                       | implemented                                | Canonical bounded modules and dependency rules                     |
| Canonical domain model       | `@connecto/domain` canonical namespaces + migration `0006`             | implemented                                | Aggregates, enums, named transition commands, immutable snapshots  |
| PostgreSQL safeguards        | Migration `0009`, constraint probes, query-plan documentation          | implemented                                | IDs, uniqueness, balanced ledger, private data split, access paths |
| Local object storage         | Docker Compose Azurite                                                 | implemented                                | Local media/storage fake compatible with production adapter shape  |
| Provider smoke checks        | `pnpm providers:smoke`                                                 | implemented fake-mode smoke                | OTP, RTC, payments, payout, storage, moderation, tagging, FCM      |
| App bootstrap                | Splash, mandatory update, environment badge                            | implemented                                | `GET /v1/app/bootstrap`, app version rules, feature flags          |
| Auth OTP                     | Login, OTP, resend, sign-out                                           | implemented + mocked richer states         | Auth sessions, OTP fake/provider, rate limits                      |
| Age gate                     | 18+ and underage screens                                               | implemented model, missing endpoint        | Account compliance endpoint and audit record                       |
| Account status               | blocked/suspended screens                                              | implemented endpoint                       | `GET /v1/accounts/me/status`, account state machine, future event  |
| Referral code entry          | Referral sheet and deep link                                           | implemented partial                        | Referral validation and invite resolution                          |
| Customer profile             | Profile setup/edit                                                     | implemented + mocked media                 | Customer profile endpoint, media upload intents                    |
| Customer languages           | Onboarding and settings                                                | mocked                                     | Language metadata and profile preference endpoints                 |
| Match tags                   | Onboarding `match-tags` route                                          | implemented endpoint/storage               | `GET /v1/tags`, onboarding persistence, matching/ranking input     |
| Permissions                  | Onboarding permission cards                                            | client-only + missing audit                | Permission audit, push token, location consent                     |
| Customer home/discovery      | Home host list and filters                                             | implemented + mocked preferences           | Host discovery, filters, block-list exclusion, rank scoring        |
| Wallet balance               | Wallet state and transaction detail                                    | implemented list, missing detail           | Ledger-derived wallet and transaction detail                       |
| Add money                    | Add-money and payment states                                           | implemented + mocked checkout              | Razorpay order, verification, webhook, reconciliation              |
| Refunds                      | Refunds in requirements/admin expectations                             | implemented partial                        | Refund request, approval, provider settlement, ledger reversal     |
| Outgoing call                | Call intent and ringing                                                | implemented HTTP paths                     | Call intent, host dispatch, push, realtime, locks                  |
| Incoming call                | Host incoming route                                                    | mocked                                     | `call.incoming`, accept/reject/no-answer transitions               |
| Active voice                 | Voice call route                                                       | implemented partial                        | RTC token, session events, worker billing reconciliation           |
| Video upgrade                | Request, countdown, video route                                        | implemented partial                        | Video request lifecycle, RTC upgrade, remote-video confirmation    |
| Reconnect                    | Reconnecting route                                                     | mocked                                     | Reconnect/recovered/ended events, billing pause rules              |
| Call reports                 | In-call/post-call report route                                         | implemented report create, missing context | Report aggregate, evidence media, moderation workflow              |
| Call summary                 | Summary routes                                                         | mocked, host summary empty                 | Post-call finalization, worker billing reconciliation              |
| Call history/detail          | Customer and host call lists/details                                   | implemented list, mocked post-call detail  | Cursor lists, call detail, post-call record endpoint               |
| Ratings                      | Post-call rating                                                       | implemented                                | `POST /calls/:callId/rating`, one rating per connected call        |
| Support                      | Support list/detail/drafts/tickets                                     | implemented partial + mocked detail        | Tickets, messages, attachments, close workflow                     |
| Notifications                | Feed, preferences, deep links                                          | implemented list/read + mocked prefs       | Feed, preferences, read-all, push tokens, delivery receipts        |
| Privacy/safety               | Blocked users, report history                                          | mocked/implemented partial                 | Block list, reports, moderation status                             |
| Delete account               | Delete account screens                                                 | implemented endpoint/model                 | Eligibility, request, retention/redaction worker                   |
| Host application             | Host onboarding routes                                                 | implemented endpoint/storage               | Application aggregate, verification, review jobs                   |
| Host photo                   | Host photo route                                                       | mocked                                     | Signed media upload and moderation                                 |
| Host identity/selfie         | Verification route                                                     | implemented media hardening                | Signed upload assets, redacted admin media review, provider fakes  |
| Host payout setup            | Payout and bank account routes                                         | mocked                                     | Tokenized UPI/bank, compliance, payout provider fake               |
| Host agreement               | Agreement routes                                                       | implemented endpoint                       | Legal document version and acceptance endpoint                     |
| Host dashboard               | Dashboard, self-intro, daily status, availability                      | implemented partial                        | Dashboard aggregate, availability/status transitions, cache jobs   |
| Host earnings                | Earnings route                                                         | implemented summary                        | Earnings ledger and detail list                                    |
| Withdrawals                  | Withdrawal route                                                       | implemented partial                        | Request/history/detail, provider payout jobs/callbacks             |
| Host referrals               | Host referrals route                                                   | missing                                    | Host referral overview/detail and fraud review                     |
| Host leaderboard/rank        | Leaderboard route                                                      | implemented snapshot model + host list     | Ranking job, rank detail/rules/admin adjustments                   |
| Settings                     | Customer/host settings                                                 | mixed client-only/missing                  | Preferences, legal links, notification settings, account actions   |
| Legal                        | Terms/privacy/guidelines                                               | mocked static content                      | Versioned legal documents and acceptance records                   |
| Admin dashboard              | Six-module admin overview                                              | implemented                                | `GET /v1/admin/dashboard`, RBAC, audit                             |
| Admin hosts                  | Host review/management                                                 | implemented                                | `/v1/admin/hosts/*`, RBAC, audit                                   |
| Admin media reviews          | Selfie/identity/evidence/voice review queue                            | implemented                                | `/v1/admin/media-reviews/*`, redacted DTO, RBAC, audit             |
| Admin payments               | Payment/payout/ledger/referral payments                                | implemented                                | `/v1/admin/payments/*`, reconciliation, RBAC, audit                |
| Admin refunds                | Refund review/partial refund                                           | implemented                                | `/v1/admin/refunds/*`, ledger reversal, RBAC, audit                |
| Admin reports                | Safety/moderation queue                                                | implemented                                | `/v1/admin/reports/*`, evidence access, RBAC, audit                |
| Admin settings               | Pricing/ranking/referral/withdrawal/language/safety                    | implemented                                | `/v1/admin/settings/*`, validation, RBAC, audit                    |
| Developer scenarios          | Scenario controls                                                      | non-production                             | Client-only, now production-disabled                               |
| Component/token galleries    | UI galleries                                                           | non-production                             | Client-only, now production-disabled                               |
| Layout/motion/animation labs | QA labs                                                                | non-production                             | Client-only, now production-disabled                               |

## Provider Fake Requirements

| Provider boundary | Local fake requirement                                                               |
| ----------------- | ------------------------------------------------------------------------------------ |
| OTP               | Deterministic codes, expiry, retry-after, lockout, blocked/suspended fixtures        |
| Agora             | Deterministic RTC tokens, HMAC-authenticated callbacks, media-mode events            |
| Razorpay          | Order create, checkout callback, duplicate callback, HMAC webhook, reconciliation    |
| Payout            | UPI/bank tokenization, HMAC payout callback, retry/failure states                    |
| Object storage    | Signed upload/read URLs, Azurite endpoint, HMAC completion callback, expiry behavior |
| Moderation        | Voice/photo/selfie/report/support review outcomes                                    |
| Tagging           | Match-tag normalization and ranking input fixtures                                   |
| FCM/APNs/Expo     | Push token registration, HMAC delivery receipt, invalid token behavior               |
