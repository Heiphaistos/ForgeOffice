//! Outils PDF en pur Rust (lopdf) : fonctionnent aussi sur Android/iOS.
//! Ce module porte les briques communes (chargement, sauvegarde, heritage des
//! attributs de page, ressources, polices standard, ajout de contenu).

pub mod annotations;
pub mod caviardage;
pub mod compression;
pub mod externe;
pub mod formulaires;
pub mod images;
pub mod pages;
mod purge;
pub mod securite;
pub mod tampons;
pub mod texte;

use crate::erreur::{ConvertError, Resultat};
use lopdf::content::{Content, Operation};
use lopdf::{dictionary, Dictionary, Document, LoadOptions, Object, ObjectId, Stream, StringFormat};
use serde::{Deserialize, Serialize};

/// Charge un PDF depuis la memoire. `mdp` : mot de passe d'ouverture eventuel.
/// Un PDF chiffre est dechiffre a la lecture ; sans le bon mot de passe -> `MotDePasse`.
pub fn charger(octets: &[u8], mdp: Option<&str>) -> Resultat<Document> {
    let entete = &octets[..octets.len().min(1024)];
    if !entete.windows(5).any(|w| w == b"%PDF-") {
        return Err(ConvertError::PdfInvalide("en-tête %PDF absent, ce n'est pas un PDF".into()));
    }
    let options = match mdp {
        Some(m) if !m.is_empty() => LoadOptions::with_password(m),
        _ => LoadOptions::default(),
    };
    let doc = Document::load_mem_with_options(octets, options)?;
    if doc.is_encrypted() {
        return Err(ConvertError::MotDePasse);
    }
    if doc.get_pages().is_empty() {
        return Err(ConvertError::PdfInvalide("aucune page".into()));
    }
    Ok(doc)
}

/// Serialise le document.
pub fn enregistrer(doc: &mut Document) -> Resultat<Vec<u8>> {
    let mut out = Vec::new();
    doc.save_to(&mut out).map_err(|e| ConvertError::Echec(format!("enregistrement du PDF : {e}")))?;
    Ok(out)
}

/// Identifiants des pages dans l'ordre.
pub fn ids_pages(doc: &Document) -> Vec<ObjectId> {
    doc.get_pages().into_values().collect()
}

/// Attribut de page herite (cherche dans la page puis ses parents).
pub fn herite(doc: &Document, page: ObjectId, cle: &[u8]) -> Option<Object> {
    let mut id = page;
    for _ in 0..64 {
        let d = doc.get_dictionary(id).ok()?;
        if let Ok(v) = d.get(cle) {
            return Some(v.clone());
        }
        id = d.get(b"Parent").and_then(Object::as_reference).ok()?;
    }
    None
}

/// Recopie dans la page les attributs herites (Resources, MediaBox, CropBox, Rotate)
/// pour qu'elle reste correcte si on la detache de son arbre d'origine.
pub fn materialiser_heritage(doc: &mut Document, page: ObjectId) {
    for cle in [&b"Resources"[..], b"MediaBox", b"CropBox", b"Rotate"] {
        let present = doc.get_dictionary(page).map(|d| d.has(cle)).unwrap_or(true);
        if present {
            continue;
        }
        if let Some(v) = herite(doc, page, cle) {
            if let Ok(d) = doc.get_dictionary_mut(page) {
                d.set(cle.to_vec(), v);
            }
        }
    }
}

pub(crate) fn nombre(o: &Object) -> f32 {
    match o {
        Object::Integer(i) => *i as f32,
        Object::Real(r) => *r,
        _ => 0.0,
    }
}

fn boite(doc: &Document, o: &Object) -> Option<[f32; 4]> {
    let (_, o) = doc.dereference(o).ok()?;
    let a = o.as_array().ok()?;
    if a.len() != 4 {
        return None;
    }
    let v: Vec<f32> = a.iter().map(|x| doc.dereference(x).map(|(_, x)| nombre(x)).unwrap_or(0.0)).collect();
    let b = [v[0].min(v[2]), v[1].min(v[3]), v[0].max(v[2]), v[1].max(v[3])];
    (b[2] - b[0] > 1.0 && b[3] - b[1] > 1.0).then_some(b)
}

/// Zone visible de la page [x0, y0, x1, y1] en points (CropBox sinon MediaBox, A4 par defaut).
pub fn boite_page(doc: &Document, page: ObjectId) -> [f32; 4] {
    herite(doc, page, b"CropBox")
        .and_then(|o| boite(doc, &o))
        .or_else(|| herite(doc, page, b"MediaBox").and_then(|o| boite(doc, &o)))
        .unwrap_or([0.0, 0.0, 595.276, 841.89])
}

