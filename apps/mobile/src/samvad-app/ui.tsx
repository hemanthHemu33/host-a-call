import type { PropsWithChildren } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export const SamvadScreen = ({ children }: PropsWithChildren) => (
  <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.brand}>
        <Text style={styles.brandName}>Connecto</Text>
        <Text style={styles.brandCaption}>Powered by Samvad</Text>
      </View>
      {children}
    </ScrollView>
  </SafeAreaView>
);

export const Title = ({ children }: PropsWithChildren) => (
  <Text style={styles.title}>{children}</Text>
);

export const Body = ({ children }: PropsWithChildren) => (
  <Text style={styles.body}>{children}</Text>
);

export const Notice = ({
  children,
  error = false,
}: PropsWithChildren<{ error?: boolean }>) => (
  <Text style={[styles.notice, error ? styles.noticeError : styles.noticeInfo]}>
    {children}
  </Text>
);

export const Input = (props: TextInputProps) => (
  <TextInput placeholderTextColor="#7f6b76" style={styles.input} {...props} />
);

export const PrimaryButton = ({
  children,
  disabled = false,
  loading = false,
  onPress,
}: PropsWithChildren<{
  disabled?: boolean;
  loading?: boolean;
  onPress: () => void;
}>) => (
  <Pressable
    accessibilityRole="button"
    disabled={disabled || loading}
    onPress={onPress}
    style={({ pressed }) => [
      styles.primaryButton,
      (disabled || loading) && styles.buttonDisabled,
      pressed && !disabled && !loading && styles.buttonPressed,
    ]}
  >
    {loading ? (
      <ActivityIndicator color="#fff" />
    ) : (
      <Text style={styles.primaryButtonText}>{children}</Text>
    )}
  </Pressable>
);

export const SecondaryButton = ({
  children,
  disabled = false,
  onPress,
}: PropsWithChildren<{ disabled?: boolean; onPress: () => void }>) => (
  <Pressable
    accessibilityRole="button"
    disabled={disabled}
    onPress={onPress}
    style={({ pressed }) => [
      styles.secondaryButton,
      disabled && styles.buttonDisabled,
      pressed && !disabled && styles.buttonPressed,
    ]}
  >
    <Text style={styles.secondaryButtonText}>{children}</Text>
  </Pressable>
);

export const styles = StyleSheet.create({
  body: {
    color: '#655764',
    fontSize: 16,
    lineHeight: 24,
  },
  brand: {
    alignItems: 'center',
    gap: 2,
    marginBottom: 32,
  },
  brandCaption: {
    color: '#8c7483',
    fontSize: 13,
  },
  brandName: {
    color: '#c93674',
    fontSize: 32,
    fontWeight: '800',
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  content: {
    flexGrow: 1,
    gap: 16,
    justifyContent: 'center',
    marginHorizontal: 'auto',
    maxWidth: 480,
    padding: 24,
    width: '100%',
  },
  input: {
    backgroundColor: '#fff',
    borderColor: '#dfcbd5',
    borderRadius: 12,
    borderWidth: 1,
    color: '#241b21',
    fontSize: 17,
    minHeight: 52,
    paddingHorizontal: 16,
  },
  notice: {
    borderRadius: 10,
    fontSize: 14,
    lineHeight: 20,
    overflow: 'hidden',
    padding: 12,
  },
  noticeError: {
    backgroundColor: '#fce8ea',
    color: '#9d2330',
  },
  noticeInfo: {
    backgroundColor: '#f6e7f0',
    color: '#713151',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#c93674',
    borderRadius: 12,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 16,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  safeArea: {
    backgroundColor: '#fff6f7',
    flex: 1,
  },
  secondaryButton: {
    alignItems: 'center',
    borderColor: '#c93674',
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 16,
  },
  secondaryButtonText: {
    color: '#a92a5f',
    fontSize: 16,
    fontWeight: '700',
  },
  title: {
    color: '#241b21',
    fontSize: 27,
    fontWeight: '800',
    lineHeight: 34,
  },
});
