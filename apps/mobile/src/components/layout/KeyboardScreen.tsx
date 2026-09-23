import { spacing } from '@connecto/design-tokens';
import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
  type Edge,
} from 'react-native-safe-area-context';

import { GlassSurface } from '@/components/ui/surfaces';

import { getLogicalHorizontalPadding, useResponsiveLayout } from './responsive';

type KeyboardScreenProps = {
  bottomAction?: ReactNode;
  children: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  edges?: Edge[];
  reserveBottomActionSpace?: boolean;
  scrollEnabled?: boolean;
  testID?: string;
};

export function KeyboardScreen({
  bottomAction,
  children,
  contentStyle,
  edges = ['top', 'right', 'bottom', 'left'],
  reserveBottomActionSpace = true,
  scrollEnabled = true,
  testID,
}: KeyboardScreenProps) {
  const insets = useSafeAreaInsets();
  const { gutter } = useResponsiveLayout();

  return (
    <SafeAreaView edges={edges} style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={[styles.keyboard, styles.foreground]}
      >
        <ScrollView
          contentContainerStyle={[
            styles.content,
            {
              paddingBottom:
                bottomAction === undefined
                  ? spacing[8] + insets.bottom
                  : reserveBottomActionSpace
                    ? spacing[14] + insets.bottom + 42
                    : spacing[3],
            },
            getLogicalHorizontalPadding(gutter),
            contentStyle,
          ]}
          bounces={scrollEnabled}
          keyboardShouldPersistTaps="handled"
          scrollEnabled={scrollEnabled}
          showsVerticalScrollIndicator={scrollEnabled}
          style={styles.scroll}
          testID={testID}
        >
          {children}
        </ScrollView>
        {bottomAction === undefined ? null : (
          <View
            style={[
              styles.bottomAction,
              {
                paddingBottom: Math.max(insets.bottom, spacing[3]),
              },
              getLogicalHorizontalPadding(gutter),
            ]}
          >
            <GlassSurface
              radius={30}
              shadow="floating"
              style={styles.bottomActionSurface}
              variant="floating"
            >
              {bottomAction}
            </GlassSurface>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  bottomAction: {
    paddingTop: spacing[3],
  },
  bottomActionSurface: {
    borderRadius: 30,
    padding: spacing[3],
  },
  content: {
    gap: spacing[5],
    paddingTop: spacing[5],
  },
  foreground: {
    position: 'relative',
    zIndex: 1,
  },
  keyboard: {
    flex: 1,
  },
  safeArea: {
    backgroundColor: 'transparent',
    flex: 1,
    position: 'relative',
  },
  scroll: {
    flex: 1,
  },
});
