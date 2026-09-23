# Runtime Configuration

Connecto validates frontend runtime configuration with Zod through `@connecto/domain`.

## Profiles

Frontend public profiles remain `development`, `preview`, and `production`
through `@connecto/domain`.

Backend private profiles are fail-fast and use:

- `local`: Docker/local development. Fake providers and Azurite are allowed.
- `test`: deterministic test profile. Fake providers are allowed.
- `preview`: review profile. Fake or sandbox providers are allowed.
- `staging`: pre-production profile. Fake provider modes are rejected.
- `production`: release profile. Every provider mode must be `live`, origins and
  public URLs must use HTTPS, issuer/audience values must be real, and required
  server-only secrets or secret references must exist.

## Mobile Public Variables

- `EXPO_PUBLIC_CONNECTO_ENV`
- `EXPO_PUBLIC_CONNECTO_MOCK_MODE`
- `EXPO_PUBLIC_CONNECTO_PROVIDER`
- `EXPO_PUBLIC_CONNECTO_API_BASE_URL`
- `EXPO_PUBLIC_CONNECTO_AGORA_APP_ID`
- `EXPO_PUBLIC_CONNECTO_RAZORPAY_KEY_ID`
- `EXPO_PUBLIC_CONNECTO_SENTRY_DSN`
- `EXPO_PUBLIC_CONNECTO_DEEP_LINK_HOST`
- `EXPO_PUBLIC_CONNECTO_ANDROID_UPDATE_URL`
- `EXPO_PUBLIC_CONNECTO_IOS_UPDATE_URL`
- `EXPO_PUBLIC_CONNECTO_ENABLE_RIVE`
- `EXPO_PUBLIC_CONNECTO_ENABLE_SKIA_HEAVY_VISUALS`
- `EXPO_PUBLIC_CONNECTO_ENABLE_VIDEO_UPGRADE`
- `EXPO_PUBLIC_CONNECTO_ENABLE_REFERRALS`
- `EXPO_PUBLIC_CONNECTO_ENABLE_ANALYTICS`
- `EXPO_PUBLIC_CONNECTO_ONBOARDING_PROVIDER`
- `EXPO_PUBLIC_CONNECTO_ONBOARDING_PROFILE_MODE`
- `EXPO_PUBLIC_CONNECTO_ONBOARDING_LANGUAGE_MODE`
- `EXPO_PUBLIC_CONNECTO_ONBOARDING_MEDIA_MODE`
- `EXPO_PUBLIC_CONNECTO_ONBOARDING_PERMISSION_MODE`
- `EXPO_PUBLIC_CONNECTO_ONBOARDING_NOTIFICATION_OUTCOME`
- `EXPO_PUBLIC_CONNECTO_CALL_PROVIDER`
- `EXPO_PUBLIC_CONNECTO_CALL_CAMERA_PERMISSION`
- `EXPO_PUBLIC_CONNECTO_CALL_CAMERA_REQUEST_OUTCOME`
- `EXPO_PUBLIC_CONNECTO_CALL_MIC_PERMISSION`
- `EXPO_PUBLIC_CONNECTO_CALL_MIC_REQUEST_OUTCOME`
- `EXPO_PUBLIC_CONNECTO_CALL_RING_OUTCOME`
- `EXPO_PUBLIC_CONNECTO_CALL_RING_DELAY_MS`
- `EXPO_PUBLIC_CONNECTO_CALL_RING_TIMEOUT_MS`
- `EXPO_PUBLIC_CONNECTO_CALL_VIDEO_CONNECT_OUTCOME`
- `EXPO_PUBLIC_CONNECTO_CALL_VIDEO_CONNECT_DELAY_MS`
- `EXPO_PUBLIC_CONNECTO_CALL_VIDEO_COUNTDOWN_MS`
- `EXPO_PUBLIC_CONNECTO_CALL_VIDEO_REJECT_COOLDOWN_MS`
- `EXPO_PUBLIC_CONNECTO_CALL_VIDEO_REQUEST_OUTCOME`
- `EXPO_PUBLIC_CONNECTO_CALL_VIDEO_REQUEST_DELAY_MS`
- `EXPO_PUBLIC_CONNECTO_CALL_VIDEO_REQUEST_TIMEOUT_MS`
- `EXPO_PUBLIC_CONNECTO_PAYMENT_PROVIDER`

## Admin Public Variables

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

## Backend Private Variables

These live in `backend/apps/api/.env.example` and `backend/apps/worker/.env.example`. They must
never be exposed to frontend builds.

