// Boites de dialogue du module PDF : filigrane, numerotation/Bates, en-tete et pied, proprietes, mot de passe,
// compression, OCR, decoupage, extraction, signature visuelle, resultat de comparaison, mot de passe a l'ouverture.
import { useEffect, useRef, useState } from 'react';
import { Checkbox, Dialog, NumberField, TextField } from '@forgeoffice/ui';
import type { pdfOps } from '@forgeoffice/convert';
import type { DiffLine } from './model.ts';
import { S } from './strings.ts';

type Stamp = pdfOps.Stamp;
type Metadata = pdfOps.Metadata;

export type DialogState =
  | { kind: 'watermark' } | { kind: 'numbering' } | { kind: 'headerFooter' } | { kind: 'metadata'; meta: Metadata }
  | { kind: 'protect' } | { kind: 'password'; error: boolean } | { kind: 'compress' } | { kind: 'ocr' } | { kind: 'split'; pages: number }
  | { kind: 'extract'; pages: number; initial: string } | { kind: 'signature' } | { kind: 'compare'; name: string; lines: DiffLine[] };

export interface DialogResult {
  watermark: { text: string; size: number; opacity: number; angle: number; pages: string };
  numbering: { template: string; start: number; digits: number; position: Stamp; size: number; margin: number; pages: string };
  headerFooter: { header: string; footer: string; size: number };
  metadata: Metadata;
  protect: { user: string; owner: string; print: boolean; copy: boolean; edit: boolean; annot: boolean; forms: boolean };
  password: string;
  compress: { level: 'sans_perte' | 'ecran' | 'ebook' | 'impression' };
  ocr: { lang: 'fra' | 'eng' | 'fra+eng'; force: boolean };
  split: { mode: 'each' | 'every' | 'ranges'; n: number; ranges: string };
  extract: string;
  signature: { png: Uint8Array; ratio: number };
}

export interface PdfDialogsProps {
  state: DialogState | null;
  onClose(): void;
  onApply<K extends keyof DialogResult>(kind: K, value: DialogResult[K]): void;
}

const POSITIONS: readonly Stamp[] = ['haut_gauche', 'haut_centre', 'haut_droite', 'bas_gauche', 'bas_centre', 'bas_droite'];

function Select<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: Readonly<Record<T, string>>; onChange(v: T): void }) {
  return (
    <label className="pdf-field-row">
      <span>{label}</span>
      <select className="pdf-select" value={value} onChange={(e) => onChange(e.target.value as T)}>
        {(Object.keys(options) as T[]).map((k) => <option key={k} value={k}>{options[k]}</option>)}
      </select>
    </label>
  );
}

/** Pave de signature : dessin a la souris/au doigt ou nom tape (rendu en italique). */
function SignaturePad({ onReady }: { onReady(v: { png: Uint8Array; ratio: number } | null): void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<'draw' | 'type'>('draw');
  const [name, setName] = useState('');
  const drawing = useRef(false);
  const dirty = useRef(false);

  const exportPng = (): void => {
    const c = ref.current;
    if (!c || !dirty.current) {
      onReady(null);
      return;
    }
    c.toBlob((b) => b && b.arrayBuffer().then((buf) => onReady({ png: new Uint8Array(buf), ratio: c.height / c.width })), 'image/png');
  };
  const clear = (): void => {
    const c = ref.current;
    c?.getContext('2d')?.clearRect(0, 0, c.width, c.height);
    dirty.current = false;
    onReady(null);
  };
  useEffect(() => {
    if (mode !== 'type') return;
    const c = ref.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.fillStyle = '#1b2a6b';
    ctx.font = 'italic 64px "Segoe Script", "Brush Script MT", "Segoe UI", cursive';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, 20, c.height / 2, c.width - 40);
    dirty.current = name.trim() !== '';
    exportPng();
  }, [mode, name]);

  const pos = (e: React.PointerEvent<HTMLCanvasElement>): [number, number] => {
    const r = e.currentTarget.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * e.currentTarget.width, ((e.clientY - r.top) / r.height) * e.currentTarget.height];
  };
  return (
    <div className="pdf-signpad">
      <div className="pdf-signpad__modes" role="tablist">
        <button type="button" role="tab" aria-selected={mode === 'draw'} className={mode === 'draw' ? 'is-active' : undefined} onClick={() => { setMode('draw'); clear(); }}>{S.dialogs.signDraw}</button>
        <button type="button" role="tab" aria-selected={mode === 'type'} className={mode === 'type' ? 'is-active' : undefined} onClick={() => setMode('type')}>{S.dialogs.signType}</button>
      </div>
      {mode === 'type' && <TextField label={S.dialogs.signName} value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />}
      <canvas ref={ref} width={600} height={200} className="pdf-signpad__canvas" aria-label={S.dialogs.signHint}
        onPointerDown={(e) => {
          if (mode !== 'draw') return;
          e.currentTarget.setPointerCapture(e.pointerId);
          drawing.current = true;
          const ctx = e.currentTarget.getContext('2d');
          const [x, y] = pos(e);
          ctx?.beginPath();
          ctx?.moveTo(x, y);
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return;
          const ctx = e.currentTarget.getContext('2d');
          if (!ctx) return;
          const [x, y] = pos(e);
          ctx.lineWidth = 4;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.strokeStyle = '#1b2a6b';
          ctx.lineTo(x, y);
          ctx.stroke();
          dirty.current = true;
        }}
        onPointerUp={() => {
          drawing.current = false;
          exportPng();
        }} />
      <div className="pdf-signpad__foot"><span className="pdf-muted">{S.dialogs.signHint}</span><button type="button" className="pdf-link" onClick={clear}>{S.dialogs.signClear}</button></div>
    </div>
  );
}

