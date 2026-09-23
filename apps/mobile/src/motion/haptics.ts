import * as ExpoHaptics from 'expo-haptics';
import { Vibration, type PlatformOSType } from 'react-native';

export type PaymentResultHapticOutcome = 'failure' | 'pending' | 'success';

export type HapticsRuntimeState = {
  cameraHapticsSuppressed: boolean;
  cameraSessionActive: boolean;
  nonEssentialHapticsEnabled: boolean;
  platform: PlatformOSType;
};

export type HapticsService = ReturnType<typeof createHapticsService>;

type HapticEventName =
  | 'callAccepted'
  | 'lightImpact'
  | 'lowBalance'
  | 'mediumConfirm'
  | 'paymentResultFailure'
  | 'paymentResultPending'
  | 'paymentResultSuccess'
  | 'rankUp'
  | 'reject'
  | 'selection'
  | 'success'
  | 'videoUnlocked'
  | 'warning';

type HapticEventDefinition = {
  cooldownMs: number;
  essential: boolean;
} & (
  | { kind: 'impact'; style: ExpoHaptics.ImpactFeedbackStyle }
  | { kind: 'notification'; type: ExpoHaptics.NotificationFeedbackType }
  | { kind: 'selection' }
);

type HapticsAdapter = {
  androidAsync?: (type: ExpoHaptics.AndroidHaptics) => Promise<void>;
  impactAsync: (style: ExpoHaptics.ImpactFeedbackStyle) => Promise<void>;
  notificationAsync: (
    type: ExpoHaptics.NotificationFeedbackType,
  ) => Promise<void>;
  selectionAsync: () => Promise<void>;
};

const expoHapticsAdapter: HapticsAdapter = {
  androidAsync: ExpoHaptics.performAndroidHapticsAsync,
  impactAsync: ExpoHaptics.impactAsync,
  notificationAsync: ExpoHaptics.notificationAsync,
  selectionAsync: ExpoHaptics.selectionAsync,
};

const hapticEventDefinitions = {
  callAccepted: {
    cooldownMs: 400,
    essential: true,
    kind: 'impact',
    style: ExpoHaptics.ImpactFeedbackStyle.Medium,
  },
  lightImpact: {
    cooldownMs: 120,
    essential: false,
    kind: 'impact',
    style: ExpoHaptics.ImpactFeedbackStyle.Light,
  },
  lowBalance: {
    cooldownMs: 600,
    essential: true,
    kind: 'notification',
    type: ExpoHaptics.NotificationFeedbackType.Warning,
  },
  mediumConfirm: {
    cooldownMs: 180,
    essential: false,
    kind: 'impact',
    style: ExpoHaptics.ImpactFeedbackStyle.Medium,
  },
  paymentResultFailure: {
    cooldownMs: 500,
    essential: true,
    kind: 'notification',
    type: ExpoHaptics.NotificationFeedbackType.Error,
  },
  paymentResultPending: {
    cooldownMs: 500,
    essential: true,
    kind: 'notification',
    type: ExpoHaptics.NotificationFeedbackType.Warning,
  },
  paymentResultSuccess: {
    cooldownMs: 500,
    essential: true,
    kind: 'notification',
    type: ExpoHaptics.NotificationFeedbackType.Success,
  },
  rankUp: {
    cooldownMs: 1200,
    essential: false,
    kind: 'notification',
    type: ExpoHaptics.NotificationFeedbackType.Success,
  },
  reject: {
    cooldownMs: 280,
    essential: true,
    kind: 'notification',
    type: ExpoHaptics.NotificationFeedbackType.Error,
  },
  selection: {
    cooldownMs: 80,
    essential: false,
    kind: 'selection',
  },
  success: {
    cooldownMs: 280,
    essential: true,
    kind: 'notification',
    type: ExpoHaptics.NotificationFeedbackType.Success,
  },
  videoUnlocked: {
    cooldownMs: 500,
    essential: true,
    kind: 'notification',
    type: ExpoHaptics.NotificationFeedbackType.Success,
  },
  warning: {
    cooldownMs: 280,
    essential: true,
    kind: 'notification',
    type: ExpoHaptics.NotificationFeedbackType.Warning,
  },
} as const satisfies Record<HapticEventName, HapticEventDefinition>;

