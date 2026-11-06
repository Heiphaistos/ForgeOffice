//! Lecteur de fichiers Access `.mdb` (Jet 4 / Access 2000-2003) et `.accdb` (ACE) en lecture
//! seule, Rust pur : pages de 4096 octets, catalogue `MSysObjects` (page 2), definitions de
//! table (TDEF), cartes d'utilisation des pages, lignes a champs fixes et variables, memos
//! (LVAL) et textes en Unicode compresse.
//!
//! Pris en charge : texte, memo, octet, entier, entier long, NumeroAuto, monetaire, reel simple et
//! double, date/heure, oui/non, GUID, grand entier. Non lus (colonne ignoree, signalee) : binaire,
//! objet OLE, decimal, pieces jointes et champs multivalues. Non pris en charge : Access 97 (Jet 3,
//! pages de 2048 octets), bases chiffrees ou protegees par mot de passe, index et relations.
//!
//! Toute valeur lue dans le fichier est hostile : chaque acces est borne (`Option`), les chaines
//! de pages sont limitees et sans boucle, les tailles de memo plafonnees.

use serde_json::{json, Value as Json};
use std::collections::HashSet;

use crate::erreur::{ErreurBase, Resultat};

const PAGE: usize = 4096;
/// Pages de definition de table suivies au plus (anti-boucle).
const TDEF_PAGES_MAX: usize = 64;
/// Taille maximale d'une valeur memo (64 Mio).
const MEMO_MAX: usize = 64 * 1024 * 1024;
/// Lignes lues au plus par table.
pub(crate) const LIGNES_MAX: usize = 2_000_000;
/// Colonnes par table (limite Access : 255).
const COLONNES_MAX: usize = 255;
/// Tables lues au plus.
const TABLES_MAX: usize = 4096;

/// Colonne d'une table Access.
#[derive(Debug, Clone, PartialEq)]
pub struct ColonneAccess {
    /// Nom.
    pub nom: String,
    /// Code de type Jet (1 booleen, 2 octet, 3 entier, 4 entier long, 5 monetaire, 6 reel simple,
    /// 7 reel double, 8 date, 10 texte, 12 memo, 15 GUID, 19 grand entier...).
    pub type_code: u8,
    /// NuméroAuto (entier long auto-incremente).
    pub auto: bool,
    /// Taille declaree en octets (2 octets par caractere pour un texte).
    pub taille: u16,
    num: u16,
    var: u16,
    fixe: u16,
    drapeaux: u8,
}

impl ColonneAccess {
    /// Vrai si le lecteur sait decoder ce type.
    pub fn lisible(&self) -> bool {
        matches!(self.type_code, 1..=8 | 10 | 12 | 15 | 19)
    }
}

/// Table lue : colonnes lisibles et lignes (une valeur JSON par colonne).
#[derive(Debug, Clone, PartialEq)]
pub struct TableAccess {
    /// Nom de la table.
    pub nom: String,
    /// Toutes les colonnes (y compris celles qui ne sont pas lisibles).
    pub colonnes: Vec<ColonneAccess>,
    /// Lignes ; les colonnes illisibles valent `null`.
    pub lignes: Vec<Vec<Json>>,
    /// Lignes abimees ou hors limites, ignorees.
    pub ignorees: u64,
}

fn u16_(b: &[u8], o: usize) -> Option<u16> {
    Some(u16::from_le_bytes(b.get(o..o.checked_add(2)?)?.try_into().ok()?))
}
fn u32_(b: &[u8], o: usize) -> Option<u32> {
    Some(u32::from_le_bytes(b.get(o..o.checked_add(4)?)?.try_into().ok()?))
}
fn u24_(b: &[u8], o: usize) -> Option<usize> {
    let s = b.get(o..o.checked_add(3)?)?;
    Some(usize::from(s[0]) | usize::from(s[1]) << 8 | usize::from(s[2]) << 16)
}

struct Fichier<'a>(&'a [u8]);

/// Definition de table lue dans la page TDEF.
struct Def {
    colonnes: Vec<ColonneAccess>,
    carte: (usize, usize),
}

