//! Modification de structure (mode Creation) : tables et champs.
//!
//! SQLite ne sait pas tout modifier en place : la table est alors reconstruite selon la
//! procedure officielle (cles etrangeres coupees, transaction, copie, renommage, index,
//! declencheurs, verification d'integrite), tout ou rien.

use rusqlite::OptionalExtension;
use serde::{Deserialize, Serialize};

use crate::base::Base;
use crate::ddl::{colonne_sql, creation_sql, index_sql, valider_champs};
use crate::erreur::{ErreurBase, Resultat};
use crate::ident::{guillemets, valider_nom};
use crate::meta::{self, ProprietesTable};
use crate::relations;
use crate::types::{ChampSchema, DefinitionChamp, TypeChamp};

const TABLE_TRAVAIL: &str = "__fo_reconstruction";

/// Definition d'une nouvelle table.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct DefinitionTable {
    /// Nom.
    pub nom: String,
    /// Champs dans l'ordre.
    pub champs: Vec<DefinitionChamp>,
    /// Proprietes de table.
    #[serde(default)]
    pub proprietes: ProprietesTable,
}

/// Compte rendu d'une modification de structure.
#[derive(Serialize, Clone, Debug, Default, PartialEq)]
pub struct RapportStructure {
    /// Avertissements (index perdu, requete devenue invalide...).
    pub avertissements: Vec<String>,
}

fn normaliser(champs: &[DefinitionChamp]) -> Vec<DefinitionChamp> {
    champs
        .iter()
        .map(|c| DefinitionChamp { nom: c.nom.trim().to_string(), ancien_nom: None, ..c.clone() })
        .collect()
}

fn definitions(actuels: &[ChampSchema]) -> Vec<DefinitionChamp> {
    actuels.iter().map(ChampSchema::definition).collect()
}

/// Ajoute un contexte « donnees existantes » aux erreurs de validation pendant une copie.
fn erreur_copie(e: ErreurBase) -> ErreurBase {
    match e {
        ErreurBase::Validation { champ, message } => ErreurBase::Validation {
            champ,
            message: format!("{message} Des enregistrements existants ne respectent pas la nouvelle définition."),
        },
        autre => autre,
    }
}

impl Base {
    /// Vrai si le nom est deja pris par une table, une vue ou une requete.
    pub(crate) fn nom_pris(&self, nom: &str) -> Resultat<bool> {
        Ok(self.objet_sql(nom)?.is_some() || meta::objet(self.conn(), "requete", nom)?.is_some())
    }

    /// Cree une table (mode Creation > Enregistrer).
    pub fn creer_table(&self, def: &DefinitionTable) -> Resultat<()> {
        self.exiger_ecriture()?;
        let nom = valider_nom(&def.nom)?;
        if self.nom_pris(&nom)? {
            return Err(ErreurBase::ExisteDeja(nom));
        }
        let champs = normaliser(&def.champs);
        let sql = creation_sql(&nom, &champs, &def.proprietes, &[])?;
        self.atomique(|| {
            self.conn().execute_batch(&sql)?;
            for s in index_sql(&nom, &champs, &[]) {
                self.conn().execute_batch(&s)?;
            }
            meta::ecrire_champs(self.conn(), &nom, &champs)?;
            meta::ecrire_table(self.conn(), &nom, &def.proprietes)
        })
    }

    /// Remplace toute la structure d'une table (champs et proprietes).
    /// `ancien_nom` sur un champ indique un renommage ; un champ absent est supprime.
    pub fn modifier_table(&self, table: &str, champs: &[DefinitionChamp], proprietes: Option<&ProprietesTable>) -> Resultat<RapportStructure> {
        self.reconstruire_table(table, Some(champs), proprietes, &|_| Ok(()))
    }

