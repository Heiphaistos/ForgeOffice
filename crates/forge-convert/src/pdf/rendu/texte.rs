//! Polices du rendu simplifie : contours TrueType/OpenType integres (ttf-parser), sinon
//! police systeme proche choisie par fontdb (chargee a la premiere utilisation).

use crate::pdf::police::{charger_police, deref, Police};
use lopdf::{Dictionary, Document};
use std::cell::RefCell;
use std::collections::HashMap;
use std::rc::Rc;
use tiny_skia::{Path, PathBuilder};

/// Taille maximale d'un programme de police lu (anti-bombe).
const MAX_POLICE: usize = 64 * 1024 * 1024;

type Donnees = (Rc<Vec<u8>>, u32);

/// Polices du systeme, chargees a la demande.
#[derive(Default)]
pub(super) struct Systeme {
    base: Option<fontdb::Database>,
    choisies: HashMap<String, Option<Donnees>>,
}

impl Systeme {
    /// Police systeme proche du nom de base PDF (famille generique, gras, italique).
    fn trouver(&mut self, nom: &str) -> Option<Donnees> {
        let bas = nom.to_lowercase();
        if let Some(d) = self.choisies.get(&bas) {
            return d.clone();
        }
        let db = self.base.get_or_insert_with(|| {
            let mut db = fontdb::Database::new();
            db.load_system_fonts();
            db
        });
        let familles: Vec<fontdb::Family> = if bas.contains("courier") || bas.contains("mono") {
            vec![fontdb::Family::Name("Courier New"), fontdb::Family::Name("Liberation Mono"), fontdb::Family::Name("DejaVu Sans Mono"), fontdb::Family::Monospace]
        } else if (bas.contains("times") || bas.contains("serif") || bas.contains("garamond")) && !bas.contains("sans") {
            vec![fontdb::Family::Name("Times New Roman"), fontdb::Family::Name("Liberation Serif"), fontdb::Family::Name("DejaVu Serif"), fontdb::Family::Serif]
        } else {
            vec![fontdb::Family::Name("Arial"), fontdb::Family::Name("Helvetica"), fontdb::Family::Name("Roboto"), fontdb::Family::Name("Noto Sans"), fontdb::Family::Name("Liberation Sans"), fontdb::Family::Name("DejaVu Sans"), fontdb::Family::SansSerif]
        };
        let q = fontdb::Query {
            families: &familles,
            weight: if bas.contains("bold") || bas.contains("black") { fontdb::Weight::BOLD } else { fontdb::Weight::NORMAL },
            stretch: fontdb::Stretch::Normal,
            style: if bas.contains("italic") || bas.contains("oblique") { fontdb::Style::Italic } else { fontdb::Style::Normal },
        };
        let d = db.query(&q).and_then(|id| db.with_face_data(id, |data, idx| (Rc::new(data.to_vec()), idx)));
        self.choisies.insert(bas, d.clone());
        d
    }
}

/// Police prete a dessiner.
pub(super) struct Fonte {
    pub police: Police,
    pub type3: bool,
    donnees: Option<Donnees>,
    integree: bool,
    double: bool,
    cid_gid: Option<Vec<u8>>,
    contours: RefCell<HashMap<u32, Option<Rc<Path>>>>,
}

struct Constructeur {
    pb: PathBuilder,
    k: f32,
}

impl ttf_parser::OutlineBuilder for Constructeur {
    fn move_to(&mut self, x: f32, y: f32) {
        self.pb.move_to(x * self.k, y * self.k);
    }
    fn line_to(&mut self, x: f32, y: f32) {
        self.pb.line_to(x * self.k, y * self.k);
    }
    fn quad_to(&mut self, x1: f32, y1: f32, x: f32, y: f32) {
        self.pb.quad_to(x1 * self.k, y1 * self.k, x * self.k, y * self.k);
    }
    fn curve_to(&mut self, x1: f32, y1: f32, x2: f32, y2: f32, x: f32, y: f32) {
        self.pb.cubic_to(x1 * self.k, y1 * self.k, x2 * self.k, y2 * self.k, x * self.k, y * self.k);
    }
    fn close(&mut self) {
        self.pb.close();
    }
}

fn nom_de(doc: &Document, d: &Dictionary, k: &[u8]) -> Option<String> {
    d.get(k).ok().map(|o| deref(doc, o)).and_then(|o| o.as_name().ok()).map(|n| String::from_utf8_lossy(n).into_owned())
}

