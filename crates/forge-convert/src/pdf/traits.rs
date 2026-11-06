//! Caviardage des traits vectoriels : les operateurs de dessin (m l c v y re h puis
//! S s f F f* B B* b b* n) sont accumules en un `Chemin`, puis, a l'operateur de peinture,
//! supprimes s'ils sont entierement sous une zone, ou recadres (la partie sous la zone est
//! reellement retiree de la geometrie : polygones decoupes pour un remplissage, polylignes
//! decoupees pour un trait). Les courbes touchees sont aplaties (12 segments), les autres
//! sous-chemins du meme dessin restent tels quels.
//!
//! ponytail: les morceaux d'un remplissage decoupe partagent une arete (couture possible a
//! l'antialiasing) ; les tirets repartent a zero apres coupe.

use super::geom::{echelle, inverse, point, polygone_moins, polygone_touche, polyligne_hors, polyligne_touche, Mat, Pt};
use super::nombre;
use lopdf::content::Operation;
use lopdf::Object;

/// Nombre maximal de segments d'un dessin examine (au-dela : supprime s'il touche une zone).
const MAX_SEGMENTS: usize = 200_000;
const PAS_COURBE: usize = 12;

#[derive(Clone, Copy)]
enum Seg {
    M(Pt),
    L(Pt),
    C(Pt, Pt, Pt),
    Z,
}

/// Dessin en cours de construction (avant son operateur de peinture).
#[derive(Default)]
pub(super) struct Chemin {
    pub ops: Vec<Operation>,
    segs: Vec<Seg>,
    courant: Pt,
    debut: Pt,
    /// Operateur d'ecretage (`W` ou `W*`) demande pour ce dessin.
    pub clip: Option<String>,
    trop_gros: bool,
}

pub(super) fn est_construction(op: &str) -> bool {
    matches!(op, "m" | "l" | "c" | "v" | "y" | "h" | "re")
}

pub(super) fn est_peinture(op: &str) -> bool {
    matches!(op, "S" | "s" | "f" | "F" | "f*" | "B" | "B*" | "b" | "b*" | "n")
}

impl Chemin {
    pub fn ajouter(&mut self, op: Operation) {
        let n = |i: usize| op.operands.get(i).map(nombre).unwrap_or(0.0);
        if self.segs.len() >= MAX_SEGMENTS {
            self.trop_gros = true;
        } else {
            match op.operator.as_str() {
                "m" => {
                    self.courant = (n(0), n(1));
                    self.debut = self.courant;
                    self.segs.push(Seg::M(self.courant));
                }
                "l" => {
                    self.courant = (n(0), n(1));
                    self.segs.push(Seg::L(self.courant));
                }
                "c" | "v" | "y" => {
                    let (p1, p2, p3) = match op.operator.as_str() {
                        "c" => ((n(0), n(1)), (n(2), n(3)), (n(4), n(5))),
                        "v" => (self.courant, (n(0), n(1)), (n(2), n(3))),
                        _ => ((n(0), n(1)), (n(2), n(3)), (n(2), n(3))),
                    };
                    self.courant = p3;
                    self.segs.push(Seg::C(p1, p2, p3));
                }
                "h" => {
                    self.courant = self.debut;
                    self.segs.push(Seg::Z);
                }
                "re" => {
                    let (x, y, w, h) = (n(0), n(1), n(2), n(3));
                    self.debut = (x, y);
                    self.courant = (x, y);
                    self.segs.extend([Seg::M((x, y)), Seg::L((x + w, y)), Seg::L((x + w, y + h)), Seg::L((x, y + h)), Seg::Z]);
                }
                _ => {}
            }
        }
        self.ops.push(op);
    }

    /// Sous-chemins (chacun commence par un `M`).
    fn sous_chemins(&self) -> Vec<&[Seg]> {
        let mut res = Vec::new();
        let mut debut = 0;
        for (i, s) in self.segs.iter().enumerate() {
            if matches!(s, Seg::M(_)) && i > debut {
                res.push(&self.segs[debut..i]);
                debut = i;
            }
        }
        if debut < self.segs.len() {
            res.push(&self.segs[debut..]);
        }
        res.into_iter().filter(|s| s.len() > 1).collect()
    }
}

