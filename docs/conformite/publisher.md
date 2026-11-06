# Conformité : Publication

Commandes testées : **633** en 1089 s. Taux de commandes fonctionnelles : **100,0 %** (EXIGE_PLATEFORME, NON_TESTE et SANS_OBJET hors dénominateur).

| Classe | Nombre |
|---|---|
| EFFET_DOCUMENT | 313 |
| EFFET_UI | 295 |
| AUCUN_EFFET | 0 |
| ERREUR | 0 |
| DESACTIVEE | 11 |
| EXIGE_PLATEFORME | 5 |
| INACCESSIBLE | 0 |
| NON_TESTE | 0 |
| SANS_OBJET | 9 |

Défauts à corriger : **0** (ERREUR, AUCUN_EFFET, DESACTIVEE suspecte, INACCESSIBLE, valeur de format absente, bascule ou annulation défaillante).

## Boîtes de dialogue exercées (17)

| Commande | Boîte | Effet sur le document après validation |
|---|---|---|
| Styles > Styles | TitreTitreTitre 1Titre 1Titre 2Titre 2Corps de texteCorps de | oui |
| Objets > Tableau | RetourInsérer un tableauOK | oui |
| Modification > Rechercher | RetourRechercherRechercher | non |
| Modification > Remplacer | RetourRemplacerRemplacer tout | non |
| Pages > Page > Insérer des pages… | RetourInsérer des pagesOK | oui |
| Tableaux > Tableau | RetourInsérer un tableauOK | oui |
| Illustrations > Icônes | RetourInsérer des icônes | non |
| Texte > WordArt | ARemplissage uniAAccentuation avec ombreADégradéAContourALum | oui |
| Liens > Lien | RetourLienOK | oui |
| Mise en page > Marges > Repères de marge et de colonnes… | RetourRepères de dispositionOK | oui |
| Mise en page > Taille > Taille personnalisée… | RetourMise en pageOK | oui |
| Disposition > Repères > Repères de marge et de colonnes… | RetourRepères de dispositionOK | oui |
| Modèles > Couleurs | OfficeAquaBaiesBordeauxAgrumesArgileBleu nuitDésertFjordGlac | oui |
| Arrière-plan de la page > Arrière-plan > Plus d'arrière-plans… | RetourArrière-planOK | oui |
| Démarrer > Sélectionner des destinataires | RetourDestinataires du publipostageFermer | non |
| Alignement > Marges de la zone | RetourFormat de la zone de texteOK | oui |
| Texte > Colonnes > Plus… | RetourFormat de la zone de texteOK | oui |

## Exige la plateforme (5, non compté comme échec)

- Accueil > Presse-papiers > Coller : presse-papiers
- Accueil > Presse-papiers > Copier : presse-papiers
- Accueil > Objets > Images : selecteur-de-fichier
- Insertion > Illustrations > Images : selecteur-de-fichier
- Format d'image > Ajuster > Changer l'image : selecteur-de-fichier

