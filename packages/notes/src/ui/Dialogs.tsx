// Boites de dialogue : enregistrer avant de fermer, statistiques, police, a propos, comparaison de deux onglets.
import { useMemo, useState } from 'react';
import { Dialog, FontPicker, NumberField, type CaretPrefs } from '@forgeoffice/ui';
import { diffLines } from '../logic/diff.ts';
import { encodeFile } from '../logic/encoding.ts';
import type { NotesPrefs } from '../logic/prefs.ts';
import { textStats } from '../logic/stats.ts';
import { fontStack } from '../logic/themes.ts';
import type { Workspace } from '../workspace.ts';
import { S } from '../strings.ts';

export type SaveAnswer = 'save' | 'discard' | 'cancel';

export function SaveDialog({ name, onAnswer }: { name: string; onAnswer: (a: SaveAnswer) => void }) {
  return (
    <Dialog
      open
      title={S.dialogs.saveTitle}
      onClose={() => onAnswer('cancel')}
      actions={[
        { label: S.dialogs.save, primary: true, onClick: () => onAnswer('save') },
        { label: S.dialogs.dontSave, onClick: () => onAnswer('discard') },
        { label: S.dialogs.cancel, onClick: () => onAnswer('cancel') },
      ]}
    >
      <p>{S.dialogs.saveChanges(name)}</p>
    </Dialog>
  );
}

export function StatsDialog({ ws, onClose }: { ws: Workspace; onClose: () => void }) {
  const tab = ws.active;
  const text = tab ? ws.text(tab.id) : '';
  const st = textStats(text);
  const view = ws.view;
  const sel = view ? view.state.selection.ranges.map((r) => view.state.sliceDoc(r.from, r.to)).join('\n') : '';
  const selStats = sel ? textStats(sel) : null;
  const bytes = tab ? encodeFile(text, tab.encoding, tab.eol).length : 0;
  const fmt = (v: number): string => v.toLocaleString('fr-FR');
  const rows: [string, string][] = [
    [S.dialogs.stats.lines, fmt(st.lines)],
    [S.dialogs.stats.words, fmt(st.words)],
    [S.dialogs.stats.chars, fmt(st.chars)],
    [S.dialogs.stats.charsNoSpaces, fmt(st.charsNoSpaces)],
    [S.dialogs.stats.paragraphs, fmt(st.paragraphs)],
    [S.dialogs.stats.bytes, fmt(bytes)],
    [S.dialogs.stats.reading, S.dialogs.stats.minutes(st.readingMinutes)],
  ];
  if (selStats) rows.push([S.dialogs.stats.selection, `${fmt(selStats.words)} ${S.dialogs.stats.words.toLowerCase()}, ${fmt(selStats.chars)} ${S.dialogs.stats.chars.toLowerCase()}`]);
  return (
    <Dialog open title={S.dialogs.statsTitle} onClose={onClose} actions={[{ label: S.dialogs.close, primary: true, onClick: onClose }]} width={400}>
      <table className="nt-stats">
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k}><th scope="row">{k}</th><td>{v}</td></tr>
          ))}
        </tbody>
      </table>
    </Dialog>
  );
}

