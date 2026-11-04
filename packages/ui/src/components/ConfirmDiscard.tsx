// Hook de confirmation « enregistrer les modifications ? » : `guard()` puis afficher `dialog` dans le rendu du module.
import { useCallback, useRef, useState, type ReactElement } from 'react';
import { guardUnsaved, type DiscardAnswer } from '../logic/discard.ts';
import { S } from '../strings.ts';
import { Dialog } from './Dialog.tsx';

export interface ConfirmDiscard {
  /** Vrai si l'operation (ouvrir, nouveau, fermer) peut continuer. */
  guard(modified: boolean, name: string, save: () => Promise<boolean>): Promise<boolean>;
  /** Boite a rendre dans le module (null quand aucune question n'est posee). */
  dialog: ReactElement | null;
}

export function useConfirmDiscard(): ConfirmDiscard {
  const [asking, setAsking] = useState<string | null>(null);
  const resolver = useRef<((a: DiscardAnswer) => void) | null>(null);
  const ask = useCallback((name: string) => new Promise<DiscardAnswer>((resolve) => {
    resolver.current = resolve;
    setAsking(name);
  }), []);
  const answer = (a: DiscardAnswer): void => {
    setAsking(null);
    resolver.current?.(a);
    resolver.current = null;
  };
  const guard = useCallback((modified: boolean, name: string, save: () => Promise<boolean>) => guardUnsaved(modified, () => ask(name), save), [ask]);
  const dialog = asking === null ? null : (
    <Dialog
      open
      title={S.discard.title}
      onClose={() => answer('cancel')}
      actions={[
        { label: S.discard.save, primary: true, onClick: () => answer('save') },
        { label: S.discard.dontSave, onClick: () => answer('discard') },
        { label: S.dialog.cancel, onClick: () => answer('cancel') },
      ]}
      width={440}
    >
      <p>{S.discard.text(asking)}</p>
    </Dialog>
  );
  return { guard, dialog };
}
