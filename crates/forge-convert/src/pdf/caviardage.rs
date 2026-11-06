//! Caviardage reel (pur Rust) : sous chaque zone, les glyphes sont RETIRES du flux de
//! contenu (remplaces par un decalage, le reste de la ligne ne bouge pas), les pixels
//! des images sont noircis (ou l'image retiree si son format n'est pas decodable),
//! les formulaires XObject sont reecrits recursivement, les annotations touchees
//! sont supprimees, puis les objets orphelins (anciens flux) sont purges.
//! La page reste vectorielle (ForgePDF la rasterisait avec mutool).
//!
//! Limites connues : les traces vectoriels (chemins) ne sont pas retires, seulement
//! recouverts ; les CMap a longueur de code variable sont lues sur 2 octets.

use super::decodage;
use super::police::{charger_police, deref, Police};
use super::geom::{boite, chevauche, inverse, mul, Mat, ID};
use super::images::{decoder_jpeg_libre, decoder_xobject, xobject_flate};
use super::traits::{self, Chemin, Issue};
use super::{ajouter_contenu, boite_page, dimensions_affichees, herite, matrice_affichage, nombre, op_rect, ops_texte, police_standard, rotation_page, Couleur, Zone};
use crate::erreur::{param, ConvertError, Resultat};
use image::{DynamicImage, GenericImageView};
use lopdf::content::{Content, Operation};
use lopdf::{Dictionary, Document, Object, ObjectId, Stream};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

const PROFONDEUR_MAX: u32 = 8;

fn matrice(ops: &[Object]) -> Option<Mat> {
    (ops.len() == 6).then(|| [0, 1, 2, 3, 4, 5].map(|i| nombre(&ops[i])))
}

/// Bilan du caviardage (affiche a l'utilisateur).
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
pub struct RapportCaviardage {
    pub glyphes_supprimes: u32,
    pub images_masquees: u32,
    pub images_supprimees: u32,
    pub formes_reecrites: u32,
    pub annotations_supprimees: u32,
    /// Dessins vectoriels (lignes, courbes, formes) retires parce qu'entierement sous une zone.
    #[serde(default)]
    pub traits_supprimes: u32,
    /// Dessins vectoriels dont la partie sous une zone a ete decoupee.
    #[serde(default)]
    pub traits_ecretes: u32,
    /// Mises en garde (donnees annexes purgees : metadonnees, miniatures, signets, champs...).
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub avertissements: Vec<String>,
}

#[derive(Clone)]
struct Etat {
    ctm: Mat,
    tc: f32,
    tw: f32,
    th: f32,
    tl: f32,
    tfs: f32,
    trise: f32,
    lw: f32,
    police: Vec<u8>,
}

/// Ajoute une entree « prefixeN » a la categorie `cat` d'un dictionnaire de ressources possede.
fn ajouter_res(doc: &Document, res: &mut Dictionary, cat: &[u8], valeur: Object) -> Vec<u8> {
    let mut d = res.get(cat).ok().and_then(|o| deref(doc, o).as_dict().ok().cloned()).unwrap_or_default();
    let mut n = 1u32;
    let nom = loop {
        let c = format!("Cav{n}").into_bytes();
        if !d.has(&c) {
            break c;
        }
        n += 1;
    };
    d.set(nom.clone(), valeur);
    res.set(cat.to_vec(), Object::Dictionary(d));
    nom
}

fn abrege(n: &[u8]) -> &[u8] {
    match n {
        b"G" => b"DeviceGray",
        b"RGB" => b"DeviceRGB",
        b"CMYK" => b"DeviceCMYK",
        b"I" => b"Indexed",
        b"AHx" => b"ASCIIHexDecode",
        b"A85" => b"ASCII85Decode",
        b"LZW" => b"LZWDecode",
        b"Fl" => b"FlateDecode",
        b"RL" => b"RunLengthDecode",
        b"CCF" => b"CCITTFaxDecode",
        b"DCT" => b"DCTDecode",
        autre => autre,
    }
}

