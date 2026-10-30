# Frontend Backend Contract Map

> **Retired for runtime integration.** This map documents the abandoned
> PostgreSQL `/v1` API. Do not implement against it; use Samvad and its
> [canonical API source](./api-source-of-truth.md).

Date: 2026-08-21

This map is the backend integration contract discovered from the current
frontend repository. Status terms:

- `implemented`: frontend service call already has an HTTP path.
- `mocked`: frontend behavior exists but is mock/local unless backend work is
  added.
- `missing`: production backend capability is absent from the shared HTTP
  adapter.
- `changed`: production product rule must replace a frontend-only assumption.
- `client-only`: safe to own on device.
- `non-production`: disabled in production.

## Prompt 05 Canonical Contract

Prompt 05 promotes the backend contract from this audit map into generated,
versioned artifacts:

- Source declarations: `backend/packages/api-contracts/src/routes.ts`,
  `backend/packages/api-contracts/src/dtos.ts`, `backend/packages/api-contracts/src/events.ts`,
  and `backend/packages/api-contracts/src/deep-links.ts`.
- Generated OpenAPI: `docs/contracts/openapi-v1.json`.
- Contract baseline for breaking-change checks:
  `docs/contracts/openapi-v1.baseline.json`.
- Generated route client metadata: `docs/contracts/v1-client.ts`.
- Compatibility/deprecation rules: `docs/api-compatibility-policy.md`.

The shared HTTP adapters and feature-local call/referral adapters now use the
corresponding `/v1` OpenAPI paths and cursor response envelopes where the
contract returns pages. Mutating commands send `Idempotency-Key`; editable
resources marked by the OpenAPI contract use `ETag`/`If-Match`.

| Adapter path family                                        | Canonical `/v1` contract owner                                                                                                 |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `/v1/auth/*`                                               | `/v1/auth/*`, `/v1/accounts/me/status`                                                                                         |
| `/v1/customers/*`, `/v1/hosts/*`                           | `/v1/customers/*`, `/v1/hosts/*`                                                                                               |
| `/v1/calls/*`                                              | `/v1/calls/*`, `/v1/calls/webhooks/agora`                                                                                      |
| `/v1/payments*`                                            | `/v1/payments*`, `/v1/payments/webhooks/razorpay`                                                                              |
| `/v1/wallets*`, `/v1/withdrawals*`, `/v1/referrals*`       | `/v1/wallets*`, `/v1/withdrawals*`, `/v1/referrals*`                                                                           |
| `/v1/reports`, `/v1/support/tickets`, `/v1/notifications*` | `/v1/reports`, `/v1/support/tickets`, `/v1/notifications*`                                                                     |
| Admin six-module expectations                              | `/v1/admin/dashboard`, `/v1/admin/hosts`, `/v1/admin/payments`, `/v1/admin/refunds`, `/v1/admin/reports`, `/v1/admin/settings` |
| Admin audit viewer                                         | `/v1/admin/audit-log`                                                                                                          |
| Client-local deep-link parsing                             | `POST /v1/deep-links/resolve`                                                                                                  |

## Prompt 06 Canonical Domain

Prompt 06 adds backend-owned aggregate schemas and command state machines in
`@connecto/domain`:

- `canonicalModels` models Account, CustomerProfile, HostProfile,
  HostApplication, VoiceVerification, SelfIntroduction, AudioStatus, MindPost,
  Tag, Availability, Call, CallParticipant, MediaSegment, PricingSnapshot,
  LedgerTransaction, Payment, Earning, RankSnapshot, Withdrawal, Referral,
  Refund, Report, SupportTicket, Notification, ConfigurationVersion, and
  AuditEvent.
- `canonicalStateMachines` defines named commands for account, account
  deletion, host application, voice verification, call intent, live call/media,
  payment, refund, earning settlement, withdrawal, referral qualification, and
  report transitions.
- Migration `0006_canonical_domain_state_machines.sql` persists transition
  definitions, transition history, audit events, canonical aggregate tables, and
  immutable snapshot storage.

