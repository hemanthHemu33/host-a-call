import {
  colorRoles,
  darkColorRoles,
  gutters,
  radii,
  spacing,
  typography,
} from '@connecto/design-tokens';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fontFamily } from '@/theme/fonts';

const swatches = [
  ['Brand primary', colorRoles.brand.primary],
  ['Primary pressed', colorRoles.brand.primaryPressed],
  ['Primary soft', colorRoles.brand.primarySoft],
  ['Coral accent', colorRoles.accent.coral],
  ['Success soft', colorRoles.status.successSoft],
  ['Warning soft', colorRoles.status.warningSoft],
  ['Error soft', colorRoles.status.errorSoft],
  ['Info soft', colorRoles.status.infoSoft],
] as const;

const rankEntries = Object.entries(colorRoles.rank);

export function TokenGalleryScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        accessibilityLabel="Connecto mobile design token gallery"
      >
        <Text style={styles.eyebrow}>Design tokens</Text>
        <Text accessibilityRole="header" style={styles.title}>
          Mobile token gallery
        </Text>
        <Text style={styles.body}>
          Light and dark mobile themes share semantic roles, so screens can swap
          themes without changing component code.
        </Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Colors</Text>
          <View style={styles.grid}>
            {swatches.map(([label, value]) => (
              <View key={label} style={styles.card}>
                <View style={[styles.swatch, { backgroundColor: value }]} />
                <Text style={styles.cardTitle}>{label}</Text>
                <Text style={styles.cardMeta}>{value}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ranks</Text>
          <View style={styles.grid}>
            {rankEntries.map(([rank, value]) => (
              <View key={rank} style={styles.card}>
                <Text
                  style={[
                    styles.rank,
                    {
                      backgroundColor: value.background,
                      color: value.foreground,
                    },
                  ]}
                >
                  {rank}
                </Text>
                <Text style={styles.cardMeta}>{value.background}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Layout</Text>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Gutters</Text>
            <Text style={styles.cardMeta}>
              {gutters.mobileCompact} / {gutters.mobileRegular} /{' '}
              {gutters.mobileExpanded}
            </Text>
            <Text style={styles.cardTitle}>Radii</Text>
            <Text style={styles.cardMeta}>
              {Object.values(radii).join(' / ')}
            </Text>
            <Text style={styles.cardTitle}>Dark app background</Text>
            <Text style={styles.cardMeta}>{darkColorRoles.background.app}</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  body: {
    color: colorRoles.text.secondary,
    fontFamily: fontFamily.regular,
    fontSize: typography.mobile.body.fontSize,
    lineHeight: typography.mobile.body.lineHeight,
    marginTop: spacing[3],
  },
  card: {
    backgroundColor: colorRoles.background.surface,
    borderColor: colorRoles.background.surfaceMuted,
    borderRadius: radii.lg,
    borderWidth: 1,
    flexGrow: 1,
    minWidth: 144,
    padding: spacing[4],
  },
  cardMeta: {
    color: colorRoles.text.secondary,
    fontFamily: fontFamily.regular,
    fontSize: typography.mobile.caption.fontSize,
    lineHeight: typography.mobile.caption.lineHeight,
    marginTop: spacing[1],
  },
  cardTitle: {
    color: colorRoles.text.primary,
    fontFamily: fontFamily.bold,
    fontSize: typography.mobile.label.fontSize,
    lineHeight: typography.mobile.label.lineHeight,
    marginTop: spacing[3],
  },
  content: {
    padding: gutters.mobileExpanded,
  },
  eyebrow: {
    color: colorRoles.accent.coral,
    fontFamily: fontFamily.bold,
    fontSize: typography.mobile.label.fontSize,
    lineHeight: typography.mobile.label.lineHeight,
    textTransform: 'uppercase',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[3],
  },
  rank: {
    alignSelf: 'flex-start',
    borderRadius: radii.full,
    fontFamily: fontFamily.bold,
    fontSize: typography.mobile.caption.fontSize,
    minHeight: 32,
    overflow: 'hidden',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    textTransform: 'uppercase',
  },
  safeArea: {
    backgroundColor: 'transparent',
    flex: 1,
  },
  section: {
    marginTop: spacing[8],
  },
  sectionTitle: {
    color: colorRoles.text.primary,
    fontFamily: fontFamily.bold,
    fontSize: typography.mobile.title.fontSize,
    lineHeight: typography.mobile.title.lineHeight,
    marginBottom: spacing[3],
  },
  swatch: {
    borderRadius: radii.md,
    minHeight: 80,
  },
  title: {
    color: colorRoles.text.primary,
    fontFamily: fontFamily.bold,
    fontSize: typography.mobile.display.fontSize,
    lineHeight: typography.mobile.display.lineHeight,
    marginTop: spacing[2],
  },
});
