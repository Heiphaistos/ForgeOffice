// Boîte « Caviarder par recherche » : texte libre et motifs courants -> zones marquées (le caviardage reste à appliquer ensuite).
import { useEffect, useMemo, useState } from 'react';
import { Checkbox, Dialog, TextField } from '@forgeoffice/ui';
import type { SearchOptions } from './find.ts';
import type { TextBox } from './model.ts';
import { textBoxes, type PDFDocumentProxy } from './pdfdoc.ts';
import { findRedactZones, REDACT_PATTERNS, type RedactPattern, type RedactZone } from './redactfind.ts';
import { S } from './strings.ts';

/** Largeur d'un texte mesurée dans une police sans empattement (plus juste qu'un simple compte de caractères). */
function makeMeasure(): (s: string) => number {
  const ctx = document.createElement('canvas').getContext('2d');
  if (ctx) ctx.font = '100px Helvetica, Arial, sans-serif';
  return (s) => ctx?.measureText(s).width ?? s.length;
}

export function RedactFindDialog({ open, pdf, initialQuery, onMark, onClose }: {
  open: boolean; pdf: PDFDocumentProxy | null; initialQuery: string; onMark(zones: readonly RedactZone[]): void; onClose(): void;
}) {
  const [pages, setPages] = useState<TextBox[][] | null>(null);
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<SearchOptions>({});
  const [patterns, setPatterns] = useState<ReadonlySet<RedactPattern>>(new Set());
  useEffect(() => {
    if (!open || !pdf) return;
    setQuery(initialQuery);
    setPages(null);
    let alive = true;
    Promise.all(Array.from({ length: pdf.numPages }, async (_, i) => textBoxes(await pdf.getPage(i + 1))))
      .then((p) => { if (alive) setPages(p); }, () => { if (alive) setPages([]); });
    return () => { alive = false; };
  }, [open, pdf, initialQuery]);
  const measure = useMemo(makeMeasure, []);
  const zones = useMemo(() => (pages ? findRedactZones(pages, query, options, [...patterns], measure) : []), [pages, query, options, patterns, measure]);
  const toggle = (p: RedactPattern, on: boolean): void => setPatterns((cur) => { const n = new Set(cur); if (on) n.add(p); else n.delete(p); return n; });
  return (
    <Dialog open={open} title={S.redactFind.title} onClose={onClose} width={520} description={S.redactFind.help}
      actions={[{ label: S.redactFind.mark(zones.length), primary: true, disabled: zones.length === 0, onClick: () => onMark(zones) }, { label: S.dialogs.cancel, onClick: onClose }]}>
      <div className="pdf-form">
        <TextField label={S.redactFind.query} value={query} data-autofocus="" onChange={(e) => setQuery(e.target.value)} />
        <div className="pdf-form__row">
          <Checkbox label={S.finder.regex} checked={options.regex === true} onChange={(regex) => setOptions({ ...options, regex })} />
          <Checkbox label={S.finder.matchCase} checked={options.matchCase === true} onChange={(matchCase) => setOptions({ ...options, matchCase })} />
          <Checkbox label={S.finder.wholeWord} checked={options.wholeWord === true} onChange={(wholeWord) => setOptions({ ...options, wholeWord })} />
        </div>
        <fieldset className="pdf-redact-patterns">
          <legend>{S.redactFind.patterns}</legend>
          {REDACT_PATTERNS.map((p) => <Checkbox key={p} label={S.redactFind.names[p]} checked={patterns.has(p)} onChange={(on) => toggle(p, on)} />)}
        </fieldset>
        <p className="pdf-muted" role="status">{pages === null ? S.redactFind.loading : S.redactFind.count(zones.length)}</p>
        <ul className="pdf-redact-list">
          {zones.slice(0, 6).map((z, i) => <li key={i}><span className="pdf-muted">{S.comments.page(z.page + 1)}</span> {z.text}</li>)}
          {zones.length > 6 && <li className="pdf-muted">…</li>}
        </ul>
      </div>
    </Dialog>
  );
}