Existing `/v1` bootstrap handlers must be migrated onto these command helpers
as they move from compatibility handlers into full module application services.

## V1 Runtime Ownership

| Concern                                                             | Owning runtime                    |
| ------------------------------------------------------------------- | --------------------------------- |
| HTTP commands and queries                                           | `backend/apps/api`                |
| App bootstrap, feature availability, update policy, legal versions  | `GET /v1/app/bootstrap`           |
| Realtime presence and call events                                   | `backend/apps/api` Socket.IO edge |
| Outbox dispatch, reconciliation, moderation, notifications, payouts | `backend/apps/worker`             |
| Source of truth                                                     | PostgreSQL                        |
| Ephemeral coordination                                              | Redis                             |
| Domain invariants                                                   | Canonical command services        |

## Shared Frontend Services

| Domain       | Method                                         | Current HTTP/event owner                                                     | Status      | Backend notes                                                                                    |
| ------------ | ---------------------------------------------- | ---------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------ |
| Analytics    | `track(event, properties)`                     | `POST /v1/analytics/events`                                                  | implemented | Validate event names/properties, strip PII, enqueue analytics dispatch.                          |
| Auth         | `getSession()`                                 | `GET /v1/auth/session`                                                       | implemented | Production response must include token expiry/account routing beyond the current minimal schema. |
| Auth         | `requestOtp(phoneNumber)`                      | `POST /v1/auth/otp`                                                          | implemented | Idempotent per phone/device/rate-limit bucket; OTP fake required locally.                        |
| Auth         | `verifyOtp({ code, requestId, role })`         | `POST /v1/auth/otp/verify`                                                   | implemented | Must return role-aware session, account status, and onboarding target.                           |
| Auth         | `signOut()`                                    | `POST /v1/auth/sign-out`                                                     | implemented | Revoke refresh token/session idempotently.                                                       |
| Customer     | `getProfile(customerId)`                       | `GET /v1/customers/:customerId`                                              | implemented | Server owns phone, DOB, gender, language, profile image, wallet link, account status.            |
| Customer     | `updateProfile({ customerId, profile })`       | `PATCH /v1/customers/:customerId/profile`                                    | implemented | Validate DOB/18+, image asset id, language set; audit sensitive changes.                         |
| Customer     | `listHosts()`                                  | `GET /v1/hosts`                                                              | implemented | Add language, tag, location, availability, rank, and block-list filters.                         |
| Host         | `getProfile(hostId)`                           | `GET /v1/hosts/:hostId`                                                      | implemented | Redact private identity/payout data from public profile responses.                               |
| Host         | `getApplication(hostId)`                       | `GET /v1/hosts/:hostId/application`                                          | implemented | Expand to draft steps, verification assets, review states, and required actions.                 |
| Host         | `getDashboard(hostId)`                         | `GET /v1/hosts/:hostId/dashboard`                                            | implemented | Aggregate host, application, earnings, incoming-call affordance, and availability.               |
| Host         | `getSelfIntroduction(hostId)`                  | `GET /v1/hosts/:hostId/self-introduction`                                    | implemented | Media review queue and discovery invalidation are worker-owned.                                  |
| Host         | `saveSelfIntroduction(hostId, input)`          | `PUT /v1/hosts/:hostId/self-introduction` + `host.self_introduction_changed` | implemented | Persist media/text hashes; do not expose raw transcripts in logs.                                |
| Host         | `getDailyStatus(hostId)`                       | `GET /v1/hosts/:hostId/daily-status`                                         | implemented | Status is host-authored but backend-owned for expiry and discovery filtering.                    |
| Host         | `saveDailyStatus(hostId, input)`               | `PUT /v1/hosts/:hostId/daily-status` + `host.daily_status_changed`           | implemented | Persist current mood/status metadata and enqueue discovery invalidation.                         |
| Host         | `updateAvailability({ hostId, availability })` | `PATCH /v1/hosts/:hostId/availability` + `host.availability_changed`         | implemented | Transactional state transition; prevent online when suspended/unverified/payout-blocked.         |
| Call         | `listCompletedCalls(userId)`                   | `GET /v1/calls?userId=:userId`                                               | implemented | Cursor pagination and role-scoped visibility.                                                    |
| Call         | `requestToken({ callId, role })`               | `POST /v1/calls/token`                                                       | implemented | Backend signs Agora token; never expose certificate.                                             |
| Call         | `completeCall(callId)`                         | `POST /v1/calls/:callId/complete` + `call.billing_tick_due`                  | implemented | Server-owned finalization posts ledger entries and worker reconciliation.                        |
| Payment      | `createPayment({ amount, customerId })`        | `POST /v1/payments`                                                          | implemented | Amount in paise; create Razorpay order and pending ledger intent idempotently.                   |
| Payment      | `verifyPayment({ paymentId })`                 | `POST /v1/payments/:paymentId/verify`                                        | implemented | Client callback moves to `verification-pending`; webhook/reconciliation remains authoritative.   |
| Wallet       | `getWallet(customerId)`                        | `GET /v1/wallets?customerId=:customerId`                                     | implemented | Balance derived from ledger, not client-supplied state.                                          |
| Wallet       | `listTransactions(walletId)`                   | `GET /v1/wallets/:walletId/transactions`                                     | implemented | Append-only ledger postings; cursor pagination required.                                         |
| Referral     | `listReferrals(customerId)`                    | `GET /v1/referrals?customerId=:customerId`                                   | implemented | Legacy list kept for compatibility; production uses customer/host overview endpoints below.      |
| Earnings     | `getEarnings(hostId)`                          | `GET /v1/hosts/:hostId/earnings`                                             | implemented | Derived from host earnings ledger with holds/reversals.                                          |
| Withdrawal   | `listWithdrawals(hostId)`                      | `GET /v1/withdrawals?hostId=:hostId`                                         | implemented | Host-scoped list; hide provider tokens.                                                          |
| Withdrawal   | `requestWithdrawal({ amount, hostId })`        | `POST /v1/withdrawals`                                                       | implemented | Idempotent, ledger-backed debit/hold, compliance and payout jobs.                                |
| Report       | `listReports()`                                | `GET /v1/reports`                                                            | implemented | Admin/user visibility must be scoped; redact report free text in logs.                           |
| Report       | `createReport(input)`                          | `POST /v1/reports`                                                           | implemented | Idempotent per reporter/target/context; supports media evidence.                                 |
| Support      | `listTickets(requesterId)`                     | `GET /v1/support/tickets?requesterId=:requesterId`                           | implemented | Cursor pagination and role-scoped access.                                                        |
| Support      | `createTicket(input)`                          | `POST /v1/support/tickets`                                                   | implemented | Idempotent; attachments use media asset ids.                                                     |
| Notification | `listNotifications(recipientId)`               | `GET /v1/notifications?recipientId=:recipientId`                             | implemented | Add push-device scoping and target route metadata.                                               |
| Notification | `markRead(notificationId)`                     | `POST /v1/notifications/:notificationId/read`                                | implemented | Idempotent; returns updated notification.                                                        |

