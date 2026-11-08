// Fichier > Options : général, affichage à l'ouverture, vérification, enregistrement, diaporama, clavier.
import { useState } from 'react';
import { BackstageHeading, BackstageSection, Button, Checkbox, TextField } from '@forgeoffice/ui';
import { S } from '../strings.ts';
import { S3 } from './strings-text.ts';
import type { Editor } from './editor.ts';
import { AUTOSAVE_CHOICES, LANGUAGES, OPTION_KEYS, readOptions, type AppOptions } from './options-model.ts';

export function OptionsPage({ ed, onShortcuts }: { ed: Editor; onShortcuts: () => void }) {
  const settings = ed.services.settings;
  const [, bump] = useState(0);
  const options = readOptions((k, d) => settings.get(k, d), S.review.defaultAuthor);
  const [author, setAuthor] = useState(options.author);
  const O = S3.options;
  const set = <K extends keyof AppOptions>(key: K, value: AppOptions[K]): void => {
    settings.set(OPTION_KEYS[key], value);
    bump((n) => n + 1);
    ed.setUi({});
  };
  const check = (key: 'ruler' | 'grid' | 'smartGuides' | 'thumbnails' | 'notes' | 'spell' | 'presenter' | 'useTimings', label: string) => (
    <Checkbox checked={options[key]} label={label} onChange={(v) => set(key, v)} />
  );
  return (
    <div data-testid="options-page">
      <BackstageHeading>{O.title}</BackstageHeading>
      <BackstageSection title={O.general}>
        <TextField label={S.file.userName} value={author} onChange={(e) => setAuthor(e.target.value)} onBlur={() => set('author', author.trim() || S.review.defaultAuthor)} />
      </BackstageSection>
      <BackstageSection title={O.display}>
        <div className="pp-stack">
          {check('ruler', O.ruler)}
          {check('grid', O.grid)}
          {check('smartGuides', O.smartGuides)}
          {check('thumbnails', O.thumbnails)}
          {check('notes', O.notes)}
        </div>
      </BackstageSection>
      <BackstageSection title={O.proofing}>
        <div className="pp-stack">
          {check('spell', O.spell)}
          <div className="pp-form">
            <label htmlFor="pp-opt-lang">{O.language}</label>
            <select id="pp-opt-lang" value={options.lang} onChange={(e) => set('lang', e.target.value)}>
              {LANGUAGES.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
          </div>
        </div>
      </BackstageSection>
      <BackstageSection title={O.saving}>
        <div className="pp-form">
          <label htmlFor="pp-opt-autosave">{O.autosave}</label>
          <select id="pp-opt-autosave" value={options.autosaveMinutes} onChange={(e) => set('autosaveMinutes', Number(e.target.value))}>
            {AUTOSAVE_CHOICES.map((m) => <option key={m} value={m}>{O.autosaveNames[m]}</option>)}
            {!AUTOSAVE_CHOICES.includes(options.autosaveMinutes) && <option value={options.autosaveMinutes}>{O.autosaveCustom}</option>}
          </select>
        </div>
      </BackstageSection>
      <BackstageSection title={O.show}>
        <div className="pp-stack">
          {check('presenter', O.presenter)}
          {check('useTimings', O.timings)}
        </div>
      </BackstageSection>
      <BackstageSection title={O.keyboard}>
        <Button onClick={onShortcuts}>{O.shortcutsButton}</Button>
      </BackstageSection>
    </div>
  );
}
