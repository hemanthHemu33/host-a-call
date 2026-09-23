import React from 'react';

type AnimatedHostProps = Record<string, unknown> & {
  children?: React.ReactNode;
};

const host = (type: string) =>
  function AnimatedHost({ children, ...props }: AnimatedHostProps) {
    return React.createElement(type, props, children);
  };

const transition = {
  damping: () => transition,
  mass: () => transition,
  stiffness: () => transition,
};

const Animated = {
  Text: host('AnimatedText'),
  View: host('AnimatedView'),
};

export const Easing = {
  bezier: () => (value: number) => value,
};

export const LinearTransition = {
  springify: () => transition,
};

export const ReduceMotion = {
  Always: 'always',
  Never: 'never',
  System: 'system',
};

export const cancelAnimation = () => undefined;

export const interpolate = (
  value: number,
  input: readonly number[],
  output: readonly number[],
) => {
  const firstInput = input[0] ?? 0;
  const lastInput = input[input.length - 1] ?? firstInput;
  const firstOutput = output[0] ?? 0;
  const lastOutput = output[output.length - 1] ?? firstOutput;

  return value <= firstInput || firstInput === lastInput
    ? firstOutput
    : lastOutput;
};

export const useAnimatedReaction = () => undefined;

export const useAnimatedStyle = <TStyle extends Record<string, unknown>>(
  factory: () => TStyle,
) => factory();

export const useSharedValue = <TValue,>(initialValue: TValue) => ({
  value: initialValue,
});

export const withDelay = <TValue,>(_delayMs: number, value: TValue) => value;

export const withRepeat = <TValue,>(value: TValue) => value;

export const withSequence = <TValue,>(...values: TValue[]) =>
  values[values.length - 1] ?? values[0];

export const withTiming = <TValue,>(value: TValue) => value;

export default Animated;
