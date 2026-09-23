export const colorRoles = {
  accent: {
    coral: '#f06f5f',
    coralSoft: '#fff0ec',
  },
  background: {
    app: '#fff7f2',
    elevated: '#fff1e8',
    surface: '#ffffff',
    surfaceMuted: '#ead9df',
  },
  brand: {
    primary: '#b8326a',
    primaryPressed: '#8f244f',
    primarySoft: '#fde8f1',
  },
  call: {
    backgroundEnd: '#24111b',
    backgroundStart: '#7f2455',
    controlSurface: '#fff7fa',
    videoOverlay: 'rgba(36, 17, 27, 0.72)',
  },
  rank: {
    bronze: {
      background: '#8a5a3b',
      foreground: '#fff8f2',
    },
    diamond: {
      background: '#d7f4ff',
      foreground: '#12313d',
    },
    gold: {
      background: '#f3c84b',
      foreground: '#2f2400',
    },
    platinum: {
      background: '#dce3ea',
      foreground: '#202a33',
    },
    silver: {
      background: '#c9d1d9',
      foreground: '#202a33',
    },
  },
  status: {
    error: '#b4234b',
    errorSoft: '#fff0f4',
    info: '#3867d6',
    infoSoft: '#edf3ff',
    success: '#16765a',
    successSoft: '#e8f7f1',
    warning: '#9a5b08',
    warningSoft: '#fff4d8',
  },
  text: {
    primary: '#24161d',
    secondary: '#63515a',
    tertiary: '#846f78',
    inverse: '#fff7f2',
  },
} as const;

export const darkColorRoles = {
  ...colorRoles,
  accent: {
    coral: '#ff9a8c',
    coralSoft: '#4a211d',
  },
  background: {
    app: '#160d12',
    elevated: '#2b1b24',
    surface: '#21151c',
    surfaceMuted: '#3a2831',
  },
  brand: {
    primary: '#ff7eac',
    primaryPressed: '#ffb0ca',
    primarySoft: '#4a1c31',
  },
  call: {
    backgroundEnd: '#070306',
    backgroundStart: '#45142d',
    controlSurface: '#21151c',
    videoOverlay: 'rgba(7, 3, 6, 0.78)',
  },
  status: {
    error: '#ffb2c6',
    errorSoft: '#451422',
    info: '#a9c6ff',
    infoSoft: '#17284e',
    success: '#8bdcbe',
    successSoft: '#123327',
    warning: '#ffd47c',
    warningSoft: '#342408',
  },
  text: {
    primary: '#fff8fb',
    secondary: '#dbc9d1',
    tertiary: '#bba6b0',
    inverse: '#24161d',
  },
} as const;

export const colors = {
  accent: colorRoles.accent.coral,
  accentSoft: colorRoles.accent.coralSoft,
  background: colorRoles.background.app,
  border: '#d8d0c4',
  brand: colorRoles.brand.primary,
  brandPressed: colorRoles.brand.primaryPressed,
  brandSoft: colorRoles.brand.primarySoft,
  brandStrong: colorRoles.brand.primaryPressed,
  danger: colorRoles.status.error,
  dangerSoft: colorRoles.status.errorSoft,
  elevatedBackground: colorRoles.background.elevated,
  error: colorRoles.status.error,
  errorSoft: colorRoles.status.errorSoft,
  focus: colorRoles.status.info,
  info: colorRoles.status.info,
  infoSoft: colorRoles.status.infoSoft,
  surface: colorRoles.background.surface,
  surfaceMuted: colorRoles.background.surfaceMuted,
  success: colorRoles.status.success,
  successSoft: colorRoles.status.successSoft,
  text: colorRoles.text.primary,
  textMuted: colorRoles.text.secondary,
  textPrimary: colorRoles.text.primary,
  textSecondary: colorRoles.text.secondary,
  textTertiary: colorRoles.text.tertiary,
  warning: colorRoles.status.warning,
  warningSoft: colorRoles.status.warningSoft,
} as const;

export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  7: 28,
  8: 32,
  9: 36,
  10: 40,
  11: 44,
  12: 48,
  13: 52,
  14: 56,
  15: 60,
  16: 64,
} as const;

export const gutters = {
  mobileCompact: 16,
  mobileRegular: 20,
  mobileExpanded: 24,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 999,
  round: 999,
} as const;

export const typography = {
  admin: {
    display: { fontSize: 64, lineHeight: 68 },
    headline: { fontSize: 40, lineHeight: 46 },
    title: { fontSize: 28, lineHeight: 34 },
    body: { fontSize: 16, lineHeight: 24 },
    label: { fontSize: 13, lineHeight: 18 },
    caption: { fontSize: 12, lineHeight: 16 },
  },
  family: {
    admin:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    mobile: 'Inter_400Regular',
  },
  lineHeight: {
    caption: 16,
    body: 24,
    title: 32,
    headline: 40,
  },
  mobile: {
    display: { fontSize: 36, lineHeight: 40 },
    headline: { fontSize: 28, lineHeight: 34 },
    title: { fontSize: 21, lineHeight: 27 },
    body: { fontSize: 15, lineHeight: 21 },
    label: { fontSize: 13, lineHeight: 18 },
    caption: { fontSize: 12, lineHeight: 16 },
  },
  numberStyle: {
    fontVariant: ['tabular-nums'],
    guidance: 'Use tabular numbers for balances, timers, rates, and rankings.',
  },
  size: {
    caption: 12,
    body: 16,
    title: 24,
    headline: 32,
  },
  weight: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
} as const;

