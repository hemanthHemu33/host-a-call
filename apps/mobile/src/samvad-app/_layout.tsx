import { Stack, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useSamvadAuthStore } from '@/samvad/auth-state';

export default function SamvadLayout() {
  const router = useRouter();
  const accountState = useSamvadAuthStore((state) => state.accountState);

  useEffect(() => {
    if (accountState !== null && accountState.status !== 'ACTIVE') {
      router.replace('/account-status');
    }
  }, [accountState, router]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }} />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
