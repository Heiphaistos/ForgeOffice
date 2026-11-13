// Boites du profil OnlyOffice (texte) : memes champs et memes titres que l'application reelle (captures docs/captures/onlyoffice-ref/10.0/dlg-*.png), branches sur NOS fonctions.
// Le reste de la suite garde ses boites ; index.tsx choisit celle-ci seulement quand la disposition OnlyOffice est active.
import { useState } from 'react';
import { ColorPalette, Dialog, NumberField } from '@forgeoffice/ui';
import type { Alignment, LineSpacing, ParagraphProps, RunProps } from '@forgeoffice/docx';
import { T } from '../strings.ts';
import type { Ctl } from '../app/types.ts';
import { linkMarkAttrs } from '../app/actions.ts';
import { setMark, setParagraph, setRunProps } from '../editor/commands.ts';
import { cmToPt, ptToCm } from '../ribbon/shared.ts';
import { Select } from './common.tsx';

type Close = { c: Ctl; onClose: () => void };

export function isOnlyOffice(): boolean {
  return document.documentElement.dataset.layout === 'onlyoffice';
}

const OK_CANCEL = (ok: () => void, onClose: () => void, disabled = false) => [{ label: 'OK', primary: true, onClick: ok, disabled }, { label: 'Annuler', onClick: onClose }];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label>{label}{children}</label>;
}

function Check({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange?: (v: boolean) => void; disabled?: boolean }) {
  return <label className="fo-oo-chk"><input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange?.(e.target.checked)} />{label}</label>;
}

const TABS = ['Retraits et espacement', 'Sauts de ligne et de page', 'Bordures et remplissage', 'Police', 'Tabulation', 'Marges intérieures'] as const;