/// Points de controle d'un sous-chemin dans la page (pour la boite englobante).
fn boite_sous(s: &[Seg], m: Mat) -> [f32; 4] {
    let mut b = [f32::MAX, f32::MAX, f32::MIN, f32::MIN];
    let mut vu = |p: Pt| {
        let (x, y) = point(m, p.0, p.1);
        b = [b[0].min(x), b[1].min(y), b[2].max(x), b[3].max(y)];
    };
    for seg in s {
        match *seg {
            Seg::M(p) | Seg::L(p) => vu(p),
            Seg::C(a, c, d) => [a, c, d].into_iter().for_each(&mut vu),
            Seg::Z => {}
        }
    }
    b
}

fn grossir(b: [f32; 4], p: f32) -> [f32; 4] {
    [b[0] - p, b[1] - p, b[2] + p, b[3] + p]
}

fn touche_boite(b: [f32; 4], r: [f32; 4]) -> bool {
    b[0] <= r[2] && b[2] >= r[0] && b[1] <= r[3] && b[3] >= r[1]
}

/// Sous-chemin aplati dans la page : points et indicateur « ferme ».
fn aplatir(s: &[Seg], m: Mat) -> (Vec<Pt>, bool) {
    let mut pts: Vec<Pt> = Vec::new();
    let mut ferme = false;
    for seg in s {
        match *seg {
            Seg::M(p) | Seg::L(p) => pts.push(point(m, p.0, p.1)),
            Seg::C(a, b, c) => {
                let Some(p0) = pts.last().copied() else { continue };
                let (a, b, c) = (point(m, a.0, a.1), point(m, b.0, b.1), point(m, c.0, c.1));
                for k in 1..=PAS_COURBE {
                    let t = k as f32 / PAS_COURBE as f32;
                    let u = 1.0 - t;
                    let (w0, w1, w2, w3) = (u * u * u, 3.0 * u * u * t, 3.0 * u * t * t, t * t * t);
                    pts.push((w0 * p0.0 + w1 * a.0 + w2 * b.0 + w3 * c.0, w0 * p0.1 + w1 * a.1 + w2 * b.1 + w3 * c.1));
                }
            }
            Seg::Z => ferme = true,
        }
    }
    (pts, ferme)
}

fn ops_seg(s: &[Seg], out: &mut Vec<Operation>) {
    let r = Object::Real;
    for seg in s {
        out.push(match *seg {
            Seg::M(p) => Operation::new("m", vec![r(p.0), r(p.1)]),
            Seg::L(p) => Operation::new("l", vec![r(p.0), r(p.1)]),
            Seg::C(a, b, c) => Operation::new("c", vec![r(a.0), r(a.1), r(b.0), r(b.1), r(c.0), r(c.1)]),
            Seg::Z => Operation::new("h", vec![]),
        });
    }
}

/// Polyligne de la page ramenee dans l'espace utilisateur.
fn ops_poly(pts: &[Pt], ferme: bool, inv: Mat, out: &mut Vec<Operation>) {
    for (i, &(x, y)) in pts.iter().enumerate() {
        let (x, y) = point(inv, x, y);
        out.push(Operation::new(if i == 0 { "m" } else { "l" }, vec![Object::Real(x), Object::Real(y)]));
    }
    if ferme {
        out.push(Operation::new("h", vec![]));
    }
}

/// Que devient un dessin peint par `paint` ?
pub(super) enum Issue {
    Intact,
    /// Entierement sous une zone (ou trop complexe) : rien a conserver.
    Retire,
    /// Operateurs de remplacement (peinture comprise).
    Ecrete(Vec<Operation>),
}

