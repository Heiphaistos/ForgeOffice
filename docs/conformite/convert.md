# Conformité : Convertisseur

Commandes testées : **35** en 61 s. Taux de commandes fonctionnelles : **100,0 %** (EXIGE_PLATEFORME, NON_TESTE et SANS_OBJET hors dénominateur).

| Classe | Nombre |
|---|---|
| EFFET_DOCUMENT | 13 |
| EFFET_UI | 11 |
| AUCUN_EFFET | 0 |
| ERREUR | 0 |
| DESACTIVEE | 6 |
| EXIGE_PLATEFORME | 3 |
| INACCESSIBLE | 0 |
| NON_TESTE | 0 |
| SANS_OBJET | 2 |

Défauts à corriger : **0** (ERREUR, AUCUN_EFFET, DESACTIVEE suspecte, INACCESSIBLE, valeur de format absente, bascule ou annulation défaillante).

## Boîtes de dialogue exercées (3)

| Commande | Boîte | Effet sur le document après validation |
|---|---|---|
| Assembler > Fusionner les PDF | RetourFusionner les PDFAppliquer | oui |
| Transformer > Filigrane | RetourFiligraneAppliquer | oui |
| Transformer > Numéroter (Bates) | RetourNuméroter (Bates)Appliquer | oui |

## Exige la plateforme (3, non compté comme échec)

- Accueil > Fichiers > Ajouter des fichiers : selecteur-de-fichier
- Accueil > Fichiers > Ajouter un dossier : selecteur-de-fichier
- Accueil > Résultats > Tout enregistrer (.zip) : telechargement