/** « Paragraphe - Parametres avances » : liste d'onglets a gauche, 6 pages comme OnlyOffice. */
export function OoParagraphDialog({ c, onClose }: Close) {
  const [tab, setTab] = useState(0);
  const [st, setSt] = useState<ParagraphProps>({ ...c.sel.para });
  const [run, setRun] = useState<RunProps>({ ...c.sel.run });
  const set = (patch: Partial<ParagraphProps>): void => setSt((s) => ({ ...s, ...patch }));
  const setR = (patch: Partial<RunProps>): void => setRun((s) => ({ ...s, ...patch }));
  const ls: LineSpacing = st.lineSpacing ?? { rule: 'auto', value: 1 };
  const first = st.indentFirstLine ?? 0;
  const special = first > 0 ? 'first' : first < 0 ? 'hanging' : 'none';
  const apply = (): void => {
    const { numbering: _n, tabs: _t, borders: _b, ...rest } = st;
    c.run(setParagraph({ props: rest }));
    c.run(setRunProps({
      strike: run.strike || undefined, doubleStrike: run.doubleStrike || undefined, vertAlign: run.vertAlign, smallCaps: run.smallCaps || undefined,
      caps: run.caps || undefined, spacing: run.spacing || undefined,
    }));
    onClose();
  };
  const aligns: [Alignment, string][] = [['left', 'À gauche'], ['center', 'Au centre'], ['right', 'À droite'], ['justify', 'Justifié']];
  const levels: [string, string][] = [['9', 'Texte simple'], ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n): [string, string] => [String(n - 1), `Niveau ${n}`])];
  const cm = (v: number | undefined, onChange: (v: number) => void, label: string, min = 0): React.ReactNode => (
    <NumberField value={Number(ptToCm(v ?? 0).toFixed(2))} step={0.1} min={min} max={55} unit="cm" width={86} label={label} onChange={(n) => onChange(cmToPt(n))} />
  );
  return (
    <Dialog open title="Paragraphe - Paramètres avancés" onClose={onClose} onConfirm={apply} width={560} actions={OK_CANCEL(apply, onClose)}>
      <div className="fo-oo-dlgtabs">
        <div className="fo-oo-dlgtabs__list" role="tablist" aria-orientation="vertical">
          {TABS.map((t, i) => (
            <button key={t} type="button" role="tab" aria-selected={tab === i} className="fo-oo-dlgtabs__tab" onClick={() => setTab(i)}>{t}</button>
          ))}
        </div>
        <div className="fo-oo-dlgtabs__page" role="tabpanel">
          {tab === 0 && (
            <>
              <div className="fo-oo-dlgtabs__grid">
                <Field label="Alignement"><Select value={st.alignment ?? 'left'} label="Alignement" options={aligns} onChange={(alignment) => set({ alignment })} /></Field>
                <Field label="Niveau hiérarchique"><Select value={String(st.outlineLevel ?? 9)} label="Niveau hiérarchique" options={levels} onChange={(v) => set({ outlineLevel: v === '9' ? undefined : Number(v) })} /></Field>
              </div>
              <h4>Retraits</h4>
              <div className="fo-oo-dlgtabs__grid" style={{ '--cols': 4 } as React.CSSProperties}>
                <Field label="À gauche">{cm(st.indentLeft, (indentLeft) => set({ indentLeft }), 'À gauche', -20)}</Field>
                <Field label="À droite">{cm(st.indentRight, (indentRight) => set({ indentRight }), 'À droite', -20)}</Field>
                <Field label="Spécial">
                  <Select value={special} label="Spécial" options={[['none', '(aucun)'], ['first', 'Première ligne'], ['hanging', 'Suspendu']]} onChange={(v) => set({ indentFirstLine: v === 'none' ? undefined : v === 'first' ? 35.4 : -35.4 })} />
                </Field>
                <Field label={' '}>{cm(Math.abs(first), (n) => set({ indentFirstLine: special === 'hanging' ? -n : n }), 'Valeur du retrait spécial')}</Field>
              </div>
              <h4>Espacement</h4>
              <div className="fo-oo-dlgtabs__grid" style={{ '--cols': 4 } as React.CSSProperties}>
                <Field label="Avant">{cm(st.spacingBefore, (spacingBefore) => set({ spacingBefore }), 'Avant')}</Field>
                <Field label="Après">{cm(st.spacingAfter, (spacingAfter) => set({ spacingAfter }), 'Après')}</Field>
                <Field label="Interligne">
                  <Select value={ls.rule} label="Interligne" options={[['auto', 'Multiple'], ['exact', 'Exactement'], ['atLeast', 'Au moins']]} onChange={(rule) => set({ lineSpacing: { rule, value: rule === 'auto' ? 1 : 12 } })} />
                </Field>
                <Field label={' '}>
                  <NumberField value={ls.value} step={ls.rule === 'auto' ? 0.05 : 1} min={0.06} max={1584} width={86} label="Valeur de l'interligne" onChange={(value) => set({ lineSpacing: { ...ls, value } })} />
                </Field>
              </div>
              <Check label="Ne pas ajouter d'intervalle entre paragraphes du même style" checked={!!st.contextualSpacing} onChange={(contextualSpacing) => set({ contextualSpacing })} />
              <h4>Direction</h4>
              <div className="fo-oo-dlgtabs__checks">
                <label><input type="radio" name="oo-dir" checked readOnly />De gauche à droite</label>
                <label><input type="radio" name="oo-dir" disabled />De droite à gauche</label>
              </div>
            </>
          )}
          {tab === 1 && (
            <div className="fo-oo-dlgtabs__checks">
              <Check label="Saut de page avant" checked={!!st.pageBreakBefore} onChange={(pageBreakBefore) => set({ pageBreakBefore })} />
              <Check label="Lignes solidaires" checked={!!st.keepLines} onChange={(keepLines) => set({ keepLines })} />
              <Check label="Éviter les orphelines" checked={st.widowControl !== false} onChange={(widowControl) => set({ widowControl })} />
              <Check label="Paragraphes solidaires" checked={!!st.keepNext} onChange={(keepNext) => set({ keepNext })} />
              <Check label="Supprimer les numéros de ligne" checked={!!st.suppressLineNumbers} onChange={(suppressLineNumbers) => set({ suppressLineNumbers })} />
            </div>
          )}
          {tab === 2 && (
            <>
              <p>Bordures : boîte de la suite.</p>
              <div><button type="button" className="fo-btn fo-btn--secondary" onClick={() => { apply(); c.openDialog('borders'); }}>Bordures…</button></div>
              <h4>Couleur d'arrière-plan</h4>
              <ColorPalette value={st.shading?.fill && st.shading.fill !== 'auto' ? `#${st.shading.fill}` : null} onPick={(hex) => set({ shading: hex ? { fill: hex.slice(1).toUpperCase(), pattern: 'clear' } : undefined })} />
            </>
          )}
          {tab === 3 && (
            <>
              <h4>Effets</h4>
              <div className="fo-oo-dlgtabs__checks">
                <Check label="Barré" checked={!!run.strike} onChange={(strike) => setR({ strike })} />
                <Check label="Indice" checked={run.vertAlign === 'subscript'} onChange={(v) => setR({ vertAlign: v ? 'subscript' : undefined })} />
                <Check label="Barré double" checked={!!run.doubleStrike} onChange={(doubleStrike) => setR({ doubleStrike })} />
                <Check label="Petites majuscules" checked={!!run.smallCaps} onChange={(smallCaps) => setR({ smallCaps })} />
                <Check label="Exposant" checked={run.vertAlign === 'superscript'} onChange={(v) => setR({ vertAlign: v ? 'superscript' : undefined })} />
                <Check label="Toutes en majuscules" checked={!!run.caps} onChange={(caps) => setR({ caps })} />
              </div>
              <h4>Espacement des caractères</h4>
              <Field label="Espacement"><NumberField value={Number(ptToCm(run.spacing ?? 0).toFixed(2))} step={0.01} min={-1} max={2} unit="cm" width={86} label="Espacement" onChange={(n) => setR({ spacing: cmToPt(n) })} /></Field>
              <div><button type="button" className="fo-btn fo-btn--secondary" onClick={() => { apply(); c.openDialog('font'); }}>Police…</button></div>
            </>
          )}
          {tab === 4 && (
            <>
              <p>Les taquets se règlent dans la boîte Tabulation de la suite.</p>
              <div><button type="button" className="fo-btn fo-btn--secondary" onClick={() => { apply(); c.openDialog('tabs'); }}>Tabulation…</button></div>
            </>
          )}
          {tab === 5 && (
            <>
              <div className="fo-oo-dlgtabs__grid">
                {['En haut', 'À gauche', 'En bas', 'À droite'].map((l) => (
                  <Field key={l} label={l}><input value="0 cm" disabled readOnly aria-label={l} /></Field>
                ))}
              </div>
              <p>Marges intérieures de paragraphe : pas encore disponibles dans ForgeOffice.</p>
            </>
          )}
        </div>
      </div>
    </Dialog>
  );
}