export const elevation = {
  none: {
    android: { elevation: 0 },
    ios: {
      shadowColor: 'transparent',
      shadowOffset: { height: 0, width: 0 },
      shadowOpacity: 0,
      shadowRadius: 0,
    },
    web: 'none',
  },
  card: {
    android: { elevation: 2 },
    ios: {
      shadowColor: '#17201b',
      shadowOffset: { height: 2, width: 0 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
    },
    web: '0 2px 8px rgba(23, 32, 27, 0.08)',
  },
  raised: {
    android: { elevation: 6 },
    ios: {
      shadowColor: '#17201b',
      shadowOffset: { height: 8, width: 0 },
      shadowOpacity: 0.12,
      shadowRadius: 24,
    },
    web: '0 8px 24px rgba(23, 32, 27, 0.12)',
  },
} as const;

export const shadows = {
  none: elevation.none.web,
  subtle: elevation.card.web,
  raised: elevation.raised.web,
} as const;

export const zIndex = {
  base: 0,
  contentRaised: 5,
  navigation: 10,
  sticky: 20,
  overlay: 100,
  modal: 200,
  toast: 300,
} as const;

export const breakpoints = {
  admin: {
    sm: 640,
    md: 768,
    lg: 1024,
    xl: 1280,
  },
  mobile: {
    compact: 360,
    regular: 390,
    tablet: 768,
  },
} as const;

export const motion = {
  duration: {
    celebration: 1200,
    component: 240,
    control: 170,
    instant: 110,
    screen: 300,
    sheet: 360,
  },
  easing: {
    expressive: 'cubic-bezier(0.16, 1, 0.3, 1)',
    gentle: 'cubic-bezier(0.22, 1, 0.36, 1)',
    noBounce: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
    responsive: 'cubic-bezier(0.2, 0, 0, 1)',
  },
  spring: {
    expressive: {
      damping: 15,
      mass: 0.9,
      stiffness: 320,
    },
    gentle: {
      damping: 20,
      mass: 1,
      stiffness: 180,
    },
    noBounce: {
      damping: 28,
      mass: 1,
      stiffness: 260,
    },
    responsive: {
      damping: 18,
      mass: 0.95,
      stiffness: 250,
    },
  },
} as const;

export const opacity = {
  disabled: 0.48,
  overlay: 0.72,
  pressed: 0.84,
  subtle: 0.64,
} as const;

export const mobileThemes = {
  dark: darkColorRoles,
  light: colorRoles,
} as const;

export const adminThemes = {
  dark: darkColorRoles,
  light: colorRoles,
} as const;

const cssVarName = (path: string[]) =>
  `--connecto-${path
    .join('-')
    .replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`)}`;

const flattenCssVariables = (
  value: unknown,
  path: string[] = [],
): Record<string, string> => {
  if (typeof value === 'string' || typeof value === 'number') {
    return { [cssVarName(path)]: String(value) };
  }

  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return Object.entries(value).reduce<Record<string, string>>(
      (variables, [key, child]) => ({
        ...variables,
        ...flattenCssVariables(child, [...path, key]),
      }),
      {},
    );
  }

  return {};
};

export const cssVariableMap = {
  ...flattenCssVariables(colorRoles, ['color']),
  ...flattenCssVariables(spacing, ['space']),
  ...flattenCssVariables(gutters, ['gutter']),
  ...flattenCssVariables(radii, ['radius']),
  ...flattenCssVariables(zIndex, ['z']),
  ...flattenCssVariables(opacity, ['opacity']),
  ...flattenCssVariables(motion.duration, ['motion', 'duration']),
  ...flattenCssVariables(motion.easing, ['motion', 'easing']),
  ...flattenCssVariables(motion.spring, ['motion', 'spring']),
} as const;

export const darkCssVariableMap = flattenCssVariables(darkColorRoles, [
  'color',
]);

const cssLines = (variables: Record<string, string>) =>
  Object.entries(variables)
    .map(([key, value]) => `  ${key}: ${value};`)
    .join('\n');

export const cssVariables = `:root {\n${cssLines(cssVariableMap)}\n}\n\n[data-theme="dark"] {\n${cssLines(darkCssVariableMap)}\n}`;

export const tokens = {
  adminThemes,
  breakpoints,
  colors,
  colorRoles,
  cssVariableMap,
  darkColorRoles,
  elevation,
  gutters,
  mobileThemes,
  motion,
  opacity,
  radii,
  shadows,
  spacing,
  typography,
  zIndex,
} as const;

export type DesignTokens = typeof tokens;
