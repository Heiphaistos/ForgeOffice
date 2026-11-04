# forge-base : etat (2026-11-04)

Moteur SQLite du module Base de donnees (equivalent Access), Rust pur, sans Tauri.

## Verification

- `cargo test` (dans `crates/forge-base`) : 74 tests verts (25 unitaires + 49 integration :
  base_fichier 7, donnees 8, import_objets 6, relations 9, requetes 6, structure 13).
- `cargo clippy --all-targets` : aucun avertissement (`unwrap_used`/`expect_used` interdits hors tests).

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

## Reste a faire

- Branchement des commandes Tauri dans `apps/desktop` (hors perimetre de ce lot).
- Index multi-champs nommes (seuls les index par champ via la propriete « Indexe » existent).