## Legacy Frontend Adapters

`backend/packages/domain/src/adapters.ts` exposes older direct adapters. Production
should keep them as thin wrappers or retire them after callers use
`FrontendServices`.

| Adapter              | Methods                                | Owner                                                  |
| -------------------- | -------------------------------------- | ------------------------------------------------------ |
| `OtpAdapter`         | `requestOtp`, `verifyOtp`              | Auth OTP endpoints and OTP fake                        |
| `PaymentAdapter`     | `createPayment`, `verifyPayment`       | Payment order, callback verification, Razorpay webhook |
| `CallsAdapter`       | `requestToken`, `completeCall`         | Agora token signing and call finalization              |
| `WithdrawalsAdapter` | `listWithdrawals`, `requestWithdrawal` | Withdrawal ledger/payout workflow                      |
| `ReportsAdapter`     | `listReports`, `createReport`          | Safety/reporting workflow                              |
| `SupportAdapter`     | `listTickets`, `createTicket`          | Support ticket workflow                                |

## Feature-Local Mobile Contracts

### Auth

| Method                                     | Intended owner          | Status                        | Production endpoint/event                                                  |
| ------------------------------------------ | ----------------------- | ----------------------------- | -------------------------------------------------------------------------- |
| `CustomerAuthAdapter.requestOtp`           | Auth                    | mocked                        | `/v1/auth/otp` with referral code, role, device metadata, resend window    |
| `CustomerAuthAdapter.validateReferralCode` | Referral                | implemented for HTTP contract | `/v1/referrals/validate`                                                   |
| `CustomerAuthAdapter.verifyOtp`            | Auth                    | mocked                        | `/v1/auth/otp/verify` returning success, failure, or account-status result |
| Age confirmation                           | Auth/account compliance | missing                       | `/v1/auth/age-confirmation`                                                |
| Account status screens                     | Auth/account compliance | implemented endpoint          | `/v1/accounts/me/status` and future `account.status_changed`               |

