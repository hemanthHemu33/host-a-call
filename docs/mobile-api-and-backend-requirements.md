# Mobile API and Backend Requirements

> **Historical requirements.** The paths in this document target the retired
> PostgreSQL `/v1` service. Mobile integration must be redesigned against the
> Samvad API described in [API source of truth](./api-source-of-truth.md).

Date: 2026-08-06

This document translates the current mobile frontend into a complete backend
contract for production. It is based on the Expo Router routes, feature models,
mock adapters, shared domain schemas, and existing backend contract in this
repo.

Primary source files:

- `apps/mobile/src/navigation/routes.ts`
- `apps/mobile/src/features/auth/*`
- `apps/mobile/src/features/customer-onboarding/*`
- `apps/mobile/src/features/discovery/*`
- `apps/mobile/src/features/finance/*`
- `apps/mobile/src/features/calls/*`
- `apps/mobile/src/features/post-call/*`
- `apps/mobile/src/features/customer/*`
- `apps/mobile/src/features/referrals/*`
- `apps/mobile/src/features/data/MobileDataScreens.tsx`
- `backend/packages/domain/src/models.ts`
- `backend/packages/domain/src/data-layer.ts`
- `docs/backend-api-contract.md`
- `docs/screen-inventory.md`

## Scope

The backend must support both mobile roles:

| Role     | Main path                                                                                                                                                                         | Production backend responsibility                                                                                                    |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Customer | Login, onboarding, host discovery, wallet, paid calls, video upgrade, post-call rating/report/support, referrals, account settings                                                | Own customer profile, wallet ledger, payment verification, call billing, safety state, support, notifications, referrals             |
| Host     | Login or conversion from customer onboarding, host verification, availability, incoming calls, active calls, dashboard, earnings, withdrawals, payout methods, profile, referrals | Own host profile/application, verification, realtime call dispatch, earnings ledger, payout compliance, ranking, support, moderation |

The current repo is frontend-only. Several screens are already wired through
`frontendServices` and HTTP paths. Other newer screens still use local mock
adapters or query-cache-only data. This document includes both because the
production mobile app needs all of them.

## API Standards

### Base Protocol

- Base URL comes from `EXPO_PUBLIC_CONNECTO_API_BASE_URL`.
- All mobile API calls use HTTPS.
- Request and response bodies are JSON unless an upload flow explicitly uses a
  signed upload URL.
- Currency is INR and all money values use paise:

```json
{
  "amountPaise": 1000,
  "currency": "INR"
}
```

### Authentication

- Mobile stores the session in SecureStore-compatible storage.
- API requests should use `Authorization: Bearer <accessToken>` or an equivalent
  secure mobile session token.
- The current shared `FrontendSession` shape is:

```json
{
  "sessionId": "session_123",
  "userId": "customer_1",
  "role": "customer",
  "issuedAtIso": "2026-08-06T00:00:00.000Z"
}
```

Production should add:

- `accessToken`
- `refreshToken` or refresh-cookie strategy
- `expiresAtIso`
- `accountStatus`
- `customerRouteTarget` for customer onboarding routing
- `hostApplicationStatus` when role is host

### Idempotency

Every money, call, report, support, withdrawal, and media mutation must accept:

- `Idempotency-Key` header.
- Backend-side idempotency record keyed by user, endpoint, idempotency key, and
  canonical request body hash.
- Same key and same body returns the original result.
- Same key and different body returns `409 conflict`.

Required idempotent operations:

- OTP request and verify
- Payment creation and verification
- Call intent creation, ring, accept, reject, end, complete
- Video upgrade request, cancel, accept, reject, fallback
- Wallet ledger posting
- Rating, report, support ticket, support reply
- Referral application and reward release
- Withdrawal request
- Payout method creation
- Host application submission
- Delete-account request

### Error Envelope

The frontend currently reads a top-level `message` and maps status codes through
`normalizeApiError`. Use this shape everywhere:

```json
{
  "code": "validation",
  "message": "Enter a valid IFSC code.",
  "retryable": false,
  "fieldErrors": {
    "ifsc": "Invalid IFSC."
  }
}
```

Standard codes:

| HTTP | Code                  | Meaning                                                       |
| ---- | --------------------- | ------------------------------------------------------------- |
| 400  | `validation`          | Bad input that user can fix                                   |
| 401  | `unauthorized`        | Missing, expired, or invalid session                          |
| 403  | `forbidden`           | Valid session but role or account state cannot perform action |
| 404  | `not-found`           | Entity not found or not visible to caller                     |
| 409  | `conflict`            | Idempotency mismatch, duplicate active call, stale state      |
| 422  | `validation`          | Field-level validation failure                                |
| 423  | `account-locked`      | Blocked, suspended, under-review, or underage account         |
| 429  | `rate-limited`        | OTP, login, call, payment, support, or report limit           |
| 500  | `server`              | Unexpected backend failure                                    |
| 503  | `offline` or `server` | Provider unavailable, retryable                               |

### Pagination

All list endpoints must support:

- `limit`, default 20, maximum 100.
- `cursor`, opaque server cursor.
- `sort`, when supported.
- `status`, `fromIso`, `toIso`, and role-specific filters where relevant.

Recommended list response:

```json
{
  "items": [],
  "nextCursor": null
}
```

The existing domain arrays can be returned for first integration, but production
should move to cursor responses once screens need infinite scroll.

### Realtime

Production calling cannot depend on polling alone. Provide a realtime channel
over WebSocket, SSE, or a managed realtime provider.

Recommended channel:

- `GET /realtime/connect` returns a signed realtime token and endpoint.
- Clients subscribe to `user:<userId>`, `host:<hostId>`, and `call:<callId>`.
- Push notifications are still required for background or killed app state.

Required realtime event families:

- `session.revoked`
- `account.status_changed`
- `host.availability_changed`
- `host.application_updated`
- `call.incoming`
- `call.cancelled`
- `call.accepted`
- `call.rejected`
- `call.no_answer`
- `call.busy`
- `call.connected`
- `call.reconnecting`
- `call.recovered`
- `call.ended`
- `call.billing_tick`
- `wallet.balance_updated`
- `video_upgrade.requested`
- `video_upgrade.accepted`
- `video_upgrade.rejected`
- `video_upgrade.timeout`
- `video_upgrade.cancelled`
- `support.ticket_updated`
- `report.status_updated`
- `referral.status_updated`
- `withdrawal.status_updated`
- `notification.created`

## Core Domain Models

### Enums

| Domain              | Values                                                                                                        |
| ------------------- | ------------------------------------------------------------------------------------------------------------- |
| Role                | `customer`, `host`, `admin`                                                                                   |
| Language            | `Bangla`, `English`, `Gujarati`, `Hindi`, `Kannada`, `Malayalam`, `Odia`, `Punjabi`, `Tamil`, `Telugu`        |
| Customer gender     | `man`, `woman`, `non-binary`, `prefer-not-to-say`                                                             |
| Host rank           | `bronze`, `silver`, `gold`, `platinum`, `diamond`                                                             |
| Host availability   | `online`, `busy`, `offline`, `paused`                                                                         |
| Verification status | `not-started`, `draft`, `submitted`, `under-review`, `changes-requested`, `verified`, `rejected`, `suspended` |
| Payment status      | `created`, `checkout-opened`, `verification-pending`, `pending`, `success`, `failure`, `cancelled`, `timeout` |
| Transaction status  | `pending`, `posted`, `failed`, `reversed`                                                                     |
| Withdrawal status   | `requested`, `compliance-review`, `processing`, `paid`, `failed`, `cancelled`                                 |
| Connection quality  | `excellent`, `good`, `poor`, `reconnecting`, `offline`                                                        |
| Media mode          | `voice`, `video`                                                                                              |

### Customer

Minimum response:

```json
{
  "id": "customer_1",
  "role": "customer",
  "displayName": "Customer One",
  "ageConfirmed": true,
  "dateOfBirthIso": "1995-08-12",
  "gender": "man",
  "preferredLanguages": ["Telugu", "English"],
  "profileImageUri": "https://cdn.example.com/customer.png",
  "notificationPermission": "granted",
  "onboardingCompletedAtIso": "2026-08-06T00:00:00.000Z",
  "referralCode": "CONNECTO100",
  "walletId": "wallet_1"
}
```

Production should also persist:

- Match tags: `friendship`, `love`, `marriage`, `time-pass`,
  `relationship`, `emotional-support`, `advice`, `fun-talk`.
- Last known location with consent: latitude, longitude, accuracy, place label,
  requested timestamp.
- Device notification permission state and push token registrations.
- Account status and moderation flags.
- Referral attribution locked at signup.

### Host Summary

Used by discovery, leaderboard, call start, and host dashboards:

```json
{
  "id": "host_anjali",
  "displayName": "Anjali",
  "age": 25,
  "language": "Telugu",
  "languages": ["Telugu", "English"],
  "location": "Hyderabad",
  "profileImageUri": "https://cdn.example.com/host.png",
  "rank": "gold",
  "rating": 4.8,
  "completedCalls": 420,
  "availability": "online",
  "status": "online",
  "verificationStatus": "verified",
  "isNewHost": false,
  "voiceRate": { "amountPaise": 1000, "currency": "INR" },
  "videoRate": { "amountPaise": 1600, "currency": "INR" },
  "videoAvailableAfterMinutes": 3,
  "voiceIntro": {
    "durationSeconds": 16,
    "recordingUri": "https://cdn.example.com/intro.wav",
    "recordedAtIso": "2026-08-06T00:00:00.000Z"
  }
}
```

