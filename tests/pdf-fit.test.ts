import { describe, expect, it } from 'vitest';
import { countPdfPages, fitToPages } from '../scripts/pdf-fit.ts';

/** Minimal stand-in for Chrome's output: one page object per page plus the page tree. */
const fakePdf = (pages: number) =>
  new TextEncoder().encode(`%PDF-1.4\n<< /Type /Pages /Count ${pages} >>\n${'<< /Type /Page /Parent 1 0 R >>\n'.repeat(pages)}`);

describe('countPdfPages', () => {
  it('counts page objects but not the page tree', () => {
    expect(countPdfPages(fakePdf(3))).toBe(3);
    expect(countPdfPages(fakePdf(1))).toBe(1);
  });
});

describe('fitToPages', () => {
  it('keeps full scale when the document already fits', async () => {
    const r = await fitToPages(async () => fakePdf(2));
    expect(r).toMatchObject({ pages: 2, scale: 1 });
  });

  it('shrinks step by step until it fits', async () => {
    const tried: number[] = [];
    const r = await fitToPages(async (s) => (tried.push(s), fakePdf(s > 0.92 ? 3 : 2)));
    expect(tried).toEqual([1, 0.97, 0.94, 0.91]);
    expect(r).toMatchObject({ pages: 2, scale: 0.91 });
  });

  it('fails with guidance when it cannot fit at the minimum scale', async () => {
    await expect(fitToPages(async () => fakePdf(3))).rejects.toThrow(/3 pages even at 85% scale.*Show on CV/);
  });
});