### Customer Onboarding

| Method                             | Intended owner                  | Status                        | Production endpoint/job                                                    |
| ---------------------------------- | ------------------------------- | ----------------------------- | -------------------------------------------------------------------------- |
| `listLanguages`                    | Onboarding metadata             | mocked                        | `/v1/onboarding/languages`                                                 |
| `saveProfile`                      | Customer onboarding             | mocked + shared profile patch | `/v1/customers/:customerId/onboarding/profile`                             |
| `saveLanguages`                    | Customer onboarding             | mocked                        | `/v1/customers/:customerId/onboarding/languages`                           |
| `save match tags`                  | Customer matching               | implemented endpoint/storage  | `/v1/customers/onboarding/match-tags`, `/v1/tags`, `matching.tags_changed` |
| `listPermissionRequirements`       | Onboarding metadata             | mocked                        | `/v1/onboarding/permission-requirements`                                   |
| `requestNotificationPermission`    | Device/local plus backend audit | client-owned + missing        | `/v1/customers/:customerId/permissions`, `/v1/notifications/push-tokens`   |
| `requestMicrophonePermission`      | Device/local plus backend audit | client-owned + missing        | `/v1/customers/:customerId/permissions`                                    |
| `requestCameraPermission`          | Device/local plus backend audit | client-owned + missing        | `/v1/customers/:customerId/permissions`                                    |
| `requestLocationPermission`        | Device/local plus backend audit | client-owned + missing        | `/v1/customers/:customerId/location`                                       |
| `selectProfileImage`               | Device/local                    | client-only                   | Native image picker; backend receives signed upload intent later.          |
| `updateProfileImageCrop`           | Device/local                    | client-only                   | Crop metadata sent with upload completion.                                 |
| `submitHostVoiceVerification`      | Host application                | implemented endpoint/storage  | `/v1/hosts/:hostId/application/voice-verification`, moderation job         |
| `getHostVoiceVerificationApproval` | Host application                | implemented endpoint/storage  | `/v1/hosts/:hostId/application/voice-verification`, review job             |
| `submitHostAgreement`              | Host application/legal          | implemented endpoint          | `/v1/hosts/:hostId/application/agreement`                                  |

### Calls