/// Rotation effective de la page (0, 90, 180, 270).
pub fn rotation_page(doc: &Document, page: ObjectId) -> i64 {
    let r = herite(doc, page, b"Rotate").and_then(|o| o.as_i64().ok()).unwrap_or(0);
    r.rem_euclid(360) / 90 * 90
}

/// Zone en coordonnees normalisees [0,1], origine en haut a gauche (comme a l'ecran).
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub struct Zone {
    /// Page 1-based.
    pub page: u32,
    pub x: f32,
    pub y: f32,
    pub largeur: f32,
    pub hauteur: f32,
}

impl Zone {
    /// Rectangle PDF [llx, lly, urx, ury] dans la boite de page.
    /// ponytail: ignore /Rotate (coordonnees de la page non pivotee) ; a corriger si l'UI affiche les pages pivotees.
    pub fn en_points(&self, b: [f32; 4]) -> [f32; 4] {
        let c = |v: f32| v.clamp(0.0, 1.0);
        let (w, h) = (b[2] - b[0], b[3] - b[1]);
        [
            b[0] + c(self.x) * w,
            b[3] - c(self.y + self.hauteur) * h,
            b[0] + c(self.x + self.largeur) * w,
            b[3] - c(self.y) * h,
        ]
    }
}

/// Couleur RVB 0..1.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub struct Couleur(pub f32, pub f32, pub f32);

impl Couleur {
    pub const NOIR: Couleur = Couleur(0.0, 0.0, 0.0);
    pub const BLANC: Couleur = Couleur(1.0, 1.0, 1.0);
    fn ops(self, op: &str) -> Operation {
        Operation::new(op, vec![self.0.into(), self.1.into(), self.2.into()])
    }
    /// Operation de couleur de remplissage.
    pub fn remplissage(self) -> Operation {
        self.ops("rg")
    }
    /// Operation de couleur de trait.
    pub fn trait_(self) -> Operation {
        self.ops("RG")
    }
}

// ── Ressources ────────────────────────────────────────────────────────────────

/// Rend le dictionnaire de ressources de la page (et la categorie demandee) direct
/// et propre a la page, pour pouvoir y ajouter des entrees sans toucher les autres pages.
fn categorie_mut<'a>(doc: &'a mut Document, page: ObjectId, categorie: &[u8]) -> Resultat<&'a mut Dictionary> {
    let ressources = match herite(doc, page, b"Resources") {
        Some(o) => doc.dereference(&o).ok().and_then(|(_, o)| o.as_dict().ok().cloned()).unwrap_or_default(),
        None => Dictionary::new(),
    };
    let mut ressources = ressources;
    let cat = ressources
        .get(categorie)
        .ok()
        .and_then(|o| doc.dereference(o).ok())
        .and_then(|(_, o)| o.as_dict().ok().cloned())
        .unwrap_or_default();
    ressources.set(categorie.to_vec(), Object::Dictionary(cat));
    let d = doc.get_dictionary_mut(page)?;
    d.set("Resources", Object::Dictionary(ressources));
    let r = d.get_mut(b"Resources").and_then(Object::as_dict_mut)?;
    Ok(r.get_mut(categorie).and_then(Object::as_dict_mut)?)
}

/// Ajoute `valeur` aux ressources `categorie` de la page sous un nom libre « prefixeN ».
pub fn ajouter_ressource(
    doc: &mut Document,
    page: ObjectId,
    categorie: &[u8],
    prefixe: &str,
    valeur: Object,
) -> Resultat<Vec<u8>> {
    let cat = categorie_mut(doc, page, categorie)?;
    let mut n = 1u32;
    let nom = loop {
        let candidat = format!("{prefixe}{n}").into_bytes();
        if !cat.has(&candidat) {
            break candidat;
        }
        n += 1;
    };
    cat.set(nom.clone(), valeur);
    Ok(nom)
}

/// Police standard (Helvetica, Helvetica-Bold, Courier) en WinAnsi, avec largeurs.
pub fn police_standard(doc: &mut Document, base: &str) -> ObjectId {
    let largeurs: Vec<Object> = (32u8..=255).map(|c| Object::Integer(largeur_glyphe(base, c) as i64)).collect();
    doc.add_object(dictionary! {
        "Type" => "Font",
        "Subtype" => "Type1",
        "BaseFont" => Object::Name(base.as_bytes().to_vec()),
        "Encoding" => "WinAnsiEncoding",
        "FirstChar" => 32,
        "LastChar" => 255,
        "Widths" => largeurs,
    })
}