fn developper(o: &Object) -> Object {
    match o {
        Object::Name(n) => Object::Name(abrege(n).to_vec()),
        Object::Array(a) => Object::Array(a.iter().map(developper).collect()),
        autre => autre.clone(),
    }
}

struct Caviardeur<'a> {
    doc: &'a mut Document,
    rects: Vec<[f32; 4]>,
    rapport: RapportCaviardage,
    /// Texte decode des glyphes retires (exact, mots separes par des espaces).
    retire: String,
}

impl Caviardeur<'_> {
    fn touche(&self, b: [f32; 4]) -> bool {
        self.rects.iter().any(|&r| chevauche(b, r))
    }

    /// Image en ligne conservee : convertie en XObject (lopdf ne sait pas la reecrire en ligne).
    fn inline_vers_xobject(&mut self, s: &Stream, res: &mut Dictionary) -> Vec<u8> {
        let mut d = Dictionary::new();
        d.set("Type", "XObject");
        d.set("Subtype", "Image");
        for (k, v) in s.dict.iter() {
            let cle: &[u8] = match k.as_slice() {
                b"BPC" => b"BitsPerComponent",
                b"CS" => b"ColorSpace",
                b"D" => b"Decode",
                b"DP" => b"DecodeParms",
                b"F" => b"Filter",
                b"H" => b"Height",
                b"IM" => b"ImageMask",
                b"I" => b"Interpolate",
                b"W" => b"Width",
                autre => autre,
            };
            let mut val = developper(v);
            if cle == b"ColorSpace" {
                if let Object::Name(n) = &val {
                    if !n.starts_with(b"Device") && n.as_slice() != b"Indexed" {
                        let trouve = res.get(b"ColorSpace").ok().and_then(|o| deref(self.doc, o).as_dict().ok()).and_then(|cs| cs.get(n).ok()).cloned();
                        if let Some(t) = trouve {
                            val = t;
                        }
                    }
                }
            }
            d.set(cle.to_vec(), val);
        }
        let mut flux = Stream::new(d, s.content.clone());
        flux.allows_compression = false;
        let id = self.doc.add_object(flux);
        ajouter_res(self.doc, res, b"XObject", Object::Reference(id))
    }

    fn noircir(&self, img: &mut DynamicImage, ctm: Mat, valeur: u8) {
        let Some(inv) = inverse(ctm) else { return };
        let (l, h) = img.dimensions();
        for &r in &self.rects {
            let b = boite(inv, r[0], r[1], r[2], r[3]);
            let x0 = (b[0].max(0.0) * l as f32).floor() as u32;
            let x1 = ((b[2].min(1.0) * l as f32).ceil() as u32).min(l);
            let y0 = ((1.0 - b[3].min(1.0)) * h as f32).floor().max(0.0) as u32;
            let y1 = (((1.0 - b[1].max(0.0)) * h as f32).ceil() as u32).min(h);
            for y in y0..y1 {
                for x in x0..x1 {
                    match img {
                        DynamicImage::ImageLuma8(g) => g.put_pixel(x, y, image::Luma([valeur])),
                        DynamicImage::ImageRgb8(c) => c.put_pixel(x, y, image::Rgb([valeur; 3])),
                        _ => {}
                    }
                }
            }
        }
    }

    /// Image touchee : copie aux pixels noircis, ou `None` si non decodable.
    fn masquer_image(&mut self, s: &Stream, ctm: Mat) -> Resultat<Option<ObjectId>> {
        let Some(mut img) = decoder_xobject(self.doc, s).or_else(|| decoder_jpeg_libre(s)) else { return Ok(None) };
        self.noircir(&mut img, ctm, 0);
        let mut nouveau = xobject_flate(self.doc, &img)?;
        let masque = s.dict.get(b"SMask").ok().and_then(|o| self.doc.dereference(o).ok()).and_then(|(_, o)| o.as_stream().ok().cloned());
        if let (Some(m), Object::Stream(n)) = (masque, &mut nouveau) {
            if let Some(mut mi) = decoder_xobject(self.doc, &m).or_else(|| decoder_jpeg_libre(&m)) {
                self.noircir(&mut mi, ctm, 255);
                let mo = xobject_flate(self.doc, &mi)?;
                n.dict.set("SMask", self.doc.add_object(mo));
            }
        }
        Ok(Some(self.doc.add_object(nouveau)))
    }

    fn xobject(&self, res: &Dictionary, nom: &[u8]) -> Option<Stream> {
        let xo = res.get(b"XObject").ok().map(|o| deref(self.doc, o))?.as_dict().ok()?;
        deref(self.doc, xo.get(nom).ok()?).as_stream().ok().cloned()
    }

    /// Traite un `Do` ; renvoie vrai si l'XObject d'origine n'est plus utilise par cet appel.
    fn traiter_do(&mut self, op: Operation, ctm: Mat, res: &mut Dictionary, prof: u32, sortie: &mut Vec<Operation>) -> Resultat<bool> {
        let nom = op.operands.first().and_then(|o| o.as_name().ok()).map(<[u8]>::to_vec).unwrap_or_default();
        let Some(s) = self.xobject(res, &nom) else {
            sortie.push(op);
            return Ok(false);
        };
        let sous_type = s.dict.get(b"Subtype").and_then(Object::as_name).ok().map(<[u8]>::to_vec).unwrap_or_default();
        if sous_type == b"Image" {
            if !self.touche(boite(ctm, 0.0, 0.0, 1.0, 1.0)) {
                sortie.push(op);
                return Ok(false);
            }
            if let Some(id) = self.masquer_image(&s, ctm)? {
                let n = ajouter_res(self.doc, res, b"XObject", Object::Reference(id));
                sortie.push(Operation::new("Do", vec![Object::Name(n)]));
                self.rapport.images_masquees += 1;
            } else {
                self.rapport.images_supprimees += 1;
            }
            return Ok(true);
        }
        if sous_type != b"Form" {
            sortie.push(op);
            return Ok(false);
        }
        let m = s.dict.get(b"Matrix").ok().and_then(|o| deref(self.doc, o).as_array().ok()).and_then(|a| matrice(a)).unwrap_or(ID);
        let ctm_f = mul(m, ctm);
        let bb = s.dict.get(b"BBox").ok().and_then(|o| deref(self.doc, o).as_array().ok()).and_then(|a| (a.len() == 4).then(|| [0, 1, 2, 3].map(|i| nombre(&a[i]))));
        let touche = bb.map(|b| self.touche(boite(ctm_f, b[0], b[1], b[2], b[3]))).unwrap_or(true);
        if !touche {
            sortie.push(op);
            return Ok(false);
        }
        let ops = if prof < PROFONDEUR_MAX { s.decompressed_content().ok().and_then(|c| Content::decode(&c).ok()) } else { None };
        let Some(ops) = ops else {
            // Forme illisible ou trop imbriquee : retiree par prudence.
            self.rapport.images_supprimees += 1;
            return Ok(true);
        };
        let mut res_f = s.dict.get(b"Resources").ok().and_then(|o| deref(self.doc, o).as_dict().ok().cloned()).unwrap_or_else(|| res.clone());
        let avant = self.rapport.clone();
        let nouveaux = self.traiter(ops.operations, ctm_f, &mut res_f, prof + 1)?;
        if self.rapport == avant {
            sortie.push(op);
            return Ok(false);
        }
        let mut dict = s.dict.clone();
        dict.remove(b"Filter");
        dict.remove(b"DecodeParms");
        dict.set("Resources", Object::Dictionary(res_f));
        let mut flux = Stream::new(dict, Content { operations: nouveaux }.encode()?);
        let _ = flux.compress();
        let id = self.doc.add_object(flux);
        let n = ajouter_res(self.doc, res, b"XObject", Object::Reference(id));
        sortie.push(Operation::new("Do", vec![Object::Name(n)]));
        self.rapport.formes_reecrites += 1;
        Ok(true)
    }

    /// Affiche une chaine : renvoie les elements TJ conserves (None si rien retire).
    fn montrer(&mut self, e: &Etat, tm: &mut Mat, polices: &mut HashMap<Vec<u8>, Police>, res: &Dictionary, elements: &[Object]) -> Option<Vec<Object>> {
        let police = polices.entry(e.police.clone()).or_insert_with(|| charger_police(self.doc, res, &e.police));
        let trm_base = [e.tfs * e.th, 0.0, 0.0, e.tfs, 0.0, e.trise];
        let mut sortie: Vec<Object> = Vec::new();
        let mut retire = false;
        for el in elements {
            match el {
                Object::String(octets, format) => {
                    let mut courant: Vec<u8> = Vec::new();
                    for (code, code_o) in police.dec.decouper(octets) {
                        let w0 = police.largeur(code);
                        let espace = if code_o.len() == 1 && code == 32 { e.tw } else { 0.0 };
                        let tx = (w0 * e.tfs + e.tc + espace) * e.th;
                        let m = mul(trm_base, mul(*tm, e.ctm));
                        let b = boite(m, 0.0, -0.25, w0.max(0.05), 0.95);
                        if self.touche(b) {
                            retire = true;
                            self.rapport.glyphes_supprimes += 1;
                            self.retire.push_str(police.dec.texte(code));
                            if !courant.is_empty() {
                                sortie.push(Object::String(std::mem::take(&mut courant), *format));
                            }
                            let d = e.tfs * e.th;
                            if d.abs() > 1e-6 {
                                sortie.push(Object::Real(-tx * 1000.0 / d));
                            }
                        } else {
                            courant.extend_from_slice(code_o);
                        }
                        *tm = mul([1.0, 0.0, 0.0, 1.0, tx, 0.0], *tm);
                    }
                    if !courant.is_empty() {
                        sortie.push(Object::String(courant, *format));
                    }
                }
                autre => {
                    let n = nombre(autre);
                    *tm = mul([1.0, 0.0, 0.0, 1.0, -n / 1000.0 * e.tfs * e.th, 0.0], *tm);
                    sortie.push(autre.clone());
                }
            }
        }
        if retire {
            self.retire.push(' ');
        }
        retire.then_some(sortie)
    }

    fn traiter(&mut self, ops: Vec<Operation>, ctm0: Mat, res: &mut Dictionary, prof: u32) -> Resultat<Vec<Operation>> {
        let mut e = Etat { ctm: ctm0, tc: 0.0, tw: 0.0, th: 1.0, tl: 0.0, tfs: 0.0, trise: 0.0, lw: 1.0, police: Vec::new() };
        let mut pile: Vec<Etat> = Vec::new();
        let (mut tm, mut tlm) = (ID, ID);
        let mut polices: HashMap<Vec<u8>, Police> = HashMap::new();
        let mut sortie = Vec::with_capacity(ops.len());
        let mut remplaces: Vec<Vec<u8>> = Vec::new();
        let mut chemin: Option<Chemin> = None;
        for op in ops {
            let nom_op = op.operator.as_str();
            if traits::est_construction(nom_op) {
                chemin.get_or_insert_with(Chemin::default).ajouter(op);
                continue;
            }
            if matches!(nom_op, "W" | "W*") && chemin.is_some() {
                if let Some(c) = chemin.as_mut() {
                    c.clip = Some(op.operator.clone());
                }
                continue;
            }
            if traits::est_peinture(nom_op) {
                match chemin.take() {
                    Some(c) => self.peindre_chemin(c, op, &e, &mut sortie),
                    None => sortie.push(op),
                }
                continue;
            }
            if let Some(c) = chemin.take() {
                Self::vider_chemin(c, &mut sortie);
            }
            let o = &op.operands;
            let n = |i: usize| o.get(i).map(nombre).unwrap_or(0.0);
            match op.operator.as_str() {
                "q" => pile.push(e.clone()),
                "Q" => {
                    if let Some(p) = pile.pop() {
                        e = p;
                    }
                }
                "cm" => {
                    if let Some(m) = matrice(o) {
                        e.ctm = mul(m, e.ctm);
                    }
                }
                "BT" => {
                    tm = ID;
                    tlm = ID;
                }
                "w" => e.lw = n(0),
                "gs" => {
                    if let Some(lw) = self.largeur_gs(res, o.first()) {
                        e.lw = lw;
                    }
                }
                "Tc" => e.tc = n(0),
                "Tw" => e.tw = n(0),
                "Tz" => e.th = n(0) / 100.0,
                "TL" => e.tl = n(0),
                "Ts" => e.trise = n(0),
                "Tf" => {
                    e.police = o.first().and_then(|x| x.as_name().ok()).map(<[u8]>::to_vec).unwrap_or_default();
                    e.tfs = n(1);
                }
                "Td" | "TD" => {
                    if op.operator == "TD" {
                        e.tl = -n(1);
                    }
                    tlm = mul([1.0, 0.0, 0.0, 1.0, n(0), n(1)], tlm);
                    tm = tlm;
                }
                "Tm" => {
                    if let Some(m) = matrice(o) {
                        tlm = m;
                        tm = m;
                    }
                }
                "T*" => {
                    tlm = mul([1.0, 0.0, 0.0, 1.0, 0.0, -e.tl], tlm);
                    tm = tlm;
                }
                "Tj" | "TJ" | "'" | "\"" => {
                    let chaine_idx = if op.operator == "\"" { 2 } else { 0 };
                    if op.operator == "\"" {
                        e.tw = n(0);
                        e.tc = n(1);
                    }
                    if op.operator == "'" || op.operator == "\"" {
                        tlm = mul([1.0, 0.0, 0.0, 1.0, 0.0, -e.tl], tlm);
                        tm = tlm;
                    }
                    let elements: Vec<Object> = match o.get(chaine_idx) {
                        Some(Object::Array(a)) => a.clone(),
                        Some(s) => vec![s.clone()],
                        None => vec![],
                    };
                    match self.montrer(&e, &mut tm, &mut polices, res, &elements) {
                        None => sortie.push(op),
                        Some(garde) => {
                            if op.operator == "\"" {
                                sortie.push(Operation::new("Tw", vec![o[0].clone()]));
                                sortie.push(Operation::new("Tc", vec![o[1].clone()]));
                            }
                            if op.operator == "'" || op.operator == "\"" {
                                sortie.push(Operation::new("T*", vec![]));
                            }
                            sortie.push(Operation::new("TJ", vec![Object::Array(garde)]));
                        }
                    }
                    continue;
                }
                "Do" => {
                    let nom = o.first().and_then(|x| x.as_name().ok()).map(<[u8]>::to_vec);
                    if self.traiter_do(op, e.ctm, res, prof, &mut sortie)? {
                        remplaces.extend(nom);
                    }
                    continue;
                }
                "BI" => {
                    if let Some(Object::Stream(s)) = o.first() {
                        if self.touche(boite(e.ctm, 0.0, 0.0, 1.0, 1.0)) {
                            self.rapport.images_supprimees += 1;
                        } else {
                            let nom = self.inline_vers_xobject(s, res);
                            sortie.push(Operation::new("Do", vec![Object::Name(nom)]));
                        }
                    }
                    continue;
                }
                _ => {}
            }
            sortie.push(op);
        }
        if let Some(c) = chemin.take() {
            Self::vider_chemin(c, &mut sortie);
        }
        self.oublier(res, &remplaces, &sortie);
        Ok(sortie)
    }

    /// Epaisseur de trait d'un etat graphique `gs` (/LW), si presente.
    fn largeur_gs(&self, res: &Dictionary, nom: Option<&Object>) -> Option<f32> {
        let nom = nom?.as_name().ok()?;
        let gs = res.get(b"ExtGState").ok().map(|o| deref(self.doc, o))?.as_dict().ok()?;
        let d = deref(self.doc, gs.get(nom).ok()?).as_dict().ok()?;
        d.get(b"LW").ok().map(|o| nombre(deref(self.doc, o)))
    }

    /// Dessin sans operateur de peinture (ou jamais examine) : reecrit tel quel.
    fn vider_chemin(c: Chemin, sortie: &mut Vec<Operation>) {
        sortie.extend(c.ops);
        sortie.extend(c.clip.as_deref().map(|o| Operation::new(o, vec![])));
    }

    /// Peint un dessin : supprime, recadre ou conserve selon les zones. Un ecretage (W) est
    /// toujours conserve, en `n`, pour ne pas elargir la zone visible.
    fn peindre_chemin(&mut self, c: Chemin, paint: Operation, e: &Etat, sortie: &mut Vec<Operation>) {
        let issue = traits::peindre(&c, &paint.operator, e.ctm, e.lw, &self.rects);
        let (peint, reste) = match issue {
            Issue::Intact => {
                sortie.extend(c.ops.iter().cloned());
                sortie.extend(c.clip.as_ref().map(|o| Operation::new(o.as_str(), vec![])));
                sortie.push(paint);
                return;
            }
            Issue::Retire => {
                self.rapport.traits_supprimes += 1;
                (Vec::new(), c)
            }
            Issue::Ecrete(ops) => {
                self.rapport.traits_ecretes += 1;
                (ops, c)
            }
        };
        sortie.extend(peint);
        if let Some(o) = reste.clip {
            sortie.extend(reste.ops);
            sortie.push(Operation::new(&o, vec![]));
            sortie.push(Operation::new("n", vec![]));
        }
    }

    /// Retire des ressources les XObject remplaces qui ne sont plus appeles,
    /// sinon l'ancien contenu resterait reference (donc conserve dans le fichier).
    fn oublier(&self, res: &mut Dictionary, remplaces: &[Vec<u8>], sortie: &[Operation]) {
        let encore = |n: &Vec<u8>| sortie.iter().any(|op| op.operator == "Do" && op.operands.first().and_then(|o| o.as_name().ok()) == Some(n.as_slice()));
        let a_retirer: Vec<&Vec<u8>> = remplaces.iter().filter(|n| !encore(n)).collect();
        if a_retirer.is_empty() {
            return;
        }
        let mut xo = res.get(b"XObject").ok().and_then(|o| deref(self.doc, o).as_dict().ok().cloned()).unwrap_or_default();
        for n in a_retirer {
            xo.remove(n);
        }
        res.set("XObject", Object::Dictionary(xo));
    }
}

