import { useState } from 'react';
import { useRouter } from 'expo-router';

import { samvadApi } from '@/samvad/api';
import { routeForSamvadSession } from '@/samvad/auth-flow';
import { useSamvadAuthStore } from '@/samvad/auth-state';
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
} from './ui';

export default function OtpScreen() {
  const router = useRouter();
  const phoneNumber = useSamvadAuthStore((state) => state.phoneNumber);
  const setSession = useSamvadAuthStore((state) => state.setSession);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const verify = async () => {
    if (phoneNumber === null) {
      router.replace('/sign-in');
      return;
    }

    if (!/^\d{6}$/.test(code)) {
      setError('Enter the 6-digit code from Firebase.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const idToken = await confirmFirebasePhoneOtp(code);
      const session = await samvadApi.verifyFirebasePhone(phoneNumber, idToken);
      await saveSamvadTokens(session.tokens);
      setSession(session);
      router.replace(routeForSamvadSession(session));
    } catch (caught: unknown) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'The verification code was not accepted.',
      );
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    if (phoneNumber === null) {
      router.replace('/sign-in');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await requestFirebasePhoneOtp(phoneNumber);
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
        keyboardType="number-pad"
        maxLength={6}
        onChangeText={(value) => {
          setCode(value.replace(/\D/g, ''));
        }}
        placeholder="6-digit code"
        value={code}
      />
      {error === null ? null : <Notice error>{error}</Notice>}
      <PrimaryButton loading={loading} onPress={() => void verify()}>
        Verify and continue
      </PrimaryButton>
      <SecondaryButton
        onPress={() => {
          router.replace('/sign-in');
        }}
      >
        Use a different number
      </SecondaryButton>
      <SecondaryButton disabled={loading} onPress={() => void resend()}>
        Resend verification code
      </SecondaryButton>
    </SamvadScreen>
  );
}