/** « Taille du tableau » : colonnes puis lignes, 2 x 2 au depart comme OnlyOffice. */
export function OoTableDialog({ c, onClose }: Close) {
  const [rows, setRows] = useState(2);
  const [cols, setCols] = useState(2);
  const ok = (): void => { c.act.insertTable(rows, cols); onClose(); };
  return (
    <Dialog open title="Taille du tableau" onClose={onClose} onConfirm={ok} width={230} actions={OK_CANCEL(ok, onClose)}>
      <div className="fo-oo-dlgtabs__grid" style={{ '--cols': 1 } as React.CSSProperties}>
        <Field label="Nombre de colonnes"><NumberField value={cols} min={1} max={63} width={86} label="Nombre de colonnes" onChange={setCols} /></Field>
        <Field label="Nombre de lignes"><NumberField value={rows} min={1} max={500} width={86} label="Nombre de lignes" onChange={setRows} /></Field>
      </div>
    </Dialog>
  );
}

/** « Parametres du lien » : Lien externe / Emplacement dans le document, Lien vers, Afficher, Texte de l'info-bulle. */
export function OoLinkDialog({ c, onClose }: Close) {
  const st = c.state();
  const existing = st ? (st.storedMarks ?? st.selection.$from.marks()).find((m) => m.type.name === 'link') : undefined;
  const [text, setText] = useState(c.sel.text);
  const [addr, setAddr] = useState(existing ? String(existing.attrs.url ?? `#${String(existing.attrs.anchor ?? '')}`) : '');
  const [tip, setTip] = useState(existing ? String(existing.attrs.tooltip ?? '') : '');
  const [mode, setMode] = useState<'ext' | 'doc'>(addr.startsWith('#') ? 'doc' : 'ext');
  const apply = (): void => {
    const attrs = linkMarkAttrs(addr, tip);
    if (!attrs) return;
    const mark = c.schema.marks.link!.create(attrs);
    c.run((state, dispatch) => {
      if (!dispatch) return true;
      const { from, to, empty } = state.selection;
      const label = text || addr;
      if (empty || text !== c.sel.text) dispatch(state.tr.replaceWith(from, to, c.schema.text(label, [...state.selection.$from.marks(), mark])));
      else dispatch(state.tr.addMark(from, to, mark));
      return true;
    });
    onClose();
  };
  return (
    <Dialog open title="Paramètres du lien" onClose={onClose} onConfirm={apply} width={350}
      footerStart={existing ? <button type="button" className="fo-btn fo-btn--secondary" onClick={() => { c.run(setMark(c.schema.marks.link!, null)); onClose(); }}>{T.cmd.removeLink}</button> : undefined}
      actions={OK_CANCEL(apply, onClose, !addr.trim())}>
      <div className="fo-oo-seg" role="group" aria-label="Type de lien">
        <button type="button" aria-pressed={mode === 'ext'} onClick={() => setMode('ext')}>Lien externe</button>
        <button type="button" aria-pressed={mode === 'doc'} onClick={() => { setMode('doc'); if (!addr.startsWith('#')) setAddr('#'); }}>Emplacement dans le document</button>
      </div>
      <div className="fo-oo-stack">
        <label htmlFor="oo-link-to">Lien vers</label>
        <input id="oo-link-to" data-autofocus value={addr} placeholder={mode === 'ext' ? "Saisissez l'adresse web ou sélectionnez un fichier" : '#nom-du-signet'} onChange={(e) => setAddr(e.target.value)} />
        <label htmlFor="oo-link-text">Afficher</label>
        <input id="oo-link-text" value={text} onChange={(e) => setText(e.target.value)} />
        <label htmlFor="oo-link-tip">Texte de l'info-bulle</label>
        <input id="oo-link-tip" value={tip} onChange={(e) => setTip(e.target.value)} />
      </div>
    </Dialog>
  );
}
