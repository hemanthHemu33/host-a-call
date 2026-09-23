import { useHaptics, useReducedMotionEnabled } from '@/motion/MotionProvider';

export type HapticPolicy = 'none' | 'light' | 'medium' | 'selection';

export const useReducedMotion = useReducedMotionEnabled;

export const useTriggerHaptic = () => {
  const haptics = useHaptics();

  return (policy: HapticPolicy, enabled = true) => {
    if (!enabled || policy === 'none') {
      return;
    }

    if (policy === 'selection') {
      haptics.selection();
      return;
    }

    if (policy === 'medium') {
      haptics.mediumConfirm();
      return;
    }

    haptics.lightImpact();
  };
};
