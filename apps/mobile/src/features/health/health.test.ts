import { describe, expect, it } from 'vitest';

import { featureFlags } from '@/config/featureFlags';

import { getMobileProviderMode } from './health';

describe('mobile health provider', () => {
  it('defaults to the mock provider', () => {
    expect(getMobileProviderMode()).toBe('mock');
  });

  it('exposes typed runtime feature flags', () => {
    expect(featureFlags.analyticsEnabled).toBe(false);
  });
});
