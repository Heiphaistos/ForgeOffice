// Classeur de test riche du Tableur : valeurs, formules, formats de nombre, styles, fusions, tableau, mise en forme conditionnelle, graphique.
import { writeWorkbook } from '../../../../packages/xlsx/src/index.ts';
import { richWorkbook } from '../../../../packages/xlsx/tests/fixtures.ts';

export async function excelFixture(): Promise<Uint8Array> {
  const wb = richWorkbook();
  for (const s of wb.sheets) s.protection = undefined;
  const first = wb.sheets[0];
  if (first) first.pageSetup.printArea = undefined;
  return writeWorkbook(wb, 'xlsx');
}
