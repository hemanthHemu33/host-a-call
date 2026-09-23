import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  useTriggerHaptic,
  type HapticPolicy,
  useReducedMotion,
} from './interaction';
import { ui } from './theme';
import type {
  BaseInteractiveProps,
  IconComponent,
  UiStyleProps,
} from './types';

type ButtonVariant =
  'destructive' | 'ghost' | 'primary' | 'secondary' | 'tonal';

type ButtonProps = BaseInteractiveProps &
  UiStyleProps & {
    compact?: boolean;
    icon?: IconComponent;
    iconOnly?: boolean;
    loading?: boolean;
    title: string;
    variant?: ButtonVariant;
  };

const buttonVariantStyles = {
  destructive: {
    container: {
      backgroundColor: 'rgba(226,83,100,0.74)',
      borderColor: 'rgba(255,255,255,0.42)',
    },
    text: ui.color.text.inverse,
  },
  ghost: {
    container: {
      backgroundColor: 'transparent',
      borderColor: 'transparent',
    },
    text: ui.color.brand.primary,
  },
  primary: {
    container: {
      backgroundColor: 'rgba(201,54,116,0.72)',
      borderColor: 'rgba(255,255,255,0.48)',
    },
    text: ui.color.text.inverse,
  },
  secondary: {
    container: {
      backgroundColor: ui.glass.surfaceStrong,
      borderColor: ui.glass.borderStrong,
    },
    text: ui.color.brand.primary,
  },
  tonal: {
    container: {
      backgroundColor: ui.color.brand.primarySoft,
      borderColor: 'rgba(201,54,116,0.22)',
    },
    text: ui.color.brand.primaryPressed,
  },
} as const satisfies Record<
  ButtonVariant,
  { container: { backgroundColor: string; borderColor: string }; text: string }
>;

export function Button({
  accessibilityHint,
  accessibilityLabel,
  compact = false,
  disabled = false,
  hapticsEnabled = true,
  icon: Icon,
  iconOnly = false,
  loading = false,
  onPress,
  style,
  testID,
  textStyle,
  title,
  variant = 'primary',
}: ButtonProps) {
  const isReducedMotion = useReducedMotion();
  const triggerHaptic = useTriggerHaptic();
  const isDisabled = disabled || loading;
  const variantStyle = buttonVariantStyles[variant];

  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityRole="button"
      accessibilityState={{ busy: loading, disabled: isDisabled }}
      disabled={isDisabled}
      hitSlop={ui.hitSlop}
      onPress={(event) => {
        triggerHaptic(
          variant === 'destructive' ? 'medium' : 'light',
          hapticsEnabled,
        );
        onPress?.(event);
      }}
      style={({ pressed }) => [
        styles.button,
        compact ? styles.buttonCompact : null,
        iconOnly ? styles.buttonIconOnly : null,
        variantStyle.container,
        variant === 'ghost' ? null : styles.buttonShadow,
        pressed && !isReducedMotion ? styles.pressed : null,
        isDisabled ? styles.disabled : null,
        style,
      ]}
      testID={testID}
    >
      {variant === 'primary' || variant === 'destructive' ? (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            variant === 'primary'
              ? styles.buttonTintPrimary
              : styles.buttonTintDestructive,
          ]}
        />
      ) : null}
      {loading ? (
        <View pointerEvents="none" style={styles.loader}>
          <ActivityIndicator
            color={variantStyle.text}
            testID={`${testID ?? title}-loader`}
          />
        </View>
      ) : null}
      <View style={styles.buttonContent}>
        {Icon !== undefined ? (
          <Icon
            color={variantStyle.text}
            size={compact ? 18 : 20}
            strokeWidth={2.4}
          />
        ) : null}
        {iconOnly ? null : (
          <Text
            adjustsFontSizeToFit
            ellipsizeMode="tail"
            minimumFontScale={0.76}
            numberOfLines={1}
            style={[
              styles.buttonText,
              { color: variantStyle.text },
              loading ? styles.hiddenContent : null,
              textStyle,
            ]}
          >
            {title}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

type IconButtonProps = BaseInteractiveProps & {
  hapticPolicy?: HapticPolicy;
  icon: IconComponent;
  tone?: 'default' | 'destructive' | 'inverse' | 'primary';
  variant?: 'glass' | 'plain';
};

export function IconButton({
  accessibilityHint,
  accessibilityLabel,
  disabled = false,
  hapticPolicy = 'selection',
  hapticsEnabled = true,
  icon: Icon,
  onPress,
  testID,
  tone = 'default',
  variant = 'glass',
}: IconButtonProps) {
  const isReducedMotion = useReducedMotion();
  const triggerHaptic = useTriggerHaptic();
  const color =
    tone === 'primary'
      ? ui.color.brand.primary
      : tone === 'destructive'
        ? ui.color.status.error
        : tone === 'inverse'
          ? ui.color.text.inverse
          : ui.color.text.primary;

  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled === true }}
      disabled={disabled}
      hitSlop={ui.hitSlop}
      onPress={(event) => {
        triggerHaptic(hapticPolicy, hapticsEnabled);
        onPress?.(event);
      }}
      style={({ pressed }) => [
        styles.iconButton,
        variant === 'plain' ? styles.iconButtonPlain : styles.iconButtonGlass,
        tone === 'inverse' ? styles.iconButtonInverse : null,
        pressed && !isReducedMotion ? styles.pressed : null,
        disabled ? styles.disabled : null,
      ]}
      testID={testID}
    >
      <Icon color={color} size={22} strokeWidth={2.4} />
    </Pressable>
  );
}