/// Supprime les annotations (et champs de formulaire) qui touchent une zone.
fn retirer_annotations(doc: &mut Document, page: ObjectId, rects: &[[f32; 4]]) -> Resultat<u32> {
    let liste: Vec<Object> = match doc.get_dictionary(page)?.get(b"Annots") {
        Ok(o) => deref(doc, o).as_array().cloned().unwrap_or_default(),
        Err(_) => return Ok(0),
    };
    let (mut garde, mut retires) = (Vec::new(), Vec::new());
    for a in liste {
        let rect = deref(doc, &a)
            .as_dict()
            .ok()
            .and_then(|d| d.get(b"Rect").ok())
            .and_then(|r| deref(doc, r).as_array().ok())
            .filter(|r| r.len() == 4)
            .map(|r| {
                let v = [0, 1, 2, 3].map(|i| nombre(deref(doc, &r[i])));
                [v[0].min(v[2]), v[1].min(v[3]), v[0].max(v[2]), v[1].max(v[3])]
            });
        match rect {
            Some(b) if rects.iter().any(|&r| chevauche(b, r)) => retires.push(a),
            _ => garde.push(a),
        }
    }
    if retires.is_empty() {
        return Ok(0);
    }
    doc.get_dictionary_mut(page)?.set("Annots", Object::Array(garde));
    let acro = doc.catalog().ok().and_then(|c| c.get(b"AcroForm").ok()).and_then(|o| o.as_reference().ok());
    if let Some(Ok(Object::Array(champs))) = acro.map(|id| doc.get_dictionary_mut(id).and_then(|d| d.get_mut(b"Fields")).map(|o| o.clone())) {
        let filtres: Vec<Object> = champs.into_iter().filter(|c| !retires.contains(c)).collect();
        if let Some(id) = acro {
            doc.get_dictionary_mut(id)?.set("Fields", Object::Array(filtres));
        }
    }
    Ok(retires.len() as u32)
}

