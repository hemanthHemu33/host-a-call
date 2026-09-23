import { describe, expect, it } from 'vitest';

import { queryKeys } from '@connecto/domain';

import {
  formatMoney,
  mobileDataIds,
  mobileDataLoaders,
} from './mobileDataHooks';

describe('mobile service-backed data hooks', () => {
  it('uses stable ids and query keys for current mock flows', () => {
    expect(queryKeys.wallet.detail(mobileDataIds.customerId)).toEqual([
      'wallet',
      'customer_1',
    ]);
    expect(queryKeys.host.dashboard(mobileDataIds.hostId)).toEqual([
      'host',
      'dashboard',
      'host_anjali',
    ]);
  });

  it('loads customer and host data through frontendServices', async () => {
    await expect(mobileDataLoaders.hosts()).resolves.toHaveLength(500);
    await expect(mobileDataLoaders.hosts()).resolves.toContainEqual(
      expect.objectContaining({
        availability: 'online',
        displayName: 'Anjali',
        id: 'host_anjali',
      }),
    );
    await expect(mobileDataLoaders.wallet()).resolves.toMatchObject({
      customerId: mobileDataIds.customerId,
    });
    await expect(mobileDataLoaders.hostDashboard()).resolves.toMatchObject({
      host: { id: mobileDataIds.hostId },
    });
  });

  it('formats money consistently for mobile screens', () => {
    expect(formatMoney({ amountPaise: 25000, currency: 'INR' })).toBe('₹250');
  });
});
