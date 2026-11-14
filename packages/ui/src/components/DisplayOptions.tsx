// Bloc « Disposition » + « Ouverture des documents » des pages Options (partage par tous les modules).
import { useState } from 'react';
import type { AppId, Settings } from '@forgeoffice/core';
import { FIT_MODES, FOLLOW_GLOBAL, LAYOUT_IDS, OPEN_MODES, OPEN_MODE_SETTING, isLayoutId, savedGlobalLayout, savedModuleLayout, savedFit, savedOpenMode, type FitMode, type OpenMode } from '../logic/layouts.ts';
import { chooseFit, chooseLayout } from '../layoutHooks.ts';
import { S } from '../strings.ts';

export function DisplayOptions({ settings, app }: { settings: Settings; app?: AppId }) {
  const [global, setGlobal] = useState(() => savedGlobalLayout(settings));
  const [own, setOwn] = useState(() => (app ? savedModuleLayout(settings, app) : null));
  const [mode, setMode] = useState<OpenMode>(() => savedOpenMode(settings));
  const [fit, setFit] = useState<FitMode>(() => savedFit(settings));
  const L = S.layouts;
  return (
    <section className="fo-display-options">
      <h3>{L.title}</h3>
      <p className="fo-display-options__hint">{L.hint}</p>
      <label className="fo-display-options__row">
        <span>{L.global}</span>
        <select value={global} onChange={(e) => { const v = e.target.value; if (isLayoutId(v)) { setGlobal(v); chooseLayout(settings, v); } }}>
          {LAYOUT_IDS.map((id) => <option key={id} value={id}>{L.names[id]}</option>)}
        </select>
      </label>
      {app && (
        <label className="fo-display-options__row">
          <span>{L.thisModule}</span>
          <select value={own ?? FOLLOW_GLOBAL} onChange={(e) => { const v = e.target.value; const next = isLayoutId(v) ? v : null; setOwn(next); chooseLayout(settings, next, app); }}>
            <option value={FOLLOW_GLOBAL}>{L.follow}</option>
            {LAYOUT_IDS.map((id) => <option key={id} value={id}>{L.names[id]}</option>)}
          </select>
        </label>
      )}
      <h3>{L.fitTitle}</h3>
      <p className="fo-display-options__hint">{L.fitHint}</p>
      <div role="radiogroup" aria-label={L.fitTitle} className="fo-display-options__radios">
        {FIT_MODES.map((m) => (
          <label key={m}>
            <input type="radio" name="fo-fit-mode" checked={fit === m} onChange={() => { setFit(m); chooseFit(settings, m); }} />
            {L.fit[m]}
          </label>
        ))}
      </div>
      <h3>{L.openTitle}</h3>
      <p className="fo-display-options__hint">{L.openHint}</p>
      <div role="radiogroup" aria-label={L.openTitle} className="fo-display-options__radios">
        {OPEN_MODES.map((m) => (
          <label key={m}>
            <input type="radio" name="fo-open-mode" checked={mode === m} onChange={() => { setMode(m); settings.set(OPEN_MODE_SETTING, m); }} />
            {L.open[m]}
          </label>
        ))}
      </div>
    </section>
  );
}
