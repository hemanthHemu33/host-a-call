'use client';

import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';

import { adminRuntimeConfig } from '@/config/runtime';
import { createAdminQueryClient } from '@/data/query-client';

export function AdminProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState<QueryClient>(() => createAdminQueryClient());

  useEffect(() => {
    if (!adminRuntimeConfig.mockMode || typeof window === 'undefined') {
      return undefined;
    }

    let cancelled = false;

    void import('@/mocks/browser').then(({ startAdminMockWorker }) => {
      if (!cancelled) {
        void startAdminMockWorker();
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
