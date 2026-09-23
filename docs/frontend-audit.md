# Frontend Audit

Date: 2026-07-15

Status: Historical audit from the pre-monorepo stage. The current workspace structure is documented in `docs/architecture.md` and package versions are documented in `docs/dependency-matrix.md`.

## Scope And Sources

This audit inspected the current repository at `C:\Users\heman\Desktop\host-a-call`.

Local sources reviewed:

- `Voice-First Paid Calling App.pdf`, 84 pages, treated as the approved product and wireframe source because it is the newest artifact and defines the six-module admin scope.
- `Voice-First Paid Calling App MVP Requirements.docx`, treated as product requirements context.
- `Voice + Video Calling App.docx`, treated as older wireframe context because it conflicts with the PDF by including direct video calling and a broader admin panel.
- `connecto/src`, the currently generated frontend skeleton.

No Figma file, Figma export, image assets, app package manifest, tests, lint rules, TypeScript config, Expo config, build config, or lockfile exists in the repository.

## Repository State

The repository is not a Git repository, has no package manager manifest, and is not currently a monorepo. It is a loose workspace containing requirement documents plus a `connecto` folder.

Current structure:

```text
host-a-call/
  Voice + Video Calling App.docx
  Voice-First Paid Calling App MVP Requirements.docx
  Voice-First Paid Calling App.pdf
  connecto/
    src/
      app/
      assets/
      components/
      features/
      services/
      store/
      theme/
      types/
  docs/
```

`connecto/src` contains empty route, store, and theme files. Every `.tsx` and `.ts` file found is zero bytes. There is no working screen implementation to migrate or preserve yet, but the empty route stubs should not be deleted until the app scaffold is created.

## Dependency Inventory

Runtime inventory:

| Area            | Current state                                                 | Notes                                                                                                             |
| --------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Package manager | No `package.json`, `pnpm-lock.yaml`, or `pnpm-workspace.yaml` | `pnpm` is available in the workspace runtime as `11.7.0`.                                                         |
| Node            | No project version pinned                                     | Workspace runtime reports Node `v24.14.0`; the project should pin an Expo-compatible LTS runtime when scaffolded. |
| Expo            | Not installed                                                 | No `app.json`, `app.config.ts`, Metro config, or Expo Router dependency.                                          |
| TypeScript      | Not configured                                                | No `tsconfig.json`; strict mode and absolute imports are not yet enforceable.                                     |
| Lint/format     | Not configured                                                | No ESLint, Prettier, or scripts.                                                                                  |
| Tests           | Not configured                                                | No unit, component, integration, or E2E test setup.                                                               |
| Assets          | Empty directories only                                        | `assets/lottie`, `assets/rive`, `assets/icons`, and `assets/images` exist but contain no files.                   |
| Native modules  | Not installed                                                 | Calling, camera, microphone, notifications, Lottie/Rive, and payment SDK adapters are not present.                |

No package versions were added in this stage, so `docs/dependency-matrix.md` is not required yet.

## Current Route Files

These files exist, but all are empty and therefore incomplete.

| Current route file                           | Intended area                   | Status     |
| -------------------------------------------- | ------------------------------- | ---------- |
| `connecto/src/app/_layout.tsx`               | Mobile root layout              | Empty stub |
| `connecto/src/app/index.tsx`                 | Launch / router entry           | Empty stub |
| `connecto/src/app/auth/age-confirmation.tsx` | Auth                            | Empty stub |
| `connecto/src/app/auth/login.tsx`            | Auth                            | Empty stub |
| `connecto/src/app/auth/otp.tsx`              | Auth                            | Empty stub |
| `connecto/src/app/auth/referral-code.tsx`    | Auth / referral sheet           | Empty stub |
| `connecto/src/app/customer/_layout.tsx`      | Customer tabs/layout            | Empty stub |
| `connecto/src/app/customer/home.tsx`         | Customer home                   | Empty stub |
| `connecto/src/app/customer/calls.tsx`        | Customer call history           | Empty stub |
| `connecto/src/app/customer/wallet.tsx`       | Customer wallet                 | Empty stub |
| `connecto/src/app/customer/referrals.tsx`    | Customer referrals              | Empty stub |
| `connecto/src/app/customer/profile.tsx`      | Customer profile                | Empty stub |
| `connecto/src/app/host/_layout.tsx`          | Host tabs/layout                | Empty stub |
| `connecto/src/app/host/dashboard.tsx`        | Host dashboard                  | Empty stub |
| `connecto/src/app/host/calls.tsx`            | Host call history               | Empty stub |
| `connecto/src/app/host/earnings.tsx`         | Host earnings                   | Empty stub |
| `connecto/src/app/host/leaderboard.tsx`      | Host leaderboard                | Empty stub |
| `connecto/src/app/host/profile.tsx`          | Host profile                    | Empty stub |
| `connecto/src/app/call/outgoing.tsx`         | Customer outgoing call          | Empty stub |
| `connecto/src/app/call/voice.tsx`            | Active voice call               | Empty stub |
| `connecto/src/app/call/video-request.tsx`    | Video upgrade request           | Empty stub |
| `connecto/src/app/call/video.tsx`            | Active video call after upgrade | Empty stub |
| `connecto/src/app/call/reconnecting.tsx`     | Call reconnecting               | Empty stub |
| `connecto/src/app/call/summary.tsx`          | Call summary                    | Empty stub |

