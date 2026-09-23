import { describe, expect, it } from 'vitest';

import {
  getGutterForWidth,
  getLogicalHorizontalPadding,
  getMobileWindowClass,
  getReadableContentWidth,
} from './responsive-core';

describe('mobile responsive layout helpers', () => {
  it('classifies compact, standard, large, and tablet widths', () => {
    expect(getMobileWindowClass(320)).toBe('compactPhone');
    expect(getMobileWindowClass(390)).toBe('standardPhone');
    expect(getMobileWindowClass(430)).toBe('largePhone');
    expect(getMobileWindowClass(768)).toBe('tablet');
  });

  it('uses token gutters by window class', () => {
    expect(getGutterForWidth(320)).toBe(16);
    expect(getGutterForWidth(390)).toBe(20);
    expect(getGutterForWidth(768)).toBe(24);
  });

  it('caps readable content on tablet layouts', () => {
    expect(getReadableContentWidth(390)).toBe(350);
    expect(getReadableContentWidth(1024)).toBe(720);
  });

  it('maps logical start and end padding for RTL', () => {
    expect(getLogicalHorizontalPadding(16, 24, false)).toEqual({
      paddingLeft: 16,
      paddingRight: 24,
    });
    expect(getLogicalHorizontalPadding(16, 24, true)).toEqual({
      paddingLeft: 24,
      paddingRight: 16,
    });
  });
});
