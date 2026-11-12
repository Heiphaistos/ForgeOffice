# Conformité : Publication

Commandes testées : **660** en 1245 s. Taux de commandes fonctionnelles : **99,7 %** (EXIGE_PLATEFORME, NON_TESTE et SANS_OBJET hors dénominateur).

| Classe | Nombre |
|---|---|
| EFFET_DOCUMENT | 314 |
| EFFET_UI | 310 |
| AUCUN_EFFET | 0 |
| ERREUR | 0 |
| DESACTIVEE | 18 |
| EXIGE_PLATEFORME | 8 |
| INACCESSIBLE | 2 |
| NON_TESTE | 0 |
| SANS_OBJET | 8 |

Défauts à corriger : **2** (ERREUR, AUCUN_EFFET, DESACTIVEE suspecte, INACCESSIBLE, valeur de format absente, bascule ou annulation défaillante).

## Onglet Insertion (2)

- **Blocs de construction > Ma bibliothèque > Aucun bloc enregistré** (`insert.blocks.library#none`, menu-item) : INACCESSIBLE
  - sans action et introuvable dans le DOM entree « none » absente du menu
  - Reproduire : Ouvrir « ?app=publisher » avec le document de test, préparer la sélection « forme », cliquer Insertion > Blocs de construction > Ma bibliothèque > Aucun bloc enregistré.
  - Capture : `captures/publisher/publisher-insert.blocks.library_none.jpg`
- **Blocs de construction > Ma bibliothèque > Supprimer de la bibliothèque** (`insert.blocks.library#remove`, menu-item) : INACCESSIBLE
  - controle introuvable dans le DOM malgre le contexte
  - Reproduire : Ouvrir « ?app=publisher » avec le document de test, préparer la sélection « forme », cliquer Insertion > Blocs de construction > Ma bibliothèque > Supprimer de la bibliothèque.
  - Capture : `captures/publisher/publisher-insert.blocks.library_remove.jpg`

## Boîtes de dialogue exercées (26)

| Commande | Boîte | Effet sur le document après validation |
|---|---|---|
| Police > Police… | RetourPoliceOK | non |
| Paragraphe > Paragraphe… | RetourParagrapheOK | non |
| Styles > Styles | TitreTitreTitre 1Titre 1Titre 2Titre 2Corps de texteCorps de | oui |
| Styles > Gérer les styles… > Créer un style à partir de la sélection… | RetourStyles de texteOK | non |
| Styles > Gérer les styles… > Gérer les styles… | RetourStyles de texteOK | non |
| Objets > Tableau | RetourInsérer un tableauOK | oui |
| Modification > Rechercher | RetourRechercherRechercher | non |
| Modification > Remplacer | RetourRemplacerRemplacer tout | non |
| Pages > Page > Insérer des pages… | RetourInsérer des pagesOK | oui |
| Tableaux > Tableau | RetourInsérer un tableauOK | oui |
| Illustrations > Icônes | RetourInsérer des icônes | non |
| Blocs de construction > Ma bibliothèque > Enregistrer la sélection dans la bibliothèque… | RetourEnregistrer dans la bibliothèqueOK | non |
| Texte > WordArt | ARemplissage uniAAccentuation avec ombreADégradéAContourALum | oui |
| Liens > Lien | RetourLienOK | oui |
| Mise en page > Marges > Repères de marge et de colonnes… | RetourRepères de dispositionOK | oui |
| Mise en page > Taille > Taille personnalisée… | RetourMise en pageOK | oui |
| Disposition > Repères > Repères de marge et de colonnes… | RetourRepères de dispositionOK | oui |
| Disposition > Tons directs… | RetourTons directsOK | non |
| Modèles > Couleurs | OfficeAquaBaiesBordeauxAgrumesArgileBleu nuitDésertFjordGlac | oui |
| Arrière-plan de la page > Arrière-plan > Plus d'arrière-plans… | RetourArrière-planOK | oui |
| Démarrer > Sélectionner des destinataires | RetourDestinataires du publipostageFermer | non |
| Alignement > Marges de la zone | RetourFormat de la zone de texteOK | oui |
| Texte > Colonnes > Plus… | RetourFormat de la zone de texteOK | oui |
| Taille > Format de l’objet… | RetourFormat de la zone de texteOK | non |
| Taille > Format de l’objet… | RetourFormat de l’imageOK | non |
| Taille > Format de l’objet… | RetourFormat de la formeOK | non |

## Exige la plateforme (8, non compté comme échec)

- Accueil > Presse-papiers > Coller : presse-papiers
- Accueil > Presse-papiers > Coller > Coller : presse-papiers
- Accueil > Presse-papiers > Coller > Coller en texte seul : presse-papiers
- Accueil > Presse-papiers > Copier : presse-papiers
- Accueil > Objets > Images : selecteur-de-fichier
- Insertion > Illustrations > Images : selecteur-de-fichier
- Insertion > Texte > Insérer un fichier texte… : selecteur-de-fichier
- Format d'image > Ajuster > Changer l'image : selecteur-de-fichier

