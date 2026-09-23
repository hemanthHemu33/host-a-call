import { describe, expect, it } from 'vitest';

import { queryKeys } from '@connecto/domain';

import {
  createMobileQueryClient,
  invalidateDomainQueries,
} from './query-client';

describe('mobile query client', () => {
  it('invalidates related wallet queries through domain policy', async () => {
    const queryClient = createMobileQueryClient();
    queryClient.setQueryData(queryKeys.wallet.detail('customer_1'), {
      balance: 1,
    });

    await invalidateDomainQueries(queryClient, 'wallet');

    expect(
      queryClient.getQueryState(queryKeys.wallet.detail('customer_1'))
        ?.isInvalidated,
    ).toBe(true);
  });
});
