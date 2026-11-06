//! Decodage du texte d'une police PDF : decoupage des chaines en codes (longueur variable
//! selon les /codespacerange d'une CMap), conversion en Unicode par la table /ToUnicode, a
//! defaut par l'encodage simple (WinAnsi, MacRoman, Standard + /Differences).
//! Sert au caviardage : largeur exacte des codes, et texte RETIRE connu chaine par chaine
//! (pour vider les signets, champs et structures qui le reprennent).

use super::nombre;
use lopdf::content::Content;
use lopdf::{Dictionary, Document, Object};
use std::collections::HashMap;

/// Entrees maximales lues dans une CMap (anti-bombe).
const MAX_ENTREES: usize = 200_000;
const MAX_PLAGE: u32 = 65_536;
const PROFONDEUR_MAX: u32 = 8;

/// Plage de codes : (longueur en octets, premier code, dernier code).
type Plage = (usize, u32, u32);

/// Police decodable : longueurs de codes et table Unicode.
#[derive(Default, Clone)]
pub(super) struct Decodeur {
    plages: Vec<Plage>,
    /// Longueur par defaut quand aucune plage ne correspond (1 : police simple, 2 : Type0).
    defaut: usize,
    unicode: HashMap<u32, String>,
}

impl Decodeur {
    /// Decodeur de la police `f` (dictionnaire de police du document).
    pub fn depuis_police(doc: &Document, f: &Dictionary) -> Self {
        let deref = |o: &Object| doc.dereference(o).map(|(_, x)| x.clone()).unwrap_or_else(|_| o.clone());
        let sous_type = f.get(b"Subtype").ok().map(deref).and_then(|o| o.as_name().ok().map(<[u8]>::to_vec)).unwrap_or_default();
        let mut d = Decodeur { defaut: 1, ..Default::default() };
        let enc = f.get(b"Encoding").ok().map(deref);
        if sous_type == b"Type0" {
            d.defaut = 2;
            if let Some(Object::Stream(s)) = &enc {
                let (cs, _) = lire_cmap(&s.decompressed_content().unwrap_or_default());
                d.plages = cs;
            }
        } else {
            d.table_simple(enc.as_ref());
        }
        if let Some(Object::Stream(s)) = f.get(b"ToUnicode").ok().map(deref) {
            let (cs, tab) = lire_cmap(&s.decompressed_content().unwrap_or_default());
            if d.plages.is_empty() {
                d.plages = cs;
            }
            d.unicode.extend(tab);
        }
        d
    }

    /// Table d'une police simple : encodage de base puis /Differences.
    fn table_simple(&mut self, enc: Option<&Object>) {
        let (mut base, mut diffs): (&[u8], Option<Vec<Object>>) = (b"WinAnsiEncoding", None);
        match enc {
            Some(Object::Name(n)) => base = if n.as_slice() == b"MacRomanEncoding" { b"MacRomanEncoding" } else { b"WinAnsiEncoding" },
            Some(Object::Dictionary(d)) => {
                if d.get(b"BaseEncoding").and_then(Object::as_name).is_ok_and(|n| n == b"MacRomanEncoding") {
                    base = b"MacRomanEncoding";
                }
                diffs = d.get(b"Differences").and_then(Object::as_array).ok().cloned();
            }
            _ => {}
        }
        for c in 32u32..=255 {
            let ch = if base == b"MacRomanEncoding" { macroman(c as u8) } else { winansi_vers_char(c as u8) };
            if let Some(ch) = ch {
                self.unicode.insert(c, ch.to_string());
            }
        }
        let mut code = 0u32;
        for o in diffs.iter().flatten().take(MAX_ENTREES) {
            match o {
                Object::Integer(i) => code = (*i).max(0) as u32,
                Object::Name(n) => {
                    if let Some(ch) = nom_glyphe(&String::from_utf8_lossy(n)) {
                        self.unicode.insert(code, ch.to_string());
                    }
                    code = code.saturating_add(1);
                }
                _ => {}
            }
        }
    }

