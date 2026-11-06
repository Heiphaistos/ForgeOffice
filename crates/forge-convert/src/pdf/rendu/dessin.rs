//! Images du rendu simplifie : JPEG, Flate gris/RVB 8 bits, masque doux (SMask) et masques
//! d'image 1 bit. Les autres formats sont remplaces par un cadre gris annonce a l'utilisateur.

use super::interprete::{peinture, transform, Interprete};
use crate::pdf::geom::mul;
use crate::pdf::images::{decoder_jpeg_libre, decoder_xobject};
use crate::pdf::police::deref;
use image::{DynamicImage, GenericImageView};
use lopdf::{Document, Object, Stream};
use tiny_skia::{FillRule, FilterQuality, Paint, PathBuilder, Pattern, Pixmap, Rect, SpreadMode};

/// Pixels RGBA (non premultiplies) d'une image XObject, si on sait la lire.
fn pixels(doc: &Document, s: &Stream, couleur: [f32; 3]) -> Option<(u32, u32, Vec<u8>)> {
    if s.dict.get(b"ImageMask").and_then(Object::as_bool).unwrap_or(false) {
        return masque_1bit(s, couleur);
    }
    let img = decoder_xobject(doc, s).or_else(|| decoder_jpeg_libre(s))?;
    let (l, h) = img.dimensions();
    let mut rgba = img.to_rgba8();
    // Masque doux : sa taille peut differer de celle de l'image.
    let smask = s.dict.get(b"SMask").ok().map(|o| deref(doc, o)).and_then(|o| o.as_stream().ok());
    if let Some(m) = smask.and_then(|m| decoder_xobject(doc, m).or_else(|| decoder_jpeg_libre(m))) {
        let m = if m.dimensions() == (l, h) { m.to_luma8() } else { DynamicImage::ImageLuma8(m.to_luma8()).resize_exact(l, h, image::imageops::FilterType::Triangle).to_luma8() };
        for (p, a) in rgba.pixels_mut().zip(m.pixels()) {
            p.0[3] = a.0[0];
        }
    }
    Some((l, h, rgba.into_raw()))
}

/// Masque d'image (ImageMask) : les bits a 0 sont peints de la couleur de remplissage (Decode par defaut).
fn masque_1bit(s: &Stream, c: [f32; 3]) -> Option<(u32, u32, Vec<u8>)> {
    let l = u32::try_from(s.dict.get(b"Width").and_then(Object::as_i64).ok()?).ok()?;
    let h = u32::try_from(s.dict.get(b"Height").and_then(Object::as_i64).ok()?).ok()?;
    if u64::from(l) * u64::from(h) > 100_000_000 || s.filters().map(|f| f.len() > 1).unwrap_or(false) {
        return None;
    }
    let brut = s.decompressed_content().ok()?;
    let ligne = (l as usize).div_ceil(8);
    if brut.len() < ligne * h as usize {
        return None;
    }
    let inverse = s.dict.get(b"Decode").and_then(Object::as_array).is_ok_and(|d| d.first().map(crate::pdf::nombre) == Some(1.0));
    let [r, g, b] = c.map(|v| (v * 255.0).round() as u8);
    let mut px = Vec::with_capacity(l as usize * h as usize * 4);
    for y in 0..h as usize {
        for x in 0..l as usize {
            let bit = (brut[y * ligne + x / 8] >> (7 - x % 8)) & 1 == 1;
            px.extend([r, g, b, if bit == inverse { 255 } else { 0 }]);
        }
    }
    Some((l, h, px))
}

impl Interprete<'_> {
    /// Dessine une image XObject dans le carre unite de l'espace courant.
    pub(super) fn image(&mut self, s: &Stream) {
        let Some((l, h, rgba)) = pixels(self.doc, s, self.e.remplissage) else {
            self.avert.insert("Des images (palette, CCITT, JBIG2, JPEG 2000…) ne sont pas reproduites : cadre gris à la place.".into());
            let ts = self.matrice_peinture();
            if let Some(r) = Rect::from_xywh(0.0, 0.0, 1.0, 1.0) {
                self.pix.fill_path(&PathBuilder::from_rect(r), &peinture([0.8; 3], 1.0), FillRule::Winding, ts, self.e.clip.as_deref());
            }
            return;
        };
        let Some(mut pm) = Pixmap::new(l, h) else { return };
        for (dst, src) in pm.data_mut().chunks_exact_mut(4).zip(rgba.chunks_exact(4)) {
            let a = u16::from(src[3]);
            for i in 0..3 {
                dst[i] = ((u16::from(src[i]) * a + 127) / 255) as u8;
            }
            dst[3] = src[3];
        }
        // Pixels de l'image -> carre unite (origine en haut a gauche) -> page -> peripherique.
        let m = mul([1.0 / l as f32, 0.0, 0.0, -1.0 / h as f32, 0.0, 1.0], mul(self.e.ctm, self.base));
        let ts = transform(m);
        let p = Paint { shader: Pattern::new(pm.as_ref(), SpreadMode::Pad, FilterQuality::Bilinear, self.e.opacite_r, tiny_skia::Transform::identity()), anti_alias: true, ..Paint::default() };
        if let Some(r) = Rect::from_xywh(0.0, 0.0, l as f32, h as f32) {
            self.pix.fill_path(&PathBuilder::from_rect(r), &p, FillRule::Winding, ts, self.e.clip.as_deref());
        }
    }
}
