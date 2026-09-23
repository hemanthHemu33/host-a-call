import { rm } from 'node:fs/promises';
import { join } from 'node:path';

const targets = [
  'apps/admin/.next',
  'apps/admin/out',
  'apps/mobile/.expo',
  'apps/mobile/dist',
  'coverage',
];

await Promise.all(
  targets.map((target) =>
    rm(join(process.cwd(), target), { force: true, recursive: true }),
  ),
);

const buildInfoFiles = [
  'apps/admin/tsconfig.tsbuildinfo',
  'apps/mobile/tsconfig.tsbuildinfo',
  'packages/design-tokens/tsconfig.tsbuildinfo',
  'backend/packages/domain/tsconfig.tsbuildinfo',
  'packages/test-utils/tsconfig.tsbuildinfo',
];

await Promise.all(
  buildInfoFiles.map((target) =>
    rm(join(process.cwd(), target), { force: true }),
  ),
);
