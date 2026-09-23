import { spacing } from '@connecto/design-tokens';
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { getLogicalHorizontalPadding, useResponsiveLayout } from './responsive';

type ScreenProps = {
  children: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  edges?: Edge[];
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function Screen({
  children,
  contentStyle,
  edges = ['top', 'right', 'bottom', 'left'],
  style,
  testID,
}: ScreenProps) {
  const { gutter } = useResponsiveLayout();

  return (
    <SafeAreaView
      edges={edges}
      style={[styles.safeArea, style]}
      testID={testID}
    >
      <View
        style={[
          styles.content,
          styles.foreground,
          getLogicalHorizontalPadding(gutter),
          contentStyle,
        ]}
      >
        {children}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingVertical: spacing[5],
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
