import { describe, it, expect } from 'vitest';
import { VIEWPORT_PRESETS, DEFAULT_VIEWPORTS } from '../viewport-presets.js';

describe('VIEWPORT_PRESETS', () => {
  it('has desktop preset with 1920x1080', () => {
    expect(VIEWPORT_PRESETS.desktop).toBeDefined();
    expect(VIEWPORT_PRESETS.desktop!.width).toBe(1920);
    expect(VIEWPORT_PRESETS.desktop!.height).toBe(1080);
    expect(VIEWPORT_PRESETS.desktop!.isMobile).toBe(false);
    expect(VIEWPORT_PRESETS.desktop!.hasTouch).toBe(false);
  });

  it('has tablet preset with 768x1024', () => {
    expect(VIEWPORT_PRESETS.tablet).toBeDefined();
    expect(VIEWPORT_PRESETS.tablet!.width).toBe(768);
    expect(VIEWPORT_PRESETS.tablet!.height).toBe(1024);
    expect(VIEWPORT_PRESETS.tablet!.isMobile).toBe(true);
    expect(VIEWPORT_PRESETS.tablet!.hasTouch).toBe(true);
  });

  it('has mobile preset with 375x812', () => {
    expect(VIEWPORT_PRESETS.mobile).toBeDefined();
    expect(VIEWPORT_PRESETS.mobile!.width).toBe(375);
    expect(VIEWPORT_PRESETS.mobile!.height).toBe(812);
    expect(VIEWPORT_PRESETS.mobile!.isMobile).toBe(true);
    expect(VIEWPORT_PRESETS.mobile!.hasTouch).toBe(true);
  });

  it('each preset has name, width, height, deviceScaleFactor, isMobile, hasTouch', () => {
    for (const [key, preset] of Object.entries(VIEWPORT_PRESETS)) {
      expect(preset.name).toBe(key);
      expect(typeof preset.width).toBe('number');
      expect(typeof preset.height).toBe('number');
      expect(typeof preset.deviceScaleFactor).toBe('number');
      expect(typeof preset.isMobile).toBe('boolean');
      expect(typeof preset.hasTouch).toBe('boolean');
    }
  });
});

describe('DEFAULT_VIEWPORTS', () => {
  it('contains desktop, tablet, mobile', () => {
    expect(DEFAULT_VIEWPORTS).toContain('desktop');
    expect(DEFAULT_VIEWPORTS).toContain('tablet');
    expect(DEFAULT_VIEWPORTS).toContain('mobile');
  });

  it('has exactly 3 entries', () => {
    expect(DEFAULT_VIEWPORTS).toHaveLength(3);
  });
});
