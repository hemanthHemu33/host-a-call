import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetModalProvider,
  BottomSheetView,
  type BottomSheetBackgroundProps,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { forwardRef, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { GlassBackdrop } from './surfaces';
import { ui } from './theme';

function BottomSheetGlassBackground({
  pointerEvents,
  style,
}: BottomSheetBackgroundProps) {
  return (
    <View pointerEvents={pointerEvents} style={style}>
      <GlassBackdrop radius={ui.radii.xxl} variant="modal" />
    </View>
  );
}

type BottomSheetWrapperProps = {
  children: ReactNode;
  onDismiss?: () => void;
  snapPoints?: string[];
};

export const BottomSheetWrapper = forwardRef<
  BottomSheetModal,
  BottomSheetWrapperProps
>(function BottomSheetWrapper(
  { children, onDismiss, snapPoints = ['45%', '80%'] },
  ref,
) {
  return (
    <BottomSheetModalProvider>
      <BottomSheetModal
        backdropComponent={(props: BottomSheetBackdropProps) => (
          <BottomSheetBackdrop
            disappearsOnIndex={-1}
            appearsOnIndex={0}
            opacity={0.3}
            {...props}
          />
        )}
        backgroundComponent={BottomSheetGlassBackground}
        backgroundStyle={styles.background}
        handleIndicatorStyle={styles.handle}
        ref={ref}
        snapPoints={snapPoints}
        {...(onDismiss === undefined ? {} : { onDismiss })}
      >
        <BottomSheetView style={styles.content}>{children}</BottomSheetView>
      </BottomSheetModal>
    </BottomSheetModalProvider>
  );
});

const styles = StyleSheet.create({
  background: {
    backgroundColor: 'transparent',
    borderRadius: ui.radii.xxl,
  },
  content: {
    gap: ui.spacing[4],
    padding: ui.spacing[5],
  },
  handle: {
    backgroundColor: 'rgba(110,90,105,0.18)',
  },
});