Route-group note: the requested scaffold used Expo Router route groups `(auth)`, `(customer)`, and `(host)`, but the current folders are named `auth`, `customer`, and `host`. This is safe to keep for now because the files are empty, but it must be corrected during the Expo Router scaffold if those segments should not appear in URLs.

## Approved Screen Coverage

The approved PDF defines:

| Role            | Approved screens |                Current route coverage | Missing or unrouted |
| --------------- | ---------------: | ------------------------------------: | ------------------: |
| Customer mobile |               51 |                 11 stub route matches |                  40 |
| Host mobile     |               37 | 9 direct or shared stub route matches |                  28 |
| Admin website   |               31 |                                     0 |                  31 |

Existing route coverage is only nominal because every route file is empty. No screen is production-ready.

Customer route gaps include suspended account, profile onboarding, language selection, permissions, all wallet payment subflows, transaction history, referral history/rules/share, low-balance handling, host busy/rejected/not-answered outcomes, permissions, active call states, in-call reporting, rating, call details, support tickets, and edit/delete profile flows.

Host route gaps include onboarding, identity verification, bank/UPI setup, agreement, application status, online confirmation, rank detail/rules/increase/decrease states, incoming-call states, video upgrade states, earnings details, withdrawal states, referral states, call details, and verification details.

Admin route gaps include the full six-module website: dashboard, hosts, payments, refunds, reports, and settings.

Admin module coverage:

| Admin module | Approved screens                                                                               | Current coverage | Status  |
| ------------ | ---------------------------------------------------------------------------------------------- | ---------------- | ------- |
| Dashboard    | A03 Dashboard Overview                                                                         | none             | Missing |
| Hosts        | A04-A12 Host List, applications, details, rank, leaderboard, earnings/withdrawals, referrals   | none             | Missing |
| Payments     | A13-A16 Payments Overview, Payment Details, Host Payout Details, Referral Reward Payments      | none             | Missing |
| Refunds      | A17-A19 Refund List, Refund Details, Partial Refund Modal                                      | none             | Missing |
| Reports      | A20-A23 Reports List, Report Details, Referral Fraud Report, Ranking Abuse Review              | none             | Missing |
| Settings     | A24-A31 Settings Home, call, pricing, ranking, referral, withdrawal, language, safety settings | none             | Missing |

## Retain Versus Migrate

Retain:

- The product documents as source artifacts.
- The `connecto/src` top-level intent: app routes, feature folders, services, stores, theme, assets, and shared types.
- The current empty stubs as route placeholders until the real app scaffold lands.

Migrate or correct:

- Convert the repository into a pnpm workspace before implementation begins.
- Move or reinterpret `connecto` as the mobile app workspace, likely `apps/mobile`, unless the project name must remain `connecto`.
- Add a separate admin website workspace, likely `apps/admin`.
- Move cross-platform tokens, domain types, fixtures, and mock adapters into shared packages.
- Replace current non-group route folders with Expo Router route groups if URL paths should hide auth/customer/host group names.
- Remove or repurpose direct-video-oriented stubs only after confirming the newer PDF remains the approved source. The current `video.tsx` route can still represent active video after a voice-to-video upgrade.

## UI Pattern Findings

Implemented UI patterns cannot be evaluated because no components are implemented.

Risks to prevent in the first implementation stages:

- Customer and host mobile flows should share primitives for buttons, cards, forms, feedback, call controls, safe-area layouts, and bottom navigation.
- Admin should not reuse mobile card-heavy layouts; it needs dense desktop tables, filters, detail drawers/pages, and audit-friendly actions.
- Call states must use one shared call-state model so customer and host screens do not drift.
- Wallet, earnings, refunds, and referral reward states should share money formatting and status treatment.
- Empty/loading/error/offline states should be componentized early because they appear across nearly every async screen.

## Native Module And Development-Build Requirements

The frontend can mock external systems in this stage sequence, but the app cannot be fully validated in Expo Go once native calling features are introduced.

