import { useState } from 'react';
import {
  AlertCircle,
  Bell,
  CheckCircle2,
  IndianRupee,
  Phone,
  RefreshCw,
  Star,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Image,
  Platform,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
  type StyleProp,
  type ViewProps,
  type ViewStyle,
} from 'react-native';
import { SvgXml } from 'react-native-svg';

import { resolveCustomerAvatarSource } from '@/assets/avatars/customer-avatars';

import { Button } from './controls';
import { GlassBlurLayer, type GlassBlurTint } from './GlassBlurLayer';
import { ui } from './theme';
import type { ComponentChildren, IconComponent, UiStyleProps } from './types';

export type GlassSurfaceVariant =
  'floating' | 'modal' | 'standard' | 'strong' | 'subtle';
type GlassSurfaceShadow = 'card' | 'floating' | 'modal' | 'none' | 'soft';

const glassOuterStyleKeys = new Set([
  'alignSelf',
  'aspectRatio',
  'bottom',
  'display',
  'elevation',
  'end',
  'flex',
  'flexBasis',
  'flexGrow',
  'flexShrink',
  'left',
  'margin',
  'marginBottom',
  'marginEnd',
  'marginHorizontal',
  'marginLeft',
  'marginRight',
  'marginStart',
  'marginTop',
  'marginVertical',
  'maxWidth',
  'minWidth',
  'opacity',
  'position',
  'right',
  'shadowColor',
  'shadowOffset',
  'shadowOpacity',
  'shadowRadius',
  'start',
  'top',
  'transform',
  'width',
  'zIndex',
]);

const glassIgnoredStyleKeys = new Set([
  'backgroundColor',
  'borderBottomColor',
  'borderBottomWidth',
  'borderColor',
  'borderEndColor',
  'borderEndWidth',
  'borderLeftColor',
  'borderLeftWidth',
  'borderRightColor',
  'borderRightWidth',
  'borderStartColor',
  'borderStartWidth',
  'borderTopColor',
  'borderTopWidth',
  'borderWidth',
]);

type GlassSurfaceProps = ComponentChildren & {
  accessibilityLiveRegion?: ViewProps['accessibilityLiveRegion'];
  accessibilityRole?: ViewProps['accessibilityRole'];
  border?: boolean;
  borderColor?: string | undefined;
  blurIntensity?: number | undefined;
  contentStyle?: StyleProp<ViewStyle>;
  highlight?: boolean;
  overlayColor?: string | undefined;
  pointerEvents?: ViewProps['pointerEvents'];
  radius?: number;
  shadow?: GlassSurfaceShadow;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  tint?: GlassBlurTint;
  variant?: GlassSurfaceVariant;
};

type GlassBackdropProps = {
  border?: boolean;
  borderColor?: string | undefined;
  blurIntensity?: number | undefined;
  highlight?: boolean;
  overlayColor?: string | undefined;
  radius?: number;
  style?: StyleProp<ViewStyle>;
  tint?: GlassBlurTint;
  variant?: GlassSurfaceVariant;
};