impl<'a> Fichier<'a> {
    fn page(&self, n: usize) -> Option<&'a [u8]> {
        let debut = n.checked_mul(PAGE)?;
        self.0.get(debut..debut.checked_add(PAGE)?)
    }

    /// Octets de la ligne `r` d'une page de donnees, drapeaux compris (bit 0x8000 = supprimee).
    fn ligne(&self, p: &'a [u8], r: usize) -> Option<(&'a [u8], u16)> {
        let nb = usize::from(u16_(p, 12)?);
        if r >= nb {
            return None;
        }
        let entree = u16_(p, 14 + 2 * r)?;
        let debut = usize::from(entree & 0x1FFF);
        let fin = if r == 0 { PAGE } else { usize::from(u16_(p, 14 + 2 * (r - 1))? & 0x1FFF) };
        (debut >= 14 + 2 * nb && debut < fin && fin <= PAGE).then(|| (&p[debut..fin], entree))
    }

    /// Octets d'une ligne designee par (page, ligne) ; un pointeur de debordement est suivi une fois.
    fn ligne_a(&self, pg: usize, r: usize) -> Option<&'a [u8]> {
        let (l, drap) = self.ligne(self.page(pg)?, r)?;
        if drap & 0x4000 == 0 {
            return Some(l);
        }
        let (pg2, r2) = (u24_(l, 1)?, usize::from(*l.first()?));
        let (l2, d2) = self.ligne(self.page(pg2)?, r2)?;
        (d2 & 0x4000 == 0).then_some(l2)
    }

    fn tdef(&self, pg: usize) -> Option<Vec<u8>> {
        let mut tampon = self.page(pg)?.to_vec();
        if tampon[0] != 0x02 {
            return None;
        }
        let (mut suite, mut vus) = (u32_(&tampon, 4)? as usize, HashSet::from([pg]));
        while suite != 0 {
            if !vus.insert(suite) || vus.len() > TDEF_PAGES_MAX {
                return None;
            }
            let p = self.page(suite)?;
            tampon.extend_from_slice(&p[8..]);
            suite = u32_(p, 4)? as usize;
        }
        Some(tampon)
    }

    fn definition(&self, pg: usize) -> Option<Def> {
        let t = self.tdef(pg)?;
        let nb = usize::from(u16_(&t, 45)?);
        let reels = u32_(&t, 51)? as usize;
        if nb == 0 || nb > COLONNES_MAX || reels > 1000 {
            return None;
        }
        let mut pos = 63 + reels * 12;
        let mut colonnes = Vec::with_capacity(nb);
        for _ in 0..nb {
            let e = t.get(pos..pos + 25)?;
            colonnes.push(ColonneAccess {
                nom: String::new(),
                type_code: e[0],
                auto: e[0] == 4 && e[15] & 0x04 != 0,
                taille: u16_(e, 23)?,
                num: u16_(e, 5)?,
                var: u16_(e, 7)?,
                fixe: u16_(e, 21)?,
                drapeaux: e[15],
            });
            pos += 25;
        }
        for c in &mut colonnes {
            let l = usize::from(u16_(&t, pos)?);
            let brut = t.get(pos + 2..pos + 2 + l)?;
            c.nom = String::from_utf16_lossy(&brut.chunks_exact(2).map(|p| u16::from_le_bytes([p[0], p[1]])).collect::<Vec<_>>());
            pos += 2 + l;
        }
        colonnes.sort_by_key(|c| c.num);
        Some(Def { colonnes, carte: (u24_(&t, 56)?, usize::from(*t.get(55)?)) })
    }

    /// Pages de donnees de la table (carte d'utilisation en ligne ou par reference).
    fn pages_de_donnees(&self, pg_tdef: usize, carte: (usize, usize)) -> Option<Vec<usize>> {
        let m = self.ligne_a(carte.0, carte.1)?;
        let mut proprietaires = Vec::new();
        match *m.first()? {
            0 => {
                let debut = u32_(m, 1)? as usize;
                for (i, o) in m.get(5..)?.iter().enumerate() {
                    proprietaires.extend((0..8).filter(|b| o >> b & 1 == 1).map(|b| debut + i * 8 + b));
                }
            }
            1 => {
                for j in 0..(m.len() - 1) / 4 {
                    let bp = u32_(m, 1 + 4 * j)? as usize;
                    if bp == 0 {
                        continue;
                    }
                    for (i, o) in self.page(bp)?.get(4..)?.iter().enumerate() {
                        proprietaires.extend((0..8).filter(|b| o >> b & 1 == 1).map(|b| j * (PAGE - 4) * 8 + i * 8 + b));
                    }
                }
            }
            _ => return None,
        }
        let nb_pages = self.0.len() / PAGE;
        Some(
            proprietaires
                .into_iter()
                .filter(|&p| p < nb_pages && self.page(p).is_some_and(|d| d[0] == 0x01 && u32_(d, 4) == Some(pg_tdef as u32)))
                .collect(),
        )
    }

    /// Lit les lignes d'une table.
    fn lignes(&self, pg_tdef: usize, def: &Def, ignorees: &mut u64) -> Vec<Vec<Json>> {
        let mut sortie = Vec::new();
        let Some(pages) = self.pages_de_donnees(pg_tdef, def.carte) else { return sortie };
        for pg in pages {
            let Some(p) = self.page(pg) else { continue };
            for r in 0..usize::from(u16_(p, 12).unwrap_or(0)) {
                let Some((brut, drap)) = self.ligne(p, r) else {
                    *ignorees += 1;
                    continue;
                };
                if drap & 0x8000 != 0 {
                    continue;
                }
                let brut = if drap & 0x4000 != 0 { self.ligne_a(pg, r) } else { Some(brut) };
                match brut.and_then(|b| self.valeurs(b, def)) {
                    Some(v) => {
                        if sortie.len() >= LIGNES_MAX {
                            return sortie;
                        }
                        sortie.push(v);
                    }
                    None => *ignorees += 1,
                }
            }
        }
        sortie
    }

    /// Valeurs d'une ligne (champs fixes aux decalages declares, champs variables par la table des decalages).
    fn valeurs(&self, ligne: &[u8], def: &Def) -> Option<Vec<Json>> {
        let n = usize::from(u16_(ligne, 0)?);
        let masque = n.div_ceil(8);
        let fin = ligne.len().checked_sub(masque)?;
        let nb_var = usize::from(u16_(ligne, fin.checked_sub(2)?)?);
        let decalages: Vec<usize> = (0..=nb_var)
            .map(|i| u16_(ligne, fin.checked_sub(4 + 2 * i)?).map(usize::from))
            .collect::<Option<_>>()?;
        let mut sortie = Vec::with_capacity(def.colonnes.len());
        for c in &def.colonnes {
            let present = ligne.get(fin + usize::from(c.num) / 8).is_some_and(|m| m >> (c.num % 8) & 1 == 1);
            if c.type_code == 1 {
                sortie.push(Json::Bool(present));
            } else if !present || !c.lisible() {
                sortie.push(Json::Null);
            } else if c.drapeaux & 1 != 0 {
                let debut = 2 + usize::from(c.fixe);
                sortie.push(decoder_fixe(c.type_code, ligne.get(debut..debut + usize::from(c.taille).min(16))?));
            } else {
                let i = usize::from(c.var);
                let (a, b) = (*decalages.get(i)?, *decalages.get(i + 1)?);
                let brut = ligne.get(a..b)?;
                sortie.push(if c.type_code == 12 { self.memo(brut) } else { json!(texte(brut)) });
            }
        }
        Some(sortie)
    }

    /// Memo : en ligne, sur une page, ou en chaine de pages (chaque maillon commence par le suivant).
    fn memo(&self, ptr: &[u8]) -> Json {
        let lire = || -> Option<Vec<u8>> {
            let taille = (u32_(ptr, 0)? & 0x3FFF_FFFF) as usize;
            let drapeaux = *ptr.get(3)?;
            if taille > MEMO_MAX {
                return None;
            }
            if drapeaux & 0x80 != 0 {
                return Some(ptr.get(12..12 + taille.min(ptr.len().saturating_sub(12)))?.to_vec());
            }
            let (mut pg, mut r) = (u24_(ptr, 5)?, usize::from(*ptr.get(4)?));
            if drapeaux & 0x40 != 0 {
                return Some(self.ligne_a(pg, r)?.iter().copied().take(taille).collect());
            }
            let (mut octets, mut vus) = (Vec::new(), HashSet::new());
            while pg != 0 && octets.len() < taille {
                if !vus.insert((pg, r)) {
                    return None;
                }
                let l = self.ligne_a(pg, r)?;
                octets.extend_from_slice(l.get(4..)?);
                (pg, r) = (u24_(l, 1)?, usize::from(*l.first()?));
            }
            octets.truncate(taille);
            Some(octets)
        };
        lire().map_or(Json::Null, |o| json!(texte(&o)))
    }
}

