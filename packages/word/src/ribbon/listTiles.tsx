// Profil OnlyOffice : cases de la bibliotheque de numerotations / listes (apercu = 3 lignes « marqueur + trait »).
import type { ReactNode } from 'react';

export function listTile(markers: readonly string[], indent = false): ReactNode {
  return (
    <span className="fo-oo-tile">
      {markers.map((m, i) => (
        <span key={m} className="fo-oo-tile__row" style={indent ? { paddingLeft: i * 10 } : undefined}><b>{m}</b><i /></span>
      ))}
    </span>
  );
}

export const noneTile: ReactNode = <span className="fo-oo-tile fo-oo-tile--none">Aucun</span>;
