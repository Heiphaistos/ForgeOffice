import assert from 'node:assert/strict';
import { test } from 'node:test';
import { printCss } from '../src/printpages.ts';

test('printCss : une page nommee par taille, interface masquee a l impression', () => {
  const css = printCss([{ w: 595, h: 842 }, { w: 842, h: 595 }]);
  assert.match(css, /@page pdfp0 \{ size: 595pt 842pt; margin: 0; \}/);
  assert.match(css, /@page pdfp1 \{ size: 842pt 595pt; margin: 0; \}/);
  assert.match(css, /nth-child\(2\) \{ page: pdfp1;/);
  assert.match(css, /body > \*:not\(\.pdf-print\) \{ display: none !important; \}/);
});