Likely development-build requirements:

- Microphone and camera permissions.
- Real-time voice/video SDK adapter, represented initially by typed interfaces and deterministic mock adapters.
- Notifications for incoming calls, wallet updates, support, and host status changes.
- Audio session handling, speaker/mute controls, camera switching, and reconnecting state.
- Lottie or Rive only if final assets require native playback.
- Payment SDK adapter only as a frontend interface; no payment verification server in this frontend-only scope.
- Environment-based provider switch for `mock`, `staging`, and future real providers.

External backend prerequisites:

- OTP issuing and verification service.
- Account/session service.
- User, host, and admin APIs.
- Wallet ledger and payment verification service.
- Call token service for the chosen real-time SDK.
- Pricing, ranking, commission, referral, withdrawal, refund, reports, settings, and audit-log APIs.
- Notification service.
- Content moderation, report handling, and safety action APIs.

## Platform Risks

Windows:

- Expo native prebuilds and iOS builds cannot be completed locally on Windows.
- Parentheses in Expo Router group folder names require careful quoting in shell commands.
- Native SDK setup and Android emulator paths are common friction points.

Android:

- Runtime microphone, camera, notification, and background behavior must be tested on real devices.
- Incoming call UX may require native notification/channel handling outside Expo Go.
- Audio focus, Bluetooth, speaker routing, and reconnecting behavior need device tests.

iOS:

- Requires macOS or EAS cloud builds for native build verification.
- Camera/microphone privacy strings and CallKit-like expectations need early validation.
- Background call and notification behavior must be validated outside Expo Go.

Web:

- Admin should be a separate web app rather than Expo mobile screens stretched onto desktop.
- Payment, report, and table-heavy admin workflows need keyboard focus, responsive table strategies, and browser QA.
- WebRTC/camera browser permission behavior should not be conflated with native mobile calling.

## Frontend Build Plan: Prompts 2-52

Prompt 1 is this audit stage. The remaining prompts should be implemented in this order.

| Prompts | Phase                           | Output                                                                                                                          |
| ------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 2-4     | Workspace foundation            | pnpm monorepo, strict TypeScript, absolute imports, dependency matrix, scripts, lint, format, test, Expo doctor baseline.       |
| 5-7     | Shared frontend contracts       | Domain types, typed mock adapters, deterministic fixtures, provider switches, money/date/status utilities.                      |
| 8-10    | Design system foundation        | Shared tokens, mobile primitives, admin primitives, accessibility states, reduced-motion handling.                              |
| 11-14   | Mobile app shell                | Expo Router layouts, safe-area navigation, auth guards, offline shell, startup configuration and mandatory update states.       |
| 15-18   | Customer auth and onboarding    | Age confirmation, login, referral entry, OTP, suspended account, profile, language, permission screens.                         |
| 19-23   | Customer home and discovery     | Ranked host list, language fallback, filters, no-host/loading/error/offline states, host card actions.                          |
| 24-28   | Customer wallet and referrals   | Wallet overview, add money mock flow, transaction history, referral share/history/rules, low-balance paths.                     |
| 29-34   | Customer call flow              | Outgoing call, busy/rejected/not answered, permissions, active voice, video unlock/request/reject/switch, reconnecting, report. |
| 35-37   | Customer post-call and support  | Call summary, rating, call history/details, support ticket list/details, profile/edit/delete.                                   |
| 38-41   | Host onboarding                 | Host login, basic info, photo, voice/video rule, identity, bank/UPI, agreement, application states.                             |
| 42-45   | Host dashboard and calls        | Online/offline, dashboard, incoming call, active voice/video, reconnecting, summary, call history/details.                      |
| 46-48   | Host earnings, rank, referrals  | Leaderboard, rank details/rules/change states, earnings details, withdrawals, referral flows.                                   |
| 49-50   | Admin website shell and modules | Admin auth/2FA, dashboard, hosts, payments, refunds, reports, settings with shared admin data contracts.                        |
| 51      | Cross-platform QA               | Format, lint, typecheck, unit/component tests, E2E smoke, Expo doctor, Android/web builds, route screenshots.                   |
| 52      | Production readiness handoff    | Gap review, dependency matrix finalization, environment prerequisites, remaining backend contract list, release checklist.      |

## Pre-Existing Checks

There are no pre-existing package scripts, lint rules, TypeScript config, tests, or build commands to run. Evidence:

- No `package.json` found.
- No `pnpm-lock.yaml` or workspace manifest found.
- No Expo, Metro, Babel, ESLint, Jest, Vitest, Playwright, or TypeScript config found.

The only commands run for this audit were read-only repository inspection and local document extraction.
