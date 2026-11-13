// Fichier du profil OnlyOffice (Texte) : « Infos sur le document » et « Paramètres avancés » avec les sections de l'application reelle
// (docs/captures/onlyoffice-ref/10.0/fichier-*.png), branchees sur nos reglages ; ce qui n'existe pas chez nous reste grise avec son infobulle.
import { useState, type ReactNode } from 'react';
import { OoAdvancedView, OoInfoView, type OoAdvSection } from '@forgeoffice/ui';
import { plainText } from '@forgeoffice/docx';
import { fullDocument } from '../app/actions.ts';
import { advancedStats } from '../features/stats.ts';
import { ptToCm } from '../ribbon/shared.ts';
import type { BackstageEnv } from './BackstagePages.tsx';

const when = (iso?: string): string => (iso ? new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '');

/** « Infos sur le document » : Communs, Statistiques, Propriétés. */
export function OoInfo({ c, env, pageCount, sections }: BackstageEnv) {
  const text = plainText(fullDocument(env));
  const st = advancedStats(text);
  const props = c.meta.properties;
  const sec = sections[0];
  const size = sec ? `${ptToCm(sec.pageWidth).toFixed(2).replace('.', ',')} cm x ${ptToCm(sec.pageHeight).toFixed(2).replace('.', ',')} cm` : '';
  return (
    <OoInfoView
      heading="Infos sur le document" titleLabel="Titre du document" props={props}
      set={(k, v) => c.updateMeta((m) => ({ ...m, properties: { ...m.properties, [k]: v || undefined } }))}
      common={[['Dernière modification', when(props.modified)], ['Dernière modification par', props.lastModifiedBy ?? ''], ['Titre du document', props.title ?? ''], ['Sujet', props.subject ?? ''], ['Créé', when(props.created)], ['Auteur', props.creator ?? '']]}
      stats={[['Pages', pageCount], ['Paragraphes', st.paragraphs], ['Mots', st.words], ['Caractères', st.characters], ['Caractères avec espaces', text.length], ['Taille de la page', size]]}
    />
  );
}

/** « Paramètres avancés » : sections d'OnlyOffice, branchées quand la fonction existe ; nos options propres restent plus bas. */
export function OoAdvanced({ c, close, extra }: BackstageEnv & { extra: ReactNode }) {
  const settings = c.services.settings;
  const [auto, setAutoState] = useState(() => settings.get('word.autocorrect', true));
  const setAuto = (v: boolean): void => { setAutoState(v); settings.set('word.autocorrect', v); };
  const sections: OoAdvSection[] = [
    { t: 'Édition et sauvegarde', items: [
      { k: 'opt', t: 'Sauvegarder les informations relatives à la récupération automatique', on: true },
      { k: 'opt', t: 'Afficher le bouton Options de collage lorsque le contenu est collé', on: true },
      { k: 'opt', t: 'Utiliser une sélection intelligente des paragraphes', on: true },
      { k: 'opt', t: "Rendre les fichiers compatibles avec les anciennes versions de MS Word lorsqu'ils sont enregistrés au format DOCX, DOTX" },
    ] },
    { t: 'Vérification', items: [
      { k: 'opt', t: 'Vérification orthographique', on: c.ui.spell, set: (spell) => c.setUi({ spell }) },
      { k: 'opt', t: 'Ignorer les mots en MAJUSCULES', on: true },
      { k: 'opt', t: 'Ignorer les mots contenant des chiffres', on: true },
      { k: 'opt', t: 'Correction automatique', on: auto, set: setAuto },
    ] },
    { t: 'Contenu du document', items: [{ k: 'sel', t: 'Chiffres', v: 'Arabe' }] },
    { t: 'Apparence', theme: true, items: [{ k: 'opt', t: 'Activer le mode sombre pour les documents' }, { k: 'sel', t: "Style d'onglet", v: 'Ligne' }] },
    { t: 'Espace de travail', items: [{ k: 'opt', t: "Guides d'alignement", on: true }, { k: 'sel', t: 'Unité de mesure', v: 'Centimètre' }, { k: 'sel', t: 'Valeur de zoom par défaut', v: '100%' }] },
  ];
  return <OoAdvancedView settings={settings} sections={sections} extra={extra} close={close} />;
}