/// Texte extrait des pages `numeros`, concatene.
fn texte_des_pages(doc: &Document, numeros: &[u32]) -> String {
    let pages = doc.get_pages();
    let propre = |n: &u32| pages.get(n).map(|&p| decodage::texte_page(doc, p)).unwrap_or_default();
    numeros.iter().flat_map(|n| [doc.extract_text(&[*n]).unwrap_or_default(), propre(n)]).collect::<Vec<_>>().join("
")
}

/// Caviarde les zones (chaque zone peut avoir sa couleur de recouvrement).
pub fn caviarder_couleurs(doc: &mut Document, zones: &[(Zone, Couleur)]) -> Resultat<RapportCaviardage> {
    if zones.is_empty() {
        return Err(param("aucune zone à caviarder"));
    }
    let pages = doc.get_pages();
    let mut rapport = RapportCaviardage::default();
    let mut numeros: Vec<u32> = zones.iter().map(|(z, _)| z.page).collect();
    numeros.sort_unstable();
    numeros.dedup();
    let texte_avant = texte_des_pages(doc, &numeros);
    let mut retires: Vec<String> = Vec::new();
    let mut touchees: Vec<ObjectId> = Vec::new();
    for num in numeros.iter().copied() {
        let page = *pages.get(&num).ok_or_else(|| param(format!("page {num} inexistante (1 à {})", pages.len())))?;
        touchees.push(page);
        let b = boite_page(doc, page);
        let rot = rotation_page(doc, page);
        let de_la_page: Vec<([f32; 4], Couleur)> = zones.iter().filter(|(z, _)| z.page == num).map(|(z, c)| (z.en_points_rot(b, rot), *c)).collect();
        let rects: Vec<[f32; 4]> = de_la_page.iter().map(|(r, _)| *r).collect();
        let mut res = herite(doc, page, b"Resources").map(|o| deref(doc, &o).as_dict().cloned().unwrap_or_default()).unwrap_or_default();
        let ops = doc.get_and_decode_page_content(page).map_err(|e| ConvertError::PdfInvalide(format!("contenu de la page {num} illisible : {e}")))?;
        let mut cav = Caviardeur { doc, rects: rects.clone(), rapport: RapportCaviardage::default(), retire: String::new() };
        let mut nouveaux = vec![Operation::new("q", vec![])];
        nouveaux.extend(cav.traiter(ops.operations, ID, &mut res, 0)?);
        let r = cav.rapport;
        retires.push(cav.retire);
        nouveaux.push(Operation::new("Q", vec![]));
        for (rect, c) in &de_la_page {
            nouveaux.extend([Operation::new("q", vec![]), c.remplissage(), op_rect(*rect), Operation::new("f", vec![]), Operation::new("Q", vec![])]);
        }
        let mut flux = Stream::new(Dictionary::new(), Content { operations: nouveaux }.encode()?);
        let _ = flux.compress();
        let id = doc.add_object(flux);
        let d = doc.get_dictionary_mut(page)?;
        d.set("Contents", Object::Reference(id));
        d.set("Resources", Object::Dictionary(res));
        rapport.glyphes_supprimes += r.glyphes_supprimes;
        rapport.images_masquees += r.images_masquees;
        rapport.images_supprimees += r.images_supprimees;
        rapport.formes_reecrites += r.formes_reecrites;
        rapport.traits_supprimes += r.traits_supprimes;
        rapport.traits_ecretes += r.traits_ecretes;
        rapport.annotations_supprimees += retirer_annotations(doc, page, &rects)?;
    }
    if rapport.images_supprimees > 0 {
        rapport.avertissements.push(format!(
            "{} image(s) ou forme(s) dans un format non décodable (masque d'image, palette, JPEG 2000, CCITT, forme illisible…) ont été supprimées en entier faute de pouvoir noircir seulement la zone.",
            rapport.images_supprimees
        ));
    }
    if rapport.traits_supprimes + rapport.traits_ecretes > 0 {
        rapport.avertissements.push(format!(
            "Tracés vectoriels : {} supprimé(s) et {} recadré(s) sous les zones (les courbes recadrées sont approchées par des segments).",
            rapport.traits_supprimes, rapport.traits_ecretes
        ));
    }
    // Miniatures, XMP, Info, signets, champs et structure gardent sinon le texte d'origine.
    let mots = super::purge::mots_retires(&texte_avant, &texte_des_pages(doc, &numeros), &retires);
    super::purge::purger(doc, &touchees, &mots, &mut rapport);
    // Les anciens flux (qui contiennent encore le texte) ne doivent pas rester dans le fichier.
    doc.prune_objects();
    Ok(rapport)
}

/// Caviardage noir.
pub fn caviarder(doc: &mut Document, zones: &[Zone]) -> Resultat<RapportCaviardage> {
    let z: Vec<(Zone, Couleur)> = zones.iter().map(|z| (*z, Couleur::NOIR)).collect();
    caviarder_couleurs(doc, &z)
}

/// Correctif de texte : l'ancien contenu de la zone est retire, puis la zone est
/// repeinte (fond) et le nouveau texte ecrit en haut a gauche.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Correctif {
    pub zone: Zone,
    pub texte: String,
    #[serde(default = "douze")]
    pub taille: f32,
    #[serde(default = "blanc")]
    pub fond: Couleur,
    #[serde(default = "noir")]
    pub couleur: Couleur,
}

