//! Formulaires interactifs (AcroForm) : ajouter des champs (repris de ForgePDF),
//! lister, remplir (apparences generees) et aplatir (champs fondus dans la page).

use super::annotations::ajouter_annot;
use super::{ajouter_contenu, ajouter_ressource, boite_page, chaine, nombre, police_standard, winansi, Zone};
use crate::erreur::{param, Resultat};
use lopdf::content::{Content, Operation};
use lopdf::{dictionary, Dictionary, Document, Object, ObjectId, Stream};
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, HashMap};

const FF_LECTURE_SEULE: i64 = 1;
const FF_MULTILIGNE: i64 = 1 << 12;
const FF_RADIO: i64 = 1 << 15;
const FF_BOUTON: i64 = 1 << 16;
const FF_COMBO: i64 = 1 << 17;
const FF_EDITABLE: i64 = 1 << 18;

/// Type d'un champ a creer.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum TypeChamp {
    Texte,
    ZoneTexte,
    Case,
    Radio,
    ListeDeroulante,
    Liste,
}

/// Champ a ajouter (zone normalisee, origine en haut a gauche).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct NouveauChamp {
    #[serde(rename = "type")]
    pub type_: TypeChamp,
    pub nom: String,
    pub zone: Zone,
    /// Texte par defaut ; selection (listes) ; valeur d'export (radio).
    #[serde(default)]
    pub valeur: String,
    /// Case cochee / option radio selectionnee.
    #[serde(default)]
    pub coche: bool,
    #[serde(default)]
    pub options: Vec<String>,
    #[serde(default = "douze")]
    pub taille_police: f32,
}

fn douze() -> f32 {
    12.0
}

/// Description d'un champ existant.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ChampInfo {
    pub nom: String,
    /// texte | case | radio | choix | signature | bouton | inconnu
    #[serde(rename = "type")]
    pub type_: String,
    pub valeur: Option<String>,
    pub options: Vec<String>,
    pub lecture_seule: bool,
}

fn nom_pdf(s: &str) -> Object {
    Object::Name(s.as_bytes().to_vec())
}

/// Nom PDF sur pour une valeur d'export : alphanumerique, jamais vide.
fn export_sur(s: &str, repli: usize) -> String {
    let c: String = s.chars().filter(char::is_ascii_alphanumeric).collect();
    if c.is_empty() {
        format!("opt{repli}")
    } else {
        c
    }
}

fn rect_obj(r: [f32; 4]) -> Object {
    Object::Array(r.iter().map(|&v| v.into()).collect())
}

fn bordure(gris: f32) -> Dictionary {
    dictionary! { "BC" => vec![gris.into(), gris.into(), gris.into()] }
}

/// Flux d'apparence dessinant un glyphe ZapfDingbats (coche / puce) centre.
fn ap_glyphe(doc: &mut Document, zadb: ObjectId, l: f32, h: f32, glyphe: u8) -> Resultat<ObjectId> {
    let t = (h * 0.8).max(6.0);
    let ops = vec![
        Operation::new("q", vec![]),
        Operation::new("BT", vec![]),
        Operation::new("Tf", vec!["ZaDb".into(), t.into()]),
        Operation::new("Td", vec![(l * 0.15).into(), (h * 0.2).into()]),
        Operation::new("Tj", vec![chaine(vec![glyphe])]),
        Operation::new("ET", vec![]),
        Operation::new("Q", vec![]),
    ];
    let res = dictionary! { "Font" => dictionary! { "ZaDb" => zadb } };
    Ok(doc.add_object(forme(l, h, Content { operations: ops }.encode()?, Some(res))))
}

fn forme(l: f32, h: f32, contenu: Vec<u8>, ressources: Option<Dictionary>) -> Stream {
    let mut d = dictionary! { "Type" => "XObject", "Subtype" => "Form", "BBox" => rect_obj([0.0, 0.0, l, h]) };
    if let Some(r) = ressources {
        d.set("Resources", r);
    }
    Stream::new(d, contenu)
}

fn acroform_mut(doc: &mut Document) -> Resultat<&mut Dictionary> {
    let existant = doc.catalog()?.get(b"AcroForm").ok().cloned();
    let id = match existant {
        Some(Object::Reference(id)) if doc.get_dictionary(id).is_ok() => id,
        autre => {
            let d = match autre {
                Some(Object::Dictionary(d)) => d,
                _ => dictionary! { "Fields" => Vec::<Object>::new() },
            };
            let id = doc.add_object(d);
            doc.catalog_mut()?.set("AcroForm", Object::Reference(id));
            id
        }
    };
    Ok(doc.get_dictionary_mut(id)?)
}

