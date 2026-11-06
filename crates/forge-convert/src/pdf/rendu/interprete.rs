//! Interpreteur de flux de contenu pour le rendu simplifie : etat graphique, chemins,
//! couleurs Device, ecretage, formulaires XObject et texte. Les images sont dans `dessin`,
//! les polices dans `texte`.

use super::texte::{charger_fonte, Fonte, Systeme};
use crate::pdf::geom::{mul, Mat, ID};
use crate::pdf::nombre;
use crate::pdf::police::deref;
use lopdf::content::{Content, Operation};
use lopdf::{Dictionary, Document, Object};
use std::collections::{BTreeSet, HashMap};
use std::rc::Rc;
use tiny_skia::{FillRule, LineCap, LineJoin, Mask, Paint, PathBuilder, Pixmap, Stroke, StrokeDash, Transform};

/// Operateurs executes au maximum par page (anti-boucle de formulaires).
const MAX_OPS: u64 = 5_000_000;
/// Profondeur maximale de q imbriques (chaque niveau peut garder un masque d'ecretage).
const MAX_PILE: usize = 48;
const PROFONDEUR_MAX: u32 = 8;

#[derive(Clone)]
pub(super) struct Etat {
    pub ctm: Mat,
    pub remplissage: [f32; 3],
    pub trait_: [f32; 3],
    pub opacite_r: f32,
    pub opacite_t: f32,
    lw: f32,
    cap: LineCap,
    join: LineJoin,
    miter: f32,
    tirets: (Vec<f32>, f32),
    pub clip: Option<Rc<Mask>>,
    tc: f32,
    tw: f32,
    th: f32,
    tl: f32,
    tfs: f32,
    trise: f32,
    mode: i64,
    fonte: Option<Rc<Fonte>>,
}

pub(super) struct Interprete<'a> {
    pub doc: &'a Document,
    pub pix: &'a mut Pixmap,
    pub base: Mat,
    pub e: Etat,
    pile: Vec<Etat>,
    pb: PathBuilder,
    courant: (f32, f32),
    debut: (f32, f32),
    clip_attente: Option<FillRule>,
    tm: Mat,
    tlm: Mat,
    systeme: &'a mut Systeme,
    pub avert: BTreeSet<String>,
    ops: u64,
    polices: HashMap<Vec<u8>, Rc<Fonte>>,
}

fn matrice(o: &[Object]) -> Option<Mat> {
    (o.len() == 6).then(|| [0, 1, 2, 3, 4, 5].map(|i| nombre(&o[i])))
}

pub(super) fn transform(m: Mat) -> Transform {
    Transform::from_row(m[0], m[1], m[2], m[3], m[4], m[5])
}

/// Couleur Device d'apres le nombre d'operandes numeriques (gris, RVB, CMYK).
fn couleur(o: &[Object]) -> Option<[f32; 3]> {
    let v: Vec<f32> = o.iter().filter(|x| matches!(x, Object::Integer(_) | Object::Real(_))).map(nombre).map(|x| x.clamp(0.0, 1.0)).collect();
    match v.len() {
        1 => Some([v[0]; 3]),
        3 => Some([v[0], v[1], v[2]]),
        4 => Some([(1.0 - v[0]) * (1.0 - v[3]), (1.0 - v[1]) * (1.0 - v[3]), (1.0 - v[2]) * (1.0 - v[3])]),
        _ => None,
    }
}

pub(super) fn peinture(c: [f32; 3], alpha: f32) -> Paint<'static> {
    let mut p = Paint::default();
    p.set_color(tiny_skia::Color::from_rgba(c[0], c[1], c[2], alpha.clamp(0.0, 1.0)).unwrap_or(tiny_skia::Color::BLACK));
    p.anti_alias = true;
    p
}

impl<'a> Interprete<'a> {
    pub fn nouveau(doc: &'a Document, pix: &'a mut Pixmap, base: Mat, systeme: &'a mut Systeme) -> Self {
        let e = Etat {
            ctm: ID,
            remplissage: [0.0; 3],
            trait_: [0.0; 3],
            opacite_r: 1.0,
            opacite_t: 1.0,
            lw: 1.0,
            cap: LineCap::Butt,
            join: LineJoin::Miter,
            miter: 10.0,
            tirets: (Vec::new(), 0.0),
            clip: None,
            tc: 0.0,
            tw: 0.0,
            th: 1.0,
            tl: 0.0,
            tfs: 0.0,
            trise: 0.0,
            mode: 0,
            fonte: None,
        };
        Interprete { doc, pix, base, e, pile: Vec::new(), pb: PathBuilder::new(), courant: (0.0, 0.0), debut: (0.0, 0.0), clip_attente: None, tm: ID, tlm: ID, systeme, avert: BTreeSet::new(), ops: 0, polices: HashMap::new() }
    }

