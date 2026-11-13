// Fichier du profil OnlyOffice (Tableur) : « Infos sur le classeur » et « Parametres avances » (docs/captures/onlyoffice-ref/10.0/fichier-*-tableur.png).
import type { ReactNode } from 'react';
import { OoAdvancedView, OoInfoView, type OoAdvSection } from '@forgeoffice/ui';
import type { BackstageEnv } from './BackstagePages.tsx';

const when = (iso?: string): string => (iso ? new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '');

export function OoExcelInfo({ e }: { e: BackstageEnv }) {
  const p = e.wb.properties;
  return (
    <OoInfoView
      heading="Infos sur le classeur" titleLabel="Titre du classeur" props={{ ...p, title: p.title ?? '' }}
      set={(k, v) => e.setProperties({ [k]: v })}
      common={[['Date de dernière modification', when(p.modified)], ['Dernière modification par', p.lastModifiedBy ?? ''], ['Créé', when(p.created)], ['Application', [p.application, p.appVersion].filter(Boolean).join(' ') || 'ForgeOffice']]}
    />
  );
}

export function OoExcelAdvanced({ e, extra }: { e: BackstageEnv; extra: ReactNode }) {
  const sections: OoAdvSection[] = [
    { t: 'Édition et sauvegarde', items: [
      { k: 'opt', t: 'Sauvegarder les informations relatives à la récupération automatique', on: true },
      { k: 'opt', t: "Afficher l'infobulle de la fonction", on: true },
      { k: 'opt', t: 'Activer la saisie semi-automatique des valeurs de cellule', on: true },
    ] },
    { t: 'Collaboration', items: [{ k: 'opt', t: 'Afficher les commentaires dans la feuille', on: true }, { k: 'opt', t: 'Afficher les commentaires résolus' }] },
    { t: 'Apparence', theme: true, items: [{ k: 'sel', t: "Style d'onglet", v: 'Ligne' }, { k: 'opt', t: "Utiliser la couleur de la barre d'outils comme arrière-plan des onglets" }] },
    { t: 'Espace de travail', items: [
      { k: 'opt', t: "Activer la prise en charge du lecteur d'écran" },
      { k: 'opt', t: 'Style de référence L1C1' },
      { k: 'opt', t: "Utiliser la touche Alt pour naviguer dans l'interface utilisateur à l'aide du clavier", on: true },
      { k: 'opt', t: 'Accroché à la grille lors du défilement' },
      { k: 'opt', t: 'Afficher la barre de défilement horizontale', on: true },
      { k: 'opt', t: 'Afficher la barre de défilement verticale', on: true },
      { k: 'sel', t: 'Valeur de zoom par défaut', v: '100%' },
      { k: 'sel', t: 'Unité de mesure', v: 'Centimètre' },
    ] },
    { t: 'Paramètres régionaux', items: [
      { k: 'sel', t: 'Langage de formule', v: 'Français' }, { k: 'sel', t: 'Région', v: 'Français – France' },
      { k: 'opt', t: 'Utiliser des séparateurs basés sur les paramètres régionaux', on: true },
      { k: 'num', t: 'Séparateur décimal', v: ',' }, { k: 'num', t: 'Séparateur de milliers', v: '' },
    ] },
    { t: 'Vérification', items: [
      { k: 'sel', t: 'Langue du dictionnaire', v: 'Français – France' },
      { k: 'opt', t: 'Ignorer les mots en MAJUSCULES', on: true }, { k: 'opt', t: 'Ignorer les mots contenant des chiffres', on: true },
      { k: 'btn', t: 'Options de correction automatique…' },
    ] },
    { t: 'Couper, copier et coller', items: [{ k: 'opt', t: "Activer la copie d'images pour les cellules", on: true }, { k: 'opt', t: 'Afficher le bouton Options de collage lorsque le contenu est collé', on: true }] },
    { t: 'Calcul en cours', items: [
      { k: 'opt', t: 'Utiliser le calendrier depuis 1904' }, { k: 'opt', t: 'Activer le calcul itératif', on: false },
      { k: 'num', t: "Nombre maximal d'itérations", v: '100' }, { k: 'num', t: 'Variation maximale', v: '0.001' },
    ] },
  ];
  return <OoAdvancedView settings={e.services.settings} sections={sections} extra={extra} close={e.closeBackstage} />;
}
