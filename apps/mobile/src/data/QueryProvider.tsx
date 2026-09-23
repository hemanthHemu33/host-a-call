import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';

import {
  createMobileQueryClient,
  installReactNativeQueryManagers,
} from './query-client';

export function MobileQueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState<QueryClient>(() => createMobileQueryClient());

  useEffect(() => installReactNativeQueryManagers(), []);

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
