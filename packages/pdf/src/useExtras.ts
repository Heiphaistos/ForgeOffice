// Ce que pdf.js sait du document ouvert, pour les volets : signets, commentaires non editables, pieces jointes, calques.
import { useCallback, useEffect, useRef, useState } from 'react';
import { listAttachments, listLayers, setLayerVisible, type AttachmentInfo, type LayerInfo, type OcConfig } from './extras.ts';
import { outline as readOutline, type OutlineNode, type PDFDocumentProxy } from './pdfdoc.ts';

export interface ExistingComment {
  page: number;
  author: string;
  text: string;
  type: string;
}

/** Sous-types deja editables (relus par annots.ts) ou sans interet dans le volet. */
const SKIPPED = new Set(['Widget', 'Link', 'Popup']);

export function useExtras(pdf: PDFDocumentProxy | null, commentsOpen: boolean) {
  const [outline, setOutline] = useState<OutlineNode[] | null>(null);
  const [foreign, setForeign] = useState<ExistingComment[]>([]);
  const [attachments, setAttachments] = useState<AttachmentInfo[]>([]);
  const [layers, setLayers] = useState<LayerInfo[]>([]);
  const [layerVersion, setLayerVersion] = useState(0);
  const config = useRef<OcConfig | null>(null);

  useEffect(() => {
    setForeign([]);
    setAttachments([]);
    setLayers([]);
    config.current = null;
    if (!pdf) return;
    let alive = true;
    readOutline(pdf).then((o) => alive && setOutline(o), () => alive && setOutline([]));
    listAttachments(pdf).then((a) => alive && setAttachments(a), () => undefined);
    // Document peut-etre deja detruit (remplace par une version plus recente) : l'appel leve alors de facon synchrone.
    Promise.resolve().then(() => pdf.getOptionalContentConfig()).then(async (c) => {
      config.current = c;
      const l = await listLayers(c);
      if (alive) setLayers(l);
    }, () => undefined);
    return () => {
      alive = false;
    };
  }, [pdf]);

  // Commentaires d'autres outils que pdf.js dessine encore (non editables ici).
  useEffect(() => {
    if (!pdf || !commentsOpen) return;
    let alive = true;
    (async () => {
      const out: ExistingComment[] = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        for (const a of (await (await pdf.getPage(i)).getAnnotations()) as { subtype?: string; titleObj?: { str?: string }; contentsObj?: { str?: string } }[]) {
          if (!a.subtype || SKIPPED.has(a.subtype)) continue;
          out.push({ page: i - 1, author: a.titleObj?.str ?? '', text: a.contentsObj?.str ?? '', type: a.subtype });
        }
      }
      if (alive) setForeign(out);
    })().catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [pdf, commentsOpen]);

  const toggleLayer = useCallback((id: string, visible: boolean) => {
    const c = config.current;
    if (!c) return;
    setLayerVisible(c, id, visible);
    setLayers((l) => l.map((x) => (x.id === id ? { ...x, visible } : x)));
    setLayerVersion((v) => v + 1);
  }, []);

  return { outline, foreign, attachments, layers, toggleLayer, layerConfig: config.current, layerVersion };
}
