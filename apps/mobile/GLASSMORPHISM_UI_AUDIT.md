# Connecto Glassmorphism UI Audit

## Scope and architecture

- Application: Expo SDK 57.0.6 / React Native 0.86 / TypeScript.
- Routing: Expo Router with root Stack, customer and host Tabs, nested onboarding and legal Stacks.
- State and data: Zustand and TanStack Query. No store, API, schema, payment, call, deep-link, or analytics behavior was changed.
- Existing visual runtimes: React Native Animated, Reanimated, Lottie, Rive feature fallback, Skia, Expo Linear Gradient, Lucide icons, Gorhom Bottom Sheet.
- Shared presentation entry points: root layout, Screen, ScrollScreen, KeyboardScreen, CallScreen, GlassSurface, fields, controls, feedback, navigation, and bottom-sheet wrappers.

## Route inventory

The audit found 71 route files and 6 layout files.

### Root and boundary routes

`/`, `/bootstrap`, `/mandatory-update`, `/account-status`, `/invalid-link`, `/+not-found`, `/animation-lab`, `/motion-lab`, `/component-gallery`, `/token-gallery`, `/layout-qa`, `/developer-scenarios`

### Authentication routes

`/age-confirmation`, `/blocked-account`, `/login`, `/otp`, `/referral-code`, `/suspended-account`, `/underage-block`

### Customer routes

`/home`, `/filters`, `/calls`, `/calls/[callId]`, `/add-money`, `/payment-states`, `/transaction/[transactionId]`, `/profile`, `/profile-edit`, `/language-settings`, `/motion-settings`, `/notifications`, `/notification-preferences`, `/privacy-safety`, `/blocked-users`, `/report-history`, `/support`, `/support-ticket/[ticketId]`, `/delete-account`, `/referrals`, `/referrals/[referralId]`, `/settings`

### Customer onboarding routes

`/language`, `/permissions`, `/profile-setup` in the customer-onboarding route group.

### Host routes

`/dashboard`, `/calls`, `/earnings`, `/leaderboard`, `/profile` in the host route group.

### Host onboarding routes

`/agreement`, `/application-states`, `/host-profile-setup`, `/payout`, `/photo`, `/rules`, `/verification` in the host-onboarding route group.

### Call and post-call routes

`/call/outgoing`, `/call/voice`, `/call/video-request`, `/call/video`, `/call/reconnecting`, `/call/summary`, `/call/report`

### Legal and deep-link routes

`/legal/terms`, `/legal/privacy`, `/legal/community-guidelines`, `/referral/[code]`, `/link/payment-result`, `/link/call-invitation/[invitationId]`, `/link/notification/[destination]`, `/link/support-ticket/[ticketId]`

## Screen coverage

The following requested screens are not separate screens in the current application: Welcome, Signup, Search, Incoming Call, Refunds, Maintenance, and Offline. Payment success and failure share `/payment-states`; payment-method selection is an Add Money state; Help is represented by Support; rating is represented by post-call summary; ranking is represented by the host leaderboard. No missing screen was invented.

## Implementation summary

1. The supplied 941x1696 artwork is bundled locally and mounted once beneath the root navigator, so it persists across route transitions.
2. A native-driver 18-second drift/scale loop provides restrained motion on iOS. Android keeps the artwork static to avoid full-screen redraw cost; the existing reduced-motion preference also stops this animation while retaining the artwork.
3. `GlassSurface` now owns blur, translucent overlay, light border, highlight, shadow, and a transparent content layer. Variants are subtle, standard, strong, floating, and modal.
4. iOS uses `expo-blur`. Android intentionally uses the layered translucent fallback without per-card native gradient shaders because many blur/gradient nodes inside virtualized lists cause frame loss and rendering artifacts.
5. Tabs, cards, dynamic rows, form fields, buttons, modal surfaces, bottom sheets, feedback, auth/onboarding panels, legal reading surfaces, and static call panels use the shared glass system.
6. Home pauses Lottie call icons and online pulses only while a drag or momentum scroll is active, then resumes them at full speed. Lottie remains on its native hardware renderer.
7. Call/video media surfaces, profile images, Lottie, Rive, Skia, camera/video output, and payment-provider surfaces are not blurred.
8. Existing Lottie sources, animation registry, Rive sources, Skia implementations, Reanimated durations, callbacks, and state transitions were not edited.

## Complete UI audit table

