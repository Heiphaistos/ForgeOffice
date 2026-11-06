// Impression : pages (papier, marges, en-tete et pied de page, titres a repeter, quadrillage, en-tetes de ligne/colonne,
// noir et blanc, erreurs, commentaires), apercu du Backstage et document imprime (pages HTML, masque a l'ecran).
import { createPortal } from 'react-dom';
import { useEffect, type CSSProperties, type KeyboardEvent, type ReactElement } from 'react';
import { FormulaError, type Scalar } from '@forgeoffice/formulas';
import { columnName, type CellRange, type Sheet, type Workbook } from '@forgeoffice/xlsx';
import { axisSize, colAxis, rowAxis, type Axis } from '../logic/geometry.ts';
import { cellLook } from '../logic/look.ts';
import { inheritedStyle } from '../logic/styles.ts';
import { pageBreakInfo, paginate, printRange, printRanges, type BreakInfo, type PrintPage } from '../logic/pagebreaks.ts';
import { pageDims, paperById, parseHeaderFooter, type HfContext, type HfRun } from '../logic/pagesetup.ts';
import { PS } from '../strings/index.ts';
import './page-setup/page-setup.css';

export { paginate, printRange, printRanges, type PrintPage };

/** Taille de la page (pixels, 96 ppp). */
export const pageSize = (sheet: Sheet): { w: number; h: number } => pageDims(sheet.pageSetup);

/** Traits de l'apercu des sauts de page (automatiques, manuels, zones, numeros). */
export const pageBreakLines = (sheet: Sheet): BreakInfo | null => pageBreakInfo(sheet);

export interface PageViewProps {
  wb: Workbook;
  sheet: Sheet;
  page: PrintPage;
  scale: number;
  value: (row: number, col: number) => Scalar;
  zoom?: number;
  /** Nom du fichier pour le champ &[Fichier]. */
  fileName?: string;
  /** Date de l'impression (champs &[Date] / &[Heure]) ; fixee par l'appelant pour un rendu stable. */
  now?: Date;
  /** Vue Mise en page : rend l'en-tete / le pied cliquables (zone vide = invitation). */
  onEditHeaderFooter?: (zone: 'header' | 'footer') => void;
  /** Vue Mise en page : quadrillage et en-tetes de ligne/colonne affiches a l'ecran (en plus des options d'impression). */
  show?: { grid: boolean; headings: boolean };
}

const HEADING_W = 32;

const borderCss = (e: { style: string; color: string } | undefined): string | undefined =>
  e ? `${e.style === 'medium' || e.style === 'thick' ? 2 : 1}px ${e.style === 'double' ? 'double' : e.style.includes('ash') || e.style === 'dotted' || e.style === 'hair' ? 'dashed' : 'solid'} ${e.color}` : undefined;

/** Texte brut d'en-tete / pied de page choisi pour la page (premiere page, paires / impaires). */
export function hfRaw(sheet: Sheet, page: PrintPage, kind: 'Header' | 'Footer'): string {
  const hf = sheet.pageSetup.headerFooter;
  if (!hf) return '';
  const first = page.number === (sheet.pageSetup.firstPageNumber ?? 1);
  if (hf.differentFirst && first) return (kind === 'Header' ? hf.firstHeader : hf.firstFooter) ?? '';
  if (hf.differentOddEven && page.number % 2 === 0) return (kind === 'Header' ? hf.evenHeader : hf.evenFooter) ?? '';
  return (kind === 'Header' ? hf.oddHeader : hf.oddFooter) ?? '';
}

function runStyle(r: HfRun, k: number): CSSProperties {
  const lines = [r.underline ? 'underline' : '', r.strike ? 'line-through' : ''].filter(Boolean).join(' ');
  return {
    fontWeight: r.bold ? 700 : undefined,
    fontStyle: r.italic ? 'italic' : undefined,
    textDecoration: lines || undefined,
    textDecorationStyle: r.underline === 'double' ? 'double' : undefined,
    fontSize: r.size ? ((r.size * 4) / 3) * k : undefined,
    fontFamily: r.font,
    color: r.color ? `#${r.color}` : undefined,
    verticalAlign: r.sup ? 'super' : r.sub ? 'sub' : undefined,
  };
}

interface BandProps { raw: string; ctx: HfContext; k: number; kind: 'header' | 'footer'; style: CSSProperties; onEdit: ((zone: 'header' | 'footer') => void) | undefined }

