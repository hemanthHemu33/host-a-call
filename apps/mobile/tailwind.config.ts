import {
  colorRoles,
  darkColorRoles,
  gutters,
  radii,
  spacing,
  typography,
  zIndex,
} from '@connecto/design-tokens';
import nativeWindPreset from 'nativewind/preset';
import type { Config } from 'tailwindcss';

const px = (value: number) => `${String(value)}px`;

const config = {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: 'media',
  presets: [nativeWindPreset],
  theme: {
    extend: {
      borderRadius: {
        full: px(radii.full),
        lg: px(radii.lg),
        md: px(radii.md),
        sm: px(radii.sm),
        xl: px(radii.xl),
        xxl: px(radii.xxl),
      },
      colors: {
        accent: {
          coral: colorRoles.accent.coral,
          soft: colorRoles.accent.coralSoft,
        },
        background: {
          app: colorRoles.background.app,
          dark: darkColorRoles.background.app,
          elevated: colorRoles.background.elevated,
        },
        brand: {
          primary: colorRoles.brand.primary,
          pressed: colorRoles.brand.primaryPressed,
          soft: colorRoles.brand.primarySoft,
        },
        call: {
          control: colorRoles.call.controlSurface,
          end: colorRoles.call.backgroundEnd,
          overlay: colorRoles.call.videoOverlay,
          start: colorRoles.call.backgroundStart,
        },
        rank: colorRoles.rank,
        status: colorRoles.status,
        surface: {
          DEFAULT: colorRoles.background.surface,
          muted: colorRoles.background.surfaceMuted,
        },
        text: colorRoles.text,
      },
      fontFamily: {
        inter: [
          'Inter_400Regular',
          'Inter_500Medium',
          'Inter_600SemiBold',
          'Inter_700Bold',
          typography.family.mobile,
        ],
      },
      fontSize: {
        body: [
          px(typography.mobile.body.fontSize),
          px(typography.mobile.body.lineHeight),
        ],
        caption: [
          px(typography.mobile.caption.fontSize),
          px(typography.mobile.caption.lineHeight),
        ],
        display: [
          px(typography.mobile.display.fontSize),
          px(typography.mobile.display.lineHeight),
        ],
        headline: [
          px(typography.mobile.headline.fontSize),
          px(typography.mobile.headline.lineHeight),
        ],
        label: [
          px(typography.mobile.label.fontSize),
          px(typography.mobile.label.lineHeight),
        ],
        title: [
          px(typography.mobile.title.fontSize),
          px(typography.mobile.title.lineHeight),
        ],
      },
      screens: {
        compact: '360px',
        standard: '390px',
        tablet: '768px',
      },
      spacing: {
        ...Object.fromEntries(
          Object.entries(spacing).map(([key, value]) => [key, px(value)]),
        ),
        gutter: px(gutters.mobileRegular),
        'gutter-compact': px(gutters.mobileCompact),
        'gutter-expanded': px(gutters.mobileExpanded),
      },
      zIndex: Object.fromEntries(
        Object.entries(zIndex).map(([key, value]) => [key, String(value)]),
      ),
    },
  },
} satisfies Config;

export default config;
