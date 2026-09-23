import { vi } from 'vitest';
import React from 'react';

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;
(globalThis as { __DEV__?: boolean }).__DEV__ = false;

const asyncStorageState = new Map<string, string>();
const secureStoreState = new Map<string, string>();
const clipboardState = {
  value: '',
};
const imagePickerState = {
  permission: {
    accessPrivileges: 'all' as const,
    canAskAgain: true,
    granted: true,
    status: 'granted' as const,
  },
  result: {
    assets: [
      {
        fileName: 'selected-profile.jpg',
        height: 512,
        uri: 'file:///mock/selected-profile.jpg',
        width: 512,
      },
    ],
    canceled: false as const,
  },
};
const notificationPermissionState = {
  canAskAgain: true,
  granted: true,
  ios: undefined,
  status: 'granted' as const,
};
const audioPermissionState = {
  canAskAgain: true,
  expires: 'never' as const,
  granted: true,
  status: 'granted' as const,
};
const mockAudioRecorderState = {
  canRecord: false,
  durationMillis: 1_800,
  isRecording: false,
  mediaServicesDidReset: false,
  url: 'file:///mock/voice-verification.m4a',
};
const mockAudioRecorder = {
  currentTime: 1.8,
  getStatus: vi.fn(() => mockAudioRecorderState),
  id: 'mock-recorder',
  isRecording: false,
  prepareToRecordAsync: vi.fn(() => Promise.resolve()),
  record: vi.fn(),
  stop: vi.fn(() => Promise.resolve()),
  uri: 'file:///mock/voice-verification.m4a',
};

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    clear: vi.fn(() => {
      asyncStorageState.clear();
      return Promise.resolve();
    }),
    getItem: vi.fn((key: string) =>
      Promise.resolve(asyncStorageState.get(key) ?? null),
    ),
    multiGet: vi.fn((keys: string[]) =>
      Promise.resolve(
        keys.map((key) => [key, asyncStorageState.get(key) ?? null] as const),
      ),
    ),
    removeItem: vi.fn((key: string) => {
      asyncStorageState.delete(key);
      return Promise.resolve();
    }),
    setItem: vi.fn((key: string, value: string) => {
      asyncStorageState.set(key, value);
      return Promise.resolve();
    }),
  },
}));

vi.mock('@react-native-community/netinfo', () => ({
  default: {
    addEventListener: () => () => undefined,
    fetch: () => Promise.resolve({ isConnected: true }),
  },
}));

vi.mock('expo-secure-store', () => ({
  deleteItemAsync: vi.fn((key: string) => {
    secureStoreState.delete(key);
    return Promise.resolve();
  }),
  getItemAsync: vi.fn((key: string) =>
    Promise.resolve(secureStoreState.get(key) ?? null),
  ),
  setItemAsync: vi.fn((key: string, value: string) => {
    secureStoreState.set(key, value);
    return Promise.resolve();
  }),
}));

vi.mock('expo-clipboard', () => ({
  getStringAsync: vi.fn(() => Promise.resolve(clipboardState.value)),
  setStringAsync: vi.fn((value: string) => {
    clipboardState.value = value;
    return Promise.resolve(true);
  }),
}));

vi.mock('expo-linking', () => ({
  openURL: vi.fn(() => Promise.resolve()),
}));

vi.mock('expo-image-picker', () => ({
  getCameraPermissionsAsync: vi.fn(() =>
    Promise.resolve(imagePickerState.permission),
  ),
  getMediaLibraryPermissionsAsync: vi.fn(() =>
    Promise.resolve(imagePickerState.permission),
  ),
  launchImageLibraryAsync: vi.fn(() =>
    Promise.resolve(imagePickerState.result),
  ),
  requestCameraPermissionsAsync: vi.fn(() =>
    Promise.resolve(imagePickerState.permission),
  ),
  requestMediaLibraryPermissionsAsync: vi.fn(() =>
    Promise.resolve(imagePickerState.permission),
  ),
}));

