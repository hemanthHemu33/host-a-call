import { QueryClient } from '@tanstack/react-query';

import { normalizeApiError } from '@connecto/domain';

export const createAdminQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      mutations: {
        retry: false,
      },
      queries: {
        retry: (failureCount, error) =>
          failureCount < 2 && normalizeApiError(error).retryable,
        staleTime: 30_000,
      },
    },
  });
