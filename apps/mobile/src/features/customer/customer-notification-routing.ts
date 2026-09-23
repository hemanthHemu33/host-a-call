import { useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';

import { runAfterInitialRender } from '@/utils/defer';

import { customerNotificationNativeBridge } from './customer-account.native';

type RouterController = {
  push: ReturnType<typeof useRouter>['push'];
};

type RouteTarget =
  | string
  | {
      params?: Record<string, string>;
      pathname: string;
    };

const pushRoute = (router: RouterController, route: RouteTarget) => {
  router.push(route);
};

export const useCustomerNotificationRoutingBoundary = () => {
  const router = useRouter();
  const lastHandledRef = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    let unsubscribe: () => void = () => undefined;

    const task = runAfterInitialRender(() => {
      if (!active) {
        return;
      }

      customerNotificationNativeBridge
        .getInitialDeepLink()
        .then((deepLink) => {
          if (
            active &&
            deepLink !== null &&
            deepLink !== lastHandledRef.current
          ) {
            lastHandledRef.current = deepLink;
            pushRoute(router, deepLink);
          }
        })
        .catch(() => undefined);

      unsubscribe = customerNotificationNativeBridge.subscribeToDeepLinks(
        (deepLink) => {
          if (deepLink === lastHandledRef.current) {
            return;
          }

          lastHandledRef.current = deepLink;
          pushRoute(router, deepLink);
        },
      );
    });

    return () => {
      active = false;
      task.cancel();
      unsubscribe();
    };
  }, [router]);
};
