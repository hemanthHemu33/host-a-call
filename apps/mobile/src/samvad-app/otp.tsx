import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';

import { SamvadApiError, samvadApi } from '@/samvad/api';
import { routeForSamvadSession } from '@/samvad/auth-flow';
import { useSamvadAuthStore } from '@/samvad/auth-state';
import { getSamvadDeviceContext } from '@/samvad/device';
import {
  confirmFirebasePhoneOtp,
  requestFirebasePhoneOtp,
} from '@/samvad/firebase-phone';
import { saveSamvadTokens } from '@/samvad/session';

import {
  Body,
  Input,
  Notice,
  PrimaryButton,
  SamvadScreen,
  SecondaryButton,
  Title,
} from '@/samvad/ui';

const maximumInvalidAttempts = 3;
const maximumResends = 3;

export default function OtpScreen() {
  const router = useRouter();
  const phoneNumber = useSamvadAuthStore((state) => state.phoneNumber);
  const challenge = useSamvadAuthStore((state) => state.otpChallenge);
  const setAccountState = useSamvadAuthStore((state) => state.setAccountState);
  const setChallenge = useSamvadAuthStore((state) => state.setOtpChallenge);
  const setSession = useSamvadAuthStore((state) => state.setSession);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [nowMs, setNowMs] = useState(challenge?.sentAtMs ?? 0);
  const [verifiedIdToken, setVerifiedIdToken] = useState<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => {
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (phoneNumber === null || challenge === null) router.replace('/sign-in');
  }, [challenge, phoneNumber, router]);

  const resendRemainingSeconds = useMemo(() => {
    if (challenge === null) return 0;
    const elapsed = Math.floor((nowMs - challenge.sentAtMs) / 1000);
    return Math.max(0, challenge.resendAfterSeconds - elapsed);
  }, [challenge, nowMs]);

  const verify = async () => {
    if (phoneNumber === null || challenge === null) {
      router.replace('/sign-in');
      return;
    }
    if (challenge.invalidAttempts >= maximumInvalidAttempts) {
      setError('Too many invalid attempts. Request a new code to continue.');
      return;
    }
    if (!/^\d{6}$/.test(code)) {
      setError('Enter the complete 6-digit code.');
      return;
    }

    setLoading(true);
    setError(null);
    let idToken = verifiedIdToken;

    if (idToken === null) {
      try {
        idToken = await confirmFirebasePhoneOtp(code);
        setVerifiedIdToken(idToken);
      } catch (caught: unknown) {
        const invalidAttempts = Math.min(
          maximumInvalidAttempts,
          challenge.invalidAttempts + 1,
        );
        setChallenge({ ...challenge, invalidAttempts });
        setError(
          invalidAttempts >= maximumInvalidAttempts
            ? 'Too many invalid attempts. Request a new code to continue.'
            : caught instanceof Error
              ? `${caught.message} ${String(maximumInvalidAttempts - invalidAttempts)} attempt(s) remaining.`
              : 'The verification code was not accepted.',
        );
        setLoading(false);
        return;
      }
    }

    try {
      const device = await getSamvadDeviceContext();
      const session = await samvadApi.verifyFirebasePhone(
        phoneNumber,
        idToken,
        device,
      );
      await saveSamvadTokens(session.tokens);
      setSession(session);
      setChallenge(null);
      router.replace(routeForSamvadSession(session));
    } catch (caught: unknown) {
      if (caught instanceof SamvadApiError && caught.accountState !== null) {
        setAccountState(caught.accountState);
        router.replace('/account-status');
        return;
      }
      setError(
        caught instanceof Error
          ? caught.message
          : 'The identity exchange could not be completed.',
      );
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    if (phoneNumber === null || challenge === null) {
      router.replace('/sign-in');
      return;
    }
    if (resendRemainingSeconds > 0 || challenge.resendCount >= maximumResends) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const reservation = await samvadApi.requestOtp(phoneNumber);
      await requestFirebasePhoneOtp(phoneNumber);
      setChallenge({
        ...reservation,
        invalidAttempts: 0,
        phoneNumber,
        resendCount: challenge.resendCount + 1,
        sentAtMs: Date.now(),
      });
      setVerifiedIdToken(null);
      setCode('');
    } catch (caught: unknown) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Could not resend the verification code.',
      );
    } finally {
      setLoading(false);
    }
  };

  const attemptsRemaining =
    maximumInvalidAttempts - (challenge?.invalidAttempts ?? 0);
  const resendsRemaining = maximumResends - (challenge?.resendCount ?? 0);

  return (
    <SamvadScreen>
      <Title>Enter your verification code</Title>
      <Body>
        {phoneNumber === null
          ? 'Your sign-in session is missing.'
          : `Firebase sent a code to ${phoneNumber}.`}
      </Body>
      <Input
        accessibilityLabel="Six digit verification code"
        editable={!loading && attemptsRemaining > 0}
        keyboardType="number-pad"
        maxLength={6}
        onChangeText={(value) => {
          setCode(value.replace(/\D/g, ''));
          setError(null);
        }}
        placeholder="6-digit code"
        value={code}
      />
      <Notice>
        {String(attemptsRemaining)} verification attempt(s) and{' '}
        {String(resendsRemaining)} resend(s) remaining.
      </Notice>
      {error === null ? null : <Notice error>{error}</Notice>}
      <PrimaryButton
        disabled={attemptsRemaining === 0}
        loading={loading}
        onPress={() => void verify()}
      >
        Verify and continue
      </PrimaryButton>
      <SecondaryButton
        onPress={() => {
          setChallenge(null);
          router.replace('/sign-in');
        }}
      >
        Use a different number
      </SecondaryButton>
      <SecondaryButton
        disabled={
          loading || resendRemainingSeconds > 0 || resendsRemaining === 0
        }
        onPress={() => void resend()}
      >
        {resendsRemaining === 0
          ? 'Resend limit reached'
          : resendRemainingSeconds > 0
            ? `Resend in ${String(resendRemainingSeconds)}s`
            : 'Resend verification code'}
      </SecondaryButton>
    </SamvadScreen>
  );
}
