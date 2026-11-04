/** Counts pages in a PDF produced by Chrome (page objects are written uncompressed). */
export function countPdfPages(pdf: Uint8Array): number {
  const text = Buffer.from(pdf).toString('latin1');
  return (text.match(/\/Type\s*\/Page(?![s\w])/g) ?? []).length;
}

export type FitResult = { pdf: Uint8Array; pages: number; scale: number };

/**
 * Renders at decreasing scales until the document fits in `maxPages`.
 * Throws when it still doesn't fit at `minScale`, so an overlong CV fails the build
 * instead of shipping.
 */
export async function fitToPages(
  render: (scale: number) => Promise<Uint8Array>,
  { maxPages = 2, minScale = 0.85, step = 0.03 } = {},
): Promise<FitResult> {
  let last: FitResult | undefined;
  for (let scale = 1; scale >= minScale - 1e-9; scale = Math.round((scale - step) * 100) / 100) {
    const pdf = await render(scale);
    last = { pdf, pages: countPdfPages(pdf), scale };
    if (last.pages <= maxPages) return last;
  }
  throw new Error(
    `CV is ${last?.pages} pages even at ${Math.round(minScale * 100)}% scale (limit ${maxPages}). ` +
      'Shorten it in the CMS: untick "Show on CV" on a project, or trim highlights.',
  );
}