/// Ajoute des champs de premier niveau au formulaire (cree s'il manque).
pub(crate) fn ajouter_au_acroform(doc: &mut Document, champs: Vec<Object>) -> Resultat<()> {
    let helv = police_standard(doc, "Helvetica");
    let zadb = doc.add_object(dictionary! { "Type" => "Font", "Subtype" => "Type1", "BaseFont" => "ZapfDingbats" });
    let acro = acroform_mut(doc)?;
    let mut liste = acro.get(b"Fields").and_then(Object::as_array).cloned().unwrap_or_default();
    liste.extend(champs);
    acro.set("Fields", Object::Array(liste));
    acro.set("NeedAppearances", true);
    if !acro.has(b"DR") {
        acro.set("DR", dictionary! { "Font" => dictionary! { "Helv" => helv, "ZaDb" => zadb } });
        acro.set("DA", chaine(b"/Helv 0 Tf 0 g".to_vec()));
    }
    Ok(())
}

/// Ajoute des champs remplissables.
pub fn ajouter_champs(doc: &mut Document, champs: &[NouveauChamp]) -> Resultat<()> {
    let pages: Vec<ObjectId> = doc.get_pages().into_values().collect();
    let helv = police_standard(doc, "Helvetica");
    let zadb = doc.add_object(dictionary! { "Type" => "Font", "Subtype" => "Type1", "BaseFont" => "ZapfDingbats" });
    let mut refs: Vec<Object> = Vec::new();
    let mut radios: BTreeMap<String, Vec<&NouveauChamp>> = BTreeMap::new();
    for f in champs {
        if f.nom.trim().is_empty() || f.nom.contains('.') || f.nom.chars().count() > 120 {
            return Err(param(format!("nom de champ « {} » invalide (non vide, sans point)", f.nom)));
        }
        let page = *pages
            .get((f.zone.page as usize).wrapping_sub(1))
            .ok_or_else(|| param(format!("page {} hors limites", f.zone.page)))?;
        if f.type_ == TypeChamp::Radio {
            radios.entry(f.nom.clone()).or_default().push(f);
            continue;
        }
        let r = f.zone.en_points(boite_page(doc, page));
        let (l, h) = (r[2] - r[0], r[3] - r[1]);
        let da = chaine(format!("/Helv {} Tf 0 g", f.taille_police.clamp(0.0, 72.0) as i32).into_bytes());
        let mut d = dictionary! {
            "Type" => "Annot", "Subtype" => "Widget", "T" => lopdf::text_string(&f.nom),
            "Rect" => rect_obj(r), "P" => page, "F" => 4,
        };
        match f.type_ {
            TypeChamp::Case => {
                let etat = if f.coche { "Yes" } else { "Off" };
                let oui = ap_glyphe(doc, zadb, l, h, b'4')?;
                let non = doc.add_object(forme(l, h, Vec::new(), None));
                d.set("FT", "Btn");
                d.set("Ff", 0);
                d.set("AP", dictionary! { "N" => dictionary! { "Yes" => oui, "Off" => non } });
                d.set("AS", nom_pdf(etat));
                d.set("V", nom_pdf(etat));
                d.set("MK", bordure(0.0));
            }
            TypeChamp::ListeDeroulante | TypeChamp::Liste => {
                d.set("FT", "Ch");
                d.set("DA", da);
                d.set("Opt", f.options.iter().map(|o| lopdf::text_string(o)).collect::<Vec<_>>());
                d.set("V", lopdf::text_string(&f.valeur));
                d.set("Ff", if f.type_ == TypeChamp::ListeDeroulante { FF_COMBO } else { 0 });
                d.set("MK", bordure(0.6));
            }
            _ => {
                d.set("FT", "Tx");
                d.set("DA", da);
                d.set("V", lopdf::text_string(&f.valeur));
                d.set("Ff", if f.type_ == TypeChamp::ZoneTexte { FF_MULTILIGNE } else { 0 });
                d.set("MK", bordure(0.6));
            }
        }
        let w = doc.add_object(d);
        if matches!(f.type_, TypeChamp::Texte | TypeChamp::ZoneTexte | TypeChamp::ListeDeroulante | TypeChamp::Liste) {
            apparence_texte(doc, w, &f.valeur, helv)?;
        }
        ajouter_annot(doc, page, w)?;
        refs.push(Object::Reference(w));
    }
    for (groupe, options) in &radios {
        let parent = doc.add_object(dictionary! {
            "FT" => "Btn", "Ff" => FF_RADIO, "T" => lopdf::text_string(groupe), "V" => "Off",
        });
        let (mut enfants, mut choisi) = (Vec::new(), String::from("Off"));
        for (i, f) in options.iter().enumerate() {
            let page = pages[f.zone.page as usize - 1];
            let r = f.zone.en_points(boite_page(doc, page));
            let export = export_sur(&f.valeur, i);
            if f.coche {
                choisi = export.clone();
            }
            let oui = ap_glyphe(doc, zadb, r[2] - r[0], r[3] - r[1], b'l')?;
            let non = doc.add_object(forme(r[2] - r[0], r[3] - r[1], Vec::new(), None));
            let mut n = Dictionary::new();
            n.set(export.clone().into_bytes(), oui);
            n.set("Off", non);
            let w = doc.add_object(dictionary! {
                "Type" => "Annot", "Subtype" => "Widget", "Parent" => parent, "Rect" => rect_obj(r),
                "P" => page, "F" => 4, "AP" => dictionary! { "N" => n },
                "AS" => nom_pdf(if f.coche { &export } else { "Off" }), "MK" => bordure(0.0),
            });
            ajouter_annot(doc, page, w)?;
            enfants.push(Object::Reference(w));
        }
        let p = doc.get_dictionary_mut(parent)?;
        p.set("Kids", enfants);
        p.set("V", nom_pdf(&choisi));
        refs.push(Object::Reference(parent));
    }
    if refs.is_empty() {
        return Err(param("aucun champ à ajouter"));
    }
    ajouter_au_acroform(doc, refs)
}