/// Decide du sort d'un dessin. `lw` : epaisseur de trait (unites utilisateur), `ctm` : matrice courante.
pub(super) fn peindre(ch: &Chemin, paint: &str, ctm: Mat, lw: f32, rects: &[[f32; 4]]) -> Issue {
    let remplit = matches!(paint, "f" | "F" | "f*" | "B" | "B*" | "b" | "b*");
    let trace = matches!(paint, "S" | "s" | "B" | "B*" | "b" | "b*");
    if !remplit && !trace {
        return Issue::Intact;
    }
    let pad = if trace { (lw.abs() * echelle(ctm)).max(0.0) } else { 0.0 };
    let sous = ch.sous_chemins();
    let boites: Vec<[f32; 4]> = sous.iter().map(|s| grossir(boite_sous(s, ctm), pad)).collect();
    let touchantes = |b: [f32; 4]| rects.iter().filter(move |&&r| touche_boite(b, r)).copied().collect::<Vec<_>>();
    if boites.iter().all(|&b| touchantes(b).is_empty()) {
        return Issue::Intact;
    }
    let Some(inv) = inverse(ctm) else { return Issue::Retire };
    if ch.trop_gros {
        return Issue::Retire;
    }
    let ferme_fin = matches!(paint, "s" | "b" | "b*");
    let (mut ops_remplir, mut ops_tracer) = (Vec::new(), Vec::new());
    let mut change = false;
    for (i, s) in sous.iter().enumerate() {
        let zones = touchantes(boites[i]);
        let (pts, mut ferme) = if zones.is_empty() { (Vec::new(), false) } else { aplatir(s, ctm) };
        if ferme_fin && i + 1 == sous.len() {
            ferme = true;
        }
        // Remplissage : le polygone moins les zones.
        if remplit {
            if zones.iter().any(|&r| polygone_touche(&pts, r)) {
                change = true;
                let mut morceaux = vec![pts.clone()];
                for &r in &zones {
                    morceaux = morceaux.into_iter().flat_map(|p| if polygone_touche(&p, r) { polygone_moins(&p, r) } else { vec![p] }).collect();
                }
                morceaux.iter().for_each(|p| ops_poly(p, true, inv, &mut ops_remplir));
            } else {
                ops_seg(s, &mut ops_remplir);
            }
        }
        // Trait : la polyligne moins les zones agrandies de la demi-epaisseur.
        if trace {
            let grandes: Vec<[f32; 4]> = zones.iter().map(|&r| grossir(r, pad / 2.0)).collect();
            if grandes.iter().any(|&r| polyligne_touche(&pts, ferme, r)) {
                change = true;
                let mut morceaux = vec![pts.clone()];
                let mut ferme_courant = ferme;
                for &r in &grandes {
                    morceaux = morceaux.into_iter().flat_map(|p| polyligne_hors(&p, ferme_courant, r)).collect();
                    ferme_courant = false;
                }
                morceaux.iter().for_each(|p| ops_poly(p, false, inv, &mut ops_tracer));
            } else {
                ops_seg(s, &mut ops_tracer);
            }
        }
    }
    if !change {
        return Issue::Intact;
    }
    let mut sortie = Vec::new();
    if remplit && !ops_remplir.is_empty() {
        sortie.append(&mut ops_remplir);
        sortie.push(Operation::new(if paint.ends_with('*') { "f*" } else { "f" }, vec![]));
    }
    if trace && !ops_tracer.is_empty() {
        sortie.append(&mut ops_tracer);
        sortie.push(Operation::new("S", vec![]));
    }
    if sortie.is_empty() {
        Issue::Retire
    } else {
        Issue::Ecrete(sortie)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::pdf::geom::ID;

    fn op(nom: &str, v: &[f32]) -> Operation {
        Operation::new(nom, v.iter().map(|&x| Object::Real(x)).collect())
    }

    #[test]
    fn trait_sous_la_zone_retire_et_trait_voisin_conserve() {
        let mut ch = Chemin::default();
        ch.ajouter(op("m", &[10.0, 50.0]));
        ch.ajouter(op("l", &[40.0, 50.0]));
        let zone = [[0.0, 40.0, 100.0, 60.0]];
        assert!(matches!(peindre(&ch, "S", ID, 1.0, &zone), Issue::Retire));
        assert!(matches!(peindre(&ch, "S", ID, 1.0, &[[0.0, 0.0, 100.0, 10.0]]), Issue::Intact));
    }

    #[test]
    fn rectangle_rempli_a_demi_couvert_est_decoupe() {
        let mut ch = Chemin::default();
        ch.ajouter(op("re", &[0.0, 0.0, 100.0, 10.0]));
        let Issue::Ecrete(ops) = peindre(&ch, "f", ID, 1.0, &[[40.0, -5.0, 60.0, 15.0]]) else { panic!() };
        let xs: Vec<f32> = ops.iter().filter(|o| o.operator == "m" || o.operator == "l").map(|o| nombre(&o.operands[0])).collect();
        assert!(xs.iter().all(|&x| x <= 40.001 || x >= 59.999), "{xs:?}");
        assert!(ops.last().is_some_and(|o| o.operator == "f"));
    }
}
