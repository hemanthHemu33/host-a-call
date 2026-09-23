import { I18nManager, useWindowDimensions } from 'react-native';

import {
  getGutterForWidth,
  getLogicalHorizontalPadding as getLogicalHorizontalPaddingCore,
  getMobileWindowClass,
  getReadableContentWidth,
  type LogicalHorizontalSpacing,
} from './responsive-core';

export const getLogicalHorizontalPadding = (
  start?: number,
  end?: number,
  isRTL = I18nManager.isRTL,
): LogicalHorizontalSpacing =>
  getLogicalHorizontalPaddingCore(start, end, isRTL);

export const useResponsiveLayout = () => {
  const { fontScale, height, width } = useWindowDimensions();
  const windowClass = getMobileWindowClass(width);

  return {
    fontScale,
    gutter: getGutterForWidth(width),
    isLandscape: width > height,
    isTablet: windowClass === 'tablet',
    readableContentWidth: getReadableContentWidth(width),
    windowClass,
  };
};