// ── Parcours des champs ───────────────────────────────────────────────────────

struct Champ {
    id: ObjectId,
    nom: String,
    ft: Option<Vec<u8>>,
    ff: i64,
    widgets: Vec<ObjectId>,
}

fn champs_terminaux(doc: &Document) -> Vec<Champ> {
    let mut res = Vec::new();
    let Some(acro) = doc
        .catalog()
        .ok()
        .and_then(|c| c.get(b"AcroForm").ok())
        .and_then(|a| doc.dereference(a).ok())
        .and_then(|(_, a)| a.as_dict().ok())
    else {
        return res;
    };
    let racines = acro.get(b"Fields").and_then(Object::as_array).cloned().unwrap_or_default();
    for r in racines {
        if let Ok(id) = r.as_reference() {
            parcourir(doc, id, "", None, 0, 0, &mut res);
        }
    }
    res
}

fn parcourir(doc: &Document, id: ObjectId, prefixe: &str, ft: Option<Vec<u8>>, ff: i64, prof: u8, res: &mut Vec<Champ>) {
    let Ok(d) = doc.get_dictionary(id) else { return };
    if prof > 20 {
        return;
    }
    let partiel = d.get(b"T").ok().and_then(|t| lopdf::decode_text_string(t).ok());
    let nom = match (&partiel, prefixe.is_empty()) {
        (Some(p), true) => p.clone(),
        (Some(p), false) => format!("{prefixe}.{p}"),
        (None, _) => prefixe.to_string(),
    };
    let ft = d.get(b"FT").and_then(Object::as_name).map(<[u8]>::to_vec).ok().or(ft);
    let ff = d.get(b"Ff").and_then(Object::as_i64).unwrap_or(ff);
    let enfants: Vec<ObjectId> = d
        .get(b"Kids")
        .and_then(Object::as_array)
        .map(|k| k.iter().filter_map(|o| o.as_reference().ok()).collect())
        .unwrap_or_default();
    let champs_enfants: Vec<ObjectId> =
        enfants.iter().copied().filter(|k| doc.get_dictionary(*k).map(|kd| kd.has(b"T")).unwrap_or(false)).collect();
    if champs_enfants.is_empty() {
        let widgets = if enfants.is_empty() { vec![id] } else { enfants };
        res.push(Champ { id, nom, ft, ff, widgets });
    } else {
        for k in champs_enfants {
            parcourir(doc, k, &nom, ft.clone(), ff, prof + 1, res);
        }
    }
}