### Wallet and Ledger

Wallet:

```json
{
  "id": "wallet_1",
  "customerId": "customer_1",
  "balance": { "amountPaise": 50000, "currency": "INR" },
  "heldBalance": { "amountPaise": 0, "currency": "INR" },
  "updatedAtIso": "2026-08-06T00:00:00.000Z"
}
```

Transaction:

```json
{
  "id": "transaction_1",
  "walletId": "wallet_1",
  "type": "wallet-credit",
  "status": "posted",
  "amount": { "amountPaise": 25000, "currency": "INR" },
  "referenceId": "payment_1",
  "linkedCallId": null,
  "occurredAtIso": "2026-08-06T00:00:00.000Z"
}
```

Ledger must be append-only. Balance changes must be derived from ledger entries,
not direct mutable balance writes.

## End-to-End Flow Requirements

## 1. App Start and Bootstrap

Routes:

- `/`
- `/bootstrap`
- `/mandatory-update`
- `/account-status`
- `/invalid-link`

Backend needs:

- Runtime bootstrap endpoint with app version rules, feature flags, legal links,
  support links, public provider IDs, and maintenance state.
- Session restore endpoint.
- Account status endpoint for blocked, suspended, underage, or active state.
- Deep link validation for referral, payment result, support ticket,
  notification, and call invitation links.

Endpoints:

| Method | Path                       | Request                                     | Response          | Notes                                              |
| ------ | -------------------------- | ------------------------------------------- | ----------------- | -------------------------------------------------- |
| GET    | `/v1/app/bootstrap`        | app version, platform, build number, locale | bootstrap config  | Must decide mandatory update before normal routing |
| GET    | `/v1/auth/session`         | session token                               | session or `null` | Existing contract                                  |
| POST   | `/v1/auth/session/refresh` | refresh token                               | session tokens    | Required for production mobile                     |
| GET    | `/v1/accounts/me/status`   | auth                                        | account status    | Used for blocked and suspended routes              |
| POST   | `/v1/analytics/events`     | event payload                               | `{ "ok": true }`  | Existing contract                                  |

Bootstrap response should include:

```json
{
  "serverTimeIso": "2026-08-06T00:00:00.000Z",
  "environment": "production",
  "minimumSupportedBuild": {
    "android": 120,
    "ios": 120
  },
  "mandatoryUpdate": {
    "required": false,
    "androidUpdateUrl": "https://play.google.com/store/apps/details?id=...",
    "iosUpdateUrl": "https://apps.apple.com/app/..."
  },
  "featureFlags": {
    "analyticsEnabled": true,
    "referralsEnabled": true,
    "videoUpgradeEnabled": true
  },
  "publicConfig": {
    "agoraAppId": "public-app-id",
    "razorpayKeyId": "rzp_live_public",
    "deepLinkHost": "connecto.app"
  }
}
```

## 2. Auth, Age Gate, OTP, Referral Entry

Routes:

- `/(auth)/age-confirmation`
- `/(auth)/underage-block`
- `/(auth)/login`
- `/(auth)/referral-code`
- `/(auth)/otp`
- `/(auth)/blocked-account`
- `/(auth)/suspended-account`

Frontend behavior:

- User confirms they are 18 or older.
- User enters India phone number.
- User may enter or skip referral code.
- OTP can expire, fail, hit too many attempts, or return blocked/suspended.
- Existing customers route to home.
- New customers route to onboarding.
- Host login uses the same OTP/session foundation, but role is host.

Backend requirements:

- OTP rate limits by phone, IP, device, and account.
- OTP attempts max and retry-after values.
- Referral code validation before OTP verification locks attribution.
- Phone number uniqueness and account status checks.
- Role-aware session creation.
- Support contact path for blocked and suspended accounts.

Endpoints:

| Method | Path                                           | Request                                                                  | Response                                        | Notes                                  |
| ------ | ---------------------------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------- | -------------------------------------- |
| POST   | `/v1/auth/otp`                                 | `phoneNumber`, optional `role`, optional `referralCode`, device metadata | `requestId`, `resendAfterSeconds`, masked phone | Existing path, needs richer response   |
| POST   | `/v1/auth/otp/verify`                          | `requestId`, `code`, `role`, optional `referralCode`, device metadata    | session or account-status/failure result        | Existing path                          |
| POST   | `/v1/auth/sign-out`                            | auth                                                                     | `{ "ok": true }`                                | Existing path                          |
| POST   | `/v1/referrals/validate`                       | `code`, `phoneNumber`                                                    | validation result                               | Already implemented as contract client |
| GET    | `/v1/referrals/invitations/resolve?code=:code` | code                                                                     | invite attribution                              | For `/referral/[code]`                 |
| POST   | `/v1/auth/age-confirmation`                    | `confirmed`, `birthDateIso` if collected                                 | age status                                      | Server should record 18+ confirmation  |

OTP verification result should support:

```json
{
  "kind": "success",
  "session": {
    "sessionId": "session_123",
    "accessToken": "jwt",
    "refreshToken": "opaque",
    "expiresAtIso": "2026-08-06T01:00:00.000Z",
    "userId": "customer_1",
    "role": "customer",
    "issuedAtIso": "2026-08-06T00:00:00.000Z"
  },
  "customerRouteTarget": "onboarding",
  "accountStatus": "active"
}
```

Failure result:

```json
{
  "kind": "failure",
  "reason": "invalid",
  "message": "Enter the 6-digit code we sent to your phone.",
  "attemptsRemaining": 2,
  "retryAfterSeconds": null
}
```

Account status result:

```json
{
  "kind": "account-status",
  "phoneNumber": "+919000000003",
  "status": "suspended",
  "supportMessage": "Your account is temporarily suspended while we review recent activity."
}
```

## 3. Customer Onboarding

Routes:

- `/(customer-onboarding)/profile-setup`
- `/(customer-onboarding)/language`
- `/(customer-onboarding)/match-tags`
- `/(customer-onboarding)/permissions`
- `/(customer-onboarding)/voice-verification`
- `/(customer-onboarding)/host-approval`
- `/(customer-onboarding)/host-agreement`

Flow:

1. Save display name, DOB, gender, optional profile image.
2. Save primary and optional secondary language.
3. Save match tags.
4. Request device permissions: microphone, camera, location, notifications.
5. Save notification preference and device push token when available.
6. Save location consent and last known location if granted.
7. If customer gender makes them a host applicant in the current frontend, run
   host voice verification, approval polling, and host agreement.
8. Complete onboarding and route customer to home or host dashboard.

Backend requirements:

- Draft persistence by step so app restart does not lose progress.
- Profile-image upload and crop metadata.
- Server-side DOB validation and age gate.
- Language list and match tag list.
- Permission consent audit.
- Push token registration.
- Location consent and coarse location storage.
- Host applicant conversion workflow.
- Voice verification audio upload and moderation/review.
- Host agreement versioning and acceptance record.

Endpoints:

| Method | Path                                              | Request                                                  | Response               | Notes                             |
| ------ | ------------------------------------------------- | -------------------------------------------------------- | ---------------------- | --------------------------------- |
| GET    | `/v1/customers/:customerId/onboarding`            | auth                                                     | onboarding draft       | Restores current step             |
| PATCH  | `/v1/customers/:customerId/onboarding/profile`    | name, DOB, gender, profile image asset                   | draft and customer     | Required                          |
| PATCH  | `/v1/customers/:customerId/onboarding/languages`  | primary and secondary languages                          | draft                  | Required                          |
| PATCH  | `/v1/customers/:customerId/onboarding/match-tags` | up to 4 tags                                             | draft                  | Required                          |
| GET    | `/v1/onboarding/languages`                        | none                                                     | language options       | Can be static or API              |
| GET    | `/v1/onboarding/match-tags`                       | none                                                     | match tag options      | Can be static or API              |
| GET    | `/v1/onboarding/permission-requirements`          | app version and locale                                   | permission cards       | Can be static or API              |
| POST   | `/v1/customers/:customerId/permissions`           | permission kind, decision, requested timestamp, platform | saved permission audit | Required                          |
| POST   | `/v1/customers/:customerId/location`              | lat, lng, accuracy, place label, consent timestamp       | saved location         | Required when granted             |
| POST   | `/v1/notifications/push-tokens`                   | user id, Expo/APNs/FCM token, platform, device id        | token record           | Required for push                 |
| POST   | `/v1/media/upload-intents`                        | purpose, mime, size, owner                               | signed upload          | Required for image/audio/evidence |
| POST   | `/v1/media/:assetId/complete`                     | checksum, dimensions/duration, crop metadata             | media asset            | Required                          |
| POST   | `/v1/customers/:customerId/onboarding/complete`   | final draft version                                      | customer               | Required                          |

Profile update body:

```json
{
  "displayName": "Aarohi",
  "dateOfBirthIso": "1998-04-16",
  "gender": "woman",
  "profileImageAssetId": "asset_123",
  "matchTags": ["friendship", "emotional-support"],
  "preferredLanguages": ["Telugu", "English"],
  "notificationPermission": "granted",
  "onboardingCompletedAtIso": "2026-08-06T00:00:00.000Z"
}
```