export function PdfDialogs({ state, onClose, onApply }: PdfDialogsProps) {
  const [wm, setWm] = useState<DialogResult['watermark']>({ text: 'CONFIDENTIEL', size: 60, opacity: 25, angle: 45, pages: '' });
  const [num, setNum] = useState<DialogResult['numbering']>({ template: 'Page {page} sur {total}', start: 1, digits: 0, position: 'bas_centre', size: 10, margin: 24, pages: '' });
  const [hf, setHf] = useState<DialogResult['headerFooter']>({ header: '', footer: '', size: 10 });
  const [meta, setMeta] = useState<Metadata>({ title: '', author: '', subject: '', keywords: '', creator: '', producer: '' });
  const [prot, setProt] = useState<DialogResult['protect'] & { confirm: string }>({ user: '', owner: '', confirm: '', print: true, copy: true, edit: false, annot: true, forms: true });
  const [password, setPassword] = useState('');
  const [comp, setComp] = useState<DialogResult['compress']>({ level: 'ebook' });
  const [ocr, setOcr] = useState<DialogResult['ocr']>({ lang: 'fra', force: false });
  const [split, setSplit] = useState<DialogResult['split']>({ mode: 'each', n: 2, ranges: '' });
  const [extract, setExtract] = useState('');
  const [sign, setSign] = useState<DialogResult['signature'] | null>(null);

  useEffect(() => {
    if (state?.kind === 'metadata') setMeta(state.meta);
    if (state?.kind === 'extract') setExtract(state.initial);
    if (state?.kind === 'password') setPassword('');
    if (state?.kind === 'signature') setSign(null);
  }, [state]);

  if (!state) return null;
  const actions = (ok: () => void, disabled = false) => [
    { label: S.dialogs.apply, primary: true, disabled, onClick: ok },
    { label: S.dialogs.cancel, onClick: onClose },
  ];
  switch (state.kind) {
    case 'watermark':
      return (
        <Dialog open title={S.watermark} onClose={onClose} width={440} actions={actions(() => onApply('watermark', wm), wm.text.trim() === '')}>
          <div className="pdf-form">
            <TextField label={S.dialogs.watermarkText} value={wm.text} maxLength={100} onChange={(e) => setWm({ ...wm, text: e.target.value })} />
            <div className="pdf-form__row">
              <NumberField label={S.dialogs.size} value={wm.size} min={6} max={300} onChange={(size) => setWm({ ...wm, size })} width={90} />
              <NumberField label={S.dialogs.opacity} value={wm.opacity} min={5} max={100} step={5} onChange={(opacity) => setWm({ ...wm, opacity })} width={90} />
              <NumberField label={S.dialogs.angle} value={wm.angle} min={-90} max={90} step={15} onChange={(angle) => setWm({ ...wm, angle })} width={90} />
            </div>
            <TextField label={S.dialogs.pagesLabel} value={wm.pages} placeholder="1-3, 5" onChange={(e) => setWm({ ...wm, pages: e.target.value })} />
            <div className="pdf-wm-preview" style={{ opacity: wm.opacity / 100, transform: `rotate(${-wm.angle}deg)` }}>{wm.text}</div>
          </div>
        </Dialog>
      );
    case 'numbering':
      return (
        <Dialog open title={S.numbering} onClose={onClose} width={460} actions={actions(() => onApply('numbering', num), num.template.trim() === '')}>
          <div className="pdf-form">
            <TextField label={S.dialogs.template} value={num.template} maxLength={80} onChange={(e) => setNum({ ...num, template: e.target.value })} hint="DOSSIER-{page} · Page {page} sur {total}" />
            <div className="pdf-form__row">
              <NumberField label={S.dialogs.start} value={num.start} min={0} max={9_999_999} onChange={(start) => setNum({ ...num, start })} width={110} />
              <NumberField label={S.dialogs.digits} value={num.digits} min={0} max={12} onChange={(digits) => setNum({ ...num, digits })} width={90} />
              <NumberField label={S.dialogs.size} value={num.size} min={5} max={72} onChange={(size) => setNum({ ...num, size })} width={90} />
            </div>
            <Select label={S.dialogs.position} value={num.position} options={S.dialogs.positions} onChange={(position) => setNum({ ...num, position })} />
            <TextField label={S.dialogs.pagesLabel} value={num.pages} placeholder="2-" onChange={(e) => setNum({ ...num, pages: e.target.value })} />
          </div>
        </Dialog>
      );
    case 'headerFooter':
      return (
        <Dialog open title={S.headerFooter} onClose={onClose} width={460} actions={actions(() => onApply('headerFooter', hf), hf.header.trim() === '' && hf.footer.trim() === '')}>
          <div className="pdf-form">
            <TextField label={S.dialogs.header} value={hf.header} maxLength={120} placeholder="Rapport d'activité 2026" onChange={(e) => setHf({ ...hf, header: e.target.value })} />
            <TextField label={S.dialogs.footer} value={hf.footer} maxLength={120} placeholder="Page {page} sur {total}" onChange={(e) => setHf({ ...hf, footer: e.target.value })} />
            <NumberField label={S.dialogs.size} value={hf.size} min={5} max={48} onChange={(size) => setHf({ ...hf, size })} width={90} />
          </div>
        </Dialog>
      );
    case 'metadata':
      return (
        <Dialog open title={S.metadata} onClose={onClose} width={480} actions={actions(() => onApply('metadata', meta))}>
          <div className="pdf-form">
            {(['title', 'author', 'subject', 'keywords', 'creator', 'producer'] as const).map((k) => (
              <TextField key={k} label={S.dialogs[k]} value={meta[k]} maxLength={500} onChange={(e) => setMeta({ ...meta, [k]: e.target.value })} />
            ))}
          </div>
        </Dialog>
      );
    case 'protect': {
      const mismatch = prot.confirm !== prot.user;
      return (
        <Dialog open title={S.protect} onClose={onClose} width={460} actions={actions(() => onApply('protect', prot), prot.user === '' || mismatch)}>
          <div className="pdf-form">
            <TextField label={S.dialogs.password} type="password" autoComplete="new-password" value={prot.user} onChange={(e) => setProt({ ...prot, user: e.target.value })} />
            <TextField label={S.dialogs.confirm} type="password" autoComplete="new-password" value={prot.confirm} error={prot.confirm && mismatch ? S.dialogs.mismatch : undefined} onChange={(e) => setProt({ ...prot, confirm: e.target.value })} />
            <TextField label={S.dialogs.owner} type="password" autoComplete="new-password" value={prot.owner} onChange={(e) => setProt({ ...prot, owner: e.target.value })} />
            <Checkbox label={S.dialogs.allowPrint} checked={prot.print} onChange={(print) => setProt({ ...prot, print })} />
            <Checkbox label={S.dialogs.allowCopy} checked={prot.copy} onChange={(copy) => setProt({ ...prot, copy })} />
            <Checkbox label={S.dialogs.allowEdit} checked={prot.edit} onChange={(edit) => setProt({ ...prot, edit })} />
            <Checkbox label={S.dialogs.allowAnnot} checked={prot.annot} onChange={(annot) => setProt({ ...prot, annot })} />
            <Checkbox label={S.dialogs.allowForms} checked={prot.forms} onChange={(forms) => setProt({ ...prot, forms })} />
          </div>
        </Dialog>
      );
    }
    case 'password':
      return (
        <Dialog open title={S.unprotect} onClose={onClose} width={400} actions={actions(() => onApply('password', password), password === '')}>
          <div className="pdf-form">
            <p>{S.dialogs.passwordPrompt}</p>
            <TextField type="password" autoFocus value={password} aria-label={S.dialogs.password} error={state.error ? S.dialogs.wrongPassword : undefined} onChange={(e) => setPassword(e.target.value)} />
          </div>
        </Dialog>
      );
    case 'compress':
      return (
        <Dialog open title={S.compress} onClose={onClose} width={420} actions={actions(() => onApply('compress', comp))}>
          <div className="pdf-form"><Select label={S.dialogs.level} value={comp.level} options={S.dialogs.levels} onChange={(level) => setComp({ level })} /></div>
        </Dialog>
      );
    case 'ocr':
      return (
        <Dialog open title={S.ocr} onClose={onClose} width={420} actions={actions(() => onApply('ocr', ocr))}>
          <div className="pdf-form">
            <Select label={S.dialogs.ocrLang} value={ocr.lang} options={S.dialogs.langs} onChange={(lang) => setOcr({ ...ocr, lang })} />
            <Checkbox label={S.dialogs.ocrForce} checked={ocr.force} onChange={(force) => setOcr({ ...ocr, force })} />
          </div>
        </Dialog>
      );
    case 'split':
      return (
        <Dialog open title={S.split} onClose={onClose} width={460} actions={actions(() => onApply('split', split), split.mode === 'ranges' && split.ranges.trim() === '')}>
          <div className="pdf-form">
            <Select label={S.dialogs.splitMode} value={split.mode} options={{ each: S.dialogs.splitEach, every: S.dialogs.splitEvery, ranges: S.dialogs.splitRanges }} onChange={(mode) => setSplit({ ...split, mode })} />
            {split.mode === 'every' && <NumberField label={S.dialogs.n} value={split.n} min={1} max={state.pages} onChange={(n) => setSplit({ ...split, n })} width={90} />}
            {split.mode === 'ranges' && <TextField label={S.dialogs.ranges} value={split.ranges} placeholder="1-3 | 4-6 | 7-" onChange={(e) => setSplit({ ...split, ranges: e.target.value })} />}
          </div>
        </Dialog>
      );
    case 'extract':
      return (
        <Dialog open title={S.extractPages} onClose={onClose} width={420} actions={actions(() => onApply('extract', extract), extract.trim() === '')}>
          <div className="pdf-form"><TextField label={`${S.dialogs.extractRange} (1-${state.pages})`} value={extract} autoFocus onChange={(e) => setExtract(e.target.value)} /></div>
        </Dialog>
      );
    case 'signature':
      return (
        <Dialog open title={S.signVisual} onClose={onClose} width={660} actions={actions(() => sign && onApply('signature', sign), sign === null)}>
          <SignaturePad onReady={setSign} />
        </Dialog>
      );
    case 'compare': {
      const add = state.lines.filter((l) => l.kind === 'add').length;
      const del = state.lines.filter((l) => l.kind === 'del').length;
      return (
        <Dialog open title={`${S.dialogs.compareTitle} : ${state.name}`} onClose={onClose} width={760} actions={[{ label: S.dialogs.close, primary: true, onClick: onClose }]}>
          <p className="pdf-muted">{add + del === 0 ? S.dialogs.compareSame : S.dialogs.compareStats(add, del)}</p>
          <div className="pdf-diff">
            {state.lines.filter((l) => l.text.trim() !== '').map((l, i) => <div key={i} className={`pdf-diff__${l.kind}`}>{l.kind === 'add' ? '+ ' : l.kind === 'del' ? '− ' : '  '}{l.text}</div>)}
          </div>
        </Dialog>
      );
    }
  }
}
