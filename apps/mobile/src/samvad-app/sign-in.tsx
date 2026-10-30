import { useState } from 'react';
import { useRouter } from 'expo-router';

import { normalizeIndianPhoneNumber } from '@/samvad/auth-flow';
import { useSamvadAuthStore } from '@/samvad/auth-state';
import { requestFirebasePhoneOtp } from '@/samvad/firebase-phone';

import { Body, Input, Notice, PrimaryButton, SamvadScreen, Title } from './ui';

export default function SignInScreen() {
  const router = useRouter();
  const setPhoneNumber = useSamvadAuthStore((state) => state.setPhoneNumber);
  const [mobileNumber, setMobileNumber] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const sendCode = async () => {
    const phoneNumber = normalizeIndianPhoneNumber(mobileNumber);

    if (phoneNumber === null) {
      setError('Enter a valid 10-digit Indian mobile number.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await requestFirebasePhoneOtp(phoneNumber);
      setPhoneNumber(phoneNumber);
      router.push('/otp');
    } catch (caught: unknown) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Could not send the verification code.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SamvadScreen>
      <Title>Sign in with your phone</Title>
      <Body>
        Firebase sends the SMS. After you enter the code, Connecto exchanges the
        Firebase identity token with Samvad.
      </Body>
      <Input
        accessibilityLabel="Indian mobile number"
        autoComplete="tel"
        keyboardType="phone-pad"
        maxLength={10}
        onChangeText={setMobileNumber}
        placeholder="10-digit mobile number"
        value={mobileNumber}
      />
      {error === null ? null : <Notice error>{error}</Notice>}
      <PrimaryButton loading={loading} onPress={() => void sendCode()}>
        Send verification code
      </PrimaryButton>
      <Notice>
        By continuing, you confirm that you are at least 18 years old.
      </Notice>
    </SamvadScreen>
  );
}
