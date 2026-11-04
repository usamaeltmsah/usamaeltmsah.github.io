/**
 * Plain-text equivalents for symbols outside the CV's Latin font ("4.8★" → "4.8/5", "→" → "to").
 * Such symbols fall back to system fonts that Chrome embeds as Type3, which many ATS can't read.
 * Shared by the CV page and the ATS check so they always agree.
 */
export const plainText = (s: string): string =>
  s.replace(/(\d(?:\.\d)?)★/g, '$1/5').replace(/★/g, '').replace(/\s*→\s*/g, ' to ').trim();
