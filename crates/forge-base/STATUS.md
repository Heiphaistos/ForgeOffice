# forge-base : etat (2026-11-04)

Moteur SQLite du module Base de donnees (equivalent Access), Rust pur, sans Tauri.

## Verification

- `cargo test --offline` (dans `crates/forge-base`) : **101 tests verts** (29 unitaires + 72 integration : base_fichier 7, donnees 8, import_access 4, import_objets 6, index 6, objets_avances 9, relations 9, requetes 10, structure 13) ; 78 avant le lot du 2026-11-05.
- `cargo clippy --offline --all-targets` : aucun avertissement (`unwrap_used`/`expect_used` interdits hors tests).

## Fait

- Fichier `.fodb` = SQLite (WAL, foreign_keys, secure_delete, mode defensif), metadonnees `__fo_*`, ouverture lecture seule.
- Types Access (13) et proprietes de champ (taille, format, masque, defaut, valide si + message, requis, indexe, legende, listes, calcule).
- Structure : creer/modifier/renommer/supprimer/copier/vider tables, ajouter/modifier/renommer/deplacer/supprimer champs,
  cle primaire (reconstruction transactionnelle, vues et requetes corrigees au renommage).
- Relations : integrite referentielle, cascades, mettre a Null, verification d'integrite (orphelins).
- Donnees : lecture paginee, tri francais, filtres, recherche sans accents, expression Access, ecriture par cle/rowid, totaux, valeurs distinctes, remplacer tout.
- SQL parametre (positionnel/nomme), resultats JSON types (blob = `{type, taille, base64}`), EXPLAIN.
- Delai SQL : 30 s par defaut (`DELAI_SQL_DEFAUT`), regle par `Base::definir_delai_sql(Option<Duration>)` ou par execution (`executer_sql_options` + `OptionsSql { limite, delai }`) ; depassement = `ErreurBase::Delai(secondes)` (code `delai`), la transaction explicite qui ecrivait est annulee par SQLite. Exports : 10 min. Limites SQLite : SQL 10 Mo, valeur 256 Mo, 1000 colonnes, profondeur d'expression 200, 100 SELECT composes, LIKE 10 000.
- Requetes enregistrees (publiees en vue si Selection sans parametre), createur graphique : selection, jointures, criteres, parametres,
  totaux, analyse croisee, requetes action (ajout, mise a jour, suppression, creation de table).