Key: `Shared` means the route inherits the persistent background and glass treatment from shared wrappers/components. `Smoke` means it was opened on the Pixel 9 emulator. iOS is not executable from this Windows environment.

| Route(s)                                                                                                                   | Screen/component                                        | Implementation file(s)                                                     | Previous design problem                 | Background updated | Shapes | Glass         | Blur                         | Translucency | Border | Depth | Opaque wrappers removed | Animated content             | Animation untouched | Function preserved | Android       | iOS | Status   |
| -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------- | --------------------------------------- | ------------------ | ------ | ------------- | ---------------------------- | ------------ | ------ | ----- | ----------------------- | ---------------------------- | ------------------- | ------------------ | ------------- | --- | -------- |
| `/`, `/bootstrap`, `/mandatory-update`, `/account-status`                                                                  | Bootstrap and account boundaries                        | `AuthScreens.tsx`, `RouteShellScreen.tsx`                                  | Flat or pale state panels               | Y                  | Y      | Y             | iOS/native, Android/fallback | Y            | Y      | Y     | Y                       | Y                            | Y                   | Y                  | Static/shared | N   | Complete |
| `/invalid-link`, `/+not-found`                                                                                             | Link and route errors                                   | `CustomerAccountScreens.tsx`, `RouteShellScreen.tsx`                       | Flat error containers                   | Y                  | Y      | Y             | Shared                       | Y            | Y      | Y     | Y                       | N                            | N/A                 | Y                  | Static/shared | N   | Complete |
| `/login`, `/otp`, `/referral-code`, `/age-confirmation`                                                                    | Authentication                                          | `AuthScreens.tsx`                                                          | Opaque form/card layers                 | Y                  | Y      | Y             | Shared                       | Y            | Y      | Y     | Y                       | Y                            | Y                   | Y                  | Static/shared | N   | Complete |
| `/blocked-account`, `/suspended-account`, `/underage-block`                                                                | Restricted account states                               | `AuthScreens.tsx`                                                          | Flat status cards                       | Y                  | Y      | Y             | Shared                       | Y            | Y      | Y     | Y                       | Y                            | Y                   | Y                  | Static/shared | N   | Complete |
| customer onboarding `/language`, `/permissions`, `/profile-setup`                                                          | Customer onboarding                                     | `CustomerOnboardingScreens.tsx`, `CustomerOnboardingProfileFlowScreen.tsx` | Pale primary panels and fields          | Y                  | Y      | Y             | Shared                       | Y            | Y      | Y     | Y                       | Y                            | Y                   | Y                  | Static/shared | N   | Complete |
| host onboarding `/agreement`, `/application-states`, `/host-profile-setup`, `/payout`, `/photo`, `/rules`, `/verification` | Host onboarding                                         | `MobileDataScreens.tsx`, shared UI                                         | Inconsistent flat cards                 | Y                  | Y      | Y             | Shared                       | Y            | Y      | Y     | Shared                  | Conditional                  | Y                   | Y                  | Static/shared | N   | Complete |
| `/home`                                                                                                                    | Discovery and expert cards                              | `DiscoveryScreens.tsx`                                                     | Weak glass, old banner, opaque cards    | Y                  | Y      | Y             | Android fallback             | Y            | Y      | Y     | Y                       | Lottie and pulse             | Y                   | Y                  | Smoke         | N   | Complete |
| `/filters`                                                                                                                 | Discovery filters                                       | `DiscoveryScreens.tsx`, shared fields                                      | Flat radio rows                         | Y                  | Y      | Y             | Android fallback             | Y            | Y      | Y     | Y                       | N                            | N/A                 | Y                  | Smoke         | N   | Complete |
| `/calls`, `/calls/[callId]`                                                                                                | Recents and call detail                                 | `PostCallScreens.tsx`                                                      | Local gradient and pale rows            | Y                  | Y      | Y             | Android fallback             | Y            | Y      | Y     | Y                       | Lottie where applicable      | Y                   | Y                  | Smoke/shared  | N   | Complete |
| `/profile`, `/settings`, `/motion-settings`                                                                                | Profile and settings                                    | `CustomerAccountScreens.tsx`                                               | Flat menu rows and navigation           | Y                  | Y      | Y             | Android fallback             | Y            | Y      | Y     | Y                       | Motion controls              | Y                   | Y                  | Smoke         | N   | Complete |
| `/profile-edit`, `/language-settings`                                                                                      | Profile forms and language                              | `CustomerAccountScreens.tsx`, shared fields                                | Opaque fields/selection panels          | Y                  | Y      | Y             | Android fallback             | Y            | Y      | Y     | Y                       | N                            | N/A                 | Y                  | Smoke         | N   | Complete |
| `/notifications`, `/notification-preferences`                                                                              | Notifications                                           | `CustomerAccountScreens.tsx`                                               | Flat dynamic rows                       | Y                  | Y      | Y             | Android fallback             | Y            | Y      | Y     | Y                       | N                            | N/A                 | Y                  | Smoke/shared  | N   | Complete |
| `/privacy-safety`, `/blocked-users`, `/report-history`, `/delete-account`                                                  | Safety and account management                           | `CustomerAccountScreens.tsx`                                               | Inconsistent row/card surfaces          | Y                  | Y      | Y             | Shared                       | Y            | Y      | Y     | Y                       | N                            | N/A                 | Y                  | Smoke/shared  | N   | Complete |
| `/support`, `/support-ticket/[ticketId]`                                                                                   | Help and support                                        | `CustomerAccountScreens.tsx`                                               | Flat ticket rows/forms                  | Y                  | Y      | Y             | Shared                       | Y            | Y      | Y     | Y                       | N                            | N/A                 | Y                  | Smoke/shared  | N   | Complete |
| `/add-money`                                                                                                               | Wallet and recharge packs                               | `FinanceScreens.tsx`                                                       | Pale pack cards and action dock         | Y                  | Y      | Y             | Android fallback             | Y            | Y      | Y     | Y                       | Cashback/Lottie              | Y                   | Y                  | Smoke         | N   | Complete |
| `/payment-states`, `/link/payment-result`                                                                                  | Payment processing/result                               | `FinanceScreens.tsx`                                                       | Flat result panel                       | Y                  | Y      | Y             | Android fallback             | Y            | Y      | Y     | Y                       | Lottie                       | Y                   | Y                  | Smoke         | N   | Complete |
| `/transaction/[transactionId]`                                                                                             | Transaction detail                                      | `FinanceScreens.tsx`                                                       | Flat finance detail sections            | Y                  | Y      | Y             | Shared                       | Y            | Y      | Y     | Y                       | N                            | N/A                 | Y                  | Static/shared | N   | Complete |
| Add Money internal states                                                                                                  | Payment method, coupon, cashback modal, success/failure | `FinanceScreens.tsx`, `bottom-sheet.tsx`                                   | Opaque modal and option rows            | Y                  | Y      | Y             | Android fallback             | Y            | Y      | Y     | Y                       | Confetti/cashback            | Y                   | Y                  | Smoke         | N   | Complete |
| `/referrals`, `/referrals/[referralId]`, `/referral/[code]`                                                                | Referral overview/detail/deep link                      | `ReferralScreens.tsx`                                                      | Pale summary and history rows           | Y                  | Y      | Y             | Android fallback             | Y            | Y      | Y     | Y                       | Lottie/progress              | Y                   | Y                  | Smoke/shared  | N   | Complete |
| host `/dashboard`, `/calls`, `/earnings`, `/leaderboard`, `/profile`                                                       | Host data and ranking                                   | `MobileDataScreens.tsx`, shared UI                                         | Inconsistent flat cards                 | Y                  | Y      | Y             | Shared                       | Y            | Y      | Y     | Shared                  | Conditional                  | Y                   | Y                  | Static/shared | N   | Complete |
| `/call/outgoing`, `/call/voice`, `/call/video-request`, `/call/video`, `/call/reconnecting`                                | Call states                                             | `CallScreen.tsx`, `CallScreens.tsx`, `VideoCallScreen.tsx`                 | Static panels lacked glass; scene inset | Dark variant       | N/A    | Static panels | Android fallback             | Y            | Y      | Y     | Y                       | Lottie/Skia/Reanimated/media | Y                   | Y                  | Smoke/shared  | N   | Complete |
| `/call/summary`, `/call/report`                                                                                            | Post-call rating/report                                 | `PostCallScreens.tsx`                                                      | Pale summary/report cards               | Y                  | Y      | Y             | Shared                       | Y            | Y      | Y     | Y                       | Lottie                       | Y                   | Y                  | Static/shared | N   | Complete |
| `/legal/terms`, `/legal/privacy`, `/legal/community-guidelines`                                                            | Legal reading surfaces                                  | `CustomerAccountScreens.tsx`, `surfaces.tsx`                               | Multiple flat/opaque reading cards      | Y                  | Y      | Strong glass  | Android fallback             | Y            | Y      | Y     | Y                       | N                            | N/A                 | Y                  | Smoke/shared  | N   | Complete |
| `/link/call-invitation/[invitationId]`, `/link/notification/[destination]`, `/link/support-ticket/[ticketId]`              | Deep-link boundaries                                    | `CustomerAccountScreens.tsx`                                               | Flat route boundary state               | Y                  | Y      | Y             | Shared                       | Y            | Y      | Y     | Y                       | Conditional                  | Y                   | Y                  | Static/shared | N   | Complete |
| `/animation-lab`, `/motion-lab`, `/component-gallery`, `/token-gallery`, `/layout-qa`, `/developer-scenarios`              | Internal QA tools                                       | feature QA screens and shared UI                                           | Tool surfaces did not match app chrome  | Y                  | Y      | Shared        | Shared                       | Y            | Y      | Y     | Shared                  | Lottie/Rive/Skia/Reanimated  | Y                   | Y                  | Static/shared | N   | Complete |

