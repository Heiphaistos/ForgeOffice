// Textes des filtres personnalises de la feuille de donnees.
import type { FilterFamily } from './logic/custom-filter.ts';

export const F = {
  menu: { texte: 'Filtres de texte', nombre: 'Filtres numériques', date: 'Filtres de dates' } satisfies Record<FilterFamily, string>,
  options: {
    egal: 'Égal à…', different: 'Différent de…', commence_par: 'Commence par…', finit_par: 'Se termine par…', contient: 'Contient…',
    ne_contient_pas: 'Ne contient pas…', est_vide: 'Est vide', nest_pas_vide: 'N’est pas vide', inferieur: 'Inférieur à…',
    inferieur_ou_egal: 'Inférieur ou égal à…', superieur: 'Supérieur à…', superieur_ou_egal: 'Supérieur ou égal à…', entre: 'Entre…',
  } as Record<string, string>,
  title: (family: string, option: string) => `${family} : ${option.replace(/…$/, '')}`,
  field: (name: string) => `Champ « ${name} »`,
  value: 'Valeur',
  from: 'De',
  to: 'À',
  errors: {
    empty: 'Saisissez une valeur.',
    number: 'Saisissez un nombre valide.',
    date: 'Saisissez une date valide (jj/mm/aaaa).',
  },
  ok: 'OK',
  cancel: 'Annuler',
} as const;
