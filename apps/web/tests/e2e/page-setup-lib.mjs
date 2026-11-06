// Outils communs des parcours Mise en page : classeur de test, ouverture par Fichier > Ouvrir, relecture du classeur enregistre.
import { addSheet, createBlankWorkbook, readXlsx, setFormula, setValue, writeXlsx } from '../../../../packages/xlsx/src/index.ts';
import { sleep } from './harness.mjs';

/** Classeur de 120 lignes x 8 colonnes (titres en ligne 1), une erreur (#DIV/0!) en F2 et une note en C3. */
export async function fixture() {
  const wb = createBlankWorkbook();
  const s = wb.sheets[0];
  s.name = 'Ventes';
  const heads = ['Produit', 'Région', 'Janvier', 'Février', 'Mars', 'Total', 'Part', 'Statut'];
  heads.forEach((h, c) => setValue(s, 0, c, h));
  for (let r = 1; r <= 119; r++) {
    setValue(s, r, 0, `Article ${r}`);
    setValue(s, r, 1, ['Nord', 'Sud', 'Est', 'Ouest'][r % 4]);
    for (let c = 2; c <= 4; c++) setValue(s, r, c, r * (c + 1));
    setFormula(s, r, 5, `SUM(C${r + 1}:E${r + 1})`, r * 12);
    setValue(s, r, 6, 0.25);
    setValue(s, r, 7, r % 3 ? 'OK' : 'A revoir');
  }
  setFormula(s, 1, 5, '1/0', null);
  const other = addSheet(wb, 'Autre');
  setValue(other, 0, 0, 'Seconde feuille');
  setValue(other, 1, 0, 42);
  other.pageSetup.paperSize = 11;
  s.notes.push({ ref: { row: 2, col: 2 }, author: 'Equipe', text: 'Valeur a confirmer', visible: true });
  return writeXlsx(wb);
}

export function helpers(b, ok) {
  const fichier = async (entry) => {
    await b.click('text=Fichier');
    await sleep(350);
    await b.clickText('.fo-bs__nav-item, [role=menuitem], .fo-menu button', entry);
    await sleep(500);
  };
  const openFile = async (name, bytes) => {
    await b.pick(name, bytes);
    await fichier('Ouvrir');
    if (await b.ev(`[...document.querySelectorAll('.fo-bs button')].some((e) => e.textContent.trim() === 'Parcourir')`)) await b.clickText('.fo-bs button', 'Parcourir');
    await sleep(2200);
  };
  /** Enregistre en xlsx (telechargement capte) et relit le classeur : c'est le modele reel qui est verifie. */
  const savedModel = async () => {
    await b.ev('window.__dl.splice(0)');
    await fichier('Enregistrer sous');
    await b.clickText('.fo-bs button', 'Enregistrer');
    await sleep(1200);
    const d = await b.downloads();
    const f = d.find((x) => x.name.endsWith('.xlsx'));
    if (!f) throw new Error('aucun telechargement xlsx');
    return readXlsx(new Uint8Array(f.bytes));
  };
  const tab = async (name) => { await b.clickText('[role=tab]', name); await sleep(300); };
  const dialogOpen = () => b.ev(`Boolean(document.querySelector('.fo-dialog'))`);
  const launcher = async () => { await b.click('.fo-rb-launcher'); await sleep(500); };
  const setSelect = (sel, val) => b.ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set; set.call(e, ${JSON.stringify(val)}); e.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  /** Saisie reelle dans un champ : clic, tout selectionner, frappe. */
  const fill = async (sel, text) => { await b.click(sel); await b.key('a', { ctrl: true, commands: ['selectAll'] }); await b.type(text); await sleep(150); };
  const dlgButton = async (label) => { await b.clickText('.fo-dialog button', label); await sleep(500); };
  return { fichier, openFile, savedModel, tab, dialogOpen, launcher, setSelect, fill, dlgButton };
}
