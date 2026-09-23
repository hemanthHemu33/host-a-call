# Dependency Matrix

Date: 2026-07-17

Package manager: `pnpm@11.7.0`

Node engine: `>=22.11.0 <25`

Backend containers and `.node-version` target `node@24.19.0`, the current Node
24 LTS line supported by the selected backend dependencies. The engine range
still accepts Node 22 LTS for existing frontend tooling compatibility.

## Root Tooling

| Package                       | Version  | Reason                                                                     |
| ----------------------------- | -------- | -------------------------------------------------------------------------- |
| `typescript`                  | `5.9.3`  | Conservative stable TypeScript line for Expo/Next ecosystem compatibility. |
| `eslint`                      | `10.7.0` | Workspace lint runner.                                                     |
| `cspell`                      | `10.0.1` | Spell-check and copy lint.                                                 |
| `husky`                       | `9.1.7`  | Git hook runner.                                                           |
| `knip`                        | `6.27.0` | Dead-code and dependency checks.                                           |
| `lint-staged`                 | `17.0.8` | Fast staged-file quality gate.                                             |
| `prettier`                    | `3.9.5`  | Formatting.                                                                |
| `prettier-plugin-tailwindcss` | `0.8.1`  | Tailwind/NativeWind class ordering where classes are introduced.           |

Note: `typescript@7.0.2` is tagged latest on npm, but this workspace pins `5.9.3` because TypeScript 7 peer support is not yet the safer default for the selected Expo and Next toolchain.

## Shared ESLint Config

Installed in `packages/eslint-config`.

| Package                         | Version   | Reason                                    |
| ------------------------------- | --------- | ----------------------------------------- |
| `@next/eslint-plugin-next`      | `16.2.10` | Next.js App Router lint rules.            |
| `eslint-plugin-boundaries`      | `7.0.2`   | Import-boundary support.                  |
| `eslint-plugin-import-x`        | `4.17.1`  | Duplicate and self-import checks.         |
| `eslint-plugin-react-hooks`     | `7.1.1`   | React hooks correctness rules.            |
| `eslint-plugin-testing-library` | `7.16.2`  | Testing Library lint rules.               |
| `globals`                       | `17.7.0`  | Browser and Node globals for flat ESLint. |
| `typescript-eslint`             | `8.64.0`  | Type-aware TypeScript linting.            |

## Mobile App

Installed in `apps/mobile`.

Expo-managed packages were installed with:

```sh
npx expo install expo-router expo-dev-client expo-status-bar expo-constants react react-dom react-native react-native-safe-area-context react-native-screens react-native-web @expo/metro-runtime
npx expo install expo-linking
pnpm --filter @connecto/mobile exec expo install expo-font
pnpm --filter @connecto/mobile exec expo install expo-navigation-bar
pnpm --filter @connecto/mobile exec expo install react-native-gesture-handler react-native-reanimated react-native-worklets react-native-svg expo-haptics
pnpm --filter @connecto/mobile exec expo install @react-native-async-storage/async-storage
pnpm --filter @connecto/mobile exec expo install lottie-react-native @shopify/react-native-skia
pnpm --filter @connecto/mobile exec expo install expo-secure-store
pnpm --filter @connecto/mobile exec expo install expo-image-picker expo-notifications
npx expo install expo-audio
npx expo install expo-asset
pnpm --filter @connecto/mobile exec expo install expo-linear-gradient
pnpm --filter @connecto/mobile exec expo install expo-camera
pnpm --filter @connecto/mobile exec expo install expo-clipboard
pnpm --filter @connecto/mobile exec expo install expo-system-ui
pnpm --filter @connecto/mobile add expo@57.0.7 @expo/metro-runtime@~57.0.6 expo-asset@~57.0.6 expo-constants@~57.0.6 expo-dev-client@~57.0.7 expo-image-picker@~57.0.5 expo-notifications@~57.0.6 expo-router@~57.0.7 --trust-lockfile
pnpm --filter @connecto/mobile add @shopify/flash-list@2.0.2
pnpm --filter @connecto/mobile add nativewind@4.2.6 tailwindcss@3.4.19 @expo-google-fonts/inter@0.4.2
pnpm --filter @connecto/mobile add @gorhom/bottom-sheet@5.2.14 lucide-react-native@1.24.0
pnpm --filter @connecto/mobile add @rive-app/react-native@0.4.18 react-native-nitro-modules@0.35.10
pnpm --filter @connecto/mobile exec expo install @react-native-community/netinfo
pnpm --filter @connecto/mobile add zod@4.4.3
pnpm --filter @connecto/mobile add @tanstack/react-query@5.101.2 zustand@5.0.14 react-hook-form@7.81.0 @hookform/resolvers@5.4.0
pnpm --filter @connecto/mobile add -D @testing-library/react-native@14.0.1 test-renderer@1.2.0
```

