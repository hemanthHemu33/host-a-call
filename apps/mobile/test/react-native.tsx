import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
} from 'react';

type HostProps = Record<string, unknown> & {
  children?: React.ReactNode;
  style?: unknown;
};

const host = (type: string) =>
  forwardRef<unknown, HostProps>(function HostComponent(
    { children, ...props },
    ref,
  ) {
    return React.createElement(
      type,
      { ...props, ref },
      children as React.ReactNode,
    );
  });

export const AccessibilityInfo = {
  addEventListener: () => ({ remove: () => undefined }),
  announceForAccessibility: () => undefined,
  isReduceMotionEnabled: () => Promise.resolve(false),
};

class AnimatedValue {
  #value: number;

  constructor(value: number) {
    this.#value = value;
  }

  interpolate({
    outputRange,
  }: {
    inputRange: number[];
    outputRange: number[];
  }) {
    return outputRange[outputRange.length - 1] ?? this.#value;
  }

  setValue(value: number) {
    this.#value = value;
  }
}

export const ActivityIndicator = host('ActivityIndicator');
export const Animated = {
  View: host('Animated.View'),
  Value: AnimatedValue,
  parallel: (
    animations: Array<{ start: (callback?: () => void) => void }>,
  ) => ({
    start: (callback?: () => void) => {
      animations.forEach((animation) => {
        animation.start();
      });
      callback?.();
    },
  }),
  sequence: (
    animations: Array<{ start: (callback?: () => void) => void }>,
  ) => ({
    start: (callback?: () => void) => {
      animations.forEach((animation) => {
        animation.start();
      });
      callback?.();
    },
  }),
  timing: (value: AnimatedValue, config: { toValue: number }) => ({
    start: (callback?: () => void) => {
      value.setValue(config.toValue);
      callback?.();
    },
  }),
};
export const AppState = {
  addEventListener: () => ({ remove: () => undefined }),
  currentState: 'active',
};
export const Image = host('Image');
export const KeyboardAvoidingView = host('KeyboardAvoidingView');
export const Modal = ({ children, visible = true, ...props }: HostProps) =>
  visible ? React.createElement('Modal', props, children) : null;
export const NativeModules = {};
export const Pressable = host('Pressable');
export const ScrollView = host('ScrollView');
export const Switch = host('Switch');
export const Text = host('Text');
export const TextInput = forwardRef<unknown, HostProps>(function TextInput(
  { children, ...props },
  ref,
) {
  useImperativeHandle(ref, () => ({
    focus: () => undefined,
  }));

  return React.createElement('TextInput', props, children as React.ReactNode);
});
export const View = host('View');

export const I18nManager = {
  isRTL: false,
};
export const InteractionManager = {
  runAfterInteractions: (callback: () => void) => {
    callback();

    return {
      cancel: () => undefined,
    };
  },
};

export const Platform = {
  OS: 'ios',
  select: <T,>(options: Record<string, T>) => options.ios ?? options.default,
};

export const Easing = {
  cubic: 'cubic',
  out: <T,>(value: T) => value,
};

export const StyleSheet = {
  absoluteFill: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  absoluteFillObject: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  create: <T extends Record<string, unknown>>(styles: T) => styles,
  flatten: (style: unknown) => style,
};

export const useColorScheme = () => 'light';

export const useWindowDimensions = () => ({
  fontScale: 1,
  height: 844,
  scale: 3,
  width: 390,
});

export { useEffect, useState };
