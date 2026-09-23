import { Tabs, useSegments } from 'expo-router';
import { Clock3, Home, UserRound } from 'lucide-react-native';
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
  focused: 2.8,
  inactive: 2.3,
} as const;

function HomeTabIcon({ color, focused, size }: TabIconProps) {
  const iconSize = size + 7;

  if (focused) {
    return (
      <Svg fill="none" height={iconSize} viewBox="0 0 24 24" width={iconSize}>
        <Path d="M3 10.9 12 3l9 7.9V21h-5.8v-6.4H8.8V21H3V10.9Z" fill={color} />
      </Svg>
    );
  }

  return (
    <Home
      color={color}
      fill="none"
      size={iconSize}
      strokeWidth={tabIconStrokeWidth.inactive}
    />
  );
}

function RecentsTabIcon({ color, focused, size }: TabIconProps) {
  const iconSize = size + 7;

  if (focused) {
    return (
      <Svg fill="none" height={iconSize} viewBox="0 0 24 24" width={iconSize}>
        <Circle cx="12" cy="12" fill={color} r="10" />
        <Path
          d="M12 6.5V12l4 2.4"
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
    <UserRound
      color={color}
      size={iconSize}
      strokeWidth={tabIconStrokeWidth.inactive}
    />
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

export default function CustomerLayout() {
  const segments = useSegments();
  const insets = useSafeAreaInsets();
  const currentScreen = segments.at(-1) ?? '';
  const showTabBar =
    currentScreen === 'home' ||
    currentScreen === 'calls' ||
    currentScreen === 'profile';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: styles.transparent,
        tabBarActiveTintColor: ui.color.brand.primary,
        tabBarBackground: () => <FloatingTabBarBackground />,
        tabBarInactiveTintColor: ui.color.text.secondary,
        tabBarLabelStyle: {
          fontFamily: ui.font.medium,
          fontSize: 12,
        },
        tabBarStyle: showTabBar
          ? getFloatingTabBarStyle(insets.bottom)
          : { display: 'none' },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          tabBarIcon: ({ color, focused, size }) => (
            <HomeTabIcon color={color} focused={focused} size={size} />
          ),
          tabBarLabel: ({ color, focused }) => (
            <TabLabel color={color} focused={focused} label="Home" />
          ),
          title: 'Home',
        }}
      />
      <Tabs.Screen
        name="calls"
        options={{
          tabBarIcon: ({ color, focused, size }) => (
            <RecentsTabIcon color={color} focused={focused} size={size} />
          ),
          tabBarLabel: ({ color, focused }) => (
            <TabLabel color={color} focused={focused} label="Recents" />
          ),
          title: 'Recents',
        }}
      />
      <Tabs.Screen name="calls/[callId]" options={{ href: null }} />
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
      <Tabs.Screen name="profile-edit" options={{ href: null }} />
      <Tabs.Screen name="settings" options={{ href: null }} />
      <Tabs.Screen name="language-settings" options={{ href: null }} />
      <Tabs.Screen name="motion-settings" options={{ href: null }} />
      <Tabs.Screen name="notifications" options={{ href: null }} />
      <Tabs.Screen name="notification-preferences" options={{ href: null }} />
      <Tabs.Screen name="privacy-safety" options={{ href: null }} />
      <Tabs.Screen name="blocked-users" options={{ href: null }} />
      <Tabs.Screen name="report-history" options={{ href: null }} />
      <Tabs.Screen name="delete-account" options={{ href: null }} />
      <Tabs.Screen name="filters" options={{ href: null }} />
      <Tabs.Screen name="add-money" options={{ href: null }} />
      <Tabs.Screen name="payment-states" options={{ href: null }} />
      <Tabs.Screen name="referrals" options={{ href: null }} />
      <Tabs.Screen name="referrals/[referralId]" options={{ href: null }} />
      <Tabs.Screen name="support" options={{ href: null }} />
      <Tabs.Screen name="support-ticket/[ticketId]" options={{ href: null }} />
      <Tabs.Screen
        name="transaction/[transactionId]"
        options={{ href: null }}
      />
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
