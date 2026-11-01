import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { isUnauthorized, SamvadApiError, samvadApi } from '@/samvad/api';
import { routeForSamvadSession } from '@/samvad/auth-flow';
import { useSamvadAuthStore } from '@/samvad/auth-state';
import {
  clearSamvadTokens,
  loadSamvadTokens,
  withSamvadTokenRefresh,
} from '@/samvad/session';

import { Body, Notice, SamvadScreen, Title } from '@/samvad/ui';

export default function BootstrapScreen() {
  const router = useRouter();
  const setSession = useSamvadAuthStore((state) => state.setSession);
  const setAccountState = useSamvadAuthStore((state) => state.setAccountState);
  const setMaintenanceMessage = useSamvadAuthStore(
    (state) => state.setMaintenanceMessage,
  );
  const setUpdateUrl = useSamvadAuthStore((state) => state.setUpdateUrl);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const restore = async () => {
      try {
        const appConfig = await samvadApi.getAppConfig(
          Platform.OS,
          Constants.expoConfig?.version ?? '0.0.0',
        );
        if (!active) return;
        if (appConfig.maintenance.active) {
          setMaintenanceMessage(appConfig.maintenance.message);
          router.replace('/maintenance');
          return;
        }
        if (appConfig.update.required) {
          setUpdateUrl(appConfig.update.url);
          router.replace('/mandatory-update');
          return;
        }
      } catch (caught: unknown) {
        if (active) {
          setError(
            caught instanceof Error
              ? caught.message
              : 'Could not check app availability.',
          );
        }
        return;
      }

      const storedTokens = await loadSamvadTokens();

      if (storedTokens === null) {
        router.replace('/sign-in');
        return;
      }

      try {
        const { result: profile, tokens } = await withSamvadTokenRefresh(
          storedTokens,
          (accessToken) => samvadApi.getProfile(accessToken),
        );

        const session = { ...profile, tokens };

        if (active) {
          setSession(session);
          router.replace(routeForSamvadSession(session));
        }
      } catch (caught: unknown) {
        if (caught instanceof SamvadApiError && caught.accountState !== null) {
          await clearSamvadTokens();
          if (active) {
            setAccountState(caught.accountState);
            router.replace('/account-status');
          }
          return;
        }
        if (isUnauthorized(caught)) {
          await clearSamvadTokens();
          if (active) router.replace('/sign-in');
          return;
        }

        if (active) {
          setError(
            caught instanceof Error
              ? caught.message
              : 'Could not restore your session.',
          );
        }
      }
    };

    void restore();
    return () => {
      active = false;
    };
  }, [
    router,
    setAccountState,
    setMaintenanceMessage,
    setSession,
    setUpdateUrl,
  ]);

  return (
    <SamvadScreen>
      <Title>Checking your secure session</Title>
      <Body>
        Connecto is verifying your Samvad account before opening the app.
      </Body>
      {error === null ? (
        <Notice>Connecting to Samvad…</Notice>
      ) : (
        <Notice error>{error} Restart the app to sign in again.</Notice>
      )}
    </SamvadScreen>
  );
}
