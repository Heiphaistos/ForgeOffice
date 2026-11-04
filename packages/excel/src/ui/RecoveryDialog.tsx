// Proposition de restaurer la copie de secours d'un classeur non enregistre (fermeture inattendue).
import { sharedRecovery, type RecoveryEntry } from '@forgeoffice/core';
import { Dialog } from '@forgeoffice/ui';
import { openRecovery } from './io.ts';
import type { DocStore } from './store.ts';
import { S } from '../strings.ts';

interface RecoveryDialogProps {
  recovery: RecoveryEntry;
  store: DocStore;
  setName: (name: string) => void;
  onClose: () => void;
}

export function RecoveryDialog({ recovery, store, setName, onClose }: RecoveryDialogProps) {
  return (
    <Dialog open title={S.recoveryTitle} onClose={onClose} actions={[
      { label: S.recoveryOpen, primary: true, onClick: () => {
        void openRecovery(recovery).then((book) => {
          store.reset(book);
          setName(`${recovery.name} ${S.recovered}`);
          store.markSaved();
          // La copie reste protegee sous la session courante ; l'ancienne ne sera plus proposee.
          const rec = sharedRecovery('excel');
          void rec.save({ name: recovery.name, path: null, bytes: recovery.bytes }).then(() => rec.discard(recovery)).catch(() => undefined);
          onClose();
        });
      } },
      { label: S.recoveryDiscard, onClick: () => { void sharedRecovery('excel').discard(recovery).catch(() => undefined); onClose(); } },
    ]}>
      <p>{S.recoveryText(recovery.name, new Date(recovery.savedAt).toLocaleString('fr-FR'))}</p>
    </Dialog>
  );
}