## Files created

- `assets/backgrounds/glassmorphism-background.png`
- `src/components/ui/GlassBlurLayer.tsx`
- `src/components/ui/GlassBlurLayer.android.tsx`
- `src/components/ui/GlassBlurLayer.ios.tsx`
- `GLASSMORPHISM_UI_AUDIT.md`

## Main files modified

- Root and navigator layouts under `src/app`.
- Layout wrappers: `AppGlassBackground.tsx`, `Screen.tsx`, `ScrollScreen.tsx`, `KeyboardScreen.tsx`, `CallScreen.tsx`.
- Shared UI: `theme.ts`, `surfaces.tsx`, `fields.tsx`, `controls.tsx`, `feedback.tsx`, `navigation.tsx`, `bottom-sheet.tsx`, and `index.ts`.
- Feature presentation: Auth, customer onboarding, discovery, customer account, finance, post-call, calls, referrals, route-shell, and token-gallery screens.
- Dependency manifests and lockfile for Expo-compatible blur and Babel preset resolution.

## Dependencies

- Reused: Expo Router, Expo Linear Gradient, React Native Animated, Reanimated, Lottie, Rive fallback, Skia, Lucide, safe-area-context, and Gorhom Bottom Sheet.
- Added: `expo-blur@~57.0.2` for native iOS backdrop blur.
- Added: `babel-preset-expo@~57.0.3` because the existing Babel config referenced it but the package was absent, preventing clean Metro bundles.

