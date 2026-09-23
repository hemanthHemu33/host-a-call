# Contributing

## Branch Naming

Use short, scoped branch names:

- `feature/mobile-auth-shell`
- `feature/admin-host-list`
- `fix/provider-mode-parsing`
- `chore/quality-gates`

## Commits

Keep commits focused and reviewable. A commit should explain one logical change and include matching tests or documentation when behaviour changes.

Do not commit secrets, generated build outputs, `.env` files, `.next`, `.expo`, `dist`, or coverage output.

## Quality Commands

Fast staged-file hook:

```sh
pnpm lint:staged
```

Full local and CI check:

```sh
pnpm check
```

Individual commands:

```sh
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm knip
pnpm spellcheck
pnpm build
pnpm doctor:expo
```

## Adding A Screen

Mobile:

1. Add the route under `apps/mobile/src/app`.
2. Put screen-specific implementation under `apps/mobile/src/features/<feature>`.
3. Import shared contracts from `@connecto/domain` and tokens from `@connecto/design-tokens`.
4. Add loading, empty, success, recoverable error, and offline states for async screens.
5. Use safe-area and keyboard-aware layout where relevant.
6. Add tests for state and provider behaviour.

Admin:

1. Add the route under `apps/admin/src/app`.
2. Keep admin UI local to the admin app unless the abstraction is platform-neutral.
3. Use `@connecto/domain` for contracts and `@connecto/design-tokens` for semantic values.
4. Add tests for data-state handling and critical actions.

## Adding A Route

Routes must not import another app's internals. Use package exports or local `@/*` aliases only.

Expo Router route groups should use parentheses when the segment should not appear in the URL.

## Adding Animation

Animations must be purposeful, interruptible, and respectful of reduced-motion preferences. Do not block navigation while decorative motion finishes.

Use platform-native motion in the app surface where the animation lives. Share timing values through `@connecto/design-tokens`, not platform-specific animation components.

## Adding A Mock Endpoint

No real backend services should be created in frontend stages.

1. Add or extend a typed interface in `backend/packages/domain`.
2. Validate payloads with Zod before data crosses package boundaries.
3. Add deterministic fixtures in `backend/packages/domain`.
4. Select the provider through `CONNECTO_PROVIDER`, `NEXT_PUBLIC_CONNECTO_PROVIDER`, or `EXPO_PUBLIC_CONNECTO_PROVIDER`.
5. Add unit tests for mock adapter success and failure states.