fn douze() -> f32 {
    12.0
}
fn blanc() -> Couleur {
    Couleur::BLANC
}
fn noir() -> Couleur {
    Couleur::NOIR
}

/// Applique les correctifs de texte.
pub fn corriger(doc: &mut Document, correctifs: &[Correctif]) -> Resultat<RapportCaviardage> {
    for c in correctifs {
        if c.texte.chars().count() > 2000 || !(1.0..=200.0).contains(&c.taille) {
            return Err(param("correctif invalide (texte de 2000 caractères et taille 1 à 200 au maximum)"));
        }
    }
    let zones: Vec<(Zone, Couleur)> = correctifs.iter().map(|c| (c.zone, c.fond)).collect();
    let rapport = caviarder_couleurs(doc, &zones)?;
    let pages = doc.get_pages();
    for c in correctifs.iter().filter(|c| !c.texte.is_empty()) {
        let Some(&page) = pages.get(&c.zone.page) else { continue };
        // Le texte est ecrit dans le repere de la page AFFICHEE (origine en bas a gauche), puis ramene
        // dans l'espace utilisateur par la matrice de rotation : il reste droit sur une page pivotee.
        let (b, rot) = (boite_page(doc, page), rotation_page(doc, page));
        let r = {
            let (wd, hd) = dimensions_affichees(b, rot);
            let z = &c.zone;
            let k = |v: f32| v.clamp(0.0, 1.0);
            [k(z.x) * wd, hd - k(z.y + z.hauteur) * hd, k(z.x + z.largeur) * wd, hd - k(z.y) * hd]
        };
        let police = police_standard(doc, "Helvetica");
        let nom = super::ajouter_ressource(doc, page, b"Font", "FCor", Object::Reference(police))?;
        let m = matrice_affichage(b, rot);
        let mut ops = vec![Operation::new("q", vec![]), Operation::new("cm", m.iter().map(|&v| Object::Real(v)).collect()), c.couleur.remplissage()];
        for (i, ligne) in c.texte.lines().enumerate() {
            let y = r[3] - c.taille * (i as f32 + 1.0);
            if y < r[1] - c.taille * 0.2 {
                break;
            }
            ops.extend(ops_texte(&nom, c.taille, r[0] + 1.0, y + c.taille * 0.2, ligne));
        }
        ops.push(Operation::new("Q", vec![]));
        ajouter_contenu(doc, page, ops)?;
    }
    Ok(rapport)
}
