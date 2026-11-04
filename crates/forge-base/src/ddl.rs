//! Generation du SQL de structure (CREATE TABLE, contraintes nommees, index de champ).
//!
//! Chaque regle Access devient une contrainte CHECK nommee `fo:<champ>:<message>` :
//! elle protege aussi le SQL direct et son message remonte tel quel a l'interface.

use crate::erreur::{ErreurBase, Resultat, PREFIXE_CONTRAINTE};
use crate::expr::{Contexte, Traducteur};
use crate::ident::{guillemets, litteral, valider_nom};
use crate::meta::ProprietesTable;
use crate::relations::{Relation, Suppression};
use crate::types::{DefinitionChamp, Indexation, TypeChamp};
use crate::valeurs::{analyser_booleen, analyser_date, analyser_nombre};

/// Prefixe des index crees par la propriete « Indexe ».
pub const PREFIXE_INDEX_CHAMP: &str = "fo_idx:";
/// Prefixe des index crees pour les champs lies d'une relation.
pub const PREFIXE_INDEX_RELATION: &str = "fo_rel:";

/// Verifie une liste de champs et renvoie les noms nettoyes.
pub fn valider_champs(champs: &[DefinitionChamp]) -> Resultat<Vec<String>> {
    if champs.is_empty() {
        return Err(ErreurBase::msg("Une table a besoin d'au moins un champ."));
    }
    if champs.len() > 255 {
        return Err(ErreurBase::msg("Une table ne peut pas dépasser 255 champs."));
    }
    let mut noms: Vec<String> = Vec::with_capacity(champs.len());
    for c in champs {
        let nom = valider_nom(&c.nom)?;
        if noms.iter().any(|n| n.eq_ignore_ascii_case(&nom)) {
            return Err(ErreurBase::ExisteDeja(nom));
        }
        if c.type_champ == TypeChamp::Calcule {
            if c.proprietes.expression.as_deref().is_none_or(|e| e.trim().is_empty()) {
                return Err(ErreurBase::msg(format!("Le champ calculé « {nom} » n'a pas d'expression.")));
            }
            if c.cle_primaire {
                return Err(ErreurBase::msg(format!("Le champ calculé « {nom} » ne peut pas être une clé primaire.")));
            }
        }
        if let Some(t) = c.proprietes.taille {
            if c.type_champ == TypeChamp::TexteCourt && !(1..=255).contains(&t) {
                return Err(ErreurBase::msg(format!("La taille du champ « {nom} » doit être comprise entre 1 et 255.")));
            }
        }
        noms.push(nom);
    }
    let autos = champs.iter().filter(|c| c.type_champ == TypeChamp::NumeroAuto).count();
    let cles = champs.iter().filter(|c| c.cle_primaire).count();
    if autos > 1 {
        return Err(ErreurBase::msg("Une table ne peut avoir qu'un seul champ NuméroAuto."));
    }
    if autos == 1 && (cles != 1 || champs.iter().any(|c| c.type_champ == TypeChamp::NumeroAuto && !c.cle_primaire)) {
        return Err(ErreurBase::msg("Le champ NuméroAuto doit être l'unique clé primaire de la table."));
    }
    Ok(noms)
}

/// Traduit une valeur par defaut Access en clause SQL (sans le mot DEFAULT).
pub fn defaut_sql(expr: &str, t: TypeChamp) -> Resultat<Option<String>> {
    let e = expr.trim();
    if e.is_empty() {
        return Ok(None);
    }
    let bas = e.to_lowercase().replace(' ', "");
    let speciale = match bas.as_str() {
        "date()" => Some("(date('now','localtime'))"),
        "maintenant()" | "now()" => Some("(datetime('now','localtime'))"),
        "temps()" | "time()" => Some("(time('now','localtime'))"),
        _ => None,
    };
    if let Some(s) = speciale {
        return Ok(Some(s.into()));
    }
    if t.est_numerique() {
        if let Some(n) = analyser_nombre(e, None) {
            return Ok(Some(n.to_string()));
        }
    }
    if t == TypeChamp::OuiNon {
        if let Some(b) = analyser_booleen(e) {
            return Ok(Some(i64::from(b).to_string()));
        }
    }
    if t == TypeChamp::DateHeure {
        if let Some(d) = analyser_date(e.trim_matches('#')) {
            return Ok(Some(litteral(&d)));
        }
    }
    let guillemets_ext = (e.starts_with('"') && e.ends_with('"')) || (e.starts_with('\'') && e.ends_with('\''));
    if t.est_texte() && !guillemets_ext {
        return Ok(Some(litteral(e)));
    }
    let mut tr = Traducteur::nouveau(Contexte::Schema, Some(&[]));
    Ok(Some(format!("({})", tr.expression(e)?)))
}