- `CONNECTO_ENV`
- `BACKEND_LOG_LEVEL`
- `API_HOST`
- `API_PORT`
- `API_PUBLIC_BASE_URL`
- `ADMIN_PUBLIC_BASE_URL`
- `MOBILE_DEEP_LINK_HOST`
- `ALLOWED_ORIGINS`
- `DATABASE_URL`
- `REDIS_URL`
- `REDIS_KEY_PREFIX`
- `REDIS_SERIALIZATION_VERSION`
- `REDIS_IDEMPOTENCY_TTL_SECONDS`
- `REDIS_HOST_PRESENCE_TTL_SECONDS`
- `REDIS_CALL_SIGNALING_TTL_SECONDS`
- `REDIS_OTP_THROTTLE_WINDOW_SECONDS`
- `REDIS_RATE_LIMIT_WINDOW_SECONDS`
- `REDIS_CACHE_MAX_STALENESS_SECONDS`
- `REDIS_LOCK_TTL_SECONDS`
- `READINESS_TIMEOUT_MS`
- `SHUTDOWN_GRACE_MS`
- `JWT_ISSUER`
- `JWT_AUDIENCE`
- `SECRET_STORE_PROVIDER`
- `AZURE_KEY_VAULT_URL`
- `OTP_PROVIDER`
- `OTP_PROVIDER_MODE`
- `RTC_PROVIDER`
- `RTC_PROVIDER_MODE`
- `PAYMENTS_PROVIDER`
- `PAYMENTS_PROVIDER_MODE`
- `PAYOUT_PROVIDER`
- `PAYOUT_PROVIDER_MODE`
- `OBJECT_STORAGE_PROVIDER`
- `OBJECT_STORAGE_PROVIDER_MODE`
- `OBJECT_STORAGE_ENDPOINT`
- `OBJECT_STORAGE_CONTAINER`
- `MODERATION_PROVIDER`
- `MODERATION_PROVIDER_MODE`
- `MODERATION_PROVIDER_SECRET`
- `MODERATION_PROVIDER_SECRET_REF`
- `TAGGING_PROVIDER`
- `TAGGING_PROVIDER_MODE`
- `TAGGING_PROVIDER_SECRET`
- `TAGGING_PROVIDER_SECRET_REF`
- `NOTIFICATION_PROVIDER`
- `NOTIFICATION_PROVIDER_MODE`
- `FEATURE_VIDEO_UPGRADE_ENABLED`
- `FEATURE_AUDIO_STATUS_ENABLED`
- `FEATURE_MIND_MATCHING_ENABLED`
- `FEATURE_REFERRALS_ENABLED`
- `FEATURE_WITHDRAWALS_ENABLED`
- `FEATURE_AUTOMATIC_REFUNDS_ENABLED`
- `FEATURE_AUTOMATED_MODERATION_ENABLED`
- `FEATURE_HOST_AUTO_APPROVAL_ENABLED`
- `APP_BOOTSTRAP_CACHE_VERSION`
- `APP_BOOTSTRAP_MAX_AGE_SECONDS`
- `ANDROID_MIN_BUILD`
- `ANDROID_BLOCKED_BUILDS`
- `ANDROID_STORE_URL`
- `IOS_MIN_BUILD`
- `IOS_BLOCKED_BUILDS`
- `IOS_STORE_URL`
- `WEB_MIN_BUILD`
- `WEB_BLOCKED_BUILDS`
- `WEB_STORE_URL`
- `MAINTENANCE_ENABLED`
- `MAINTENANCE_MESSAGE`
- `LEGAL_TERMS_VERSION`
- `LEGAL_PRIVACY_VERSION`
- `LEGAL_COMMUNITY_GUIDELINES_VERSION`
- `SUPPORTED_LANGUAGE_CODES`
- `SOCKET_IO_NAMESPACE`
- `OUTBOX_BATCH_SIZE`
- `WORKER_HEALTH_HOST`
- `WORKER_HEALTH_PORT`
- `WORKER_POLL_INTERVAL_MS`

## Secrets That Must Never Enter Frontend Env

- Razorpay secret keys and webhook secrets.
- Agora app certificates, token signing keys, or generated RTC tokens.
- OTP provider credentials.
- Payout provider credentials.
- Moderation and tagging provider credentials.
- FCM service identity and private keys.
- Storage account keys and object-storage credentials.
- Database URLs, service-role keys, encryption keys, and private API tokens.
- JWT signing keys, session encryption secrets, and Sentry auth tokens.

Production builds fail before release when required public values are missing or left as placeholders. Mock mode stays available for frontend-only flows without network access.

## Backend Provider Modes

Backend provider selection is centralized in `@connecto/backend-architecture`
and consumed by `@connecto/backend-runtime`. Local development uses
configuration-driven fakes instead of scattered conditionals.

