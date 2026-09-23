# Decision Log

Date: 2026-07-15

## D001: Repository Shape

Decision: Use a pnpm monorepo when implementation begins.

Planned shape:

```text
apps/
  mobile/   Expo React Native app
  admin/    Admin website
packages/
  api-contracts/
  fixtures/
  mock-adapters/
  tokens/
  ui-mobile/
  ui-admin/
  utils/
```

Reason: The approved scope has a mobile customer/host app, a separate admin website, and shared domain contracts. A monorepo keeps contracts, fixtures, tokens, and mock adapters deterministic without creating a backend in this frontend-only stage sequence.

Current status: Implemented as the foundation monorepo with `apps/mobile`, `apps/admin`, `packages/design-tokens`, `backend/packages/domain`, `packages/eslint-config`, `packages/tsconfig`, and `packages/test-utils`.

## D002: Approved Product Source

Decision: Treat `Voice-First Paid Calling App.pdf` as the approved source for route coverage and implementation order.

Reason: It is the newest local artifact and explicitly defines the six admin modules: dashboard, hosts, payments, refunds, reports, and settings.

Consequence: Direct customer video-call start is excluded. Video routes should represent voice-to-video upgrade flows unless a newer approval changes this.

## D003: Design Tokens

Decision: Put design tokens in a shared package and expose platform adapters for React Native and web.

Reason: Customer mobile, host mobile, and admin web need consistent color, spacing, type, radius, shadow, and motion decisions, but the admin should not inherit mobile layout patterns.

Current status: Empty token files exist under `connecto/src/theme`; they should be migrated or replaced during workspace setup.

## D004: State Management

Decision: Use server-state/query primitives for async data and a small client store for session, app shell, call session, wallet draft state, and provider mode.

Preferred implementation: TanStack Query for async mock/API reads and Zustand or equivalent small-store usage for local UI/session state.

Reason: Most flows are async and need loading, empty, success, recoverable error, and offline states. A small client store avoids a large global state model while preserving call-session ergonomics.

Current status: Implemented in mobile with TanStack Query for async service data and Zustand-backed stores for auth/session, UI preferences, active call, wallet display cache, and developer scenarios. The older pure transition helpers remain exported for tests and state-machine reuse.

## D005: External Systems

Decision: Represent OTP, payments, call tokens, notifications, analytics, wallet ledger, referrals, ranking, reports, and admin APIs through typed interfaces and deterministic mock adapters until backend services exist.

Reason: This stage sequence is frontend-only. Untyped JSON and ad hoc mock data would make later backend integration expensive and brittle.

Current status: Implemented in `backend/packages/domain/src/data-layer.ts` as `FrontendServices`, schema-validating `HttpClient`, mock services, HTTP services, deterministic mock database seeding, error normalization, query keys, invalidation policy, and optimistic-update rules. Admin uses MSW in mock mode; mobile uses an in-process mock adapter.

## D006: Animation

Decision: Use purposeful, interruptible animations with reduced-motion support.

Mobile direction: Reanimated for interaction and screen-state motion, Lottie for illustrative authored JSON assets, Rive for future authored state-machine assets, and Skia for native live/data-driven visuals.

Asset direction: All mobile animation assets must be registered in `apps/mobile/src/components/animations/registry.ts`. The `ConversationOrb` Rive asset remains behind a feature flag and falls back to a Reanimated/tokenized implementation until a final `.riv` file is approved.

Admin direction: CSS transitions only for lightweight feedback, respecting reduced motion.

Current status: Implemented mobile wrappers, `/animation-lab`, placeholder Lottie JSON, Rive contract documentation, native Skia components, and web-safe fallbacks.

Blocked status: final Rive authoring and physical low-end Android profiling require external tools/assets not present in this workspace. The code path is guarded and documented rather than shipping a fake `.riv` binary or fabricated device measurements.

## D007: Testing

Decision: Add tests with the first real implementation stage.

Planned coverage:

- Unit tests for contracts, fixtures, formatters, and provider switches.
- Component tests for mobile and admin states.
- Route smoke tests for navigation shells.
- Playwright tests for admin web flows.
- Expo doctor and Android/web build checks once package scripts exist.

Current status: No test framework exists.

## D008: Deployment

Decision: Treat deployment as two surfaces.

Mobile: Expo development builds first, then EAS builds/updates once native modules and environment contracts stabilize.

Admin: Static or React web deployment with environment-based mock/API provider switches.

Reason: Mobile calling features need native validation, while admin web should ship independently from mobile.

Current status: No deployment config exists.

## D009: Runtime Configuration

Decision: Validate mobile and admin public runtime configuration in `@connecto/domain` with Zod, then consume the parsed config from each app.

Reason: Both apps need the same environment, mock/provider, and feature-flag rules. Keeping validation in the shared domain package avoids duplicate parsers and avoids adding new app-level dependencies.

Current status: Implemented for `development`, `preview`, and `production` profiles. Production rejects placeholder public values, mock mode, and non-production provider mode.

## D010: Backend Architecture ADRs

Decision: Move backend runtime decisions into explicit ADRs under `docs/adr`.

Reason: The repository now includes a deployable API scaffold, a deployable
worker scaffold, Docker-first packaging, and an enforceable backend module
graph. Those choices need durable architecture records instead of remaining
implicit in audit notes.

Current status: Implemented by ADR-001 through ADR-008 on 2026-08-18.