fn contrainte(champ: &str, message: &str, condition: &str) -> String {
    format!(
        " CONSTRAINT {} CHECK ({condition})",
        guillemets(&format!("{PREFIXE_CONTRAINTE}{champ}:{message}"))
    )
}

/// Definition SQL d'une colonne (type, cle NuméroAuto, NOT NULL, DEFAULT, contraintes nommees).
pub fn colonne_sql(c: &DefinitionChamp, tous: &[String]) -> Resultat<String> {
    let nom = c.nom.trim();
    let q = guillemets(nom);
    let p = &c.proprietes;
    let t = c.type_champ;
    let mut sql = format!("{q} {}", t.declaration(p));
    if t == TypeChamp::NumeroAuto {
        sql.push_str(" PRIMARY KEY AUTOINCREMENT");
        return Ok(sql);
    }
    if t == TypeChamp::Calcule {
        let mut tr = Traducteur::nouveau(Contexte::Schema, Some(tous));
        let expr = tr.expression(p.expression.as_deref().unwrap_or_default())?;
        sql.push_str(&format!(" GENERATED ALWAYS AS ({expr}) VIRTUAL"));
        return Ok(sql);
    }
    if p.requis || c.cle_primaire {
        sql.push_str(" NOT NULL");
    }
    if let Some(d) = p.valeur_defaut.as_deref().map(|d| defaut_sql(d, t)).transpose()?.flatten() {
        sql.push_str(&format!(" DEFAULT {d}"));
    }
    if t == TypeChamp::TexteCourt {
        let taille = p.taille_texte();
        sql.push_str(&contrainte(nom, &format!("texte trop long ({taille} caractères maximum)."), &format!("length({q}) <= {taille}")));
    }
    if let Some((min, max)) = t.plage_entiere() {
        sql.push_str(&contrainte(nom, &format!("nombre entier entre {min} et {max} attendu."), &format!("typeof({q}) IN ('integer','null') AND {q} BETWEEN {min} AND {max}")));
    } else if t.est_entier() {
        sql.push_str(&contrainte(nom, "nombre entier attendu.", &format!("typeof({q}) IN ('integer','null')")));
    } else if t.est_numerique() {
        sql.push_str(&contrainte(nom, "nombre attendu.", &format!("typeof({q}) IN ('integer','real','null')")));
    }
    match t {
        TypeChamp::DateHeure => sql.push_str(&contrainte(nom, "date invalide.", &format!("{q} IS NULL OR datetime({q}) IS NOT NULL"))),
        TypeChamp::OuiNon => sql.push_str(&contrainte(nom, "valeur Oui/Non attendue.", &format!("{q} IN (0, 1)"))),
        TypeChamp::LienHypertexte => sql.push_str(&contrainte(
            nom,
            "lien refusé (javascript:, vbscript:, data:, file:).",
            &format!("lower(trim({q})) NOT LIKE 'javascript:%' AND lower(trim({q})) NOT LIKE 'vbscript:%' AND lower(trim({q})) NOT LIKE 'data:%' AND lower(trim({q})) NOT LIKE 'file:%'"),
        )),
        _ => {}
    }
    if t.est_texte() && p.chaine_vide_autorisee == Some(false) {
        sql.push_str(&contrainte(nom, "chaîne vide interdite.", &format!("{q} <> ''")));
    }
    if p.limiter_a_liste && !p.liste_valeurs.is_empty() {
        let valeurs: Vec<String> = p.liste_valeurs.iter().map(|v| litteral(v)).collect();
        sql.push_str(&contrainte(nom, "valeur absente de la liste.", &format!("{q} IN ({})", valeurs.join(", "))));
    }
    if let Some(regle) = p.valide_si.as_deref().filter(|r| !r.trim().is_empty()) {
        let mut tr = Traducteur::nouveau(Contexte::Schema, Some(&[nom.to_string()]));
        let condition = tr.critere(regle, &q)?;
        let message = p
            .message_validation
            .clone()
            .filter(|m| !m.trim().is_empty())
            .unwrap_or_else(|| format!("la règle « {} » n'est pas respectée.", regle.trim()));
        sql.push_str(&contrainte(nom, &message, &condition));
    }
    Ok(sql)
}

