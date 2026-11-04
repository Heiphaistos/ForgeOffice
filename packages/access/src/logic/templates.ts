// Modeles de base (Contacts, Inventaire, Taches, Factures) : tables, relations et donnees d'exemple creees par code.
import { S } from '../strings.ts';
import type { DefinitionChamp, DefinitionTable, Relation, Row, TypeChamp } from '../types.ts';

export interface TemplateDef {
  id: string;
  label: string;
  description: string;
  tables: DefinitionTable[];
  relations: Relation[];
  /** Lignes inserees dans l'ordre des tables (parents d'abord). */
  rows: Record<string, Row[]>;
  /** Table ouverte apres la creation. */
  main: string;
}

function f(nom: string, type: TypeChamp, extra: Partial<DefinitionChamp> = {}): DefinitionChamp {
  return { nom, type, cle_primaire: type === 'numero_auto', ...extra };
}

function rel(parent: string, child: string, field: string, cascade = false): Relation {
  return {
    nom: '', table_parent: parent, champs_parent: ['N°'], table_enfant: child, champs_enfant: [field],
    integrite: true, cascade_maj: false, suppression: cascade ? 'cascade' : 'restreindre', jointure: 'interne',
  };
}

const PHONE_MASK = '00 00 00 00 00;0;_';

