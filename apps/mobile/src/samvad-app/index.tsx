import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';

import { samvadApi } from '@/samvad/api';
import { routeForSamvadSession } from '@/samvad/auth-flow';
import { useSamvadAuthStore } from '@/samvad/auth-state';
import {
  clearSamvadTokens,
  loadSamvadTokens,
  withSamvadTokenRefresh,
} from '@/samvad/session';

import { Body, Notice, SamvadScreen, Title } from './ui';

export default function BootstrapScreen() {
  const router = useRouter();
  const setSession = useSamvadAuthStore((state) => state.setSession);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const restore = async () => {
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
        await clearSamvadTokens();

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
  }, [router, setSession]);

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
