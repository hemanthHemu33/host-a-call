import { Tabs, useSegments } from 'expo-router';
import { Clock3 } from 'lucide-react-native';
import { StyleSheet, Text, type ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

import {
  FloatingTabBarBackground,
  getFloatingTabBarStyle,
} from '@/components/ui/FloatingTabBar';
import { ui } from '@/components/ui/theme';

type TabIconProps = {
  color: ColorValue;
  focused: boolean;
  size: number;
};

const tabIconStrokeWidth = {
  inactive: 2.3,
} as const;

const dashboardTilePaths = [
  'M5.1 3.75h2.8A2.35 2.35 0 0 1 10.25 6.1v2.8a2.35 2.35 0 0 1-2.35 2.35H5.1A2.35 2.35 0 0 1 2.75 8.9V6.1A2.35 2.35 0 0 1 5.1 3.75Z',
  'M16.1 3.75h2.8a2.35 2.35 0 0 1 2.35 2.35v.8a2.35 2.35 0 0 1-2.35 2.35h-2.8a2.35 2.35 0 0 1-2.35-2.35v-.8a2.35 2.35 0 0 1 2.35-2.35Z',
  'M5.1 14.75h2.8a2.35 2.35 0 0 1 2.35 2.35v.8a2.35 2.35 0 0 1-2.35 2.35H5.1a2.35 2.35 0 0 1-2.35-2.35v-.8a2.35 2.35 0 0 1 2.35-2.35Z',
  'M16.1 12.75h2.8a2.35 2.35 0 0 1 2.35 2.35v2.8a2.35 2.35 0 0 1-2.35 2.35h-2.8a2.35 2.35 0 0 1-2.35-2.35v-2.8a2.35 2.35 0 0 1 2.35-2.35Z',
] as const;

function DashboardTabIcon({ color, focused, size }: TabIconProps) {
  const iconSize = size + 7;

  return (
    <Svg fill="none" height={iconSize} viewBox="0 0 24 24" width={iconSize}>
      {dashboardTilePaths.map((path) => (
        <Path
          d={path}
          fill={focused ? color : 'none'}
          key={path}
          stroke={focused ? 'none' : color}
          strokeLinejoin="round"
          strokeWidth={tabIconStrokeWidth.inactive}
        />
      ))}
    </Svg>
  );
}

function RecentTabIcon({ color, focused, size }: TabIconProps) {
  const iconSize = size + 7;

  if (focused) {
    return (
      <Svg fill="none" height={iconSize} viewBox="0 0 24 24" width={iconSize}>
        <Circle cx="12" cy="12" fill={color} r="10" />
        <Path
          d="M12 6.5V12l4 2.4"
          fill={ui.color.text.inverse}
          stroke={ui.color.text.inverse}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.3"
        />
      </Svg>
    );
  }

  return (
    <Clock3
      color={color}
      size={iconSize}
      strokeWidth={tabIconStrokeWidth.inactive}
    />
  );
}

function ProfileTabIcon({ color, focused, size }: TabIconProps) {
  const iconSize = size + 7;

  if (focused) {
    return (
      <Svg fill="none" height={iconSize} viewBox="0 0 24 24" width={iconSize}>
        <Circle cx="12" cy="8" fill={color} r="5" />
        <Path
          d="M4 21v-1.2c0-3.5 3.6-6.3 8-6.3s8 2.8 8 6.3V21H4Z"
          fill={color}
        />
      </Svg>
    );
  }

  return (
    <Svg fill="none" height={iconSize} viewBox="0 0 24 24" width={iconSize}>
      <Circle
        cx="12"
        cy="8"
        r="4.1"
        stroke={color}
        strokeWidth={tabIconStrokeWidth.inactive}
      />
      <Path
        d="M4.3 20.5v-.7c0-3.6 3.4-6.4 7.7-6.4s7.7 2.8 7.7 6.4v.7"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={tabIconStrokeWidth.inactive}
      />
    </Svg>
  );
}

function TabLabel({
  color,
  focused,
  label,
}: {
  color: ColorValue;
  focused: boolean;
  label: string;
}) {
  return (
    <Text
      allowFontScaling={false}
      numberOfLines={1}
      style={[
        styles.tabLabel,
        { color },
        focused ? styles.tabLabelFocused : null,
      ]}
    >
      {label}
    </Text>
  );
}

export default function HostLayout() {
  const insets = useSafeAreaInsets();
  const segments = useSegments();
  const currentScreen = segments.at(-1) ?? '';
  const showTabBar =
    currentScreen === 'dashboard' ||
    currentScreen === 'recent' ||
    currentScreen === 'profile';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: styles.transparent,
        tabBarActiveTintColor: ui.color.brand.primary,
        tabBarBackground: () => <FloatingTabBarBackground />,
        tabBarInactiveTintColor: ui.color.text.secondary,
        tabBarLabelStyle: styles.tabLabel,
        tabBarStyle: showTabBar
          ? getFloatingTabBarStyle(insets.bottom)
          : { display: 'none' },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          tabBarIcon: ({ color, focused, size }) => (
            <DashboardTabIcon color={color} focused={focused} size={size} />
          ),
          tabBarLabel: ({ color, focused }) => (
            <TabLabel color={color} focused={focused} label="Dashboard" />
          ),
          title: 'Dashboard',
        }}
      />
      <Tabs.Screen
        name="recent"
        options={{
          tabBarIcon: ({ color, focused, size }) => (
            <RecentTabIcon color={color} focused={focused} size={size} />
          ),
          tabBarLabel: ({ color, focused }) => (
            <TabLabel color={color} focused={focused} label="Recent" />
          ),
          title: 'Recent',
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ color, focused, size }) => (
            <ProfileTabIcon color={color} focused={focused} size={size} />
          ),
          tabBarLabel: ({ color, focused }) => (
            <TabLabel color={color} focused={focused} label="Profile" />
          ),
          title: 'Profile',
        }}
      />
      <Tabs.Screen name="earnings" options={{ href: null }} />
      <Tabs.Screen name="calls" options={{ href: null }} />
      <Tabs.Screen name="leaderboard" options={{ href: null }} />
      <Tabs.Screen name="profile-edit" options={{ href: null }} />
      <Tabs.Screen name="bank-account-add" options={{ href: null }} />
      <Tabs.Screen name="referrals" options={{ href: null }} />
      <Tabs.Screen name="settings" options={{ href: null }} />
      <Tabs.Screen name="withdrawal" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabLabel: {
    fontFamily: ui.font.medium,
    fontSize: 12,
    lineHeight: 15,
    minWidth: 70,
    textAlign: 'center',
  },
  tabLabelFocused: {
    fontFamily: ui.font.semibold,
  },
  transparent: {
    backgroundColor: 'transparent',
  },
});
