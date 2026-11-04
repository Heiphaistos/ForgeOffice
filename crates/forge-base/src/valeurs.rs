//! Conversion des valeurs entre JSON (interface) et SQLite, selon le type Access du champ.
//!
//! Saisie a la francaise acceptee : `1 234,56`, `12,5 €`, `31/12/2024`, `31/12/2024 14:30`,
//! `Oui`/`Non`/`Vrai`/`Faux`. Sortie : nombres JSON, booleens, dates ISO 8601,
//! pieces jointes `{ "type": "blob", "base64": ..., "taille": n }`.

use base64::Engine;
use rusqlite::types::{Value as SqlValue, ValueRef};
use serde_json::{json, Value as Json};

use crate::types::{ProprietesChamp, Rendu, TypeChamp};

const B64: base64::engine::GeneralPurpose = base64::engine::general_purpose::STANDARD;

/// Annee pivot des annees sur deux chiffres (comme Access : 00-29 -> 20xx).
const PIVOT_SIECLE: i64 = 30;

fn bissextile(a: i64) -> bool {
    (a % 4 == 0 && a % 100 != 0) || a % 400 == 0
}

fn jours_dans_mois(a: i64, m: i64) -> i64 {
    match m {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 if bissextile(a) => 29,
        2 => 28,
        _ => 0,
    }
}

fn entier(s: &str) -> Option<i64> {
    (!s.is_empty() && s.len() <= 4 && s.bytes().all(|b| b.is_ascii_digit()))
        .then(|| s.parse().ok())
        .flatten()
}

fn date_valide(a: i64, m: i64, j: i64) -> Option<String> {
    ((1..=9999).contains(&a) && (1..=12).contains(&m) && j >= 1 && j <= jours_dans_mois(a, m))
        .then(|| format!("{a:04}-{m:02}-{j:02}"))
}

fn analyser_heure(t: &str) -> Option<String> {
    let t = t.trim().trim_end_matches('Z');
    let t = match t.find(['+']).or_else(|| t.rfind('-').filter(|&p| p > 5)) {
        Some(p) => &t[..p],
        None => t,
    };
    let t = t.replace(['h', 'H'], ":");
    let mut parties = t.split(':');
    let h = entier(parties.next()?.trim())?;
    let mi = parties.next().map_or(Some(0), |x| if x.is_empty() { Some(0) } else { entier(x) })?;
    let s = match parties.next() {
        Some(x) => entier(x.split(['.', ',']).next().unwrap_or(""))?,
        None => 0,
    };
    if parties.next().is_some() || h > 23 || mi > 59 || s > 59 {
        return None;
    }
    Some(format!("{h:02}:{mi:02}:{s:02}"))
}

/// Analyse une date ou date-heure (ISO, francaise `JJ/MM/AAAA`, `JJ.MM.AAAA`, `JJ-MM-AAAA`).
///
/// Renvoie le format de stockage : `AAAA-MM-JJ` ou `AAAA-MM-JJ HH:MM:SS` (ou `HH:MM:SS` seul).
pub fn analyser_date(texte: &str) -> Option<String> {
    let t = texte.trim();
    if t.is_empty() {
        return None;
    }
    let (partie_date, partie_heure) = match t.find(['T', ' ']) {
        Some(p) => (&t[..p], Some(t[p + 1..].trim())),
        None => (t, None),
    };
    if partie_heure.is_none() && partie_date.contains(':') {
        return analyser_heure(partie_date);
    }
    let morceaux: Vec<&str> = partie_date.split(['-', '/', '.']).collect();
    if morceaux.len() != 3 {
        return None;
    }
    let (a, m, j) = if morceaux[0].len() == 4 {
        (entier(morceaux[0])?, entier(morceaux[1])?, entier(morceaux[2])?)
    } else {
        let mut a = entier(morceaux[2])?;
        if morceaux[2].len() <= 2 {
            a += if a < PIVOT_SIECLE { 2000 } else { 1900 };
        }
        (a, entier(morceaux[1])?, entier(morceaux[0])?)
    };
    let date = date_valide(a, m, j)?;
    match partie_heure.filter(|h| !h.is_empty()) {
        None => Some(date),
        Some(h) => Some(format!("{date} {}", analyser_heure(h)?)),
    }
}

