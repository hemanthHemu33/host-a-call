import { breakpoints, gutters, spacing } from '@connecto/design-tokens';

export type MobileWindowClass =
  'compactPhone' | 'standardPhone' | 'largePhone' | 'tablet';

export type LogicalHorizontalSpacing = {
  paddingLeft: number;
  paddingRight: number;
};

export const getMobileWindowClass = (width: number): MobileWindowClass => {
  if (width >= breakpoints.mobile.tablet) {
    return 'tablet';
  }

  if (width >= 430) {
    return 'largePhone';
  }

  if (width >= breakpoints.mobile.regular) {
    return 'standardPhone';
  }

  return 'compactPhone';
};

export const getGutterForWidth = (width: number) => {
  const windowClass = getMobileWindowClass(width);

  if (windowClass === 'compactPhone') {
    return gutters.mobileCompact;
  }

  if (windowClass === 'tablet') {
    return gutters.mobileExpanded;
  }

  return gutters.mobileRegular;
};

export const getReadableContentWidth = (width: number) => {
  const gutter = getGutterForWidth(width);
  const availableWidth = width - gutter * 2;

  if (getMobileWindowClass(width) === 'tablet') {
    return Math.min(availableWidth, 720);
  }

  return availableWidth;
};

export const getLogicalHorizontalPadding = (
  start: number = spacing[0],
  end: number = start,
  isRTL = false,
): LogicalHorizontalSpacing => ({
  paddingLeft: isRTL ? end : start,
  paddingRight: isRTL ? start : end,
});
