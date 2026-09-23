import type { ViewStyle } from 'react-native';

import { GlassBackdrop } from './surfaces';
import { ui } from './theme';

export const floatingTabBarBaseContentInset =
  ui.layout.floatingTabBarHeight +
  ui.layout.floatingTabBarBottom +
  ui.layout.floatingTabContentGap;

export const getFloatingTabBarContentInset = (safeAreaBottom: number) =>
  ui.layout.floatingTabBarHeight +
  Math.max(ui.layout.floatingTabBarBottom, safeAreaBottom / 2) +
  ui.layout.floatingTabContentGap +
  safeAreaBottom;

export const getFloatingTabBarStyle = (safeAreaBottom: number): ViewStyle => ({
  ...ui.shadow.nav,
  backgroundColor: 'transparent',
  borderColor: 'transparent',
  borderRadius: 34,
  borderTopWidth: 0,
  borderWidth: 0,
  bottom: Math.max(ui.layout.floatingTabBarBottom, safeAreaBottom / 2),
  height: ui.layout.floatingTabBarHeight,
  left: 16,
  paddingBottom: 8,
  paddingTop: 8,
  position: 'absolute',
  right: 16,
  zIndex: 100,
});

export function FloatingTabBarBackground() {
  return (
    <GlassBackdrop
      blurIntensity={ui.blur.floating + 8}
      borderColor="rgba(255,255,255,0.96)"
      overlayColor="rgba(255,255,255,0.86)"
      radius={34}
      variant="floating"
    />
  );
}
