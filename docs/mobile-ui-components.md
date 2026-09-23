# Mobile UI Components

Date: 2026-07-16

The reusable mobile UI library lives in `apps/mobile/src/components/ui` and is documented visually at the Expo Router route `/component-gallery`.

## Import Contract

Feature screens should import components from `@/components/ui` only. Components must stay data-free: no screen-specific fetching, provider calls, payment verification, call-token generation, or OTP work belongs in this package.

Use semantic design tokens from `@connecto/design-tokens` through the mobile theme helpers. Do not import hard-coded brand colors into screens or components.

## Component Groups

| Group      | Components                                                                                                                   |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Controls   | `Button`, `IconButton`, `CallControlButton`                                                                                  |
| Forms      | `TextField`, `PhoneField`, `OTPInput`, `SearchField`, `SelectField`, `TextArea`, `Checkbox`, `RadioCard`, `SwitchRow`        |
| Navigation | `AppHeader`, `BackHeader`, `WalletHeader`, `TabBar`, `SectionHeader`                                                         |
| Surfaces   | `Card`, `HostCard`, `MetricCard`, `WalletCard`, `RankBadge`, `StatusBadge`, `Avatar`, `EmptyState`, `ErrorState`, `Skeleton` |
| Feedback   | `Banner`, `Toast`, `Snackbar`, `InlineError`, `ConfirmationDialog`                                                           |
| Lists      | `ListRow`, `TransactionRow`, `CallHistoryRow`, `ReferralRow`, `NotificationRow`                                              |
| Shells     | `BottomSheetWrapper`, `PermissionExplainer`, `LegalContent`                                                                  |

## Interaction Policy

All touch controls use at least a 44x44 target, expose accessibility labels and state, and support disabled and pressed states. Loading controls set busy accessibility state and suppress duplicate actions.

Pressed scale and haptic feedback are centralized in `interaction.ts`. Reduced motion disables scale feedback. Haptics are opt-in through component props and should be reserved for meaningful confirmations, call controls, and high-intent actions.

Bottom sheets require the providers registered in `apps/mobile/src/app/_layout.tsx`; feature screens should not register duplicate root providers.

## Icons

Use explicit `lucide-react-native` icon imports at call sites to preserve bundle size. Do not import the full icon namespace.

## Testing

Critical behaviour is covered in `apps/mobile/src/components/ui/ui.test.tsx`. The mobile Vitest setup maps React Native and React Native Testing Library APIs to a local deterministic host harness so component logic can run in CI without a native simulator.
