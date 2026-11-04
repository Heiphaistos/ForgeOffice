// Ecran du navigateur (sans coquille native) : explication claire + entree dans la base de demonstration.
import type { Services } from '@forgeoffice/core';
import { MODULES } from '@forgeoffice/core';
import { AppBadge, Button, TitleBar } from '@forgeoffice/ui';
import { S } from '../strings.ts';

export function NoNative({ services, onDemo }: { services: Services; onDemo: () => void }) {
  const info = MODULES.access;
  return (
    <div className="acc acc-nonative" data-app="access">
      <TitleBar app={info} windowControls={services.windowControls} settings={services.settings} />
      <div className="acc-nonative__center">
        <AppBadge glyph={info.glyph} color={info.accent} size={96} label={info.name} />
        <h1>{S.noNative.title}</h1>
        <p>{S.noNative.body}</p>
        <div className="acc-nonative__actions">
          <Button appearance="primary" icon="database" onClick={onDemo}>{S.noNative.demo}</Button>
          <Button icon="home" onClick={() => void services.openModule('hub')}>{S.noNative.home}</Button>
        </div>
      </div>
    </div>
  );
}
