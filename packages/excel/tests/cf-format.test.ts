// Format d'une regle de mise en forme conditionnelle : modifications de « Format de cellule » -> format differentiel.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createBlankWorkbook } from '@forgeoffice/xlsx';
import { editsToDxf } from '../src/logic/cf-format.ts';

test('police : seuls style, soulignement, barre et couleur sont retenus', () => {
  const wb = createBlankWorkbook();
  const d = editsToDxf(wb, { bold: true, italic: false, underline: 'single', strike: true, fontName: 'Arial', size: 20, color: { rgb: 'FFFF0000' } });
  assert.deepEqual(d.font, { bold: true, underline: 'single', strike: true, color: { rgb: 'FFFF0000' } });
});

test('remplissage uni : couleur posee en avant-plan et en arriere-plan ; aucun motif : rien', () => {
  const wb = createBlankWorkbook();
  const d = editsToDxf(wb, { fill: { type: 'pattern', pattern: 'solid', fg: { rgb: 'FFFFC7CE' } } });
  assert.equal(d.fill?.type, 'pattern');
  assert.deepEqual((d.fill as { fg?: unknown }).fg, { rgb: 'FFFFC7CE' });
  assert.deepEqual((d.fill as { bg?: unknown }).bg, { rgb: 'FFFFC7CE' });
  assert.equal(editsToDxf(wb, { fill: { type: 'pattern', pattern: 'none' } }).fill, undefined);
});

test('bordure : quatre cotes, les traits supprimes sont ignores ; format de nombre enregistre', () => {
  const wb = createBlankWorkbook();
  const edge = { style: 'thin' as const, color: { rgb: 'FF000000' } };
  const d = editsToDxf(wb, { border: { top: edge, bottom: null, left: edge, innerH: edge }, numFmt: '0.00 "€"' });
  assert.deepEqual(d.border, { top: edge, left: edge });
  assert.equal(d.numFmt?.code, '0.00 "€"');
  assert.ok((d.numFmt?.id ?? 0) >= 164, 'format personnalise');
  assert.equal(editsToDxf(wb, { numFmt: 'General' }).numFmt, undefined);
  assert.deepEqual(editsToDxf(wb, {}), {});
});
