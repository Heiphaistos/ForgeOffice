# Conformité : PDF

Commandes testées : **93** en 202 s. Taux de commandes fonctionnelles : **100,0 %** (EXIGE_PLATEFORME, NON_TESTE et SANS_OBJET hors dénominateur).

| Classe | Nombre |
|---|---|
| EFFET_DOCUMENT | 15 |
| EFFET_UI | 65 |
| AUCUN_EFFET | 0 |
| ERREUR | 0 |
| DESACTIVEE | 6 |
| EXIGE_PLATEFORME | 3 |
| INACCESSIBLE | 0 |
| NON_TESTE | 0 |
| SANS_OBJET | 4 |

Défauts à corriger : **0** (ERREUR, AUCUN_EFFET, DESACTIVEE suspecte, INACCESSIBLE, valeur de format absente, bascule ou annulation défaillante).

## Boîtes de dialogue exercées (15)

| Commande | Boîte | Effet sur le document après validation |
|---|---|---|
| Navigation > Aller à la page | RetourAller à la pageAller | non |
| Tampons > Signer | RetourSignature visuelle | non |
| En-tête et filigrane > Filigrane | RetourFiligraneAppliquer | non |
| En-tête et filigrane > Numérotation (Bates) | RetourNumérotation (Bates)Appliquer | non |
| En-tête et filigrane > En-tête et pied de page | RetourEn-tête et pied de page | oui |
| Propriétés > Propriétés du document | RetourPropriétés du documentAppliquer | non |
| Pages > Extraire | RetourExtraireAppliquer | non |
| Assembler > Fusionner | RetourCombiner des fichiers | non |
| Assembler > Découper | RetourDécouperAppliquer | non |
| Caviardage > Caviarder par recherche | RetourCaviarder par recherche | non |
| Caviardage > Supprimer les informations masquées | RetourSupprimer les informations masquéesSupprimer | oui |
| Mot de passe > Protéger par mot de passe | RetourProtéger par mot de passe | oui |
| Signature > Signature visuelle | RetourSignature visuelle | non |
| Signature > Signature numérique | RetourSigner numériquement | non |
| Optimiser > Compresser | RetourCompresserAppliquer | oui |

## Exige la plateforme (3, non compté comme échec)

- Organiser > Pages > Insérer un fichier : selecteur-de-fichier
- Outils > Analyser > Comparer : selecteur-de-fichier
- Outils > Exporter > Texte (.txt) : telechargement

