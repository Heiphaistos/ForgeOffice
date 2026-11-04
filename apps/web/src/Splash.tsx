// Ecran de demarrage facon Office : carre de l'application, nom, progression.
import type { ModuleInfo } from '@forgeoffice/core';
import { AppBadge, ProgressBar } from '@forgeoffice/ui';
import { S } from './strings.ts';

export function Splash({ info }: { info: ModuleInfo }) {
  return (
    <div className="fo-splash" aria-busy="true" aria-label={`${S.loading} ${info.name}`}>
      <AppBadge glyph={info.glyph} color={info.accent} size={72} />
      <div className="fo-splash__name">{info.name}</div>
      <div className="fo-splash__bar">
        <ProgressBar label={`${S.loading} ${info.name}`} />
      </div>
    </div>
  );
}
