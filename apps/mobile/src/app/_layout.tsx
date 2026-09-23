import '../../global.css';

import { NavigationBar } from 'expo-navigation-bar';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import {
  hydrateNavigationAuth,
  lockNavigationTarget,
  releaseNavigationTarget,
  rememberSafeRoute,
  resolveNavigationDecision,
} from '@/navigation/navigation-store';
import { useRouteAnalytics } from '@/navigation/useRouteAnalytics';
import { MotionProvider } from '@/motion/MotionProvider';
import { MobileQueryProvider } from '@/data/QueryProvider';
import { fontAssets } from '@/theme/fonts';
import { loadPersistedAuthSnapshot } from '@/features/auth/auth.storage';
import { useCustomerNotificationRoutingBoundary } from '@/features/customer/customer-notification-routing';
import { runAfterInitialRender } from '@/utils/defer';
import { AppGlassBackground } from '@/components/layout/AppGlassBackground';

const routeKeyFromSegments = (segments: string[]) =>
  segments.length === 0 ? '/' : `/${segments.join('/')}`;

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const routeKey = routeKeyFromSegments(segments);
  useFonts(fontAssets);

  useRouteAnalytics(routeKey);
  useCustomerNotificationRoutingBoundary();

  useEffect(() => {
    const task = runAfterInitialRender(() => {
      SplashScreen.hideAsync().catch(() => undefined);
    });

    return () => {
      task.cancel();
    };
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'android') {
      return;
    }

    let active = true;
    const task = runAfterInitialRender(() => {
      if (!active) {
        return;
      }

      try {
        NavigationBar.setStyle('dark');
      } catch {
        // expo-navigation-bar can be unavailable in some Android runtime builds.
      }
    });

    return () => {
      active = false;
      task.cancel();
    };
  }, []);

  useEffect(() => {
    let active = true;
    const task = runAfterInitialRender(() => {
      loadPersistedAuthSnapshot()
        .then((snapshot) => {
          if (active) {
            hydrateNavigationAuth(snapshot);
          }
        })
        .catch(() => undefined);
    });

    return () => {
      active = false;
      task.cancel();
    };
  }, []);

  useEffect(() => {
    const decision = resolveNavigationDecision(routeKey);

    if (decision.kind === 'allow') {
      rememberSafeRoute(routeKey);
      return undefined;
    }

    if (decision.redirectTo === routeKey) {
      return undefined;
    }

    if (!lockNavigationTarget(decision.redirectTo)) {
      return undefined;
    }

    router.replace(decision.redirectTo);

    const timer = setTimeout(() => {
      releaseNavigationTarget(decision.redirectTo);
    }, 0);

    return () => {
      clearTimeout(timer);
      releaseNavigationTarget(decision.redirectTo);
    };
  }, [routeKey, router]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <MotionProvider>
          <View style={styles.root}>
            <AppGlassBackground />
            <MobileQueryProvider>
              <View style={styles.foreground}>
                <StatusBar style="dark" />
                <Stack
                  screenOptions={{
                    animation: 'fade',
                    animationDuration: 160,
                    contentStyle: styles.transparent,
                    freezeOnBlur: true,
                    headerShown: false,
                  }}
                />
              </View>
            </MobileQueryProvider>
          </View>
        </MotionProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    position: 'relative',
  },
  foreground: {
    flex: 1,
    position: 'relative',
    zIndex: 1,
  },
  transparent: {
    backgroundColor: 'transparent',
  },
});