| Boundary       | Local values                                            | Production rule               |
| -------------- | ------------------------------------------------------- | ----------------------------- |
| OTP            | `OTP_PROVIDER=fake`, `OTP_PROVIDER_MODE=fake`           | provider mode must be `live`  |
| RTC            | `RTC_PROVIDER=fake`, `RTC_PROVIDER_MODE=fake`           | provider mode must be `live`  |
| Payments       | `PAYMENTS_PROVIDER=fake`, `PAYMENTS_PROVIDER_MODE=fake` | provider mode must be `live`  |
| Payout         | `PAYOUT_PROVIDER=fake`, `PAYOUT_PROVIDER_MODE=fake`     | provider mode must be `live`  |
| Object storage | `OBJECT_STORAGE_PROVIDER=azurite`, mode `fake`          | fake and Azurite are rejected |
| Moderation     | `MODERATION_PROVIDER=fake`, mode `fake`                 | provider mode must be `live`  |
| Tagging        | `TAGGING_PROVIDER=fake`, mode `fake`                    | provider mode must be `live`  |
| Notification   | `NOTIFICATION_PROVIDER=fake`, mode `fake`               | provider mode must be `live`  |

Supported modes are `fake`, `sandbox`, and `live`. Staging rejects fake modes.
Production rejects fake and sandbox modes.

For local env-backed non-fake provider tests, server-only secrets are JSON
payloads resolved by `@connecto/backend-runtime`:

- `OTP_PROVIDER_SECRET`: MSG91 `{ "authKey": "...", "templateId": "..." }`
  or Twilio `{ "accountSid": "...", "authToken": "...", "serviceSid": "..." }`.
- `AGORA_APP_CERTIFICATE`: `{ "appId": "...", "appCertificate": "..." }` or
  `{ "tokenEndpoint": "https://..." }`.
- `RAZORPAY_KEY_SECRET`: `{ "keyId": "...", "keySecret": "..." }`.
- `PAYOUT_CLIENT_SECRET`: Cashfree client/beneficiary JSON or RazorpayX
  key/fund-account JSON.
- `OBJECT_STORAGE_ACCESS_KEY`: Azure Blob account key JSON or delegated S3
  presign endpoint credentials.
- `MODERATION_PROVIDER_SECRET`: OpenAI moderation `{ "apiKey": "..." }`.
- `TAGGING_PROVIDER_SECRET`: internal tagger `{ "endpoint": "...", "apiKey": "..." }`.

## Backend Feature Flags

The backend owns these flags and exposes their safe projection through
`GET /v1/app/bootstrap`:

- `videoUpgrade`
- `audioStatus`
- `mindMatching`
- `referrals`
- `withdrawals`
- `automaticRefunds`
- `automatedModeration`
- `hostAutoApproval`

Feature changes must be written to `configuration_change_audit`; production
boot fails if `hostAutoApproval` is enabled because that violates a locked
product rule.

## Secret Store Boundary

`SECRET_STORE_PROVIDER=env` resolves secrets from process env only when a
provider adapter explicitly asks for the secret reference. Parsed runtime config
contains secret references, never plaintext secret values.

`SECRET_STORE_PROVIDER=azure-key-vault` uses `AZURE_KEY_VAULT_URL` plus
`*_SECRET_REF` names such as `JWT_SIGNING_KEY_SECRET_REF`. Secret versions are
optional via `*_SECRET_REF_VERSION`, so rotation can move a ref to a new
version without logging or serializing the secret.

The API and worker both expose `/livez`, `/readyz`, and `/healthz`. Readiness
checks PostgreSQL, Redis, and configured providers; liveness checks only the
current process.

## Update Destinations

- `EXPO_PUBLIC_CONNECTO_ANDROID_UPDATE_URL` should point to the Play Store listing or approved Android release landing page.
- `EXPO_PUBLIC_CONNECTO_IOS_UPDATE_URL` should point to the App Store listing or approved iOS release landing page.
- Leave both empty in local mock mode. The mandatory-update screen disables its primary action when no destination is configured for the current platform.

## Customer Onboarding Simulation

- `EXPO_PUBLIC_CONNECTO_ONBOARDING_PROVIDER=mock` keeps the onboarding flow frontend-only.
- `EXPO_PUBLIC_CONNECTO_ONBOARDING_PROVIDER=staging` or `production` enables the native image-picker crop flow and native notification permission bridge while still using the shared frontend service contract for profile persistence.
- `EXPO_PUBLIC_CONNECTO_ONBOARDING_PROFILE_MODE` accepts `success`, `offline`, or `failure`.
- `EXPO_PUBLIC_CONNECTO_ONBOARDING_LANGUAGE_MODE` accepts `success`, `empty`, `offline`, or `failure`.
- `EXPO_PUBLIC_CONNECTO_ONBOARDING_MEDIA_MODE` accepts `success`, `offline`, or `failure`.
- `EXPO_PUBLIC_CONNECTO_ONBOARDING_PERMISSION_MODE` accepts `success`, `empty`, `offline`, or `failure`.
- `EXPO_PUBLIC_CONNECTO_ONBOARDING_NOTIFICATION_OUTCOME` accepts `granted` or `not-now` for the mock notification prompt.

