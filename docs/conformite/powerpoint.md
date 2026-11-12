# Conformité : Présentation

Commandes testées : **1582** en 2860 s. Taux de commandes fonctionnelles : **100,0 %** (EXIGE_PLATEFORME, NON_TESTE et SANS_OBJET hors dénominateur).

| Classe | Nombre |
|---|---|
| EFFET_DOCUMENT | 1032 |
| EFFET_UI | 531 |
| AUCUN_EFFET | 0 |
| ERREUR | 0 |
| DESACTIVEE | 1 |
| EXIGE_PLATEFORME | 9 |
| INACCESSIBLE | 0 |
| NON_TESTE | 0 |
| SANS_OBJET | 9 |

Défauts à corriger : **0** (ERREUR, AUCUN_EFFET, DESACTIVEE suspecte, INACCESSIBLE, valeur de format absente, bascule ou annulation défaillante).

## Boîtes de dialogue exercées (35)

| Commande | Boîte | Effet sur le document après validation |
|---|---|---|
| Police > Police | RetourPoliceOK | non |
| Paragraphe > Puces > Puces et numéros… | RetourPuces et numérosOK | oui |
| Paragraphe > Numérotation > Puces et numéros… | RetourPuces et numérosOK | oui |
| Paragraphe > Paragraphe | RetourParagrapheOK | non |
| Dessin > Styles rapides | AbcAbcAbcAbcAbcAbcAbcAbcAbcAbcAbcAbcAbcAbcAbcAbcAbcAbcAbcAbc | oui |
| Modification > Rechercher | RetourRechercherSuivant | non |
| Modification > Remplacer | RetourRemplacerSuivant | non |
| Tableaux > Tableau | Insérer un tableau Insérer un tableau… | non |
| Illustrations > Formes | LignesRectanglesFormes de baseFlèches pleinesFormes d’équati | non |
| Illustrations > Icônes | RetourIcônes | non |
| Illustrations > SmartArt | RetourSmartArtInsérer | oui |
| Liens > Lien | RetourInsérer un lien hypertexteOK | oui |
| Commentaires > Nouveau commentaire | RetourNouveau commentaire | oui |
| Texte > En-tête et pied de page | RetourEn-tête et pied de pageAppliquer partout | non |
| Texte > Numéro de diapositive | RetourEn-tête et pied de pageAppliquer partout | non |
| Texte > WordArt | AAAAAA | oui |
| Symboles > Équation | RetourÉquationInsérer | oui |
| Thèmes > Thèmes | Modifiez le style du titreModifiez le style du titreModifiez | non |
| Variantes > Styles d’arrière-plan | RetourMise en forme de l’arrière-planOK | oui |
| Personnaliser > Taille des diapositives > Taille des diapositives personnalisée… | RetourTaille des diapositivesOK | oui |
| Personnaliser > Mise en forme de l’arrière-plan | RetourMise en forme de l’arrière-planOK | oui |
| Transition vers cette diapositive > Transition vers cette diapositive | AucuneMorphoseFonduPousserBalayerFractionnerRévélerCouperBar | non |
| Animation > Animation | AucuneApparaîtreFonduEntrée brusquéeFlottant entrantFraction | non |
| Animation > Options d’effet > Plus d’options d’effet… | RetourOptions d’effetOK | non |
| Démarrage du diaporama > Diaporama personnalisé > Diaporamas personnalisés… | RetourDiaporamas personnalisésFermer | non |
| Configuration > Configurer le diaporama… | RetourParamètres du diaporamaOK | non |
| Commentaires > Nouveau commentaire | RetourNouveau commentaire | oui |
| Modifier le masque > Renommer | RetourRenommerRenommer | non |
| Mise en page du masque > Renommer l’espace réservé | RetourNom de l’espace réservéRenommer | non |
| Mise en page du masque > Mise en forme de l’arrière-plan | RetourMise en forme de l’arrière-planOK | non |
| Styles de formes > Styles rapides | AbcAbcAbcAbcAbcAbcAbcAbcAbcAbcAbcAbcAbcAbcAbcAbcAbcAbcAbcAbc | oui |
| Ajuster > Supprimer l’arrière-plan | RetourSupprimer l’arrière-planSupprimer | oui |
| Taille > Rogner | RetourRognerOK | oui |
| Taille > Rogner > Rogner (valeurs précises)… | RetourRognerOK | oui |
| Données > Modifier les données | RetourModifier les données du graphiqueOK | oui |

## Exige la plateforme (9, non compté comme échec)

- Accueil > Presse-papiers > Coller > Conserver la mise en forme source : presse-papiers
- Accueil > Presse-papiers > Coller > Image : presse-papiers
- Accueil > Presse-papiers > Coller > Conserver uniquement le texte : presse-papiers
- Accueil > Presse-papiers > Copier : presse-papiers
- Insertion > Images > Images : selecteur-de-fichier
- Insertion > Média > Vidéo : selecteur-de-fichier
- Insertion > Média > Audio : selecteur-de-fichier
- Transitions > Minutage > Son > Autre son… : selecteur-de-fichier
- Format de l’image > Ajuster > Modifier l’image : selecteur-de-fichier