export const TEMPLATES: readonly TemplateDef[] = [
  {
    id: 'contacts', label: S.templates.contacts, description: S.templates.contactsDesc, main: 'Contacts',
    tables: [{
      nom: 'Contacts',
      champs: [
        f('N°', 'numero_auto'), f('Prénom', 'texte_court', { taille: 50 }), f('Nom', 'texte_court', { taille: 50, requis: true, indexe: 'avec_doublons' }),
        f('Société', 'texte_court', { taille: 100 }), f('Fonction', 'texte_court', { taille: 100 }), f('Courriel', 'lien_hypertexte'),
        f('Téléphone', 'texte_court', { taille: 20, masque_saisie: PHONE_MASK }), f('Adresse', 'texte_court'), f('Ville', 'texte_court', { taille: 80 }),
        f('Code postal', 'texte_court', { taille: 10 }), f('Pays', 'texte_court', { taille: 60, valeur_defaut: '"France"' }), f('Notes', 'texte_long'),
      ],
    }],
    relations: [],
    rows: {
      Contacts: [
        { Prénom: 'Camille', Nom: 'Martin', Société: 'Atelier Lumière', Fonction: 'Gérante', Courriel: 'mailto:camille.martin@exemple.fr', Téléphone: '0102030405', Ville: 'Lyon', 'Code postal': '69002', Pays: 'France' },
        { Prénom: 'Hugo', Nom: 'Bernard', Société: 'Bernard & Fils', Fonction: 'Comptable', Courriel: 'mailto:hugo@exemple.fr', Téléphone: '0611223344', Ville: 'Nantes', 'Code postal': '44000', Pays: 'France' },
        { Prénom: 'Léa', Nom: 'Dubois', Société: 'Studio Nord', Fonction: 'Directrice artistique', Ville: 'Lille', 'Code postal': '59000', Pays: 'France' },
      ],
    },
  },
  {
    id: 'inventory', label: S.templates.inventory, description: S.templates.inventoryDesc, main: 'Produits',
    tables: [
      { nom: 'Catégories', champs: [f('N°', 'numero_auto'), f('Nom', 'texte_court', { taille: 60, requis: true, indexe: 'sans_doublons' }), f('Description', 'texte_long')] },
      {
        nom: 'Produits',
        champs: [
          f('N°', 'numero_auto'), f('Référence', 'texte_court', { taille: 20, requis: true, indexe: 'sans_doublons' }), f('Désignation', 'texte_court', { requis: true }),
          f('Catégorie', 'entier_long', { indexe: 'avec_doublons' }), f('Prix unitaire', 'monetaire', { valide_si: '>=0', message_validation: 'Le prix ne peut pas être négatif.' }),
          f('Stock', 'entier_long', { valeur_defaut: '0' }), f('Seuil d’alerte', 'entier_long', { valeur_defaut: '5' }), f('Actif', 'oui_non', { valeur_defaut: 'Vrai' }),
        ],
      },
      {
        nom: 'Mouvements',
        champs: [
          f('N°', 'numero_auto'), f('Produit', 'entier_long', { requis: true, indexe: 'avec_doublons' }), f('Date', 'date_heure', { valeur_defaut: 'Date()' }),
          f('Sens', 'texte_court', { taille: 10, liste_valeurs: ['Entrée', 'Sortie'], limiter_a_liste: true }), f('Quantité', 'entier_long', { valide_si: '>0' }),
        ],
      },
    ],
    relations: [rel('Catégories', 'Produits', 'Catégorie'), rel('Produits', 'Mouvements', 'Produit', true)],
    rows: {
      Catégories: [{ Nom: 'Papeterie' }, { Nom: 'Informatique' }, { Nom: 'Mobilier' }],
      Produits: [
        { Référence: 'PAP-001', Désignation: 'Ramette A4 80 g', Catégorie: 1, 'Prix unitaire': 4.9, Stock: 120, 'Seuil d’alerte': 20, Actif: true },
        { Référence: 'INF-010', Désignation: 'Souris sans fil', Catégorie: 2, 'Prix unitaire': 19.9, Stock: 14, 'Seuil d’alerte': 5, Actif: true },
        { Référence: 'MOB-100', Désignation: 'Chaise de bureau', Catégorie: 3, 'Prix unitaire': 149, Stock: 3, 'Seuil d’alerte': 2, Actif: true },
      ],
      Mouvements: [
        { Produit: 1, Date: '2026-10-02', Sens: 'Entrée', Quantité: 100 },
        { Produit: 2, Date: '2026-10-15', Sens: 'Sortie', Quantité: 6 },
      ],
    },
  },
  {
    id: 'tasks', label: S.templates.tasks, description: S.templates.tasksDesc, main: 'Tâches',
    tables: [{
      nom: 'Tâches',
      champs: [
        f('N°', 'numero_auto'), f('Titre', 'texte_court', { requis: true }), f('Description', 'texte_long'),
        f('Priorité', 'texte_court', { taille: 10, liste_valeurs: ['Haute', 'Normale', 'Basse'], limiter_a_liste: true, valeur_defaut: '"Normale"' }),
        f('État', 'texte_court', { taille: 20, liste_valeurs: ['Non commencée', 'En cours', 'Terminée'], limiter_a_liste: true, valeur_defaut: '"Non commencée"' }),
        f('Début', 'date_heure'), f('Échéance', 'date_heure'), f('Avancement', 'reel_double', { valide_si: 'Entre 0 Et 1', format: 'Pourcentage' }),
        f('Assignée à', 'texte_court', { taille: 80 }),
      ],
      proprietes: { valide_si: '[Échéance] >= [Début]', message_validation: 'L’échéance doit suivre la date de début.' },
    }],
    relations: [],
    rows: {
      Tâches: [
        { Titre: 'Préparer le budget 2027', Priorité: 'Haute', État: 'En cours', Début: '2026-11-02', Échéance: '2026-11-20', Avancement: 0.4, 'Assignée à': 'Camille' },
        { Titre: 'Commander les fournitures', Priorité: 'Normale', État: 'Non commencée', Début: '2026-11-05', Échéance: '2026-11-12', Avancement: 0, 'Assignée à': 'Hugo' },
        { Titre: 'Mettre à jour le site', Priorité: 'Basse', État: 'Terminée', Début: '2026-10-01', Échéance: '2026-10-30', Avancement: 1, 'Assignée à': 'Léa' },
      ],
    },
  },
  {
    id: 'invoices', label: S.templates.invoices, description: S.templates.invoicesDesc, main: 'Factures',
    tables: [
      {
        nom: 'Clients',
        champs: [f('N°', 'numero_auto'), f('Nom', 'texte_court', { requis: true, indexe: 'avec_doublons' }), f('Adresse', 'texte_court'), f('Ville', 'texte_court', { taille: 80 }), f('Courriel', 'lien_hypertexte')],
      },
      {
        nom: 'Factures',
        champs: [
          f('N°', 'numero_auto'), f('Client', 'entier_long', { requis: true, indexe: 'avec_doublons' }), f('Date', 'date_heure', { valeur_defaut: 'Date()' }),
          f('Échéance', 'date_heure'), f('Payée', 'oui_non', { valeur_defaut: 'Faux' }),
        ],
      },
      {
        nom: 'Lignes de facture',
        champs: [
          f('N°', 'numero_auto'), f('Facture', 'entier_long', { requis: true, indexe: 'avec_doublons' }), f('Désignation', 'texte_court', { requis: true }),
          f('Quantité', 'reel_double', { valeur_defaut: '1', valide_si: '>0' }), f('Prix unitaire', 'monetaire'),
          f('Montant', 'calcule', { expression: '[Quantité]*[Prix unitaire]', type_resultat: 'monetaire' }),
        ],
      },
    ],
    relations: [rel('Clients', 'Factures', 'Client'), rel('Factures', 'Lignes de facture', 'Facture', true)],
    rows: {
      Clients: [{ Nom: 'Atelier Lumière', Ville: 'Lyon' }, { Nom: 'Bernard & Fils', Ville: 'Nantes' }],
      Factures: [{ Client: 1, Date: '2026-10-28', Échéance: '2026-11-27', Payée: false }, { Client: 2, Date: '2026-11-03', Échéance: '2026-12-03', Payée: true }],
      'Lignes de facture': [
        { Facture: 1, Désignation: 'Conseil (jour)', Quantité: 2, 'Prix unitaire': 650 },
        { Facture: 1, Désignation: 'Frais de déplacement', Quantité: 1, 'Prix unitaire': 84.5 },
        { Facture: 2, Désignation: 'Maintenance annuelle', Quantité: 1, 'Prix unitaire': 1200 },
      ],
    },
  },
];
