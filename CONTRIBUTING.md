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

1. Add active API-backed routes under `apps/mobile/src/samvad-app`.
2. Keep Samvad request/response types and transport code in `apps/mobile/src/samvad`.
3. Do not add imports from the removed `@connecto/domain` package.
4. Add loading, success, and recoverable error states for async screens.
5. Use safe-area and keyboard-aware layout where relevant.
6. Add focused tests for new API client behavior.

Admin:

1. Work in `apps/admin/samvad-admin`, its independent Vite project.
2. Keep admin UI and Samvad API contracts local to that project.
3. Do not depend on retired Connecto workspace packages.
4. Add tests for data-state handling and critical actions.

## Adding A Route

Routes must not import another app's internals. Use package exports or local `@/*` aliases only.

Expo Router route groups should use parentheses when the segment should not appear in the URL.

## Adding Animation

Animations must be purposeful, interruptible, and respectful of reduced-motion preferences. Do not block navigation while decorative motion finishes.

Use platform-native motion in the app surface where the animation lives. Share timing values through `@connecto/design-tokens`, not platform-specific animation components.

## Adding A Mock Endpoint

No real backend services should be created in frontend stages.

1. Add or extend the Samvad NestJS API contract in `backend/samvad-api`.
2. Validate payloads at the API boundary.
3. Add deterministic backend tests for new behavior.
4. Point mobile/admin development at the intended Samvad API base URL.
5. Add client tests for success and failure states.