## 4. Host Application and Host Onboarding

Routes:

- `/(host-onboarding)/host-profile-setup`
- `/(host-onboarding)/photo`
- `/(host-onboarding)/rules`
- `/(host-onboarding)/verification`
- `/(host-onboarding)/payout`
- `/(host-onboarding)/agreement`
- `/(host-onboarding)/application-states`

Customer onboarding also includes host applicant subflow:

- voice verification recording
- approval wait screen
- host agreement

Backend requirements:

- Host application draft.
- Host public profile fields.
- Host public photo/v1/ review.
- Rule acceptance and agreement version.
- Voice verification or intro recording.
- Identity/KYC verification assets.
- Payout method collection with UPI and bank details.
- Application status lifecycle: draft, submitted, under review, changes
  requested, verified, rejected, suspended.
- Admin review APIs and audit trail.

Endpoints:

| Method | Path                                               | Request                                               | Response            | Notes                         |
| ------ | -------------------------------------------------- | ----------------------------------------------------- | ------------------- | ----------------------------- |
| GET    | `/v1/hosts/:hostId/application`                    | auth                                                  | host application    | Existing path                 |
| POST   | `/v1/hosts/applications`                           | customer id or host id                                | application         | Creates draft                 |
| PATCH  | `/v1/hosts/:hostId/application/profile`            | display name, languages, tags, bio, rates if editable | application         | Required                      |
| PATCH  | `/v1/hosts/:hostId/application/photo`              | profile asset id                                      | application         | Required                      |
| POST   | `/v1/hosts/:hostId/application/rules/accept`       | rules version                                         | application         | Required                      |
| POST   | `/v1/hosts/:hostId/application/voice-verification` | audio asset id, sentence, duration                    | verification status | Required                      |
| GET    | `/v1/hosts/:hostId/application/voice-verification` | auth                                                  | approval status     | Required polling and realtime |
| POST   | `/v1/hosts/:hostId/application/identity`           | document/selfie media asset ids                       | verification status | Required                      |
| POST   | `/v1/hosts/:hostId/application/payout-methods`     | UPI or bank details                                   | payout method       | Required                      |
| POST   | `/v1/hosts/:hostId/application/agreement`          | accepted, agreement version                           | application         | Required                      |
| POST   | `/v1/hosts/:hostId/application/submit`             | application version                                   | application         | Required                      |
| POST   | `/admin/host-applications/:applicationId/review`   | decision, reason, requested changes                   | application         | Admin requirement             |

Host application response:

```json
{
  "id": "application_1",
  "applicantId": "host_anjali",
  "status": "under-review",
  "languages": ["Telugu", "English"],
  "createdAtIso": "2026-08-06T00:00:00.000Z",
  "submittedAtIso": "2026-08-06T00:10:00.000Z",
  "reviewedAtIso": null,
  "reviewMessage": null,
  "requiredChanges": []
}
```

## 5. Customer Home, Discovery, Filters

Routes:

- `/(customer)/home`
- `/(customer)/filters`

Frontend behavior:

- Loads customer profile, wallet, host list, notifications, pricing strip.
- Sorts hosts by preferred language, online/busy status, rank, rating, and
  completed calls.
- Filters by online-only, language, rank, top-rated, new-hosts-only.
- Hides blocked hosts.
- Starts a direct host call or random-host call.
- Opens add-money when balance is insufficient.
- May play host voice intro audio.

Backend requirements:

- Search/list host summaries with filters.
- Server-side eligibility: only verified, visible, not suspended hosts.
- Host voice intro signed URLs.
- Price/rate snapshot included per host.
- Availability freshness and busy state.
- Blocked host exclusion.
- Discovery ranking that can reproduce frontend sort or provide server order.

Endpoints:

| Method | Path                                              | Request                      | Response             | Notes                              |
| ------ | ------------------------------------------------- | ---------------------------- | -------------------- | ---------------------------------- |
| GET    | `/v1/customers/:customerId`                       | auth                         | customer             | Existing path                      |
| PATCH  | `/v1/customers/:customerId/profile`               | customer profile update      | customer             | Existing path                      |
| GET    | `/hosts`                                          | filters, cursor, customer id | host summaries       | Existing path, needs query filters |
| GET    | `/v1/hosts/:hostId`                               | auth                         | host profile         | Existing path                      |
| POST   | `/v1/customers/:customerId/blocked-hosts`         | `hostId`, reason             | blocked host summary | Required                           |
| GET    | `/v1/customers/:customerId/blocked-hosts`         | auth                         | list                 | Required                           |
| DELETE | `/v1/customers/:customerId/blocked-hosts/:hostId` | auth                         | list                 | Required                           |
| GET    | `/pricing/rules`                                  | role, rank, language         | pricing rules        | Required if rates are dynamic      |

Host filters:

```json
{
  "language": "Telugu",
  "onlineOnly": true,
  "rank": "gold",
  "topRated": true,
  "newHostsOnly": false
}
```

## 6. Wallet, Add Money, Payment Result

Routes:

- `/(customer)/add-money`
- `/(customer)/payment-states`
- `/link/payment-result`
- `/(customer)/transaction/[transactionId]`

Frontend behavior:

- Allows quick top-up amounts: 25, 50, 100, 140, 200, 300, 500, 900, 1900,
  9800, 15000 rupees.
- Minimum top-up is INR 25.
- Maximum top-up is INR 50,000.
- Methods modeled: UPI, card, net banking, QR, wallet, pay later, provider UPI
  apps.
- Creates order, opens native checkout, verifies payment, updates wallet only
  after backend verification.
- Handles success, failure, cancelled, timeout, pending, duplicate callback.
- Can return to an outgoing call auto-connect path after successful top-up.

Backend requirements:

- Payment orders with provider order id.
- Native SDK public key only in frontend.
- All payment verification must be backend-side with provider signature and
  webhook confirmation.
- Wallet ledger credit must be idempotent and tied to verified payment.
- Duplicate callbacks must not double credit wallet.
- Payment deep link must include only non-secret identifiers.
- Transaction detail endpoint.

Endpoints:

| Method | Path                                                | Request                                         | Response           | Notes                          |
| ------ | --------------------------------------------------- | ----------------------------------------------- | ------------------ | ------------------------------ |
| GET    | `/v1/wallets?customerId=:customerId`                | auth                                            | wallet             | Existing path                  |
| GET    | `/v1/wallets/:walletId/transactions`                | cursor, filters                                 | transactions       | Existing path                  |
| GET    | `/v1/wallets/:walletId/transactions/:transactionId` | auth                                            | transaction detail | Required                       |
| POST   | `/payments`                                         | customer id, amount, method, origin, return url | payment            | Existing path                  |
| GET    | `/v1/payments/:paymentId`                           | auth                                            | payment            | Required for polling/deep link |
| POST   | `/v1/payments/:paymentId/checkout-opened`           | method, provider data                           | payment            | Required for audit             |
| POST   | `/v1/payments/:paymentId/verify`                    | provider payment id, signature, callback id     | payment            | Existing path                  |
| POST   | `/v1/payments/webhooks/razorpay`                    | provider webhook                                | internal ack       | Backend-only                   |

Payment create body:

```json
{
  "customerId": "customer_1",
  "amount": { "amountPaise": 25000, "currency": "INR" },
  "method": "upi",
  "origin": "add-money",
  "returnUrl": "connecto://payment-result",
  "metadata": {
    "discoveryHostId": "host_anjali",
    "autoConnect": true
  }
}
```

Payment response:

```json
{
  "id": "payment_1",
  "customerId": "customer_1",
  "amount": { "amountPaise": 25000, "currency": "INR" },
  "providerOrderId": "order_abc",
  "status": "created",
  "checkout": {
    "provider": "razorpay",
    "publicKeyId": "rzp_live_public",
    "orderId": "order_abc",
    "prefill": {
      "contact": "+919000000001",
      "name": "Customer One"
    }
  }
}
```

## 7. Outgoing Call Preflight and Ringing

Routes:

- `/call/outgoing`

Frontend behavior:

- Checks session and role.
- Blocks signed-out, wrong-role, blocked, or suspended accounts.
- Checks blocked host list.
- Checks host availability.
- Requires minimum voice balance: `max(host.voiceRate * 3, 1500 paise)`.
- Checks or requests microphone permission.
- Creates call intent.
- Prepares voice resources.
- Rings host.
- Handles accepted, rejected, busy, no-answer, timeout, failed, cancelled.

Backend requirements:

- Server-side preflight must repeat every frontend check.
- Host availability must become busy/locked while ringing or active.
- Customer wallet hold should reserve minimum call balance.
- Call intent must be released on cancel, reject, timeout, or failed setup.
- Host must receive incoming call through realtime and push.
- A call cannot be connected unless both sides accept and have valid tokens.

Endpoints:

| Method | Path                                  | Request                                     | Response         | Notes                                                                    |
| ------ | ------------------------------------- | ------------------------------------------- | ---------------- | ------------------------------------------------------------------------ |
| POST   | `/v1/calls/intents`                   | customer id, host id, language, min balance | call intent      | Implemented in call preconnect HTTP adapter                              |
| POST   | `/v1/calls/intents/:intentId/ring`    | host id                                     | `outcome`        | Current adapter expects sync outcome; production should use realtime too |
| POST   | `/v1/calls/intents/:intentId/release` | auth                                        | `{ "ok": true }` | Required                                                                 |
| POST   | `/v1/calls/intents/:intentId/cancel`  | reason                                      | call event       | Required                                                                 |
| POST   | `/v1/calls/intents/:intentId/accept`  | host id                                     | call accepted    | Required for host app                                                    |
| POST   | `/v1/calls/intents/:intentId/reject`  | host id, reason                             | call rejected    | Required for host app                                                    |
| POST   | `/v1/calls/token`                     | call id, role                               | RTC token        | Existing path                                                            |

Call intent response:

```json
{
  "id": "call_intent_123",
  "customerId": "customer_1",
  "hostId": "host_anjali",
  "language": "Telugu",
  "minimumRequiredBalancePaise": 3000,
  "rtcChannelName": "call_call_intent_123",
  "status": "created",
  "createdAtIso": "2026-08-06T00:00:00.000Z"
}
```

Ring result:

```json
{
  "outcome": "accepted",
  "acceptedAtIso": "2026-08-06T00:00:05.000Z",
  "hostSessionId": "host_session_123"
}
```

Realtime `call.incoming` event:

```json
{
  "type": "call.incoming",
  "eventId": "event_1",
  "createdAtIso": "2026-08-06T00:00:00.000Z",
  "intent": {
    "id": "call_intent_123",
    "customerId": "customer_1",
    "hostId": "host_anjali",
    "customerDisplayName": "Customer One",
    "customerProfileImageUri": "https://cdn.example.com/customer.png",
    "language": "Telugu",
    "voiceRate": { "amountPaise": 1000, "currency": "INR" },
    "videoRate": { "amountPaise": 1600, "currency": "INR" }
  },
  "expiresAtIso": "2026-08-06T00:00:15.000Z"
}
```

## 8. Active Voice Call

Routes:

- `/call/voice`
- `/call/reconnecting`
- `/call/summary`
- `/call/report`

Frontend behavior:

- Starts voice session with Agora or mock token.
- Connects media bridge.
- Tracks connected duration.
- Video unlock happens after 180 seconds of connected voice.
- Shows network quality, audio level, mute, speaker, estimated charge, estimated
  remaining balance.
- Handles reconnect window, default 30 seconds.
- Supports low-balance warning, low-balance add-money grace, and balance-zero
  end.
- Ends call manually, on reconnect timeout, balance zero, or report submit.

Backend requirements:

- RTC token minting using backend-only Agora certificate.
- Session start and end.
- Billing meter based on connected server-side media events, not frontend timer
  only.
- Wallet hold and periodic ledger/hold adjustment.
- Token refresh before expiry.
- Reconnect recovery and timeout.
- Call completion record and wallet finalization.

Endpoints:

| Method | Path                                      | Request                             | Response              | Notes                                  |
| ------ | ----------------------------------------- | ----------------------------------- | --------------------- | -------------------------------------- |
| POST   | `/v1/calls/token`                         | call id, role                       | token, expiry         | Existing path                          |
| POST   | `/v1/calls/sessions`                      | call id, role, device info          | session               | Required to avoid client-generated ids |
| POST   | `/v1/calls/sessions/:sessionId/connect`   | RTC join metadata                   | session               | Required                               |
| POST   | `/v1/calls/sessions/:sessionId/telemetry` | audio/network/device sample         | ack                   | Optional but useful                    |
| GET    | `/v1/calls/sessions/:sessionId`           | auth                                | session state         | Required                               |
| POST   | `/v1/calls/sessions/:sessionId/end`       | reason, durations, client estimates | `{ "ok": true }`      | Implemented in HTTP session adapter    |
| POST   | `/v1/calls/:callId/complete`              | final state request                 | completed call record | Existing path                          |
| GET    | `/v1/calls?userId=:userId`                | role, cursor                        | completed calls       | Existing path                          |
| GET    | `/v1/calls/:callId`                       | auth                                | call detail           | Required                               |

Call token response:

```json
{
  "token": "rtc-token",
  "expiresAtIso": "2026-08-06T00:10:00.000Z"
}
```

Active session response:

```json
{
  "id": "active_session_123",
  "callId": "call_123",
  "customerId": "customer_1",
  "hostId": "host_anjali",
  "provider": "agora",
  "rtcChannelName": "call_123",
  "rtcToken": "rtc-token",
  "tokenExpiresAtIso": "2026-08-06T00:10:00.000Z",
  "startedAtIso": "2026-08-06T00:00:00.000Z",
  "mediaMode": "voice",
  "voiceRate": { "amountPaise": 1000, "currency": "INR" },
  "videoRate": { "amountPaise": 1600, "currency": "INR" },
  "videoAvailableAfterMinutes": 3
}
```

Billing tick event:

```json
{
  "type": "call.billing_tick",
  "callId": "call_123",
  "sessionId": "active_session_123",
  "connectedSeconds": 120,
  "videoSeconds": 0,
  "estimatedCharge": { "amountPaise": 2000, "currency": "INR" },
  "remainingBalance": { "amountPaise": 48000, "currency": "INR" },
  "lowBalanceState": "none"
}
```

## 9. Video Upgrade During Call

Routes:

- `/call/video-request`
- `/call/video`

Frontend behavior:

- Video request only after voice unlock.
- Customer requests video.
- Host accepts, rejects, leaves pending, or times out.
- If accepted, customer checks camera permission.
- Countdown runs before video connection.
- App activates video mode, waits for remote video connected, then marks video
  billing active.
- Customer can cancel while pending/countdown.
- Host rejection creates cooldown, default 30 seconds.
- User can downgrade back to voice.
- Camera on/off, mute, speaker, switch camera are local media operations, but
  backend must know billing-relevant mode and fallback state.

Backend endpoints already expected by code:

| Method | Path                                                 | Request                                  | Response                     | Notes                        |
| ------ | ---------------------------------------------------- | ---------------------------------------- | ---------------------------- | ---------------------------- |
| POST   | `/v1/calls/:callId/video-upgrade`                    | auth                                     | video upgrade request        | Current HTTP backend adapter |
| GET    | `/v1/calls/:callId/video-upgrade/:requestId`         | auth                                     | video upgrade request        | Polling fallback             |
| POST   | `/v1/calls/:callId/video-upgrade/:requestId/cancel`  | auth                                     | `{ "ok": true }`             | Current HTTP backend adapter |
| POST   | `/v1/calls/sessions/:sessionId/video/activate`       | call id, current token, request id       | token patch                  | Current HTTP backend adapter |
| POST   | `/v1/calls/sessions/:sessionId/video/connected`      | call id, connected timestamp, request id | verification and token patch | Current HTTP backend adapter |
| POST   | `/v1/calls/sessions/:sessionId/video/voice-fallback` | reason, timestamp                        | `{ "ok": true }`             | Current HTTP backend adapter |

Additional host-side endpoints:

| Method | Path                                                | Request         | Response      | Notes                 |
| ------ | --------------------------------------------------- | --------------- | ------------- | --------------------- |
| POST   | `/v1/calls/:callId/video-upgrade/:requestId/accept` | host id         | video request | Required for host app |
| POST   | `/v1/calls/:callId/video-upgrade/:requestId/reject` | host id, reason | video request | Required for host app |

Video upgrade response:

```json
{
  "id": "video_request_1",
  "status": "pending",
  "rtcToken": null,
  "tokenExpiresAtIso": null,
  "createdAtIso": "2026-08-06T00:03:00.000Z",
  "updatedAtIso": "2026-08-06T00:03:00.000Z"
}
```

Accepted response:

```json
{
  "id": "video_request_1",
  "status": "accepted",
  "rtcToken": "video-rtc-token",
  "tokenExpiresAtIso": "2026-08-06T00:13:00.000Z",
  "createdAtIso": "2026-08-06T00:03:00.000Z",
  "updatedAtIso": "2026-08-06T00:03:04.000Z"
}
```

Remote video verification response:

```json
{
  "connectedAtIso": "2026-08-06T00:03:10.000Z",
  "verificationStatus": "verified",
  "videoBillingStatus": "active",
  "rtcToken": "refreshed-token",
  "tokenExpiresAtIso": "2026-08-06T00:13:10.000Z"
}
```

## 10. Incoming Host Call

Routes:

- `/call/incoming`
- `/call/voice`
- `/call/video-request`
- `/call/video`
- `/call/reconnecting`
- `/call/summary`

Frontend status:

- Host incoming call screen exists as a route and screenshots, but the app still
  needs production realtime dispatch and accept/reject endpoints.

Backend requirements:

- Dispatch incoming call to host in foreground realtime.
- Send high-priority push for background/killed app.
- Ring timeout.
- Host accept/reject/no-answer state machine.
- Lock host to busy while ringing or active.
- Release host availability after call end or failed setup.
- Host can report/block customer if supported by policy.

Host incoming actions:

| Action                | Endpoint or event                                    |
| --------------------- | ---------------------------------------------------- |
| Receive incoming call | `call.incoming` realtime and push                    |
| Accept                | `/v1/calls/intents/:intentId/accept`                 |
| Reject                | `/v1/calls/intents/:intentId/reject`                 |
| Timeout               | backend timer emits `call.no_answer`                 |
| Customer cancels      | `call.cancelled` event                               |
| Start session         | `/v1/calls/sessions` or server-issued active session |

## 11. Call Completion, Summary, Rating, Support, Report