/// Etat graphique avec opacite (remplissage et trait).
pub fn etat_opacite(doc: &mut Document, opacite: f32) -> ObjectId {
    let a = opacite.clamp(0.0, 1.0);
    doc.add_object(dictionary! { "Type" => "ExtGState", "ca" => a, "CA" => a })
}

/// Ajoute du contenu par-dessus la page. Le contenu existant est encadre par q/Q
/// pour qu'un etat graphique laisse modifie ne deforme pas l'ajout.
pub fn ajouter_contenu(doc: &mut Document, page: ObjectId, operations: Vec<Operation>) -> Resultat<()> {
    let mut ops = vec![Operation::new("Q", vec![])];
    ops.extend(operations);
    let fin = Content { operations: ops }.encode()?;
    let existants: Vec<Object> = match doc.get_dictionary(page)?.get(b"Contents") {
        Ok(Object::Reference(id)) => match doc.get_object(*id) {
            Ok(Object::Array(a)) => a.clone(),
            _ => vec![Object::Reference(*id)],
        },
        Ok(Object::Array(a)) => a.clone(),
        _ => vec![],
    };
    let debut = doc.add_object(Stream::new(Dictionary::new(), b"q\n".to_vec()));
    let fin = doc.add_object(Stream::new(Dictionary::new(), fin));
    let mut tout = vec![Object::Reference(debut)];
    tout.extend(existants);
    tout.push(Object::Reference(fin));
    doc.get_dictionary_mut(page)?.set("Contents", Object::Array(tout));
    Ok(())
}

// ── Texte ─────────────────────────────────────────────────────────────────────

/// Encode une chaine en WinAnsi (caracteres non representables -> « ? »).
pub fn winansi(s: &str) -> Vec<u8> {
    s.chars()
        .map(|c| match c {
            '\t' => b' ',
            c if (c as u32) < 0x80 || ((c as u32) >= 0xA0 && (c as u32) <= 0xFF) => c as u32 as u8,
            '€' => 0x80, '‚' => 0x82, 'ƒ' => 0x83, '„' => 0x84, '…' => 0x85, '†' => 0x86, '‡' => 0x87,
            'ˆ' => 0x88, '‰' => 0x89, 'Š' => 0x8A, '‹' => 0x8B, 'Œ' => 0x8C, 'Ž' => 0x8E, '‘' => 0x91,
            '’' => 0x92, '“' => 0x93, '”' => 0x94, '•' => 0x95, '–' => 0x96, '—' => 0x97, '˜' => 0x98,
            '™' => 0x99, 'š' => 0x9A, '›' => 0x9B, 'œ' => 0x9C, 'ž' => 0x9E, 'Ÿ' => 0x9F,
            _ => b'?',
        })
        .collect()
}

/// Chaine PDF litterale.
pub fn chaine(octets: Vec<u8>) -> Object {
    Object::String(octets, StringFormat::Literal)
}

const HELVETICA: [u16; 95] = [
    278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556,
    556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667,
    611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667,
    667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500,
    222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
];

/// Largeur (millièmes d'em) d'un code WinAnsi dans une police standard.
pub fn largeur_glyphe(base: &str, code: u8) -> u16 {
    if base.starts_with("Courier") {
        return 600;
    }
    if base.starts_with("Helvetica") || base.starts_with("Arial") {
        if (32..=126).contains(&code) {
            let w = HELVETICA[(code - 32) as usize];
            // Gras : approximation par +5 % (les vraies metriques different peu).
            return if base.contains("Bold") { w + w / 20 } else { w };
        }
        return 556;
    }
    500
}

/// Largeur en points d'un texte dans une police standard.
pub fn largeur_texte(base: &str, texte: &str, taille: f32) -> f32 {
    winansi(texte).iter().map(|&c| largeur_glyphe(base, c) as f32).sum::<f32>() * taille / 1000.0
}

/// Operations d'une ligne de texte posee en (x, y) (ligne de base), police `nom_police`.
pub fn ops_texte(nom_police: &[u8], taille: f32, x: f32, y: f32, texte: &str) -> Vec<Operation> {
    vec![
        Operation::new("BT", vec![]),
        Operation::new("Tf", vec![Object::Name(nom_police.to_vec()), taille.into()]),
        Operation::new("Td", vec![x.into(), y.into()]),
        Operation::new("Tj", vec![chaine(winansi(texte))]),
        Operation::new("ET", vec![]),
    ]
}

/// Operation rectangle (x, y, l, h).
pub fn op_rect(r: [f32; 4]) -> Operation {
    Operation::new("re", vec![r[0].into(), r[1].into(), (r[2] - r[0]).into(), (r[3] - r[1]).into()])
}
