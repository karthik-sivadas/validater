export interface ViewportConfig {
  name: string;
  width: number;
  height: number;
  deviceScaleFactor: number;
  isMobile: boolean;
  hasTouch: boolean;
}

export const VIEWPORT_PRESETS: Record<string, ViewportConfig> = {
  desktop: { name: 'desktop', width: 1920, height: 1080, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
  tablet: { name: 'tablet', width: 768, height: 1024, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  mobile: { name: 'mobile', width: 375, height: 812, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
};

export const DEFAULT_VIEWPORTS = ['desktop', 'tablet', 'mobile'] as const;
