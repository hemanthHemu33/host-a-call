import {
  colorRoles,
  opacity,
  radii,
  spacing,
  typography,
} from '@connecto/design-tokens';

import { fontFamily } from '@/theme/fonts';

const mobileColorRoles = {
  ...colorRoles,
  accent: {
    coral: '#ef6a74',
    coralSoft: 'rgba(239, 106, 116, 0.14)',
  },
  background: {
    app: '#fff6f7',
    elevated: 'rgba(255,255,255,0.34)',
    surface: 'rgba(255,255,255,0.24)',
    surfaceMuted: 'rgba(255,255,255,0.16)',
  },
  brand: {
    primary: '#c93674',
    primaryPressed: '#a92a5f',
    primarySoft: 'rgba(201,54,116,0.14)',
  },
  status: {
    error: '#e25364',
    errorSoft: 'rgba(226,83,100,0.14)',
    info: '#3e6fd9',
    infoSoft: 'rgba(62,111,217,0.16)',
    success: '#17a777',
    successSoft: 'rgba(23,167,119,0.14)',
    warning: '#f4a629',
    warningSoft: 'rgba(244,166,41,0.16)',
  },
  text: {
    primary: '#241b21',
    secondary: '#665c63',
    tertiary: '#8f858c',
    inverse: '#ffffff',
  },
} as const;

const glass = {
  androidSurface: 'rgba(255,255,255,0.56)',
  androidSurfaceFloating: 'rgba(255,255,255,0.86)',
  androidSurfaceModal: 'rgba(255,255,255,0.94)',
  androidSurfaceSoft: 'rgba(255,255,255,0.40)',
  androidSurfaceStrong: 'rgba(255,255,255,0.66)',
  border: 'rgba(255,255,255,0.68)',
  borderStrong: 'rgba(255,255,255,0.88)',
  borderSubtle: 'rgba(255,255,255,0.52)',
  highlight: 'rgba(255,255,255,0.52)',
  surface: 'rgba(255,255,255,0.44)',
  surfaceFloating: 'rgba(255,255,255,0.58)',
  surfaceModal: 'rgba(255,255,255,0.72)',
  surfaceSoft: 'rgba(255,255,255,0.30)',
  surfaceStrong: 'rgba(255,255,255,0.56)',
} as const;

const blur = {
  floating: 36,
  modal: 44,
  standard: 24,
  strong: 34,
  subtle: 16,
} as const;

const shadow = {
  button: {
    elevation: 3,
    shadowColor: '#c93674',
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
  },
  card: {
    elevation: 4,
    shadowColor: '#785E70',
    shadowOffset: { height: 7, width: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
  },
  floating: {
    elevation: 14,
    shadowColor: '#49313f',
    shadowOffset: { height: 13, width: 0 },
    shadowOpacity: 0.24,
    shadowRadius: 28,
  },
  nav: {
    elevation: 18,
    shadowColor: '#3d2934',
    shadowOffset: { height: 15, width: 0 },
    shadowOpacity: 0.28,
    shadowRadius: 32,
  },
  soft: {
    elevation: 2,
    shadowColor: '#785E70',
    shadowOffset: { height: 5, width: 0 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
  },
  none: {
    elevation: 0,
    shadowColor: 'transparent',
    shadowOffset: { height: 0, width: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
  },
} as const;

const layout = {
  floatingActionGap: 16,
  floatingActionReserve: 112,
  floatingTabBarBottom: 12,
  floatingTabBarHeight: 76,
  floatingTabContentGap: 28,
} as const;

export const ui = {
  color: mobileColorRoles,
  blur,
  font: fontFamily,
  glass,
  hitSlop: { bottom: 8, left: 8, right: 8, top: 8 },
  layout,
  minTouch: 44,
  opacity,
  radii,
  shadow,
  spacing,
  type: typography.mobile,
} as const;