    pub fn matrice_peinture(&self) -> Transform {
        transform(mul(self.e.ctm, self.base))
    }

    fn peindre(&mut self, remplir: Option<FillRule>, tracer: bool) {
        let pb = std::mem::take(&mut self.pb);
        let attente = self.clip_attente.take();
        let Some(path) = pb.finish() else { return };
        let ts = self.matrice_peinture();
        let masque = self.e.clip.clone();
        if let Some(regle) = remplir {
            self.pix.fill_path(&path, &peinture(self.e.remplissage, self.e.opacite_r), regle, ts, masque.as_deref());
        }
        if tracer {
            let mut st = Stroke { width: self.e.lw, line_cap: self.e.cap, line_join: self.e.join, miter_limit: self.e.miter, ..Stroke::default() };
            st.dash = StrokeDash::new(self.e.tirets.0.clone(), self.e.tirets.1);
            self.pix.stroke_path(&path, &peinture(self.e.trait_, self.e.opacite_t), &st, ts, masque.as_deref());
        }
        if let Some(regle) = attente {
            self.ecreter(&path, regle, ts);
        }
    }

    /// Intersecte l'ecretage courant avec le chemin.
    pub fn ecreter(&mut self, path: &tiny_skia::Path, regle: FillRule, ts: Transform) {
        let masque = match self.e.clip.as_deref() {
            Some(m) => {
                let mut m = m.clone();
                m.intersect_path(path, regle, true, ts);
                m
            }
            None => {
                let Some(mut m) = Mask::new(self.pix.width(), self.pix.height()) else { return };
                m.fill_path(path, regle, true, ts);
                m
            }
        };
        self.e.clip = Some(Rc::new(masque));
    }

    fn etat_graphique(&mut self, res: &Dictionary, nom: Option<&Object>) {
        let Some(nom) = nom.and_then(|o| o.as_name().ok()) else { return };
        let gs = res.get(b"ExtGState").ok().map(|o| deref(self.doc, o)).and_then(|o| o.as_dict().ok()).and_then(|d| d.get(nom).ok()).map(|o| deref(self.doc, o)).and_then(|o| o.as_dict().ok());
        let Some(gs) = gs else { return };
        let lire = |k: &[u8]| gs.get(k).ok().map(|o| nombre(deref(self.doc, o)));
        if let Some(v) = lire(b"LW") {
            self.e.lw = v;
        }
        if let Some(v) = lire(b"ca") {
            self.e.opacite_r = v;
        }
        if let Some(v) = lire(b"CA") {
            self.e.opacite_t = v;
        }
    }

    /// Execute des operateurs avec les ressources `res`.
    pub fn executer(&mut self, ops: Vec<Operation>, res: &Dictionary, prof: u32) {
        let polices_avant = std::mem::take(&mut self.polices);
        let pile_avant = self.pile.len();
        for op in ops {
            self.ops += 1;
            if self.ops > MAX_OPS {
                self.avert.insert("Page trop complexe : le dessin a été interrompu.".into());
                break;
            }
            self.operateur(&op, res, prof);
        }
        self.pile.truncate(pile_avant);
        self.polices = polices_avant;
    }

