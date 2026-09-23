import { colorRoles, radii, spacing } from '@connecto/design-tokens';
import { StyleSheet, Text } from 'react-native';

import { fontFamily } from '@/theme/fonts';

import { mobileRuntimeConfig } from './runtime';

export function EnvironmentBadge() {
  if (mobileRuntimeConfig.environment === 'production') {
    return null;
  }

  return (
    <Text
      accessibilityLabel={`Environment ${mobileRuntimeConfig.environment}, mock mode ${mobileRuntimeConfig.mockMode ? 'enabled' : 'disabled'}`}
      style={styles.badge}
    >
      {mobileRuntimeConfig.environment} /{' '}
      {mobileRuntimeConfig.mockMode ? 'mock' : mobileRuntimeConfig.providerMode}
    </Text>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: colorRoles.status.warningSoft,
    borderColor: colorRoles.accent.coral,
    borderRadius: radii.round,
    borderWidth: 1,
    color: colorRoles.text.primary,
    fontFamily: fontFamily.bold,
    fontSize: 12,
    marginBottom: spacing[4],
    minHeight: 24,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    textTransform: 'uppercase',
  },
});
