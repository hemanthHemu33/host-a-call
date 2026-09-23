import { spacing } from '@connecto/design-tokens';
import type { ReactNode } from 'react';
import {
  ScrollView,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
  type Edge,
} from 'react-native-safe-area-context';

import { getLogicalHorizontalPadding, useResponsiveLayout } from './responsive';

type ScrollScreenProps = {
  bottomContentInset?: number;
  children: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  edges?: Edge[];
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function ScrollScreen({
  bottomContentInset = 0,
  children,
  contentStyle,
  edges = ['top', 'right', 'bottom', 'left'],
  style,
  testID,
}: ScrollScreenProps) {
  const insets = useSafeAreaInsets();
  const { gutter } = useResponsiveLayout();

  return (
    <SafeAreaView edges={edges} style={[styles.safeArea, style]}>
      <ScrollView
        alwaysBounceVertical={false}
        contentContainerStyle={[
          styles.content,
          {
            paddingBottom: spacing[8] + insets.bottom + bottomContentInset,
          },
          getLogicalHorizontalPadding(gutter),
          contentStyle,
        ]}
        keyboardShouldPersistTaps="handled"
        style={styles.foreground}
        testID={testID}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing[5],
    paddingTop: spacing[5],
  },
  foreground: {
    position: 'relative',
    zIndex: 1,
  },
  safeArea: {
    backgroundColor: 'transparent',
    flex: 1,
    position: 'relative',
  },
});