| Method                        | Intended owner           | Status                           | Production endpoint/event/provider                                                          |
| ----------------------------- | ------------------------ | -------------------------------- | ------------------------------------------------------------------------------------------- |
| `createCallIntent`            | Call dispatch            | implemented for HTTP             | `/v1/calls/intents`                                                                         |
| `ringHost`                    | Call dispatch            | implemented for HTTP             | `/v1/calls/intents/:intentId/ring`, `call.incoming`, push notification                      |
| `releaseCallIntent`           | Call dispatch            | implemented for HTTP             | `/v1/calls/intents/:intentId/release`                                                       |
| `getMicrophonePermission`     | Device/local             | client-only                      | Native permission check                                                                     |
| `requestMicrophonePermission` | Device/local             | client-only                      | Native permission prompt plus backend audit if state changes                                |
| `prepareVoiceResources`       | Device/local             | client-only                      | Expo/native media bridge setup                                                              |
| `releaseVoiceResources`       | Device/local             | client-only                      | Expo/native media bridge release                                                            |
| `startVoiceSession`           | Call session/RTC         | mocked                           | `/v1/calls/sessions`, `/v1/calls/token`                                                     |
| `endVoiceSession`             | Call session/ledger      | implemented for HTTP             | `/v1/calls/sessions/:sessionId/end`                                                         |
| `ensureVideoUpgradeRequest`   | Video upgrade            | implemented for HTTP             | `/v1/calls/:callId/video-upgrade`, `video_upgrade.requested`                                |
| `pollVideoUpgrade`            | Video upgrade            | implemented for HTTP             | `/v1/calls/:callId/video-upgrade/:requestId`                                                |
| `activateVideoMode`           | Video upgrade/RTC        | implemented for HTTP             | `/v1/calls/sessions/:sessionId/video/activate`                                              |
| `waitForRemoteVideoConnected` | Native media bridge      | client-owned + provider callback | Native bridge plus `/v1/calls/sessions/:sessionId/video/connected`                          |
| `cancelVideoUpgradeRequest`   | Video upgrade            | implemented for HTTP             | `/v1/calls/:callId/video-upgrade/:requestId/cancel`                                         |
| `downgradeToVoice`            | Video fallback           | implemented for HTTP             | `/v1/calls/sessions/:sessionId/video/voice-fallback`                                        |
| Active telemetry              | Device/local plus server | client-owned + missing           | Native bridge; sampled telemetry to `/v1/calls/sessions/:sessionId/telemetry`               |
| Reconnecting state            | Call session             | missing                          | `call.reconnecting`, `call.recovered`, `call.ended` events                                  |
| Incoming host call            | Call dispatch            | mocked                           | `call.incoming`, `/v1/calls/intents/:intentId/accept`, `/v1/calls/intents/:intentId/reject` |

### Payments And Wallet

| Method                         | Intended owner         | Status                         | Production endpoint/provider                                          |
| ------------------------------ | ---------------------- | ------------------------------ | --------------------------------------------------------------------- |
| `PaymentAdapter.createOrder`   | Payments               | implemented via shared service | `POST /v1/payments`                                                   |
| `PaymentAdapter.openCheckout`  | Native Razorpay bridge | mocked                         | Native SDK handoff; no backend trust until verify/webhook succeeds    |
| `PaymentAdapter.verifyPayment` | Payments               | implemented via shared service | `/v1/payments/:paymentId/verify`                                      |
| Payment polling                | Payments               | mocked                         | `/v1/payments/:paymentId`                                             |
| Payment result deep link       | Payments               | missing full contract          | `/v1/payments/:paymentId`, `/v1/payments/:paymentId/verify`           |
| Razorpay webhook               | Payments               | missing                        | `/v1/payments/webhooks/razorpay`                                      |
| Wallet transaction detail      | Wallet ledger          | missing shared method          | `/v1/wallets/:walletId/transactions/:transactionId`                   |
| Refund request/detail          | Refunds                | missing feature implementation | `POST /v1/refunds`, `/v1/refunds/:refundId`, admin approval endpoints |

### Customer Account, Safety, Support, Notifications