fn decoder_fixe(type_code: u8, b: &[u8]) -> Json {
    let octets = |n: usize| -> Option<&[u8]> { b.get(..n) };
    let nombre = |v: f64| serde_json::Number::from_f64(v).map_or(Json::Null, Json::Number);
    (|| -> Option<Json> {
        Some(match type_code {
            2 => json!(*b.first()?),
            3 => json!(i16::from_le_bytes(octets(2)?.try_into().ok()?)),
            4 => json!(i32::from_le_bytes(octets(4)?.try_into().ok()?)),
            5 => {
                let v = i64::from_le_bytes(octets(8)?.try_into().ok()?);
                if v % 10_000 == 0 { json!(v / 10_000) } else { nombre(v as f64 / 10_000.0) }
            }
            6 => nombre(f32::from_le_bytes(octets(4)?.try_into().ok()?).to_string().parse().ok()?),
            7 => nombre(f64::from_le_bytes(octets(8)?.try_into().ok()?)),
            8 => json!(date_iso(f64::from_le_bytes(octets(8)?.try_into().ok()?))?),
            15 => {
                let g = octets(16)?;
                json!(format!(
                    "{{{:08X}-{:04X}-{:04X}-{}-{}}}",
                    u32::from_le_bytes(g[0..4].try_into().ok()?),
                    u16::from_le_bytes(g[4..6].try_into().ok()?),
                    u16::from_le_bytes(g[6..8].try_into().ok()?),
                    g[8..10].iter().map(|x| format!("{x:02X}")).collect::<String>(),
                    g[10..16].iter().map(|x| format!("{x:02X}")).collect::<String>()
                ))
            }
            19 => json!(i64::from_le_bytes(octets(8)?.try_into().ok()?)),
            _ => Json::Null,
        })
    })()
    .unwrap_or(Json::Null)
}

