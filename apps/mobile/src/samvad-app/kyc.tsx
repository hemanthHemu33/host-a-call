import { useCallback, useEffect, useState } from 'react';
import { AppState, Linking } from 'react-native';
import { useRouter } from 'expo-router';

import { mobileRuntimeConfig } from '@/samvad/runtime';
import { isUnauthorized, samvadApi, type SamvadKycStatus } from '@/samvad/api';
import { useSamvadAuthStore } from '@/samvad/auth-state';
import { withSamvadTokenRefresh } from '@/samvad/session';

import {
  Body,
  Notice,
  PrimaryButton,
  SamvadScreen,
  SecondaryButton,
  Title,
} from './ui';

export default function KycScreen() {
  const router = useRouter();
  const session = useSamvadAuthStore((state) => state.session);
  const setSession = useSamvadAuthStore((state) => state.setSession);
  const [status, setStatus] = useState<SamvadKycStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sandbox, setSandbox] = useState(false);

  const handleError = useCallback(
    (caught: unknown, fallback: string) => {
      if (isUnauthorized(caught)) {
        setSession(null);
        router.replace('/sign-in');
        return;
      }

      setError(caught instanceof Error ? caught.message : fallback);
    },
    [router, setSession],
  );

  const refresh = useCallback(async () => {
    if (session === null) {
      router.replace('/sign-in');
      return;
    }

    if (session.user.role !== 'HOST') {
      router.replace('/account');
      return;
    }

    setLoading(true);

    try {
      const { result: nextStatus, tokens } = await withSamvadTokenRefresh(
        session.tokens,
        (accessToken) => samvadApi.getKycStatus(accessToken),
      );
      if (tokens.accessToken !== session.tokens.accessToken) {
        setSession({ ...session, tokens });
      }
      setStatus(nextStatus);
      setError(null);
    } catch (caught: unknown) {
      handleError(caught, 'Could not check verification status.');
    } finally {
      setLoading(false);
    }
  }, [handleError, router, session, setSession]);

  useEffect(() => {
    const initialRefresh = setTimeout(() => {
      void refresh();
    }, 0);
    const listener = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        void refresh();
      }
    });

    return () => {
      clearTimeout(initialRefresh);
      listener.remove();
    };
  }, [refresh]);

  const startVerification = async () => {
    if (session === null) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { result, tokens } = await withSamvadTokenRefresh(
        session.tokens,
        (accessToken) => samvadApi.initiateKyc(accessToken),
      );
      if (tokens.accessToken !== session.tokens.accessToken) {
        setSession({ ...session, tokens });
      }
      setSandbox(result.isSandbox);
      await Linking.openURL(result.authUrl);
    } catch (caught: unknown) {
      handleError(caught, 'Could not open DigiLocker.');
    } finally {
      setLoading(false);
    }
  };

  const simulate = async () => {
    if (session === null) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { tokens } = await withSamvadTokenRefresh(
        session.tokens,
        (accessToken) => samvadApi.simulateKyc(accessToken),
      );
      if (tokens.accessToken !== session.tokens.accessToken) {
        setSession({ ...session, tokens });
      }
      await refresh();
    } catch (caught: unknown) {
      handleError(caught, 'Sandbox verification failed.');
    } finally {
      setLoading(false);
    }
  };

  const verified = status?.isDigilockerVerified === true;
  const allowSimulation =
    sandbox && mobileRuntimeConfig.environment === 'development';

  return (
    <SamvadScreen>
      <Title>Verify your identity</Title>
      <Body>
        DigiLocker verifies a Host account before it can be reviewed by the
        Samvad operations team.
      </Body>
      <Notice>
        {verified
          ? 'Your DigiLocker verification is complete.'
          : (status?.message ?? 'Verification has not been completed yet.')}
      </Notice>
      {error === null ? null : <Notice error>{error}</Notice>}
      {verified ? (
        <PrimaryButton
          onPress={() => {
            router.replace('/account');
          }}
        >
          Continue to account
        </PrimaryButton>
      ) : (
        <PrimaryButton
          loading={loading}
          onPress={() => void startVerification()}
        >
          Verify with DigiLocker
        </PrimaryButton>
      )}
      <SecondaryButton disabled={loading} onPress={() => void refresh()}>
        Refresh verification status
      </SecondaryButton>
      {allowSimulation && !verified ? (
        <SecondaryButton disabled={loading} onPress={() => void simulate()}>
          Complete sandbox check
        </SecondaryButton>
      ) : null}
    </SamvadScreen>
  );
}
