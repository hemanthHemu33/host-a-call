import NetInfo from '@react-native-community/netinfo';
import {
  focusManager,
  onlineManager,
  QueryClient,
  type QueryClient as QueryClientType,
} from '@tanstack/react-query';
import { AppState } from 'react-native';

import {
  invalidationPolicy,
  normalizeApiError,
  type InvalidationScope,
} from '@connecto/domain';

export const createMobileQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      mutations: {
        retry: false,
      },
      queries: {
        refetchOnReconnect: true,
        retry: (failureCount, error) =>
          failureCount < 2 && normalizeApiError(error).retryable,
        staleTime: 30_000,
      },
    },
  });

export const installReactNativeQueryManagers = () => {
  const appStateSubscription = AppState.addEventListener('change', (status) => {
    focusManager.setFocused(status === 'active');
  });
  const unsubscribeNetInfo = NetInfo.addEventListener((state) => {
    onlineManager.setOnline(state.isConnected !== false);
  });

  return () => {
    appStateSubscription.remove();
    unsubscribeNetInfo();
  };
};

export const invalidateDomainQueries = async (
  queryClient: QueryClientType,
  scope: InvalidationScope,
) => {
  await Promise.all(
    invalidationPolicy[scope].map((queryKey) =>
      queryClient.invalidateQueries({ queryKey: [...queryKey] }),
    ),
  );
};
