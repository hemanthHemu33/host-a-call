import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const root = join(
  fileURLToPath(new URL('.', import.meta.url)),
  '..',
  '..',
  '..',
);

describe('quality gate configuration', () => {
  it('keeps the CI check command wired to all required gates', () => {
    const packageJson = readFileSync(join(root, 'package.json'), 'utf8');

    expect(packageJson).toContain('"check"');
    expect(packageJson).toContain('pnpm format:check');
    expect(packageJson).toContain('pnpm lint');
    expect(packageJson).toContain('pnpm typecheck');
    expect(packageJson).toContain('pnpm test');
    expect(packageJson).toContain('pnpm knip');
    expect(packageJson).toContain('pnpm spellcheck');
    expect(packageJson).toContain('pnpm build');
  });

  it('keeps staged hooks scoped to staged files', () => {
    const packageJson = readFileSync(join(root, 'package.json'), 'utf8');
    const preCommitHook = readFileSync(
      join(root, '.husky', 'pre-commit'),
      'utf8',
    );

    expect(packageJson).toContain('"lint-staged"');
    expect(preCommitHook.trim()).toBe('pnpm lint:staged');
  });
});
