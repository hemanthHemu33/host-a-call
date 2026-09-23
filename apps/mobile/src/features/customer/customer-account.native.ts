import { z } from 'zod';
import * as Notifications from 'expo-notifications';

import type { NotificationResponse } from 'expo-notifications';

type NotificationScheduleInput = {
  body: string;
  deepLink: string;
  title: string;
};

const notificationResponsePayloadSchema = z.object({
  deepLink: z.string().min(1),
});

let handlerInstalled = false;

const ensureNotificationHandler = () => {
  if (handlerInstalled) {
    return true;
  }

  Notifications.setNotificationHandler({
    handleNotification: () =>
      Promise.resolve({
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
  });
  handlerInstalled = true;

  return true;
};

const extractDeepLink = (response: NotificationResponse | null | undefined) => {
  const payload = notificationResponsePayloadSchema.safeParse(
    response?.notification.request.content.data,
  );

  return payload.success ? payload.data.deepLink : null;
};

export const customerNotificationNativeBridge = {
  getInitialDeepLink() {
    try {
      return Promise.resolve(
        extractDeepLink(Notifications.getLastNotificationResponse()),
      );
    } catch {
      return Promise.resolve(null);
    }
  },
  scheduleLocalNotification: async (input: NotificationScheduleInput) => {
    if (!ensureNotificationHandler()) {
      return false;
    }

    try {
      const permission = await Notifications.getPermissionsAsync();

      if (!permission.granted) {
        return false;
      }

      await Notifications.scheduleNotificationAsync({
        content: {
          body: input.body,
          data: {
            deepLink: input.deepLink,
          },
          title: input.title,
        },
        trigger: null,
      });

      return true;
    } catch {
      return false;
    }
  },
  subscribeToDeepLinks(listener: (deepLink: string) => void) {
    try {
      const subscription =
        Notifications.addNotificationResponseReceivedListener((response) => {
          const deepLink = extractDeepLink(response);

          if (deepLink !== null) {
            listener(deepLink);
          }
        });

      return () => {
        subscription.remove();
      };
    } catch {
      return () => undefined;
    }
  },
};
