//! Lecture de la structure : objets de la base, champs, index, schema detaille, documentation.

use rusqlite::OptionalExtension;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value as Json};

use crate::base::Base;
use crate::erreur::{ErreurBase, Resultat};
use crate::ident::{est_interne, guillemets};
use crate::meta::{self, ProprietesTable};
use crate::relations::Relation;
use crate::types::{ChampSchema, ProprietesChamp, TypeChamp};

/// Genre d'objet du volet de navigation.
#[derive(Serialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum GenreObjet {
    /// Table.
    Table,
    /// Vue SQL creee hors du createur de requetes.
    Vue,
    /// Requete enregistree.
    Requete,
    /// Formulaire.
    Formulaire,
    /// Etat.
    Etat,
    /// Macro.
    Macro,
    /// Module (code ou notes).
    Module,
}

impl GenreObjet {
    /// Cle de stockage dans `__fo_objets`.
    pub fn cle(self) -> &'static str {
        match self {
            Self::Table => "table",
            Self::Vue => "vue",
            Self::Requete => "requete",
            Self::Formulaire => "formulaire",
            Self::Etat => "etat",
            Self::Macro => "macro",
            Self::Module => "module",
        }
    }
}

/// Entree du volet de navigation.
#[derive(Serialize, Clone, Debug, PartialEq)]
pub struct ObjetBase {
    /// Nom.
    pub nom: String,
    /// Genre.
    pub genre: GenreObjet,
    /// Description.
    pub description: Option<String>,
    /// Derniere modification connue.
    pub modifie_le: Option<String>,
}

/// Champ d'un index.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct ChampIndex {
    /// Nom du champ (vide pour une expression).
    pub nom: String,
    /// Ordre decroissant.
    #[serde(default)]
    pub decroissant: bool,
}

/// Index d'une table.
#[derive(Serialize, Clone, Debug, PartialEq)]
pub struct IndexInfo {
    /// Nom.
    pub nom: String,
    /// Champs.
    pub champs: Vec<ChampIndex>,
    /// Sans doublons.
    pub unique: bool,
    /// Origine : `cle_primaire`, `contrainte`, `champ` (propriete Indexe), `relation`, `nomme` (index multi-champs
    /// cree par `creer_index`, supprimable par `supprimer_index`), `index`.
    pub origine: &'static str,
    /// Index partiel (clause WHERE).
    pub partiel: bool,
}

/// Schema detaille d'une table ou d'une vue.
#[derive(Serialize, Clone, Debug)]
pub struct SchemaTable {
    /// Nom.
    pub nom: String,
    /// Vue (lecture seule).
    pub est_vue: bool,
    /// Proprietes de table.
    pub proprietes: ProprietesTable,
    /// Champs dans l'ordre.
    pub champs: Vec<ChampSchema>,
    /// Champs de la cle primaire.
    pub cle_primaire: Vec<String>,
    /// Index.
    pub index: Vec<IndexInfo>,
    /// Relations ou la table est parent ou enfant.
    pub relations: Vec<Relation>,
    /// Nombre d'enregistrements.
    pub nb_lignes: i64,
    /// Instruction SQL de creation.
    pub sql: Option<String>,
}