    fn operateur(&mut self, op: &Operation, res: &Dictionary, prof: u32) {
        let o = &op.operands;
        let n = |i: usize| o.get(i).map(nombre).unwrap_or(0.0);
        match op.operator.as_str() {
            "q" if self.pile.len() < MAX_PILE => self.pile.push(self.e.clone()),
            "Q" => {
                if let Some(e) = self.pile.pop() {
                    self.e = e;
                }
            }
            "cm" => {
                if let Some(m) = matrice(o) {
                    self.e.ctm = mul(m, self.e.ctm);
                }
            }
            "w" => self.e.lw = n(0),
            "J" => self.e.cap = [LineCap::Butt, LineCap::Round, LineCap::Square][(n(0) as usize).min(2)],
            "j" => self.e.join = [LineJoin::Miter, LineJoin::Round, LineJoin::Bevel][(n(0) as usize).min(2)],
            "M" => self.e.miter = n(0).max(1.0),
            "d" => {
                let tirets: Vec<f32> = o.first().and_then(|a| a.as_array().ok()).map(|a| a.iter().map(nombre).collect()).unwrap_or_default();
                self.e.tirets = (tirets, n(1));
            }
            "gs" => self.etat_graphique(res, o.first()),
            "m" => {
                self.courant = (n(0), n(1));
                self.debut = self.courant;
                self.pb.move_to(n(0), n(1));
            }
            "l" => {
                self.courant = (n(0), n(1));
                self.pb.line_to(n(0), n(1));
            }
            "c" => {
                self.pb.cubic_to(n(0), n(1), n(2), n(3), n(4), n(5));
                self.courant = (n(4), n(5));
            }
            "v" => {
                self.pb.cubic_to(self.courant.0, self.courant.1, n(0), n(1), n(2), n(3));
                self.courant = (n(2), n(3));
            }
            "y" => {
                self.pb.cubic_to(n(0), n(1), n(2), n(3), n(2), n(3));
                self.courant = (n(2), n(3));
            }
            "h" => {
                self.pb.close();
                self.courant = self.debut;
            }
            "re" => {
                let (x, y, w, h) = (n(0), n(1), n(2), n(3));
                self.pb.move_to(x, y);
                self.pb.line_to(x + w, y);
                self.pb.line_to(x + w, y + h);
                self.pb.line_to(x, y + h);
                self.pb.close();
                self.debut = (x, y);
                self.courant = (x, y);
            }
            "S" => self.peindre(None, true),
            "s" => {
                self.pb.close();
                self.peindre(None, true);
            }
            "f" | "F" => self.peindre(Some(FillRule::Winding), false),
            "f*" => self.peindre(Some(FillRule::EvenOdd), false),
            "B" => self.peindre(Some(FillRule::Winding), true),
            "B*" => self.peindre(Some(FillRule::EvenOdd), true),
            "b" | "b*" => {
                self.pb.close();
                self.peindre(Some(if op.operator == "b" { FillRule::Winding } else { FillRule::EvenOdd }), true);
            }
            "n" => self.peindre(None, false),
            "W" => self.clip_attente = Some(FillRule::Winding),
            "W*" => self.clip_attente = Some(FillRule::EvenOdd),
            "g" | "rg" | "k" | "sc" | "scn" => {
                if let Some(c) = couleur(o) {
                    self.e.remplissage = c;
                }
            }
            "G" | "RG" | "K" | "SC" | "SCN" => {
                if let Some(c) = couleur(o) {
                    self.e.trait_ = c;
                }
            }
            "sh" => {
                self.avert.insert("Des dégradés (sh) ne sont pas reproduits.".into());
            }
            "BI" => {
                self.avert.insert("Des images en ligne (BI) ne sont pas reproduites.".into());
            }
            "Do" => self.executer_do(o.first().and_then(|x| x.as_name().ok()), res, prof),
            _ => self.operateur_texte(op, res),
        }
    }

    fn executer_do(&mut self, nom: Option<&[u8]>, res: &Dictionary, prof: u32) {
        let Some(nom) = nom else { return };
        let xo = res.get(b"XObject").ok().map(|o| deref(self.doc, o)).and_then(|o| o.as_dict().ok());
        let Some(s) = xo.and_then(|x| x.get(nom).ok()).map(|o| deref(self.doc, o)).and_then(|o| o.as_stream().ok()) else { return };
        match s.dict.get(b"Subtype").and_then(Object::as_name) {
            Ok(b"Image") => self.image(s),
            Ok(b"Form") if prof < PROFONDEUR_MAX => {
                let Ok(contenu) = s.decompressed_content() else { return };
                let Ok(ops) = Content::decode(&contenu) else { return };
                let sauve = self.e.clone();
                let m = s.dict.get(b"Matrix").ok().map(|o| deref(self.doc, o)).and_then(|o| o.as_array().ok()).and_then(|a| matrice(a)).unwrap_or(ID);
                self.e.ctm = mul(m, self.e.ctm);
                if let Some(bb) = s.dict.get(b"BBox").ok().map(|o| deref(self.doc, o)).and_then(|o| o.as_array().ok()).filter(|a| a.len() == 4) {
                    let v = [0, 1, 2, 3].map(|i| nombre(deref(self.doc, &bb[i])));
                    if let Some(r) = tiny_skia::Rect::from_ltrb(v[0].min(v[2]), v[1].min(v[3]), v[0].max(v[2]), v[1].max(v[3])) {
                        let ts = self.matrice_peinture();
                        self.ecreter(&PathBuilder::from_rect(r), FillRule::Winding, ts);
                    }
                }
                let res_f = s.dict.get(b"Resources").ok().map(|o| deref(self.doc, o)).and_then(|o| o.as_dict().ok()).unwrap_or(res);
                let (tm, tlm) = (self.tm, self.tlm);
                self.executer(ops.operations, res_f, prof + 1);
                self.tm = tm;
                self.tlm = tlm;
                self.e = sauve;
            }
            Ok(b"Form") => {
                self.avert.insert("Des formulaires trop imbriqués ont été ignorés.".into());
            }
            _ => {}
        }
    }

    // ── Texte ────────────────────────────────────────────────────────────────