## Validation

- TypeScript: passed.
- ESLint: passed.
- Unit/component tests: 37 files and 141 tests passed; none disabled.
- Metro Android bundle: passed after the missing Babel preset and asset import were corrected.
- Pixel 9 emulator: Home, Recents, Profile, Filters, Add Money, payment method/cashback modal, payment failure, Edit Profile, Language, Notifications, Privacy, Support, Referrals, Settings, Terms, and outgoing-call fallback opened successfully.
- Android build: Gradle reached native compilation but failed in `expo-modules-core:buildCMakeDebug[arm64-v8a]` because the pnpm package path exceeds CMake's 250-character object-path limit; Ninja then reported `build.ninja still dirty after 100 tries`. This is a Windows workspace-path/toolchain limitation, not a TypeScript, Metro, or application runtime error.
- iOS build and native blur: not runnable on Windows; implementation uses the Expo SDK-matched native module and remains unverified on an iOS simulator/device.

## Genuine limitations

- Android uses a translucent layered fallback instead of one BlurView per list card. Full-screen background drift and per-card native gradient shaders are also disabled on Android, and Home pauses decorative animation during active scrolling. These choices reduce redraw/overdraw while preserving visible background, border, highlight, depth, and full-speed idle animations.
- iOS native blur and iOS responsive layouts require validation on macOS/Xcode.
- Authenticated customer state prevents direct emulator entry to role-gated auth, onboarding, and host screens without changing application state; these were statically inspected and inherit the verified shared wrappers.
- The repository root is not a Git worktree in this environment, so a Git diff cannot be produced. Scope was checked by file ownership and no service/store/schema/route/animation-source file was edited.
