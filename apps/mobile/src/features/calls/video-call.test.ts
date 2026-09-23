import { describe, expect, it } from 'vitest';

import {
  clampVideoPreviewPosition,
  denormalizeVideoPreviewPosition,
  normalizeVideoPreviewPosition,
  resolveVideoPreviewBounds,
  snapVideoPreviewPosition,
} from './video-call';

describe('video call preview helpers', () => {
  it('clamps and restores preview positions within the available surface bounds', () => {
    const bounds = resolveVideoPreviewBounds({
      containerHeight: 420,
      containerWidth: 320,
      padding: 16,
      previewHeight: 140,
      previewWidth: 100,
    });

    expect(bounds).toEqual({
      maxX: 204,
      maxY: 264,
      minX: 16,
      minY: 16,
    });

    expect(
      clampVideoPreviewPosition(
        {
          x: 400,
          y: -20,
        },
        bounds,
      ),
    ).toEqual({
      x: 204,
      y: 16,
    });

    const resolved = denormalizeVideoPreviewPosition(
      {
        x: 0.5,
        y: 1,
      },
      bounds,
    );
    expect(resolved).toEqual({
      x: 110,
      y: 264,
    });
    expect(normalizeVideoPreviewPosition(resolved, bounds)).toEqual({
      x: 0.5,
      y: 1,
    });
  });

  it('snaps the preview to the nearest safe corner', () => {
    const bounds = resolveVideoPreviewBounds({
      containerHeight: 500,
      containerWidth: 360,
      padding: 20,
      previewHeight: 160,
      previewWidth: 120,
    });

    expect(
      snapVideoPreviewPosition(
        {
          x: 60,
          y: 70,
        },
        bounds,
      ),
    ).toEqual({
      x: 20,
      y: 20,
    });

    expect(
      snapVideoPreviewPosition(
        {
          x: 210,
          y: 310,
        },
        bounds,
      ),
    ).toEqual({
      x: 220,
      y: 320,
    });
  });
});