    /// Decoupe une chaine en (code, octets) ; chaque element consomme au moins un octet.
    pub fn decouper<'a>(&self, octets: &'a [u8]) -> Vec<(u32, &'a [u8])> {
        let mut res = Vec::new();
        let mut i = 0;
        while i < octets.len() {
            let mut pris = None;
            for len in 1..=4.min(octets.len() - i) {
                let code = octets[i..i + len].iter().fold(0u32, |a, &b| (a << 8) | u32::from(b));
                if self.plages.iter().any(|&(l, lo, hi)| l == len && (lo..=hi).contains(&code)) {
                    pris = Some((len, code));
                    break;
                }
            }
            let (len, code) = pris.unwrap_or_else(|| {
                let len = self.defaut.max(1).min(octets.len() - i);
                (len, octets[i..i + len].iter().fold(0u32, |a, &b| (a << 8) | u32::from(b)))
            });
            res.push((code, &octets[i..i + len]));
            i += len;
        }
        res
    }

    /// Texte Unicode d'un code (vide si inconnu).
    pub fn texte(&self, code: u32) -> &str {
        self.unicode.get(&code).map_or("", String::as_str)
    }
}

fn winansi_vers_char(c: u8) -> Option<char> {
    const HAUT: [(u8, char); 27] = [
        (0x80, '€'), (0x82, '‚'), (0x83, 'ƒ'), (0x84, '„'), (0x85, '…'), (0x86, '†'), (0x87, '‡'), (0x88, 'ˆ'),
        (0x89, '‰'), (0x8A, 'Š'), (0x8B, '‹'), (0x8C, 'Œ'), (0x8E, 'Ž'), (0x91, '‘'), (0x92, '’'), (0x93, '“'),
        (0x94, '”'), (0x95, '•'), (0x96, '–'), (0x97, '—'), (0x98, '˜'), (0x99, '™'), (0x9A, 'š'), (0x9B, '›'),
        (0x9C, 'œ'), (0x9E, 'ž'), (0x9F, 'Ÿ'),
    ];
    match c {
        0x20..=0x7E | 0xA0..=0xFF => char::from_u32(u32::from(c)),
        0x80..=0x9F => HAUT.iter().find(|(k, _)| *k == c).map(|&(_, ch)| ch),
        _ => None,
    }
}

fn macroman(c: u8) -> Option<char> {
    const HAUT: &str = "ÄÅÇÉÑÖÜáàâäãåçéèêëíìîïñóòôöõúùûü†°¢£§•¶ß®©™´¨≠ÆØ∞±≤≥¥µ∂∑∏π∫ªºΩæø¿¡¬√ƒ≈∆«»… ÀÃÕŒœ–—“”‘’÷◊ÿŸ⁄€‹›ﬁﬂ‡·‚„‰ÂÊÁËÈÍÎÏÌÓÔ\u{F8FF}ÒÚÛÙıˆ˜¯˘˙˚¸˝˛ˇ";
    match c {
        0x20..=0x7E => char::from_u32(u32::from(c)),
        0x80..=0xFF => HAUT.chars().nth(usize::from(c) - 0x80),
        _ => None,
    }
}