vi.mock('expo-notifications', () => ({
  IosAuthorizationStatus: {
    AUTHORIZED: 2,
    EPHEMERAL: 4,
    PROVISIONAL: 3,
  },
  getPermissionsAsync: vi.fn(() =>
    Promise.resolve(notificationPermissionState),
  ),
  requestPermissionsAsync: vi.fn(() =>
    Promise.resolve(notificationPermissionState),
  ),
}));

vi.mock('expo-audio', () => ({
  getRecordingPermissionsAsync: vi.fn(() =>
    Promise.resolve(audioPermissionState),
  ),
  RecordingPresets: {
    HIGH_QUALITY: {},
    LOW_QUALITY: {},
  },
  requestRecordingPermissionsAsync: vi.fn(() =>
    Promise.resolve(audioPermissionState),
  ),
  setAudioModeAsync: vi.fn(() => Promise.resolve()),
  setIsAudioActiveAsync: vi.fn(() => Promise.resolve()),
  useAudioRecorder: vi.fn(() => mockAudioRecorder),
  useAudioRecorderState: vi.fn(() => mockAudioRecorderState),
}));

vi.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
  SafeAreaView: ({ children, ...props }: Record<string, unknown>) =>
    React.createElement('SafeAreaView', props, children as React.ReactNode),
  useSafeAreaInsets: () => ({
    bottom: 0,
    left: 0,
    right: 0,
    top: 0,
  }),
}));

vi.mock('react-native/Libraries/Utilities/AccessibilityInfo', () => ({
  default: {
    addEventListener: () => ({ remove: vi.fn() }),
    isReduceMotionEnabled: () => Promise.resolve(false),
  },
}));

vi.mock('expo-haptics', () => ({
  AndroidHaptics: {
    Confirm: 'confirm',
    Reject: 'reject',
    Segment_Tick: 'segment_tick',
    Virtual_Key: 'virtual_key',
  },
  ImpactFeedbackStyle: {
    Light: 'light',
    Medium: 'medium',
  },
  NotificationFeedbackType: {
    Error: 'error',
    Success: 'success',
    Warning: 'warning',
  },
  impactAsync: vi.fn(() => Promise.resolve()),
  notificationAsync: vi.fn(() => Promise.resolve()),
  performAndroidHapticsAsync: vi.fn(() => Promise.resolve()),
  selectionAsync: vi.fn(() => Promise.resolve()),
}));

vi.mock('@shopify/flash-list', () => ({
  FlashList: ({
    ListEmptyComponent,
    ListFooterComponent,
    ListHeaderComponent,
    data,
    renderItem,
    ...props
  }: {
    ListEmptyComponent?: React.ReactNode;
    ListFooterComponent?: React.ReactNode;
    ListHeaderComponent?: React.ReactNode;
    data?: unknown[];
    renderItem?: (info: { index: number; item: unknown }) => React.ReactNode;
  } & Record<string, unknown>) =>
    React.createElement(
      'View',
      props,
      ListHeaderComponent,
      Array.isArray(data)
        ? data.map((item, index) =>
            typeof renderItem === 'function'
              ? renderItem({
                  index,
                  item,
                })
              : null,
          )
        : null,
      ListEmptyComponent,
      ListFooterComponent,
    ),
}));

vi.mock(
  'lucide-react-native',
  () =>
    new Proxy(
      {},
      {
        get: (_target, property) => (props: Record<string, unknown>) =>
          React.createElement(String(property), props),
      },
    ),
);

vi.mock('react-native-svg', () => {
  const element =
    (name: string) =>
    ({ children, ...props }: Record<string, unknown>) =>
      React.createElement(name, props, children as React.ReactNode);

  return {
    Circle: element('Circle'),
    default: element('Svg'),
    Path: element('Path'),
    SvgXml: element('SvgXml'),
  };
});