    fn operateur_texte(&mut self, op: &Operation, res: &Dictionary) {
        let o = &op.operands;
        let n = |i: usize| o.get(i).map(nombre).unwrap_or(0.0);
        match op.operator.as_str() {
            "BT" => {
                self.tm = ID;
                self.tlm = ID;
            }
            "Tc" => self.e.tc = n(0),
            "Tw" => self.e.tw = n(0),
            "Tz" => self.e.th = n(0) / 100.0,
            "TL" => self.e.tl = n(0),
            "Ts" => self.e.trise = n(0),
            "Tr" => self.e.mode = n(0) as i64,
            "Tf" => {
                let nom = o.first().and_then(|x| x.as_name().ok()).map(<[u8]>::to_vec).unwrap_or_default();
                self.e.tfs = n(1);
                let f = match self.polices.get(&nom) {
                    Some(f) => f.clone(),
                    None => {
                        let f = Rc::new(charger_fonte(self.doc, res, &nom, self.systeme));
                        self.polices.insert(nom, f.clone());
                        f
                    }
                };
                self.e.fonte = Some(f);
            }
            "Td" | "TD" => {
                if op.operator == "TD" {
                    self.e.tl = -n(1);
                }
                self.tlm = mul([1.0, 0.0, 0.0, 1.0, n(0), n(1)], self.tlm);
                self.tm = self.tlm;
            }
            "Tm" => {
                if let Some(m) = matrice(o) {
                    self.tlm = m;
                    self.tm = m;
                }
            }
            "T*" => self.ligne_suivante(),
            "Tj" => self.montrer(o),
            "TJ" => {
                if let Some(Object::Array(a)) = o.first() {
                    self.montrer(a);
                }
            }
            "'" | "\"" => {
                if op.operator == "\"" {
                    self.e.tw = n(0);
                    self.e.tc = n(1);
                }
                self.ligne_suivante();
                self.montrer(&o[o.len().saturating_sub(1)..]);
            }
            _ => {}
        }
    }

    fn ligne_suivante(&mut self) {
        self.tlm = mul([1.0, 0.0, 0.0, 1.0, 0.0, -self.e.tl], self.tlm);
        self.tm = self.tlm;
    }

    /// Dessine les chaines et avance la position du texte.
    fn montrer(&mut self, elements: &[Object]) {
        let Some(fonte) = self.e.fonte.clone() else { return };
        for el in elements {
            let Object::String(octets, _) = el else {
                let n = nombre(el);
                self.tm = mul([1.0, 0.0, 0.0, 1.0, -n / 1000.0 * self.e.tfs * self.e.th, 0.0], self.tm);
                continue;
            };
            for (code, code_o) in fonte.police.dec.decouper(octets) {
                let w0 = fonte.police.largeur(code);
                let espace = if code_o.len() == 1 && code == 32 { self.e.tw } else { 0.0 };
                if self.e.mode != 3 && !fonte.type3 {
                    self.glyphe(&fonte, code, w0);
                }
                self.tm = mul([1.0, 0.0, 0.0, 1.0, (w0 * self.e.tfs + self.e.tc + espace) * self.e.th, 0.0], self.tm);
            }
        }
    }

    fn glyphe(&mut self, fonte: &Fonte, code: u32, w0: f32) {
        let trm = mul([self.e.tfs * self.e.th, 0.0, 0.0, self.e.tfs, 0.0, self.e.trise], mul(self.tm, self.e.ctm));
        let ts = transform(mul(trm, self.base));
        let masque = self.e.clip.clone();
        let remplit = matches!(self.e.mode, 0 | 2 | 4 | 6);
        match fonte.contour(code) {
            Some(path) => {
                if remplit {
                    self.pix.fill_path(&path, &peinture(self.e.remplissage, self.e.opacite_r), FillRule::Winding, ts, masque.as_deref());
                }
                if matches!(self.e.mode, 1 | 2 | 5 | 6) {
                    let st = Stroke { width: self.e.lw / self.e.tfs.abs().max(1e-3), ..Stroke::default() };
                    self.pix.stroke_path(&path, &peinture(self.e.trait_, self.e.opacite_t), &st, ts, masque.as_deref());
                }
            }
            None if code != 32 && remplit && !fonte.a_des_contours() => {
                // Aucune police exploitable : un rectangle clair marque la place du glyphe.
                if let Some(r) = tiny_skia::Rect::from_xywh(w0 * 0.08, 0.0, (w0 * 0.84).max(0.05), 0.68) {
                    self.avert.insert("Du texte a été remplacé par des repères gris faute de police exploitable.".into());
                    self.pix.fill_path(&PathBuilder::from_rect(r), &peinture(self.e.remplissage, self.e.opacite_r * 0.45), FillRule::Winding, ts, masque.as_deref());
                }
            }
            None => {}
        }
    }
}