export function GlassBackdrop({
  border = true,
  borderColor,
  blurIntensity,
  highlight = true,
  overlayColor,
  radius = ui.radii.xxl,
  style,
  tint = 'light',
  variant = 'standard',
}: GlassBackdropProps) {
  const intensity = blurIntensity ?? ui.blur[variant];

  if (Platform.OS === 'android') {
    return (
      <View
        pointerEvents="none"
        style={[
          styles.glassBackdrop,
          androidGlassVariantStyles[variant],
          overlayColor === undefined ? null : { backgroundColor: overlayColor },
          border ? null : styles.noBorder,
          borderColor === undefined ? null : { borderColor },
          { borderRadius: radius },
          style,
        ]}
      >
        {highlight ? (
          <View style={[styles.glassEdge, { borderRadius: radius }]} />
        ) : null}
      </View>
    );
  }

  return (
    <View
      pointerEvents="none"
      style={[styles.glassBackdrop, { borderRadius: radius }, style]}
    >
      <GlassBlurLayer
        intensity={intensity}
        style={StyleSheet.absoluteFill}
        tint={tint}
      />
      <View
        style={[
          StyleSheet.absoluteFill,
          glassVariantStyles[variant],
          overlayColor === undefined ? null : { backgroundColor: overlayColor },
          border ? null : styles.noBorder,
          borderColor === undefined ? null : { borderColor },
          { borderRadius: radius },
        ]}
      />
      {highlight ? (
        <LinearGradient
          colors={[ui.glass.highlight, 'rgba(255,255,255,0.06)', 'transparent']}
          end={{ x: 0.55, y: 1 }}
          locations={[0, 0.38, 1]}
          start={{ x: 0.35, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      {highlight ? (
        <View style={[styles.glassEdge, { borderRadius: radius }]} />
      ) : null}
    </View>
  );
}

export function GlassSurface({
  accessibilityLiveRegion,
  accessibilityRole,
  border = true,
  borderColor,
  blurIntensity,
  children,
  contentStyle,
  highlight = true,
  overlayColor,
  pointerEvents,
  radius,
  shadow = 'card',
  style,
  testID,
  tint = 'light',
  variant = 'standard',
}: GlassSurfaceProps) {
  const {
    content: localContentStyle,
    outer: localOuterStyle,
    radius: styleRadius,
  } = splitGlassStyle(style);
  const resolvedRadius = radius ?? styleRadius ?? ui.radii.xxl;

  if (Platform.OS === 'android') {
    return (
      <View
        accessibilityLiveRegion={accessibilityLiveRegion}
        accessibilityRole={accessibilityRole}
        pointerEvents={pointerEvents}
        style={[
          styles.glassSurface,
          androidGlassVariantStyles[variant],
          overlayColor === undefined ? null : { backgroundColor: overlayColor },
          border ? null : styles.noBorder,
          borderColor === undefined ? null : { borderColor },
          { borderRadius: resolvedRadius },
          localOuterStyle,
          styles.glassContent,
          localContentStyle,
          contentStyle ?? null,
          styles.androidGlassNoElevation,
        ]}
        testID={testID}
      >
        {children}
      </View>
    );
  }

  return (
    <View
      accessibilityLiveRegion={accessibilityLiveRegion}
      accessibilityRole={accessibilityRole}
      style={[
        styles.glassSurface,
        glassShadowStyles[shadow],
        { borderRadius: resolvedRadius },
        localOuterStyle,
      ]}
      pointerEvents={pointerEvents}
      testID={testID}
    >
      <View style={[styles.glassClip, { borderRadius: resolvedRadius }]}>
        <GlassBackdrop
          border={border}
          borderColor={borderColor}
          blurIntensity={blurIntensity}
          highlight={highlight}
          overlayColor={overlayColor}
          radius={resolvedRadius}
          tint={tint}
          variant={variant}
        />
        <View
          style={[
            styles.glassContent,
            { borderRadius: resolvedRadius },
            localContentStyle,
            contentStyle ?? null,
          ]}
        >
          {children}
        </View>
      </View>
    </View>
  );
}

function splitGlassStyle(style: StyleProp<ViewStyle>): {
  content: ViewStyle;
  outer: ViewStyle;
  radius?: number;
} {
  if (style === undefined) {
    return { content: {}, outer: {} };
  }

  const flatStyle = StyleSheet.flatten(style);
  const content: Record<string, unknown> = {};
  const outer: Record<string, unknown> = {};
  let radius: number | undefined;

  for (const [key, value] of Object.entries(flatStyle)) {
    if (value === undefined) {
      continue;
    }

    if (key === 'borderRadius' && typeof value === 'number') {
      radius = value;
      continue;
    }

    if (glassOuterStyleKeys.has(key)) {
      outer[key] = value;
      continue;
    }

    if (glassIgnoredStyleKeys.has(key)) {
      continue;
    }

    content[key] = value;
  }

  return {
    content,
    outer,
    ...(radius === undefined ? {} : { radius }),
  };
}

type CardProps = ComponentChildren &
  UiStyleProps & {
    variant?: GlassSurfaceVariant;
  };

export function Card({ children, style, variant = 'standard' }: CardProps) {
  const borderColor = StyleSheet.flatten([style]).borderColor;

  return (
    <GlassSurface
      borderColor={typeof borderColor === 'string' ? borderColor : undefined}
      style={style}
      variant={variant}
    >
      {children}
    </GlassSurface>
  );
}

type AvatarProps = {
  label: string;
  size?: 'lg' | 'md' | 'sm' | number;
  source?: ImageSourcePropType;
  testID?: string;
};

export function Avatar({ label, size = 'md', source, testID }: AvatarProps) {
  const avatarSize =
    typeof size === 'number'
      ? size
      : size === 'lg'
        ? 72
        : size === 'sm'
          ? 36
          : 52;
  const sourceUri =
    typeof source === 'object' && !Array.isArray(source)
      ? source.uri
      : undefined;
  const resolvedAssetSource = resolveCustomerAvatarSource(sourceUri);
  const imageSource = resolvedAssetSource ?? source;
  const sourceKey = sourceUri ?? JSON.stringify(source);
  const [failedSourceKey, setFailedSourceKey] = useState<string | undefined>();
  const imageFailed = failedSourceKey === sourceKey;
  const svgMarkup =
    resolvedAssetSource === undefined ? decodeSvgDataUri(sourceUri) : null;
  const initials = label
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  return (
    <View
      accessibilityLabel={`${label} avatar`}
      style={[styles.avatar, { height: avatarSize, width: avatarSize }]}
      testID={testID}
    >
      {imageSource === undefined || imageFailed ? (
        <Text
          style={[
            styles.avatarText,
            {
              fontSize: Math.max(ui.type.body.fontSize, avatarSize * 0.34),
              lineHeight: Math.max(ui.type.body.lineHeight, avatarSize * 0.4),
            },
          ]}
        >
          {initials}
        </Text>
      ) : svgMarkup !== null ? (
        <SvgXml height="100%" width="100%" xml={svgMarkup} />
      ) : (
        <Image
          accessibilityIgnoresInvertColors
          onError={() => {
            setFailedSourceKey(sourceKey);
          }}
          source={imageSource}
          style={styles.avatarImage}
        />
      )}
    </View>
  );
}

function decodeSvgDataUri(uri: string | undefined) {
  const prefix = 'data:image/svg+xml;utf8,';

  if (uri === undefined || !uri.startsWith(prefix)) {
    return null;
  }

  try {
    return decodeURIComponent(uri.slice(prefix.length));
  } catch {
    return null;
  }
}

type RankBadgeProps = {
  rank: 'bronze' | 'diamond' | 'gold' | 'platinum' | 'silver';
};

export function RankBadge({ rank }: RankBadgeProps) {
  const token = ui.color.rank[rank];

  return (
    <View
      accessibilityLabel={`${rank} rank`}
      style={[styles.badge, { backgroundColor: token.background }]}
    >
      <Star color={token.foreground} size={14} />
      <Text style={[styles.badgeText, { color: token.foreground }]}>
        {rank}
      </Text>
    </View>
  );
}

type StatusBadgeProps = {
  label: string;
  tone?: 'error' | 'info' | 'success' | 'warning';
};

export function StatusBadge({ label, tone = 'info' }: StatusBadgeProps) {
  const color = ui.color.status[tone];
  const soft = ui.color.status[`${tone}Soft`];

  return (
    <View style={[styles.badge, { backgroundColor: soft }]}>
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

type MetricCardProps = {
  label: string;
  value: string;
  trend?: string;
};

export function MetricCard({ label, trend, value }: MetricCardProps) {
  return (
    <Card style={styles.metricCard}>
      <Text style={styles.caption}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      {trend === undefined ? null : <Text style={styles.helper}>{trend}</Text>}
    </Card>
  );
}

type WalletCardProps = {
  balance: string;
  ctaLabel?: string;
  onPress?: () => void;
};

export function WalletCard({
  balance,
  ctaLabel = 'Add money',
  onPress,
}: WalletCardProps) {
  return (
    <Card style={styles.walletCard}>
      <View style={styles.walletIcon}>
        <IndianRupee color={ui.color.brand.primary} size={22} />
      </View>
      <View style={styles.flex}>
        <Text style={styles.caption}>Wallet balance</Text>
        <Text style={styles.metricValue}>{balance}</Text>
      </View>
      <Button compact onPress={onPress} title={ctaLabel} variant="tonal" />
    </Card>
  );
}

type HostCardProps = {
  language: string;
  name: string;
  rank: RankBadgeProps['rank'];
  rate: string;
  status: string;
};

export function HostCard({
  language,
  name,
  rank,
  rate,
  status,
}: HostCardProps) {
  return (
    <Card style={styles.hostCard}>
      <Avatar label={name} />
      <View style={styles.flex}>
        <Text style={styles.title}>{name}</Text>
        <Text style={styles.helper}>
          {language} · {rate}
        </Text>
        <View style={styles.rowGap}>
          <RankBadge rank={rank} />
          <StatusBadge label={status} tone="success" />
        </View>
      </View>
    </Card>
  );
}

type EmptyStateProps = {
  actionLabel?: string;
  icon?: IconComponent;
  message: string;
  onAction?: () => void;
  title: string;
};

export function EmptyState({
  actionLabel,
  icon: Icon = Bell,
  message,
  onAction,
  title,
}: EmptyStateProps) {
  return (
    <GlassSurface
      accessibilityRole="summary"
      style={styles.stateBox}
      variant="strong"
    >
      <Icon color={ui.color.text.tertiary} size={32} />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.helper}>{message}</Text>
      {actionLabel === undefined ? null : (
        <Button
          compact
          onPress={onAction}
          title={actionLabel}
          variant="secondary"
        />
      )}
    </GlassSurface>
  );
}

type ErrorStateProps = {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  title: string;
};

export function ErrorState({
  message,
  onRetry,
  retryLabel = 'Retry',
  title,
}: ErrorStateProps) {
  return (
    <GlassSurface
      accessibilityRole="alert"
      borderColor={ui.color.status.errorSoft}
      overlayColor="rgba(226,83,100,0.12)"
      style={styles.stateBox}
      variant="strong"
    >
      <AlertCircle color={ui.color.status.error} size={32} />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.helper}>{message}</Text>
      <Button
        compact
        onPress={onRetry}
        title={retryLabel}
        variant="destructive"
      />
    </GlassSurface>
  );
}

export function Skeleton({ lines = 3 }: { lines?: number }) {
  const widths = ['90%', '72%', '54%', '48%', '36%'] as const;

  return (
    <View accessibilityLabel="Loading content" style={styles.skeletonWrap}>
      {Array.from({ length: lines }, (_, index) => (
        <View
          key={index}
          style={[styles.skeletonLine, { width: widths[index] ?? '40%' }]}
        />
      ))}
    </View>
  );
}

type PermissionExplainerProps = {
  actionLabel: string;
  body: string;
  onAction?: () => void;
  title: string;
};

export function PermissionExplainer({
  actionLabel,
  body,
  onAction,
  title,
}: PermissionExplainerProps) {
  return (
    <Card style={styles.permissionCard}>
      <CheckCircle2 color={ui.color.brand.primary} size={28} />
      <View style={styles.flex}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.helper}>{body}</Text>
      </View>
      <Button
        compact
        onPress={onAction}
        title={actionLabel}
        variant="primary"
      />
    </Card>
  );
}

export function LegalContent({
  children,
  title,
}: ComponentChildren & { title: string }) {
  return (
    <GlassSurface style={styles.legalShell} variant="strong">
      <Text accessibilityRole="header" style={styles.legalTitle}>
        {title}
      </Text>
      <View style={styles.legalBody}>{children}</View>
    </GlassSurface>
  );
}

type ListRowProps = {
  description?: string;
  icon?: IconComponent;
  meta?: string;
  title: string;
};

export function ListRow({
  description,
  icon: Icon,
  meta,
  title,
}: ListRowProps) {
  return (
    <GlassSurface style={styles.listRow} variant="standard">
      {Icon === undefined ? null : (
        <View style={styles.rowIcon}>
          <Icon color={ui.color.brand.primary} size={20} />
        </View>
      )}
      <View style={styles.flex}>
        <Text style={styles.rowTitle}>{title}</Text>
        {description === undefined ? null : (
          <Text style={styles.helper}>{description}</Text>
        )}
      </View>
      {meta === undefined ? null : <Text style={styles.meta}>{meta}</Text>}
    </GlassSurface>
  );
}

export function TransactionRow(props: Omit<ListRowProps, 'icon'>) {
  return <ListRow icon={IndianRupee} {...props} />;
}

export function CallHistoryRow(props: Omit<ListRowProps, 'icon'>) {
  return <ListRow icon={Phone} {...props} />;
}

export function ReferralRow(props: Omit<ListRowProps, 'icon'>) {
  return <ListRow icon={RefreshCw} {...props} />;
}

export function NotificationRow(props: Omit<ListRowProps, 'icon'>) {
  return <ListRow icon={Bell} {...props} />;
}

const styles = StyleSheet.create({
  androidGlassNoElevation: {
    elevation: 0,
    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowRadius: 0,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: ui.glass.surfaceStrong,
    borderColor: ui.glass.borderStrong,
    borderWidth: 1,
    borderRadius: ui.radii.full,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    height: '100%',
    width: '100%',
  },
  avatarText: {
    color: ui.color.brand.primary,
    fontFamily: ui.font.bold,
    fontSize: ui.type.body.fontSize,
  },
  badge: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderColor: ui.glass.border,
    borderRadius: ui.radii.full,
    borderWidth: 1,
    flexDirection: 'row',
    gap: ui.spacing[1],
    paddingHorizontal: ui.spacing[3],
    paddingVertical: ui.spacing[1],
  },
  badgeText: {
    fontFamily: ui.font.bold,
    fontSize: ui.type.caption.fontSize,
    lineHeight: ui.type.caption.lineHeight,
    textTransform: 'capitalize',
  },
  caption: {
    color: ui.color.text.secondary,
    fontFamily: ui.font.medium,
    fontSize: ui.type.caption.fontSize,
    lineHeight: ui.type.caption.lineHeight,
  },
  glassSurface: {
    borderRadius: ui.radii.xxl,
    position: 'relative',
  },
  glassContent: {
    padding: ui.spacing[5],
  },
  glassClip: {
    overflow: 'hidden',
    position: 'relative',
  },
  glassBackdrop: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
  },
  glassEdge: {
    borderColor: 'rgba(255,255,255,0.84)',
    borderWidth: StyleSheet.hairlineWidth,
    bottom: 1,
    left: 1,
    position: 'absolute',
    right: 1,
    top: 1,
  },
  flex: {
    flex: 1,
  },
  helper: {
    color: ui.color.text.secondary,
    fontFamily: ui.font.regular,
    fontSize: ui.type.body.fontSize,
    lineHeight: ui.type.body.lineHeight,
  },
  hostCard: {
    flexDirection: 'row',
    gap: ui.spacing[4],
  },
  legalBody: {
    gap: ui.spacing[4],
  },
  legalShell: {
    gap: ui.spacing[4],
  },
  legalTitle: {
    color: ui.color.text.primary,
    fontFamily: ui.font.bold,
    fontSize: ui.type.title.fontSize,
    lineHeight: ui.type.title.lineHeight,
  },
  listRow: {
    alignItems: 'center',
    ...ui.shadow.card,
    backgroundColor: ui.glass.surface,
    borderColor: ui.glass.borderStrong,
    borderRadius: ui.radii.xxl,
    borderWidth: 1,
    flexDirection: 'row',
    gap: ui.spacing[3],
    minHeight: 64,
    padding: ui.spacing[4],
  },
  meta: {
    color: ui.color.text.secondary,
    fontFamily: ui.font.semibold,
    fontSize: ui.type.label.fontSize,
    lineHeight: ui.type.label.lineHeight,
  },
  metricCard: {
    gap: ui.spacing[2],
  },
  metricValue: {
    color: ui.color.text.primary,
    fontFamily: ui.font.bold,
    fontSize: ui.type.title.fontSize,
    lineHeight: ui.type.title.lineHeight,
  },
  noBorder: {
    borderWidth: 0,
  },
  permissionCard: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: ui.spacing[4],
  },
  rowGap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: ui.spacing[2],
    marginTop: ui.spacing[3],
  },
  rowIcon: {
    alignItems: 'center',
    backgroundColor: ui.glass.surfaceStrong,
    borderColor: ui.glass.border,
    borderWidth: 1,
    borderRadius: ui.radii.full,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  rowTitle: {
    color: ui.color.text.primary,
    fontFamily: ui.font.semibold,
    fontSize: ui.type.body.fontSize,
    lineHeight: ui.type.body.lineHeight,
  },
  skeletonLine: {
    backgroundColor: 'rgba(201,54,116,0.13)',
    borderRadius: ui.radii.full,
    height: 16,
  },
  skeletonWrap: {
    gap: ui.spacing[3],
  },
  stateBox: {
    alignItems: 'center',
    ...ui.shadow.card,
    backgroundColor: ui.glass.surface,
    borderColor: ui.glass.borderStrong,
    borderRadius: ui.radii.xxl,
    borderWidth: 1,
    gap: ui.spacing[3],
    padding: ui.spacing[6],
  },
  title: {
    color: ui.color.text.primary,
    fontFamily: ui.font.bold,
    fontSize: ui.type.title.fontSize,
    lineHeight: ui.type.title.lineHeight,
  },
  walletCard: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: ui.spacing[4],
  },
  walletIcon: {
    alignItems: 'center',
    backgroundColor: ui.glass.surfaceStrong,
    borderColor: ui.glass.border,
    borderWidth: 1,
    borderRadius: ui.radii.full,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
});

