# Release Instructions

Date: 2026-07-15

## Local Setup

```sh
pnpm install
```

Use environment files that follow the committed naming convention:

```sh
CONNECTO_PROVIDER=mock
NEXT_PUBLIC_CONNECTO_PROVIDER=mock
EXPO_PUBLIC_CONNECTO_PROVIDER=mock
```

Do not commit real secrets.

## Development

Admin:

```sh
pnpm dev:admin
```

Mobile development build:

```sh
pnpm dev:mobile
```

Native mobile runs:

```sh
pnpm --filter @connecto/mobile dev:android
pnpm --filter @connecto/mobile dev:ios
```

Windows can run Android and web checks. iOS native builds require macOS or EAS.

## Verification

```sh
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm doctor:expo
```

Independent workspace checks:

```sh
pnpm --filter @connecto/admin build
pnpm --filter @connecto/mobile build
pnpm --filter @connecto/domain test
```

## Review Routes

Admin health route:

```sh
pnpm dev:admin
```

Open `http://localhost:3000`.

Mobile health route:

```sh
pnpm dev:mobile
```

Open the Expo development client or the web target shown by Expo.

## External Prerequisites Not Built In This Stage

- OTP issuing and verification service.
- Payment verification service.
- Wallet ledger and refund APIs.
- Agora or equivalent call-token service.
- Notifications.
- Admin APIs for hosts, payments, refunds, reports, and settings.
- Real production environment variables and secret management.
- Platform store destinations for `EXPO_PUBLIC_CONNECTO_ANDROID_UPDATE_URL` and `EXPO_PUBLIC_CONNECTO_IOS_UPDATE_URL` once release metadata is issued.
