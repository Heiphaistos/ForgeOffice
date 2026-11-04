//! Lecture et ecriture CSV (RFC 4180) : separateurs `;` `,` tabulation `|`, guillemets,
//! retours a la ligne dans les champs, encodages UTF-8 (BOM), UTF-16 (export Excel « Unicode »)
//! et Windows-1252, decimale francaise, protection contre l'injection de formules.

use serde::{Deserialize, Serialize};

/// Taille maximale d'un fichier importe (512 Mio).
pub const TAILLE_MAX: usize = 512 * 1024 * 1024;

/// Options d'ecriture CSV.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(default)]
pub struct OptionsExport {
    /// Separateur de champs (defaut `;`, usage francais).
    pub separateur: char,
    /// Separateur decimal des nombres (`,` ou `.`).
    pub decimale: char,
    /// Ligne d'en-tete avec les noms de champs.
    pub entete: bool,
    /// Marque d'ordre d'octets UTF-8 (pour Excel).
    pub bom: bool,
    /// Dates au format francais `JJ/MM/AAAA` (sinon ISO).
    pub dates_francaises: bool,
    /// Booleens en `Oui`/`Non` (sinon `1`/`0`).
    pub oui_non: bool,
    /// Prefixer d'une apostrophe les textes commencant par `= + - @` (protection tableur).
    pub proteger_formules: bool,
    /// Fin de ligne CRLF (sinon LF).
    pub crlf: bool,
}

impl Default for OptionsExport {
    fn default() -> Self {
        Self {
            separateur: ';',
            decimale: ',',
            entete: true,
            bom: true,
            dates_francaises: true,
            oui_non: true,
            proteger_formules: true,
            crlf: true,
        }
    }
}

/// Decode des octets : BOM UTF-8/UTF-16, sinon UTF-8, sinon Windows-1252.
pub fn decoder(octets: &[u8]) -> String {
    if let Some(reste) = octets.strip_prefix(&[0xEF, 0xBB, 0xBF]) {
        return String::from_utf8_lossy(reste).into_owned();
    }
    if let Some(reste) = octets.strip_prefix(&[0xFF, 0xFE]) {
        let unites: Vec<u16> = reste.chunks_exact(2).map(|p| u16::from_le_bytes([p[0], p[1]])).collect();
        return String::from_utf16_lossy(&unites);
    }
    if let Some(reste) = octets.strip_prefix(&[0xFE, 0xFF]) {
        let unites: Vec<u16> = reste.chunks_exact(2).map(|p| u16::from_be_bytes([p[0], p[1]])).collect();
        return String::from_utf16_lossy(&unites);
    }
    match std::str::from_utf8(octets) {
        Ok(t) => t.to_string(),
        Err(_) => octets.iter().map(|&b| windows_1252(b)).collect(),
    }
}

fn windows_1252(b: u8) -> char {
    const HAUT: [char; 32] = [
        '€', '\u{81}', '‚', 'ƒ', '„', '…', '†', '‡', 'ˆ', '‰', 'Š', '‹', 'Œ', '\u{8d}', 'Ž', '\u{8f}',
        '\u{90}', '‘', '’', '“', '”', '•', '–', '—', '˜', '™', 'š', '›', 'œ', '\u{9d}', 'ž', 'Ÿ',
    ];
    if (0x80..0xA0).contains(&b) {
        HAUT[usize::from(b - 0x80)]
    } else {
        char::from(b)
    }
}

/// Devine le separateur sur les premieres lignes (hors guillemets) : `;`, tabulation, `,`, `|`.
pub fn deviner_separateur(texte: &str) -> char {
    let candidats = [';', '\t', ',', '|'];
    let mut comptes = [0usize; 4];
    let mut dans = false;
    let mut lignes = 0;
    for c in texte.chars() {
        match c {
            '"' => dans = !dans,
            '\n' if !dans => {
                lignes += 1;
                if lignes >= 20 {
                    break;
                }
            }
            _ if !dans => {
                if let Some(i) = candidats.iter().position(|&x| x == c) {
                    comptes[i] += 1;
                }
            }
            _ => {}
        }
    }
    let mut meilleur = 0;
    for i in 1..4 {
        if comptes[i] > comptes[meilleur] {
            meilleur = i;
        }
    }
    if comptes[meilleur] == 0 { ';' } else { candidats[meilleur] }
}

/// Analyse un texte CSV en lignes de champs.
pub fn analyser(texte: &str, separateur: char) -> Vec<Vec<String>> {
    let texte = texte.trim_start_matches('\u{feff}');
    let mut lignes = Vec::new();
    let mut ligne = Vec::new();
    let mut champ = String::new();
    let mut guillemets = false;
    let mut c = texte.chars().peekable();
    while let Some(x) = c.next() {
        if guillemets {
            if x == '"' {
                if c.peek() == Some(&'"') {
                    c.next();
                    champ.push('"');
                } else {
                    guillemets = false;
                }
            } else {
                champ.push(x);
            }
        } else if x == '"' && champ.trim().is_empty() {
            champ.clear();
            guillemets = true;
        } else if x == separateur {
            ligne.push(std::mem::take(&mut champ));
        } else if x == '\n' || x == '\r' {
            if x == '\r' && c.peek() == Some(&'\n') {
                c.next();
            }
            ligne.push(std::mem::take(&mut champ));
            lignes.push(std::mem::take(&mut ligne));
        } else {
            champ.push(x);
        }
    }
    if !champ.is_empty() || !ligne.is_empty() {
        ligne.push(champ);
        lignes.push(ligne);
    }
    lignes
}

/// Ecrit une cellule CSV echappee.
pub fn cellule(texte: &str, o: &OptionsExport, est_texte: bool) -> String {
    let mut t = texte.to_string();
    if o.proteger_formules && est_texte && t.starts_with(['=', '+', '-', '@', '\t', '\r']) {
        t.insert(0, '\'');
    }
    if t.contains(o.separateur) || t.contains(['"', '\n', '\r']) || t.starts_with(' ') || t.ends_with(' ') {
        format!("\"{}\"", t.replace('"', "\"\""))
    } else {
        t
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn analyse_guillemets_et_retours() {
        let t = "Nom;Note\r\n\"Dupont; Jean\";\"Il a dit \"\"oui\"\"\nsur deux lignes\"\r\nX;\n";
        let l = analyser(t, ';');
        assert_eq!(l.len(), 3);
        assert_eq!(l[1][0], "Dupont; Jean");
        assert_eq!(l[1][1], "Il a dit \"oui\"\nsur deux lignes");
        assert_eq!(l[2], vec!["X", ""]);
    }

    #[test]
    fn separateurs_et_encodages() {
        assert_eq!(deviner_separateur("a\tb\tc\n1\t2\t3"), '\t');
        assert_eq!(deviner_separateur("a,b;c\n1,2;3,4"), ',');
        assert_eq!(decoder(&[0xC9, 0x74, 0xE9, 0x80]), "Été€");
        assert_eq!(decoder(&[0xFF, 0xFE, 0x41, 0x00, 0xE9, 0x00]), "Aé");
    }

    #[test]
    fn cellules_protegees() {
        let o = OptionsExport::default();
        assert_eq!(cellule("=1+1", &o, true), "'=1+1");
        assert_eq!(cellule("-5", &o, false), "-5");
        assert_eq!(cellule("a;b", &o, true), "\"a;b\"");
    }
}
