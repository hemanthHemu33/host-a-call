import { spacing, typography } from '@connecto/design-tokens';
import { StyleSheet, Text } from 'react-native';

import { ScrollScreen } from '@/components/layout';
import { GlassSurface } from '@/components/ui/surfaces';
import { ui } from '@/components/ui/theme';
import { fontFamily } from '@/theme/fonts';

import { appRoutes, type AppRouteId } from './routes';

type RouteShellScreenProps = {
  routeId: AppRouteId;
};

function RouteShellScreen({ routeId }: RouteShellScreenProps) {
  const route = appRoutes[routeId];
  const access =
    route.access.kind === 'public'
      ? 'Public route'
      : `Requires ${route.access.roles.join(' or ')} session`;

  return (
    <ScrollScreen contentStyle={styles.screenContent}>
      <GlassSurface style={styles.shell} variant="strong">
        <Text style={styles.eyebrow}>Navigation route</Text>
        <Text
          accessibilityRole="header"
          maxFontSizeMultiplier={2}
          style={styles.title}
        >
          {route.title}
        </Text>
        <Text style={styles.body}>{access}</Text>
        <Text style={styles.meta}>Back policy: {route.backPolicy}</Text>
      </GlassSurface>
    </ScrollScreen>
  );
}

export const createRouteScreen = (routeId: AppRouteId) =>
  function GeneratedRouteScreen() {
    return <RouteShellScreen routeId={routeId} />;
  };

const styles = StyleSheet.create({
  body: {
    color: ui.color.text.secondary,
    fontFamily: fontFamily.regular,
    fontSize: typography.mobile.body.fontSize,
    lineHeight: typography.mobile.body.lineHeight,
    marginTop: spacing[3],
  },
  eyebrow: {
    color: ui.color.accent.coral,
    fontFamily: fontFamily.bold,
    fontSize: typography.mobile.label.fontSize,
    lineHeight: typography.mobile.label.lineHeight,
    marginBottom: spacing[3],
    textTransform: 'uppercase',
  },
  meta: {
    color: ui.color.text.tertiary,
    fontFamily: fontFamily.regular,
    fontSize: typography.mobile.caption.fontSize,
    lineHeight: typography.mobile.caption.lineHeight,
    marginTop: spacing[4],
  },
  screenContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  shell: {
    borderRadius: ui.radii.xxl,
    padding: spacing[5],
  },
  title: {
    color: ui.color.text.primary,
    fontFamily: fontFamily.bold,
    fontSize: typography.mobile.title.fontSize,
    lineHeight: typography.mobile.title.lineHeight,
  },
});
