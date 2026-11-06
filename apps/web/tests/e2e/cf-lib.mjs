// Outils communs des parcours « Mise en forme conditionnelle » : classeur de test, ouverture, relecture du classeur enregistre.
import { addSheet, createBlankWorkbook, setFormula, setValue, writeXlsx } from '../../../../packages/xlsx/src/index.ts';
import { sleep } from './harness.mjs';
import { helpers } from './page-setup-lib.mjs';

const rgb = (hex) => ({ rgb: `FF${hex}` });

/** Classeur : 12 lignes de valeurs, MFC existantes (barres, nuances, icones), sparkline, note, formule, 2e feuille en apercu des sauts. */
export async function paintFixture() {
  const wb = createBlankWorkbook();
  const s = wb.sheets[0];
  s.name = 'Ventes';
  for (let r = 0; r < 12; r++) {
    setValue(s, r, 0, (r + 1) * 7 - 20);
    setValue(s, r, 1, ((r * 37) % 90) + 5);
    setValue(s, r, 2, r * 9);
    setValue(s, r, 3, `Texte ${r + 1}`);
  }
  setFormula(s, 0, 5, 'SUM(A1:C1)', 0);
  s.conditionalFormats.push(
    { ranges: [{ r1: 0, c1: 0, r2: 11, c2: 0 }], rules: [{ type: 'dataBar', priority: 1, dataBar: { cfvos: [{ type: 'min' }, { type: 'max' }], color: rgb('638EC6'), gradient: true } }] },
    { ranges: [{ r1: 0, c1: 1, r2: 11, c2: 1 }], rules: [{ type: 'colorScale', priority: 2, colorScale: { cfvos: [{ type: 'min' }, { type: 'percentile', value: '50' }, { type: 'max' }], colors: [rgb('F8696B'), rgb('FFEB84'), rgb('63BE7B')] } }] },
    { ranges: [{ r1: 0, c1: 2, r2: 11, c2: 2 }], rules: [{ type: 'iconSet', priority: 3, iconSet: { iconSet: '3Arrows', cfvos: [{ type: 'percent', value: '0' }, { type: 'percent', value: '33' }, { type: 'percent', value: '67' }] } }] },
  );
  s.sparklineGroups.push({ type: 'column', sparklines: [{ source: 'Ventes!A1:C1', location: { row: 2, col: 5 } }] });
  s.notes.push({ ref: { row: 4, col: 3 }, author: 'Equipe', text: 'Une note', visible: false });
  const t = addSheet(wb, 'Sauts');
  for (let r = 0; r < 70; r++) for (let c = 0; c < 8; c++) setValue(t, r, c, r * c);
  t.view.view = 'pageBreakPreview';
  return writeXlsx(wb);
}

export { helpers, sleep };
