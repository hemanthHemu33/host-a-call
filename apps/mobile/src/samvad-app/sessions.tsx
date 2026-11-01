import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'expo-router';

import { samvadApi, type SamvadAuthSessionSummary } from '@/samvad/api';
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
} from '@/samvad/ui';

export default function SessionsScreen() {
  const router = useRouter();
  const session = useSamvadAuthStore((state) => state.session);
  const setSession = useSamvadAuthStore((state) => state.setSession);
  const [sessions, setSessions] = useState<SamvadAuthSessionSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (session === null) return;
    setLoading(true);
    setError(null);
    try {
      const { result, tokens } = await withSamvadTokenRefresh(
        session.tokens,
        (accessToken) => samvadApi.listSessions(accessToken),
      );
      setSessions(result.sessions);
      if (tokens !== session.tokens) setSession({ ...session, tokens });
    } catch (caught: unknown) {
      setError(
        caught instanceof Error ? caught.message : 'Could not load sessions.',
      );
    } finally {
      setLoading(false);
    }
  }, [session, setSession]);

  useEffect(() => {
    if (session === null) router.replace('/sign-in');
    else {
      queueMicrotask(() => {
        void load();
      });
    }
  }, [load, router, session]);

  const revoke = async (sessionId: string) => {
    if (session === null) return;
    setLoading(true);
    setError(null);
    try {
      await withSamvadTokenRefresh(session.tokens, (accessToken) =>
        samvadApi.revokeSession(accessToken, sessionId),
      );
      await load();
    } catch (caught: unknown) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Could not revoke that session.',
      );
      setLoading(false);
    }
  };

  const logoutAll = async () => {
    if (session === null) return;
    setLoading(true);
    setError(null);
    try {
      await withSamvadTokenRefresh(session.tokens, (accessToken) =>
        samvadApi.logoutAll(accessToken),
      );
      await Promise.allSettled([
        clearSamvadTokens(),
        clearFirebasePhoneSession(),
      ]);
      setSession(null);
      router.replace('/sign-in');
    } catch (caught: unknown) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Could not log out all devices. Try again.',
      );
      setLoading(false);
    }
  };

  return (
    <SamvadScreen>
      <Title>Devices and sessions</Title>
      <Body>
        Review every active sign-in. Revoke devices you no longer recognize.
      </Body>
      {sessions.map((item) => (
        <Notice key={item.id}>
          {item.deviceName} ({item.platform})
          {item.current ? ' • This device' : ''}
          {'\n'}Last active: {new Date(item.lastSeenAt).toLocaleString()}
        </Notice>
      ))}
      {sessions
        .filter((item) => !item.current)
        .map((item) => (
          <SecondaryButton
            disabled={loading}
            key={`revoke-${item.id}`}
            onPress={() => void revoke(item.id)}
          >
            Revoke {item.deviceName}
          </SecondaryButton>
        ))}
      {error === null ? null : <Notice error>{error}</Notice>}
      <PrimaryButton loading={loading} onPress={() => void load()}>
        Refresh sessions
      </PrimaryButton>
      <SecondaryButton disabled={loading} onPress={() => void logoutAll()}>
        Log out all devices
      </SecondaryButton>
      <SecondaryButton
        onPress={() => {
          router.back();
        }}
      >
        Back
      </SecondaryButton>
    </SamvadScreen>
  );
}
