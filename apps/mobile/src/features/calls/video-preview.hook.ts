import { useEffect, useMemo } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';
import {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import {
  defaultVideoPreviewPosition,
  denormalizeVideoPreviewPosition,
  snapVideoPreviewPosition,
  type VideoPreviewBounds,
  type VideoPreviewPosition,
} from './video-call';

const previewSpring = {
  damping: 18,
  mass: 0.82,
  stiffness: 220,
} as const;

type VideoPreviewDragControllerInput = {
  bounds: VideoPreviewBounds;
  enabled: boolean;
  normalizedPosition: VideoPreviewPosition | null;
  onPersist: (position: VideoPreviewPosition) => void;
  onTouchActivity: () => void;
};

export const useVideoPreviewDragController = ({
  bounds,
  enabled,
  normalizedPosition,
  onPersist,
  onTouchActivity,
}: VideoPreviewDragControllerInput) => {
  const dragStartX = useSharedValue(0);
  const dragStartY = useSharedValue(0);
  const previewX = useSharedValue(0);
  const previewY = useSharedValue(0);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const resolved = denormalizeVideoPreviewPosition(
      normalizedPosition ?? defaultVideoPreviewPosition,
      bounds,
    );
    previewX.value = resolved.x;
    previewY.value = resolved.y;
  }, [bounds, enabled, normalizedPosition, previewX, previewY]);

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(enabled)
        .onBegin(() => {
          dragStartX.value = previewX.value;
          dragStartY.value = previewY.value;
          scheduleOnRN(onTouchActivity);
        })
        .onUpdate((event) => {
          const next = {
            x: Math.max(
              bounds.minX,
              Math.min(bounds.maxX, dragStartX.value + event.translationX),
            ),
            y: Math.max(
              bounds.minY,
              Math.min(bounds.maxY, dragStartY.value + event.translationY),
            ),
          };

          previewX.value = next.x;
          previewY.value = next.y;
        })
        .onEnd(() => {
          const snapped = snapVideoPreviewPosition(
            {
              x: previewX.value,
              y: previewY.value,
            },
            bounds,
          );

          previewX.value = withSpring(snapped.x, previewSpring);
          previewY.value = withSpring(snapped.y, previewSpring);
          scheduleOnRN(onPersist, snapped);
        }),
    [
      bounds,
      dragStartX,
      dragStartY,
      enabled,
      onPersist,
      onTouchActivity,
      previewX,
      previewY,
    ],
  );

  const previewStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: previewX.value }, { translateY: previewY.value }],
  }));

  return {
    gesture,
    previewStyle,
  };
};
