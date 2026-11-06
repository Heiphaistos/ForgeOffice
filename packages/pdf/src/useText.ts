// Texte du document pour la recherche et les outils de texte : boites de texte par page (a la demande), resultats de recherche
// (texte simple ou expression reguliere, casse au choix) et leurs rectangles a l'ecran.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { hitRect, search, validPattern, type Rect, type SearchHit, type SearchOptions, type TextBox } from './model.ts';
import { textBoxes, type PDFDocumentProxy } from './pdfdoc.ts';

export function useText(pdf: PDFDocumentProxy | null) {
  const [boxes, setBoxes] = useState<Map<number, TextBox[]>>(new Map());
  const [query, setQueryState] = useState('');
  const [options, setOptions] = useState<SearchOptions>({});
  const [activeHit, setActiveHit] = useState(0);
  const pdfRef = useRef(pdf);
  pdfRef.current = pdf;

  useEffect(() => setBoxes(new Map()), [pdf]);

  const needBoxes = useCallback((index: number) => {
    const doc = pdfRef.current;
    if (!doc) return;
    doc.getPage(index + 1).then(textBoxes).then((b) => {
      if (pdfRef.current === doc) setBoxes((m) => new Map(m).set(index, b));
    }, () => undefined);
  }, []);

  // Recherche : texte de toutes les pages charge a la demande.
  useEffect(() => {
    if (!pdf || !query.trim()) return;
    let alive = true;
    (async () => {
      for (let i = 0; i < pdf.numPages && alive; i++) {
        if (boxes.has(i)) continue;
        const b = await textBoxes(await pdf.getPage(i + 1));
        if (alive) setBoxes((m) => new Map(m).set(i, b));
      }
    })().catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [pdf, query]);

  const valid = validPattern(query, options);
  const hits: SearchHit[] = useMemo(
    () => (pdf && query.trim() && valid ? search(Array.from({ length: pdf.numPages }, (_, i) => boxes.get(i) ?? []), query, options) : []),
    [pdf, query, boxes, options, valid],
  );
  const hitRects: (Rect | null)[] = useMemo(() => {
    // Largeurs mesurees dans une police sans empattement : plus juste qu'un simple compte de caracteres.
    const ctx = document.createElement('canvas').getContext('2d');
    if (ctx) ctx.font = '100px Helvetica, Arial, sans-serif';
    const measure = (s: string): number => ctx?.measureText(s).width ?? s.length;
    return hits.map((h) => {
      const b = boxes.get(h.page)?.[h.box];
      return b ? hitRect(b, h.start, h.length, measure) : null;
    });
  }, [hits, boxes]);

  const setQuery = useCallback((q: string) => {
    setQueryState(q);
    setActiveHit(0);
  }, []);
  const changeOptions = useCallback((o: SearchOptions) => {
    setOptions(o);
    setActiveHit(0);
  }, []);

  return { boxes, needBoxes, query, setQuery, options, setOptions: changeOptions, valid, hits, hitRects, activeHit, setActiveHit };
}
