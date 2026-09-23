import { Stack } from 'expo-router';
import { StyleSheet } from 'react-native';

export default function HostOnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        animation: 'none',
        contentStyle: styles.transparent,
        headerShown: false,
      }}
    />
  );
}

const styles = StyleSheet.create({
  transparent: { backgroundColor: 'transparent' },
});
