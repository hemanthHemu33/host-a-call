import { describe, expect, it } from 'vitest';

import { defaultDevelopmentScenario } from '@connecto/domain';

import {
  applyMobileDevelopmentScenario,
  frontendAdapters,
  frontendServices,
} from './adapters';

describe('mobile frontend adapters', () => {
  it('uses mock adapters by default', async () => {
    await expect(
      frontendAdapters.calls.completeCall('call_1'),
    ).resolves.toMatchObject({
      id: 'call_1',
    });
  });

  it('uses seeded mock services without importing fixtures in screens', async () => {
    applyMobileDevelopmentScenario({
      ...defaultDevelopmentScenario,
      walletBalancePaise: 777,
    });

    await expect(
      frontendServices.wallet.getWallet('customer_1'),
    ).resolves.toMatchObject({
      balance: { amountPaise: 777 },
    });

    applyMobileDevelopmentScenario(defaultDevelopmentScenario);
  });
});