/// Convertit un numero de serie Excel/Access (jours depuis le 30/12/1899) en date de stockage.
pub fn date_depuis_serie(serie: f64) -> Option<String> {
    if !serie.is_finite() || !(-657_434.0..=2_958_465.0).contains(&serie) {
        return None;
    }
    let jours = serie.floor() as i64;
    let secondes = ((serie - serie.floor()) * 86_400.0).round() as i64;
    // Jours depuis 1970-01-01 : le 30/12/1899 est le jour -25569.
    let z = jours - 25_569 + 719_468;
    let ere = z.div_euclid(146_097);
    let doe = z - ere * 146_097;
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let j = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let a = yoe + ere * 400 + i64::from(m <= 2);
    let date = date_valide(a, m, j)?;
    if secondes == 0 {
        Some(date)
    } else {
        let s = secondes.min(86_399);
        Some(format!("{date} {:02}:{:02}:{:02}", s / 3600, (s / 60) % 60, s % 60))
    }
}

/// Analyse un nombre saisi a la francaise ou a l'anglaise.
///
/// `decimale` impose le separateur decimal ; sans lui : `,` seule = decimale (usage francais),
/// `.` et `,` presents = le dernier est la decimale.
pub fn analyser_nombre(texte: &str, decimale: Option<char>) -> Option<f64> {
    let mut t: String = texte
        .trim()
        .chars()
        .filter(|c| !matches!(c, ' ' | '\u{a0}' | '\u{202f}' | '€' | '$' | '£' | '\''))
        .collect();
    let pourcent = t.ends_with('%');
    if pourcent {
        t.pop();
    }
    if t.is_empty() {
        return None;
    }
    let dec = decimale.unwrap_or_else(|| match (t.rfind(','), t.rfind('.')) {
        (Some(v), Some(p)) => {
            if v > p {
                ','
            } else {
                '.'
            }
        }
        (Some(_), None) if t.matches(',').count() == 1 => ',',
        (None, Some(_)) if t.matches('.').count() > 1 => ',',
        _ => '.',
    });
    let milliers = if dec == ',' { '.' } else { ',' };
    let normal: String = t
        .chars()
        .filter(|&c| c != milliers)
        .map(|c| if c == dec { '.' } else { c })
        .collect();
    if !normal
        .chars()
        .all(|c| c.is_ascii_digit() || matches!(c, '.' | '-' | '+' | 'e' | 'E'))
    {
        return None;
    }
    let n: f64 = normal.parse().ok()?;
    n.is_finite().then_some(if pourcent { n / 100.0 } else { n })
}

/// Analyse un booleen (`oui`, `non`, `vrai`, `faux`, `true`, `false`, `1`, `0`, `-1`, `x`).
pub fn analyser_booleen(texte: &str) -> Option<bool> {
    match texte.trim().to_lowercase().as_str() {
        "oui" | "vrai" | "true" | "yes" | "1" | "-1" | "x" | "o" | "on" => Some(true),
        "non" | "faux" | "false" | "no" | "0" | "n" | "off" | "" => Some(false),
        _ => None,
    }
}

/// Refuse les liens dangereux (`javascript:`, `vbscript:`, `data:`, `file:`).
pub fn lien_sur(lien: &str) -> bool {
    let propre: String = lien
        .chars()
        .filter(|c| !c.is_control() && !c.is_whitespace())
        .collect::<String>()
        .to_lowercase();
    !["javascript:", "vbscript:", "data:", "file:"]
        .iter()
        .any(|s| propre.starts_with(s))
}

/// Decode une piece jointe : `{ "base64": ... }`, `{ "blob": ... }` ou URL `data:...;base64,...`.
pub fn decoder_blob(v: &Json) -> Option<Vec<u8>> {
    let texte = match v {
        Json::Object(o) => o.get("base64").or_else(|| o.get("blob"))?.as_str()?,
        Json::String(s) => s.split_once(";base64,").map(|(_, d)| d)?,
        _ => return None,
    };
    B64.decode(texte.trim()).ok()
}

fn texte_de(v: &Json) -> String {
    match v {
        Json::String(s) => s.clone(),
        Json::Bool(b) => if *b { "Vrai" } else { "Faux" }.into(),
        Json::Number(n) => n.to_string(),
        autre => autre.to_string(),
    }
}

fn nombre_de(v: &Json, decimale: Option<char>) -> Result<f64, String> {
    match v {
        Json::Number(n) => n.as_f64().ok_or_else(|| "nombre invalide.".to_string()),
        Json::Bool(b) => Ok(if *b { 1.0 } else { 0.0 }),
        Json::String(s) => {
            analyser_nombre(s, decimale).ok_or_else(|| format!("« {s} » n'est pas un nombre."))
        }
        _ => Err("nombre attendu.".into()),
    }
}

fn arrondir(x: f64, decimales: u32) -> f64 {
    let f = 10f64.powi(decimales as i32);
    (x * f).round() / f
}

