const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

export const videoControlAutoHideDelayMs = 3_200;
export const videoRemoteDisconnectGraceMs = 4_000;

export type VideoPreviewBounds = {
  maxX: number;
  maxY: number;
  minX: number;
  minY: number;
};

export type VideoPreviewMetrics = {
  containerHeight: number;
  containerWidth: number;
  padding: number;
  previewHeight: number;
  previewWidth: number;
};

export type VideoPreviewPosition = {
  x: number;
  y: number;
};

export const defaultVideoPreviewPosition: VideoPreviewPosition = {
  x: 1,
  y: 1,
};

export const resolveVideoPreviewBounds = ({
  containerHeight,
  containerWidth,
  padding,
  previewHeight,
  previewWidth,
}: VideoPreviewMetrics): VideoPreviewBounds => {
  const minX = Math.max(0, padding);
  const minY = Math.max(0, padding);
  const maxX = Math.max(minX, containerWidth - previewWidth - padding);
  const maxY = Math.max(minY, containerHeight - previewHeight - padding);

  return {
    maxX,
    maxY,
    minX,
    minY,
  };
};

export const clampVideoPreviewPosition = (
  position: VideoPreviewPosition,
  bounds: VideoPreviewBounds,
): VideoPreviewPosition => ({
  x: Math.max(bounds.minX, Math.min(bounds.maxX, position.x)),
  y: Math.max(bounds.minY, Math.min(bounds.maxY, position.y)),
});

export const denormalizeVideoPreviewPosition = (
  position: VideoPreviewPosition | null,
  bounds: VideoPreviewBounds,
): VideoPreviewPosition => {
  if (position === null) {
    return {
      x: bounds.maxX,
      y: bounds.maxY,
    };
  }

  return {
    x: bounds.minX + clamp01(position.x) * (bounds.maxX - bounds.minX),
    y: bounds.minY + clamp01(position.y) * (bounds.maxY - bounds.minY),
  };
};

export const normalizeVideoPreviewPosition = (
  position: VideoPreviewPosition,
  bounds: VideoPreviewBounds,
): VideoPreviewPosition => ({
  x:
    bounds.maxX === bounds.minX
      ? 0
      : clamp01((position.x - bounds.minX) / (bounds.maxX - bounds.minX)),
  y:
    bounds.maxY === bounds.minY
      ? 0
      : clamp01((position.y - bounds.minY) / (bounds.maxY - bounds.minY)),
});

export const snapVideoPreviewPosition = (
  position: VideoPreviewPosition,
  bounds: VideoPreviewBounds,
): VideoPreviewPosition => {
  const clamped = clampVideoPreviewPosition(position, bounds);
  const midX = bounds.minX + (bounds.maxX - bounds.minX) / 2;
  const midY = bounds.minY + (bounds.maxY - bounds.minY) / 2;

  return {
    x: clamped.x <= midX ? bounds.minX : bounds.maxX,
    y: clamped.y <= midY ? bounds.minY : bounds.maxY,
  };
};

export const formatVideoDisconnectGraceLabel = (remainingMs: number) =>
  `${String(Math.max(0, Math.ceil(remainingMs / 1_000)))}s`;
