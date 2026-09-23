import { X } from 'lucide-react-native';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, IconButton } from './controls';
import { GlassSurface } from './surfaces';
import { ui } from './theme';
import type { ComponentChildren } from './types';

type BannerProps = {
  message: string;
  title: string;
  tone?: 'error' | 'info' | 'success' | 'warning';
};

export function Banner({ message, title, tone = 'info' }: BannerProps) {
  return (
    <GlassSurface
      accessibilityRole={tone === 'error' ? 'alert' : 'summary'}
      borderColor={ui.color.status[tone]}
      overlayColor={ui.color.status[`${tone}Soft`]}
      shadow="soft"
      style={styles.banner}
      variant="strong"
    >
      <Text style={[styles.title, { color: ui.color.status[tone] }]}>
        {title}
      </Text>
      <Text style={styles.body}>{message}</Text>
    </GlassSurface>
  );
}

type InlineErrorProps = {
  message: string;
};

export function InlineError({ message }: InlineErrorProps) {
  return (
    <Text accessibilityRole="alert" style={styles.inlineError}>
      {message}
    </Text>
  );
}

type SnackbarProps = {
  actionLabel?: string;
  message: string;
  onAction?: () => void;
};

export function Snackbar({ actionLabel, message, onAction }: SnackbarProps) {
  return (
    <GlassSurface
      accessibilityLiveRegion="polite"
      overlayColor="rgba(36,27,33,0.74)"
      radius={ui.radii.full}
      shadow="floating"
      style={styles.snackbar}
      tint="dark"
      variant="floating"
    >
      <Text style={styles.snackbarText}>{message}</Text>
      {actionLabel === undefined ? null : (
        <Pressable
          accessibilityLabel={actionLabel}
          accessibilityRole="button"
          hitSlop={ui.hitSlop}
          onPress={onAction}
        >
          <Text style={styles.snackbarAction}>{actionLabel}</Text>
        </Pressable>
      )}
    </GlassSurface>
  );
}

export function Toast({ children }: ComponentChildren) {
  return (
    <GlassSurface
      accessibilityLiveRegion="polite"
      overlayColor="rgba(36,27,33,0.74)"
      radius={ui.radii.full}
      shadow="floating"
      style={styles.toast}
      tint="dark"
      variant="floating"
    >
      <Text style={styles.toastText}>{children}</Text>
    </GlassSurface>
  );
}

type ConfirmationDialogProps = {
  cancelLabel?: string;
  confirmLabel?: string;
  destructive?: boolean;
  message: string;
  onCancel: () => void;
  onConfirm: () => void;
  title: string;
  visible: boolean;
};

export function ConfirmationDialog({
  cancelLabel = 'Cancel',
  confirmLabel = 'Confirm',
  destructive = false,
  message,
  onCancel,
  onConfirm,
  title,
  visible,
}: ConfirmationDialogProps) {
  return (
    <Modal
      animationType="fade"
      onRequestClose={onCancel}
      transparent
      visible={visible}
    >
      <View style={styles.dialogOverlay}>
        <GlassSurface
          accessibilityRole="alert"
          shadow="modal"
          style={styles.dialog}
          variant="modal"
        >
          <View style={styles.dialogHeader}>
            <Text accessibilityRole="header" style={styles.dialogTitle}>
              {title}
            </Text>
            <IconButton
              accessibilityLabel="Close dialog"
              icon={X}
              onPress={onCancel}
              variant="plain"
            />
          </View>
          <Text style={styles.body}>{message}</Text>
          <View style={styles.dialogActions}>
            <Button
              compact
              onPress={onCancel}
              title={cancelLabel}
              variant="secondary"
            />
            <Button
              compact
              onPress={onConfirm}
              title={confirmLabel}
              variant={destructive ? 'destructive' : 'primary'}
            />
          </View>
        </GlassSurface>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  banner: {
    borderRadius: ui.radii.xxl,
    borderWidth: 1,
    gap: ui.spacing[2],
    padding: ui.spacing[4],
  },
  body: {
    color: ui.color.text.secondary,
    fontFamily: ui.font.regular,
    fontSize: ui.type.body.fontSize,
    lineHeight: ui.type.body.lineHeight,
  },
  dialog: {
    borderRadius: ui.radii.xxl,
    gap: ui.spacing[4],
    padding: ui.spacing[5],
    width: '100%',
  },
  dialogActions: {
    flexDirection: 'row',
    gap: ui.spacing[3],
    justifyContent: 'flex-end',
  },
  dialogHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: ui.spacing[3],
  },
  dialogOverlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(25,18,28,0.30)',
    flex: 1,
    justifyContent: 'center',
    padding: ui.spacing[6],
  },
  dialogTitle: {
    color: ui.color.text.primary,
    flex: 1,
    fontFamily: ui.font.bold,
    fontSize: ui.type.title.fontSize,
    lineHeight: ui.type.title.lineHeight,
  },
  inlineError: {
    color: ui.color.status.error,
    fontFamily: ui.font.medium,
    fontSize: ui.type.caption.fontSize,
    lineHeight: ui.type.caption.lineHeight,
  },
  snackbar: {
    alignItems: 'center',
    borderRadius: ui.radii.full,
    flexDirection: 'row',
    gap: ui.spacing[3],
    minHeight: ui.minTouch,
    paddingHorizontal: ui.spacing[4],
  },
  snackbarAction: {
    color: ui.color.accent.coral,
    fontFamily: ui.font.bold,
    fontSize: ui.type.label.fontSize,
  },
  snackbarText: {
    color: ui.color.text.inverse,
    flex: 1,
    fontFamily: ui.font.medium,
    fontSize: ui.type.label.fontSize,
    lineHeight: ui.type.label.lineHeight,
  },
  title: {
    fontFamily: ui.font.bold,
    fontSize: ui.type.body.fontSize,
    lineHeight: ui.type.body.lineHeight,
  },
  toast: {
    alignSelf: 'center',
    borderRadius: ui.radii.full,
    paddingHorizontal: ui.spacing[4],
    paddingVertical: ui.spacing[3],
  },
  toastText: {
    color: ui.color.text.inverse,
    fontFamily: ui.font.semibold,
    fontSize: ui.type.label.fontSize,
    lineHeight: ui.type.label.lineHeight,
  },
});