    /// Change les proprietes d'une table (reconstruction seulement si la regle de validation change).
    pub fn modifier_proprietes_table(&self, table: &str, proprietes: &ProprietesTable) -> Resultat<RapportStructure> {
        self.exiger_ecriture()?;
        let nom = self.nom_table(table)?;
        let actuelles = meta::table(self.conn(), &nom)?;
        if actuelles.valide_si == proprietes.valide_si && actuelles.message_validation == proprietes.message_validation {
            self.atomique(|| meta::ecrire_table(self.conn(), &nom, proprietes))?;
            return Ok(RapportStructure::default());
        }
        self.reconstruire_table(&nom, None, Some(proprietes), &|_| Ok(()))
    }

    /// Ajoute un champ (a la fin, ou a `position`).
    pub fn ajouter_champ(&self, table: &str, champ: &DefinitionChamp, position: Option<usize>) -> Resultat<RapportStructure> {
        self.exiger_ecriture()?;
        let nom = self.nom_table(table)?;
        let actuels = self.champs(&nom)?;
        let mut defs = definitions(&actuels);
        let mut nouveau = champ.clone();
        nouveau.nom = valider_nom(&nouveau.nom)?;
        nouveau.ancien_nom = None;
        let pos = position.unwrap_or(defs.len()).min(defs.len());
        defs.insert(pos, nouveau.clone());
        let rapide = pos == actuels.len()
            && !nouveau.cle_primaire
            && nouveau.type_champ != TypeChamp::NumeroAuto
            && !(nouveau.proprietes.requis && nouveau.proprietes.valeur_defaut.is_none());
        if rapide {
            let noms = valider_champs(&defs)?;
            let sql = format!("ALTER TABLE {} ADD COLUMN {}", guillemets(&nom), colonne_sql(&nouveau, &noms)?);
            let ajout = self.atomique(|| {
                self.conn().execute_batch(&sql)?;
                for s in index_sql(&nom, std::slice::from_ref(&nouveau), &[]) {
                    self.conn().execute_batch(&s)?;
                }
                meta::ecrire_champs(self.conn(), &nom, &normaliser(&defs))
            });
            match ajout {
                Ok(()) => return Ok(RapportStructure::default()),
                Err(ErreurBase::Validation { champ, message }) => return Err(ErreurBase::Validation { champ, message }),
                Err(_) => {}
            }
        }
        self.reconstruire_table(&nom, Some(&defs), None, &|_| Ok(()))
    }

    /// Modifie un champ (type, proprietes, nom).
    pub fn modifier_champ(&self, table: &str, nom_champ: &str, champ: &DefinitionChamp) -> Resultat<RapportStructure> {
        let nom = self.nom_table(table)?;
        let mut defs = definitions(&self.champs(&nom)?);
        let cible = defs
            .iter_mut()
            .find(|c| c.nom.eq_ignore_ascii_case(nom_champ))
            .ok_or_else(|| ErreurBase::Introuvable(format!("{nom}.{nom_champ}")))?;
        let ancien = cible.nom.clone();
        *cible = DefinitionChamp { ancien_nom: Some(ancien), ..champ.clone() };
        self.reconstruire_table(&nom, Some(&defs), None, &|_| Ok(()))
    }

    /// Renomme un champ (relations, vues et declencheurs suivent).
    pub fn renommer_champ(&self, table: &str, ancien: &str, nouveau: &str) -> Resultat<RapportStructure> {
        let nom = self.nom_table(table)?;
        let champ = self
            .champs(&nom)?
            .into_iter()
            .find(|c| c.nom.eq_ignore_ascii_case(ancien))
            .ok_or_else(|| ErreurBase::Introuvable(format!("{nom}.{ancien}")))?;
        let mut def = champ.definition();
        def.nom = valider_nom(nouveau)?;
        self.modifier_champ(&nom, ancien, &def)
    }