fn etats_actifs(doc: &Document, widget: ObjectId) -> Vec<String> {
    doc.get_dictionary(widget)
        .ok()
        .and_then(|w| w.get(b"AP").ok())
        .and_then(|ap| doc.dereference(ap).ok())
        .and_then(|(_, ap)| ap.as_dict().ok())
        .and_then(|ap| ap.get(b"N").ok())
        .and_then(|n| doc.dereference(n).ok())
        .and_then(|(_, n)| n.as_dict().ok())
        .map(|n| n.iter().map(|(k, _)| String::from_utf8_lossy(k).into_owned()).filter(|k| k != "Off").collect())
        .unwrap_or_default()
}

fn valeur_texte(o: &Object) -> Option<String> {
    match o {
        Object::Name(n) => Some(String::from_utf8_lossy(n).into_owned()),
        autre => lopdf::decode_text_string(autre).ok(),
    }
}

fn type_lisible(ft: Option<&[u8]>, ff: i64) -> &'static str {
    match ft {
        Some(b"Tx") => "texte",
        Some(b"Ch") => "choix",
        Some(b"Sig") => "signature",
        Some(b"Btn") if ff & FF_BOUTON != 0 => "bouton",
        Some(b"Btn") if ff & FF_RADIO != 0 => "radio",
        Some(b"Btn") => "case",
        _ => "inconnu",
    }
}

/// Liste les champs du formulaire.
pub fn lister(doc: &Document) -> Vec<ChampInfo> {
    champs_terminaux(doc)
        .into_iter()
        .map(|c| {
            let d = doc.get_dictionary(c.id).ok();
            let valeur = d.and_then(|d| d.get(b"V").ok()).and_then(valeur_texte);
            let type_ = type_lisible(c.ft.as_deref(), c.ff);
            let options = match type_ {
                "choix" => d
                    .and_then(|d| d.get(b"Opt").ok())
                    .and_then(|o| o.as_array().ok())
                    .map(|a| {
                        a.iter()
                            .filter_map(|o| match o {
                                Object::Array(p) => p.last().and_then(valeur_texte),
                                autre => valeur_texte(autre),
                            })
                            .collect()
                    })
                    .unwrap_or_default(),
                "case" | "radio" => c.widgets.iter().flat_map(|w| etats_actifs(doc, *w)).collect(),
                _ => Vec::new(),
            };
            ChampInfo { nom: c.nom, type_: type_.into(), valeur, options, lecture_seule: c.ff & FF_LECTURE_SEULE != 0 }
        })
        .collect()
}

// ── Remplissage ───────────────────────────────────────────────────────────────

fn taille_da(doc: &Document, widget: ObjectId) -> f32 {
    let da = doc.get_dictionary(widget).ok().and_then(|w| w.get(b"DA").ok()).and_then(|d| d.as_str().ok());
    da.and_then(|s| {
        let s = String::from_utf8_lossy(s);
        let mots: Vec<&str> = s.split_whitespace().collect();
        mots.iter().position(|m| *m == "Tf").and_then(|i| i.checked_sub(1)).and_then(|i| mots[i].parse().ok())
    })
    .unwrap_or(0.0)
}

/// Genere l'apparence (texte noir Helvetica) d'un widget de texte ou de choix.
fn apparence_texte(doc: &mut Document, widget: ObjectId, valeur: &str, helv: ObjectId) -> Resultat<()> {
    let r: Vec<f32> = doc
        .get_dictionary(widget)?
        .get(b"Rect")
        .and_then(Object::as_array)
        .map(|a| a.iter().map(nombre).collect())
        .unwrap_or_default();
    if r.len() != 4 {
        return Ok(());
    }
    let (l, h) = ((r[2] - r[0]).abs(), (r[3] - r[1]).abs());
    let ff = doc.get_dictionary(widget)?.get(b"Ff").and_then(Object::as_i64).unwrap_or(0);
    let mut t = taille_da(doc, widget);
    if t <= 0.0 {
        t = (h * 0.7).clamp(4.0, 12.0);
    }
    let lignes: Vec<&str> = if ff & FF_MULTILIGNE != 0 { valeur.lines().collect() } else { vec![valeur] };
    let mut ops = vec![Operation::new("BMC", vec!["Tx".into()]), Operation::new("q", vec![]), Operation::new("BT", vec![])];
    ops.push(Operation::new("Tf", vec!["Helv".into(), t.into()]));
    ops.push(Operation::new("0 g", vec![]));
    let y0 = if ff & FF_MULTILIGNE != 0 { h - t - 2.0 } else { (h - t) / 2.0 + t * 0.22 };
    ops.push(Operation::new("Td", vec![2.0.into(), y0.into()]));
    for (i, ligne) in lignes.iter().enumerate() {
        if i > 0 {
            ops.push(Operation::new("Td", vec![0.into(), (-t * 1.15).into()]));
        }
        ops.push(Operation::new("Tj", vec![chaine(winansi(ligne))]));
    }
    ops.extend([Operation::new("ET", vec![]), Operation::new("Q", vec![]), Operation::new("EMC", vec![])]);
    let contenu = Content { operations: ops }.encode()?;
    let ap = doc.add_object(forme(l, h, contenu, Some(dictionary! { "Font" => dictionary! { "Helv" => helv } })));
    doc.get_dictionary_mut(widget)?.set("AP", dictionary! { "N" => ap });
    Ok(())
}

