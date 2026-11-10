// Textes de la coquille web (francais).

export const S = {
  loading: 'Chargement',
  soon: {
    title: 'Bientôt disponible',
    body: (name: string) => `${name} est en cours de construction. Il arrivera dans une prochaine version de ForgeOffice.`,
    back: "Retour à l'accueil",
  },
  error: {
    title: 'Un problème est survenu',
    body: "ForgeOffice a rencontré une erreur inattendue. Vos documents ouverts n'ont pas été modifiés par cette erreur.",
    details: 'Détails techniques',
    reload: 'Recharger',
    home: "Retour à l'accueil",
    loadFailed: (name: string) => `Impossible de charger ${name}.`,
    services: 'Impossible de démarrer les services de la plateforme.',
  },
  leave: {
    title: 'Modifications non enregistrées',
    body: "Ce document contient des modifications qui n'ont pas été enregistrées. Revenir à l'accueil quand même ?",
    stay: 'Rester',
    leave: 'Fermer sans enregistrer',
  },
  tabs: {
    closeModified: (name: string) => `« ${name} » contient des modifications non enregistrées. Fermer l'onglet quand même ?`,
    closeAnyway: 'Fermer sans enregistrer',
  },
  demo: {
    title: 'Démonstration du ruban',
  },
} as const;