`expo@57.0.6` was installed first with pnpm because Expo CLI cannot infer an SDK before the `expo` package exists. On July 17, 2026, Expo-managed SDK 57 patch updates were then synchronized to the Expo doctor recommendations; the workspace's supply-chain lockfile verifier blocked Expo CLI's second-step `pnpm add`, so the exact Expo-approved versions were completed with `pnpm add --trust-lockfile`.

Native project strategy as of July 17, 2026:

- `apps/mobile/app.config.ts` is the native configuration source of truth.
- `apps/mobile/android` and `apps/mobile/ios` are generated with Expo prebuild and are not kept as repository source.
- Regenerate native projects with `pnpm prebuild:mobile`, `pnpm prebuild:mobile:android`, or `pnpm prebuild:mobile:clean` before native builds when config-plugin changes need to sync.

| Package                                     | Requested range | Installed version | Reason                                                                                                                           |
| ------------------------------------------- | --------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `expo`                                      | `57.0.7`        | `57.0.7`          | Expo SDK foundation.                                                                                                             |
| `expo-router`                               | `~57.0.7`       | `57.0.7`          | File-based mobile routing.                                                                                                       |
| `expo-dev-client`                           | `~57.0.7`       | `57.0.7`          | Development-build workflow.                                                                                                      |
| `expo-linking`                              | `~57.0.3`       | `57.0.3`          | Required router linking peer.                                                                                                    |
| `expo-status-bar`                           | `~57.0.1`       | `57.0.1`          | Native status bar integration.                                                                                                   |
| `expo-system-ui`                            | `~57.0.1`       | `57.0.1`          | Enables Android `userInterfaceStyle` support so the CNG-managed native config remains in sync with `app.config.ts`.              |
| `expo-font`                                 | `~57.0.1`       | `57.0.1`          | Inter font loading.                                                                                                              |
| `expo-navigation-bar`                       | `~57.0.2`       | `57.0.2`          | Android navigation bar styling.                                                                                                  |
| `expo-haptics`                              | `~57.0.1`       | `57.0.1`          | Press feedback haptic policy.                                                                                                    |
| `expo-image-picker`                         | `~57.0.5`       | `57.0.5`          | Native media-library picker with built-in square crop editing for onboarding profile images.                                     |
| `expo-camera`                               | `~57.0.3`       | `57.0.3`          | Native self-preview surface for active video calls and the future custom remote-video bridge integration stage.                  |
| `expo-clipboard`                            | `~57.0.1`       | `57.0.1`          | Native clipboard fallback for referral-code sharing and deep-link copy actions.                                                  |
| `expo-constants`                            | `~57.0.6`       | `57.0.6`          | App/environment constants.                                                                                                       |
| `@expo/metro-runtime`                       | `~57.0.6`       | `57.0.6`          | Expo web/runtime support.                                                                                                        |
| `expo-notifications`                        | `~57.0.6`       | `57.0.6`          | Native notification permission bridge for contextual onboarding education and future delivery flows.                             |
| `expo-secure-store`                         | `~57.0.1`       | `57.0.1`          | Native-encrypted persistence for restored customer entry state and mock session envelopes.                                       |
| `expo-audio`                                | `~57.0.2`       | `57.0.2`          | Native microphone permission and audio-session bridge for voice-call preconnect and active-call resource lifecycle.              |
| `expo-asset`                                | `~57.0.6`       | `57.0.6`          | Direct Expo Audio peer for asset-backed native audio module stability outside Expo Go.                                           |
| `expo-linear-gradient`                      | `~57.0.1`       | `57.0.1`          | Native/web gradient primitive for the wallet balance card.                                                                       |
| `@gorhom/bottom-sheet`                      | `5.2.14`        | `5.2.14`          | Accessible bottom sheet wrapper.                                                                                                 |
| `@react-native-async-storage/async-storage` | `2.2.0`         | `2.2.0`           | Persist non-sensitive motion and haptics preferences across app restarts.                                                        |
| `lottie-react-native`                       | `~7.3.8`        | `7.3.8`           | Illustrative animation wrapper for local JSON and `.lottie` assets.                                                              |
| `@shopify/flash-list`                       | `2.0.2`         | `2.0.2`           | High-performance discovery list virtualization for 500 ranked hosts with pull-to-refresh and pagination.                         |
| `@shopify/react-native-skia`                | `2.6.2`         | `2.6.2`           | Expo SDK 57 recommended Skia runtime for live mobile graphics.                                                                   |
| `@rive-app/react-native`                    | `0.4.18`        | `0.4.18`          | Current Rive React Native Nitro runtime for authored state-machine assets.                                                       |
| `react-native-nitro-modules`                | `0.35.10`       | `0.35.10`         | Required peer for the Rive React Native runtime; pinned below `0.36` for peer compatibility.                                     |
| `@react-native-community/netinfo`           | `12.0.1`        | `12.0.1`          | React Native online manager integration for TanStack Query.                                                                      |
| `@tanstack/react-query`                     | `5.101.2`       | `5.101.2`         | Async cache, retries, invalidation, and mock/real service consumption.                                                           |
| `zustand`                                   | `5.0.14`        | `5.0.14`          | Small local stores for session, UI preferences, active call, wallet cache, and development scenarios.                            |
| `react-hook-form`                           | `7.81.0`        | `7.81.0`          | Accessible frontend form state.                                                                                                  |
| `@hookform/resolvers`                       | `5.4.0`         | `5.4.0`           | Zod-backed form validation helpers.                                                                                              |
| `lucide-react-native`                       | `1.24.0`        | `1.24.0`          | Explicit icon imports for mobile UI components.                                                                                  |
| `nativewind`                                | `4.2.6`         | `4.2.6`           | Stable NativeWind v4 runtime.                                                                                                    |
| `tailwindcss`                               | `3.4.19`        | `3.4.19`          | Tailwind config compiler for NativeWind v4. Tailwind 4 was not selected because NativeWind v4 still expects v3 config semantics. |
| `@expo-google-fonts/inter`                  | `0.4.2`         | `0.4.2`           | Inter 400/500/600/700 font assets.                                                                                               |
| `react`                                     | `19.2.3`        | `19.2.3`          | Expo SDK-compatible React.                                                                                                       |
| `react-dom`                                 | `19.2.3`        | `19.2.3`          | Expo web support.                                                                                                                |
| `react-native`                              | `0.86.0`        | `0.86.0`          | Expo SDK-compatible React Native.                                                                                                |
| `react-native-gesture-handler`              | `~2.32.0`       | `2.32.0`          | Gorhom Bottom Sheet gesture dependency.                                                                                          |
| `react-native-reanimated`                   | `4.5.0`         | `4.5.0`           | Gorhom Bottom Sheet animation dependency.                                                                                        |
| `react-native-safe-area-context`            | `~5.7.0`        | `5.7.0`           | Safe-area handling.                                                                                                              |
| `react-native-screens`                      | `4.25.2`        | `4.25.2`          | Navigation screen primitives.                                                                                                    |
| `react-native-svg`                          | `15.15.4`       | `15.15.4`         | Lucide icon rendering dependency.                                                                                                |
| `react-native-web`                          | `^0.21.2`       | `0.21.2`          | Expo web export support.                                                                                                         |
| `react-native-worklets`                     | `0.10.0`        | `0.10.0`          | Reanimated 4 worklet runtime.                                                                                                    |
| `zod`                                       | `4.4.3`         | `4.4.3`           | Typed parsing for customer auth mock fixtures, runtime flags, and persisted session envelopes.                                   |
| `@testing-library/react-native`             | `14.0.1`        | `14.0.1`          | React Native component behavior tests.                                                                                           |
| `test-renderer`                             | `1.2.0`         | `1.2.0`           | React 19-compatible renderer for RN Testing Library.                                                                             |
| `@types/react`                              | `19.2.17`       | `19.2.17`         | TSX typechecking.                                                                                                                |
| `expo-doctor`                               | `1.20.1`        | `1.20.1`          | Expo project health checks.                                                                                                      |
| `vitest`                                    | `4.1.10`        | `4.1.10`          | Mobile package unit tests.                                                                                                       |

