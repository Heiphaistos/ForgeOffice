//! Purge des donnees annexes qui gardent le texte ou les pixels caviardes : le
//! caviardage des flux de contenu ne suffit pas, il reste /Thumb (miniature des
//! pages touchees), /Metadata (XMP), /Info, les signets (/Outlines), la structure
//! balisee (ActualText, Alt) et les valeurs des champs et annotations.
//!
//! Le texte caviarde est deduit en comparant le texte extrait avant et apres
//! (mots d'au moins 3 caracteres qui ont disparu) ; tout signet, champ,
//! annotation ou element de structure qui contient un de ces mots est vide.

use super::caviardage::RapportCaviardage;
use lopdf::{Dictionary, Document, Object, ObjectId};
use std::collections::HashMap;

const LONGUEUR_MIN: usize = 3;
/// Cles a chaines de texte pouvant reprendre le texte caviarde.
const CLES_TEXTE: [&[u8]; 9] = [b"Title", b"ActualText", b"Alt", b"TU", b"V", b"DV", b"RV", b"Contents", b"Subj"];

fn mots_de(texte: &str) -> impl Iterator<Item = String> + '_ {
    texte
        .split_whitespace()
        .map(|m| m.trim_matches(|c: char| !c.is_alphanumeric()).to_lowercase())
        .filter(|m| m.chars().count() >= LONGUEUR_MIN)
}

/// Mots presents dans `avant` et disparus de `apres` (comparaison de multi-ensembles).
pub(crate) fn mots_disparus(avant: &str, apres: &str) -> Vec<String> {
    let mut restants: HashMap<String, u32> = HashMap::new();
    for m in mots_de(apres) {
        *restants.entry(m).or_insert(0) += 1;
    }
    let mut perdus: Vec<String> = Vec::new();
    for m in mots_de(avant) {
        match restants.get_mut(&m) {
            Some(n) if *n > 0 => *n -= 1,
            _ => perdus.push(m),
        }
    }
    perdus.sort();
    perdus.dedup();
    perdus
}

/// Lectures plausibles d'une chaine PDF (UTF-16BE avec BOM, sinon octets bruts), en minuscules.
fn lectures(o: &Object) -> Vec<String> {
    match o {
        Object::String(b, _) => {
            if b.starts_with(&[0xFE, 0xFF]) {
                let u: Vec<u16> = b[2..].chunks_exact(2).map(|p| u16::from_be_bytes([p[0], p[1]])).collect();
                vec![String::from_utf16_lossy(&u).to_lowercase()]
            } else {
                vec![b.iter().map(|&c| c as char).collect::<String>().to_lowercase(), String::from_utf8_lossy(b).to_lowercase()]
            }
        }
        Object::Array(a) => a.iter().flat_map(lectures).collect(),
        _ => Vec::new(),
    }
}

fn dico(o: &mut Object) -> Option<&mut Dictionary> {
    match o {
        Object::Dictionary(d) => Some(d),
        Object::Stream(s) => Some(&mut s.dict),
        _ => None,
    }
}

/// Retire /Thumb des pages touchees, /Metadata et /PieceInfo de partout, /Info du
/// trailer, puis vide les elements annexes qui contiennent un mot caviarde.
pub(crate) fn purger(doc: &mut Document, pages_touchees: &[ObjectId], mots: &[String], rapport: &mut RapportCaviardage) {
    let mut meta = doc.trailer.remove(b"Info").is_some();
    for id in pages_touchees {
        if let Some(d) = doc.objects.get_mut(id).and_then(dico) {
            meta |= d.remove(b"Thumb").is_some();
        }
    }
    let mut vides = 0u32;
    for obj in doc.objects.values_mut() {
        let Some(d) = dico(obj) else { continue };
        meta |= d.remove(b"Metadata").is_some();
        meta |= d.remove(b"PieceInfo").is_some();
        if mots.is_empty() {
            continue;
        }
        let mut touche = false;
        for cle in CLES_TEXTE {
            let contient = d.get(cle).map(lectures).is_ok_and(|l| l.iter().any(|t| mots.iter().any(|m| t.contains(m.as_str()))));
            if contient {
                if cle == b"Title" {
                    d.set(cle, Object::string_literal(""));
                } else {
                    d.remove(cle);
                }
                touche = true;
            }
        }
        if touche {
            // L'apparence d'une annotation ou d'un champ reprend le texte vide.
            d.remove(b"AP");
            vides += 1;
        }
    }
    if meta {
        rapport.avertissements.push(
            "Les métadonnées (Info, XMP) et les miniatures ont été supprimées : elles pouvaient contenir le texte d'origine.".into(),
        );
    }
    if vides > 0 {
        rapport.avertissements.push(format!(
            "{vides} élément(s) annexe(s) (signet, champ de formulaire, annotation ou structure balisée) contenant du texte caviardé ont été vidés."
        ));
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mots_disparus_compare_en_multi_ensemble() {
        let p = mots_disparus("Public SECRET fin. secret, ab", "Public fin. secret");
        assert_eq!(p, vec!["secret".to_string()]);
        assert!(mots_disparus("a b cd", "").is_empty());
    }

    #[test]
    fn lectures_decode_utf16() {
        let mut b = vec![0xFE, 0xFF];
        for u in "Sécret".encode_utf16() {
            b.extend(u.to_be_bytes());
        }
        assert_eq!(lectures(&Object::String(b, lopdf::StringFormat::Hexadecimal)), vec!["sécret".to_string()]);
    }
}
