// Page Options de la Publication (Fichier > Options) : correcteur et langue, enregistrement de recuperation, affichage et magnetisme.
import { BackstageHeading, BackstageSection, Checkbox } from '@forgeoffice/ui';
import { S } from '../strings.ts';
import type { Editor } from './editor.ts';

export const BACKUP_SETTING = 'publisher.backupSeconds';
export const DEFAULT_BACKUP_SECONDS = 30;
export const BACKUP_CHOICES: readonly number[] = [0, 10, 30, 60, 300];

/** Delai de la copie de recuperation en millisecondes ; 0 = desactivee. */
export const backupDelayMs = (seconds: number): number => (BACKUP_CHOICES.includes(seconds) ? seconds * 1000 : DEFAULT_BACKUP_SECONDS * 1000);

export function OptionsPage({ ed }: { ed: Editor }) {
  const { ui, setUi, services } = ed;
  const backup = services.settings.get(BACKUP_SETTING, DEFAULT_BACKUP_SECONDS);
  const setSpell = (on: boolean): void => { services.settings.set('publisher.spell', on); setUi({ spell: on }); };
  const setLang = (lang: string): void => { services.settings.set('publisher.lang', lang); setUi({ lang }); };
  return (
    <>
      <BackstageHeading>{S.options.title}</BackstageHeading>
      <BackstageSection title={S.options.proofing}>
        <Checkbox checked={ui.spell} label={S.options.spell} onChange={setSpell} />
        <label className="pub-field">
          <span>{S.options.language}</span>
          <select value={ui.lang} onChange={(e) => setLang(e.target.value)} aria-label={S.options.language}>
            {S.review.languages.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
        </label>
      </BackstageSection>
      <BackstageSection title={S.options.saving}>
        <label className="pub-field">
          <span>{S.options.backup}</span>
          <select value={backup} onChange={(e) => { services.settings.set(BACKUP_SETTING, Number(e.target.value)); ed.notify(S.options.applied, 'info'); }} aria-label={S.options.backup}>
            {BACKUP_CHOICES.map((s) => <option key={s} value={s}>{s === 0 ? S.options.never : S.options.every(s)}</option>)}
          </select>
        </label>
      </BackstageSection>
      <BackstageSection title={S.options.display}>
        <div className="pub-form">
        <Checkbox checked={ui.rulers} label={S.options.rulers} onChange={(rulers) => setUi({ rulers })} />
        <Checkbox checked={ui.boundaries} label={S.options.boundaries} onChange={(boundaries) => setUi({ boundaries })} />
        <Checkbox checked={ui.snapGuides} label={S.options.snapGuides} onChange={(snapGuides) => setUi({ snapGuides })} />
        <Checkbox checked={ui.snapObjects} label={S.options.snapObjects} onChange={(snapObjects) => setUi({ snapObjects })} />
        <Checkbox checked={ui.guidesLocked} label={S.cmd.lockGuides} onChange={(guidesLocked) => setUi({ guidesLocked })} />
        </div>
      </BackstageSection>
    </>
  );
}
