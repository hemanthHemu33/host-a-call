import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { AccessibilityInfo, Platform, type PlatformOSType } from 'react-native';

import {
  createHapticsService,
  type HapticsRuntimeState,
  type HapticsService,
} from './haptics';
import {
  defaultMotionPreferences,
  loadMotionPreferences,
  saveMotionPreference,
  saveNonEssentialHapticsEnabled,
} from './preferences';
import type { MotionPreference } from './types';
import { runAfterInitialRender } from '@/utils/defer';

type MotionContextValue = {
  cameraSessionActive: boolean;
  cameraUsesReliableHaptics: boolean;
  haptics: HapticsService;
  motionPreference: MotionPreference;
  nonEssentialHapticsEnabled: boolean;
  reducedMotionEnabled: boolean;
  setCameraSessionActive: (active: boolean) => void;
  setMotionPreference: (preference: MotionPreference) => void;
  setNonEssentialHapticsEnabled: (enabled: boolean) => void;
  systemReducedMotionEnabled: boolean;
};

const cameraUsesReliableHapticsForPlatform = (platform: PlatformOSType) =>
  platform !== 'android';

const defaultHapticsRuntimeState: HapticsRuntimeState = {
  cameraHapticsSuppressed: false,
  cameraSessionActive: false,
  nonEssentialHapticsEnabled: true,
  platform: Platform.OS,
};

const defaultHaptics = createHapticsService({
  getState: () => defaultHapticsRuntimeState,
});

class HapticsRuntimeStore {
  #current: HapticsRuntimeState;

  constructor(initialState: HapticsRuntimeState) {
    this.#current = initialState;
  }

  getState() {
    return this.#current;
  }

  update(nextState: HapticsRuntimeState) {
    this.#current = nextState;
  }
}

const MotionContext = createContext<MotionContextValue>({
  cameraSessionActive: false,
  cameraUsesReliableHaptics: cameraUsesReliableHapticsForPlatform(Platform.OS),
  haptics: defaultHaptics,
  motionPreference: defaultMotionPreferences.motionPreference,
  nonEssentialHapticsEnabled: true,
  reducedMotionEnabled: false,
  setCameraSessionActive: () => undefined,
  setMotionPreference: () => undefined,
  setNonEssentialHapticsEnabled: () => undefined,
  systemReducedMotionEnabled: false,
});

type MotionProviderProps = {
  children: ReactNode;
};

export function MotionProvider({ children }: MotionProviderProps) {
  const [systemReducedMotionEnabled, setSystemReducedMotionEnabled] =
    useState(false);
  const [motionPreference, setMotionPreference] = useState<MotionPreference>(
    defaultMotionPreferences.motionPreference,
  );
  const [nonEssentialHapticsEnabled, setNonEssentialHapticsEnabled] = useState(
    defaultMotionPreferences.nonEssentialHapticsEnabled,
  );
  const [preferencesHydrated, setPreferencesHydrated] = useState(false);
  const [cameraSessionActive, setCameraSessionActive] = useState(false);
  const cameraUsesReliableHaptics = cameraUsesReliableHapticsForPlatform(
    Platform.OS,
  );
  const [runtimeStateStore] = useState(
    () =>
      new HapticsRuntimeStore({
        cameraHapticsSuppressed: false,
        cameraSessionActive: false,
        nonEssentialHapticsEnabled: true,
        platform: Platform.OS,
      }),
  );
  const [haptics] = useState(() =>
    createHapticsService({
      getState: () => runtimeStateStore.getState(),
    }),
  );
  const reducedMotionEnabled =
    motionPreference === 'reduced' ||
    (motionPreference === 'system' && systemReducedMotionEnabled);

  useEffect(() => {
    let active = true;
    let subscription: { remove: () => void } | null = null;

    const task = runAfterInitialRender(() => {
      if (!active) {
        return;
      }

      loadMotionPreferences()
        .then((preferences) => {
          if (!active) {
            return;
          }

          setMotionPreference(preferences.motionPreference);
          setNonEssentialHapticsEnabled(preferences.nonEssentialHapticsEnabled);
        })
        .catch(() => undefined)
        .finally(() => {
          if (active) {
            setPreferencesHydrated(true);
          }
        });

      AccessibilityInfo.isReduceMotionEnabled()
        .then((enabled) => {
          if (active) {
            setSystemReducedMotionEnabled(enabled);
          }
        })
        .catch(() => undefined);

      subscription = AccessibilityInfo.addEventListener(
        'reduceMotionChanged',
        setSystemReducedMotionEnabled,
      );
    });

    return () => {
      active = false;
      task.cancel();
      subscription?.remove();
    };
  }, []);

  useEffect(() => {
    if (!preferencesHydrated) {
      return;
    }

    saveMotionPreference(motionPreference).catch(() => undefined);
  }, [motionPreference, preferencesHydrated]);

  useEffect(() => {
    if (!preferencesHydrated) {
      return;
    }

    saveNonEssentialHapticsEnabled(nonEssentialHapticsEnabled).catch(
      () => undefined,
    );
  }, [nonEssentialHapticsEnabled, preferencesHydrated]);

  useEffect(() => {
    runtimeStateStore.update({
      cameraHapticsSuppressed:
        cameraSessionActive && !cameraUsesReliableHaptics,
      cameraSessionActive,
      nonEssentialHapticsEnabled,
      platform: Platform.OS,
    });
  }, [
    cameraSessionActive,
    cameraUsesReliableHaptics,
    nonEssentialHapticsEnabled,
    runtimeStateStore,
  ]);

  return (
    <MotionContext.Provider
      value={{
        cameraSessionActive,
        cameraUsesReliableHaptics,
        haptics,
        motionPreference,
        nonEssentialHapticsEnabled,
        reducedMotionEnabled,
        setCameraSessionActive,
        setMotionPreference,
        setNonEssentialHapticsEnabled,
        systemReducedMotionEnabled,
      }}
    >
      {children}
    </MotionContext.Provider>
  );
}

export const useMotion = () => useContext(MotionContext);

export const useHaptics = () => useMotion().haptics;

export const useReducedMotionEnabled = () => useMotion().reducedMotionEnabled;
