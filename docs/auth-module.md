# Authentication module

The shipped mobile app is `apps/mobile/src/samvad-app`. Authentication uses the
native Firebase Phone Auth SDK only for SMS delivery and OTP confirmation. Every
business decision after that is owned by the Samvad API.

## Sign-in sequence

1. The app validates and normalizes a 10-digit Indian phone number.
2. `POST /auth/otp/send` reserves an OTP send. Redis enforces a 30-second
   cooldown and permits one initial send plus three resends per 15-minute window.
3. Firebase sends and confirms the SMS OTP in the native app.
4. The app sends the Firebase ID token, installation fingerprint, device name,
   platform, and any already-authorized native push token to
   `POST /auth/otp/verify`.
5. The API verifies the Firebase token and phone-number binding, checks account
   state, creates or updates the user, creates a device-aware server session,
   and returns rotating access and refresh tokens.
6. New users enter their date of birth on a dedicated 18+ screen. The API
   calculates age again and stores DOB in the role profile.

## Session and device lifecycle

- Access tokens are short lived. A 401 triggers one refresh-token rotation and
  one retry. Refresh-token replay fails because only a SHA-256 hash of the latest
  token is stored per session.
- `GET /auth/sessions` lists active devices and identifies the current session.
- `DELETE /auth/sessions/:sessionId` revokes a selected session.
- `POST /auth/logout` revokes the current session.
- `POST /auth/logout-all` revokes every session and notification token.
- `POST /auth/device-token` and `DELETE /auth/device-token` manage the native
  notification token for the authenticated device.

## Account state and deletion

Suspended, banned, deletion-pending, expired-session, OTP-limit, age, role, and
profile errors return stable `code`, `message`, and relevant metadata such as
`retryAfterSeconds` or `accountState`. The mobile router sends unavailable
accounts to the account-status screen.

`DELETE /auth/me` requires the literal confirmation `DELETE`. Refundable caller
cash or unsettled Host earnings block deletion. An accepted request revokes all
sessions immediately and schedules deletion after the configured grace period.
An hourly job removes role profiles and Host KYC/application data, clears device
data, and anonymizes the phone identity while retaining pseudonymous financial
records needed for reconciliation.

## Deployment controls

`GET /auth/app-config` supplies maintenance state, minimum supported version,
and platform store URL. The app checks it before restoring or starting a session
and fails closed to a retry, maintenance, or mandatory-update screen.

The required deployment variables and safe placeholders are documented in
`backend/samvad-api/.env.example`.

## Intentionally outside this module

- Firebase project credentials and native configuration files are not committed.
- Legal-document version acceptance belongs to the later legal/onboarding
  screens and is not part of authentication.
