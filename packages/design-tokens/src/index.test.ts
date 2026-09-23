import { describe, expect, it } from 'vitest';

import {
  colorRoles,
  cssVariableMap,
  cssVariables,
  darkColorRoles,
  motion,
  spacing,
} from './index';

const hexToRgb = (hex: string) => {
  const normalized = hex.replace('#', '');
  const value = Number.parseInt(normalized, 16);

  return {
    b: value & 255,
    g: (value >> 8) & 255,
    r: (value >> 16) & 255,
  };
};

const channel = (value: number) => {
  const srgb = value / 255;

  return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
};

const luminance = (hex: string) => {
  const rgb = hexToRgb(hex);

  return (
    0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b)
  );
};

const contrast = (foreground: string, background: string) => {
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));

  return (lighter + 0.05) / (darker + 0.05);
};

describe('design tokens', () => {
  it('exports the required 4-point spacing scale', () => {
    expect(spacing[0]).toBe(0);
    expect(spacing[16]).toBe(64);
    expect(Object.values(spacing).every((value) => value % 4 === 0)).toBe(true);
  });

  it('exports css variables for semantic roles', () => {
    expect(cssVariableMap['--connecto-color-brand-primary']).toBe(
      colorRoles.brand.primary,
    );
    expect(cssVariableMap['--connecto-motion-duration-control']).toBe(
      String(motion.duration.control),
    );
    expect(
      cssVariableMap['--connecto-motion-spring-responsive-stiffness'],
    ).toBe(String(motion.spring.responsive.stiffness));
    expect(cssVariables).toContain('[data-theme="dark"]');
    expect(cssVariables).toContain('--connecto-color-status-error');
  });

  it('keeps motion tokens within the approved runtime ranges', () => {
    expect(motion.duration.instant).toBeGreaterThanOrEqual(100);
    expect(motion.duration.instant).toBeLessThanOrEqual(120);
    expect(motion.duration.control).toBeGreaterThanOrEqual(160);
    expect(motion.duration.control).toBeLessThanOrEqual(180);
    expect(motion.duration.component).toBeGreaterThanOrEqual(220);
    expect(motion.duration.component).toBeLessThanOrEqual(250);
    expect(motion.duration.screen).toBeGreaterThanOrEqual(280);
    expect(motion.duration.screen).toBeLessThanOrEqual(320);
    expect(motion.duration.sheet).toBeGreaterThanOrEqual(320);
    expect(motion.duration.sheet).toBeLessThanOrEqual(380);
    expect(motion.duration.celebration).toBeGreaterThanOrEqual(900);
    expect(motion.duration.celebration).toBeLessThanOrEqual(1500);
    expect(motion.easing).toHaveProperty('gentle');
    expect(motion.easing).toHaveProperty('responsive');
    expect(motion.easing).toHaveProperty('expressive');
    expect(motion.easing).toHaveProperty('noBounce');
    expect(motion.spring).toHaveProperty('gentle');
    expect(motion.spring).toHaveProperty('responsive');
    expect(motion.spring).toHaveProperty('expressive');
    expect(motion.spring).toHaveProperty('noBounce');
  });

  it('keeps critical light and dark text contrast readable', () => {
    expect(
      contrast(colorRoles.text.primary, colorRoles.background.app),
    ).toBeGreaterThanOrEqual(7);
    expect(
      contrast(darkColorRoles.text.primary, darkColorRoles.background.app),
    ).toBeGreaterThanOrEqual(7);
    expect(
      contrast(colorRoles.status.error, colorRoles.status.errorSoft),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps rank foregrounds readable', () => {
    for (const value of Object.values(colorRoles.rank)) {
      expect(
        contrast(value.foreground, value.background),
      ).toBeGreaterThanOrEqual(4.5);
    }
  });
});
