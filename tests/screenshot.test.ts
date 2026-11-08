import { describe, expect, it } from 'vitest';
import { MIN_SCREENSHOT_WIDTH, sharp } from '../src/lib/screenshot';

describe('sharp', () => {
  it('keeps screenshots wide enough for retina phones', () => {
    const shot = { width: MIN_SCREENSHOT_WIDTH };
    expect(sharp(shot)).toBe(shot);
    expect(sharp({ width: 1179 })).toEqual({ width: 1179 });
  });

  it('drops low-resolution or missing screenshots', () => {
    expect(sharp({ width: 470 })).toBeUndefined();
    expect(sharp({ width: 200 })).toBeUndefined();
    expect(sharp(undefined)).toBeUndefined();
  });
});
