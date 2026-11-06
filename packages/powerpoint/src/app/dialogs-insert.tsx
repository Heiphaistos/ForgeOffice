// Dialogues d'insertion : equation (saisie type LaTeX, apercu vectoriel) et SmartArt (liste, processus, hierarchie).
import { useMemo, useRef, useState } from 'react';
import { Dialog, NumberField } from '@forgeoffice/ui';
import { EQUATION_TEMPLATES, EquationError, renderEquation } from './equation.ts';
import type { Editor } from './editor.ts';
import { canvasEquationMeasure, insertEquation, insertSmartArt, selectedEquation, selectedSmartArt } from './insert-objects.ts';
import { itemsToText, parseItems, SMARTART_KINDS, type SmartArtKind } from './smartart.ts';
import { S2 } from '../strings2.ts';
import './dialogs.css';

const SYMBOL_KEYS: ReadonlyArray<[string, string]> = [
  ['α', '\\alpha '], ['β', '\\beta '], ['γ', '\\gamma '], ['δ', '\\delta '], ['θ', '\\theta '], ['λ', '\\lambda '], ['μ', '\\mu '], ['π', '\\pi '], ['σ', '\\sigma '], ['φ', '\\phi '], ['ω', '\\omega '], ['Δ', '\\Delta '], ['Σ', '\\Sigma '], ['Ω', '\\Omega '],
  ['±', '\\pm '], ['×', '\\times '], ['·', '\\cdot '], ['≤', '\\leq '], ['≥', '\\geq '], ['≠', '\\neq '], ['≈', '\\approx '], ['∞', '\\infty '], ['→', '\\to '], ['∂', '\\partial '],
];

export function EquationDialog({ ed, onClose }: { ed: Editor; onClose: () => void }) {
  const existing = selectedEquation(ed);
  const [source, setSource] = useState(existing?.description ?? 'x = \\frac{-b \\pm \\sqrt{b^{2} - 4ac}}{2a}');
  const [size, setSize] = useState(28);
  const [error, setError] = useState<string | null>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const measure = useMemo(() => canvasEquationMeasure(), []);
  // Apercu : le SVG (genere et echappe par equation.ts) est affiche comme une image, jamais injecte dans la page.
  const preview = useMemo(() => {
    try {
      const eq = renderEquation(source, { size, measure });
      return { src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(eq.svg)}`, width: eq.width, height: eq.height, error: null };
    } catch (err) {
      return { src: '', width: 0, height: 0, error: err instanceof EquationError ? err.message : S2.equation.failed };
    }
  }, [source, size, measure]);

  const add = (text: string): void => {
    const el = area.current;
    const at = el?.selectionStart ?? source.length;
    const end = el?.selectionEnd ?? at;
    setSource(`${source.slice(0, at)}${text}${source.slice(end)}`);
    window.setTimeout(() => {
      el?.focus();
      el?.setSelectionRange(at + text.length, at + text.length);
    });
  };

  const submit = (): void => {
    if (preview.error) {
      setError(preview.error);
      return;
    }
    void insertEquation(ed, source, size, existing).then(onClose, (err: unknown) => setError(err instanceof EquationError ? err.message : S2.equation.failed));
  };

  return (
    <Dialog open title={existing ? S2.equation.edit : S2.equation.title} onClose={onClose} onConfirm={submit} width={640} actions={[{ label: existing ? S2.equation.update : S2.equation.insert, primary: true, disabled: !!preview.error, onClick: submit }, { label: S2.equation.cancel, onClick: onClose }]}>
      <div className="pp-stack">
        <div className="pp-form__row" aria-label={S2.equation.templates}>
          {EQUATION_TEMPLATES.map((t) => (
            <button key={t.label} type="button" className="pp-link-button" onClick={() => setSource(t.source)}>
              {t.label}
            </button>
          ))}
        </div>
        <label htmlFor="pp-eq-source">{S2.equation.source}</label>
        <textarea id="pp-eq-source" ref={area} className="pp-textarea" rows={3} value={source} spellCheck={false} onChange={(e) => setSource(e.target.value)} data-testid="equation-source" />
        <div className="pp-form__row" aria-label={S2.equation.symbols}>
          {SYMBOL_KEYS.map(([label, code]) => (
            <button key={code} type="button" className="pp-key" onClick={() => add(code)} title={code.trim()}>
              {label}
            </button>
          ))}
        </div>
        <span className="pp-muted">{S2.equation.help}</span>
        <div className="pp-form">
          <label>{S2.equation.size}</label>
          <NumberField value={size} min={10} max={96} step={2} unit="pt" onChange={setSize} label={S2.equation.size} />
        </div>
        <div className="pp-eq-preview" data-testid="equation-preview" aria-label={S2.equation.preview}>
          {preview.error ? <span role="alert" className="pp-eq-error">{preview.error}</span> : <img src={preview.src} width={preview.width} height={preview.height} alt={S2.equation.preview} />}
        </div>
        {error && !preview.error ? <p role="alert">{error}</p> : null}
      </div>
    </Dialog>
  );
}

export function SmartArtDialog({ ed, onClose }: { ed: Editor; onClose: () => void }) {
  const existing = selectedSmartArt(ed);
  const [kind, setKind] = useState<SmartArtKind>(existing?.kind ?? 'process');
  const [text, setText] = useState(existing ? itemsToText(existing.items) : S2.smartart.defaults.process);
  const [error, setError] = useState<string | null>(null);
  const items = parseItems(text);
  const submit = (): void => {
    if (!items.length) {
      setError(S2.smartart.empty);
      return;
    }
    insertSmartArt(ed, kind, items, existing?.shape);
    onClose();
  };
  return (
    <Dialog open title={existing ? S2.smartart.edit : S2.smartart.title} onClose={onClose} onConfirm={submit} width={520} actions={[{ label: existing ? S2.smartart.update : S2.smartart.insert, primary: true, onClick: submit }, { label: S2.smartart.cancel, onClick: onClose }]}>
      <div className="pp-stack">
        <div className="pp-form">
          <label>{S2.smartart.kind}</label>
          <div className="pp-form__row" role="radiogroup" aria-label={S2.smartart.kind}>
            {SMARTART_KINDS.map((k) => (
              <label key={k} className="pp-radio">
                <input
                  type="radio"
                  name="smartart-kind"
                  checked={kind === k}
                  onChange={() => {
                    setKind(k);
                    if (!existing && text === S2.smartart.defaults[kind]) setText(S2.smartart.defaults[k]);
                  }}
                />
                {S2.smartart.kinds[k]}
              </label>
            ))}
          </div>
        </div>
        <label htmlFor="pp-sa-items">{S2.smartart.items}</label>
        <textarea
          id="pp-sa-items"
          className="pp-textarea"
          rows={8}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Tab') return;
            e.preventDefault();
            const el = e.currentTarget;
            const at = el.selectionStart;
            setText(`${text.slice(0, at)}\t${text.slice(el.selectionEnd)}`);
            window.setTimeout(() => el.setSelectionRange(at + 1, at + 1));
          }}
          data-testid="smartart-items"
        />
        {error ? <p role="alert">{error}</p> : null}
      </div>
    </Dialog>
  );
}