function HeaderFooterBand({ raw, ctx, k, kind, style, onEdit }: BandProps) {
  const sec = parseHeaderFooter(raw, ctx);
  const empty = !raw;
  if (empty && !onEdit) return null;
  const edit = onEdit
    ? { role: 'button', tabIndex: 0, 'aria-label': kind === 'header' ? PS.addHeader : PS.addFooter, onClick: () => onEdit(kind), onKeyDown: (e: KeyboardEvent) => { if (e.key === 'Enter') onEdit(kind); } }
    : {};
  return (
    <div className={`xl-hf xl-hf--${kind}${onEdit ? ' is-editable' : ''}`} style={{ ...style, fontSize: 14.6667 * k }} data-zone={kind} {...edit}>
      {empty ? <span className="xl-hf__hint">{kind === 'header' ? PS.addHeader : PS.addFooter}</span> : (['left', 'center', 'right'] as const).map((z) => (
        <div key={z} className={`xl-hf__${z}`}>{sec[z].map((r, i) => <span key={i} style={runStyle(r, k)}>{r.text}</span>)}</div>
      ))}
    </div>
  );
}

const errorText = (mode: Sheet['pageSetup']['errors'], text: string): string => (mode === 'blank' ? '' : mode === 'dash' ? '--' : mode === 'NA' ? '#N/A' : text);
const offsetOf = (list: number[], axis: Axis, upTo: number): number => list.reduce((s, i) => (i < upTo ? s + axisSize(axis, i) : s), 0);

