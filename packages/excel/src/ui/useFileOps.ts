// Fichier du Tableur : nom, chemin, format, ouverture, enregistrement, nouveau classeur, fermeture ; confirmation si le classeur est modifie.
import { useCallback, useEffect, useState } from 'react';
import { MODULES, sharedRecovery, type Services } from '@forgeoffice/core';
import { useConfirmDiscard } from '@forgeoffice/ui';
import { blankWorkbook, baseName, filtersFor, formatOf, loadWorkbook, OPEN_FILTERS, serialize, type SaveFormat } from './io.ts';
import type { DocStore } from './store.ts';
import { S } from '../strings/index.ts';

const excel = MODULES.excel;

interface FileOpsDeps {
  store: DocStore;
  services: Services;
  si: number;
  notify: (m: string, kind?: 'info' | 'success' | 'warning' | 'error') => void;
  setSi: (i: number) => void;
  /** Etat de l'interface a reinitialiser quand un autre classeur remplace le courant (selections, tableaux croises). */
  onReplaced: () => void;
  closeBackstage: () => void;
}

export function useFileOps({ store, services, si, notify, setSi, onReplaced, closeBackstage }: FileOpsDeps) {
  const [name, setName] = useState<string>(S.defaultName);
  const [path, setPath] = useState<string | null>(null);
  const [format, setFormat] = useState<SaveFormat>('xlsx');
  const confirm = useConfirmDiscard();

  const loadFile = useCallback(async (bytes: Uint8Array, fileName: string, filePath: string | null) => {
    try {
      const book = await loadWorkbook(bytes, fileName);
      store.reset(book);
      onReplaced();
      setSi(Math.min(book.activeSheet, book.sheets.length - 1));
      setName(baseName(fileName));
      setPath(filePath);
      setFormat(formatOf(fileName));
      await services.addRecent({ app: 'excel', name: fileName, path: filePath ?? fileName });
    } catch (err) {
      notify(`${S.openFailed} ${err instanceof Error ? err.message : String(err)}`, 'error');
    }
  }, [store, services, notify, setSi, onReplaced]);

  useEffect(() => {
    services.setModified(store.modified);
  }, [services, store.modified, store.version]);

  useEffect(() => {
    services.setTitle(`${name} - ${excel.name}`);
  }, [services, name]);

  const save = useCallback(async (asName?: string, asFormat?: SaveFormat, protectFormulas = true) => {
    const fmt = asFormat ?? format;
    const target = asName ?? name;
    try {
      const bytes = await serialize(store.wb, store.engine, fmt, si, protectFormulas);
      const res = await services.saveFile(bytes, `${target}.${fmt}`, filtersFor(fmt), asName || asFormat ? null : path);
      if (!res) return;
      setName(baseName(res.name));
      setPath(res.path);
      setFormat(fmt);
      store.markSaved();
      void sharedRecovery('excel').clear().catch(() => undefined);
      await services.addRecent({ app: 'excel', name: res.name, path: res.path ?? res.name });
      notify(S.saved(res.name), 'success');
      closeBackstage();
    } catch (err) {
      notify(`${S.saveFailed} ${err instanceof Error ? err.message : String(err)}`, 'error');
    }
  }, [format, name, path, si, store, services, notify, closeBackstage]);

  /** Vrai si le classeur courant peut etre remplace ou ferme (modifie : Enregistrer / Ne pas enregistrer / Annuler). */
  const canReplace = useCallback(() => confirm.guard(store.modified, name, async () => {
    await save();
    return !store.modified;
  }), [confirm, store, name, save]);

  const openFile = useCallback(async () => {
    const f = await services.openFile(OPEN_FILTERS);
    if (f && await canReplace()) await loadFile(f.bytes, f.name, f.path);
    closeBackstage();
  }, [services, loadFile, canReplace, closeBackstage]);

  const newBlank = useCallback(async () => {
    if (await canReplace()) {
      store.reset(blankWorkbook());
      onReplaced();
      setSi(0);
      setName(S.defaultName);
      setPath(null);
      setFormat('xlsx');
    }
    closeBackstage();
  }, [canReplace, store, onReplaced, setSi, closeBackstage]);

  const closeDoc = useCallback(async () => {
    if (await canReplace()) services.close();
  }, [canReplace, services]);

  return { name, setName, path, loadFile, save, openFile, newBlank, closeDoc, confirmDialog: confirm.dialog };
}
