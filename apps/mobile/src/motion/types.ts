export const motionPreferenceValues = ['full', 'reduced', 'system'] as const;

export type MotionPreference = (typeof motionPreferenceValues)[number];