| Method                                 | Intended owner           | Status                           | Production endpoint/event                                         |
| -------------------------------------- | ------------------------ | -------------------------------- | ----------------------------------------------------------------- |
| `listNotifications`                    | Notifications            | implemented + local merge        | `/v1/notifications?recipientId=:id`, `notification.created`       |
| `markNotificationRead`                 | Notifications            | implemented + local merge        | `/v1/notifications/:notificationId/read`                          |
| `markAllNotificationsRead`             | Notifications            | missing                          | `/v1/notifications/read-all`                                      |
| `getNotificationPreferences`           | Notification preferences | mocked                           | `/v1/customers/:customerId/notification-preferences`              |
| `updateNotificationPreferences`        | Notification preferences | mocked                           | `/v1/customers/:customerId/notification-preferences`              |
| `triggerLocalNotificationPreview`      | Device/local             | client-only                      | Development/preview only                                          |
| `listBlockedHosts`                     | Safety/preferences       | mocked via local discovery prefs | `/v1/customers/:customerId/blocked-hosts`                         |
| `unblockHost`                          | Safety/preferences       | mocked via local discovery prefs | `/v1/customers/:customerId/blocked-hosts/:hostId`                 |
| Block host                             | Safety/preferences       | missing adapter method           | `/v1/customers/:customerId/blocked-hosts`                         |
| `listReports`                          | Safety                   | implemented via shared service   | `GET /v1/reports` scoped by reporter                              |
| `createSupportAttachment`              | Media                    | mocked metadata                  | `/v1/media/upload-intents`, `/v1/media/:assetId/complete`         |
| `getSupportDraft` / `saveSupportDraft` | Device/local             | client-only                      | Draft may stay local until submission                             |
| `listSupportTickets`                   | Support                  | mixed local/post-call/shared     | `/v1/support/tickets?requesterId=:id`                             |
| `getSupportTicket`                     | Support                  | mocked                           | `/v1/support/tickets/:ticketId`                                   |
| `submitSupportTicket`                  | Support                  | mocked                           | `/v1/support/tickets`                                             |
| `requestDeleteAccount`                 | Account lifecycle        | implemented endpoint             | `/v1/customers/me/delete-account`, worker retention/redaction job |
| `getDeleteAccountState`                | Account lifecycle        | implemented endpoint             | `/v1/customers/me/delete-account`                                 |

### Referrals

| Method                                     | Intended owner            | Status                                            | Production endpoint/job                                                           |
| ------------------------------------------ | ------------------------- | ------------------------------------------------- | --------------------------------------------------------------------------------- |
| `validateCode`                             | Referral attribution      | implemented for HTTP                              | `/v1/referrals/validate`                                                          |
| `resolveInviteAttribution`                 | Referral invite           | implemented for HTTP                              | `/v1/referrals/invitations/resolve?code=:code`                                    |
| `getReferralOverview`                      | Referral overview/history | implemented for HTTP                              | `/v1/customers/:customerId/referrals/overview?ownReferralCode=:code`              |
| `getReferralDetail`                        | Referral detail           | implemented for HTTP                              | `/v1/customers/:customerId/referrals/:referralId`                                 |
| `copyReferralLink`                         | Device/local              | client-only                                       | Clipboard bridge                                                                  |
| `shareReferralInvitation`                  | Device/local              | client-only                                       | Native share bridge                                                               |
| `getUiState` / `markRewardCelebrationSeen` | Device/local              | client-only                                       | Local celebration state                                                           |
| Host referral overview/detail              | Host referrals            | missing                                           | `/v1/hosts/:hostId/referrals/overview`, `/v1/hosts/:hostId/referrals/:referralId` |
| Reward qualification/release               | Referral ledger           | state machine/storage implemented, worker missing | Worker job gated by signup, add-money, first paid call, and anti-abuse review     |

### Post-Call

| Method                                    | Intended owner    | Status               | Production endpoint/job                                                                      |
| ----------------------------------------- | ----------------- | -------------------- | -------------------------------------------------------------------------------------------- |
| `ensureCallRecord`                        | Call finalization | mocked               | `/v1/calls/:callId/complete` or worker-created record                                        |
| `refreshCallRecord`                       | Post-call summary | mocked               | `/v1/calls/:callId/post-call`                                                                |
| `getCallRecord`                           | Call detail       | mocked               | `/v1/calls/:callId` or `/v1/calls/:callId/post-call`                                         |
| `listCallRecords`                         | Call history      | mocked + shared list | `/v1/calls?userId=:userId`                                                                   |
| `submitRating`                            | Rating            | implemented          | `/v1/calls/:callId/rating`; migration `0009` enforces one rating per connected customer call |
| `createEvidenceMetadata`                  | Media             | mocked               | `/v1/media/upload-intents`                                                                   |
| `submitSupportTicket`                     | Support           | mocked               | `/v1/support/tickets` with `linkedCallId`                                                    |
| `listSupportTickets` / `getSupportTicket` | Support           | mocked               | `/v1/support/tickets`, `/v1/support/tickets/:ticketId`                                       |
| Final charge calculation                  | Call billing      | changed              | Worker must compute from server call events and RTC callbacks, not route params/timers.      |