fn vrai(v: &str) -> bool {
    matches!(v.trim().to_lowercase().as_str(), "oui" | "vrai" | "true" | "1" | "on" | "yes" | "x" | "coché" | "coche")
}

/// Remplit les champs nommes. Erreur si un nom est inconnu ou une valeur invalide.
pub fn remplir(doc: &mut Document, valeurs: &BTreeMap<String, String>) -> Resultat<()> {
    let champs: HashMap<String, Champ> = champs_terminaux(doc).into_iter().map(|c| (c.nom.clone(), c)).collect();
    let helv = police_standard(doc, "Helvetica");
    for (nom, valeur) in valeurs {
        let c = champs.get(nom).ok_or_else(|| param(format!("champ « {nom} » introuvable")))?;
        if c.ff & FF_LECTURE_SEULE != 0 {
            return Err(param(format!("le champ « {nom} » est en lecture seule")));
        }
        if valeur.chars().count() > 20_000 {
            return Err(param(format!("valeur trop longue pour « {nom} »")));
        }
        match type_lisible(c.ft.as_deref(), c.ff) {
            "texte" | "choix" => {
                if c.ft.as_deref() == Some(b"Ch") && c.ff & FF_EDITABLE == 0 {
                    let opts = lister(doc).into_iter().find(|i| &i.nom == nom).map(|i| i.options).unwrap_or_default();
                    if !opts.is_empty() && !opts.contains(valeur) {
                        return Err(param(format!("« {valeur} » n'est pas une option de « {nom} »")));
                    }
                }
                doc.get_dictionary_mut(c.id)?.set("V", lopdf::text_string(valeur));
                for w in &c.widgets {
                    apparence_texte(doc, *w, valeur, helv)?;
                }
            }
            "case" => {
                for w in &c.widgets {
                    let on = etats_actifs(doc, *w).into_iter().next().unwrap_or_else(|| "Yes".into());
                    let etat = if vrai(valeur) { on } else { "Off".into() };
                    doc.get_dictionary_mut(*w)?.set("AS", nom_pdf(&etat));
                    doc.get_dictionary_mut(c.id)?.set("V", nom_pdf(&etat));
                }
            }
            "radio" => {
                let possibles: Vec<String> = c.widgets.iter().flat_map(|w| etats_actifs(doc, *w)).collect();
                if !possibles.contains(valeur) && valeur != "Off" {
                    return Err(param(format!("« {valeur} » n'est pas une option de « {nom} » ({})", possibles.join(", "))));
                }
                for w in &c.widgets {
                    let a = if etats_actifs(doc, *w).contains(valeur) { valeur.as_str() } else { "Off" };
                    doc.get_dictionary_mut(*w)?.set("AS", nom_pdf(a));
                }
                doc.get_dictionary_mut(c.id)?.set("V", nom_pdf(valeur));
            }
            autre => return Err(param(format!("le champ « {nom} » ({autre}) ne se remplit pas"))),
        }
    }
    Ok(())
}

// ── Aplatissement ─────────────────────────────────────────────────────────────

fn apparence_courante(doc: &Document, widget: &Dictionary) -> Option<ObjectId> {
    let n = widget.get(b"AP").ok().and_then(|ap| doc.dereference(ap).ok())?.1.as_dict().ok()?.get(b"N").ok()?;
    match n {
        Object::Reference(id) => match doc.get_object(*id).ok()? {
            Object::Stream(_) => Some(*id),
            Object::Dictionary(etats) => {
                let as_ = widget.get(b"AS").and_then(Object::as_name).ok()?;
                etats.get(as_).and_then(Object::as_reference).ok()
            }
            _ => None,
        },
        Object::Dictionary(etats) => {
            let as_ = widget.get(b"AS").and_then(Object::as_name).ok()?;
            etats.get(as_).and_then(Object::as_reference).ok()
        }
        _ => None,
    }
}

