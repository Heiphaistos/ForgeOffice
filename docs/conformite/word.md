# Conformité : Texte

Commandes testées : **454** en 778 s. Taux de commandes fonctionnelles : **100,0 %** (EXIGE_PLATEFORME, NON_TESTE et SANS_OBJET hors dénominateur).

| Classe | Nombre |
|---|---|
| EFFET_DOCUMENT | 300 |
| EFFET_UI | 138 |
| AUCUN_EFFET | 0 |
| ERREUR | 0 |
| DESACTIVEE | 6 |
| EXIGE_PLATEFORME | 7 |
| INACCESSIBLE | 0 |
| NON_TESTE | 2 |
| SANS_OBJET | 1 |

Défauts à corriger : **0** (ERREUR, AUCUN_EFFET, DESACTIVEE suspecte, INACCESSIBLE, valeur de format absente, bascule ou annulation défaillante).

## Boîtes de dialogue exercées (39)

| Commande | Boîte | Effet sur le document après validation |
|---|---|---|
| Presse-papiers > Coller > Collage spécial… | RetourCollage spécialOK | non |
| Police > Police | RetourPoliceOK | oui |
| Paragraphe > Trier | RetourTrier le texteOK | non |
| Paragraphe > Interligne et espacement de paragraphe > Options d'interligne… | RetourParagrapheOK | oui |
| Paragraphe > Bordures > Bordures de page… | RetourBordure de pageOK | oui |
| Paragraphe > Options d'interligne… | RetourParagrapheOK | oui |
| Styles > Galerie de styles | AaBbCcDdNormalAaBbCcDdSans interligneAaBbTitre 1AaBbTitre 2A | non |
| Styles > Galerie de styles > Créer un style | RetourCréer un styleOK | oui |
| Modification > Remplacer | RetourRechercher et remplacerSuivant | non |
| Modification > Sélectionner > Atteindre… | RetourAtteindreAtteindre | non |
| Tableaux > Tableau | Insérer un tableau…Insérer un tableau… | oui |
| Liens > Lien | RetourLien | oui |
| Liens > Signet | RetourSignet | oui |
| Liens > Renvoi | RetourRenvoiInsérer | oui |
| Texte > Date et heure | RetourDate et heureOK | oui |
| Texte > Champ | RetourChampOK | oui |
| Symboles > Équation | RetourÉquation | oui |
| Symboles > Symbole > Autres symboles… | RetourSymboleFermer | non |
| Stylets > Stylo noir | RetourDessiner | non |
| Stylets > Stylo rouge | RetourDessiner | non |
| Stylets > Stylo bleu | RetourDessiner | non |
| Stylets > Stylo vert | RetourDessiner | non |
| Stylets > Surligneur | RetourDessiner | non |
| Outils > Dessiner | RetourDessiner | non |
| Arrière-plan de la page > Filigrane > Filigrane personnalisé… | RetourFiligraneOK | oui |
| Arrière-plan de la page > Bordures de page | RetourBordure de pageOK | oui |
| Mise en page > Marges > Marges personnalisées… | RetourMise en pageOK | oui |
| Mise en page > Mise en page | RetourMise en pageOK | oui |
| Paragraphe > Paragraphe | RetourParagrapheOK | oui |
| Citations et bibliographie > Insérer une citation | RetourCitation | oui |
| Citations et bibliographie > Bibliographie | RetourCitation | oui |
| Légendes > Insérer une légende | RetourLégendeOK | oui |
| Légendes > Renvoi | RetourRenvoiInsérer | oui |
| Index > Marquer l'entrée | RetourIndexMarquer l'entrée | oui |
| Index > Insérer l'index | RetourIndexMarquer l'entrée | oui |
| Vérification > Grammaire et orthographe | RetourGrammaire et orthographeFermer | non |
| Vérification > Statistiques | RetourStatistiquesFermer | non |
| Données > Trier | RetourTrier le texteOK | oui |
| Styles d'image > Texte de remplacement | RetourTexte de remplacementOK | non |

## Exige la plateforme (7, non compté comme échec)

- Accueil > Presse-papiers > Coller : presse-papiers
- Accueil > Presse-papiers > Coller > Conserver la mise en forme source : presse-papiers
- Accueil > Presse-papiers > Coller > Conserver uniquement le texte : presse-papiers
- Accueil > Presse-papiers > Copier : presse-papiers
- Insertion > Illustrations > Images : selecteur-de-fichier
- Publipostage > Démarrer la fusion et le publipostage > Sélection des destinataires > Utiliser une liste existante (CSV)… : selecteur-de-fichier
- Révision > Comparer > Comparer : selecteur-de-fichier

