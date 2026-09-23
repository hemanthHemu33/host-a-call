import { describe, expect, it } from 'vitest';

import { adminRuntimeConfig } from '@/config/runtime';

describe('admin health route', () => {
  it('uses the mock provider by default', () => {
    expect(adminRuntimeConfig.providerMode).toBe('mock');
  });
});
