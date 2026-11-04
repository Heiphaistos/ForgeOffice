//! Organisation des pages : fusion, decoupage, extraction, suppression,
//! reordonnancement, rotation. Tout passe par `reorganiser`, qui aplatit l'arbre
//! des pages (attributs herites recopies) puis purge les objets devenus orphelins.

use super::{materialiser_heritage, rotation_page};
use crate::erreur::{param, ConvertError, Resultat};
use crate::fichiers::analyser_pages;
use lopdf::{Document, Object, ObjectId};
use serde::{Deserialize, Serialize};

/// Une page dans le nouvel ordre : numero source (1-based) et rotation absolue eventuelle.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub struct PageOrdre {
    pub page: u32,
    #[serde(default)]
    pub rotation: Option<i64>,
}

/// Mode de decoupage.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "mode", content = "valeur", rename_all = "snake_case")]
pub enum Decoupage {
    /// Un fichier par page.
    ChaquePage,
    /// Des blocs de N pages.
    ToutesLesN(u32),
    /// Un fichier par selection (« 1-3 », « 4,6-8 », « 9- »).
    Plages(Vec<String>),
}

fn racine_pages(doc: &Document) -> Resultat<ObjectId> {
    Ok(doc.catalog()?.get(b"Pages").and_then(Object::as_reference)?)
}

fn valider_rotation(r: i64) -> Resultat<i64> {
    if r % 90 != 0 {
        return Err(param(format!("rotation {r}° invalide (multiple de 90 attendu)")));
    }
    Ok(r.rem_euclid(360))
}

/// Remplace les pages du document par `ordre` (doublons autorises : la page est copiee).
pub fn reorganiser(doc: &mut Document, ordre: &[PageOrdre]) -> Resultat<()> {
    if ordre.is_empty() {
        return Err(param("aucune page sélectionnée"));
    }
    let pages = doc.get_pages();
    let total = pages.len() as u32;
    let racine = racine_pages(doc)?;
    for id in pages.values() {
        materialiser_heritage(doc, *id);
    }
    let mut vues = std::collections::HashSet::new();
    let mut enfants = Vec::with_capacity(ordre.len());
    for o in ordre {
        let id = *pages
            .get(&o.page)
            .ok_or_else(|| param(format!("page {} hors limites (1 à {total})", o.page)))?;
        let id = if vues.insert(id) {
            id
        } else {
            let copie = doc.get_object(id)?.clone();
            doc.add_object(copie)
        };
        let d = doc.get_dictionary_mut(id)?;
        d.set("Parent", Object::Reference(racine));
        if let Some(r) = o.rotation {
            d.set("Rotate", Object::Integer(valider_rotation(r)?));
        }
        enfants.push(Object::Reference(id));
    }
    let n = enfants.len() as i64;
    let r = doc.get_dictionary_mut(racine)?;
    r.set("Kids", Object::Array(enfants));
    r.set("Count", Object::Integer(n));
    doc.prune_objects();
    Ok(())
}

fn ordre_simple(pages: &[u32]) -> Vec<PageOrdre> {
    pages.iter().map(|&page| PageOrdre { page, rotation: None }).collect()
}

/// Garde les pages selectionnees (« 1-3,5 »), dans l'ordre donne.
pub fn extraire(doc: &mut Document, selection: &str) -> Resultat<()> {
    let total = doc.get_pages().len() as u32;
    let pages = analyser_pages(selection, total)?;
    reorganiser(doc, &ordre_simple(&pages))
}

/// Supprime les pages selectionnees.
pub fn supprimer(doc: &mut Document, selection: &str) -> Resultat<()> {
    let total = doc.get_pages().len() as u32;
    let retirer: std::collections::HashSet<u32> = analyser_pages(selection, total)?.into_iter().collect();
    let garder: Vec<u32> = (1..=total).filter(|p| !retirer.contains(p)).collect();
    if garder.is_empty() {
        return Err(param("impossible de supprimer toutes les pages"));
    }
    reorganiser(doc, &ordre_simple(&garder))
}

