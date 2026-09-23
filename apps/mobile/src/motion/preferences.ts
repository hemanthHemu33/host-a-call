import AsyncStorage from '@react-native-async-storage/async-storage';

import { motionPreferenceValues, type MotionPreference } from './types';

const motionPreferenceKey = 'connecto.motion.preference';
const nonEssentialHapticsKey = 'connecto.haptics.nonessential';

export type MotionPreferencesSnapshot = {
  motionPreference: MotionPreference;
  nonEssentialHapticsEnabled: boolean;
};

export const defaultMotionPreferences: MotionPreferencesSnapshot = {
  motionPreference: 'full',
  nonEssentialHapticsEnabled: true,
};

const isMotionPreference = (value: string | null): value is MotionPreference =>
  value !== null &&
  motionPreferenceValues.some((preference) => preference === value);

const parseMotionPreference = (value: string | null): MotionPreference =>
  isMotionPreference(value) ? value : defaultMotionPreferences.motionPreference;

const parseNonEssentialHapticsEnabled = (value: string | null) =>
  value === 'false'
    ? false
    : defaultMotionPreferences.nonEssentialHapticsEnabled;

export const loadMotionPreferences =
  async (): Promise<MotionPreferencesSnapshot> => {
    const entries = await AsyncStorage.multiGet([
      motionPreferenceKey,
      nonEssentialHapticsKey,
    ]);
    const values = new Map(entries);

    return {
      motionPreference: parseMotionPreference(
        values.get(motionPreferenceKey) ?? null,
      ),
      nonEssentialHapticsEnabled: parseNonEssentialHapticsEnabled(
        values.get(nonEssentialHapticsKey) ?? null,
      ),
    };
  };

export const saveMotionPreference = async (preference: MotionPreference) => {
  await AsyncStorage.setItem(motionPreferenceKey, preference);
};

export const saveNonEssentialHapticsEnabled = async (enabled: boolean) => {
  await AsyncStorage.setItem(
    nonEssentialHapticsKey,
    enabled ? 'true' : 'false',
  );
};