/// Caractere d'un nom de glyphe Adobe courant (latin) ou `uniXXXX` / `uXXXX`.
fn nom_glyphe(nom: &str) -> Option<char> {
    const NOMS: &[(&str, char)] = &[
        ("space", ' '), ("exclam", '!'), ("quotedbl", '"'), ("numbersign", '#'), ("dollar", '$'), ("percent", '%'),
        ("ampersand", '&'), ("quotesingle", '\''), ("parenleft", '('), ("parenright", ')'), ("asterisk", '*'),
        ("plus", '+'), ("comma", ','), ("hyphen", '-'), ("minus", '−'), ("period", '.'), ("slash", '/'), ("zero", '0'),
        ("one", '1'), ("two", '2'), ("three", '3'), ("four", '4'), ("five", '5'), ("six", '6'), ("seven", '7'),
        ("eight", '8'), ("nine", '9'), ("colon", ':'), ("semicolon", ';'), ("less", '<'), ("equal", '='),
        ("greater", '>'), ("question", '?'), ("at", '@'), ("bracketleft", '['), ("backslash", '\\'),
        ("bracketright", ']'), ("asciicircum", '^'), ("underscore", '_'), ("grave", '`'), ("braceleft", '{'),
        ("bar", '|'), ("braceright", '}'), ("asciitilde", '~'), ("endash", '–'), ("emdash", '—'),
        ("quoteleft", '‘'), ("quoteright", '’'), ("quotedblleft", '“'), ("quotedblright", '”'), ("bullet", '•'),
        ("ellipsis", '…'), ("Euro", '€'), ("fi", 'ﬁ'), ("fl", 'ﬂ'), ("degree", '°'), ("plusminus", '±'),
        ("multiply", '×'), ("divide", '÷'), ("section", '§'), ("copyright", '©'), ("registered", '®'),
        ("trademark", '™'), ("guillemotleft", '«'), ("guillemotright", '»'), ("exclamdown", '¡'),
        ("questiondown", '¿'), ("germandbls", 'ß'), ("ae", 'æ'), ("AE", 'Æ'), ("oe", 'œ'), ("OE", 'Œ'),
        ("oslash", 'ø'), ("Oslash", 'Ø'), ("aring", 'å'), ("Aring", 'Å'), ("ccedilla", 'ç'), ("Ccedilla", 'Ç'),
        ("ntilde", 'ñ'), ("Ntilde", 'Ñ'), ("eacute", 'é'), ("egrave", 'è'), ("ecircumflex", 'ê'), ("edieresis", 'ë'),
        ("agrave", 'à'), ("acircumflex", 'â'), ("adieresis", 'ä'), ("atilde", 'ã'), ("aacute", 'á'), ("iacute", 'í'),
        ("igrave", 'ì'), ("icircumflex", 'î'), ("idieresis", 'ï'), ("oacute", 'ó'), ("ograve", 'ò'),
        ("ocircumflex", 'ô'), ("odieresis", 'ö'), ("otilde", 'õ'), ("uacute", 'ú'), ("ugrave", 'ù'),
        ("ucircumflex", 'û'), ("udieresis", 'ü'), ("yacute", 'ý'), ("ydieresis", 'ÿ'), ("Eacute", 'É'),
        ("Egrave", 'È'), ("Ecircumflex", 'Ê'), ("Edieresis", 'Ë'), ("Agrave", 'À'), ("Acircumflex", 'Â'),
        ("Adieresis", 'Ä'), ("Atilde", 'Ã'), ("Aacute", 'Á'), ("Iacute", 'Í'), ("Icircumflex", 'Î'),
        ("Idieresis", 'Ï'), ("Oacute", 'Ó'), ("Ocircumflex", 'Ô'), ("Odieresis", 'Ö'), ("Uacute", 'Ú'),
        ("Ugrave", 'Ù'), ("Ucircumflex", 'Û'), ("Udieresis", 'Ü'),
    ];
    if let Some(&(_, c)) = NOMS.iter().find(|(n, _)| *n == nom) {
        return Some(c);
    }
    let mut it = nom.chars();
    if let (Some(c), None) = (it.next(), it.next()) {
        if c.is_ascii_alphabetic() {
            return Some(c);
        }
    }
    let hex = nom.strip_prefix("uni").filter(|h| h.len() == 4).or_else(|| nom.strip_prefix('u').filter(|h| (4..=6).contains(&h.len())))?;
    char::from_u32(u32::from_str_radix(hex, 16).ok()?)
}

// ── CMap ──────────────────────────────────────────────────────────────────────

enum Jeton {
    Hex(Vec<u8>),
    Mot(String),
    Ouvre,
    Ferme,
}