    /// Supprime un champ. Refuse s'il participe a une relation.
    pub fn supprimer_champ(&self, table: &str, nom_champ: &str) -> Resultat<RapportStructure> {
        let nom = self.nom_table(table)?;
        let liees: Vec<String> = self
            .relations_de(&nom)?
            .into_iter()
            .filter(|r| {
                (r.table_parent.eq_ignore_ascii_case(&nom) && r.champs_parent.iter().any(|c| c.eq_ignore_ascii_case(nom_champ)))
                    || (r.table_enfant.eq_ignore_ascii_case(&nom) && r.champs_enfant.iter().any(|c| c.eq_ignore_ascii_case(nom_champ)))
            })
            .map(|r| r.nom)
            .collect();
        if !liees.is_empty() {
            return Err(ErreurBase::msg(format!(
                "Le champ « {nom_champ} » participe aux relations : {}. Supprimez-les d'abord.",
                liees.join(", ")
            )));
        }
        let mut defs = definitions(&self.champs(&nom)?);
        let avant = defs.len();
        defs.retain(|c| !c.nom.eq_ignore_ascii_case(nom_champ));
        if defs.len() == avant {
            return Err(ErreurBase::Introuvable(format!("{nom}.{nom_champ}")));
        }
        if defs.is_empty() {
            return Err(ErreurBase::msg("Impossible de supprimer le dernier champ d'une table."));
        }
        self.reconstruire_table(&nom, Some(&defs), None, &|_| Ok(()))
    }

    /// Deplace un champ a une nouvelle position (ordre des colonnes).
    pub fn deplacer_champ(&self, table: &str, nom_champ: &str, position: usize) -> Resultat<RapportStructure> {
        let nom = self.nom_table(table)?;
        let mut defs = definitions(&self.champs(&nom)?);
        let i = defs
            .iter()
            .position(|c| c.nom.eq_ignore_ascii_case(nom_champ))
            .ok_or_else(|| ErreurBase::Introuvable(format!("{nom}.{nom_champ}")))?;
        let c = defs.remove(i);
        defs.insert(position.min(defs.len()), c);
        self.reconstruire_table(&nom, Some(&defs), None, &|_| Ok(()))
    }

    /// Definit la cle primaire (liste vide = aucune cle).
    pub fn definir_cle_primaire(&self, table: &str, champs: &[&str]) -> Resultat<RapportStructure> {
        let nom = self.nom_table(table)?;
        let mut defs = definitions(&self.champs(&nom)?);
        for c in champs {
            if !defs.iter().any(|d| d.nom.eq_ignore_ascii_case(c)) {
                return Err(ErreurBase::Introuvable(format!("{nom}.{c}")));
            }
        }
        for d in &mut defs {
            d.cle_primaire = champs.iter().any(|c| c.eq_ignore_ascii_case(&d.nom));
        }
        self.reconstruire_table(&nom, Some(&defs), None, &|_| Ok(()))
    }

    /// Renomme une table (cles etrangeres, vues, declencheurs, requetes et formulaires suivent).
    pub fn renommer_table(&self, ancien: &str, nouveau: &str) -> Resultat<()> {
        self.exiger_ecriture()?;
        let ancien = self.nom_table(ancien)?;
        let nouveau = valider_nom(nouveau)?;
        if !ancien.eq_ignore_ascii_case(&nouveau) && self.nom_pris(&nouveau)? {
            return Err(ErreurBase::ExisteDeja(nouveau));
        }
        self.atomique(|| {
            self.conn().execute_batch(&format!("ALTER TABLE {} RENAME TO {}", guillemets(&ancien), guillemets(&nouveau)))?;
            meta::renommer_table(self.conn(), &ancien, &nouveau)?;
            relations::renommer_table(self.conn(), &ancien, &nouveau)?;
            self.objets_apres_renommage(&ancien, &nouveau)
        })
    }

