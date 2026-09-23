import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it } from 'vitest';

import { defaultDiscoveryPreferences } from './discovery.models';
import {
  loadDiscoveryPreferences,
  persistDiscoveryPreferences,
} from './discovery.storage';

describe('discovery storage', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('returns default preferences when nothing has been stored', async () => {
    await expect(loadDiscoveryPreferences()).resolves.toEqual(
      defaultDiscoveryPreferences,
    );
  });

  it('persists and restores filters and blocked host ids', async () => {
    const stored = await persistDiscoveryPreferences({
      blockedHostIds: ['host_001', 'host_015'],
      filters: {
        language: 'Hindi',
        newHostsOnly: true,
        onlineOnly: true,
        rank: 'gold',
        topRated: true,
      },
    });

    expect(stored).toEqual({
      blockedHostIds: ['host_001', 'host_015'],
      filters: {
        language: 'Hindi',
        newHostsOnly: true,
        onlineOnly: true,
        rank: 'gold',
        topRated: true,
      },
    });
    await expect(loadDiscoveryPreferences()).resolves.toEqual(stored);
  });
});
