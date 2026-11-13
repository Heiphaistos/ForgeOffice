// Fichier > Options : général, affichage à l'ouverture, vérification, enregistrement, diaporama, clavier.
import { useState } from 'react';
import { BackstageHeading, DisplayOptions, BackstageSection, Button, Checkbox, TextField, isOnlyOffice, OoAdvancedView, type OoAdvSection } from '@forgeoffice/ui';
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
  const body = (
    <>
      <DisplayOptions settings={settings} app="powerpoint" />
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
    </>
  );
  // Profil OnlyOffice : les sections de « Parametres avances » d'OnlyOffice (docs/captures/onlyoffice-ref/10.0/fichier-avances-presentation.png) ; nos options dessous.
  if (isOnlyOffice()) {
    const sections: OoAdvSection[] = [
      { t: 'Édition et sauvegarde', items: [
        { k: 'opt', t: 'Sauvegarder les informations relatives à la récupération automatique', on: true },
        { k: 'opt', t: 'Afficher le bouton Options de collage lorsque le contenu est collé', on: true },
      ] },
      { t: 'Vérification', items: [
        { k: 'opt', t: O.spell, on: options.spell, set: (v) => set('spell', v) },
        { k: 'opt', t: 'Ignorer les mots en MAJUSCULES', on: true }, { k: 'opt', t: 'Ignorer les mots contenant des chiffres', on: true },
        { k: 'btn', t: 'Options de correction automatique…' },
      ] },
      { t: 'Apparence', theme: true, items: [{ k: 'sel', t: "Style d'onglet", v: 'Ligne' }, { k: 'opt', t: "Utiliser la couleur de la barre d'outils comme arrière-plan des onglets" }] },
      { t: 'Espace de travail', items: [
        { k: 'opt', t: "Activer la prise en charge du lecteur d'écran" },
        { k: 'opt', t: "Guides d'alignement", on: options.smartGuides, set: (v) => set('smartGuides', v) },
        { k: 'opt', t: "Utiliser la touche Alt pour naviguer dans l'interface utilisateur à l'aide du clavier", on: true },
        { k: 'btn', t: "Personnaliser l'accès rapide" },
        { k: 'sel', t: 'Unité de mesure', v: 'Centimètre' }, { k: 'sel', t: 'Valeur de zoom par défaut', v: "Ajuster à la diapositive" },
      ] },
    ];
    return <div data-testid="options-page"><OoAdvancedView settings={settings} sections={sections} extra={body} close={() => ed.setUi({ backstage: null })} /></div>;
  }
  return (
    <div data-testid="options-page">
      <BackstageHeading>{O.title}</BackstageHeading>
      {body}
    </div>
  );
}
