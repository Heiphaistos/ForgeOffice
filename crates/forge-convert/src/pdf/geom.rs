//! Geometrie 2D commune au caviardage : matrices PDF [a b c d e f], boites,
//! recadrage de polygones et de polylignes par un rectangle.

pub(super) type Mat = [f32; 6];
pub(super) const ID: Mat = [1.0, 0.0, 0.0, 1.0, 0.0, 0.0];

pub(super) fn mul(a: Mat, b: Mat) -> Mat {
    [
        a[0] * b[0] + a[1] * b[2],
        a[0] * b[1] + a[1] * b[3],
        a[2] * b[0] + a[3] * b[2],
        a[2] * b[1] + a[3] * b[3],
        a[4] * b[0] + a[5] * b[2] + b[4],
        a[4] * b[1] + a[5] * b[3] + b[5],
    ]
}

pub(super) fn point(m: Mat, x: f32, y: f32) -> (f32, f32) {
    (x * m[0] + y * m[2] + m[4], x * m[1] + y * m[3] + m[5])
}

pub(super) fn inverse(m: Mat) -> Option<Mat> {
    let det = m[0] * m[3] - m[1] * m[2];
    if det.abs() < 1e-12 || !det.is_finite() {
        return None;
    }
    Some([m[3] / det, -m[1] / det, -m[2] / det, m[0] / det, (m[2] * m[5] - m[3] * m[4]) / det, (m[1] * m[4] - m[0] * m[5]) / det])
}

/// Facteur d'echelle lineaire moyen d'une matrice.
pub(super) fn echelle(m: Mat) -> f32 {
    (m[0] * m[3] - m[1] * m[2]).abs().sqrt()
}

/// Boite englobante (x0, y0, x1, y1) du rectangle transforme par `m`.
pub(super) fn boite(m: Mat, x0: f32, y0: f32, x1: f32, y1: f32) -> [f32; 4] {
    let pts = [point(m, x0, y0), point(m, x1, y0), point(m, x0, y1), point(m, x1, y1)];
    let mut b = [f32::MAX, f32::MAX, f32::MIN, f32::MIN];
    for (x, y) in pts {
        b = [b[0].min(x), b[1].min(y), b[2].max(x), b[3].max(y)];
    }
    b
}

pub(super) fn chevauche(b: [f32; 4], r: [f32; 4]) -> bool {
    b[0] < r[2] && b[2] > r[0] && b[1] < r[3] && b[3] > r[1]
}

pub(super) type Pt = (f32, f32);

/// Intervalle [t0, t1] du segment a->b qui est dans le rectangle `r` (Liang-Barsky).
fn dans_rect(a: Pt, b: Pt, r: [f32; 4]) -> Option<(f32, f32)> {
    let (mut t0, mut t1) = (0.0f32, 1.0f32);
    let d = (b.0 - a.0, b.1 - a.1);
    for (p, q) in [(-d.0, a.0 - r[0]), (d.0, r[2] - a.0), (-d.1, a.1 - r[1]), (d.1, r[3] - a.1)] {
        if p.abs() < 1e-12 {
            if q < 0.0 {
                return None;
            }
        } else {
            let t = q / p;
            if p < 0.0 {
                t0 = t0.max(t);
            } else {
                t1 = t1.min(t);
            }
        }
    }
    (t0 < t1).then_some((t0, t1))
}

fn lerp(a: Pt, b: Pt, t: f32) -> Pt {
    (a.0 + (b.0 - a.0) * t, a.1 + (b.1 - a.1) * t)
}

/// Vrai si la polyligne entre dans le rectangle.
pub(super) fn polyligne_touche(pts: &[Pt], ferme: bool, r: [f32; 4]) -> bool {
    let n = pts.len();
    (0..if ferme { n } else { n.saturating_sub(1) }).any(|i| dans_rect(pts[i], pts[(i + 1) % n], r).is_some())
}

/// Parties de la polyligne HORS du rectangle (une polyligne ouverte par morceau).
pub(super) fn polyligne_hors(pts: &[Pt], ferme: bool, r: [f32; 4]) -> Vec<Vec<Pt>> {
    let n = pts.len();
    let mut morceaux: Vec<Vec<Pt>> = Vec::new();
    let mut courant: Vec<Pt> = Vec::new();
    let fin = |c: &mut Vec<Pt>, m: &mut Vec<Vec<Pt>>| {
        if c.len() > 1 {
            m.push(std::mem::take(c));
        } else {
            c.clear();
        }
    };
    for i in 0..if ferme { n } else { n.saturating_sub(1) } {
        let (a, b) = (pts[i], pts[(i + 1) % n]);
        match dans_rect(a, b, r) {
            None => {
                if courant.is_empty() {
                    courant.push(a);
                }
                courant.push(b);
            }
            Some((t0, t1)) => {
                if t0 > 0.0 {
                    if courant.is_empty() {
                        courant.push(a);
                    }
                    courant.push(lerp(a, b, t0));
                }
                fin(&mut courant, &mut morceaux);
                if t1 < 1.0 {
                    courant.push(lerp(a, b, t1));
                    courant.push(b);
                }
            }
        }
    }
    fin(&mut courant, &mut morceaux);
    morceaux
}

