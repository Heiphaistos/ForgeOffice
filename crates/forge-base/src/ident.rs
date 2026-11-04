//! Noms d'objets : validation (regles Access) et citation SQL sure.

use crate::erreur::{ErreurBase, Resultat};

/// Prefixe des tables internes de metadonnees.
pub const PREFIXE_INTERNE: &str = "__fo_";

/// Longueur maximale d'un nom (comme Access).
pub const LONGUEUR_NOM_MAX: usize = 64;

/// Cite un identifiant SQL : `Nom "x"` -> `"Nom ""x"""`. Toujours utilise, jamais de concatenation brute.
pub fn guillemets(nom: &str) -> String {
    format!("\"{}\"", nom.replace('"', "\"\""))
}

/// Cite une chaine litterale SQL (reservee au DDL, ou les parametres lies sont impossibles).
pub fn litteral(texte: &str) -> String {
    format!("'{}'", texte.replace('\'', "''"))
}

/// Vrai pour les objets internes (metadonnees ForgeOffice ou SQLite).
pub fn est_interne(nom: &str) -> bool {
    let bas = nom.to_ascii_lowercase();
    bas.starts_with(PREFIXE_INTERNE) || bas.starts_with("sqlite_")
}

/// Valide un nom d'objet selon les regles d'Access et renvoie le nom nettoye des espaces.
///
/// Refuse : nom vide, plus de 64 caracteres, caracteres `. ! ` [ ]`, caracteres de controle,
/// espace initial, noms reserves (`__fo_*`, `sqlite_*`).
pub fn valider_nom(nom: &str) -> Resultat<String> {
    let propre = nom.trim();
    if propre.is_empty() {
        return Err(ErreurBase::NomInvalide("le nom est vide.".into()));
    }
    if propre.chars().count() > LONGUEUR_NOM_MAX {
        return Err(ErreurBase::NomInvalide(format!(
            "« {propre} » dépasse {LONGUEUR_NOM_MAX} caractères."
        )));
    }
    if let Some(c) = propre
        .chars()
        .find(|c| matches!(c, '.' | '!' | '`' | '[' | ']') || c.is_control())
    {
        let montre = if c.is_control() {
            "caractère de contrôle".to_string()
        } else {
            format!("« {c} »")
        };
        return Err(ErreurBase::NomInvalide(format!(
            "« {propre} » contient un caractère interdit ({montre})."
        )));
    }
    if est_interne(propre) {
        return Err(ErreurBase::NomInvalide(format!(
            "« {propre} » est un nom réservé."
        )));
    }
    Ok(propre.to_string())
}

/// Transforme un texte quelconque (en-tete CSV, nom de colonne de classeur) en nom valide.
pub fn assainir_nom(brut: &str, rang: usize) -> String {
    let mut nom: String = brut
        .trim()
        .chars()
        .map(|c| match c {
            '.' | '!' | '`' | '[' | ']' => '_',
            c if c.is_control() => ' ',
            c => c,
        })
        .collect();
    nom = nom.trim().chars().take(LONGUEUR_NOM_MAX).collect();
    if nom.is_empty() || est_interne(&nom) {
        nom = format!("Champ{}", rang + 1);
    }
    nom
}

/// Rend une liste de noms unique (insensible a la casse) en suffixant ` 2`, ` 3`...
pub fn noms_uniques(noms: Vec<String>) -> Vec<String> {
    let mut vus: Vec<String> = Vec::with_capacity(noms.len());
    let mut sortie = Vec::with_capacity(noms.len());
    for nom in noms {
        let mut candidat = nom.clone();
        let mut n = 2;
        while vus.contains(&candidat.to_lowercase()) {
            let suffixe = format!(" {n}");
            let base: String = nom
                .chars()
                .take(LONGUEUR_NOM_MAX - suffixe.chars().count())
                .collect();
            candidat = format!("{base}{suffixe}");
            n += 1;
        }
        vus.push(candidat.to_lowercase());
        sortie.push(candidat);
    }
    sortie
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn citation_echappe_les_guillemets() {
        assert_eq!(guillemets("a\"b"), "\"a\"\"b\"");
        assert_eq!(litteral("l'eau"), "'l''eau'");
    }

    #[test]
    fn noms_refuses() {
        assert!(valider_nom("").is_err());
        assert!(valider_nom("a.b").is_err());
        assert!(valider_nom("[x]").is_err());
        assert!(valider_nom("__fo_champs").is_err());
        assert!(valider_nom("SQLITE_master").is_err());
        assert!(valider_nom(&"x".repeat(65)).is_err());
        assert_eq!(valider_nom("  Clients  ").ok().as_deref(), Some("Clients"));
    }

    #[test]
    fn assainir_et_dedoublonner() {
        let noms = vec![
            assainir_nom("Prix.HT", 0),
            assainir_nom("", 1),
            assainir_nom("prix_ht", 2),
            assainir_nom("Prix_HT", 3),
        ];
        assert_eq!(noms_uniques(noms), vec!["Prix_HT", "Champ2", "prix_ht 2", "Prix_HT 3"]);
    }
}