## Admin App

Installed in `apps/admin`.

```sh
pnpm --filter @connecto/admin add @tanstack/react-query@5.101.2 react-hook-form@7.81.0 @hookform/resolvers@5.4.0 msw@2.15.0
```

| Package                 | Version   | Reason                                    |
| ----------------------- | --------- | ----------------------------------------- |
| `next`                  | `16.2.10` | Admin App Router website.                 |
| `react`                 | `19.2.7`  | Next-compatible React.                    |
| `react-dom`             | `19.2.7`  | Next-compatible React DOM.                |
| `@tanstack/react-query` | `5.101.2` | Admin async cache and retry policy.       |
| `react-hook-form`       | `7.81.0`  | Admin form state for future modules.      |
| `@hookform/resolvers`   | `5.4.0`   | Zod-backed admin form validation helpers. |
| `msw`                   | `2.15.0`  | Maintained mock transport for admin web.  |
| `@types/node`           | `26.1.1`  | Next config and server-side typing.       |
| `@types/react`          | `19.2.17` | TSX typechecking.                         |
| `@types/react-dom`      | `19.2.3`  | React DOM typechecking.                   |
| `vitest`                | `4.1.10`  | Admin package unit tests.                 |

## Shared Packages

| Package  | Version  | Reason                                                       |
| -------- | -------- | ------------------------------------------------------------ |
| `zod`    | `4.4.3`  | Runtime validation for frontend contracts and mock fixtures. |
| `vitest` | `4.1.10` | Package unit tests where configured.                         |

