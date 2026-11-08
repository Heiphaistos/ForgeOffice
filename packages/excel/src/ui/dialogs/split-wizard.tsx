// Assistant a 3 etapes (type, separateurs ou sauts de colonne, format et destination) partage par Convertir et l'import de texte/CSV.
import { useState, type ReactNode } from 'react';
import { Checkbox, Dialog } from '@forgeoffice/ui';
import { splitAll, type SplitFormat, type SplitOptions } from '../../logic/text-split.ts';
import { S, TW } from '../../strings/index.ts';

const PREVIEW_LINES = 8;
const SEPARATORS = ['\t', ';', ',', ' '] as const;

/** Apercu en largeur fixe : un clic entre deux caracteres pose ou retire un saut de colonne. */
function FixedPreview({ lines, breaks, toggle }: { lines: readonly string[]; breaks: readonly number[]; toggle: (i: number) => void }) {
  return (
    <div className="tw-fixed" role="group" aria-label={TW.preview}>
      {lines.map((line, r) => (
        <div key={r} className="tw-line">
          {[...line].map((ch, i) => (
            <span key={i} className={breaks.includes(i) ? 'tw-ch tw-ch--break' : 'tw-ch'} onClick={() => i > 0 && toggle(i)}>{ch}</span>
          ))}
        </div>
      ))}
    </div>
  );
}

export interface SplitWizardProps {
  /** Lignes de texte a decouper (null : ligne vide). */
  lines: readonly (string | null)[];
  initialDelimiters: string[];
  /** Zone ajoutee en etape 1 (encodage, ligne de depart...). */
  step1Extra?: ReactNode;
  /** Cellule de destination proposee ; absent : pas de champ Destination. */
  destination?: string;
  title?: string;
  /** Applique la conversion ; renvoie un message d'erreur (la boite reste ouverte) ou null. */
  onFinish: (options: SplitOptions, formats: readonly SplitFormat[], destination: string) => string | null;
  onClose: () => void;
}

export function SplitWizard(p: SplitWizardProps) {
  const [step, setStep] = useState(1);
  const [mode, setMode] = useState<SplitOptions['mode']>('delimited');
  const [delimiters, setDelimiters] = useState<string[]>(p.initialDelimiters);
  const [other, setOther] = useState('');
  const [consecutive, setConsecutive] = useState(false);
  const [qualifier, setQualifier] = useState('"');
  const [breaks, setBreaks] = useState<number[]>([]);
  const [formats, setFormats] = useState<SplitFormat[]>([]);
  const [dest, setDest] = useState(p.destination ?? '');
  const [error, setError] = useState('');
  const options: SplitOptions = { mode, delimiters: other ? [...delimiters, ...other] : delimiters, consecutive, qualifier, breaks };
  const preview = p.lines.filter((l): l is string => l !== null).slice(0, PREVIEW_LINES);
  const split = splitAll(preview, options);
  const toggleBreak = (i: number): void => setBreaks((b) => (b.includes(i) ? b.filter((k) => k !== i) : [...b, i]));
  const toggleSep = (s: string, on: boolean): void => setDelimiters((cur) => (on ? [...cur, s] : cur.filter((k) => k !== s)));
  const finish = (): void => {
    const err = p.onFinish(options, formats, dest);
    if (err) setError(err);
  };
  const actions = [
    { label: TW.cancel, onClick: p.onClose },
    { label: TW.back, onClick: () => setStep(step - 1), disabled: step === 1 },
    ...(step < 3 ? [{ label: TW.next, onClick: () => setStep(step + 1), primary: true }] : [{ label: TW.finish, onClick: finish, primary: true }]),
  ];

  return (
    <Dialog open title={p.title ?? TW.step(step)} onClose={p.onClose} actions={actions} width={560}>
      {step === 1 && (
        <div className="xl-form xl-form--stack">
          {p.step1Extra}
          <p>{TW.s1Intro}</p>
          <label className="xl-radio"><input type="radio" checked={mode === 'delimited'} onChange={() => setMode('delimited')} />{TW.delimited}</label>
          <small>{TW.delimitedHint}</small>
          <label className="xl-radio"><input type="radio" checked={mode === 'fixed'} onChange={() => setMode('fixed')} />{TW.fixed}</label>
          <small>{TW.fixedHint}</small>
          <p>{TW.preview}</p>
          <pre className="tw-pre">{preview.join('\n')}</pre>
        </div>
      )}
      {step === 2 && mode === 'delimited' && (
        <div className="xl-form xl-form--stack">
          <fieldset className="xl-fs">
            <legend>{TW.s2Delimiters}</legend>
            {SEPARATORS.map((s) => <Checkbox key={s} checked={delimiters.includes(s)} onChange={(v) => toggleSep(s, v)} label={S.sepNames[s] ?? s} />)}
            <label className="xl-radio">{TW.other}<input className="xl-mini" value={other} onChange={(e) => setOther(e.target.value)} aria-label={TW.other} /></label>
          </fieldset>
          <Checkbox checked={consecutive} onChange={setConsecutive} label={TW.consecutive} />
          <div className="xl-dlg-row">
            <label htmlFor="tw-q">{TW.qualifier}</label>
            <select id="tw-q" value={qualifier} onChange={(e) => setQualifier(e.target.value)}>
              <option value={'"'}>&quot;</option>
              <option value="'">&#39;</option>
              <option value="">{TW.qualifierNone}</option>
            </select>
          </div>
          <p>{TW.preview}</p>
          <table className="tw-table"><tbody>{split.rows.map((row, r) => <tr key={r}>{row.map((cell, c) => <td key={c}>{cell}</td>)}</tr>)}</tbody></table>
        </div>
      )}
      {step === 2 && mode === 'fixed' && (
        <div className="xl-form xl-form--stack">
          <p>{TW.fixedHelp}</p>
          <FixedPreview lines={preview} breaks={breaks} toggle={toggleBreak} />
        </div>
      )}
      {step === 3 && (
        <div className="xl-form xl-form--stack">
          <fieldset className="xl-fs">
            <legend>{TW.s3Format}</legend>
            {Array.from({ length: split.width }, (_, i) => (
              <div key={i} className="xl-dlg-row">
                <span className="tw-col">{TW.colN(i + 1)}</span>
                <select aria-label={TW.colN(i + 1)} value={formats[i] ?? 'general'} onChange={(e) => setFormats((cur) => Array.from({ length: split.width }, (_, k) => (k === i ? (e.target.value as SplitFormat) : cur[k] ?? 'general')))}>
                  <option value="general">{TW.general}</option>
                  <option value="text">{TW.text}</option>
                  <option value="skip">{TW.skip}</option>
                </select>
              </div>
            ))}
          </fieldset>
          {p.destination !== undefined && (
            <div className="xl-dlg-row">
              <label htmlFor="tw-dest">{TW.destination}</label>
              <input id="tw-dest" className="ps-count" value={dest} onChange={(e) => setDest(e.target.value)} />
            </div>
          )}
          {error && <p className="tw-error" role="alert">{error}</p>}
          <p>{TW.preview}</p>
          <table className="tw-table"><tbody>{split.rows.map((row, r) => <tr key={r}>{row.map((cell, c) => formats[c] === 'skip' ? null : <td key={c}>{cell}</td>)}</tr>)}</tbody></table>
        </div>
      )}
    </Dialog>
  );
}