Routes:

- `/call/summary`
- `/call/report`
- `/(customer)/calls`
- `/(customer)/v1/calls/[callId]`
- `/(customer)/report-history`
- `/(customer)/support`
- `/(customer)/support-ticket/[ticketId]`
- `/link/support-ticket/[ticketId]`

Frontend behavior:

- Creates or refreshes a post-call record.
- Post-call finalization moves from processing to finalized after a delay in the
  mock adapter.
- Shows voice/video duration, final charge, wallet balance after, host info,
  verification state.
- Allows rating stars 1 to 5 with tags.
- Allows support ticket with category, comments, evidence attachment metadata,
  linked call id.
- Call report uses a persisted draft with idempotency key and evidence context.
- Report categories map to report kind: host, content, payment, call.
- Can block host after call.

Backend requirements:

- Server-generated final call record.
- Final billing should round according to backend billing policy.
- Wallet debit ledger entries and host earnings entries must post atomically.
- Rating must be one per connected call per customer.
- Report submission must preserve call context and evidence metadata.
- Support tickets can link to call and attachments.
- Call history and call detail for both customer and host.

Endpoints:

| Method | Path                                           | Request                                                         | Response                   | Notes                                  |
| ------ | ---------------------------------------------- | --------------------------------------------------------------- | -------------------------- | -------------------------------------- |
| GET    | `/v1/calls?userId=:userId`                     | role, cursor, filters                                           | completed call records     | Existing path                          |
| GET    | `/v1/calls/:callId`                            | auth                                                            | post-call/call detail      | Required                               |
| POST   | `/v1/calls/:callId/complete`                   | reason, client estimates                                        | completed call record      | Existing path                          |
| GET    | `/v1/calls/:callId/post-call`                  | auth                                                            | post-call record           | Required                               |
| POST   | `/v1/calls/:callId/rating`                     | stars, tags, comment                                            | post-call record           | Required                               |
| POST   | `/reports`                                     | report kind, target id, description, evidence, idempotency key  | report                     | Existing path                          |
| GET    | `/v1/reports?reporterId=:userId`               | cursor, status                                                  | reports                    | Existing path should support filtering |
| POST   | `/v1/support/tickets`                          | category, requester id, subject, body, linked call, attachments | support ticket             | Existing path needs richer body        |
| GET    | `/v1/support/tickets?requesterId=:requesterId` | cursor                                                          | support tickets            | Existing path                          |
| GET    | `/v1/support/tickets/:ticketId`                | auth                                                            | ticket detail and messages | Required                               |
| POST   | `/v1/support/tickets/:ticketId/messages`       | body, attachments                                               | ticket detail              | Required                               |
| POST   | `/v1/support/tickets/:ticketId/close`          | reason                                                          | ticket detail              | Required                               |
| POST   | `/refunds`                                     | customer id, call id or payment id, reason                      | refund request             | Required                               |
| GET    | `/v1/refunds?customerId=:customerId`           | cursor                                                          | refund requests            | Existing path                          |

Post-call record response:

```json
{
  "id": "call_1",
  "callId": "call_1",
  "sessionId": "active_session_123",
  "customerId": "customer_1",
  "hostId": "host_anjali",
  "hostName": "Anjali",
  "hostAge": 25,
  "hostPrimaryLanguage": "Telugu",
  "hostRank": "gold",
  "mediaSummary": "voice-video",
  "startedAtIso": "2026-08-06T00:00:00.000Z",
  "endedAtIso": "2026-08-06T00:05:00.000Z",
  "endReason": "customer-ended",
  "connectedDurationSeconds": 300,
  "voiceDurationSeconds": 180,
  "videoDurationSeconds": 120,
  "finalizationStatus": "finalized",
  "verificationState": "verified",
  "chargeBreakdown": {
    "estimatedVoice": { "amountPaise": 3000, "currency": "INR" },
    "estimatedVideo": { "amountPaise": 3200, "currency": "INR" },
    "estimatedTotal": { "amountPaise": 6200, "currency": "INR" },
    "finalizedVoice": { "amountPaise": 3000, "currency": "INR" },
    "finalizedVideo": { "amountPaise": 3200, "currency": "INR" },
    "finalizedTotal": { "amountPaise": 6200, "currency": "INR" }
  },
  "walletBalanceAfter": { "amountPaise": 43800, "currency": "INR" },
  "rating": null,
  "linkedSupportTicketId": null
}
```

## 12. Customer Account, Settings, Notifications, Safety

Routes:

- `/(customer)/profile`
- `/(customer)/profile-edit`
- `/(customer)/settings`
- `/(customer)/language-settings`
- `/(customer)/motion-settings`
- `/(customer)/notifications`
- `/(customer)/notification-preferences`
- `/(customer)/privacy-safety`
- `/(customer)/blocked-users`
- `/(customer)/delete-account`
- `/(customer)/support`
- `/(customer)/support-ticket/[ticketId]`
- `/link/notification/[destination]`
- `/link/support-ticket/[ticketId]`
- `/legal/terms`
- `/legal/privacy`
- `/legal/community-guidelines`

Frontend behavior:

- Profile view/edit.
- Language settings.
- Motion preferences are local-only and do not require backend unless product
  wants account sync.
- Notification feed combines backend domain notifications and local preview
  notifications.
- Notification preferences by category: call, payment, referral, safety,
  support.
- Mark notification read and mark all read.
- Trigger local preview in development.
- Blocked host list and unblock.
- Report history.
- Support drafts, tickets, linked calls, attachments.
- Delete account blocked if wallet balance is positive.
- Legal documents are static in frontend today, but production should serve
  current versions and acceptance state.

Backend requirements:

- Customer profile update endpoint must accept image changes and language
  changes.
- Notification feed endpoint must support target route metadata and deep link
  payload.
- Push token and notification preference storage.
- Support ticket detail, messages, attachments.
- Delete-account request with wallet eligibility check.
- Legal document versions and acceptance records.

Endpoints:

| Method | Path                                                 | Request              | Response             | Notes                              |
| ------ | ---------------------------------------------------- | -------------------- | -------------------- | ---------------------------------- |
| GET    | `/v1/customers/:customerId`                          | auth                 | customer             | Existing path                      |
| PATCH  | `/v1/customers/:customerId/profile`                  | profile fields       | customer             | Existing path                      |
| PATCH  | `/v1/customers/:customerId/languages`                | primary, secondary   | customer             | Required                           |
| GET    | `/v1/notifications?recipientId=:recipientId`         | cursor               | notifications        | Existing path                      |
| POST   | `/v1/notifications/:notificationId/read`             | auth                 | notification         | Existing path                      |
| POST   | `/v1/notifications/read-all`                         | recipient id         | notifications        | Required                           |
| GET    | `/v1/customers/:customerId/notification-preferences` | auth                 | preferences          | Required                           |
| PUT    | `/v1/customers/:customerId/notification-preferences` | preferences          | preferences          | Required                           |
| POST   | `/v1/notifications/push-tokens`                      | token and platform   | token record         | Required                           |
| DELETE | `/v1/notifications/push-tokens/:tokenId`             | auth                 | `{ "ok": true }`     | Required                           |
| GET    | `/v1/customers/:customerId/blocked-hosts`            | auth                 | blocked hosts        | Required                           |
| DELETE | `/v1/customers/:customerId/blocked-hosts/:hostId`    | auth                 | blocked hosts        | Required                           |
| GET    | `/v1/reports?reporterId=:customerId`                 | status, cursor       | reports              | Required filter                    |
| GET    | `/v1/customers/:customerId/delete-account`           | auth                 | delete account state | Required                           |
| POST   | `/v1/customers/:customerId/delete-account`           | reason, confirmation | delete request       | Required                           |
| GET    | `/legal/:documentKey`                                | locale, app version  | legal document       | Required                           |
| POST   | `/legal/:documentKey/accept`                         | version              | acceptance           | Required when acceptance is needed |

Notification feed item:

```json
{
  "id": "notification_1",
  "customerId": "customer_1",
  "category": "payment",
  "destination": "wallet",
  "targetRouteId": "customerAddMoney",
  "targetParams": {},
  "title": "Wallet top-up verified",
  "body": "Your add-money verification is complete.",
  "createdAtIso": "2026-08-06T00:00:00.000Z",
  "readAtIso": null,
  "source": "domain"
}
```

Push payload:

```json
{
  "title": "Support follow-up ready",
  "body": "Reply from the ticket if you want review to continue faster.",
  "data": {
    "deepLink": "/link/notification/v1/?notificationId=notification_1&ticketId=ticket_1"
  }
}
```

## 13. Customer Referrals

Routes:

- `/(auth)/referral-code`
- `/referral/[code]`
- `/(customer)/referrals`
- `/(customer)/v1/referrals/[referralId]`

Frontend behavior:

- Resolve deep link attribution.
- Validate referral code before signup.
- Existing signed-in user cannot retroactively apply a code.
- Customer sees own referral code, share link, share message, reward amounts,
  rules, applied code, history.
- Referral statuses: pending, qualified, rewarded, rejected, expired.
- Timeline steps: joined, minimum add-money met, first paid call completed,
  verification, reward released.
- Rewards link to wallet transaction if released.
- Celebration state is local UI only.

Backend requirements:

- Signup-only referral attribution.
- Own referral code generation.
- Referral history and rules.
- Anti-abuse review status and messaging.
- Reward release through wallet ledger only after verified milestones.
- Deep link and invite attribution.
- Host referral screen currently local/mock, but production needs host referral
  overview too.

Endpoints:

| Method | Path                                                                 | Request                       | Response               | Notes                                   |
| ------ | -------------------------------------------------------------------- | ----------------------------- | ---------------------- | --------------------------------------- |
| POST   | `/v1/referrals/validate`                                             | code, phone number            | validation contract    | Already used                            |
| GET    | `/v1/referrals/invitations/resolve?code=:code`                       | code                          | invite attribution     | Already used                            |
| POST   | `/v1/referrals/apply`                                                | customer id, code, request id | attribution            | Required if not bundled into OTP verify |
| GET    | `/v1/customers/:customerId/referrals/overview?ownReferralCode=:code` | auth                          | referral overview      | Already used                            |
| GET    | `/v1/customers/:customerId/referrals/:referralId`                    | auth                          | referral detail        | Already used                            |
| GET    | `/v1/hosts/:hostId/referrals/overview`                               | auth                          | host referral overview | Required for host referrals             |
| GET    | `/v1/referrals/rules`                                                | role, locale                  | rules                  | Optional if overview includes rules     |

Referral overview response:

```json
{
  "appliedReferralCode": "CONNECTO100",
  "ownReferralCode": "CUSTOM0001",
  "shareLink": "connecto://referral/CUSTOM0001",
  "shareMessage": "Join me on Connecto with my referral code CUSTOM0001.",
  "rewardAmounts": {
    "newCustomer": { "amountPaise": 10000, "currency": "INR" },
    "referrer": { "amountPaise": 10000, "currency": "INR" }
  },
  "rules": [
    {
      "id": "signup-rule",
      "title": "Code entry is signup-only",
      "body": "A valid signup must happen through a referral code before the first verified login."
    }
  ],
  "history": []
}
```

## 14. Host Dashboard, Availability, Calls, Recent, Leaderboard

Routes:

- `/(host)/dashboard`
- `/(host)/calls`
- `/(host)/recent`
- `/(host)/leaderboard`
- `/(host)/settings`

Frontend behavior:

- Host dashboard loads host profile, application, and earnings.
- Host can toggle online and paused.
- Host call history and recent calls read completed call records.
- Leaderboard currently reuses host list sorted by completed calls.
- Settings route is present.

Backend requirements:

- Dashboard summary endpoint.
- Availability update with server-side eligibility and conflict checks.
- Host cannot go online unless verified, payout requirements met if required,
  not suspended, and not already in a call.
- Recent calls and call history by host.
- Leaderboard endpoint with rank, completed calls, rating, earnings drivers.
- Settings endpoint for host preferences.

Endpoints:

| Method | Path                             | Request                     | Response          | Notes         |
| ------ | -------------------------------- | --------------------------- | ----------------- | ------------- |
| GET    | `/v1/hosts/:hostId/dashboard`    | auth                        | host dashboard    | Existing path |
| GET    | `/v1/hosts/:hostId`              | auth                        | host profile      | Existing path |
| PATCH  | `/v1/hosts/:hostId/availability` | `availability`              | host              | Existing path |
| GET    | `/v1/calls?userId=:hostId`       | role=host, cursor           | host calls        | Existing path |
| GET    | `/v1/hosts/:hostId/recent-calls` | cursor, limit               | recent call cards | Required      |
| GET    | `/v1/hosts/leaderboard`          | rank/language/window/cursor | leaderboard       | Required      |
| GET    | `/v1/hosts/:hostId/settings`     | auth                        | settings          | Required      |
| PATCH  | `/v1/hosts/:hostId/settings`     | settings patch              | settings          | Required      |

Availability update request:

```json
{
  "availability": "online",
  "lastKnownLocation": {
    "latitude": 17.385,
    "longitude": 78.4867,
    "accuracyMeters": 50
  }
}
```

Host dashboard response:

```json
{
  "host": {
    "id": "host_anjali",
    "displayName": "Anjali",
    "availability": "online",
    "rank": "gold",
    "rating": 4.8,
    "verificationStatus": "verified",
    "role": "host",
    "languages": ["Telugu", "English"]
  },
  "application": {
    "id": "application_1",
    "applicantId": "host_anjali",
    "status": "verified",
    "createdAtIso": "2026-08-06T00:00:00.000Z",
    "submittedAtIso": "2026-08-06T00:05:00.000Z",
    "languages": ["Telugu", "English"]
  },
  "earnings": {
    "hostId": "host_anjali",
    "available": { "amountPaise": 35000, "currency": "INR" },
    "pending": { "amountPaise": 5000, "currency": "INR" },
    "weekToDate": { "amountPaise": 40000, "currency": "INR" },
    "lifetime": { "amountPaise": 450000, "currency": "INR" }
  }
}
```

## 15. Host Earnings, Payout Methods, Withdrawals

Routes:

- `/(host)/earnings`
- `/(host)/withdrawal`
- `/(host)/profile`
- `/(host)/bank-account-add`

Frontend behavior:

- Host earnings dashboard shows available, pending, week-to-date, lifetime.
- Withdrawal quick amounts: 50, 100, 200, 300 rupees.
- Minimum withdrawal: INR 50.
- User can withdraw through UPI or a saved bank account.
- UPI format validation: `name@bank`.
- Bank account fields: account holder name, bank name, account number, IFSC,
  primary flag.
- Host can keep up to 2 bank accounts per current copy.
- Withdrawal requests are reviewed before processing.

Backend requirements:

- Earnings ledger separate from customer wallet.
- Pending earnings and available earnings rules.
- Payout methods with tokenized sensitive bank data.
- UPI verification.
- Bank account verification or penny-drop if required.
- Withdrawal compliance review.
- Withdrawal status updates and history.
- No raw bank account numbers returned to mobile. Return only last 4.

Endpoints:

| Method | Path                                            | Request                                          | Response         | Notes                             |
| ------ | ----------------------------------------------- | ------------------------------------------------ | ---------------- | --------------------------------- |
| GET    | `/v1/hosts/:hostId/earnings`                    | auth                                             | earnings         | Existing path                     |
| GET    | `/v1/hosts/:hostId/earnings/ledger`             | cursor, filters                                  | earnings entries | Required                          |
| GET    | `/v1/hosts/:hostId/payout-methods`              | auth                                             | payout methods   | Required                          |
| POST   | `/v1/hosts/:hostId/payout-methods/upi`          | upi id                                           | payout method    | Required                          |
| POST   | `/v1/hosts/:hostId/payout-methods/bank`         | holder, bank, account number, IFSC, make primary | payout method    | Required                          |
| PATCH  | `/v1/hosts/:hostId/payout-methods/:methodId`    | primary flag, disabled flag                      | payout method    | Required                          |
| DELETE | `/v1/hosts/:hostId/payout-methods/:methodId`    | auth                                             | list             | Required                          |
| GET    | `/v1/withdrawals?hostId=:hostId`                | cursor                                           | withdrawals      | Existing path                     |
| POST   | `/withdrawals`                                  | host id, amount, payout method                   | withdrawal       | Existing path needs payout method |
| GET    | `/v1/withdrawals/:withdrawalId`                 | auth                                             | withdrawal       | Required                          |
| POST   | `/v1/admin/withdrawals/:withdrawalId/review`    | approve/hold/reject                              | withdrawal       | Admin requirement                 |
| POST   | `/v1/admin/withdrawals/:withdrawalId/mark-paid` | settlement ref                                   | withdrawal       | Admin requirement                 |

Payout method response:

```json
{
  "id": "payout_bank_1",
  "hostId": "host_anjali",
  "type": "bank",
  "holderName": "Anjali Sharma",
  "bankName": "HDFC Bank",
  "accountNumberLast4": "4821",
  "ifsc": "HDFC0004218",
  "primary": true,
  "verificationStatus": "verified",
  "createdAtIso": "2026-08-06T00:00:00.000Z"
}
```

Withdrawal request:

```json
{
  "hostId": "host_anjali",
  "amount": { "amountPaise": 10000, "currency": "INR" },
  "payoutMethodId": "payout_upi_1",
  "payoutMethodType": "upi",
  "upiId": "anjali@upi"
}
```

Withdrawal response:

```json
{
  "id": "withdrawal_1",
  "hostId": "host_anjali",
  "amount": { "amountPaise": 10000, "currency": "INR" },
  "status": "requested",
  "requestedAtIso": "2026-08-06T00:00:00.000Z",
  "payoutMethodId": "payout_upi_1",
  "expectedSettlementLabel": "UPI withdrawals usually settle after review."
}
```

## 16. Host Profile and Referrals

Routes:

- `/(host)/profile`
- `/(host)/profile-edit`
- `/(host)/referrals`

Frontend behavior:

- Host profile shows public profile, availability, rank, referrals, payout
  status, verification status.
- Host profile edit updates display name and avatar in query cache today.
- Host referrals screen currently copies a mock code and explains reward tracking.

Backend requirements:

- Host profile update endpoint.
- Host avatar upload.
- Host language and rate updates if product allows host-controlled edits.
- Referral overview for host invite programs.
- Host public profile audit/moderation.

Endpoints:

| Method | Path                                      | Request                                   | Response          | Notes                |
| ------ | ----------------------------------------- | ----------------------------------------- | ----------------- | -------------------- |
| GET    | `/v1/hosts/:hostId`                       | auth                                      | host profile      | Existing path        |
| PATCH  | `/v1/hosts/:hostId/profile`               | display name, image asset, languages, bio | host profile      | Required             |
| POST   | `/v1/hosts/:hostId/profile/photo`         | media asset id                            | host profile      | Required if separate |
| GET    | `/v1/hosts/:hostId/referrals/overview`    | auth                                      | referral overview | Required             |
| GET    | `/v1/hosts/:hostId/referrals/:referralId` | auth                                      | referral detail   | Required             |

Host profile patch:

```json
{
  "displayName": "Anjali",
  "profileImageAssetId": "asset_123",
  "languages": ["Telugu", "English"]
}
```

## 17. Admin and Operations Requirements

The mobile app needs admin/operations backend even when admin UI is limited,
because these workflows unblock host verification, reports, support, withdrawals,
referrals, refunds, and account states.

Current admin `/operations` page reads:

- Host dashboard
- Reports
- Support tickets
- Withdrawals

Required admin capabilities:

| Area              | Backend requirement                                                           |
| ----------------- | ----------------------------------------------------------------------------- |
| Host applications | List, detail, approve, reject, request changes, suspend                       |
| Host verification | Review voice, photo, identity, payout, agreement                              |
| Reports           | List, detail, assign, resolve, dismiss, escalate, apply safety action         |
| Support           | List tickets, detail, reply, close, reopen, attach internal notes             |
| Withdrawals       | Review, approve, hold, reject, mark processing, mark paid, mark failed        |
| Payments          | Search payments, inspect provider status, reconcile webhooks                  |
| Wallet ledger     | Admin read-only ledger and adjustment workflow with approvals                 |
| Referrals         | Review fraud signals, approve/hold/reject rewards                             |
| Refunds           | Approve, reject, partial refund, provider settlement                          |
| Ranking           | Review rank drivers, override or adjust with audit log                        |
| Account status    | Block, suspend, restore, delete account requests                              |
| Settings          | Pricing, ranking weights, referral rewards, withdrawal limits, legal versions |

Admin endpoints should live under `/admin/*`, require admin role, and write audit
logs for every mutation.

## Complete Endpoint Catalog

### App and Config

| Method | Path                   | Required for                                           |
| ------ | ---------------------- | ------------------------------------------------------ |
| GET    | `/v1/app/bootstrap`    | Splash, mandatory update, feature flags, public config |
| GET    | `/app/health`          | Mobile health/debug and operations                     |
| POST   | `/v1/analytics/events` | Route analytics and product telemetry                  |

### Auth

| Method | Path                        | Required for                             |
| ------ | --------------------------- | ---------------------------------------- |
| GET    | `/v1/auth/session`          | Session restore                          |
| POST   | `/v1/auth/session/refresh`  | Long-lived mobile session                |
| POST   | `/v1/auth/otp`              | Login OTP                                |
| POST   | `/v1/auth/otp/verify`       | Login verification                       |
| POST   | `/v1/auth/sign-out`         | Logout                                   |
| POST   | `/v1/auth/age-confirmation` | 18+ gate                                 |
| GET    | `/v1/accounts/me/status`    | Blocked/suspended/account status routing |

### Customer

| Method | Path                                              | Required for                         |
| ------ | ------------------------------------------------- | ------------------------------------ |
| GET    | `/v1/customers/:customerId`                       | Profile, home, referrals, wallet     |
| PATCH  | `/v1/customers/:customerId/profile`               | Profile edit and onboarding complete |
| GET    | `/v1/customers/:customerId/onboarding`            | Restore onboarding draft             |
| PATCH  | `/v1/customers/:customerId/onboarding/profile`    | Basic profile step                   |
| PATCH  | `/v1/customers/:customerId/onboarding/languages`  | Language step                        |
| PATCH  | `/v1/customers/:customerId/onboarding/match-tags` | Match tags step                      |
| POST   | `/v1/customers/:customerId/onboarding/complete`   | Finish onboarding                    |
| GET    | `/v1/onboarding/languages`                        | Language options                     |
| GET    | `/v1/onboarding/match-tags`                       | Match tag options                    |
| GET    | `/v1/onboarding/permission-requirements`          | Permission cards                     |
| POST   | `/v1/customers/:customerId/permissions`           | Permission audit                     |
| POST   | `/v1/customers/:customerId/location`              | Location consent                     |
| GET    | `/v1/customers/:customerId/blocked-hosts`         | Blocked users                        |
| POST   | `/v1/customers/:customerId/blocked-hosts`         | Block host                           |
| DELETE | `/v1/customers/:customerId/blocked-hosts/:hostId` | Unblock host                         |
| GET    | `/v1/customers/:customerId/delete-account`        | Delete account eligibility           |
| POST   | `/v1/customers/:customerId/delete-account`        | Delete account request               |

### Host and Host Application

| Method | Path                                               | Required for              |
| ------ | -------------------------------------------------- | ------------------------- |
| GET    | `/hosts`                                           | Discovery and leaderboard |
| GET    | `/v1/hosts/:hostId`                                | Host profile              |
| PATCH  | `/v1/hosts/:hostId/profile`                        | Host profile edit         |
| GET    | `/v1/hosts/:hostId/dashboard`                      | Host dashboard            |
| PATCH  | `/v1/hosts/:hostId/availability`                   | Online/offline toggle     |
| GET    | `/v1/hosts/:hostId/application`                    | Host application state    |
| POST   | `/v1/hosts/applications`                           | Host application create   |
| PATCH  | `/v1/hosts/:hostId/application/profile`            | Host onboarding profile   |
| PATCH  | `/v1/hosts/:hostId/application/photo`              | Host public photo         |
| POST   | `/v1/hosts/:hostId/application/rules/accept`       | Rule acceptance           |
| POST   | `/v1/hosts/:hostId/application/voice-verification` | Voice verification        |
| GET    | `/v1/hosts/:hostId/application/voice-verification` | Voice approval polling    |
| POST   | `/v1/hosts/:hostId/application/identity`           | Identity verification     |
| POST   | `/v1/hosts/:hostId/application/agreement`          | Host agreement            |
| POST   | `/v1/hosts/:hostId/application/submit`             | Submit application        |
| GET    | `/v1/hosts/leaderboard`                            | Host leaderboard          |
| GET    | `/v1/hosts/:hostId/recent-calls`                   | Host recent tab           |
| GET    | `/v1/hosts/:hostId/settings`                       | Host settings             |
| PATCH  | `/v1/hosts/:hostId/settings`                       | Update host settings      |

### Payout and Earnings

| Method | Path                                         | Required for                |
| ------ | -------------------------------------------- | --------------------------- |
| GET    | `/v1/hosts/:hostId/earnings`                 | Host earnings dashboard     |
| GET    | `/v1/hosts/:hostId/earnings/ledger`          | Earnings detail             |
| GET    | `/v1/hosts/:hostId/payout-methods`           | Host profile and withdrawal |
| POST   | `/v1/hosts/:hostId/payout-methods/upi`       | Add UPI                     |
| POST   | `/v1/hosts/:hostId/payout-methods/bank`      | Add bank account            |
| PATCH  | `/v1/hosts/:hostId/payout-methods/:methodId` | Make primary/update         |
| DELETE | `/v1/hosts/:hostId/payout-methods/:methodId` | Remove payout method        |
| GET    | `/v1/withdrawals?hostId=:hostId`             | Withdrawal history          |
| GET    | `/v1/withdrawals/:withdrawalId`              | Withdrawal detail           |
| POST   | `/withdrawals`                               | Request withdrawal          |

### Wallet and Payments

| Method | Path                                                | Required for                   |
| ------ | --------------------------------------------------- | ------------------------------ |
| GET    | `/v1/wallets?customerId=:customerId`                | Wallet balance                 |
| GET    | `/v1/wallets/:walletId/transactions`                | Transaction list               |
| GET    | `/v1/wallets/:walletId/transactions/:transactionId` | Transaction detail             |
| POST   | `/payments`                                         | Create payment order           |
| GET    | `/v1/payments/:paymentId`                           | Payment state polling          |
| POST   | `/v1/payments/:paymentId/checkout-opened`           | Checkout audit                 |
| POST   | `/v1/payments/:paymentId/verify`                    | Provider callback verification |
| POST   | `/v1/payments/webhooks/razorpay`                    | Provider webhook               |
| POST   | `/refunds`                                          | Refund request                 |
| GET    | `/v1/refunds?customerId=:customerId`                | Refund list                    |
| GET    | `/v1/refunds/:refundId`                             | Refund detail                  |

### Calls