/// Valeur JSON -> valeur SQLite pour un champ du type donne (sans type : conversion generique).
///
/// L'erreur est un message sans le nom du champ (l'appelant l'ajoute).
pub fn json_vers_sql(
    v: &Json,
    type_champ: Option<TypeChamp>,
    proprietes: Option<&ProprietesChamp>,
    decimale: Option<char>,
) -> Result<SqlValue, String> {
    let Some(t) = type_champ else {
        return Ok(generique(v));
    };
    if v.is_null() {
        return Ok(SqlValue::Null);
    }
    if matches!(v, Json::String(s) if s.trim().is_empty()) && !t.est_texte() {
        return Ok(SqlValue::Null);
    }
    match t {
        TypeChamp::Calcule => Err("champ calculé : lecture seule.".into()),
        TypeChamp::OuiNon => {
            let b = match v {
                Json::Bool(b) => Some(*b),
                Json::Number(n) => n.as_f64().map(|x| x != 0.0),
                Json::String(s) => analyser_booleen(s),
                _ => None,
            };
            b.map(|b| SqlValue::Integer(i64::from(b)))
                .ok_or_else(|| format!("« {} » n'est pas Oui/Non.", texte_de(v)))
        }
        t if t.est_entier() => {
            let x = nombre_de(v, decimale)?;
            if x.fract() != 0.0 {
                return Err(format!("{x} n'est pas un nombre entier."));
            }
            if x.abs() > 9.007_199_254_740_992e15 {
                return Err("nombre entier trop grand.".into());
            }
            let n = x as i64;
            if let Some((min, max)) = t.plage_entiere() {
                if n < min || n > max {
                    return Err(format!("{n} est hors limites ({min} à {max})."));
                }
            }
            Ok(SqlValue::Integer(n))
        }
        TypeChamp::Monetaire => Ok(SqlValue::Real(arrondir(nombre_de(v, decimale)?, 4))),
        TypeChamp::Decimal => {
            let echelle = proprietes.and_then(|p| p.echelle).unwrap_or(0);
            let x = arrondir(nombre_de(v, decimale)?, u32::from(echelle));
            Ok(if echelle == 0 && x.abs() < 9e15 {
                SqlValue::Integer(x as i64)
            } else {
                SqlValue::Real(x)
            })
        }
        TypeChamp::ReelSimple => Ok(SqlValue::Real(f64::from(nombre_de(v, decimale)? as f32))),
        TypeChamp::ReelDouble => Ok(SqlValue::Real(nombre_de(v, decimale)?)),
        TypeChamp::DateHeure => match v {
            Json::String(s) => analyser_date(s)
                .map(SqlValue::Text)
                .ok_or_else(|| format!("« {s} » n'est pas une date valide (JJ/MM/AAAA ou AAAA-MM-JJ).")),
            Json::Number(n) => n
                .as_f64()
                .and_then(date_depuis_serie)
                .map(SqlValue::Text)
                .ok_or_else(|| "numéro de série de date invalide.".into()),
            _ => Err("date attendue.".into()),
        },
        TypeChamp::PieceJointe | TypeChamp::ObjetOle => decoder_blob(v)
            .map(SqlValue::Blob)
            .ok_or_else(|| "pièce jointe attendue (base64).".into()),
        TypeChamp::LienHypertexte => {
            let lien = texte_de(v);
            if lien_sur(&lien) {
                Ok(SqlValue::Text(lien))
            } else {
                Err("lien refusé (javascript:, vbscript:, data: et file: sont interdits).".into())
            }
        }
        _ => Ok(SqlValue::Text(texte_de(v))),
    }
}

/// Conversion sans type connu (parametres SQL).
pub fn generique(v: &Json) -> SqlValue {
    match v {
        Json::Null => SqlValue::Null,
        Json::Bool(b) => SqlValue::Integer(i64::from(*b)),
        Json::Number(n) => match n.as_i64() {
            Some(i) => SqlValue::Integer(i),
            None => n.as_f64().map_or(SqlValue::Null, SqlValue::Real),
        },
        Json::String(s) => SqlValue::Text(s.clone()),
        Json::Object(_) => match decoder_blob(v) {
            Some(b) => SqlValue::Blob(b),
            None => SqlValue::Text(v.to_string()),
        },
        Json::Array(_) => SqlValue::Text(v.to_string()),
    }
}