type CallControlButtonProps = IconButtonProps & {
  label: string;
  selected?: boolean;
};

export function CallControlButton({
  icon: Icon,
  label,
  selected = false,
  tone = 'inverse',
  ...props
}: CallControlButtonProps) {
  const isReducedMotion = useReducedMotion();
  const triggerHaptic = useTriggerHaptic();
  const color =
    selected || tone === 'destructive'
      ? ui.color.text.inverse
      : ui.color.text.primary;

  return (
    <Pressable
      accessibilityHint={props.accessibilityHint}
      accessibilityLabel={props.accessibilityLabel ?? label}
      accessibilityRole="button"
      accessibilityState={{
        disabled: props.disabled === true,
        selected,
      }}
      disabled={props.disabled}
      hitSlop={ui.hitSlop}
      onPress={(event) => {
        triggerHaptic(props.hapticPolicy ?? 'medium', props.hapticsEnabled);
        props.onPress?.(event);
      }}
      style={({ pressed }) => [
        styles.callControl,
        selected ? styles.callControlSelected : null,
        tone === 'destructive' ? styles.callControlDestructive : null,
        pressed && !isReducedMotion ? styles.pressed : null,
        props.disabled ? styles.disabled : null,
      ]}
      testID={props.testID}
    >
      <Icon color={color} size={24} strokeWidth={2.4} />
      <Text
        style={[
          styles.callControlText,
          selected || tone === 'destructive'
            ? styles.callControlTextInverse
            : null,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderRadius: ui.radii.full,
    borderWidth: 1,
    flexDirection: 'row',
    gap: ui.spacing[2],
    justifyContent: 'center',
    minHeight: 52,
    minWidth: ui.minTouch,
    paddingHorizontal: ui.spacing[5],
    overflow: 'hidden',
  },
  buttonCompact: {
    borderRadius: ui.radii.full,
    minHeight: ui.minTouch,
    paddingHorizontal: ui.spacing[4],
  },
  buttonIconOnly: {
    minWidth: 52,
    paddingHorizontal: 0,
  },
  buttonContent: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 1,
    gap: ui.spacing[2],
    justifyContent: 'center',
    maxWidth: '100%',
    position: 'relative',
    zIndex: 1,
  },
  buttonText: {
    flexShrink: 1,
    fontFamily: ui.font.bold,
    fontSize: ui.type.body.fontSize,
    lineHeight: ui.type.body.lineHeight,
    textAlign: 'center',
  },
  buttonTintDestructive: {
    backgroundColor: 'rgba(194,50,73,0.18)',
  },
  buttonTintPrimary: {
    backgroundColor: 'rgba(169,42,95,0.18)',
  },
  buttonShadow: {
    ...ui.shadow.button,
  },
  callControl: {
    alignItems: 'center',
    backgroundColor: ui.color.call.controlSurface,
    borderColor: 'rgba(255,255,255,0.64)',
    borderWidth: 1,
    borderRadius: ui.radii.full,
    gap: ui.spacing[1],
    justifyContent: 'center',
    minHeight: 72,
    minWidth: 72,
    padding: ui.spacing[3],
  },
  callControlDestructive: {
    backgroundColor: ui.color.status.error,
  },
  callControlSelected: {
    backgroundColor: ui.color.brand.primary,
    borderColor: 'rgba(255,255,255,0.78)',
  },
  callControlText: {
    color: ui.color.text.primary,
    fontFamily: ui.font.medium,
    fontSize: ui.type.caption.fontSize,
    lineHeight: ui.type.caption.lineHeight,
  },
  callControlTextInverse: {
    color: ui.color.text.inverse,
  },
  disabled: {
    opacity: ui.opacity.disabled,
  },
  hiddenContent: {
    opacity: 0,
  },
  iconButton: {
    alignItems: 'center',
    borderRadius: ui.radii.full,
    justifyContent: 'center',
    minHeight: ui.minTouch,
    minWidth: ui.minTouch,
  },
  iconButtonGlass: {
    ...ui.shadow.button,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderColor: 'rgba(255,255,255,0.42)',
    borderWidth: 1,
  },
  iconButtonInverse: {
    backgroundColor: ui.color.call.videoOverlay,
  },
  iconButtonPlain: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    borderWidth: 0,
  },
  loader: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 2,
  },
  pressed: {
    opacity: ui.opacity.pressed,
    transform: [{ scale: 0.97 }],
  },
});