/// Sutherland-Hodgman : partie du polygone dans la boite (bornes infinies permises).
pub(super) fn polygone_dans(poly: &[Pt], r: [f32; 4]) -> Vec<Pt> {
    let mut p: Vec<Pt> = poly.to_vec();
    // (axe, valeur, garder le cote superieur)
    for (axe, v, sup) in [(0, r[0], true), (0, r[2], false), (1, r[1], true), (1, r[3], false)] {
        if !v.is_finite() {
            continue;
        }
        let val = |q: Pt| if axe == 0 { q.0 } else { q.1 };
        let dedans = |q: Pt| if sup { val(q) >= v } else { val(q) <= v };
        let mut sortie = Vec::with_capacity(p.len() + 4);
        for i in 0..p.len() {
            let (a, b) = (p[i], p[(i + 1) % p.len()]);
            let (da, db) = (dedans(a), dedans(b));
            if da {
                sortie.push(a);
            }
            if da != db {
                let (va, vb) = (val(a), val(b));
                let t = if (vb - va).abs() < 1e-12 { 0.0 } else { (v - va) / (vb - va) };
                sortie.push(lerp(a, b, t));
            }
        }
        p = sortie;
        if p.len() < 3 {
            return Vec::new();
        }
    }
    p
}

/// Vrai si un polygone (regle pair-impair) contient le point.
pub(super) fn polygone_contient(poly: &[Pt], p: Pt) -> bool {
    let mut dedans = false;
    let n = poly.len();
    for i in 0..n {
        let (a, b) = (poly[i], poly[(i + 1) % n]);
        if (a.1 > p.1) != (b.1 > p.1) && p.0 < (b.0 - a.0) * (p.1 - a.1) / (b.1 - a.1) + a.0 {
            dedans = !dedans;
        }
    }
    dedans
}

/// Le polygone recoupe-t-il le rectangle (sommet dedans, arete qui le traverse, ou rectangle englobe) ?
pub(super) fn polygone_touche(poly: &[Pt], r: [f32; 4]) -> bool {
    polyligne_touche(poly, true, r) || polygone_contient(poly, (r[0], r[1]))
}

/// Polygone moins un rectangle : jusqu'a 4 morceaux disjoints (gauche, droite, bas, haut).
pub(super) fn polygone_moins(poly: &[Pt], r: [f32; 4]) -> Vec<Vec<Pt>> {
    let inf = f32::INFINITY;
    [[-inf, -inf, r[0], inf], [r[2], -inf, inf, inf], [r[0], -inf, r[2], r[1]], [r[0], r[3], r[2], inf]]
        .into_iter()
        .map(|b| polygone_dans(poly, b))
        .filter(|p| p.len() >= 3)
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn polygone_moins_retire_la_zone() {
        let carre = [(0.0, 0.0), (10.0, 0.0), (10.0, 10.0), (0.0, 10.0)];
        let morceaux = polygone_moins(&carre, [4.0, 4.0, 6.0, 6.0]);
        assert_eq!(morceaux.len(), 4);
        let aire = |p: &Vec<Pt>| (0..p.len()).map(|i| p[i].0 * p[(i + 1) % p.len()].1 - p[(i + 1) % p.len()].0 * p[i].1).sum::<f32>().abs() / 2.0;
        let total: f32 = morceaux.iter().map(aire).sum();
        assert!((total - 96.0).abs() < 1e-3, "{total}");
    }

    #[test]
    fn polyligne_hors_coupe_le_milieu() {
        let m = polyligne_hors(&[(0.0, 5.0), (10.0, 5.0)], false, [4.0, 0.0, 6.0, 10.0]);
        assert_eq!(m.len(), 2);
        assert_eq!(m[0], vec![(0.0, 5.0), (4.0, 5.0)]);
        assert_eq!(m[1], vec![(6.0, 5.0), (10.0, 5.0)]);
        assert!(polyligne_hors(&[(5.0, 1.0), (5.0, 9.0)], false, [4.0, 0.0, 6.0, 10.0]).is_empty());
    }
}