## Deep Links

| Link shape                                      | Current destination                          | Backend owner                              |
| ----------------------------------------------- | -------------------------------------------- | ------------------------------------------ |
| `connecto://referral/:code`                     | `/(auth)/referral-code` or referral boundary | Referral invitation resolution             |
| `connecto://link/support-ticket/:ticketId`      | Support ticket boundary                      | Support ticket lookup, auth restore        |
| `connecto://link/payment-result`                | Payment state boundary                       | Payment result polling and verification    |
| `connecto://link/notification/:destination`     | Notification routing boundary                | Notification target metadata and mark-read |
| `connecto://link/call-invitation/:invitationId` | Call invitation boundary                     | Invitation resolve/accept/decline          |

## Admin Modules

All admin endpoints are under `/v1/admin/*`, require admin authorization, and
write command audit rows through `admin_audit_log` when the API runtime has a
PostgreSQL pool. PostgreSQL-backed API runtimes now authorize admin requests
through persisted `admin_sessions`, `admin_users`, role grants, and
`admin_permissions`; the memory admin fallback is retained only for lightweight
API tests that start without PostgreSQL.

| Module    | Backend route family                                                                                           | Current frontend                                                  |
| --------- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Dashboard | `GET /v1/admin/dashboard`                                                                                      | `/operations` reads `frontendServices.admin.getDashboard()`       |
| Hosts     | `GET /v1/admin/hosts`, `POST /v1/admin/hosts/:hostId/application-review`                                       | `/operations` reads host queue through `frontendServices.admin`   |
| Payments  | `GET /v1/admin/payments`, `POST /v1/admin/payments/:paymentId/reconcile`                                       | `/operations` reads payments through `frontendServices.admin`     |
| Refunds   | `GET /v1/admin/refunds`, `POST /v1/admin/refunds/:refundId/approve`, `POST /v1/admin/refunds/:refundId/reject` | `/operations` reads refund queue through `frontendServices.admin` |
| Reports   | `GET /v1/admin/reports`, `POST /v1/admin/reports/:reportId/resolution`                                         | `/operations` reads reports through `frontendServices.admin`      |
| Settings  | `GET /v1/admin/settings`, `PATCH /v1/admin/settings/feature-flags/:flagKey`                                    | `/operations` reads settings through `frontendServices.admin`     |
| Audit     | `GET /v1/admin/audit-log`                                                                                      | Operations audit viewer route metadata                            |

Remaining admin hardening: add redacted detail endpoints for host identity,
bank/UPI data, phone numbers, safety reports, transcripts, and provider
metadata before production access.

## Provider Callbacks And Jobs

| Owner              | Callback/job                         | Required behavior                                                                                           |
| ------------------ | ------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| OTP                | OTP fake/provider dispatch           | Fake, MSG91, and Twilio boundaries behind secret-store credentials; rate limiting remains a module task.    |
| Razorpay           | `/v1/payments/webhooks/razorpay`     | Razorpay order creation is wired; webhook processing is idempotent and posts wallet ledger entries.         |
| Agora              | RTC token issuance and RTC callbacks | Fake plus configured Agora/token-endpoint boundary; RTC callback billing still needs provider verification. |
| Payout provider    | Payout settlement callback           | Fake, Cashfree, and RazorpayX boundaries; production requires per-host beneficiary onboarding/tokenization. |
| Object storage     | Upload completion callback           | Fake, Azurite, Azure Blob SAS, and delegated S3 presign boundaries.                                         |
| Moderation/tagging | Media/text review jobs               | Fake, OpenAI moderation, and internal-ML tagging boundaries behind server-only secrets.                     |
| FCM/APNs/Expo      | Notification delivery receipts       | Push token persistence and FCM credential boundary; send/receipt fan-out remains worker-owned.              |
| Reconciliation     | Scheduled worker jobs                | Payment, refund, payout, call finalization, referral qualification, ledger balance checks.                  |