impl Base {
    /// Nom reel (casse d'origine) et genre (`table` ou `view`) d'un objet SQL.
    pub(crate) fn objet_sql(&self, nom: &str) -> Resultat<Option<(String, String)>> {
        Ok(self
            .conn()
            .query_row(
                "SELECT name, type FROM sqlite_master WHERE type IN ('table','view') AND name = ?1 COLLATE NOCASE",
                [nom.trim()],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .optional()?)
    }

    /// Nom reel d'une table utilisateur ; erreur si absente ou interne.
    pub(crate) fn nom_table(&self, nom: &str) -> Resultat<String> {
        match self.objet_sql(nom)? {
            Some((n, t)) if t == "table" && !est_interne(&n) => Ok(n),
            _ => Err(ErreurBase::Introuvable(nom.trim().to_string())),
        }
    }

    /// Nom reel d'une table ou d'une vue utilisateur.
    pub(crate) fn nom_source(&self, nom: &str) -> Resultat<(String, bool)> {
        match self.objet_sql(nom)? {
            Some((n, t)) if !est_interne(&n) => Ok((n, t == "view")),
            _ => Err(ErreurBase::Introuvable(nom.trim().to_string())),
        }
    }

    fn noms_sql(&self, genre: &str) -> Resultat<Vec<String>> {
        let mut stmt = self.conn().prepare(
            "SELECT name FROM sqlite_master WHERE type = ?1 ORDER BY name COLLATE NOCASE",
        )?;
        let noms = stmt
            .query_map([genre], |r| r.get::<_, String>(0))?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        Ok(noms.into_iter().filter(|n| !est_interne(n)).collect())
    }

    /// Tables utilisateur, triees par nom.
    pub fn lister_tables(&self) -> Resultat<Vec<String>> {
        self.noms_sql("table")
    }

    /// Vues SQL qui ne sont pas des requetes enregistrees.
    pub fn lister_vues(&self) -> Resultat<Vec<String>> {
        let requetes: Vec<String> = meta::objets(self.conn(), Some("requete"))?
            .into_iter()
            .map(|o| o.nom.to_lowercase())
            .collect();
        Ok(self
            .noms_sql("view")?
            .into_iter()
            .filter(|v| !requetes.contains(&v.to_lowercase()))
            .collect())
    }

    /// Tous les objets du volet de navigation (tables, vues, requetes, formulaires, etats, macros, modules).
    pub fn lister_objets(&self) -> Resultat<Vec<ObjetBase>> {
        let mut sortie = Vec::new();
        for nom in self.lister_tables()? {
            let p = meta::table(self.conn(), &nom)?;
            sortie.push(ObjetBase { nom, genre: GenreObjet::Table, description: p.description, modifie_le: None });
        }
        for nom in self.lister_vues()? {
            sortie.push(ObjetBase { nom, genre: GenreObjet::Vue, description: None, modifie_le: None });
        }
        for o in meta::objets(self.conn(), None)? {
            let genre = match o.genre.as_str() {
                "requete" => GenreObjet::Requete,
                "formulaire" => GenreObjet::Formulaire,
                "etat" => GenreObjet::Etat,
                "macro" => GenreObjet::Macro,
                "module" => GenreObjet::Module,
                _ => continue,
            };
            sortie.push(ObjetBase { nom: o.nom, genre, description: o.description, modifie_le: Some(o.modifie_le) });
        }
        Ok(sortie)
    }

    /// Champs d'une table ou d'une vue, avec types Access et proprietes.
    pub fn champs(&self, table: &str) -> Resultat<Vec<ChampSchema>> {
        let (nom, est_vue) = self.nom_source(table)?;
        let metas = meta::champs(self.conn(), &nom)?;
        let mut stmt = self.conn().prepare(
            "SELECT name, type, \"notnull\", dflt_value, pk, hidden FROM pragma_table_xinfo(?1) ORDER BY cid",
        )?;
        let brut = stmt
            .query_map([&nom], |r| {
                Ok((
                    r.get::<_, String>(0)?,
                    r.get::<_, Option<String>>(1)?.unwrap_or_default(),
                    r.get::<_, i64>(2)? != 0,
                    r.get::<_, Option<String>>(3)?,
                    r.get::<_, i64>(4)?,
                    r.get::<_, i64>(5)?,
                ))
            })?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        let nb_pk = brut.iter().filter(|c| c.4 > 0).count();
        let mut champs = Vec::with_capacity(brut.len());
        for (position, (nom_champ, decl, notnull, defaut, pk, cache)) in brut.into_iter().enumerate() {
            if cache == 1 {
                continue;
            }
            let genere = cache >= 2;
            let (type_champ, proprietes, deduit) = match metas.get(&nom_champ.to_lowercase()) {
                Some((t, p)) => (*t, p.clone(), false),
                None => {
                    let pk_entiere = nb_pk == 1 && pk > 0 && decl.eq_ignore_ascii_case("INTEGER") && !est_vue;
                    let (t, taille) = TypeChamp::depuis_declaration(&decl, pk_entiere);
                    let p = ProprietesChamp {
                        taille,
                        requis: notnull,
                        valeur_defaut: defaut,
                        ..Default::default()
                    };
                    (if genere { TypeChamp::Calcule } else { t }, p, true)
                }
            };
            champs.push(ChampSchema {
                nom: nom_champ,
                type_champ,
                libelle_type: type_champ.libelle(),
                position,
                cle_primaire: pk > 0,
                proprietes,
                type_sqlite: decl,
                genere,
                deduit,
            });
        }
        if champs.is_empty() {
            return Err(ErreurBase::Introuvable(nom));
        }
        Ok(champs)
    }

    /// Index d'une table.
    pub fn index_table(&self, table: &str) -> Resultat<Vec<IndexInfo>> {
        let nom = self.nom_table(table)?;
        let mut stmt = self
            .conn()
            .prepare("SELECT name, \"unique\", origin, partial FROM pragma_index_list(?1)")?;
        let liste = stmt
            .query_map([&nom], |r| {
                Ok((r.get::<_, String>(0)?, r.get::<_, i64>(1)? != 0, r.get::<_, String>(2)?, r.get::<_, i64>(3)? != 0))
            })?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        let mut sortie = Vec::new();
        for (nom_index, unique, origine, partiel) in liste {
            let mut stmt = self
                .conn()
                .prepare("SELECT name, \"desc\" FROM pragma_index_xinfo(?1) WHERE key = 1 ORDER BY seqno")?;
            let champs = stmt
                .query_map([&nom_index], |r| {
                    Ok(ChampIndex { nom: r.get::<_, Option<String>>(0)?.unwrap_or_default(), decroissant: r.get::<_, i64>(1)? != 0 })
                })?
                .collect::<rusqlite::Result<Vec<_>>>()?;
            let nomme = crate::index::nom_affiche(&nom_index, &nom);
            let origine = match origine.as_str() {
                "pk" => "cle_primaire",
                "u" => "contrainte",
                _ if nomme.is_some() => "nomme",
                _ if nom_index.starts_with("fo_idx:") => "champ",
                _ if nom_index.starts_with("fo_rel:") => "relation",
                _ => "index",
            };
            sortie.push(IndexInfo { nom: nomme.unwrap_or(nom_index), champs, unique, origine, partiel });
        }
        // Une cle primaire entiere (alias de rowid) n'a pas d'index visible : on la montre.
        let pk: Vec<String> = self.champs(&nom)?.into_iter().filter(|c| c.cle_primaire).map(|c| c.nom).collect();
        if !pk.is_empty() && !sortie.iter().any(|i| i.origine == "cle_primaire") {
            sortie.insert(0, IndexInfo {
                nom: "Clé primaire".into(),
                champs: pk.into_iter().map(|nom| ChampIndex { nom, decroissant: false }).collect(),
                unique: true,
                origine: "cle_primaire",
                partiel: false,
            });
        }
        Ok(sortie)
    }

    /// Nombre d'enregistrements d'une table ou d'une vue.
    pub fn compter_lignes(&self, table: &str) -> Resultat<i64> {
        let (nom, _) = self.nom_source(table)?;
        Ok(self.conn().query_row(&format!("SELECT count(*) FROM {}", guillemets(&nom)), [], |r| r.get(0))?)
    }

    /// Schema detaille (mode Creation, Documentation).
    pub fn schema_table(&self, table: &str) -> Resultat<SchemaTable> {
        let (nom, est_vue) = self.nom_source(table)?;
        let champs = self.champs(&nom)?;
        let sql: Option<String> = self
            .conn()
            .query_row("SELECT sql FROM sqlite_master WHERE name = ?1", [&nom], |r| r.get(0))
            .optional()?
            .flatten();
        Ok(SchemaTable {
            proprietes: meta::table(self.conn(), &nom)?,
            cle_primaire: champs.iter().filter(|c| c.cle_primaire).map(|c| c.nom.clone()).collect(),
            index: if est_vue { Vec::new() } else { self.index_table(&nom)? },
            relations: if est_vue { Vec::new() } else { self.relations_de(&nom)? },
            nb_lignes: self.compter_lignes(&nom)?,
            champs,
            sql,
            est_vue,
            nom,
        })
    }

    /// Documentation complete de la base (equivalent du Documentateur d'Access).
    pub fn documenter(&self) -> Resultat<Json> {
        let mut tables = Vec::new();
        for t in self.lister_tables()? {
            tables.push(serde_json::to_value(self.schema_table(&t)?)?);
        }
        let mut vues = Vec::new();
        for v in self.lister_vues()? {
            vues.push(serde_json::to_value(self.schema_table(&v)?)?);
        }
        Ok(json!({
            "infos": self.infos()?,
            "tables": tables,
            "vues": vues,
            "relations": self.lister_relations()?,
            "objets": meta::objets(self.conn(), None)?,
        }))
    }
}
