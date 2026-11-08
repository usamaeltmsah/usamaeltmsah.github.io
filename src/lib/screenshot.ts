/* App screenshots render up to ~250 CSS px wide on 2x and 3x screens, so anything
   narrower than this looks soft or pixelated. Such shots are left out rather than
   shown blurry; the project still appears, just without a phone mockup. */
export const MIN_SCREENSHOT_WIDTH = 700;

export const sharp = <T extends { width: number }>(meta: T | undefined): T | undefined =>
  meta && meta.width >= MIN_SCREENSHOT_WIDTH ? meta : undefined;