export function FontDialog({ prefs, onApply, onClose }: { prefs: NotesPrefs; onApply: (p: Partial<NotesPrefs>) => void; onClose: () => void }) {
  const [font, setFont] = useState(prefs.font);
  const [size, setSize] = useState(prefs.fontSize);
  const [tabSize, setTabSize] = useState(prefs.tabSize);
  const [margin, setMargin] = useState(prefs.margin);
  const [spacing, setSpacing] = useState(prefs.spacing);
  const [ligatures, setLigatures] = useState(prefs.ligatures);
  const [caret, setCaret] = useState(prefs.caret);
  const apply = (): void => {
    onApply({ font, fontSize: size, tabSize, margin, spacing, ligatures, caret });
    onClose();
  };
  return (
    <Dialog
      open
      title={S.dialogs.fontTitle}
      onClose={onClose}
      onConfirm={apply}
      width={460}
      actions={[{ label: S.dialogs.ok, primary: true, onClick: apply }, { label: S.dialogs.cancel, onClick: onClose }]}
    >
      <div className="nt-form">
        <label>{S.dialogs.fontFamily}</label>
        <FontPicker value={font} onChange={setFont} width={220} extraFonts={['Consolas', 'Cascadia Mono', 'Segoe UI', 'Georgia']} />
        <label>{S.dialogs.fontSize}</label>
        <NumberField value={size} onChange={setSize} min={6} max={72} unit="pt" width={90} />
        <label>{S.dialogs.tabSize}</label>
        <NumberField value={tabSize} onChange={setTabSize} min={1} max={16} width={90} />
        <label>{S.dialogs.margin}</label>
        <NumberField value={margin} onChange={setMargin} min={0} max={400} width={90} />
        <label>{S.dialogs.spacing}</label>
        <NumberField value={spacing} onChange={setSpacing} min={0} max={20} width={90} />
        <label htmlFor="nt-liga">{S.dialogs.ligatures}</label>
        <input id="nt-liga" type="checkbox" checked={ligatures} onChange={(e) => setLigatures(e.target.checked)} />
        <label>{S.dialogs.caretWidth}</label>
        <NumberField value={caret.width} onChange={(w) => setCaret({ ...caret, width: Math.min(3, Math.max(1, Math.round(w))) as 1 | 2 | 3 })} min={1} max={3} unit="px" width={90} />
        <label>{S.dialogs.caretColor}</label>
        <select value={caret.color} onChange={(e) => setCaret({ ...caret, color: e.target.value as CaretPrefs['color'] })}>
          <option value="auto">{S.dialogs.caretAuto}</option><option value="accent">{S.dialogs.caretAccent}</option><option value="black">{S.dialogs.caretBlack}</option><option value="white">{S.dialogs.caretWhite}</option>
        </select>
        <label htmlFor="nt-blink">{S.dialogs.caretBlink}</label>
        <input id="nt-blink" type="checkbox" checked={caret.blink} onChange={(e) => setCaret({ ...caret, blink: e.target.checked })} />
      </div>
      <p className="nt-font-sample" style={{ fontFamily: fontStack(font), fontSize: `${size}pt`, fontVariantLigatures: ligatures ? 'normal' : 'none' }}>{S.dialogs.fontSample}</p>
    </Dialog>
  );
}

export function AboutDialog({ version, onClose }: { version: string; onClose: () => void }) {
  return (
    <Dialog open title={S.dialogs.aboutTitle} onClose={onClose} actions={[{ label: S.dialogs.ok, primary: true, onClick: onClose }]} width={420}>
      <p>{S.dialogs.about(version)}</p>
    </Dialog>
  );
}

export function CompareDialog({ ws, leftId, rightId, onClose }: { ws: Workspace; leftId: string; rightId: string; onClose: () => void }) {
  const left = ws.tab(leftId);
  const right = ws.tab(rightId);
  const rows = useMemo(() => diffLines(ws.text(leftId).split('\n'), ws.text(rightId).split('\n')), [ws, leftId, rightId]);
  const added = rows.filter((r) => r.kind === 'add').length;
  const removed = rows.filter((r) => r.kind === 'del').length;
  if (!left || !right) return null;
  return (
    <Dialog
      open
      title={S.dialogs.compareTitle(left.name, right.name)}
      description={added || removed ? S.dialogs.compareSummary(added, removed) : S.dialogs.compareSame}
      onClose={onClose}
      actions={[{ label: S.dialogs.close, primary: true, onClick: onClose }]}
      width={Math.min(1100, window.innerWidth - 48)}
    >
      <div className="nt-diff fo-scroll">
        <table>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className={`nt-diff__${r.kind}`}>
                <td className="nt-diff__num">{r.left ?? ''}</td>
                <td className="nt-diff__num">{r.right ?? ''}</td>
                <td className="nt-diff__sign">{r.kind === 'add' ? '+' : r.kind === 'del' ? '−' : ''}</td>
                <td className="nt-diff__text">{r.text}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Dialog>
  );
}