fn jetons(d: &[u8]) -> Vec<Jeton> {
    let mut res = Vec::new();
    let mut i = 0;
    while i < d.len() && res.len() < MAX_ENTREES * 4 {
        match d[i] {
            b'<' if d.get(i + 1) != Some(&b'<') => {
                let fin = d[i..].iter().position(|&c| c == b'>').map_or(d.len(), |p| i + p);
                let h: Vec<u8> = d[i + 1..fin].iter().filter(|c| c.is_ascii_hexdigit()).copied().collect();
                let octets = h.chunks(2).map(|p| u8::from_str_radix(&String::from_utf8_lossy(p), 16).unwrap_or(0) << if p.len() == 1 { 4 } else { 0 }).collect();
                res.push(Jeton::Hex(octets));
                i = fin + 1;
            }
            b'[' => {
                res.push(Jeton::Ouvre);
                i += 1;
            }
            b']' => {
                res.push(Jeton::Ferme);
                i += 1;
            }
            c if c.is_ascii_whitespace() => i += 1,
            _ => {
                let fin = d[i..].iter().position(|&c| c.is_ascii_whitespace() || matches!(c, b'<' | b'[' | b']')).map_or(d.len(), |p| i + p);
                res.push(Jeton::Mot(String::from_utf8_lossy(&d[i..fin.max(i + 1)]).into_owned()));
                i = fin.max(i + 1);
            }
        }
    }
    res
}

fn valeur(o: &[u8]) -> u32 {
    o.iter().take(4).fold(0u32, |a, &b| (a << 8) | u32::from(b))
}

fn utf16(o: &[u8]) -> String {
    String::from_utf16_lossy(&o.chunks_exact(2).map(|p| u16::from_be_bytes([p[0], p[1]])).collect::<Vec<_>>())
}

/// Lit une CMap : plages de codes (longueur, lo, hi) et table code -> texte (bfchar, bfrange).
fn lire_cmap(d: &[u8]) -> (Vec<Plage>, HashMap<u32, String>) {
    let (mut plages, mut table) = (Vec::new(), HashMap::new());
    let t = jetons(d);
    let mut i = 0;
    while i < t.len() {
        let section = match &t[i] {
            Jeton::Mot(m) if matches!(m.as_str(), "begincodespacerange" | "beginbfchar" | "beginbfrange") => m.as_str(),
            _ => {
                i += 1;
                continue;
            }
        };
        i += 1;
        while i < t.len() && table.len() < MAX_ENTREES {
            match (section, &t[i], t.get(i + 1), t.get(i + 2)) {
                ("begincodespacerange", Jeton::Hex(a), Some(Jeton::Hex(b)), _) => {
                    plages.push((a.len().clamp(1, 4), valeur(a), valeur(b)));
                    i += 2;
                }
                ("beginbfchar", Jeton::Hex(a), Some(Jeton::Hex(b)), _) => {
                    table.insert(valeur(a), utf16(b));
                    i += 2;
                }
                ("beginbfrange", Jeton::Hex(a), Some(Jeton::Hex(b)), Some(Jeton::Hex(c))) => {
                    let (lo, hi) = (valeur(a), valeur(b).min(valeur(a).saturating_add(MAX_PLAGE)));
                    let base = utf16(c);
                    for (k, code) in (lo..=hi).enumerate() {
                        let mut s: Vec<char> = base.chars().collect();
                        if let Some(dernier) = s.last_mut() {
                            *dernier = char::from_u32(*dernier as u32 + k as u32).unwrap_or(*dernier);
                        }
                        table.insert(code, s.into_iter().collect());
                    }
                    i += 3;
                }
                ("beginbfrange", Jeton::Hex(a), Some(Jeton::Hex(_)), Some(Jeton::Ouvre)) => {
                    let lo = valeur(a);
                    i += 3;
                    let mut k = 0;
                    while let Some(Jeton::Hex(x)) = t.get(i) {
                        if k < MAX_PLAGE {
                            table.insert(lo + k, utf16(x));
                        }
                        k += 1;
                        i += 1;
                    }
                    i += 1; // ]
                }
                (_, Jeton::Mot(fin), _, _) if fin.starts_with("end") => {
                    i += 1;
                    break;
                }
                _ => i += 1,
            }
        }
    }
    (plages, table)
}