/// Programme de police integre (TrueType ou OpenType) lisible par ttf-parser.
fn police_integree(doc: &Document, f: &Dictionary) -> Option<Donnees> {
    let desc = f.get(b"FontDescriptor").ok().map(|o| deref(doc, o)).and_then(|o| o.as_dict().ok())?;
    let flux = [b"FontFile2".as_slice(), b"FontFile3"].iter().find_map(|k| desc.get(k).ok().map(|o| deref(doc, o)).and_then(|o| o.as_stream().ok()))?;
    let octets = flux.decompressed_content().unwrap_or_else(|_| flux.content.clone());
    if octets.len() > MAX_POLICE || ttf_parser::Face::parse(&octets, 0).is_err() {
        return None;
    }
    Some((Rc::new(octets), 0))
}

/// Charge la police `nom` des ressources.
pub(super) fn charger_fonte(doc: &Document, res: &Dictionary, nom: &[u8], systeme: &mut Systeme) -> Fonte {
    let police = charger_police(doc, res, nom);
    let f = res.get(b"Font").ok().map(|o| deref(doc, o)).and_then(|o| o.as_dict().ok()).and_then(|d| d.get(nom).ok()).map(|o| deref(doc, o)).and_then(|o| o.as_dict().ok());
    let Some(f) = f else {
        return Fonte { police, type3: false, donnees: None, integree: false, double: false, cid_gid: None, contours: RefCell::default() };
    };
    let sous_type = nom_de(doc, f, b"Subtype").unwrap_or_default();
    let double = sous_type == "Type0";
    // Type0 : le programme et la table CIDToGIDMap sont dans la police descendante.
    let desc = if double { f.get(b"DescendantFonts").ok().map(|o| deref(doc, o)).and_then(|o| o.as_array().ok()).and_then(|a| a.first()).map(|o| deref(doc, o)).and_then(|o| o.as_dict().ok()) } else { Some(f) };
    let integre = desc.and_then(|d| police_integree(doc, d));
    let cid_gid = desc
        .filter(|_| double)
        .and_then(|d| d.get(b"CIDToGIDMap").ok())
        .map(|o| deref(doc, o))
        .and_then(|o| o.as_stream().ok())
        .map(|s| s.decompressed_content().unwrap_or_else(|_| s.content.clone()))
        .filter(|v| v.len() <= MAX_POLICE);
    let integree = integre.is_some();
    let donnees = integre.or_else(|| {
        let base = nom_de(doc, f, b"BaseFont").or_else(|| desc.and_then(|d| nom_de(doc, d, b"BaseFont"))).unwrap_or_default();
        (sous_type != "Type3").then(|| systeme.trouver(&base)).flatten()
    });
    Fonte { police, type3: sous_type == "Type3", donnees, integree, double, cid_gid, contours: RefCell::default() }
}

impl Fonte {
    /// Vrai si un programme de police (integre ou systeme) est disponible.
    pub fn a_des_contours(&self) -> bool {
        self.donnees.is_some()
    }

    fn glyphe(&self, face: &ttf_parser::Face, code: u32) -> Option<ttf_parser::GlyphId> {
        if self.integree && self.double {
            let gid = match &self.cid_gid {
                Some(m) => {
                    let i = code as usize * 2;
                    u16::from_be_bytes([*m.get(i)?, *m.get(i + 1)?])
                }
                None => u16::try_from(code).ok()?,
            };
            return Some(ttf_parser::GlyphId(gid));
        }
        let par_unicode = self.police.dec.texte(code).chars().next().and_then(|c| face.glyph_index(c));
        par_unicode.or_else(|| {
            if !self.integree {
                return None;
            }
            // Police symbolique : sous-tables cmap indexees par le code (parfois decale de 0xF000).
            face.tables().cmap?.subtables.into_iter().find_map(|s| s.glyph_index(code).or_else(|| s.glyph_index(0xF000 + code)))
        })
    }

    /// Contour du glyphe en unites d'em (1 = corps de la police), si la police le fournit.
    pub fn contour(&self, code: u32) -> Option<Rc<Path>> {
        if let Some(c) = self.contours.borrow().get(&code) {
            return c.clone();
        }
        let chemin = self.construire(code).map(Rc::new);
        let mut cache = self.contours.borrow_mut();
        if cache.len() < 20_000 {
            cache.insert(code, chemin.clone());
        }
        chemin
    }

    fn construire(&self, code: u32) -> Option<Path> {
        let (data, idx) = self.donnees.as_ref()?;
        let face = ttf_parser::Face::parse(data, *idx).ok()?;
        let gid = self.glyphe(&face, code)?;
        let mut c = Constructeur { pb: PathBuilder::new(), k: 1.0 / f32::from(face.units_per_em().max(1)) };
        face.outline_glyph(gid, &mut c)?;
        c.pb.finish()
    }
}
