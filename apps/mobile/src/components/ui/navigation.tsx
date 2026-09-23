import { ArrowLeft, Bell, Wallet } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { IconButton } from './controls';
import { GlassSurface } from './surfaces';
import { ui } from './theme';
import type { BaseInteractiveProps, IconComponent } from './types';

type AppHeaderProps = {
  actionIcon?: IconComponent;
  onAction?: () => void;
  subtitle?: string;
  title: string;
};

export function AppHeader({
  actionIcon = Bell,
  onAction,
  subtitle,
  title,
}: AppHeaderProps) {
  const ActionIcon = actionIcon;

  return (
    <View style={styles.header}>
      <View style={styles.headerCopy}>
        <Text accessibilityRole="header" style={styles.headerTitle}>
          {title}
        </Text>
        {subtitle === undefined ? null : (
          <Text style={styles.subtitle}>{subtitle}</Text>
        )}
      </View>
      {onAction === undefined ? null : (
        <IconButton
          accessibilityLabel="Open header action"
          icon={ActionIcon}
          onPress={onAction}
        />
      )}
    </View>
  );
}

export function BackHeader({
  onPress,
  title,
}: Pick<BaseInteractiveProps, 'onPress'> & { title: string }) {
  return (
    <View style={styles.header}>
      <IconButton
        accessibilityLabel="Go back"
        icon={ArrowLeft}
        onPress={onPress}
        variant="plain"
      />
      <Text accessibilityRole="header" style={styles.backTitle}>
        {title}
      </Text>
    </View>
  );
}

export function WalletHeader({
  balance,
  onPress,
  title = 'Wallet',
}: Pick<BaseInteractiveProps, 'onPress'> & {
  balance: string;
  title?: string;
}) {
  return (
    <GlassSurface style={styles.walletHeader} variant="strong">
      <View style={styles.walletIcon}>
        <Wallet color={ui.color.brand.primary} size={22} />
      </View>
      <View style={styles.headerCopy}>
        <Text style={styles.subtitle}>{title}</Text>
        <Text accessibilityRole="header" style={styles.headerTitle}>
          {balance}
        </Text>
      </View>
      <IconButton
        accessibilityLabel="Open wallet"
        icon={Wallet}
        onPress={onPress}
        tone="primary"
      />
    </GlassSurface>
  );
}

type SectionHeaderProps = {
  actionLabel?: string;
  onAction?: () => void;
  subtitle?: string;
  title: string;
};

export function SectionHeader({
  actionLabel,
  onAction,
  subtitle,
  title,
}: SectionHeaderProps) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.headerCopy}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle === undefined ? null : (
          <Text style={styles.subtitle}>{subtitle}</Text>
        )}
      </View>
      {actionLabel === undefined ? null : (
        <Pressable
          accessibilityLabel={actionLabel}
          accessibilityRole="button"
          hitSlop={ui.hitSlop}
          onPress={onAction}
        >
          <Text style={styles.actionLabel}>{actionLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

type TabBarItem = {
  icon: IconComponent;
  key: string;
  label: string;
};

type TabBarProps = {
  activeKey: string;
  items: readonly TabBarItem[];
  onChange: (key: string) => void;
};

export function TabBar({ activeKey, items, onChange }: TabBarProps) {
  return (
    <GlassSurface
      accessibilityRole="tablist"
      radius={ui.radii.full}
      shadow="floating"
      style={styles.tabBar}
      variant="floating"
    >
      {items.map((item) => {
        const selected = item.key === activeKey;
        const Icon = item.icon;

        return (
          <Pressable
            accessibilityLabel={item.label}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            hitSlop={ui.hitSlop}
            key={item.key}
            onPress={() => {
              onChange(item.key);
            }}
            style={[styles.tabItem, selected ? styles.tabItemSelected : null]}
          >
            <Icon
              color={selected ? ui.color.brand.primary : ui.color.text.tertiary}
              size={20}
            />
            <Text
              style={[styles.tabText, selected ? styles.tabTextSelected : null]}
            >
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  actionLabel: {
    color: ui.color.brand.primary,
    fontFamily: ui.font.bold,
    fontSize: ui.type.label.fontSize,
    lineHeight: ui.type.label.lineHeight,
  },
  backTitle: {
    color: ui.color.text.primary,
    flex: 1,
    fontFamily: ui.font.bold,
    fontSize: ui.type.title.fontSize,
    lineHeight: ui.type.title.lineHeight,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: ui.spacing[3],
    minHeight: 56,
  },
  headerCopy: {
    flex: 1,
    gap: ui.spacing[1],
  },
  headerTitle: {
    color: ui.color.text.primary,
    fontFamily: ui.font.bold,
    fontSize: ui.type.title.fontSize,
    lineHeight: ui.type.title.lineHeight,
  },
  sectionHeader: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: ui.spacing[3],
  },
  sectionTitle: {
    color: ui.color.text.primary,
    fontFamily: ui.font.bold,
    fontSize: ui.type.body.fontSize,
    lineHeight: ui.type.body.lineHeight,
  },
  subtitle: {
    color: ui.color.text.secondary,
    fontFamily: ui.font.regular,
    fontSize: ui.type.label.fontSize,
    lineHeight: ui.type.label.lineHeight,
  },
  tabBar: {
    borderRadius: ui.radii.full,
    flexDirection: 'row',
    gap: ui.spacing[1],
    padding: ui.spacing[1],
  },
  tabItem: {
    alignItems: 'center',
    borderRadius: ui.radii.full,
    flex: 1,
    gap: ui.spacing[1],
    minHeight: 52,
    paddingVertical: ui.spacing[2],
  },
  tabItemSelected: {
    backgroundColor: 'rgba(201,54,116,0.16)',
  },
  tabText: {
    color: ui.color.text.tertiary,
    fontFamily: ui.font.semibold,
    fontSize: ui.type.caption.fontSize,
    lineHeight: ui.type.caption.lineHeight,
  },
  tabTextSelected: {
    color: ui.color.brand.primary,
  },
  walletHeader: {
    alignItems: 'center',
    borderRadius: ui.radii.xxl,
    flexDirection: 'row',
    gap: ui.spacing[3],
    padding: ui.spacing[4],
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