- Formulaires/etats instantanes, objets JSON (formulaire, etat, macro, module), macros (actions de donnees tout-ou-rien, actions d'interface renvoyees).
- Import CSV (`;` `,` tabulation, decimale francaise, deduction des types, rapport d'erreurs), import de lignes de classeur, export CSV/JSON.
- Sauvegarde (VACUUM INTO), compactage, transactions explicites.
- Securite : identifiants cites, valeurs liees, ATTACH/DETACH, load_extension, PRAGMA d'ecriture et tables internes refuses au SQL utilisateur.

## Corrections de la reprise

- `donnees.rs` : la recherche generait `ESCAPE ''` (litteral Rust `'\'`), SQLite refusait ; corrige en `ESCAPE '\'`.
- `import.rs` : une cellule vide etait importee en `""` et contournait « Requis » ; elle est maintenant Null, comme Access.

## Lot du 2026-11-05

- **Index nommes multi-champs** (`index.rs`) : `creer_index(table, DefinitionIndex { nom, champs: [{nom, decroissant}], unique })` (1 a 10 champs, types texte long/OLE/piece jointe refuses, doublons existants refuses avec message), `supprimer_index`, `lister_index_nommes` ; ils apparaissent dans `index_table`/`schema_table`/`documenter` avec `origine: "nomme"` et leur nom d'affichage. Nom SQL `fo_ix:<table>:<nom>`. Reconstruction de table : un champ renomme est suivi, l'index est recree ; si un champ de l'index est retire, l'index est supprime avec avertissement (SQLite lirait sinon un nom de colonne absent comme une chaine constante : l'index est donc recree par notre propre SQL apres verification des champs). Un renommage de table garde l'index. Pas de annuler/retablir cote moteur (l'interface).
- **Sous-formulaires** (`sous_formulaire.rs`) : controle JSON `sous_formulaire` (`source`, `champs_maitre`/`champs_detail`, disposition, position, droits d'ajout et de suppression), `sous_formulaire(maitre, detail, liens, disposition)` (liens deduits de la relation si absents, champs verifies), `formulaire_avec_sous_formulaire`, `lire_sous_formulaire(sous, valeurs_maitre, options)` (lignes liees, une valeur maitre nulle ou absente ne lie rien, filtres de l'appelant ajoutes par ET), `valeurs_liees` (pre-remplissage d'une nouvelle ligne). `enregistrer_objet` refuse un controle incoherent ; le renommage d'une table suit dans `source`.
- **Etats multi-niveaux** (`etats.rs`) : `Regroupement { champ, tri, entete, pied }`, `etat_instantane_regroupe(source, &[Regroupement])` (`etat_instantane` inchange, meme JSON pour un niveau), cle `regroupements` de la definition (l'ancienne cle `regroupement` reste lue), `executer_etat(nom)` / `executer_etat_definition(json)` : lignes triees puis arbre de groupes (`niveau`, `champ`, `valeur`, `nb`, `totaux` par champ numerique, `groupes` ou `lignes`), regroupement sans casse, `expression` et `tri` de detail, plafond de 200 000 lignes (`tronque`).
- **Requetes editables** (`requete_editable.rs`) : `executer_requete_editable(nom, params)` renvoie le resultat plus `modifiable`, `raison` (jointure, totaux, SQL direct, source = requete, DISTINCT sans cle...), `table`, `correspondance` (colonne du resultat -> table/champ, `modifiable` par colonne : faux pour NumeroAuto et calcules) et `cles` (cle de chaque ligne ; une cle absente de la requete est ajoutee a l'execution puis retiree du resultat, `rowid` si la table n'a pas de cle). `modifier_ligne_requete(nom, cle, valeurs par nom de colonne)` ecrit par cle. Requetes du createur sur UNE table seulement.
- **Import Access en lecture** (`access_lecteur.rs` + `import_access.rs`, ~700 lignes, Rust pur) : `.mdb` Jet 4 (Access 2000-2003) et `.accdb` ACE. `lister_tables_access(chemin)` (apercu), `importer_access(chemin, OptionsImportAccess { tables })` : tables recreees avec types Access (texte, memo y compris sur plusieurs pages, octet, entier, entier long, NumeroAuto, monetaire, reel, date/heure, oui/non, GUID, grand entier) et donnees ; noms invalides corriges et collisions de noms resolues (`Produits (2)`), signales ; tout ou rien (les tables deja creees sont retirees en cas d'echec). Verifie sur DEUX VRAIS fichiers crees par Access (DAO/ACE par COM, `tests/fixtures/access2000.mdb` et `access2007.accdb`, 4 + 400 + 2 lignes, accents, memo de 9 100 caracteres) et sur 45 fichiers abimes (troncature, octets aleatoires) sans panique. Non pris en charge : Access 97 (Jet 3, refuse avec message), bases chiffrees ou a mot de passe (catalogue illisible), index/relations/requetes/formulaires/etats/macros du fichier source, colonnes binaire/OLE/decimal/piece jointe/multivalue (ignorees, signalees). Les fichiers de test ont ete fabriques avec `Access.Application`/`DAO.DBEngine.120` (script masque, sans UI).

## Reste a faire

- Branchement des commandes Tauri dans `apps/desktop` et de l'interface (index multi-champs, sous-formulaires, etats multi-niveaux, requetes editables, import Access) : hors perimetre de ce lot.
- Annuler/retablir : volontairement cote interface.
- Import Access : types decimal et pieces jointes, index et relations du fichier source, Access 97.