type CreateHapticsServiceOptions = {
  adapter?: HapticsAdapter;
  getState: () => HapticsRuntimeState;
  now?: () => number;
};

const canTriggerHaptic = (
  definition: HapticEventDefinition,
  state: HapticsRuntimeState,
) => {
  if (state.platform === 'web') {
    return false;
  }

  if (state.cameraSessionActive && state.cameraHapticsSuppressed) {
    return false;
  }

  if (!definition.essential && !state.nonEssentialHapticsEnabled) {
    return false;
  }

  return true;
};

const safeCall = (promise: Promise<void>) => {
  promise.catch(() => undefined);
};

const fallbackAndroidPatternFor = (definition: HapticEventDefinition) => {
  if (definition.kind === 'selection') {
    return 8;
  }

  if (definition.kind === 'notification') {
    if (definition.type === ExpoHaptics.NotificationFeedbackType.Success) {
      return [0, 14, 34, 18];
    }

    if (definition.type === ExpoHaptics.NotificationFeedbackType.Error) {
      return [0, 24, 34, 28];
    }

    return [0, 20, 30, 20];
  }

  return definition.style === ExpoHaptics.ImpactFeedbackStyle.Light ? 10 : 18;
};

const androidTypeFor = (definition: HapticEventDefinition) => {
  if (definition.kind === 'selection') {
    return ExpoHaptics.AndroidHaptics.Segment_Tick;
  }

  if (definition.kind === 'notification') {
    return definition.type === ExpoHaptics.NotificationFeedbackType.Error
      ? ExpoHaptics.AndroidHaptics.Reject
      : ExpoHaptics.AndroidHaptics.Confirm;
  }

  return definition.style === ExpoHaptics.ImpactFeedbackStyle.Light
    ? ExpoHaptics.AndroidHaptics.Virtual_Key
    : ExpoHaptics.AndroidHaptics.Confirm;
};

const safeAndroidCall = (
  promise: Promise<void>,
  definition: HapticEventDefinition,
) => {
  promise.catch(() => {
    Vibration.vibrate(fallbackAndroidPatternFor(definition));
  });
};

export const createHapticsService = ({
  adapter = expoHapticsAdapter,
  getState,
  now = Date.now,
}: CreateHapticsServiceOptions) => {
  const lastTriggeredAt = new Map<HapticEventName, number>();

  const emit = (eventName: HapticEventName) => {
    const state = getState();
    const definition = hapticEventDefinitions[eventName];

    if (!canTriggerHaptic(definition, state)) {
      return;
    }

    const currentTime = now();
    const lastTime = lastTriggeredAt.get(eventName);

    if (
      lastTime !== undefined &&
      currentTime - lastTime < definition.cooldownMs
    ) {
      return;
    }

    lastTriggeredAt.set(eventName, currentTime);

    if (state.platform === 'android' && adapter.androidAsync !== undefined) {
      safeAndroidCall(
        adapter.androidAsync(androidTypeFor(definition)),
        definition,
      );
      return;
    }

    if (definition.kind === 'selection') {
      safeCall(adapter.selectionAsync());
      return;
    }

    if (definition.kind === 'impact') {
      safeCall(adapter.impactAsync(definition.style));
      return;
    }

    safeCall(adapter.notificationAsync(definition.type));
  };

  return {
    callAccepted: () => {
      emit('callAccepted');
    },
    lightImpact: () => {
      emit('lightImpact');
    },
    lowBalance: () => {
      emit('lowBalance');
    },
    mediumConfirm: () => {
      emit('mediumConfirm');
    },
    paymentResult: (outcome: PaymentResultHapticOutcome) => {
      emit(
        outcome === 'success'
          ? 'paymentResultSuccess'
          : outcome === 'failure'
            ? 'paymentResultFailure'
            : 'paymentResultPending',
      );
    },
    rankUp: () => {
      emit('rankUp');
    },
    reject: () => {
      emit('reject');
    },
    selection: () => {
      emit('selection');
    },
    success: () => {
      emit('success');
    },
    videoUnlocked: () => {
      emit('videoUnlocked');
    },
    warning: () => {
      emit('warning');
    },
  };
};