    /// Supprime une table. Avec `avec_relations`, ses relations sont d'abord supprimees ;
    /// sinon la suppression est refusee tant qu'elle participe a une relation.
    pub fn supprimer_table(&self, table: &str, avec_relations: bool) -> Resultat<()> {
        self.exiger_ecriture()?;
        let nom = self.nom_table(table)?;
        let liees = self.relations_de(&nom)?;
        if !liees.is_empty() && !avec_relations {
            let noms: Vec<String> = liees.into_iter().map(|r| r.nom).collect();
            return Err(ErreurBase::msg(format!(
                "La table « {nom} » participe aux relations : {}. Supprimez-les d'abord.",
                noms.join(", ")
            )));
        }
        for r in liees {
            if r.table_enfant.eq_ignore_ascii_case(&nom) {
                self.conn().execute("DELETE FROM __fo_relations WHERE nom = ?1", [&r.nom])?;
            } else {
                self.supprimer_relation(&r.nom)?;
            }
        }
        self.atomique(|| {
            self.conn().execute_batch(&format!("DROP TABLE {}", guillemets(&nom)))?;
            meta::supprimer_table(self.conn(), &nom)
        })
    }

    /// Copie une table (structure seule ou structure et donnees), comme Copier/Coller d'Access.
    pub fn copier_table(&self, source: &str, destination: &str, avec_donnees: bool) -> Resultat<()> {
        let source = self.nom_table(source)?;
        let champs = normaliser(&definitions(&self.champs(&source)?));
        let def = DefinitionTable { nom: destination.to_string(), champs: champs.clone(), proprietes: meta::table(self.conn(), &source)? };
        self.creer_table(&def)?;
        if avec_donnees {
            let cols: Vec<String> = champs
                .iter()
                .filter(|c| c.type_champ != TypeChamp::Calcule)
                .map(|c| guillemets(&c.nom))
                .collect();
            let liste = cols.join(", ");
            let dest = valider_nom(destination)?;
            self.conn().execute_batch(&format!(
                "INSERT INTO {} ({liste}) SELECT {liste} FROM {}",
                guillemets(&dest),
                guillemets(&source)
            ))?;
        }
        Ok(())
    }

    /// Supprime tous les enregistrements d'une table ; renvoie leur nombre.
    pub fn vider_table(&self, table: &str) -> Resultat<usize> {
        self.exiger_ecriture()?;
        let nom = self.nom_table(table)?;
        Ok(self.conn().execute(&format!("DELETE FROM {}", guillemets(&nom)), [])?)
    }

    /// Reconstruction complete d'une table (procedure SQLite en 12 etapes).
    ///
    /// `preparation` s'execute dans la transaction, avant le calcul des cles etrangeres
    /// (ajout ou retrait d'une relation).
    pub(crate) fn reconstruire_table(
        &self,
        table: &str,
        champs: Option<&[DefinitionChamp]>,
        proprietes: Option<&ProprietesTable>,
        preparation: &dyn Fn(&Base) -> Resultat<()>,
    ) -> Resultat<RapportStructure> {
        self.exiger_ecriture()?;
        if self.en_transaction() {
            return Err(ErreurBase::msg("Terminez d'abord la transaction en cours avant de modifier la structure."));
        }
        let table = self.nom_table(table)?;
        let actuels = self.champs(&table)?;
        let nouveaux = champs.map_or_else(|| definitions(&actuels), <[DefinitionChamp]>::to_vec);
        valider_champs(&nouveaux)?;
        let props = match proprietes {
            Some(p) => p.clone(),
            None => meta::table(self.conn(), &table)?,
        };
        self.conn().execute_batch("PRAGMA foreign_keys=OFF")?;
        let resultat = self.reconstruire_en_transaction(&table, &actuels, &nouveaux, &props, preparation);
        let retablir = self.conn().execute_batch("PRAGMA legacy_alter_table=OFF; PRAGMA foreign_keys=ON");
        let rapport = resultat?;
        retablir?;
        Ok(rapport)
    }

    fn reconstruire_en_transaction(
        &self,
        table: &str,
        actuels: &[ChampSchema],
        nouveaux: &[DefinitionChamp],
        props: &ProprietesTable,
        preparation: &dyn Fn(&Base) -> Resultat<()>,
    ) -> Resultat<RapportStructure> {
        self.conn().execute_batch("BEGIN IMMEDIATE")?;
        match self.etapes_reconstruction(table, actuels, nouveaux, props, preparation) {
            Ok(r) => {
                self.conn().execute_batch("COMMIT")?;
                Ok(r)
            }
            Err(e) => match self.conn().execute_batch("ROLLBACK") {
                Ok(()) => Err(e),
                Err(r) => Err(ErreurBase::msg(format!("{e} (annulation impossible : {r})"))),
            },
        }
    }