/// Fond les champs dans le contenu des pages et supprime le formulaire.
pub fn aplatir(doc: &mut Document) -> Resultat<()> {
    let helv = police_standard(doc, "Helvetica");
    // Les champs texte sans apparence (NeedAppearances) en recoivent une.
    for c in champs_terminaux(doc) {
        if matches!(c.ft.as_deref(), Some(b"Tx") | Some(b"Ch")) {
            let v = doc.get_dictionary(c.id).ok().and_then(|d| d.get(b"V").ok()).and_then(valeur_texte);
            for w in &c.widgets {
                let sans_ap = doc.get_dictionary(*w).map(|d| !d.has(b"AP")).unwrap_or(false);
                if sans_ap {
                    apparence_texte(doc, *w, v.as_deref().unwrap_or(""), helv)?;
                }
            }
        }
    }
    for page in doc.get_pages().into_values().collect::<Vec<_>>() {
        let annots: Vec<Object> = match doc.get_dictionary(page)?.get(b"Annots") {
            Ok(Object::Array(a)) => a.clone(),
            Ok(Object::Reference(r)) => doc.get_object(*r).and_then(Object::as_array).cloned().unwrap_or_default(),
            _ => continue,
        };
        let (mut garder, mut ops) = (Vec::new(), Vec::new());
        for a in annots {
            let Some(d) = a.as_reference().ok().and_then(|id| doc.get_dictionary(id).ok()).cloned() else {
                garder.push(a);
                continue;
            };
            if d.get(b"Subtype").and_then(Object::as_name).ok() != Some(b"Widget".as_slice()) {
                garder.push(a);
                continue;
            }
            let cache = d.get(b"F").and_then(Object::as_i64).unwrap_or(0) & 2 != 0;
            let (Some(ap), false) = (apparence_courante(doc, &d), cache) else { continue };
            let rect: Vec<f32> = d.get(b"Rect").and_then(Object::as_array).map(|a| a.iter().map(nombre).collect()).unwrap_or_default();
            if rect.len() != 4 {
                continue;
            }
            let flux = doc.get_object(ap).and_then(Object::as_stream)?;
            let bbox: Vec<f32> = flux.dict.get(b"BBox").and_then(Object::as_array).map(|a| a.iter().map(nombre).collect()).unwrap_or_default();
            if bbox.len() != 4 {
                continue;
            }
            let m: Vec<f32> = flux.dict.get(b"Matrix").and_then(Object::as_array).map(|a| a.iter().map(nombre).collect()).unwrap_or_else(|_| vec![1.0, 0.0, 0.0, 1.0, 0.0, 0.0]);
            let coins = [(bbox[0], bbox[1]), (bbox[2], bbox[1]), (bbox[0], bbox[3]), (bbox[2], bbox[3])];
            let pts: Vec<(f32, f32)> = coins.iter().map(|&(x, y)| (m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5])).collect();
            let (bx0, by0) = pts.iter().fold((f32::MAX, f32::MAX), |a, p| (a.0.min(p.0), a.1.min(p.1)));
            let (bx1, by1) = pts.iter().fold((f32::MIN, f32::MIN), |a, p| (a.0.max(p.0), a.1.max(p.1)));
            let (rx0, ry0) = (rect[0].min(rect[2]), rect[1].min(rect[3]));
            let sx = if bx1 - bx0 > 0.0 { (rect[2] - rect[0]).abs() / (bx1 - bx0) } else { 1.0 };
            let sy = if by1 - by0 > 0.0 { (rect[3] - rect[1]).abs() / (by1 - by0) } else { 1.0 };
            let nom = ajouter_ressource(doc, page, b"XObject", "FcW", Object::Reference(ap))?;
            ops.push(Operation::new("q", vec![]));
            ops.push(Operation::new("cm", vec![sx.into(), 0.into(), 0.into(), sy.into(), (rx0 - bx0 * sx).into(), (ry0 - by0 * sy).into()]));
            ops.push(Operation::new("Do", vec![Object::Name(nom)]));
            ops.push(Operation::new("Q", vec![]));
        }
        if !ops.is_empty() {
            ajouter_contenu(doc, page, ops)?;
        }
        doc.get_dictionary_mut(page)?.set("Annots", Object::Array(garder));
    }
    doc.catalog_mut()?.remove(b"AcroForm");
    doc.prune_objects();
    Ok(())
}
