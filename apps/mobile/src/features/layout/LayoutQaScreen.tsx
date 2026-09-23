import {
  colorRoles,
  radii,
  spacing,
  typography,
} from '@connecto/design-tokens';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  CallScreen,
  KeyboardScreen,
  useResponsiveLayout,
} from '@/components/layout';
import { fontFamily } from '@/theme/fonts';

const longDisplayName =
  'Anjali Meghana Diamond Host With A Very Long Display Name';

export function LayoutQaScreen() {
  const [name, setName] = useState(longDisplayName);
  const [isSaving, setIsSaving] = useState(false);
  const { fontScale, isLandscape, readableContentWidth, windowClass } =
    useResponsiveLayout();

  return (
    <KeyboardScreen
      bottomAction={
        <Pressable
          accessibilityLabel="Save layout QA form"
          accessibilityRole="button"
          disabled={isSaving}
          onPress={() => {
            setIsSaving(true);
            setTimeout(() => {
              setIsSaving(false);
            }, 600);
          }}
          style={({ pressed }) => [
            styles.primaryAction,
            pressed ? styles.primaryActionPressed : null,
            isSaving ? styles.primaryActionDisabled : null,
          ]}
        >
          {isSaving ? (
            <ActivityIndicator color={colorRoles.text.inverse} />
          ) : (
            <Text style={styles.primaryActionText}>Save QA state</Text>
          )}
        </Pressable>
      }
      testID="layout-qa-screen"
    >
      <View className="rounded-xl border border-surface-muted bg-surface p-5">
        <Text accessibilityRole="header" style={styles.title}>
          Layout QA
        </Text>
        <Text style={styles.body}>
          Validates token gutters, responsive grids, text wrapping, keyboard
          overlap, and small Android safe areas without using one-off spacing.
        </Text>
      </View>

      <View style={styles.metricsGrid}>
        {[
          ['Window', windowClass],
          ['Font scale', `${fontScale.toFixed(2)}x`],
          ['Readable width', `${String(Math.round(readableContentWidth))}px`],
          ['Orientation', isLandscape ? 'landscape' : 'portrait'],
        ].map(([label, value]) => (
          <View key={label} style={styles.metricCard}>
            <Text style={styles.label}>{label}</Text>
            <Text style={styles.value}>{value}</Text>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Long name wrapping</Text>
        <Text maxFontSizeMultiplier={2} style={styles.longName}>
          {name}
        </Text>
        <Text style={styles.body}>
          This card must wrap instead of clipping at 200% font scaling.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Keyboard-safe form</Text>
        <TextInput
          accessibilityLabel="Layout QA long name"
          onChangeText={setName}
          placeholder="Enter a long display name"
          placeholderTextColor={colorRoles.text.tertiary}
          returnKeyType="done"
          style={styles.input}
          value={name}
        />
        <Text style={styles.body}>
          The primary bottom action remains reachable while this input is
          focused.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Landscape call layout</Text>
        <View style={styles.callPreview}>
          <CallScreen
            controls={
              <View style={styles.callControls}>
                <View style={styles.callControlDot} />
                <View style={styles.callControlDot} />
                <View style={styles.callEndDot} />
              </View>
            }
            edges={[]}
          >
            <View style={styles.videoTile}>
              <Text style={styles.videoText}>Video preview</Text>
              <Text style={styles.videoCaption}>
                Uses StyleSheet sizing for orientation-sensitive call UI.
              </Text>
            </View>
          </CallScreen>
        </View>
      </View>

      <View style={styles.gridDemo}>
        {['16', '20', '24'].map((gutter) => (
          <View key={gutter} style={styles.gutterTile}>
            <Text style={styles.label}>{gutter}px gutter</Text>
          </View>
        ))}
      </View>
    </KeyboardScreen>
  );
}

const styles = StyleSheet.create({
  body: {
    color: colorRoles.text.secondary,
    fontFamily: fontFamily.regular,
    fontSize: typography.mobile.body.fontSize,
    lineHeight: typography.mobile.body.lineHeight,
  },
  callControlDot: {
    backgroundColor: colorRoles.call.controlSurface,
    borderRadius: radii.full,
    height: spacing[9],
    width: spacing[9],
  },
  callControls: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  callEndDot: {
    backgroundColor: colorRoles.status.error,
    borderRadius: radii.full,
    height: spacing[9],
    width: spacing[9],
  },
  callPreview: {
    borderRadius: radii.xl,
    height: 260,
    overflow: 'hidden',
  },
  card: {
    backgroundColor: colorRoles.background.surface,
    borderColor: colorRoles.background.surfaceMuted,
    borderRadius: radii.xl,
    borderWidth: 1,
    gap: spacing[3],
    padding: spacing[5],
  },
  gridDemo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[3],
  },
  gutterTile: {
    backgroundColor: colorRoles.brand.primarySoft,
    borderRadius: radii.md,
    minHeight: 64,
    minWidth: 96,
    padding: spacing[4],
  },
  input: {
    backgroundColor: colorRoles.background.elevated,
    borderColor: colorRoles.brand.primary,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colorRoles.text.primary,
    fontFamily: fontFamily.regular,
    fontSize: typography.mobile.body.fontSize,
    lineHeight: typography.mobile.body.lineHeight,
    minHeight: 52,
    paddingHorizontal: spacing[4],
  },
  label: {
    color: colorRoles.text.secondary,
    fontFamily: fontFamily.medium,
    fontSize: typography.mobile.label.fontSize,
    lineHeight: typography.mobile.label.lineHeight,
  },
  longName: {
    color: colorRoles.text.primary,
    fontFamily: fontFamily.bold,
    fontSize: typography.mobile.title.fontSize,
    lineHeight: typography.mobile.title.lineHeight,
  },
  metricCard: {
    backgroundColor: colorRoles.background.surface,
    borderColor: colorRoles.background.surfaceMuted,
    borderRadius: radii.lg,
    borderWidth: 1,
    flexBasis: '47%',
    flexGrow: 1,
    gap: spacing[2],
    padding: spacing[4],
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[3],
  },
  primaryAction: {
    alignItems: 'center',
    backgroundColor: colorRoles.brand.primary,
    borderRadius: radii.lg,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: spacing[5],
  },
  primaryActionDisabled: {
    opacity: 0.48,
  },
  primaryActionPressed: {
    backgroundColor: colorRoles.brand.primaryPressed,
  },
  primaryActionText: {
    color: colorRoles.text.inverse,
    fontFamily: fontFamily.bold,
    fontSize: typography.mobile.body.fontSize,
    lineHeight: typography.mobile.body.lineHeight,
  },
  sectionTitle: {
    color: colorRoles.text.primary,
    fontFamily: fontFamily.semibold,
    fontSize: typography.mobile.title.fontSize,
    lineHeight: typography.mobile.title.lineHeight,
  },
  title: {
    color: colorRoles.text.primary,
    fontFamily: fontFamily.bold,
    fontSize: typography.mobile.display.fontSize,
    lineHeight: typography.mobile.display.lineHeight,
  },
  value: {
    color: colorRoles.text.primary,
    fontFamily: fontFamily.bold,
    fontSize: typography.mobile.body.fontSize,
    lineHeight: typography.mobile.body.lineHeight,
  },
  videoCaption: {
    color: colorRoles.text.inverse,
    fontFamily: fontFamily.regular,
    fontSize: typography.mobile.caption.fontSize,
    lineHeight: typography.mobile.caption.lineHeight,
    opacity: 0.72,
  },
  videoText: {
    color: colorRoles.text.inverse,
    fontFamily: fontFamily.bold,
    fontSize: typography.mobile.title.fontSize,
    lineHeight: typography.mobile.title.lineHeight,
  },
  videoTile: {
    backgroundColor: colorRoles.call.backgroundStart,
    borderRadius: radii.lg,
    flex: 1,
    gap: spacing[2],
    justifyContent: 'flex-end',
    padding: spacing[4],
  },
});
