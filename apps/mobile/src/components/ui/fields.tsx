import { ChevronDown, Search } from 'lucide-react-native';
import { useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';

import { useTriggerHaptic } from './interaction';
import { GlassSurface } from './surfaces';
import { ui } from './theme';
import type { BaseInteractiveProps, LabelledContent } from './types';

type FieldShellProps = LabelledContent & {
  children: React.ReactNode;
  errorText?: string | undefined;
  testID?: string | undefined;
};

function FieldShell({
  children,
  errorText,
  helperText,
  label,
  testID,
}: FieldShellProps) {
  return (
    <View style={styles.field} testID={testID}>
      <Text style={styles.label}>{label}</Text>
      {children}
      {errorText !== undefined ? (
        <Text accessibilityRole="alert" style={styles.errorText}>
          {errorText}
        </Text>
      ) : null}
      {helperText !== undefined && errorText === undefined ? (
        <Text style={styles.helperText}>{helperText}</Text>
      ) : null}
    </View>
  );
}

type TextFieldProps = LabelledContent &
  TextInputProps & {
    errorText?: string;
  };

export function TextField({
  errorText,
  helperText,
  label,
  style,
  testID,
  ...inputProps
}: TextFieldProps) {
  return (
    <FieldShell
      errorText={errorText}
      helperText={helperText}
      label={label}
      testID={testID}
    >
      <GlassSurface
        borderColor={
          errorText === undefined
            ? 'rgba(201,54,116,0.48)'
            : ui.color.status.error
        }
        contentStyle={styles.inputGlassContent}
        overlayColor="rgba(255,255,255,0.88)"
        radius={ui.radii.xl}
        shadow="soft"
        variant="strong"
      >
        <TextInput
          accessibilityLabel={inputProps.accessibilityLabel ?? label}
          placeholderTextColor={ui.color.text.tertiary}
          style={[styles.input, style]}
          testID={testID === undefined ? undefined : `${testID}-input`}
          {...inputProps}
        />
      </GlassSurface>
    </FieldShell>
  );
}

export function PhoneField(props: TextFieldProps) {
  return (
    <TextField
      autoComplete="tel"
      inputMode="tel"
      keyboardType="phone-pad"
      textContentType="telephoneNumber"
      {...props}
    />
  );
}

type SearchFieldProps = Omit<TextFieldProps, 'label'> & {
  label?: string;
};

export function SearchField({
  label = 'Search',
  style,
  ...props
}: SearchFieldProps) {
  return (
    <GlassSurface
      borderColor="rgba(201,54,116,0.42)"
      contentStyle={styles.searchWrap}
      overlayColor="rgba(255,255,255,0.86)"
      radius={ui.radii.full}
      shadow="soft"
      variant="strong"
    >
      <Search color={ui.color.text.tertiary} size={20} />
      <TextInput
        accessibilityLabel={props.accessibilityLabel ?? label}
        placeholderTextColor={ui.color.text.tertiary}
        returnKeyType="search"
        style={[styles.searchInput, style]}
        {...props}
      />
    </GlassSurface>
  );
}

type TextAreaProps = TextFieldProps;

export function TextArea(props: TextAreaProps) {
  return (
    <TextField
      multiline
      style={[styles.textArea, props.style]}
      textAlignVertical="top"
      {...props}
    />
  );
}

type SelectFieldProps = LabelledContent &
  BaseInteractiveProps & {
    errorText?: string;
    placeholder?: string;
    value?: string;
  };

export function SelectField({
  accessibilityHint,
  accessibilityLabel,
  disabled = false,
  errorText,
  hapticsEnabled = true,
  helperText,
  label,
  onPress,
  placeholder = 'Select an option',
  testID,
  value,
}: SelectFieldProps) {
  const triggerHaptic = useTriggerHaptic();

  return (
    <FieldShell
      errorText={errorText}
      helperText={helperText}
      label={label}
      testID={testID}
    >
      <GlassSurface
        borderColor={
          errorText === undefined
            ? 'rgba(201,54,116,0.48)'
            : ui.color.status.error
        }
        contentStyle={styles.inputGlassContent}
        overlayColor="rgba(255,255,255,0.88)"
        radius={ui.radii.xl}
        shadow="soft"
        variant="strong"
      >
        <Pressable
          accessibilityHint={accessibilityHint}
          accessibilityLabel={accessibilityLabel ?? label}
          accessibilityRole="button"
          accessibilityState={{ disabled: disabled === true, expanded: false }}
          disabled={disabled}
          hitSlop={ui.hitSlop}
          onPress={(event) => {
            triggerHaptic('selection', hapticsEnabled);
            onPress?.(event);
          }}
          style={({ pressed }) => [
            styles.select,
            pressed ? styles.pressed : null,
            disabled ? styles.disabled : null,
          ]}
        >
          <Text
            style={[
              styles.selectText,
              value === undefined ? styles.placeholder : null,
            ]}
          >
            {value ?? placeholder}
          </Text>
          <ChevronDown color={ui.color.text.secondary} size={20} />
        </Pressable>
      </GlassSurface>
    </FieldShell>
  );
}

type OTPInputProps = {
  accessibilityLabel?: string;
  disabled?: boolean;
  length?: number;
  onChange: (value: string) => void;
  testID?: string;
  value: string;
};

const otpCellGap = 6;
const otpCellMaxSize = 48;
const otpCellMinSize = 38;

export function OTPInput({
  accessibilityLabel = 'One time password',
  disabled = false,
  length = 6,
  onChange,
  testID,
  value,
}: OTPInputProps) {
  const hiddenInputRef = useRef<TextInput | null>(null);
  const [rowWidth, setRowWidth] = useState(0);
  const normalizedValue = useMemo(
    () => value.replace(/\D/g, '').slice(0, length),
    [length, value],
  );
  const cells = Array.from(
    { length },
    (_, index) => normalizedValue[index] ?? '',
  );
  const activeIndex = Math.min(normalizedValue.length, length - 1);
  const cellSize = useMemo(() => {
    if (rowWidth <= 0) {
      return otpCellMaxSize;
    }

    const availableWidth = rowWidth - otpCellGap * Math.max(0, length - 1);
    return Math.max(
      otpCellMinSize,
      Math.min(otpCellMaxSize, Math.floor(availableWidth / length)),
    );
  }, [length, rowWidth]);
  const cellHeight = Math.max(50, cellSize + 6);

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="text"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => {
        hiddenInputRef.current?.focus();
      }}
      onLayout={(event) => {
        setRowWidth(event.nativeEvent.layout.width);
      }}
      style={styles.otpWrap}
      testID={testID}
    >
      <TextInput
        accessibilityLabel={accessibilityLabel}
        autoComplete="sms-otp"
        editable={!disabled}
        importantForAutofill="yes"
        inputMode="numeric"
        keyboardType="number-pad"
        maxLength={length}
        onChangeText={(text) => {
          onChange(text.replace(/\D/g, '').slice(0, length));
        }}
        onKeyPress={(event) => {
          if (
            event.nativeEvent.key === 'Backspace' &&
            normalizedValue.length === 0
          ) {
            AccessibilityInfo.announceForAccessibility(
              `${accessibilityLabel} cleared`,
            );
          }
        }}
        ref={hiddenInputRef}
        style={styles.otpHiddenInput}
        testID={testID === undefined ? undefined : `${testID}-hidden-input`}
        textContentType="oneTimeCode"
        value={normalizedValue}
      />
      <View pointerEvents="none" style={[styles.otpRow, { gap: otpCellGap }]}>
        {cells.map((digit, index) => (
          <View
            key={index}
            style={[
              styles.otpCell,
              { height: cellHeight, width: cellSize },
              index === activeIndex && !disabled ? styles.otpCellActive : null,
              disabled ? styles.disabled : null,
            ]}
            testID={
              testID === undefined ? undefined : `${testID}-${String(index)}`
            }
          >
            <Text
              adjustsFontSizeToFit
              minimumFontScale={0.72}
              numberOfLines={1}
              style={styles.otpCellText}
            >
              {digit}
            </Text>
          </View>
        ))}
      </View>
    </Pressable>
  );
}