/// Date/heure Access (jours depuis le 30/12/1899, fraction = heure) en ISO 8601.
fn date_iso(jours: f64) -> Option<String> {
    if !jours.is_finite() || jours.abs() > 3_000_000.0 {
        return None;
    }
    let secondes = (jours.trunc() as i64).checked_mul(86_400)? + (jours.fract().abs() * 86_400.0).round() as i64; // la fraction d'une date negative reste positive (Access)
    let (j, s) = (secondes.div_euclid(86_400), secondes.rem_euclid(86_400));
    // Jours depuis 1970 -> date civile (algorithme de Hinnant) ; 25 569 jours separent 1899-12-30 de 1970-01-01.
    let z = j - 25_569 + 719_468;
    let (ere, jde) = (z.div_euclid(146_097), z.rem_euclid(146_097));
    let an_de_l_ere = (jde - jde / 1460 + jde / 36_524 - jde / 146_096) / 365;
    let jour_de_l_an = jde - (365 * an_de_l_ere + an_de_l_ere / 4 - an_de_l_ere / 100);
    let mp = (5 * jour_de_l_an + 2) / 153;
    let jour = jour_de_l_an - (153 * mp + 2) / 5 + 1;
    let mois = if mp < 10 { mp + 3 } else { mp - 9 };
    let an = an_de_l_ere + ere * 400 + i64::from(mois <= 2);
    Some(format!("{an:04}-{mois:02}-{jour:02}T{:02}:{:02}:{:02}", s / 3600, s / 60 % 60, s % 60))
}

/// Texte Jet 4 : UTF-16LE, ou « Unicode compresse » (FF FE puis octets Latin-1, 0x00 bascule en UTF-16).
fn texte(b: &[u8]) -> String {
    let utf16 = |o: &[u8]| String::from_utf16_lossy(&o.chunks_exact(2).map(|p| u16::from_le_bytes([p[0], p[1]])).collect::<Vec<_>>());
    if !b.starts_with(&[0xFF, 0xFE]) {
        return utf16(b);
    }
    let (mut unites, mut compresse, mut i) = (Vec::<u16>::new(), true, 2);
    while i < b.len() {
        if b[i] == 0 {
            compresse = !compresse;
            i += 1;
        } else if compresse {
            unites.push(u16::from(b[i]));
            i += 1;
        } else {
            let Some(u) = u16_(b, i) else { break };
            unites.push(u);
            i += 2;
        }
    }
    String::from_utf16_lossy(&unites)
}

/// Tables utilisateur d'un fichier Access (catalogue + lignes).
pub fn lire_tables(octets: &[u8]) -> Resultat<Vec<TableAccess>> {
    lire(octets, None)
}