| Method | Path                                      | Required for              |
| ------ | ----------------------------------------- | ------------------------- |
| POST   | `/v1/calls/intents`                       | Create call intent        |
| POST   | `/v1/calls/intents/:intentId/ring`        | Ring host                 |
| POST   | `/v1/calls/intents/:intentId/release`     | Release intent            |
| POST   | `/v1/calls/intents/:intentId/cancel`      | Customer cancel           |
| POST   | `/v1/calls/intents/:intentId/accept`      | Host accept               |
| POST   | `/v1/calls/intents/:intentId/reject`      | Host reject               |
| POST   | `/v1/calls/token`                         | RTC token                 |
| POST   | `/v1/calls/sessions`                      | Active session create     |
| POST   | `/v1/calls/sessions/:sessionId/connect`   | Session connected         |
| GET    | `/v1/calls/sessions/:sessionId`           | Session state             |
| POST   | `/v1/calls/sessions/:sessionId/telemetry` | Telemetry                 |
| POST   | `/v1/calls/sessions/:sessionId/end`       | End session               |
| POST   | `/v1/calls/:callId/complete`              | Finalize call             |
| GET    | `/v1/calls?userId=:userId`                | Call history              |
| GET    | `/v1/calls/:callId`                       | Call detail               |
| POST   | `/call-invitations`                       | Create call invitation    |
| GET    | `/call-invitations/:invitationId`         | Call invitation deep link |
| POST   | `/call-invitations/:invitationId/accept`  | Accept call invitation    |
| POST   | `/call-invitations/:invitationId/decline` | Decline call invitation   |

### Video Upgrade

| Method | Path                                                 | Required for         |
| ------ | ---------------------------------------------------- | -------------------- |
| POST   | `/v1/calls/:callId/video-upgrade`                    | Create video request |
| GET    | `/v1/calls/:callId/video-upgrade/:requestId`         | Poll request         |
| POST   | `/v1/calls/:callId/video-upgrade/:requestId/accept`  | Host accepts         |
| POST   | `/v1/calls/:callId/video-upgrade/:requestId/reject`  | Host rejects         |
| POST   | `/v1/calls/:callId/video-upgrade/:requestId/cancel`  | Customer cancels     |
| POST   | `/v1/calls/sessions/:sessionId/video/activate`       | Activate video       |
| POST   | `/v1/calls/sessions/:sessionId/video/connected`      | Confirm remote video |
| POST   | `/v1/calls/sessions/:sessionId/video/voice-fallback` | Downgrade to voice   |

### Post-Call, Reports, Support

| Method | Path                                           | Required for                     |
| ------ | ---------------------------------------------- | -------------------------------- |
| GET    | `/v1/calls/:callId/post-call`                  | Summary/detail                   |
| POST   | `/v1/calls/:callId/rating`                     | Host rating                      |
| GET    | `/reports`                                     | Admin and report history         |
| POST   | `/reports`                                     | Call/user/payment/content report |
| GET    | `/v1/support/tickets?requesterId=:requesterId` | Support list                     |
| POST   | `/v1/support/tickets`                          | Create ticket                    |
| GET    | `/v1/support/tickets/:ticketId`                | Ticket detail                    |
| POST   | `/v1/support/tickets/:ticketId/messages`       | Reply                            |
| POST   | `/v1/support/tickets/:ticketId/close`          | Close ticket                     |

### Referrals

| Method | Path                                                                 | Required for                      |
| ------ | -------------------------------------------------------------------- | --------------------------------- |
| POST   | `/v1/referrals/validate`                                             | Referral code entry               |
| POST   | `/v1/referrals/apply`                                                | Lock referral attribution         |
| GET    | `/v1/referrals?customerId=:customerId`                               | Current legacy referral list path |
| GET    | `/v1/referrals/invitations/resolve?code=:code`                       | Deep link resolution              |
| GET    | `/v1/customers/:customerId/referrals/overview?ownReferralCode=:code` | Customer referrals                |
| GET    | `/v1/customers/:customerId/referrals/:referralId`                    | Referral detail                   |
| GET    | `/v1/hosts/:hostId/referrals/overview`                               | Host referrals                    |
| GET    | `/v1/hosts/:hostId/referrals/:referralId`                            | Host referral detail              |

### Notifications and Devices

| Method | Path                                                 | Required for        |
| ------ | ---------------------------------------------------- | ------------------- |
| GET    | `/v1/notifications?recipientId=:recipientId`         | Notification feed   |
| POST   | `/v1/notifications/:notificationId/read`             | Mark read           |
| POST   | `/v1/notifications/read-all`                         | Mark all read       |
| GET    | `/v1/customers/:customerId/notification-preferences` | Preferences         |
| PUT    | `/v1/customers/:customerId/notification-preferences` | Save preferences    |
| POST   | `/v1/notifications/push-tokens`                      | Register push token |
| DELETE | `/v1/notifications/push-tokens/:tokenId`             | Remove push token   |

### Media and Legal

| Method | Path                          | Required for                                 |
| ------ | ----------------------------- | -------------------------------------------- |
| POST   | `/v1/media/upload-intents`    | Profile images, verification audio, evidence |
| POST   | `/v1/media/:assetId/complete` | Mark upload complete                         |
| GET    | `/v1/media/:assetId`          | Signed read URL or metadata                  |
| DELETE | `/v1/media/:assetId`          | Delete draft/unused media                    |
| GET    | `/legal/:documentKey`         | Terms, privacy, guidelines                   |
| POST   | `/legal/:documentKey/accept`  | Legal acceptance                             |

## Backend Data Stores

Required tables or collections:

| Store                        | Purpose                                        |
| ---------------------------- | ---------------------------------------------- |
| `users`                      | Canonical identity, phone number, role links   |
| `sessions`                   | Mobile sessions, refresh tokens, revocation    |
| `otp_requests`               | OTP code hash, attempts, expiry, rate limits   |
| `customers`                  | Customer profile and preferences               |
| `customer_onboarding_drafts` | Step-by-step onboarding persistence            |
| `hosts`                      | Host profile, availability, rank, verification |
| `host_applications`          | Host onboarding and review workflow            |
| `host_verification_assets`   | Voice, photo, ID, selfie review metadata       |
| `media_assets`               | Uploaded image/audio/evidence metadata         |
| `push_devices`               | Expo/APNs/FCM tokens and device metadata       |
| `notifications`              | Backend notification feed                      |
| `wallets`                    | Wallet account summary                         |
| `wallet_transactions`        | Append-only customer ledger                    |
| `payments`                   | Payment order and provider state               |
| `payment_events`             | Checkout callbacks and webhooks                |
| `refunds`                    | Refund requests and provider settlements       |
| `call_intents`               | Pre-call/ringing state                         |
| `call_sessions`              | Active RTC session state                       |
| `call_events`                | Join, leave, reconnect, media, billing events  |
| `video_upgrade_requests`     | In-call video request lifecycle                |
| `completed_calls`            | Final call records and pricing snapshots       |
| `call_ratings`               | One rating per connected call                  |
| `reports`                    | Safety/content/payment/user reports            |
| `support_tickets`            | Support ticket summary                         |
| `support_messages`           | Ticket conversation                            |
| `support_attachments`        | Evidence metadata                              |
| `referral_codes`             | Own codes and campaign codes                   |
| `referral_attributions`      | Signup attribution                             |
| `referral_rewards`           | Qualification and release state                |
| `host_earnings_ledger`       | Host earning credits, holds, reversals         |
| `payout_methods`             | Tokenized UPI/bank methods                     |
| `withdrawals`                | Withdrawal requests and settlement state       |
| `admin_audit_logs`           | Every admin mutation                           |
| `feature_flags`              | Runtime and rollout controls                   |
| `legal_documents`            | Versioned legal documents                      |
| `legal_acceptances`          | User acceptance records                        |

## Security and Compliance

Backend-only secrets:

- OTP provider secrets.
- Razorpay secret and webhook secret.
- Agora app certificate and token signing.
- Database credentials.
- Private analytics tokens.
- Push notification server keys.
- Bank/payout provider credentials.

Mobile-safe public values:

- `EXPO_PUBLIC_CONNECTO_API_BASE_URL`
- `EXPO_PUBLIC_CONNECTO_AGORA_APP_ID`
- `EXPO_PUBLIC_CONNECTO_RAZORPAY_KEY_ID`
- `EXPO_PUBLIC_CONNECTO_SENTRY_DSN`
- `EXPO_PUBLIC_CONNECTO_DEEP_LINK_HOST`

Security requirements:

- Hash OTP codes, never store raw OTP.
- Encrypt or tokenize bank account numbers and payout identifiers.
- Do not return full bank account numbers to mobile.
- Signed media URLs must expire.
- Validate all wallet, call, payment, and withdrawal actions server-side.
- Rate limit OTP, payment verification, support creation, report submission,
  call ringing, and video upgrade requests.
- Audit all admin actions and all money-state transitions.
- Keep payment verification and wallet credit in one idempotent backend
  transaction.
- Keep call finalization, wallet debit, and host earnings credit in one
  idempotent backend transaction.
- Do not trust client timers for final billing. Use server call events and RTC
  provider signals where possible.

## Production Readiness Checklist

- `CONNECTO_PROVIDER=production` returns valid schema-compatible JSON for every
  endpoint above.
- The short existing contract in `docs/backend-api-contract.md` remains valid,
  with this document as the expanded production contract.
- Mobile can start with no local mock adapters for auth, onboarding, payment,
  calls, post-call, referrals, account, host payout, and support.
- Push notifications work for incoming calls, support replies, wallet updates,
  referral changes, host application updates, and withdrawal changes.
- Realtime works for active call and host incoming call flows.
- All money mutations are idempotent and ledger-backed.
- All media upload paths use signed URLs and completion callbacks.
- Admin can review host applications, reports, support tickets, withdrawals,
  refunds, and referral fraud holds.
- Mobile handles offline, timeout, validation, unauthorized, account locked, and
  server errors with the shared error envelope.