/** Une page imprimee (tableau HTML fidele a la grille, avec en-tete et pied de page). */
export function PageView({ wb, sheet, page, scale, value, zoom = 1, fileName = '', now, onEditHeaderFooter, show }: PageViewProps) {
  const ps = sheet.pageSetup;
  const { w, h } = pageSize(sheet);
  const m = ps.margins;
  const rows = rowAxis(sheet);
  const cols = colAxis(sheet);
  const availW = Math.max(0, w - (m.left + m.right) * 96);
  const availH = Math.max(0, h - (m.top + m.bottom) * 96);
  const heads = !!ps.printHeadings || !!show?.headings;
  const hf = ps.headerFooter;
  const k = hf?.scaleWithDoc === false ? 1 : scale;
  const sideL = hf?.alignWithMargins === false ? 0 : m.left * 96;
  const sideR = hf?.alignWithMargins === false ? 0 : m.right * 96;
  const ctx: HfContext = { page: page.number, pages: page.total, now: now ?? new Date(), file: fileName && !/.w+$/.test(fileName) ? `${fileName}.xlsx` : fileName, path: '', sheet: sheet.name };
  const contentW = (page.cols.reduce((s, c) => s + axisSize(cols, c), 0) + (heads ? HEADING_W : 0)) * scale;
  const contentH = (page.rows.reduce((s, r) => s + axisSize(rows, r), 0) + (heads ? 19 : 0)) * scale;
  const offX = ps.horizontalCentered ? Math.max(0, (availW - contentW) / 2) : 0;
  const offY = ps.verticalCentered ? Math.max(0, (availH - contentH) / 2) : 0;
  const bands = (
    <>
      <HeaderFooterBand raw={hfRaw(sheet, page, 'Header')} ctx={ctx} k={k} kind="header" style={{ top: m.header * 96, left: sideL, right: sideR }} onEdit={onEditHeaderFooter} />
      <HeaderFooterBand raw={hfRaw(sheet, page, 'Footer')} ctx={ctx} k={k} kind="footer" style={{ bottom: m.footer * 96, left: sideL, right: sideR }} onEdit={onEditHeaderFooter} />
    </>
  );
  const frame = (children: ReactElement): ReactElement => (
    <div className="xl-page" style={{ width: w * zoom, height: h * zoom }} data-page={page.number}>
      <div className="xl-page__sheet" style={{ width: w, height: h, transform: `scale(${zoom})` }}>{children}{bands}</div>
    </div>
  );
  if (page.comments) {
    return frame(
      <div className="xl-page__comments" style={{ left: m.left * 96, top: m.top * 96, width: availW }}>
        <h3>{PS.commentsTitle}</h3>
        {page.comments.map((c, i) => <p key={i}><b>{c.cell}</b> {c.author ? `${c.author} : ` : ''}{c.text}</p>)}
      </div>,
    );
  }
  const notes = ps.cellComments === 'asDisplayed' ? sheet.notes.filter((n) => n.visible && page.rows.includes(n.ref.row) && page.cols.includes(n.ref.col)) : [];
  return frame(
    <div className="xl-page__area" style={{ left: m.left * 96, top: m.top * 96, width: availW, height: availH }}>
      <div className={ps.blackAndWhite ? 'is-bw' : undefined} style={{ position: 'absolute', left: offX, top: offY, transform: `scale(${scale})`, transformOrigin: '0 0' }}>
        <table className={`xl-page__table${ps.printGridLines || show?.grid ? ' has-grid' : ''}`}>
          <colgroup>{heads && <col style={{ width: HEADING_W }} />}{page.cols.map((c) => <col key={c} style={{ width: axisSize(cols, c) }} />)}</colgroup>
          {heads && <thead><tr style={{ height: 19 }}><th />{page.cols.map((c) => <th key={c}>{columnName(c)}</th>)}</tr></thead>}
          <tbody>
            {page.rows.map((r) => (
              <tr key={r} style={{ height: axisSize(rows, r) }}>
                {heads && <th>{r + 1}</th>}
                {page.cols.map((c) => {
                  const cell = sheet.cells.get(r)?.get(c);
                  const v = value(r, c);
                  const look = cellLook(wb, cell, v, { colPx: axisSize(cols, c), showZeros: sheet.view.showZeros, ...(cell ? {} : { styleId: inheritedStyle(sheet, r, c) ?? 0 }) });
                  const text = v instanceof FormulaError ? errorText(ps.errors, look.text) : look.text;
                  return (
                    <td key={c} data-r={r} data-c={c} style={{
                      font: look.font, color: look.color, background: look.fill ?? undefined, textAlign: look.align === 'fill' || look.align === 'justify' ? 'left' : look.align,
                      verticalAlign: look.valign === 'center' ? 'middle' : look.valign, whiteSpace: look.wrap ? 'pre-wrap' : 'nowrap',
                      borderTop: borderCss(look.borders.top), borderBottom: borderCss(look.borders.bottom), borderLeft: borderCss(look.borders.left), borderRight: borderCss(look.borders.right),
                      textDecoration: look.underline ? 'underline' : look.strike ? 'line-through' : undefined,
                    }}>{text}</td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {notes.map((n, i) => (
          <div key={i} className="xl-page__note" style={{
            left: (heads ? HEADING_W : 0) + offsetOf(page.cols, cols, n.ref.col) + axisSize(cols, n.ref.col),
            top: (heads ? 19 : 0) + offsetOf(page.rows, rows, n.ref.row),
            width: n.width ?? 144, minHeight: n.height ?? 48,
          }}>{n.text}</div>
        ))}
      </div>
    </div>,
  );
}

export type PrintScope = 'active' | 'workbook' | 'selection';
/** Etendue de la prochaine impression (choisie dans le Backstage, remise a « feuille active » apres l'impression). */
export const printJob: { scope: PrintScope } = { scope: 'active' };

export interface PrintRootProps {
  wb: Workbook;
  sheet: Sheet;
  value: (row: number, col: number) => Scalar;
  name?: string;
  /** Valeurs d'une autre feuille (impression du classeur entier). */
  valueOf?: (sheet: Sheet) => (row: number, col: number) => Scalar;
  /** Plage selectionnee (impression de la selection). */
  selection?: CellRange | null;
}

/** Pages imprimees, rendues hors ecran puis imprimees par le navigateur / la coquille (taille de papier de chaque feuille imposee par @page nomme). */
export function PrintRoot({ wb, sheet, value, name = '', valueOf, selection }: PrintRootProps) {
  useEffect(() => () => {
    printJob.scope = 'active';
  }, []);
  const scope = printJob.scope;
  const sheets = scope === 'workbook' ? wb.sheets.filter((k) => k.state === 'visible') : [sheet];
  const now = new Date();
  const blocks = sheets.map((sh, i) => {
    const areas = scope === 'selection' && selection ? [selection] : printRanges(sh);
    const { pages, scale } = areas.length ? paginate(sh, areas) : { pages: [], scale: 1 };
    const p = paperById(sh.pageSetup.paperSize);
    const land = sh.pageSetup.orientation === 'landscape';
    return { sh, i, pages, scale, css: `@page ps${i} { size: ${land ? p.h : p.w}mm ${land ? p.w : p.h}mm; margin: 0; }` };
  });
  return createPortal(
    <div className="xl-print-root">
      <style>{blocks.map((k) => k.css).join(' ')}</style>
      {blocks.map((k) => k.pages.map((pg, n) => (
        <div key={`${k.i}-${n}`} style={{ page: `ps${k.i}` }}>
          <PageView wb={wb} sheet={k.sh} page={pg} scale={k.scale} value={k.sh === sheet ? value : (valueOf?.(k.sh) ?? value)} fileName={name} now={now} />
        </div>
      )))}
    </div>,
    document.body,
  );
}