## Backend Runtime

Installed in `backend/packages/backend-runtime`.

```sh
pnpm --filter @connecto/backend-runtime add pg@8.23.0 redis@6.2.1
pnpm --filter @connecto/backend-runtime add -D @types/pg@8.23.1
```

| Package     | Version  | Reason                                                      |
| ----------- | -------- | ----------------------------------------------------------- |
| `pg`        | `8.23.0` | PostgreSQL pool, transactions, migrations, seed, readiness. |
| `redis`     | `6.2.1`  | Redis ping/readiness and ephemeral worker/runtime support.  |
| `@types/pg` | `8.23.1` | TypeScript declarations for strict backend runtime builds.  |

## Build Approvals

`sharp@0.34.5` is approved in `pnpm-workspace.yaml` because Next.js pulls it for image tooling and pnpm 11 blocks dependency build scripts unless explicitly approved.

`unrs-resolver@1.12.2` is approved because `eslint-plugin-import-x` uses it for maintained import resolution.

`@shopify/react-native-skia@2.6.2` is approved because its native build script prepares the Expo-managed Skia runtime.

`msw@2.15.0` is approved because the admin web mock transport needs its service-worker assets during install.

`react-native-reanimated@4.5.0` is allowed in `pnpm-workspace.yaml` peer rules because `@gorhom/bottom-sheet@5.2.14` declares `>=3.16.0 || >=4.0.0-`, Expo doctor passes, and pnpm reports the compatible Expo-pinned version as unmet without the explicit rule.