## Pre-Connect Call Simulation

- `EXPO_PUBLIC_CONNECTO_CALL_PROVIDER=mock` keeps microphone checks, call intent creation, media-resource preparation, host ringing, and active-call session startup frontend-only.
- `EXPO_PUBLIC_CONNECTO_CALL_PROVIDER=staging` or `production` uses the Expo Audio microphone/audio-session bridge, API-backed `/v1/calls/intents`, `/v1/calls/intents/:intentId/ring`, `/v1/calls/intents/:intentId/release`, and the shared `/v1/calls/token` Agora-token contract.
- Staging and production require `EXPO_PUBLIC_CONNECTO_API_BASE_URL` and `EXPO_PUBLIC_CONNECTO_AGORA_APP_ID`; Agora certificates, generated RTC tokens, and call-signing secrets stay backend-only.
- `EXPO_PUBLIC_CONNECTO_CALL_CAMERA_PERMISSION` accepts `granted`, `prompt`, or `denied` for the current video-upgrade camera permission state.
- `EXPO_PUBLIC_CONNECTO_CALL_CAMERA_REQUEST_OUTCOME` accepts `granted` or `denied` after the host accepts the upgrade and the frontend requests camera access.
- `EXPO_PUBLIC_CONNECTO_CALL_MIC_PERMISSION` accepts `granted`, `prompt`, or `denied` for the current system-permission state.
- `EXPO_PUBLIC_CONNECTO_CALL_MIC_REQUEST_OUTCOME` accepts `granted` or `denied` after the contextual microphone explanation.
- `EXPO_PUBLIC_CONNECTO_CALL_RING_OUTCOME` accepts `accepted`, `busy`, `rejected`, `no-answer`, `failed`, or `timeout`.
- `EXPO_PUBLIC_CONNECTO_CALL_RING_DELAY_MS` and `EXPO_PUBLIC_CONNECTO_CALL_RING_TIMEOUT_MS` control deterministic mock ringing and timeout timing.
- `EXPO_PUBLIC_CONNECTO_CALL_VIDEO_CONNECT_OUTCOME` accepts `connected` or `failed` after the countdown hands off to the active call adapter.
- `EXPO_PUBLIC_CONNECTO_CALL_VIDEO_CONNECT_DELAY_MS` controls deterministic mock remote-video connection timing after host acceptance and camera permission.
- `EXPO_PUBLIC_CONNECTO_CALL_VIDEO_COUNTDOWN_MS` controls the skippable `3-2-1` transition duration before remote video connection begins.
- `EXPO_PUBLIC_CONNECTO_CALL_VIDEO_REJECT_COOLDOWN_MS` controls the host-rejection cooldown before the customer can request video again.
- `EXPO_PUBLIC_CONNECTO_CALL_VIDEO_REQUEST_OUTCOME` accepts `accepted`, `rejected`, `failed`, `pending`, or `timeout`.
- `EXPO_PUBLIC_CONNECTO_CALL_VIDEO_REQUEST_DELAY_MS` and `EXPO_PUBLIC_CONNECTO_CALL_VIDEO_REQUEST_TIMEOUT_MS` control deterministic mock video-request timing.
- Staging and production active-call screens reuse the accepted `/v1/calls/token` session contract, expect typed backend video-upgrade endpoints at `/v1/calls/:callId/video-upgrade` and `/v1/calls/:callId/video-upgrade/:requestId`, and can attach a native `ConnectoActiveCallBridge` for live audio-level, camera, mute, speaker, and session-upgrade control.
- The video-upgrade flow also supports a typed `/v1/calls/:callId/video-upgrade/:requestId/cancel` contract and a native `waitForRemoteVideoConnected` bridge so billing can remain on voice pricing until remote video is truly connected.
- When the native active-call bridge is not installed, the frontend still uses the real audio-session and network-quality path, but live microphone amplitude and remote-video session signaling remain limited until the native module is present.

## Payment Simulation

- `EXPO_PUBLIC_CONNECTO_PAYMENT_PROVIDER=mock` keeps checkout, callbacks, and verification frontend-only.
- `EXPO_PUBLIC_CONNECTO_PAYMENT_PROVIDER=staging` or `production` expects a native payment SDK bridge and backend verification service behind the same typed adapter.
- Developer scenarios drive `success`, `failure`, `pending`, `user-cancelled`, `timeout`, and `duplicate-callback` outcomes.
