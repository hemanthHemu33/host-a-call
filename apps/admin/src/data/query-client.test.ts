import { describe, expect, it } from 'vitest';

import { createApiError, FrontendApiError } from '@connecto/domain';

import { createAdminQueryClient } from './query-client';

describe('admin query client', () => {
  it('does not retry validation errors', () => {
    const queryClient = createAdminQueryClient();
    const retry = queryClient.getDefaultOptions().queries?.retry;

    expect(typeof retry).toBe('function');
    if (typeof retry === 'function') {
      expect(
        retry(
          0,
          new FrontendApiError(
            createApiError({
              code: 'validation',
              message: 'Invalid filter.',
              retryable: false,
            }),
          ),
        ),
      ).toBe(false);
    }
  });
});
