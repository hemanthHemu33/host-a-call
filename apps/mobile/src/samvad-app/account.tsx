import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';

import { isUnauthorized, samvadApi } from '@/samvad/api';
import { useSamvadAuthStore } from '@/samvad/auth-state';
import { clearFirebasePhoneSession } from '@/samvad/firebase-phone';
import { clearSamvadTokens, withSamvadTokenRefresh } from '@/samvad/session';

import {
  Body,
  Notice,
  PrimaryButton,
  SamvadScreen,
  SecondaryButton,
  Title,
} from './ui';

export default function AccountScreen() {
  const router = useRouter();
  const session = useSamvadAuthStore((state) => state.session);
  const setSession = useSamvadAuthStore((state) => state.setSession);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (session === null) {
      router.replace('/sign-in');
    }
  }, [router, session]);

  const refresh = async () => {
    if (session === null) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { result: profile, tokens } = await withSamvadTokenRefresh(
        session.tokens,
        (accessToken) => samvadApi.getProfile(accessToken),
      );
      setSession({ ...profile, tokens });
    } catch (caught: unknown) {
      if (isUnauthorized(caught)) {
        setSession(null);
        router.replace('/sign-in');
        return;
      }

      setError(
        caught instanceof Error
          ? caught.message
          : 'Could not refresh your account.',
      );
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    if (session === null) {
      return;
    }

    setLoading(true);

    try {
      await withSamvadTokenRefresh(session.tokens, (accessToken) =>
        samvadApi.logout(accessToken),
      );
    } catch {
      // Logout must still clear local credentials when the network is unavailable.
    } finally {
      await Promise.all([clearSamvadTokens(), clearFirebasePhoneSession()]);
      setSession(null);
      router.replace('/sign-in');
    }
  };

  if (session === null) {
    return null;
  }

  return (
    <SamvadScreen>
      <Title>You are signed in</Title>
      <Body>{session.user.phoneNumber}</Body>
      <Notice>
        Samvad role: {session.user.role === 'HOST' ? 'Host' : 'Caller'}
      </Notice>
      {session.user.role === 'HOST' ? (
        <PrimaryButton
          onPress={() => {
            router.push('/kyc');
          }}
        >
          View identity verification
        </PrimaryButton>
      ) : null}
      {error === null ? null : <Notice error>{error}</Notice>}
      <SecondaryButton disabled={loading} onPress={() => void refresh()}>
        Refresh account
      </SecondaryButton>
      <SecondaryButton disabled={loading} onPress={() => void signOut()}>
        Sign out
      </SecondaryButton>
    </SamvadScreen>
  );
}
