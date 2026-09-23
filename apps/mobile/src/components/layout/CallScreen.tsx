import { spacing } from '@connecto/design-tokens';
import type { ReactNode } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { GlassSurface } from '@/components/ui/surfaces';

import { useResponsiveLayout } from './responsive';

type CallScreenProps = {
  callTintColor?: string;
  children: ReactNode;
  controlsBorderColor?: string;
  controlsOverlayColor?: string;
  controlsTint?: 'dark' | 'light';
  controls?: ReactNode;
  edges?: Edge[];
  hideControls?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function CallScreen({
  callTintColor = 'rgba(36,17,27,0.76)',
  children,
  controls,
  controlsBorderColor = 'rgba(255,255,255,0.76)',
  controlsOverlayColor = 'rgba(31,20,32,0.84)',
  controlsTint = 'dark',
  edges = ['top', 'right', 'bottom', 'left'],
  hideControls = false,
  style,
  testID,
}: CallScreenProps) {
  const { isLandscape } = useResponsiveLayout();
  const scrollableContent = controls !== undefined;

  return (
    <SafeAreaView
      edges={edges}
      style={[styles.safeArea, style]}
      testID={testID}
    >
      <View
        pointerEvents="none"
        style={[styles.callTint, { backgroundColor: callTintColor }]}
      />
      <View style={[styles.stage, isLandscape ? styles.stageLandscape : null]}>
        {scrollableContent ? (
          <ScrollView
            bounces
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            style={styles.content}
          >
            {children}
          </ScrollView>
        ) : (
          <View style={styles.content}>{children}</View>
        )}
        {controls === undefined || hideControls ? null : (
          <GlassSurface
            blurIntensity={28}
            borderColor={controlsBorderColor}
            overlayColor={controlsOverlayColor}
            radius={24}
            shadow="floating"
            style={[
              styles.controls,
              isLandscape ? styles.controlsLandscape : null,
            ]}
            tint={controlsTint}
            variant="floating"
          >
            {controls}
          </GlassSurface>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    minHeight: 0,
  },
  controls: {
    borderRadius: 24,
    flexShrink: 0,
    marginBottom: spacing[3],
    marginHorizontal: spacing[3],
    padding: spacing[3],
  },
  controlsLandscape: {
    alignSelf: 'center',
    marginLeft: spacing[4],
  },
  safeArea: {
    backgroundColor: 'transparent',
    flex: 1,
    position: 'relative',
  },
  callTint: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(36,17,27,0.76)',
  },
  scrollContent: {
    flexGrow: 1,
    position: 'relative',
  },
  stage: {
    flex: 1,
    gap: spacing[4],
    position: 'relative',
    zIndex: 1,
  },
  stageLandscape: {
    flexDirection: 'row',
  },
});