/// Ajoute `degres` (multiple de 90) a la rotation des pages choisies (toutes si `None`).
pub fn pivoter(doc: &mut Document, degres: i64, selection: Option<&str>) -> Resultat<()> {
    let delta = valider_rotation(degres)?;
    let pages = doc.get_pages();
    let choisies = match selection {
        Some(s) if !s.trim().is_empty() => analyser_pages(s, pages.len() as u32)?,
        _ => pages.keys().copied().collect(),
    };
    for n in choisies {
        if let Some(&id) = pages.get(&n) {
            let r = (rotation_page(doc, id) + delta).rem_euclid(360);
            doc.get_dictionary_mut(id)?.set("Rotate", Object::Integer(r));
        }
    }
    Ok(())
}

/// Listes de pages produites par un decoupage.
pub fn parts_decoupage(mode: &Decoupage, total: u32) -> Resultat<Vec<Vec<u32>>> {
    let parts: Vec<Vec<u32>> = match mode {
        Decoupage::ChaquePage => (1..=total).map(|p| vec![p]).collect(),
        Decoupage::ToutesLesN(n) => {
            if *n == 0 {
                return Err(param("le nombre de pages par fichier doit être au moins 1"));
            }
            (1..=total).collect::<Vec<_>>().chunks(*n as usize).map(<[u32]>::to_vec).collect()
        }
        Decoupage::Plages(plages) => plages.iter().map(|p| analyser_pages(p, total)).collect::<Resultat<_>>()?,
    };
    if parts.is_empty() {
        return Err(param("aucune plage de pages"));
    }
    Ok(parts)
}

/// Decoupe en plusieurs documents.
pub fn decouper(doc: &Document, mode: &Decoupage) -> Resultat<Vec<Document>> {
    let total = doc.get_pages().len() as u32;
    parts_decoupage(mode, total)?
        .into_iter()
        .map(|pages| {
            let mut d = doc.clone();
            reorganiser(&mut d, &ordre_simple(&pages))?;
            Ok(d)
        })
        .collect()
}

/// Fusionne des documents (pages reelles : mise en page, images, liens internes conserves).
pub fn fusionner(mut docs: Vec<Document>) -> Resultat<Document> {
    if docs.is_empty() {
        return Err(param("aucun PDF à fusionner"));
    }
    let mut res = docs.remove(0);
    let ordre: Vec<PageOrdre> = ordre_simple(&res.get_pages().keys().copied().collect::<Vec<_>>());
    reorganiser(&mut res, &ordre)?;
    let racine = racine_pages(&res)?;
    let mut champs: Vec<Object> = Vec::new();
    for mut src in docs {
        for id in src.get_pages().values() {
            materialiser_heritage(&mut src, *id);
        }
        let depart = res.max_id.checked_add(1).ok_or_else(|| ConvertError::Echec("PDF trop volumineux".into()))?;
        src.renumber_objects_with(depart);
        let pages: Vec<ObjectId> = src.get_pages().into_values().collect();
        if let Ok(Object::Array(f)) = src.catalog().and_then(|c| c.get(b"AcroForm")).and_then(|a| {
            src.dereference(a).map(|(_, a)| a)
        }).and_then(|a| a.as_dict().and_then(|d| d.get(b"Fields")).cloned())
        {
            champs.extend(f);
        }
        res.max_id = res.max_id.max(src.max_id);
        res.objects.extend(src.objects);
        for id in &pages {
            res.get_dictionary_mut(*id)?.set("Parent", Object::Reference(racine));
        }
        let r = res.get_dictionary_mut(racine)?;
        let mut enfants = r.get(b"Kids").and_then(Object::as_array).cloned().unwrap_or_default();
        enfants.extend(pages.into_iter().map(Object::Reference));
        let n = enfants.len() as i64;
        r.set("Kids", Object::Array(enfants));
        r.set("Count", Object::Integer(n));
    }
    if !champs.is_empty() {
        super::formulaires::ajouter_au_acroform(&mut res, champs)?;
    }
    res.prune_objects();
    Ok(res)
}
