// Document ouvert dans le module PDF : octets + elements en attente dans un historique annuler/retablir,
// document pdf.js d'affichage, champs du formulaire, mot de passe, ecriture des modifications.
import { useCallback, useEffect, useRef, useState } from 'react';
import { History, type NativeBridge, type OpenedFile, type Services } from '@forgeoffice/core';
import { input, outputTarget, runBytes } from '@forgeoffice/convert';
import { readFields, type FieldInfo } from './apply.ts';
import { hasPending, withLog, type DocState, type Item } from './model.ts';
import { commitPending, openPdf, type PDFDocumentProxy } from './pdfdoc.ts';
import { S } from './strings.ts';

export interface OpenDoc {
  name: string;
  path: string | null;
  /** Protege et non dechiffrable ici : lecture seule avec ce mot de passe. */
  lockedPassword: string | null;
}

const errorText = (err: unknown): string => (err instanceof Error ? err.message : String(err));
const isPdf = (b: Uint8Array): boolean => new TextDecoder('latin1').decode(b.subarray(0, 1024)).includes('%PDF');

export function useDoc(services: Services) {
  const native: NativeBridge | null = services.native;
  const history = useRef<History<DocState> | null>(null);
  const [state, setState] = useState<DocState | null>(null);
  const [info, setInfo] = useState<OpenDoc | null>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [fields, setFields] = useState<FieldInfo[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [askPassword, setAskPassword] = useState<{ file: OpenedFile; error: boolean } | null>(null);
  const savedLog = useRef(0);
  const stateRef = useRef(state);
  stateRef.current = state;

  const sync = useCallback(() => setState(history.current?.state ?? null), []);

  // Document pdf.js d'affichage : rouvert a chaque changement d'octets.
  const bytes = state?.bytes ?? null;
  const password = info?.lockedPassword ?? undefined;
  useEffect(() => {
    if (!bytes) return;
    let alive = true;
    let doc: PDFDocumentProxy | null = null;
    openPdf(bytes, password).then((d) => {
      doc = d;
      if (alive) setPdf(d);
      else void d.loadingTask.destroy();
    }, (err: unknown) => services.notify(S.errors.open(errorText(err)), 'error'));
    if (!password) readFields(bytes).then((f) => alive && setFields(f), () => alive && setFields([]));
    else setFields([]);
    return () => {
      alive = false;
      if (doc) void doc.loadingTask.destroy();
    };
  }, [bytes, password, services]);

  const start = useCallback((file: OpenedFile, data: Uint8Array, locked: string | null) => {
    history.current = new History<DocState>({ bytes: data, items: [], values: {}, log: [S.opened] }, { limit: 100 });
    savedLog.current = 1;
    setInfo({ name: file.name, path: file.path, lockedPassword: locked });
    sync();
    services.setTitle(`${file.name} - PDF`);
    if (file.path) void services.addRecent({ app: 'pdf', name: file.name, path: file.path }).catch(() => undefined);
  }, [services, sync]);

  /** Ouvre un fichier ; demande le mot de passe s'il est protege. */
  const load = useCallback(async (file: OpenedFile, pwd?: string) => {
    if (!isPdf(file.bytes)) {
      services.notify(S.errors.notPdf, 'error');
      return;
    }
    try {
      const probe = await openPdf(file.bytes, pwd);
      await probe.loadingTask.destroy();
    } catch (err) {
      if (err instanceof Error && err.name === 'PasswordException') {
        setAskPassword({ file, error: pwd !== undefined });
        return;
      }
      services.notify(S.errors.open(errorText(err)), 'error');
      return;
    }
    setAskPassword(null);
    if (pwd === undefined) {
      start(file, file.bytes, null);
      return;
    }
    // Protege : dechiffre par le moteur natif pour pouvoir le modifier, sinon lecture seule.
    if (native) {
      try {
        const res = await runBytes(native, { op: 'pdf', entree: input(0), mot_de_passe: pwd, actions: [], sortie: outputTarget('document.pdf') }, [{ name: 'document.pdf', bytes: file.bytes }]);
        const out = res.files[0];
        if (out) {
          start(file, out.bytes, null);
          return;
        }
      } catch (err) {
        services.notify(errorText(err), 'warning');
      }
    }
    start(file, file.bytes, pwd);
  }, [native, services, start]);

  const commit = useCallback((next: DocState, group: string | null = null) => {
    history.current?.commit(next, group);
    sync();
  }, [sync]);

  /** Ecrit les elements en attente dans les octets (avant une operation sur les pages, l'enregistrement...). */
  const flush = useCallback(async (flatten = false): Promise<DocState | null> => {
    const cur = history.current?.state;
    if (!cur) return null;
    if (!hasPending(cur) && !flatten) return cur;
    const res = await commitPending(cur, native, flatten, { cover: S.errors.coverOnly, raster: S.errors.rasterRedact });
    for (const note of res.notes) services.notify(note, 'warning');
    const next: DocState = { ...cur, bytes: res.bytes, items: [], values: {} };
    history.current?.commit(next);
    sync();
    return next;
  }, [native, services, sync]);

  /** Operation sur les octets (pdf-lib ou moteur natif) inscrite dans l'historique. */
  const mutate = useCallback(async (label: string, fn: (bytes: Uint8Array) => Promise<Uint8Array>): Promise<boolean> => {
    setBusy(label);
    try {
      const cur = await flush();
      if (!cur) return false;
      const out = await fn(cur.bytes);
      history.current?.commit(withLog(cur, label, { bytes: out, items: [], values: {} }));
      sync();
      return true;
    } catch (err) {
      services.notify(errorText(err), 'error');
      return false;
    } finally {
      setBusy(null);
    }
  }, [flush, services, sync]);

  const addItem = useCallback((item: Item) => {
    const cur = history.current?.state;
    if (cur) commit(withLog(cur, S.kinds[item.kind], { items: [...cur.items, item] }));
  }, [commit]);

  const changeItem = useCallback((item: Item) => {
    const cur = history.current?.state;
    if (cur) commit({ ...cur, items: cur.items.map((i) => (i.id === item.id ? item : i)) }, `item-${item.id}`);
  }, [commit]);

  const removeItems = useCallback((ids: ReadonlySet<string> | null, label: string) => {
    const cur = history.current?.state;
    if (!cur) return;
    const items = ids ? cur.items.filter((i) => !ids.has(i.id)) : [];
    if (items.length !== cur.items.length) commit(withLog(cur, label, { items }));
  }, [commit]);

  const setValue = useCallback((name: string, value: string | boolean) => {
    const cur = history.current?.state;
    if (cur) commit({ ...cur, values: { ...cur.values, [name]: value } }, `value-${name}`);
  }, [commit]);

  const undo = useCallback(() => {
    history.current?.undo();
    sync();
  }, [sync]);
  const redo = useCallback(() => {
    history.current?.redo();
    sync();
  }, [sync]);
  /** Revient a l'etat dont le journal compte `length` entrees. */
  const undoTo = useCallback((length: number) => {
    const h = history.current;
    if (!h) return;
    while (h.canUndo && h.state.log.length > length) h.undo();
    while (h.canRedo && h.state.log.length < length) h.redo();
    sync();
  }, [sync]);

  const save = useCallback(async (as: boolean) => {
    const cur = await flush();
    if (!cur || !info) return;
    try {
      const saved = await services.saveFile(cur.bytes, info.name, [{ name: 'PDF', extensions: ['pdf'] }], as ? null : info.path);
      if (!saved) return;
      savedLog.current = cur.log.length;
      setInfo({ ...info, name: saved.name, path: saved.path });
      services.setTitle(`${saved.name} - PDF`);
      services.notify(S.done.saved(saved.name), 'success');
      setState({ ...cur });
    } catch (err) {
      services.notify(errorText(err), 'error');
    }
  }, [flush, info, services]);

  const modified = state !== null && (state.log.length !== savedLog.current || hasPending(state));
  useEffect(() => services.setModified(modified), [modified, services]);

  return {
    native, state, info, pdf, fields, busy, setBusy, askPassword, setAskPassword, load, flush, mutate, addItem, changeItem, removeItems, setValue,
    undo, redo, undoTo, save, modified, canUndo: history.current?.canUndo ?? false, canRedo: history.current?.canRedo ?? false,
    editable: state !== null && info?.lockedPassword === null, commit,
  };
}
