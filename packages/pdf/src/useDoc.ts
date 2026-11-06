// Document ouvert dans le module PDF : octets + elements en attente dans un historique annuler/retablir,
// document pdf.js d'affichage, champs du formulaire, mot de passe, ecriture des modifications.
import { useCallback, useEffect, useRef, useState } from 'react';
import { History, type NativeBridge, type OpenedFile, type Services } from '@forgeoffice/core';
import { input, outputTarget, pdfOps, runBytes } from '@forgeoffice/convert';
import { analyze } from './analyze.ts';
import type { DocFlags, FieldInfo } from './forms.ts';
import { hasPending, isExisting, mergeExisting, withLog, type DocState, type Item } from './model.ts';
import { verifySignatures, type SignatureReport } from './sign/verify.ts';
import { commitPending, openPdf, type PDFDocumentProxy } from './pdfdoc.ts';
import { S } from './strings.ts';

export interface OpenDoc {
  name: string;
  path: string | null;
  /** Protege et non dechiffrable ici : lecture seule avec ce mot de passe. */
  lockedPassword: string | null;
}

/** Les signatures numeriques portent toujours un dictionnaire /ByteRange en clair. */
const hasSignatureMarker = (b: Uint8Array): boolean => new TextDecoder('latin1').decode(b).includes('/ByteRange');
const errorText = (err: unknown): string => (err instanceof Error ? err.message : String(err));
const isPdf = (b: Uint8Array): boolean => new TextDecoder('latin1').decode(b.subarray(0, 1024)).includes('%PDF');

export function useDoc(services: Services) {
  const native: NativeBridge | null = services.native;
  const history = useRef<History<DocState> | null>(null);
  const [state, setState] = useState<DocState | null>(null);
  const [info, setInfo] = useState<OpenDoc | null>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [fields, setFields] = useState<FieldInfo[]>([]);
  const [existing, setExisting] = useState<Item[]>([]);
  const [flags, setFlags] = useState<DocFlags>({ xfa: false, javascript: false });
  const [signatures, setSignatures] = useState<SignatureReport[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [askPassword, setAskPassword] = useState<{ file: OpenedFile; error: boolean } | null>(null);
  const live = useRef<PDFDocumentProxy | null>(null);
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
    (async () => {
      // Protege et non dechiffre : lecture seule, aucune analyse du contenu.
      const a = password ? null : await analyze(bytes).catch(() => null);
      if (!alive) return;
      setFields(a?.fields ?? []);
      setExisting(a?.existing ?? []);
      setFlags(a?.flags ?? { xfa: false, javascript: false });
      const d = await openPdf(a?.display ?? bytes, password);
      if (!alive) {
        void d.loadingTask.destroy();
        return;
      }
      // L'ancien document n'est detruit qu'apres le remplacement : les pages affichees l'utilisent jusque-la.
      const old = live.current;
      live.current = d;
      setPdf(d);
      if (old) window.setTimeout(() => void old.loadingTask.destroy(), 3000);
    })().catch((err: unknown) => services.notify(S.errors.open(errorText(err)), 'error'));
    if (!password && hasSignatureMarker(bytes)) verifySignatures(bytes).then((r) => alive && setSignatures(r), () => alive && setSignatures([]));
    else setSignatures([]);
    return () => {
      alive = false;
    };
  }, [bytes, password, services]);
  useEffect(() => () => void live.current?.loadingTask.destroy(), []);

  const start = useCallback((file: OpenedFile, data: Uint8Array, locked: string | null) => {
    history.current = new History<DocState>({ bytes: data, items: [], values: {}, annotEdits: {}, log: [S.opened] }, { limit: 100 });
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
      // Chiffre avec mot de passe vide : pdf.js l'ouvre, on le dechiffre pour pouvoir l'editer.
      start(file, (await pdfOps.unlock(file.bytes)) ?? file.bytes, null);
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
    const clear = await pdfOps.unlock(file.bytes, pwd);
    start(file, clear ?? file.bytes, clear ? null : pwd);
  }, [native, services, start]);

  /** Marque le document comme protege (lecture seule, mot de passe d'affichage) ou, avec null, comme editable. */
  const setLocked = useCallback((pwd: string | null) => setInfo((i) => (i ? { ...i, lockedPassword: pwd } : i)), []);

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
    const next: DocState = { ...cur, bytes: res.bytes, items: [], values: {}, annotEdits: {} };
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
      history.current?.commit(withLog(cur, label, { bytes: out, items: [], values: {}, annotEdits: {} }));
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

  /** Modifie un element en attente, ou une annotation deja dans le fichier (consignee a part jusqu'a l'enregistrement). */
  const changeItem = useCallback((item: Item) => {
    const cur = history.current?.state;
    if (!cur) return;
    if (isExisting(item.id)) commit({ ...cur, annotEdits: { ...cur.annotEdits, [item.id]: item } }, `item-${item.id}`);
    else commit({ ...cur, items: cur.items.map((i) => (i.id === item.id ? item : i)) }, `item-${item.id}`);
  }, [commit]);

  /** Supprime des elements en attente et/ou des annotations du fichier ; sans liste, vide les seuls elements en attente. */
  const removeItems = useCallback((ids: ReadonlySet<string> | null, label: string) => {
    const cur = history.current?.state;
    if (!cur) return;
    const items = ids ? cur.items.filter((i) => !ids.has(i.id)) : [];
    const gone = ids ? [...ids].filter(isExisting) : [];
    if (items.length === cur.items.length && gone.length === 0) return;
    commit(withLog(cur, label, { items, annotEdits: { ...cur.annotEdits, ...Object.fromEntries(gone.map((id) => [id, null])) } }));
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

  /** Annotations du fichier (avec les modifications en attente) suivies des elements ajoutes. */
  const allItems = state ? [...mergeExisting(existing, state.annotEdits), ...state.items] : [];
  const modified = state !== null && (state.log.length !== savedLog.current || hasPending(state));
  useEffect(() => services.setModified(modified), [modified, services]);

  return {
    native, state, info, pdf, fields, flags, signatures, allItems, busy, setBusy, askPassword, setAskPassword, load, setLocked, flush, mutate, addItem, changeItem, removeItems, setValue,
    undo, redo, undoTo, save, modified, canUndo: history.current?.canUndo ?? false, canRedo: history.current?.canRedo ?? false,
    editable: state !== null && info?.lockedPassword === null, commit,
  };
}