/// Comme `lire_tables` mais ne charge les lignes que des tables nommees (comparaison sans casse).
pub fn lire_tables_choisies(octets: &[u8], noms: &[String]) -> Resultat<Vec<TableAccess>> {
    lire(octets, Some(noms))
}

fn lire(octets: &[u8], noms: Option<&[String]>) -> Resultat<Vec<TableAccess>> {
    let entete = octets.get(..0x18).ok_or_else(|| ErreurBase::msg("Fichier trop court : ce n'est pas une base Access."))?;
    if &entete[4..19] != b"Standard Jet DB" && &entete[4..19] != b"Standard ACE DB" {
        return Err(ErreurBase::msg("Ce fichier n'est pas une base Access (.mdb ou .accdb)."));
    }
    if entete[0x14] == 0 {
        return Err(ErreurBase::msg("Base Access 97 (Jet 3) non prise en charge : enregistrez-la au format 2000 ou plus récent, puis réessayez."));
    }
    let f = Fichier(octets);
    let illisible = || ErreurBase::msg("Catalogue Access illisible (fichier abîmé, chiffré ou protégé par mot de passe ?).");
    let catalogue = f.definition(2).ok_or_else(illisible)?;
    let mut ignorees = 0;
    let lignes = f.lignes(2, &catalogue, &mut ignorees);
    let col = |nom: &str| catalogue.colonnes.iter().position(|c| c.nom == nom).ok_or_else(illisible);
    let (i_id, i_nom, i_type, i_drap) = (col("Id")?, col("Name")?, col("Type")?, col("Flags")?);
    let mut tables = Vec::new();
    for l in lignes {
        let (Some(id), Some(nom), Some(genre), drapeaux) = (l[i_id].as_i64(), l[i_nom].as_str(), l[i_type].as_i64(), l[i_drap].as_i64().unwrap_or(0)) else { continue };
        // Type 1 = table locale ; les tables systeme (MSys*, ~TMP*, drapeaux 0x80000002) sont ignorees.
        if genre != 1 || nom.starts_with("MSys") || nom.starts_with('~') || (drapeaux as u32) & 0x8000_0002 != 0 {
            continue;
        }
        if tables.len() >= TABLES_MAX {
            break;
        }
        let pg = (id & 0x00FF_FFFF) as usize;
        let Some(def) = f.definition(pg) else { continue };
        let voulue = noms.is_none_or(|n| n.iter().any(|x| x.eq_ignore_ascii_case(nom)));
        let mut ignorees = 0;
        let lignes = if voulue { f.lignes(pg, &def, &mut ignorees) } else { Vec::new() };
        tables.push(TableAccess { nom: nom.to_string(), colonnes: def.colonnes, lignes, ignorees });
    }
    tables.sort_by_key(|t| t.nom.to_lowercase());
    Ok(tables)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn erreur(octets: &[u8]) -> String {
        lire_tables(octets).err().map(|e| e.to_string()).unwrap_or_default()
    }

    #[test]
    fn dates_access_en_iso() {
        assert_eq!(date_iso(0.0).as_deref(), Some("1899-12-30T00:00:00"));
        assert_eq!(date_iso(25_569.0).as_deref(), Some("1970-01-01T00:00:00"));
        assert_eq!(date_iso(45_366.604_166_666_664).as_deref(), Some("2024-03-15T14:30:00"));
        assert_eq!(date_iso(-1.5).as_deref(), Some("1899-12-29T12:00:00"));
        assert_eq!(date_iso(f64::NAN), None);
    }

    #[test]
    fn texte_unicode_compresse() {
        assert_eq!(texte(&[0xFF, 0xFE, b'a', b'b', 0xE9]), "abé");
        assert_eq!(texte(&[b'h', 0, b'i', 0]), "hi");
        // Bascule en UTF-16 puis retour en compresse.
        assert_eq!(texte(&[0xFF, 0xFE, b'a', 0, 0xAC, 0x20, 0, b'b']), "a€b");
    }

    #[test]
    fn fichier_invalide_ou_jet3_refuse() {
        assert!(lire_tables(b"abc").is_err());
        assert!(erreur(&[0u8; 8192]).contains("pas une base Access"));
        let mut v = vec![0u8; 8192];
        v[4..19].copy_from_slice(b"Standard Jet DB");
        assert!(erreur(&v).contains("Access 97"));
        v[0x14] = 1;
        assert!(erreur(&v).contains("illisible"));
    }
}
