import type { ComponentType, ReactNode } from 'react';
import type {
  PressableProps,
  StyleProp,
  TextStyle,
  ViewStyle,
} from 'react-native';

export type IconComponent = ComponentType<{
  color?: string;
  size?: number;
  strokeWidth?: number;
}>;

export type BaseInteractiveProps = Pick<
  PressableProps,
  'accessibilityHint' | 'accessibilityLabel' | 'disabled' | 'onPress' | 'testID'
> & {
  hapticsEnabled?: boolean;
};

export type LabelledContent = {
  helperText?: string | undefined;
  label: string;
};

export type ComponentChildren = {
  children: ReactNode;
};

export type UiStyleProps = {
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
};
