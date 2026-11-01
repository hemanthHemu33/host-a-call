import { useRouter } from 'expo-router';

import { useSamvadAuthStore } from '@/samvad/auth-state';

import { Body, PrimaryButton, SamvadScreen, Title } from '@/samvad/ui';

export default function MaintenanceScreen() {
  const router = useRouter();
  const message = useSamvadAuthStore((state) => state.maintenanceMessage);
  return (
    <SamvadScreen>
      <Title>Connecto is under maintenance</Title>
      <Body>{message ?? 'Please try again in a little while.'}</Body>
      <PrimaryButton
        onPress={() => {
          router.replace('/');
        }}
      >
        Check again
      </PrimaryButton>
    </SamvadScreen>
  );
}
