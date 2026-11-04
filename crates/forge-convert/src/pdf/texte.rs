//! Texte : extraction (pur Rust, repli pdftotext), creation de PDF a partir de
//! texte, comparaison de deux PDF.

use super::{chaine, charger, enregistrer, police_standard, winansi};
use crate::erreur::{ConvertError, Resultat};
use crate::outils::{executer, Outil};
use lopdf::content::{Content, Operation};
use lopdf::{dictionary, Document, Object, Stream};
use serde::{Deserialize, Serialize};

/// Texte d'une page.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TextePage {
    pub page: u32,
    pub texte: String,
}

/// Extraction pur Rust (lopdf decode les encodages et les tables ToUnicode).
pub fn extraire_pages(doc: &Document) -> Vec<TextePage> {
    doc.get_pages()
        .keys()
        .map(|&n| {
            let texte = doc.extract_text(&[n]).unwrap_or_default();
            TextePage { page: n, texte: texte.trim().to_string() }
        })
        .collect()
}

/// Texte complet avec separateurs de page. Si aucun texte n'est trouve en Rust,
/// essaie pdftotext (Poppler) s'il est installe ; sinon erreur explicite.
pub fn extraire(octets: &[u8], mdp: Option<&str>) -> Resultat<String> {
    let doc = charger(octets, mdp)?;
    let pages = extraire_pages(&doc);
    if pages.iter().any(|p| !p.texte.is_empty()) {
        return Ok(assembler(&pages));
    }
    if mdp.is_none() {
        if let Some(t) = pdftotext(octets)? {
            return Ok(t);
        }
    }
    Err(ConvertError::Echec(
        "aucun texte extractible : le PDF est sans doute scanné (images). Lancez d'abord l'OCR.".into(),
    ))
}

/// Assemble les pages en un texte « --- Page N --- ».
pub fn assembler(pages: &[TextePage]) -> String {
    let mut s = String::new();
    for p in pages.iter().filter(|p| !p.texte.is_empty()) {
        s.push_str(&format!("--- Page {} ---\n{}\n\n", p.page, p.texte));
    }
    s
}

fn pdftotext(octets: &[u8]) -> Resultat<Option<String>> {
    let Some(exe) = Outil::Pdftotext.trouver() else { return Ok(None) };
    let tmp = crate::fichiers::DossierTemp::nouveau()?;
    let (e, s) = (tmp.fichier("entree.pdf"), tmp.fichier("sortie.txt"));
    std::fs::write(&e, octets).map_err(|x| ConvertError::Ecriture(x.to_string()))?;
    executer(
        Outil::Pdftotext,
        &exe,
        &["-layout".as_ref(), "-enc".as_ref(), "UTF-8".as_ref(), e.as_os_str(), s.as_os_str()],
        &[],
    )?;
    let brut = std::fs::read(&s).unwrap_or_default();
    let brut = String::from_utf8_lossy(&brut);
    let pages: Vec<TextePage> = brut
        .split('\u{000C}')
        .enumerate()
        .map(|(i, t)| TextePage { page: i as u32 + 1, texte: t.trim().to_string() })
        .collect();
    let t = assembler(&pages);
    Ok((!t.trim().is_empty()).then_some(t))
}

// ── Texte -> PDF ──────────────────────────────────────────────────────────────

const A4: (f32, f32) = (595.276, 841.89);
const MARGE: f32 = 51.0;
const TAILLE: f32 = 10.0;
const INTERLIGNE: f32 = 14.2;
const COLONNES: usize = 95;

/// Coupe le texte en lignes de `max` colonnes maximum (sur des espaces si possible).
pub fn couper(texte: &str, max: usize) -> Vec<String> {
    let mut res = Vec::new();
    for ligne in texte.lines() {
        let mut reste: Vec<char> = ligne.chars().collect();
        while reste.len() > max {
            let coupe = reste[..max].iter().rposition(|&c| c == ' ').filter(|&i| i > 0).unwrap_or(max);
            res.push(reste[..coupe].iter().collect());
            let suite: Vec<char> = reste[coupe..].iter().copied().skip_while(|&c| c == ' ').collect();
            reste = suite;
        }
        res.push(reste.into_iter().collect());
    }
    res
}

/// Construit un PDF A4 (Courier 10 pt, WinAnsi) a partir de texte brut.
pub fn texte_vers_pdf(texte: &str) -> Resultat<Vec<u8>> {
    let lignes = couper(texte, COLONNES);
    let par_page = ((A4.1 - 2.0 * MARGE) / INTERLIGNE) as usize;
    let blocs: Vec<Vec<String>> = if lignes.is_empty() {
        vec![Vec::new()]
    } else {
        lignes.chunks(par_page).map(<[String]>::to_vec).collect()
    };
    let pages: Vec<Vec<(f32, f32, String)>> = blocs
        .into_iter()
        .map(|b| {
            b.into_iter()
                .enumerate()
                .map(|(i, l)| (MARGE, A4.1 - MARGE - TAILLE - i as f32 * INTERLIGNE, l))
                .collect()
        })
        .collect();
    let mut doc = document_texte(&pages, "Courier", TAILLE, A4)?;
    enregistrer(&mut doc)
}

