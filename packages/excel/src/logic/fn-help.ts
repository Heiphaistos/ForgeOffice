// Arguments et descriptions en francais des fonctions courantes (info-bulles, Inserer une fonction).
// Format : NOM|arg1;arg2;[arg facultatif];...|description. Les autres fonctions recoivent des arguments generiques.

const TABLE = `
SOMME|nombre1;[nombre2];...|Additionne tous les nombres d'une plage de cellules.
MOYENNE|nombre1;[nombre2];...|Renvoie la moyenne (arithmétique) des arguments.
NB|valeur1;[valeur2];...|Compte le nombre de cellules d'une plage qui contiennent des nombres.
NBVAL|valeur1;[valeur2];...|Compte le nombre de cellules qui ne sont pas vides.
NB.VIDE|plage|Compte le nombre de cellules vides dans une plage.
MAX|nombre1;[nombre2];...|Renvoie la plus grande valeur d'un ensemble de valeurs.
MIN|nombre1;[nombre2];...|Renvoie la plus petite valeur d'un ensemble de valeurs.
SI|test_logique;[valeur_si_vrai];[valeur_si_faux]|Vérifie si une condition est respectée et renvoie une valeur si VRAI et une autre si FAUX.
SI.CONDITIONS|test_logique1;valeur_si_vrai1;...|Vérifie plusieurs conditions et renvoie la valeur de la première condition VRAI.
SIERREUR|valeur;valeur_si_erreur|Renvoie valeur_si_erreur si l'expression est une erreur, sinon la valeur de l'expression.
SI.NON.DISP|valeur;valeur_si_na|Renvoie la valeur spécifiée si l'expression renvoie #N/A.
ET|valeur_logique1;[valeur_logique2];...|Renvoie VRAI si tous les arguments sont VRAI.
OU|valeur_logique1;[valeur_logique2];...|Renvoie VRAI si au moins un argument est VRAI.
NON|valeur_logique|Inverse la valeur logique de l'argument.
OUX|valeur_logique1;[valeur_logique2];...|Renvoie le OU exclusif logique de tous les arguments.
RECHERCHEV|valeur_cherchée;table_matrice;no_index_col;[valeur_proche]|Cherche une valeur dans la première colonne d'une table et renvoie une valeur de la même ligne.
RECHERCHEH|valeur_cherchée;tableau;no_index_lig;[valeur_proche]|Cherche une valeur dans la première ligne d'un tableau et renvoie une valeur de la même colonne.
RECHERCHEX|valeur_cherchée;tableau_recherche;tableau_renvoyé;[si_non_trouvé];[mode_correspondance];[mode_recherche]|Recherche une correspondance dans une plage et renvoie l'élément correspondant d'une seconde plage.
EQUIVX|valeur_cherchée;tableau_recherche;[mode_correspondance];[mode_recherche]|Renvoie la position relative d'un élément dans un tableau.
INDEX|matrice;no_lig;[no_col];[no_zone]|Renvoie une valeur ou la référence de la cellule à l'intersection d'une ligne et d'une colonne.
EQUIV|valeur_cherchée;tableau_recherche;[type]|Renvoie la position relative d'un élément dans une matrice.
RECHERCHE|valeur_cherchée;vecteur_recherche;[vecteur_résultat]|Recherche une valeur dans une plage d'une ligne ou d'une colonne.
CHOISIR|no_index;valeur1;[valeur2];...|Choisit une valeur dans une liste à partir d'un numéro d'index.
DECALER|réf;lignes;colonnes;[hauteur];[largeur]|Renvoie une référence décalée d'un nombre de lignes et de colonnes.
INDIRECT|réf_texte;[a1]|Renvoie la référence indiquée par une chaîne de texte.
SOMME.SI|plage;critère;[somme_plage]|Additionne les cellules qui respectent un critère.
SOMME.SI.ENS|somme_plage;plage_critères1;critère1;...|Additionne les cellules qui respectent plusieurs critères.
NB.SI|plage;critère|Compte le nombre de cellules qui respectent un critère.
NB.SI.ENS|plage_critères1;critère1;...|Compte le nombre de cellules qui respectent plusieurs critères.
MOYENNE.SI|plage;critère;[plage_moyenne]|Renvoie la moyenne des cellules qui respectent un critère.
MOYENNE.SI.ENS|plage_moyenne;plage_critères1;critère1;...|Renvoie la moyenne des cellules qui respectent plusieurs critères.
MAX.SI.ENS|plage_max;plage_critères1;critère1;...|Renvoie la valeur maximale parmi les cellules qui respectent des critères.
MIN.SI.ENS|plage_min;plage_critères1;critère1;...|Renvoie la valeur minimale parmi les cellules qui respectent des critères.
SOMMEPROD|matrice1;[matrice2];...|Multiplie les éléments correspondants des matrices et renvoie la somme des produits.
ARRONDI|nombre;no_chiffres|Arrondit un nombre au nombre de chiffres indiqué.
ARRONDI.SUP|nombre;no_chiffres|Arrondit un nombre en s'éloignant de zéro.
ARRONDI.INF|nombre;no_chiffres|Arrondit un nombre en tendant vers zéro.
ENT|nombre|Arrondit un nombre à l'entier immédiatement inférieur.
TRONQUE|nombre;[no_chiffres]|Tronque un nombre en supprimant sa partie décimale.
ABS|nombre|Renvoie la valeur absolue d'un nombre.
MOD|nombre;diviseur|Renvoie le reste d'une division.
PUISSANCE|nombre;puissance|Renvoie le résultat d'un nombre élevé à une puissance.
RACINE|nombre|Renvoie la racine carrée d'un nombre.
PRODUIT|nombre1;[nombre2];...|Multiplie tous les nombres donnés comme arguments.
ALEA|| Renvoie un nombre aléatoire compris entre 0 et 1.
ALEA.ENTRE.BORNES|min;max|Renvoie un nombre entier aléatoire entre les bornes indiquées.
PI||Renvoie la valeur de pi (3,14159265358979).
SOUS.TOTAL|no_fonction;réf1;[réf2];...|Renvoie un sous-total dans une liste ou une base de données.
AGREGAT|no_fonction;options;réf1;...|Renvoie un agrégat dans une liste ou une base de données.
MEDIANE|nombre1;[nombre2];...|Renvoie la valeur médiane des nombres.
MODE|nombre1;[nombre2];...|Renvoie la valeur la plus fréquente.
ECARTYPE|nombre1;[nombre2];...|Évalue l'écart type d'un échantillon.
VAR|nombre1;[nombre2];...|Calcule la variance d'un échantillon.
GRANDE.VALEUR|matrice;k|Renvoie la k-ième plus grande valeur d'une série.
PETITE.VALEUR|matrice;k|Renvoie la k-ième plus petite valeur d'une série.
RANG|nombre;référence;[ordre]|Renvoie le rang d'un nombre dans une liste.
CONCAT|texte1;[texte2];...|Assemble plusieurs chaînes de texte.
CONCATENER|texte1;[texte2];...|Assemble plusieurs chaînes de texte en une seule.
JOINDRE.TEXTE|délimiteur;ignorer_vide;texte1;...|Assemble des textes avec un délimiteur.
GAUCHE|texte;[no_car]|Renvoie les premiers caractères d'une chaîne.
DROITE|texte;[no_car]|Renvoie les derniers caractères d'une chaîne.
STXT|texte;no_départ;no_car|Renvoie un nombre donné de caractères à partir d'une position.
NBCAR|texte|Renvoie le nombre de caractères d'une chaîne.
TROUVE|texte_cherché;texte;[no_départ]|Trouve une chaîne dans une autre (respecte la casse).
CHERCHE|texte_cherché;texte;[no_départ]|Trouve une chaîne dans une autre (sans respecter la casse).
SUBSTITUE|texte;ancien_texte;nouveau_texte;[no_position]|Remplace des caractères dans une chaîne.
REMPLACER|ancien_texte;no_départ;no_car;nouveau_texte|Remplace une partie d'une chaîne par une autre.
MAJUSCULE|texte|Convertit un texte en majuscules.
MINUSCULE|texte|Convertit un texte en minuscules.
NOMPROPRE|texte|Met en majuscule la première lettre de chaque mot.
SUPPRESPACE|texte|Supprime les espaces superflus d'un texte.
TEXTE|valeur;format_texte|Convertit une valeur en texte selon un format de nombre.
CNUM|texte|Convertit en nombre un texte représentant un nombre.
REPT|texte;no_fois|Répète un texte un nombre de fois donné.
TEXTE.AVANT|texte;délimiteur;[no_instance];[mode];[fin];[si_non_trouvé]|Renvoie le texte situé avant un délimiteur.
TEXTE.APRES|texte;délimiteur;[no_instance];[mode];[fin];[si_non_trouvé]|Renvoie le texte situé après un délimiteur.
FRACTIONNER.TEXTE|texte;délimiteur_col;[délimiteur_lig];[ignorer_vide];[mode];[remplir_avec]|Fractionne un texte en lignes ou colonnes.
AUJOURDHUI||Renvoie la date du jour.
MAINTENANT||Renvoie la date et l'heure actuelles.
DATE|année;mois;jour|Renvoie le numéro de série d'une date.
ANNEE|numéro_de_série|Renvoie l'année d'une date.
MOIS|numéro_de_série|Renvoie le mois d'une date (1 à 12).
JOUR|numéro_de_série|Renvoie le jour du mois (1 à 31).
JOURSEM|numéro_de_série;[type_retour]|Renvoie le jour de la semaine d'une date.
NO.SEMAINE.ISO|date|Renvoie le numéro de semaine ISO d'une date.
FIN.MOIS|date_départ;mois|Renvoie le dernier jour du mois, n mois avant ou après une date.
MOIS.DECALER|date_départ;mois|Renvoie la date située n mois avant ou après une date.
DATEDIF|date_début;date_fin;unité|Calcule l'écart entre deux dates en jours, mois ou années.
NB.JOURS.OUVRES|date_début;date_fin;[jours_fériés]|Renvoie le nombre de jours ouvrés entre deux dates.
SERIE.JOUR.OUVRE|date_début;nb_jours;[jours_fériés]|Renvoie la date après un nombre de jours ouvrés.
HEURE|numéro_de_série|Renvoie l'heure (0 à 23).
MINUTE|numéro_de_série|Renvoie les minutes (0 à 59).
TEMPS|heure;minute;seconde|Renvoie le numéro de série d'une heure.
VPM|taux;npm;va;[vc];[type]|Calcule le remboursement d'un emprunt à taux et paiements constants.
VA|taux;npm;vpm;[vc];[type]|Renvoie la valeur actuelle d'un investissement.
VC|taux;npm;vpm;[va];[type]|Renvoie la valeur future d'un investissement.
TAUX|npm;vpm;va;[vc];[type];[estimation]|Renvoie le taux d'intérêt par période d'un investissement.
VAN|taux;valeur1;[valeur2];...|Renvoie la valeur actuelle nette d'un investissement.
TRI|valeurs;[estimation]|Renvoie le taux de rentabilité interne d'une série de flux.
ESTVIDE|valeur|Renvoie VRAI si la valeur est vide.
ESTNUM|valeur|Renvoie VRAI si la valeur est un nombre.
ESTTEXTE|valeur|Renvoie VRAI si la valeur est du texte.
ESTERREUR|valeur|Renvoie VRAI si la valeur est une erreur.
ESTNA|valeur|Renvoie VRAI si la valeur est #N/A.
FILTRE|tableau;inclure;[si_vide]|Filtre une plage de données selon des critères.
TRIER|tableau;[index_tri];[ordre_tri];[par_col]|Trie le contenu d'une plage ou d'un tableau.
TRIERPAR|tableau;par_tableau1;[ordre_tri1];...|Trie une plage selon les valeurs d'une autre plage.
UNIQUE|tableau;[par_col];[exactement_une_fois]|Renvoie les valeurs uniques d'une plage.
SEQUENCE|lignes;[colonnes];[début];[pas]|Génère une liste de nombres séquentiels.
LET|nom1;valeur_nom1;calcul_ou_nom2;...|Attribue des noms aux résultats de calculs.
LAMBDA|[paramètre1];...;calcul|Crée une fonction personnalisée réutilisable.
LIGNE|[référence]|Renvoie le numéro de ligne d'une référence.
COLONNE|[référence]|Renvoie le numéro de colonne d'une référence.
LIGNES|tableau|Renvoie le nombre de lignes d'une référence.
COLONNES|tableau|Renvoie le nombre de colonnes d'une référence.
ADRESSE|no_lig;no_col;[no_abs];[a1];[feuille_texte]|Crée une adresse de cellule sous forme de texte.
TRANSPOSE|tableau|Transpose une plage verticale en plage horizontale et inversement.
`;

export const FN_HELP: Readonly<Record<string, { args: readonly string[]; d: string }>> = Object.fromEntries(
  TABLE.trim().split('\n').map((line) => {
    const [name = '', args = '', d = ''] = line.split('|');
    return [name, { args: args.trim() ? args.split(';') : [], d: d.trim() }];
  }),
);
