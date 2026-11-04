//! Masques de saisie Access (`00 00 00 00 00;0;_`, `>L<??????????`, `99/99/0000`).
//!
//! Caracteres : `0` chiffre requis, `9` chiffre facultatif, `#` chiffre/espace/signe facultatif,
//! `L` lettre requise, `?` lettre facultative, `A` lettre ou chiffre requis, `a` facultatif,
//! `&` caractere requis, `C` facultatif, `>` majuscules, `<` minuscules, `!` ignore,
//! `\x` ou `"texte"` litteral, autres caracteres = separateurs litteraux.
//! Deuxieme section : `0` stocke les litteraux, `1` ou vide ne stocke que la saisie.

#[derive(Clone, Copy, Debug, PartialEq)]
enum Casse {
    Normale,
    Majuscule,
    Minuscule,
}

#[derive(Clone, Debug, PartialEq)]
enum Case {
    Saisie { classe: char, requis: bool, casse: Casse },
    Litteral(char),
}

fn sections(masque: &str) -> (String, bool) {
    let mut parties = Vec::new();
    let mut courant = String::new();
    let mut guillemets = false;
    let mut echappe = false;
    for c in masque.chars() {
        if echappe {
            courant.push(c);
            echappe = false;
        } else if c == '\\' {
            courant.push(c);
            echappe = true;
        } else if c == '"' {
            guillemets = !guillemets;
            courant.push(c);
        } else if c == ';' && !guillemets {
            parties.push(std::mem::take(&mut courant));
        } else {
            courant.push(c);
        }
    }
    parties.push(courant);
    let stocker_litteraux = parties.get(1).is_some_and(|s| s.trim() == "0");
    (parties.swap_remove(0), stocker_litteraux)
}

fn analyser(masque: &str) -> Vec<Case> {
    let mut cases = Vec::new();
    let mut casse = Casse::Normale;
    let mut c = masque.chars();
    while let Some(x) = c.next() {
        match x {
            '0' | '9' | '#' | 'L' | '?' | 'A' | 'a' | '&' | 'C' => cases.push(Case::Saisie {
                classe: x,
                requis: matches!(x, '0' | 'L' | 'A' | '&'),
                casse,
            }),
            '>' => casse = Casse::Majuscule,
            '<' => casse = Casse::Minuscule,
            '!' => {}
            '\\' => {
                if let Some(l) = c.next() {
                    cases.push(Case::Litteral(l));
                }
            }
            '"' => {
                for l in c.by_ref() {
                    if l == '"' {
                        break;
                    }
                    cases.push(Case::Litteral(l));
                }
            }
            autre => cases.push(Case::Litteral(autre)),
        }
    }
    cases
}

fn accepte(classe: char, c: char) -> bool {
    match classe {
        '0' | '9' => c.is_ascii_digit(),
        '#' => c.is_ascii_digit() || matches!(c, ' ' | '+' | '-'),
        'L' | '?' => c.is_alphabetic(),
        'A' | 'a' => c.is_alphanumeric(),
        _ => true,
    }
}

fn appliquer_casse(c: char, casse: Casse) -> String {
    match casse {
        Casse::Normale => c.to_string(),
        Casse::Majuscule => c.to_uppercase().collect(),
        Casse::Minuscule => c.to_lowercase().collect(),
    }
}

/// Mise en correspondance avec retour arriere memorise (cout borne par cases x saisie).
struct Correspondance<'a> {
    cases: &'a [Case],
    saisie: &'a [char],
    litteraux: bool,
    memo: Vec<Option<Option<String>>>,
}

impl Correspondance<'_> {
    fn essayer(&mut self, k: usize, i: usize) -> Option<String> {
        let cle = k * (self.saisie.len() + 1) + i;
        if let Some(connu) = &self.memo[cle] {
            return connu.clone();
        }
        let resultat = self.calculer(k, i);
        self.memo[cle] = Some(resultat.clone());
        resultat
    }

    fn calculer(&mut self, k: usize, i: usize) -> Option<String> {
        let Some(case) = self.cases.get(k).cloned() else {
            return (i == self.saisie.len()).then(String::new);
        };
        let suivant = self.saisie.get(i).copied();
        match case {
            Case::Litteral(l) => {
                let prefixe = if self.litteraux { l.to_string() } else { String::new() };
                if suivant == Some(l) {
                    if let Some(s) = self.essayer(k + 1, i + 1) {
                        return Some(prefixe + &s);
                    }
                }
                self.essayer(k + 1, i).map(|s| prefixe + &s)
            }
            Case::Saisie { classe, requis, casse } => {
                if let Some(c) = suivant.filter(|&c| accepte(classe, c)) {
                    if let Some(s) = self.essayer(k + 1, i + 1) {
                        return Some(appliquer_casse(c, casse) + &s);
                    }
                }
                if requis {
                    None
                } else {
                    self.essayer(k + 1, i)
                }
            }
        }
    }
}

/// Verifie `valeur` contre le masque et renvoie la valeur a stocker (casse et litteraux appliques).
pub fn appliquer_masque(masque: &str, valeur: &str) -> Result<String, String> {
    let (motif, litteraux) = sections(masque);
    let cases = analyser(&motif);
    if cases.len() > 256 || valeur.chars().count() > 512 {
        return Err("masque ou valeur trop long.".into());
    }
    let saisie: Vec<char> = valeur.chars().collect();
    let mut m = Correspondance {
        cases: &cases,
        saisie: &saisie,
        litteraux,
        memo: vec![None; (cases.len() + 1) * (saisie.len() + 1)],
    };
    m.essayer(0, 0)
        .ok_or_else(|| format!("« {valeur} » ne respecte pas le masque de saisie « {motif} »."))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn telephone_avec_et_sans_separateurs() {
        let m = "00 00 00 00 00;0;_";
        assert_eq!(appliquer_masque(m, "0612345678").as_deref(), Ok("06 12 34 56 78"));
        assert_eq!(appliquer_masque(m, "06 12 34 56 78").as_deref(), Ok("06 12 34 56 78"));
        assert!(appliquer_masque(m, "06123").is_err());
        assert_eq!(appliquer_masque("00 00 00 00 00", "06 12 34 56 78").as_deref(), Ok("0612345678"));
    }

    #[test]
    fn casse_et_facultatifs() {
        assert_eq!(appliquer_masque(">L<?????", "dupont").as_deref(), Ok("Dupont"));
        assert_eq!(appliquer_masque(">LL", "ab").as_deref(), Ok("AB"));
        assert!(appliquer_masque("LL", "a1").is_err());
        assert_eq!(appliquer_masque("99999", "75").as_deref(), Ok("75"));
        assert_eq!(appliquer_masque("\\F-000", "F-123;").ok(), None);
        assert_eq!(appliquer_masque("\"FR\"000;0", "FR123").as_deref(), Ok("FR123"));
    }
}