/// Instruction CREATE TABLE complete.
///
/// `nom_sql` est le nom physique a creer (nom de travail lors d'une reconstruction) ;
/// `relations` sont les relations avec integrite ou la table est l'enfant.
pub fn creation_sql(
    nom_sql: &str,
    champs: &[DefinitionChamp],
    proprietes: &ProprietesTable,
    relations: &[Relation],
) -> Resultat<String> {
    let noms = valider_champs(champs)?;
    let mut parties = champs
        .iter()
        .map(|c| colonne_sql(c, &noms))
        .collect::<Resultat<Vec<_>>>()?;
    let cles: Vec<String> = champs
        .iter()
        .filter(|c| c.cle_primaire && c.type_champ != TypeChamp::NumeroAuto)
        .map(|c| guillemets(c.nom.trim()))
        .collect();
    if !cles.is_empty() {
        parties.push(format!("PRIMARY KEY ({})", cles.join(", ")));
    }
    if let Some(regle) = proprietes.valide_si.as_deref().filter(|r| !r.trim().is_empty()) {
        let mut tr = Traducteur::nouveau(Contexte::Schema, Some(&noms));
        let condition = tr.expression(regle)?;
        let message = proprietes
            .message_validation
            .clone()
            .filter(|m| !m.trim().is_empty())
            .unwrap_or_else(|| format!("la règle de table « {} » n'est pas respectée.", regle.trim()));
        parties.push(contrainte("*", &message, &condition).trim_start().to_string());
    }
    for r in relations.iter().filter(|r| r.integrite) {
        let enfant: Vec<String> = r.champs_enfant.iter().map(|c| guillemets(c)).collect();
        let parent: Vec<String> = r.champs_parent.iter().map(|c| guillemets(c)).collect();
        let maj = if r.cascade_maj { "CASCADE" } else { "NO ACTION" };
        let suppr = match r.suppression {
            Suppression::Restreindre => "NO ACTION",
            Suppression::Cascade => "CASCADE",
            Suppression::MettreNull => "SET NULL",
        };
        parties.push(format!(
            "FOREIGN KEY ({}) REFERENCES {}({}) ON UPDATE {maj} ON DELETE {suppr}",
            enfant.join(", "),
            guillemets(&r.table_parent),
            parent.join(", ")
        ));
    }
    Ok(format!("CREATE TABLE {} (\n  {}\n)", guillemets(nom_sql), parties.join(",\n  ")))
}

/// Index a creer pour la propriete « Indexe » des champs et pour les champs lies des relations.
pub fn index_sql(table: &str, champs: &[DefinitionChamp], relations: &[Relation]) -> Vec<String> {
    let cles = champs.iter().filter(|c| c.cle_primaire).count();
    let mut sortie = Vec::new();
    for c in champs {
        if c.type_champ == TypeChamp::Calcule || (c.cle_primaire && cles == 1) {
            continue;
        }
        let unique = match c.proprietes.indexe {
            Indexation::Non => continue,
            Indexation::AvecDoublons => "",
            Indexation::SansDoublons => "UNIQUE ",
        };
        sortie.push(format!(
            "CREATE {unique}INDEX IF NOT EXISTS {} ON {} ({})",
            guillemets(&format!("{PREFIXE_INDEX_CHAMP}{table}:{}", c.nom.trim())),
            guillemets(table),
            guillemets(c.nom.trim())
        ));
    }
    for r in relations.iter().filter(|r| r.table_enfant.eq_ignore_ascii_case(table)) {
        let cols: Vec<String> = r.champs_enfant.iter().map(|c| guillemets(c)).collect();
        sortie.push(format!(
            "CREATE INDEX IF NOT EXISTS {} ON {} ({})",
            guillemets(&format!("{PREFIXE_INDEX_RELATION}{}", r.nom)),
            guillemets(table),
            cols.join(", ")
        ));
    }
    sortie
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn defauts_access() {
        assert_eq!(defaut_sql("Date()", TypeChamp::DateHeure).ok().flatten().as_deref(), Some("(date('now','localtime'))"));
        assert_eq!(defaut_sql("1,5", TypeChamp::ReelDouble).ok().flatten().as_deref(), Some("1.5"));
        assert_eq!(defaut_sql("Oui", TypeChamp::OuiNon).ok().flatten().as_deref(), Some("1"));
        assert_eq!(defaut_sql("Paris", TypeChamp::TexteCourt).ok().flatten().as_deref(), Some("'Paris'"));
        assert_eq!(defaut_sql("\"l'eau\"", TypeChamp::TexteCourt).ok().flatten().as_deref(), Some("('l''eau')"));
        assert!(defaut_sql("[Autre]", TypeChamp::ReelDouble).is_err());
    }

    #[test]
    fn numero_auto_unique_cle() {
        let mut c = DefinitionChamp::nouveau("N", TypeChamp::NumeroAuto);
        c.cle_primaire = false;
        assert!(valider_champs(&[c]).is_err());
        let ok = [DefinitionChamp::nouveau("N", TypeChamp::NumeroAuto), DefinitionChamp::nouveau("Nom", TypeChamp::TexteCourt)];
        assert!(valider_champs(&ok).is_ok());
    }
}