type CheckboxProps = BaseInteractiveProps & {
  checked: boolean;
  label: string;
};

export function Checkbox({
  checked,
  disabled = false,
  hapticsEnabled = true,
  label,
  onPress,
  testID,
}: CheckboxProps) {
  const triggerHaptic = useTriggerHaptic();

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled: disabled === true }}
      disabled={disabled}
      hitSlop={ui.hitSlop}
      onPress={(event) => {
        triggerHaptic('selection', hapticsEnabled);
        onPress?.(event);
      }}
      style={({ pressed }) => [
        styles.checkRow,
        pressed ? styles.pressed : null,
        disabled ? styles.disabled : null,
      ]}
      testID={testID}
    >
      <View
        style={[styles.checkboxBox, checked ? styles.checkboxBoxChecked : null]}
      >
        {checked ? <View style={styles.checkboxDot} /> : null}
      </View>
      <Text style={styles.choiceText}>{label}</Text>
    </Pressable>
  );
}

type RadioCardProps = BaseInteractiveProps & {
  description?: string;
  label: string;
  selected: boolean;
};

export function RadioCard({
  description,
  disabled = false,
  hapticsEnabled = true,
  label,
  onPress,
  selected,
  testID,
}: RadioCardProps) {
  const triggerHaptic = useTriggerHaptic();

  return (
    <GlassSurface
      borderColor={selected ? ui.color.brand.primary : 'rgba(201,54,116,0.34)'}
      contentStyle={styles.inputGlassContent}
      overlayColor="rgba(255,255,255,0.78)"
      radius={ui.radii.xxl}
      shadow="soft"
      variant="standard"
    >
      <Pressable
        accessibilityLabel={label}
        accessibilityRole="radio"
        accessibilityState={{ checked: selected, disabled: disabled === true }}
        disabled={disabled}
        hitSlop={ui.hitSlop}
        onPress={(event) => {
          triggerHaptic('selection', hapticsEnabled);
          onPress?.(event);
        }}
        style={({ pressed }) => [
          styles.radioCard,
          pressed ? styles.pressed : null,
          disabled ? styles.disabled : null,
        ]}
        testID={testID}
      >
        <View style={styles.radioCopy}>
          <Text style={styles.choiceText}>{label}</Text>
          {description === undefined ? null : (
            <Text style={styles.helperText}>{description}</Text>
          )}
        </View>
        <View
          style={[
            styles.radioCircle,
            selected ? styles.radioCircleSelected : null,
          ]}
        >
          {selected ? <View style={styles.radioDot} /> : null}
        </View>
      </Pressable>
    </GlassSurface>
  );
}