// ── Texte d'une page ─────────────────────────────────────────────────────────

fn police_de(doc: &Document, res: &Dictionary, nom: &[u8]) -> Decodeur {
    let f = res
        .get(b"Font")
        .ok()
        .and_then(|o| doc.dereference(o).ok())
        .and_then(|(_, o)| o.as_dict().ok())
        .and_then(|d| d.get(nom).ok())
        .and_then(|o| doc.dereference(o).ok())
        .and_then(|(_, o)| o.as_dict().ok());
    f.map(|f| Decodeur::depuis_police(doc, f)).unwrap_or(Decodeur { defaut: 1, ..Default::default() })
}

/// Texte decode d'un flux de contenu (formes XObject suivies), mots separes par des espaces.
pub(super) fn texte_contenu(doc: &Document, contenu: &[u8], res: &Dictionary, prof: u32, sortie: &mut String) {
    let Ok(ops) = Content::decode(contenu) else { return };
    let mut polices: HashMap<Vec<u8>, Decodeur> = HashMap::new();
    let mut courante = Vec::new();
    for op in ops.operations {
        let mut montrer = |objs: &[Object], sortie: &mut String| {
            let dec = polices.entry(courante.clone()).or_insert_with(|| police_de(doc, res, &courante));
            for o in objs {
                match o {
                    Object::String(b, _) => dec.decouper(b).iter().for_each(|&(c, _)| sortie.push_str(dec.texte(c))),
                    n if nombre(n) < -200.0 => sortie.push(' '),
                    _ => {}
                }
            }
        };
        match op.operator.as_str() {
            "Tf" => courante = op.operands.first().and_then(|o| o.as_name().ok()).map(<[u8]>::to_vec).unwrap_or_default(),
            "Tj" => montrer(&op.operands, sortie),
            "'" | "\"" => {
                sortie.push(' ');
                montrer(&op.operands[op.operands.len().saturating_sub(1)..], sortie);
            }
            "TJ" => {
                if let Some(Object::Array(a)) = op.operands.first() {
                    montrer(a, sortie);
                }
            }
            "Td" | "TD" | "Tm" | "T*" | "ET" => sortie.push(' '),
            "Do" if prof < PROFONDEUR_MAX => {
                let nom = op.operands.first().and_then(|o| o.as_name().ok()).unwrap_or_default();
                let xo = res.get(b"XObject").ok().and_then(|o| doc.dereference(o).ok()).and_then(|(_, o)| o.as_dict().ok());
                let flux = xo.and_then(|x| x.get(nom).ok()).and_then(|o| doc.dereference(o).ok()).and_then(|(_, o)| o.as_stream().ok());
                if let Some(s) = flux.filter(|s| s.dict.get(b"Subtype").and_then(Object::as_name).is_ok_and(|n| n == b"Form")) {
                    let res_f = s.dict.get(b"Resources").ok().and_then(|o| doc.dereference(o).ok()).and_then(|(_, o)| o.as_dict().ok()).unwrap_or(res);
                    texte_contenu(doc, &s.decompressed_content().unwrap_or_default(), res_f, prof + 1, sortie);
                    sortie.push(' ');
                }
            }
            _ => {}
        }
    }
}

/// Texte decode d'une page par notre propre lecteur (complete `Document::extract_text`).
pub(super) fn texte_page(doc: &Document, page: lopdf::ObjectId) -> String {
    let mut sortie = String::new();
    let res = super::herite(doc, page, b"Resources").and_then(|o| doc.dereference(&o).ok().and_then(|(_, o)| o.as_dict().ok().cloned())).unwrap_or_default();
    if let Ok(contenu) = doc.get_page_content(page) {
        texte_contenu(doc, &contenu, &res, 0, &mut sortie);
    }
    sortie
}

