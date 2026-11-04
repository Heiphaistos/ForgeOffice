// Module pas encore livre : page propre avec retour a l'accueil.
import type { ModuleInfo, Services } from '@forgeoffice/core';
import { AppBadge, Button, TitleBar } from '@forgeoffice/ui';
import { S } from './strings.ts';

export function ComingSoon({ info, services }: { info: ModuleInfo; services: Services }) {
  return (
    <div className="fo-shell-page">
      <TitleBar app={info} windowControls={services.windowControls} settings={services.settings} />
      <div className="fo-shell-center">
        <AppBadge glyph={info.glyph} color={info.accent} size={96} label={info.name} />
        <h1 className="fo-shell-title">{S.soon.title}</h1>
        <p className="fo-shell-text">{S.soon.body(info.name)}</p>
        <div className="fo-shell-actions">
          <Button appearance="primary" icon="home" onClick={() => void services.openModule('hub')}>
            {S.soon.back}
          </Button>
        </div>
      </div>
    </div>
  );
}
