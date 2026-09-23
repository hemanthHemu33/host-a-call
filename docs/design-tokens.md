# Design Tokens

Connecto tokens live in `packages/design-tokens` and are exported as TypeScript plus CSS variables.

## Theme Support

- Mobile supports `mobileThemes.light` and `mobileThemes.dark`.
- Admin defaults to the light CSS variables and can opt into dark mode with `data-theme="dark"`.
- Screens should import semantic roles such as `colorRoles.brand.primary`, not raw hex values.

## Contrast Checks

Critical contrast is test-covered in `packages/design-tokens/src/index.test.ts`.

- Light text primary on app background: WCAG AAA target, at least 7:1.
- Dark text primary on app background: WCAG AAA target, at least 7:1.
- Error text on error soft surface: WCAG AA target, at least 4.5:1.
- Rank foregrounds on bronze, silver, gold, platinum, and diamond backgrounds: WCAG AA target, at least 4.5:1.

## Number Style

Use tabular numbers for balances, timers, rates, call durations, and rank positions. The guidance is exported as `typography.numberStyle`.

## Review Routes

- Mobile: `/token-gallery`
- Admin: `/token-gallery`