#[cfg(test)]
mod tests {
    use super::*;
    use lopdf::dictionary;

    #[test]
    fn macroman_a_128_caracteres() {
        assert_eq!(macroman(0x8E), Some('é'));
        assert_eq!(macroman(0xFF), Some('ˇ'));
        assert!((0x80u8..=0xFF).all(|c| macroman(c).is_some()));
    }

    #[test]
    fn cmap_lit_bfchar_bfrange_et_codespace() {
        let cmap = b"/CIDInit begincmap 2 begincodespacerange <00> <7F> <8140> <9FFC> endcodespacerange \
            1 beginbfchar <01> <0041> endbfchar 2 beginbfrange <10> <12> <0061> <20> <21> [<00e9> <00e8>] endbfrange endcmap";
        let (plages, t) = lire_cmap(cmap);
        assert_eq!(plages, vec![(1, 0, 0x7F), (2, 0x8140, 0x9FFC)]);
        assert_eq!(t[&1], "A");
        assert_eq!((t[&0x10].as_str(), t[&0x12].as_str()), ("a", "c"));
        assert_eq!((t[&0x20].as_str(), t[&0x21].as_str()), ("é", "è"));
        let d = Decodeur { plages, defaut: 1, unicode: t };
        let morceaux = d.decouper(&[0x01, 0x81, 0x40, 0x10]);
        assert_eq!(morceaux.iter().map(|m| m.1.len()).collect::<Vec<_>>(), vec![1, 2, 1]);
    }

    fn decoder(doc: &Document, f: &Dictionary, octets: &[u8]) -> String {
        let d = Decodeur::depuis_police(doc, f);
        d.decouper(octets).iter().map(|&(c, _)| d.texte(c)).collect()
    }

    #[test]
    fn police_simple_avec_differences() {
        let doc = Document::with_version("1.7");
        let f = dictionary! {
            "Type" => "Font", "Subtype" => "Type1", "BaseFont" => "Helvetica",
            "Encoding" => dictionary! { "Type" => "Encoding", "BaseEncoding" => "WinAnsiEncoding",
                "Differences" => vec![65.into(), Object::Name(b"eacute".to_vec()), Object::Name(b"agrave".to_vec()), 97.into(), Object::Name(b"uni20AC".to_vec())] },
        };
        assert_eq!(decoder(&doc, &f, b"ABa Z"), "éà€ Z");
        let mac = dictionary! { "Subtype" => "TrueType", "Encoding" => "MacRomanEncoding" };
        assert_eq!(decoder(&doc, &mac, &[0x8E, b'x']), "éx");
    }

    #[test]
    fn type0_avec_tounicode_et_codes_mixtes() {
        let mut doc = Document::with_version("1.7");
        let cmap = b"begincodespacerange <00> <7F> <8000> <FFFF> endcodespacerange beginbfchar <41> <0058> <8001> <00e9> endbfchar";
        let tu = doc.add_object(lopdf::Stream::new(dictionary! {}, cmap.to_vec()));
        let f = dictionary! { "Type" => "Font", "Subtype" => "Type0", "Encoding" => "Identity-H", "ToUnicode" => tu };
        let d = Decodeur::depuis_police(&doc, &f);
        // A (1 octet), puis 0x8001 (2 octets), puis A.
        let morceaux = d.decouper(&[0x41, 0x80, 0x01, 0x41]);
        assert_eq!(morceaux.len(), 3);
        assert_eq!(decoder(&doc, &f, &[0x41, 0x80, 0x01, 0x41]), "XéX");
    }

    #[test]
    fn noms_de_glyphes() {
        assert_eq!(nom_glyphe("eacute"), Some('é'));
        assert_eq!(nom_glyphe("uni20AC"), Some('€'));
        assert_eq!(nom_glyphe("B"), Some('B'));
        assert_eq!(nom_glyphe("g123"), None);
    }
}