/// Valeur SQLite -> JSON selon le rendu voulu.
pub fn sql_vers_json(v: ValueRef<'_>, rendu: Rendu, blobs_complets: bool) -> Json {
    match (v, rendu) {
        (ValueRef::Null, _) => Json::Null,
        (ValueRef::Integer(i), Rendu::Booleen) => Json::Bool(i != 0),
        (ValueRef::Real(f), Rendu::Booleen) => Json::Bool(f != 0.0),
        (ValueRef::Text(t), Rendu::Booleen) => {
            let s = String::from_utf8_lossy(t);
            analyser_booleen(&s).map_or(Json::String(s.into_owned()), Json::Bool)
        }
        (ValueRef::Text(t), Rendu::Date) => {
            let s = String::from_utf8_lossy(t);
            Json::String(if s.len() == 19 && s.as_bytes()[10] == b' ' {
                format!("{}T{}", &s[..10], &s[11..])
            } else {
                s.into_owned()
            })
        }
        (ValueRef::Integer(i), Rendu::Texte) => Json::String(i.to_string()),
        (ValueRef::Integer(i), _) => Json::from(i),
        (ValueRef::Real(f), Rendu::Texte) => Json::String(f.to_string()),
        (ValueRef::Real(f), _) => serde_json::Number::from_f64(f).map_or(Json::Null, Json::Number),
        (ValueRef::Text(t), _) => Json::String(String::from_utf8_lossy(t).into_owned()),
        (ValueRef::Blob(b), _) => {
            if blobs_complets {
                json!({ "type": "blob", "base64": B64.encode(b), "taille": b.len() })
            } else {
                json!({ "type": "blob", "taille": b.len() })
            }
        }
    }
}

/// Valeur SQLite possedee -> JSON (pratique pour les valeurs deja extraites).
pub fn valeur_vers_json(v: &SqlValue, rendu: Rendu) -> Json {
    sql_vers_json(ValueRef::from(v), rendu, true)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn dates_francaises_et_iso() {
        assert_eq!(analyser_date("31/12/2024").as_deref(), Some("2024-12-31"));
        assert_eq!(analyser_date("1.2.24").as_deref(), Some("2024-02-01"));
        assert_eq!(analyser_date("5/6/95").as_deref(), Some("1995-06-05"));
        assert_eq!(analyser_date("2024-02-29T08:05:09Z").as_deref(), Some("2024-02-29 08:05:09"));
        assert_eq!(analyser_date("29/02/2023"), None);
        assert_eq!(analyser_date("31/12/2024 14h30").as_deref(), Some("2024-12-31 14:30:00"));
        assert_eq!(analyser_date("10:30").as_deref(), Some("10:30:00"));
        assert_eq!(date_depuis_serie(45_658.5).as_deref(), Some("2025-01-01 12:00:00"));
        assert_eq!(date_depuis_serie(1.0).as_deref(), Some("1899-12-31"));
    }

    #[test]
    fn nombres_francais() {
        assert_eq!(analyser_nombre("1 234,56", None), Some(1234.56));
        assert_eq!(analyser_nombre("1.234,5", None), Some(1234.5));
        assert_eq!(analyser_nombre("1,234.5", None), Some(1234.5));
        assert_eq!(analyser_nombre("12,5 €", None), Some(12.5));
        assert_eq!(analyser_nombre("15 %", None), Some(0.15));
        assert_eq!(analyser_nombre("abc", None), None);
        assert_eq!(analyser_nombre("1.5", Some(',')), Some(15.0));
    }

    #[test]
    fn conversions_typees() {
        let oui = json_vers_sql(&json!("Oui"), Some(TypeChamp::OuiNon), None, None);
        assert_eq!(oui, Ok(SqlValue::Integer(1)));
        assert!(json_vers_sql(&json!(300), Some(TypeChamp::Octet), None, None).is_err());
        assert!(json_vers_sql(&json!(1.5), Some(TypeChamp::EntierLong), None, None).is_err());
        assert_eq!(
            json_vers_sql(&json!("12,345678"), Some(TypeChamp::Monetaire), None, None),
            Ok(SqlValue::Real(12.3457))
        );
        assert!(json_vers_sql(&json!(" JavaScript:alert(1)"), Some(TypeChamp::LienHypertexte), None, None).is_err());
        let blob = json_vers_sql(&json!({"base64": "AAEC"}), Some(TypeChamp::PieceJointe), None, None);
        assert_eq!(blob, Ok(SqlValue::Blob(vec![0, 1, 2])));
        let rendu = sql_vers_json(ValueRef::Blob(&[0, 1, 2]), Rendu::Blob, true);
        assert_eq!(rendu["base64"], "AAEC");
        assert_eq!(sql_vers_json(ValueRef::Text(b"2024-01-02 03:04:05"), Rendu::Date, true), json!("2024-01-02T03:04:05"));
    }
}
