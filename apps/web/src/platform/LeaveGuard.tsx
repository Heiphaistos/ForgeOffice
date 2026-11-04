// Bouton Retour d'Android dans un module : retour a l'Accueil, avec confirmation si le document est modifie.
import { useEffect, useState } from 'react';
import { Dialog } from '@forgeoffice/ui';
import { LEAVE_EVENT, type LeaveDetail } from './android.ts';
import { S } from '../strings.ts';

export function LeaveGuard({ onLeave }: { onLeave: () => void }) {
  const [asking, setAsking] = useState(false);
  useEffect(() => {
    const onRequest = (e: Event): void => {
      if ((e as CustomEvent<LeaveDetail>).detail?.modified) setAsking(true);
      else onLeave();
    };
    window.addEventListener(LEAVE_EVENT, onRequest);
    return () => window.removeEventListener(LEAVE_EVENT, onRequest);
  }, [onLeave]);
  if (!asking) return null;
  return (
    <Dialog
      open
      title={S.leave.title}
      onClose={() => setAsking(false)}
      actions={[
        { label: S.leave.stay, primary: true, onClick: () => setAsking(false) },
        { label: S.leave.leave, onClick: () => { setAsking(false); onLeave(); } },
      ]}
      width={420}
    >
      <p>{S.leave.body}</p>
    </Dialog>
  );
}