/// Document neuf : une page par element, chaque ligne posee en (x, y) en points.
/// Sert aux conversions et aux tests (PDF generes).
pub fn document_texte(
    pages: &[Vec<(f32, f32, String)>],
    police: &str,
    taille: f32,
    format: (f32, f32),
) -> Resultat<Document> {
    let mut doc = Document::with_version("1.7");
    let id_pages = doc.new_object_id();
    let id_police = police_standard(&mut doc, police);
    let mut enfants = Vec::new();
    for lignes in pages {
        let mut ops = Vec::new();
        for (x, y, t) in lignes {
            ops.push(Operation::new("BT", vec![]));
            ops.push(Operation::new("Tf", vec!["F1".into(), taille.into()]));
            ops.push(Operation::new("Td", vec![(*x).into(), (*y).into()]));
            ops.push(Operation::new("Tj", vec![chaine(winansi(t))]));
            ops.push(Operation::new("ET", vec![]));
        }
        let flux = doc.add_object(Stream::new(dictionary! {}, Content { operations: ops }.encode()?));
        let page = doc.add_object(dictionary! {
            "Type" => "Page",
            "Parent" => id_pages,
            "MediaBox" => vec![0.into(), 0.into(), format.0.into(), format.1.into()],
            "Contents" => flux,
            "Resources" => dictionary! { "Font" => dictionary! { "F1" => id_police } },
        });
        enfants.push(Object::Reference(page));
    }
    let n = enfants.len() as i64;
    doc.objects.insert(id_pages, Object::Dictionary(dictionary! { "Type" => "Pages", "Kids" => enfants, "Count" => n }));
    let catalogue = doc.add_object(dictionary! { "Type" => "Catalog", "Pages" => id_pages });
    doc.trailer.set("Root", catalogue);
    Ok(doc)
}

// ── Comparaison ───────────────────────────────────────────────────────────────

/// Resultat d'une comparaison de deux PDF.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Comparaison {
    pub ajouts: u32,
    pub suppressions: u32,
    pub identiques: bool,
    /// Rapport HTML autonome (lignes ajoutees en vert, supprimees en rouge).
    pub html: String,
}

/// Compare le texte de deux PDF ligne a ligne.
pub fn comparer(a: &[u8], b: &[u8]) -> Resultat<Comparaison> {
    use similar::{ChangeTag, TextDiff};
    let ta = assembler(&extraire_pages(&charger(a, None)?));
    let tb = assembler(&extraire_pages(&charger(b, None)?));
    let diff = TextDiff::from_lines(&ta, &tb);
    let (mut ajouts, mut suppressions, mut corps) = (0u32, 0u32, String::new());
    for c in diff.iter_all_changes() {
        let (classe, signe) = match c.tag() {
            ChangeTag::Delete => {
                suppressions += 1;
                ("sup", "-")
            }
            ChangeTag::Insert => {
                ajouts += 1;
                ("ajo", "+")
            }
            ChangeTag::Equal => ("eg", " "),
        };
        let ligne = echapper_html(c.value().trim_end_matches('\n'));
        corps.push_str(&format!("<div class=\"{classe}\"><span class=\"s\">{signe}</span>{ligne}</div>\n"));
    }
    let html = format!(
        "<!doctype html><html lang=\"fr\"><head><meta charset=\"utf-8\"><title>Comparaison de PDF</title>\
<style>body{{font:13px/1.5 Consolas,monospace;margin:0;padding:16px;background:#fff;color:#242424}}\
h1{{font:600 16px 'Segoe UI',sans-serif}}.sup{{background:#fde7e9;color:#a4262c}}.ajo{{background:#dff6dd;color:#107c10}}\
.eg{{color:#616161}}.s{{display:inline-block;width:1.5em}}div{{white-space:pre-wrap;padding:0 6px}}</style></head>\
<body><h1>Comparaison de PDF</h1><p>+{ajouts} ligne(s) ajoutée(s) · -{suppressions} ligne(s) supprimée(s)</p>\n{corps}</body></html>"
    );
    Ok(Comparaison { ajouts, suppressions, identiques: ajouts == 0 && suppressions == 0, html })
}

/// Echappement HTML minimal.
pub fn echapper_html(s: &str) -> String {
    s.replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;").replace('"', "&quot;")
}

/// Raccourci pour les conversions qui partent d'un chemin.
pub fn extraire_fichier(chemin: &std::path::Path) -> Resultat<String> {
    extraire(&crate::fichiers::lire_entree(chemin)?, None)
}