type SwitchRowProps = {
  disabled?: boolean;
  label: string;
  onValueChange: (value: boolean) => void;
  testID?: string;
  value: boolean;
};

export function SwitchRow({
  disabled = false,
  label,
  onValueChange,
  testID,
  value,
}: SwitchRowProps) {
  return (
    <GlassSurface
      borderColor="rgba(201,54,116,0.3)"
      contentStyle={styles.inputGlassContent}
      overlayColor="rgba(255,255,255,0.76)"
      radius={ui.radii.xxl}
      shadow="soft"
      variant="standard"
    >
      <View
        style={[styles.switchRow, disabled ? styles.disabled : null]}
        testID={testID}
      >
        <Text style={styles.choiceText}>{label}</Text>
        <Switch
          accessibilityLabel={label}
          disabled={disabled}
          onValueChange={onValueChange}
          thumbColor={
            value ? ui.color.brand.primary : ui.color.background.surface
          }
          trackColor={{
            false: ui.color.background.surfaceMuted,
            true: ui.color.brand.primarySoft,
          }}
          value={value}
        />
      </View>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  checkboxBox: {
    alignItems: 'center',
    borderColor: ui.color.text.tertiary,
    borderRadius: ui.radii.sm,
    borderWidth: 2,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  checkboxBoxChecked: {
    backgroundColor: ui.color.brand.primary,
    borderColor: ui.color.brand.primary,
  },
  checkboxDot: {
    backgroundColor: ui.color.text.inverse,
    borderRadius: ui.radii.full,
    height: 8,
    width: 8,
  },
  checkRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: ui.spacing[3],
    minHeight: ui.minTouch,
  },
  choiceText: {
    color: ui.color.text.primary,
    flex: 1,
    fontFamily: ui.font.semibold,
    fontSize: ui.type.body.fontSize,
    lineHeight: ui.type.body.lineHeight,
  },
  disabled: {
    opacity: ui.opacity.disabled,
  },
  errorText: {
    color: ui.color.status.error,
    fontFamily: ui.font.medium,
    fontSize: ui.type.caption.fontSize,
    lineHeight: ui.type.caption.lineHeight,
  },
  field: {
    gap: ui.spacing[2],
  },
  helperText: {
    color: ui.color.text.secondary,
    fontFamily: ui.font.regular,
    fontSize: ui.type.caption.fontSize,
    lineHeight: ui.type.caption.lineHeight,
  },
  input: {
    backgroundColor: 'transparent',
    borderRadius: ui.radii.xl,
    borderWidth: 0,
    color: ui.color.text.primary,
    fontFamily: ui.font.regular,
    fontSize: ui.type.body.fontSize,
    lineHeight: ui.type.body.lineHeight,
    minHeight: 52,
    paddingHorizontal: ui.spacing[4],
  },
  inputError: {
    borderColor: ui.color.status.error,
  },
  inputGlassContent: {
    padding: 0,
  },
  label: {
    color: ui.color.text.primary,
    fontFamily: ui.font.semibold,
    fontSize: ui.type.label.fontSize,
    lineHeight: ui.type.label.lineHeight,
  },
  otpCell: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderColor: 'rgba(201,54,116,0.46)',
    borderRadius: ui.radii.xl,
    borderWidth: 1.5,
    flexShrink: 0,
    justifyContent: 'center',
  },
  otpCellActive: {
    borderColor: ui.color.brand.primary,
    borderWidth: 2,
  },
  otpCellText: {
    color: ui.color.text.primary,
    fontFamily: ui.font.bold,
    fontSize: ui.type.title.fontSize,
    includeFontPadding: false,
    lineHeight: ui.type.title.lineHeight,
    textAlign: 'center',
    textAlignVertical: 'center',
  },
  otpHiddenInput: {
    height: 1,
    opacity: 0.01,
    position: 'absolute',
    width: 1,
  },
  otpRow: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    justifyContent: 'center',
    width: '100%',
  },
  otpWrap: {
    alignSelf: 'stretch',
    minHeight: 54,
    width: '100%',
  },
  placeholder: {
    color: ui.color.text.tertiary,
    fontFamily: ui.font.regular,
  },
  pressed: {
    opacity: ui.opacity.pressed,
  },
  radioCard: {
    alignItems: 'center',
    borderRadius: ui.radii.xxl,
    flexDirection: 'row',
    gap: ui.spacing[3],
    minHeight: 72,
    padding: ui.spacing[4],
  },
  radioCircle: {
    alignItems: 'center',
    borderColor: ui.color.text.tertiary,
    borderRadius: ui.radii.full,
    borderWidth: 2,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  radioCircleSelected: {
    borderColor: ui.color.brand.primary,
  },
  radioCopy: {
    flex: 1,
    gap: ui.spacing[1],
  },
  radioDot: {
    backgroundColor: ui.color.brand.primary,
    borderRadius: ui.radii.full,
    height: 10,
    width: 10,
  },
  searchInput: {
    color: ui.color.text.primary,
    flex: 1,
    fontFamily: ui.font.regular,
    fontSize: ui.type.body.fontSize,
    lineHeight: ui.type.body.lineHeight,
    minHeight: 42,
  },
  searchWrap: {
    alignItems: 'center',
    borderRadius: ui.radii.full,
    flexDirection: 'row',
    gap: ui.spacing[2],
    minHeight: 48,
    padding: 0,
    paddingHorizontal: ui.spacing[3],
  },
  select: {
    alignItems: 'center',
    borderRadius: ui.radii.xl,
    flexDirection: 'row',
    minHeight: 52,
    paddingHorizontal: ui.spacing[4],
  },
  selectText: {
    color: ui.color.text.primary,
    flex: 1,
    fontFamily: ui.font.semibold,
    fontSize: ui.type.body.fontSize,
    lineHeight: ui.type.body.lineHeight,
  },
  switchRow: {
    alignItems: 'center',
    borderRadius: ui.radii.xxl,
    flexDirection: 'row',
    minHeight: 64,
    padding: ui.spacing[4],
  },
  textArea: {
    minHeight: 120,
    paddingTop: ui.spacing[4],
  },
});