    fn etapes_reconstruction(
        &self,
        table: &str,
        actuels: &[ChampSchema],
        nouveaux: &[DefinitionChamp],
        props: &ProprietesTable,
        preparation: &dyn Fn(&Base) -> Resultat<()>,
    ) -> Resultat<RapportStructure> {
        let conn = self.conn();
        let mut rapport = RapportStructure::default();
        preparation(self)?;
        let q = guillemets(table);
        // 1. Origine de chaque champ (renommage explicite, sinon meme nom).
        let reclames: Vec<String> = nouveaux.iter().filter_map(|c| c.ancien_nom.as_ref()).map(|a| a.to_lowercase()).collect();
        let mut origines: Vec<Option<&ChampSchema>> = Vec::with_capacity(nouveaux.len());
        for c in nouveaux {
            let origine = match &c.ancien_nom {
                Some(a) => Some(actuels.iter().find(|o| o.nom.eq_ignore_ascii_case(a)).ok_or_else(|| ErreurBase::Introuvable(format!("{table}.{a}")))?),
                None => actuels.iter().find(|o| o.nom.eq_ignore_ascii_case(c.nom.trim()) && !reclames.contains(&o.nom.to_lowercase())),
            };
            origines.push(origine);
        }
        // 2. Renommages natifs (vues, declencheurs et cles etrangeres des autres tables suivent).
        let renommages: Vec<(String, String)> = nouveaux
            .iter()
            .zip(&origines)
            .filter_map(|(c, o)| o.filter(|o| !o.genere && o.nom != c.nom.trim()).map(|o| (o.nom.clone(), c.nom.trim().to_string())))
            .collect();
        for (k, (ancien, _)) in renommages.iter().enumerate() {
            conn.execute_batch(&format!("ALTER TABLE {q} RENAME COLUMN {} TO {}", guillemets(ancien), guillemets(&format!("__fo_renommage_{k}"))))?;
        }
        for (k, (ancien, nouveau)) in renommages.iter().enumerate() {
            conn.execute_batch(&format!("ALTER TABLE {q} RENAME COLUMN {} TO {}", guillemets(&format!("__fo_renommage_{k}")), guillemets(nouveau)))?;
            relations::renommer_champ(conn, table, ancien, nouveau)?;
        }
        // 3. Ce qu'il faut recreer apres coup.
        let mut stmt = conn.prepare(
            "SELECT type, name, sql FROM sqlite_master WHERE tbl_name = ?1 AND type IN ('index','trigger') AND sql IS NOT NULL
             AND name NOT LIKE 'fo\\_idx:%' ESCAPE '\\' AND name NOT LIKE 'fo\\_rel:%' ESCAPE '\\'",
        )?;
        let a_recreer = stmt
            .query_map([table], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?, r.get::<_, String>(2)?)))?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        let sequence: Option<i64> = if self.objet_sql("sqlite_sequence")?.is_some() {
            conn.query_row("SELECT seq FROM sqlite_sequence WHERE name = ?1", [table], |r| r.get(0)).optional()?
        } else {
            None
        };
        let liees = relations::relations_enfant(conn, table)?;
        // 4. Nouvelle table et copie des donnees.
        conn.execute_batch(&format!("DROP TABLE IF EXISTS {}", guillemets(TABLE_TRAVAIL)))?;
        conn.execute_batch(&creation_sql(TABLE_TRAVAIL, nouveaux, props, &liees)?)?;
        let (mut dst, mut src) = (Vec::new(), Vec::new());
        for (c, o) in nouveaux.iter().zip(&origines) {
            if let Some(o) = o.filter(|o| !o.genere && c.type_champ != TypeChamp::Calcule) {
                dst.push(guillemets(c.nom.trim()));
                // Apres les renommages natifs, la colonne d'origine porte deja son nouveau nom.
                let courant = if renommages.iter().any(|(a, _)| a == &o.nom) { c.nom.trim() } else { o.nom.as_str() };
                src.push(guillemets(courant));
            }
        }
        if !dst.is_empty() {
            conn.execute_batch(&format!(
                "INSERT INTO {} ({}) SELECT {} FROM {q}",
                guillemets(TABLE_TRAVAIL),
                dst.join(", "),
                src.join(", ")
            ))
            .map_err(|e| erreur_copie(e.into()))?;
        }
        // 5. Echange des tables sans reecrire les vues ni les declencheurs.
        conn.execute_batch("PRAGMA legacy_alter_table=ON")?;
        conn.execute_batch(&format!("DROP TABLE {q}"))?;
        conn.execute_batch(&format!("ALTER TABLE {} RENAME TO {q}", guillemets(TABLE_TRAVAIL)))?;
        conn.execute_batch("PRAGMA legacy_alter_table=OFF")?;
        // 6. Index, declencheurs, compteur NumeroAuto.
        for s in index_sql(table, nouveaux, &liees) {
            conn.execute_batch(&s).map_err(|e| erreur_copie(e.into()))?;
        }
        for (genre, nom, sql) in a_recreer {
            if let Err(e) = conn.execute_batch(&sql) {
                if genre == "trigger" {
                    return Err(ErreurBase::msg(format!("Le déclencheur « {nom} » ne peut pas être recréé : {}", ErreurBase::from(e))));
                }
                rapport.avertissements.push(format!("L'index « {nom} » a été supprimé : il utilisait un champ retiré."));
            }
        }
        if let Some(seq) = sequence.filter(|_| nouveaux.iter().any(|c| c.type_champ == TypeChamp::NumeroAuto)) {
            let n = conn.execute("UPDATE sqlite_sequence SET seq = max(seq, ?2) WHERE name = ?1", rusqlite::params![table, seq])?;
            if n == 0 {
                conn.execute("INSERT INTO sqlite_sequence(name, seq) VALUES (?1, ?2)", rusqlite::params![table, seq])?;
            }
        }
        // 7. Metadonnees.
        meta::ecrire_champs(conn, table, &normaliser(nouveaux))?;
        meta::ecrire_table(conn, table, props)?;
        // 8. Integrite referentielle (la table comme enfant, puis ses enfants).
        let mut a_verifier = vec![table.to_string()];
        a_verifier.extend(
            relations::toutes(conn)?
                .into_iter()
                .filter(|r| r.integrite && r.table_parent.eq_ignore_ascii_case(table))
                .map(|r| r.table_enfant),
        );
        for t in a_verifier {
            let mut stmt = conn.prepare("SELECT \"table\", parent FROM pragma_foreign_key_check(?1)")?;
            let orphelins = stmt
                .query_map([&t], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)))?
                .collect::<rusqlite::Result<Vec<_>>>()?;
            if let Some((enfant, parent)) = orphelins.first() {
                return Err(ErreurBase::Contrainte(format!(
                    "Intégrité référentielle impossible : {} enregistrement(s) de « {enfant} » n'ont pas de correspondant dans « {parent} ».",
                    orphelins.len()
                )));
            }
        }
        // 9. Vues devenues invalides : signalees, pas bloquantes (comme Access).
        let mut stmt = conn.prepare("SELECT name FROM sqlite_master WHERE type = 'view'")?;
        let vues = stmt.query_map([], |r| r.get::<_, String>(0))?.collect::<rusqlite::Result<Vec<_>>>()?;
        for v in vues {
            if let Err(e) = conn.prepare(&format!("SELECT * FROM {} LIMIT 0", guillemets(&v))) {
                rapport.avertissements.push(format!("La requête ou vue « {v} » ne fonctionne plus : {}", ErreurBase::from(e)));
            }
        }
        Ok(rapport)
    }
}