const glassVariantStyles = StyleSheet.create({
  floating: {
    backgroundColor: ui.glass.surfaceFloating,
    borderColor: ui.glass.borderStrong,
    borderWidth: 1,
  },
  modal: {
    backgroundColor: ui.glass.surfaceModal,
    borderColor: ui.glass.borderStrong,
    borderWidth: 1,
  },
  standard: {
    backgroundColor: ui.glass.surface,
    borderColor: ui.glass.border,
    borderWidth: 1,
  },
  strong: {
    backgroundColor: ui.glass.surfaceStrong,
    borderColor: ui.glass.borderStrong,
    borderWidth: 1,
  },
  subtle: {
    backgroundColor: ui.glass.surfaceSoft,
    borderColor: ui.glass.borderSubtle,
    borderWidth: 1,
  },
});

const androidGlassVariantStyles = StyleSheet.create({
  floating: {
    backgroundColor: ui.glass.androidSurfaceFloating,
    borderColor: 'rgba(255,255,255,0.96)',
    borderWidth: 1.5,
  },
  modal: {
    backgroundColor: ui.glass.androidSurfaceModal,
    borderColor: 'rgba(255,255,255,0.98)',
    borderWidth: 1.5,
  },
  standard: {
    backgroundColor: ui.glass.androidSurface,
    borderColor: 'rgba(255,255,255,0.84)',
    borderWidth: 1,
  },
  strong: {
    backgroundColor: ui.glass.androidSurfaceStrong,
    borderColor: 'rgba(255,255,255,0.94)',
    borderWidth: 1.5,
  },
  subtle: {
    backgroundColor: ui.glass.androidSurfaceSoft,
    borderColor: 'rgba(255,255,255,0.72)',
    borderWidth: 1,
  },
});

const glassShadowStyles = StyleSheet.create({
  card: ui.shadow.card,
  floating: ui.shadow.floating,
  modal: ui.shadow.nav,
  none: ui.shadow.none,
  soft: ui.shadow.soft,
});
