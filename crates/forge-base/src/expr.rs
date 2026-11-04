//! Traduction des expressions Access (francaises ou anglaises) en SQL SQLite sur.
//!
//! Exemples : `[Prix]*[Qte]`, `[Nom] & " " & [Prénom]`, `VraiFaux([Stock]>0;"oui";"non")`,
//! criteres `>10 Et <20`, `Entre #01/01/2024# Et #31/12/2024#`, `Comme "Dup*"`, `"Paris" Ou "Lyon"`.
//!
//! La sortie ne contient que des identifiants cites, des litteraux echappes, des nombres,
//! des operateurs et des fonctions d'une liste blanche : jamais de texte utilisateur brut.
//! Les noms entre crochets inconnus deviennent des parametres (`:p1`, `:p2`...) en contexte requete.

use std::collections::HashSet;

use crate::erreur::{ErreurBase, Resultat};
use crate::ident::{guillemets, litteral};
use crate::valeurs::analyser_date;

/// Ou l'expression sera utilisee.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Contexte {
    /// Schema (CHECK, colonne generee, DEFAULT) : fonctions deterministes, pas de parametre.
    Schema,
    /// Requete : agregats, date du jour, parametres autorises.
    Requete,
}

#[derive(Clone, Debug, PartialEq)]
enum Jeton {
    Champ(String),
    Mot(String),
    Nombre(String),
    Texte(String),
    Date(String),
    Op(&'static str),
    ParO,
    ParF,
    Sep,
    Point,
}

/// Traducteur d'expressions ; accumule les parametres rencontres.
pub struct Traducteur {
    contexte: Contexte,
    champs: Option<HashSet<String>>,
    parametres: Vec<String>,
}

const OPS: [&str; 13] = ["<>", "<=", ">=", "!=", "=", "<", ">", "+", "-", "*", "/", "\\", "^"];

fn sans_accents(texte: &str) -> String {
    texte
        .chars()
        .map(|c| match c {
            'à' | 'â' | 'ä' => 'a',
            'é' | 'è' | 'ê' | 'ë' => 'e',
            'î' | 'ï' => 'i',
            'ô' | 'ö' => 'o',
            'ù' | 'û' | 'ü' => 'u',
            'ç' => 'c',
            c => c,
        })
        .collect()
}

fn normaliser(mot: &str) -> String {
    sans_accents(&mot.to_lowercase()).trim_end_matches('$').to_string()
}

fn err(texte: impl Into<String>) -> ErreurBase {
    ErreurBase::Expression(texte.into())
}

/// Decoupe l'expression en jetons.
fn jetons(expr: &str) -> Resultat<Vec<Jeton>> {
    let pv = separateur_point_virgule(expr);
    let c: Vec<char> = expr.chars().collect();
    let mut sortie = Vec::new();
    let mut i = 0;
    while i < c.len() {
        let ch = c[i];
        if ch.is_whitespace() {
            i += 1;
        } else if ch == '[' {
            let fin = c[i + 1..]
                .iter()
                .position(|&x| x == ']')
                .ok_or_else(|| err("crochet « [ » non fermé."))?;
            let nom: String = c[i + 1..i + 1 + fin].iter().collect();
            if nom.trim().is_empty() {
                return Err(err("nom vide entre crochets."));
            }
            sortie.push(Jeton::Champ(nom.trim().to_string()));
            i += fin + 2;
        } else if ch == '"' || ch == '\'' {
            let mut texte = String::new();
            i += 1;
            loop {
                match c.get(i) {
                    None => return Err(err("chaîne non fermée.")),
                    Some(&x) if x == ch && c.get(i + 1) == Some(&ch) => {
                        texte.push(ch);
                        i += 2;
                    }
                    Some(&x) if x == ch => {
                        i += 1;
                        break;
                    }
                    Some(&x) => {
                        texte.push(x);
                        i += 1;
                    }
                }
            }
            sortie.push(Jeton::Texte(texte));
        } else if ch == '#' {
            let fin = c[i + 1..]
                .iter()
                .position(|&x| x == '#')
                .ok_or_else(|| err("date « # » non fermée."))?;
            let brut: String = c[i + 1..i + 1 + fin].iter().collect();
            let date = analyser_date(&brut).ok_or_else(|| err(format!("date invalide #{brut}#.")))?;
            sortie.push(Jeton::Date(date));
            i += fin + 2;
        } else if ch.is_ascii_digit() || (ch == '.' && c.get(i + 1).is_some_and(char::is_ascii_digit)) {
            let mut n = String::new();
            while let Some(&x) = c.get(i) {
                let decimal = (x == '.' || (pv && x == ','))
                    && c.get(i + 1).is_some_and(char::is_ascii_digit)
                    && !n.contains('.');
                if x.is_ascii_digit() {
                    n.push(x);
                } else if decimal {
                    n.push('.');
                } else if (x == 'e' || x == 'E') && c.get(i + 1).is_some_and(|d| d.is_ascii_digit() || *d == '-' || *d == '+') && !n.contains('e') {
                    n.push('e');
                    if let Some(&s) = c.get(i + 1).filter(|d| **d == '-' || **d == '+') {
                        n.push(s);
                        i += 1;
                    }
                } else {
                    break;
                }
                i += 1;
            }
            sortie.push(Jeton::Nombre(n));
        } else if ch.is_alphabetic() || ch == '_' {
            let mut mot = String::new();
            while let Some(&x) = c.get(i) {
                if x.is_alphanumeric() || x == '_' || x == '$' {
                    mot.push(x);
                    i += 1;
                } else {
                    break;
                }
            }
            sortie.push(Jeton::Mot(mot));
        } else if ch == '(' {
            sortie.push(Jeton::ParO);
            i += 1;
        } else if ch == ')' {
            sortie.push(Jeton::ParF);
            i += 1;
        } else if (ch == ';' && pv) || (ch == ',' && !pv) {
            sortie.push(Jeton::Sep);
            i += 1;
        } else if (ch == '!' && c.get(i + 1) != Some(&'=')) || ch == '.' {
            sortie.push(Jeton::Point);
            i += 1;
        } else if ch == '&' {
            sortie.push(Jeton::Op("||"));
            i += 1;
        } else {
            let reste: String = c[i..c.len().min(i + 2)].iter().collect();
            let op = OPS
                .iter()
                .find(|o| reste.starts_with(**o))
                .ok_or_else(|| err(format!("caractère inattendu « {ch} ».")))?;
            sortie.push(Jeton::Op(if *op == "!=" { "<>" } else { op }));
            i += op.chars().count();
        }
    }
    Ok(sortie)
}

/// Vrai si `;` sert de separateur d'arguments (saisie francaise d'Access).
fn separateur_point_virgule(expr: &str) -> bool {
    let mut dans: Option<char> = None;
    for c in expr.chars() {
        match dans {
            Some(q) if c == q => dans = None,
            Some(_) => {}
            None if c == '"' || c == '\'' || c == '[' || c == '#' => {
                dans = Some(if c == '[' { ']' } else { c })
            }
            None if c == ';' => return true,
            None => {}
        }
    }
    false
}

/// Transforme un motif Access (`*`, `?`, `#`) en motif LIKE echappe par `\`.
pub fn motif_like(motif: &str) -> String {
    let mut sortie = String::new();
    let mut c = motif.chars().peekable();
    while let Some(x) = c.next() {
        match x {
            '[' => {
                let mut classe = String::new();
                for y in c.by_ref() {
                    if y == ']' {
                        break;
                    }
                    classe.push(y);
                }
                // [*] [?] [#] = caractere litteral ; autres classes : un caractere quelconque.
                if classe.chars().count() == 1 {
                    sortie.push_str(&echapper_like(&classe));
                } else {
                    sortie.push('_');
                }
            }
            '*' => sortie.push('%'),
            '?' | '#' => sortie.push('_'),
            autre => sortie.push_str(&echapper_like(&autre.to_string())),
        }
    }
    sortie
}

/// Echappe `%`, `_` et `\` pour une clause `LIKE ... ESCAPE '\'`.
pub fn echapper_like(texte: &str) -> String {
    texte.replace('\\', "\\\\").replace('%', "\\%").replace('_', "\\_")
}

fn mot_cle(mot: &str) -> Option<&'static str> {
    Some(match normaliser(mot).as_str() {
        "et" | "and" => "AND",
        "ou" | "or" => "OR",
        "pas" | "not" => "NOT",
        "mod" => "%",
        "comme" | "like" => "LIKE",
        "entre" | "between" => "BETWEEN",
        "dans" | "in" => "IN",
        "est" | "is" => "IS",
        "null" | "nul" => "NULL",
        "vrai" | "true" | "oui" | "yes" => "1",
        "faux" | "false" | "non" | "no" => "0",
        _ => return None,
    })
}

fn sans_guillemets(arg: &str) -> Option<String> {
    let a = arg.trim();
    (a.len() >= 2 && a.starts_with('\'') && a.ends_with('\''))
        .then(|| a[1..a.len() - 1].replace("''", "'").to_lowercase())
}

impl Traducteur {
    /// Nouveau traducteur. `champs` : noms de champs connus (sinon tout nom est un champ).
    pub fn nouveau(contexte: Contexte, champs: Option<&[String]>) -> Self {
        Self {
            contexte,
            champs: champs.map(|l| l.iter().map(|c| c.to_lowercase()).collect()),
            parametres: Vec::new(),
        }
    }

    /// Parametres rencontres, dans l'ordre (`:p1` = premier).
    pub fn parametres(&self) -> &[String] {
        &self.parametres
    }

    fn est_champ(&self, nom: &str) -> bool {
        self.champs.as_ref().is_none_or(|c| c.contains(&nom.to_lowercase()))
    }

    fn parametre(&mut self, nom: &str) -> Resultat<String> {
        if self.contexte == Contexte::Schema {
            return Err(err(format!("champ inconnu « {nom} ».")));
        }
        let pos = match self.parametres.iter().position(|p| p.eq_ignore_ascii_case(nom)) {
            Some(p) => p,
            None => {
                self.parametres.push(nom.to_string());
                self.parametres.len() - 1
            }
        };
        Ok(format!(":p{}", pos + 1))
    }

    fn requete_seulement(&self, nom: &str) -> Resultat<()> {
        if self.contexte == Contexte::Schema {
            return Err(err(format!(
                "la fonction « {nom} » n'est pas autorisée dans une règle ou un champ calculé."
            )));
        }
        Ok(())
    }

    /// Traduit une expression complete.
    pub fn expression(&mut self, expr: &str) -> Resultat<String> {
        let j = jetons(expr)?;
        if j.is_empty() {
            return Err(err("expression vide."));
        }
        self.traduire(&j)
    }

    /// Traduit un critere ou une regle « Valide si » appliquee a `colonne_sql`.
    ///
    /// `>5 Et <10` devient `col > 5 AND col < 10`, `"Paris" Ou "Lyon"` devient
    /// `col = 'Paris' OR col = 'Lyon'`, un texte nu (`Paris`) est compris comme une chaine.
    pub fn critere(&mut self, critere: &str, colonne_sql: &str) -> Resultat<String> {
        let j = jetons(critere)?;
        if j.is_empty() {
            return Err(err("critère vide."));
        }
        let mut morceaux: Vec<String> = Vec::new();
        let mut partie: Vec<Jeton> = Vec::new();
        let (mut prof, mut entre) = (0i32, false);
        for jeton in j {
            match &jeton {
                Jeton::ParO => prof += 1,
                Jeton::ParF => prof -= 1,
                Jeton::Mot(m) if prof == 0 => match mot_cle(m) {
                    Some("BETWEEN") => entre = true,
                    Some("AND") if entre => entre = false,
                    Some(op @ ("AND" | "OR")) => {
                        morceaux.push(self.partie_critere(&partie, colonne_sql)?);
                        morceaux.push(op.to_string());
                        partie.clear();
                        continue;
                    }
                    _ => {}
                },
                _ => {}
            }
            partie.push(jeton);
        }
        morceaux.push(self.partie_critere(&partie, colonne_sql)?);
        Ok(format!("({})", morceaux.join(" ")))
    }

    fn partie_critere(&mut self, partie: &[Jeton], col: &str) -> Resultat<String> {
        let Some(premier) = partie.first() else {
            return Err(err("« Et » / « Ou » sans condition."));
        };
        let operateur_suivant = |j: Option<&Jeton>| match j {
            Some(Jeton::Op(o)) => matches!(*o, "=" | "<>" | "<" | "<=" | ">" | ">="),
            Some(Jeton::Mot(m)) => {
                matches!(mot_cle(m), Some("LIKE" | "BETWEEN" | "IN" | "IS"))
            }
            _ => false,
        };
        if operateur_suivant(Some(premier)) {
            return Ok(format!("{col} {}", self.traduire(partie)?));
        }
        if let Jeton::Mot(m) = premier {
            if mot_cle(m) == Some("NOT") {
                if operateur_suivant(partie.get(1)) {
                    return Ok(format!("{col} {}", self.traduire(partie)?));
                }
                return Ok(format!("NOT ({})", self.partie_critere(&partie[1..], col)?));
            }
            if partie.len() == 1 && mot_cle(m).is_none() && !self.est_champ(m) {
                return Ok(format!("{col} = {}", litteral(m)));
            }
        }
        let reference = partie.iter().any(|j| match j {
            Jeton::Champ(_) => true,
            Jeton::Mot(m) => mot_cle(m).is_none() && self.est_champ(m),
            _ => false,
        });
        let sql = self.traduire(partie)?;
        Ok(if reference && partie.len() > 1 {
            format!("({sql})")
        } else {
            format!("{col} = ({sql})")
        })
    }

    fn traduire(&mut self, j: &[Jeton]) -> Resultat<String> {
        let mut sortie: Vec<String> = Vec::new();
        let mut i = 0;
        let mut prof = 0i32;
        while i < j.len() {
            match &j[i] {
                Jeton::Nombre(n) => sortie.push(n.clone()),
                Jeton::Texte(t) => sortie.push(litteral(t)),
                Jeton::Date(d) => sortie.push(litteral(d)),
                Jeton::Op("^") => {
                    self.requete_seulement("^")?;
                    let gauche = operande_gauche(&mut sortie)?;
                    let droite = self.operande(j, &mut i)?;
                    sortie.push(format!("fo_puissance({gauche}, {droite})"));
                }
                // Division entiere Access `a \ b` : SQLite divise deja les entiers en entier.
                Jeton::Op("\\") => sortie.push("/".into()),
                Jeton::Op(o) => sortie.push((*o).to_string()),
                Jeton::ParO => {
                    prof += 1;
                    sortie.push("(".into());
                }
                Jeton::ParF => {
                    prof -= 1;
                    if prof < 0 {
                        return Err(err("parenthèse « ) » en trop."));
                    }
                    sortie.push(")".into());
                }
                Jeton::Sep if prof == 0 => {
                    return Err(err("séparateur « ; » ou « , » hors d'une fonction ou d'une liste."))
                }
                Jeton::Sep => sortie.push(",".into()),
                Jeton::Point => return Err(err("« . » ou « ! » mal placé.")),
                Jeton::Champ(nom) => sortie.push(self.reference(j, &mut i, nom, true)?),
                Jeton::Mot(m) => {
                    if j.get(i + 1) == Some(&Jeton::ParO) {
                        let (args, fin) = self.arguments(j, i + 1)?;
                        sortie.push(self.appel(m, args)?);
                        i = fin;
                    } else if let Some(cle) = mot_cle(m) {
                        sortie.push(cle.to_string());
                        if cle == "LIKE" {
                            if let Some(Jeton::Texte(motif)) = j.get(i + 1) {
                                sortie.push(format!("{} ESCAPE '\\'", litteral(&motif_like(motif))));
                                i += 1;
                            }
                        }
                    } else {
                        sortie.push(self.reference(j, &mut i, m, false)?);
                    }
                }
            }
            i += 1;
        }
        if prof != 0 {
            return Err(err("parenthèses non équilibrées."));
        }
        Ok(sortie.join(" "))
    }

    /// Operande unique apres `^` (nombre, champ, parenthese, fonction).
    fn operande(&mut self, j: &[Jeton], i: &mut usize) -> Resultat<String> {
        *i += 1;
        let debut = *i;
        match j.get(debut) {
            Some(Jeton::ParO) => {
                let fin = fermeture(j, debut)?;
                *i = fin;
                Ok(format!("({})", self.traduire(&j[debut + 1..fin])?))
            }
            Some(Jeton::Mot(_)) if j.get(debut + 1) == Some(&Jeton::ParO) => {
                let fin = fermeture(j, debut + 1)?;
                *i = fin;
                self.traduire(&j[debut..=fin])
            }
            Some(Jeton::Op("-")) => Ok(format!("-{}", self.operande(j, i)?)),
            Some(_) => self.traduire(&j[debut..=debut]),
            None => Err(err("« ^ » sans exposant.")),
        }
    }

    fn reference(&mut self, j: &[Jeton], i: &mut usize, nom: &str, crochets: bool) -> Resultat<String> {
        if j.get(*i + 1) == Some(&Jeton::Point) {
            if let Some(Jeton::Champ(c) | Jeton::Mot(c)) = j.get(*i + 2) {
                *i += 2;
                if c == "*" {
                    return Ok(format!("{}.*", guillemets(nom)));
                }
                return Ok(format!("{}.{}", guillemets(nom), guillemets(c)));
            }
            if let Some(Jeton::Op("*")) = j.get(*i + 2) {
                *i += 2;
                return Ok(format!("{}.*", guillemets(nom)));
            }
            return Err(err(format!("champ attendu après « {nom}. »")));
        }
        if self.est_champ(nom) {
            Ok(guillemets(nom))
        } else if crochets || self.contexte == Contexte::Requete {
            self.parametre(nom)
        } else {
            Err(err(format!("champ inconnu « {nom} ».")))
        }
    }

    /// Arguments d'un appel commencant a la parenthese `ouvre`. Renvoie (args traduits, index de `)`).
    fn arguments(&mut self, j: &[Jeton], ouvre: usize) -> Resultat<(Vec<String>, usize)> {
        let fin = fermeture(j, ouvre)?;
        let mut args = Vec::new();
        let mut debut = ouvre + 1;
        let mut prof = 0;
        for k in ouvre + 1..fin {
            match j[k] {
                Jeton::ParO => prof += 1,
                Jeton::ParF => prof -= 1,
                Jeton::Sep if prof == 0 => {
                    args.push(self.argument(&j[debut..k])?);
                    debut = k + 1;
                }
                _ => {}
            }
        }
        if debut < fin || !args.is_empty() {
            args.push(self.argument(&j[debut..fin])?);
        }
        Ok((args, fin))
    }

    fn argument(&mut self, j: &[Jeton]) -> Resultat<String> {
        match j {
            [] => Err(err("argument vide.")),
            [Jeton::Op("*")] => Ok("*".into()),
            _ => self.traduire(j),
        }
    }

    fn appel(&mut self, nom: &str, a: Vec<String>) -> Resultat<String> {
        let n = normaliser(nom);
        let arite = |ok: bool| if ok { Ok(()) } else { Err(err(format!("nombre d'arguments incorrect pour « {nom} »."))) };
        let sql = match n.as_str() {
            "gauche" | "left" => { arite(a.len() == 2)?; format!("substr({}, 1, {})", a[0], a[1]) }
            "droite" | "right" => { arite(a.len() == 2)?; format!("(CASE WHEN ({1}) <= 0 THEN '' ELSE substr({0}, -({1})) END)", a[0], a[1]) }
            "extracchaine" | "mid" => { arite(a.len() == 2 || a.len() == 3)?; format!("substr({})", a.join(", ")) }
            "nbcar" | "len" => { arite(a.len() == 1)?; format!("length({})", a[0]) }
            "majuscule" | "ucase" => { arite(a.len() == 1)?; format!("upper({})", a[0]) }
            "minuscule" | "lcase" => { arite(a.len() == 1)?; format!("lower({})", a[0]) }
            "supprespace" | "trim" => { arite(a.len() == 1)?; format!("trim({})", a[0]) }
            "supprespaceg" | "ltrim" => { arite(a.len() == 1)?; format!("ltrim({})", a[0]) }
            "supprespaced" | "rtrim" => { arite(a.len() == 1)?; format!("rtrim({})", a[0]) }
            "danschaine" | "instr" => {
                arite(a.len() == 2 || a.len() == 3)?;
                if a.len() == 2 {
                    format!("instr({}, {})", a[0], a[1])
                } else {
                    format!("(CASE WHEN instr(substr({1}, {0}), {2}) = 0 THEN 0 ELSE instr(substr({1}, {0}), {2}) + ({0}) - 1 END)", a[0], a[1], a[2])
                }
            }
            "remplacer" | "replace" => { arite(a.len() == 3)?; format!("replace({}, {}, {})", a[0], a[1], a[2]) }
            "espace" | "space" => { arite(a.len() == 1)?; format!("printf('%*s', {}, '')", a[0]) }
            "abs" => { arite(a.len() == 1)?; format!("abs({})", a[0]) }
            "arrondi" | "round" => { arite(a.len() == 1 || a.len() == 2)?; format!("round({})", a.join(", ")) }
            "ent" | "int" => { arite(a.len() == 1)?; format!("(CAST({0} AS INTEGER) - (({0}) < CAST({0} AS INTEGER)))", a[0]) }
            "tronque" | "fix" => { arite(a.len() == 1)?; format!("CAST({} AS INTEGER)", a[0]) }
            "signe" | "sgn" => { arite(a.len() == 1)?; format!("(CASE WHEN ({0}) > 0 THEN 1 WHEN ({0}) < 0 THEN -1 ELSE 0 END)", a[0]) }
            "racine" | "sqr" => { self.requete_seulement(nom)?; arite(a.len() == 1)?; format!("fo_racine({})", a[0]) }
            "vraifaux" | "iif" => { arite(a.len() == 3)?; format!("(CASE WHEN {} THEN {} ELSE {} END)", a[0], a[1], a[2]) }
            "nz" => { arite(a.len() == 1 || a.len() == 2)?; format!("coalesce({}, {})", a[0], a.get(1).map_or("''", String::as_str)) }
            "estnull" | "isnull" => { arite(a.len() == 1)?; format!("(({}) IS NULL)", a[0]) }
            "estdate" | "isdate" => { arite(a.len() == 1)?; format!("(datetime({}) IS NOT NULL)", a[0]) }
            "estnumerique" | "isnumeric" => { arite(a.len() == 1)?; format!("(typeof({0}) IN ('integer','real') OR (trim({0}) <> '' AND trim({0}) NOT GLOB '*[^0-9.+-]*'))", a[0]) }
            "date" if a.is_empty() => { self.requete_seulement(nom)?; "date('now','localtime')".into() }
            "maintenant" | "now" => { self.requete_seulement(nom)?; arite(a.is_empty())?; "datetime('now','localtime')".into() }
            "temps" | "time" if a.is_empty() => { self.requete_seulement(nom)?; "time('now','localtime')".into() }
            "annee" | "year" => partie_date(&a, "%Y", nom)?,
            "mois" | "month" => partie_date(&a, "%m", nom)?,
            "jour" | "day" => partie_date(&a, "%d", nom)?,
            "heure" | "hour" => partie_date(&a, "%H", nom)?,
            "minute" => partie_date(&a, "%M", nom)?,
            "seconde" | "second" => partie_date(&a, "%S", nom)?,
            "joursem" | "weekday" => { arite(a.len() == 1)?; format!("(CAST(strftime('%w', {}) AS INTEGER) + 1)", a[0]) }
            "partdate" | "datepart" => {
                arite(a.len() == 2)?;
                let f = match sans_guillemets(&a[0]).as_deref() {
                    Some("yyyy") => "%Y", Some("m") => "%m", Some("d") => "%d", Some("h") => "%H",
                    Some("n") => "%M", Some("s") => "%S", Some("y") => "%j", Some("ww") => "%W",
                    Some("w") => return Ok(format!("(CAST(strftime('%w', {}) AS INTEGER) + 1)", a[1])),
                    Some("q") => return Ok(format!("((CAST(strftime('%m', {}) AS INTEGER) + 2) / 3)", a[1])),
                    _ => return Err(err("intervalle de date inconnu (yyyy, q, m, y, d, w, ww, h, n, s).")),
                };
                format!("CAST(strftime('{f}', {}) AS INTEGER)", a[1])
            }
            "ajdate" | "dateadd" => {
                arite(a.len() == 3)?;
                let (unite, facteur) = intervalle(&a[0])?;
                format!("datetime({}, (({}) * {facteur}) || ' {unite}')", a[2], a[1])
            }
            "diffdate" | "datediff" => {
                arite(a.len() == 3)?;
                let (d1, d2) = (&a[1], &a[2]);
                match sans_guillemets(&a[0]).as_deref() {
                    Some("yyyy") => format!("(CAST(strftime('%Y', {d2}) AS INTEGER) - CAST(strftime('%Y', {d1}) AS INTEGER))"),
                    Some("q") => format!("(((CAST(strftime('%Y', {d2}) AS INTEGER) * 12 + CAST(strftime('%m', {d2}) AS INTEGER) - 1) / 3) - ((CAST(strftime('%Y', {d1}) AS INTEGER) * 12 + CAST(strftime('%m', {d1}) AS INTEGER) - 1) / 3))"),
                    Some("m") => format!("((CAST(strftime('%Y', {d2}) AS INTEGER) * 12 + CAST(strftime('%m', {d2}) AS INTEGER)) - (CAST(strftime('%Y', {d1}) AS INTEGER) * 12 + CAST(strftime('%m', {d1}) AS INTEGER)))"),
                    Some("d" | "y" | "w") => format!("CAST(julianday(date({d2})) - julianday(date({d1})) AS INTEGER)"),
                    Some("ww") => format!("(CAST(julianday(date({d2})) - julianday(date({d1})) AS INTEGER) / 7)"),
                    Some("h") => format!("CAST(round((julianday({d2}) - julianday({d1})) * 24) AS INTEGER)"),
                    Some("n") => format!("CAST(round((julianday({d2}) - julianday({d1})) * 1440) AS INTEGER)"),
                    Some("s") => format!("CAST(round((julianday({d2}) - julianday({d1})) * 86400) AS INTEGER)"),
                    _ => return Err(err("intervalle de date inconnu (yyyy, q, m, d, ww, h, n, s).")),
                }
            }
            "serialdate" | "dateserial" => {
                arite(a.len() == 3)?;
                format!("date(printf('%04d-01-01', {}), (({}) - 1) || ' months', (({}) - 1) || ' days')", a[0], a[1], a[2])
            }
            "format" => { arite(a.len() == 2)?; format_access(&a[0], &a[1])? }
            "cnum" | "cdbl" | "csng" | "cdec" | "cmonetaire" | "ccur" | "val" => { arite(a.len() == 1)?; format!("CAST({} AS REAL)", a[0]) }
            "centlong" | "clng" | "cent" | "cint" => { arite(a.len() == 1)?; format!("CAST(round({}) AS INTEGER)", a[0]) }
            "cchaine" | "cstr" | "chaine" | "str" => { arite(a.len() == 1)?; format!("CAST({} AS TEXT)", a[0]) }
            "cdate" | "cvdate" | "datevaleur" | "datevalue" => { arite(a.len() == 1)?; format!("datetime({})", a[0]) }
            "cbool" => { arite(a.len() == 1)?; format!("(({}) <> 0)", a[0]) }
            "asc" | "ascii" => { arite(a.len() == 1)?; format!("unicode({})", a[0]) }
            "car" | "chr" => { arite(a.len() == 1)?; format!("char({})", a[0]) }
            "choisir" | "choose" => {
                arite(a.len() >= 2)?;
                let cas: Vec<String> = a[1..].iter().enumerate().map(|(k, v)| format!("WHEN {} THEN {v}", k + 1)).collect();
                format!("(CASE {} {} END)", a[0], cas.join(" "))
            }
            "commutateur" | "switch" => {
                arite(a.len() >= 2 && a.len() % 2 == 0)?;
                let cas: Vec<String> = a.chunks(2).map(|p| format!("WHEN {} THEN {}", p[0], p[1])).collect();
                format!("(CASE {} END)", cas.join(" "))
            }
            "somme" | "sum" => self.agregat("sum", &a, nom)?,
            "moyenne" | "avg" => self.agregat("avg", &a, nom)?,
            "compte" | "count" => self.agregat("count", &a, nom)?,
            "premier" | "first" => self.agregat("min", &a, nom)?,
            "dernier" | "last" => self.agregat("max", &a, nom)?,
            "min" | "max" if a.len() == 1 => self.agregat(&n, &a, nom)?,
            "var" | "vara" => { self.requete_seulement(nom)?; arite(a.len() == 1)?; variance(&a[0]) }
            "ecartype" | "stdev" => { self.requete_seulement(nom)?; arite(a.len() == 1)?; format!("fo_racine({})", variance(&a[0])) }
            "coalesce" | "ifnull" | "nullif" | "length" | "lower" | "upper" | "substr"
            | "strftime" | "julianday" | "typeof" | "printf" | "hex" | "unicode" | "char" | "min" | "max" => {
                format!("{n}({})", a.join(", "))
            }
            "datetime" | "time" | "date" => format!("{n}({})", a.join(", ")),
            "total" | "group_concat" => { self.requete_seulement(nom)?; format!("{n}({})", a.join(", ")) }
            _ => return Err(err(format!("fonction inconnue « {nom} »."))),
        };
        Ok(sql)
    }

    fn agregat(&self, sql: &str, a: &[String], nom: &str) -> Resultat<String> {
        self.requete_seulement(nom)?;
        if a.len() != 1 {
            return Err(err(format!("« {nom} » attend un seul argument.")));
        }
        Ok(format!("{sql}({})", a[0]))
    }
}

/// Retire de la sortie l'operande gauche de `^` (groupe parenthese compris).
fn operande_gauche(sortie: &mut Vec<String>) -> Resultat<String> {
    let dernier = sortie.pop().ok_or_else(|| err("« ^ » sans opérande."))?;
    if dernier != ")" {
        return Ok(dernier);
    }
    let mut groupe = vec![dernier];
    let mut prof = 1;
    while prof > 0 {
        let x = sortie.pop().ok_or_else(|| err("parenthèses non équilibrées."))?;
        match x.as_str() {
            ")" => prof += 1,
            "(" => prof -= 1,
            _ => {}
        }
        groupe.push(x);
    }
    groupe.reverse();
    Ok(groupe.join(" "))
}

fn fermeture(j: &[Jeton], ouvre: usize) -> Resultat<usize> {
    let mut prof = 0;
    for (k, x) in j.iter().enumerate().skip(ouvre) {
        match x {
            Jeton::ParO => prof += 1,
            Jeton::ParF => {
                prof -= 1;
                if prof == 0 {
                    return Ok(k);
                }
            }
            _ => {}
        }
    }
    Err(err("parenthèse « ( » non fermée."))
}

fn partie_date(a: &[String], f: &str, nom: &str) -> Resultat<String> {
    if a.len() != 1 {
        return Err(err(format!("« {nom} » attend une date.")));
    }
    Ok(format!("CAST(strftime('{f}', {}) AS INTEGER)", a[0]))
}

fn variance(x: &str) -> String {
    format!("((sum(({x}) * ({x})) - sum({x}) * sum({x}) / count({x})) / (count({x}) - 1))")
}

fn intervalle(arg: &str) -> Resultat<(&'static str, i64)> {
    Ok(match sans_guillemets(arg).as_deref() {
        Some("yyyy") => ("years", 1),
        Some("q") => ("months", 3),
        Some("m") => ("months", 1),
        Some("d" | "y" | "w") => ("days", 1),
        Some("ww") => ("days", 7),
        Some("h") => ("hours", 1),
        Some("n") => ("minutes", 1),
        Some("s") => ("seconds", 1),
        _ => return Err(err("intervalle de date inconnu (yyyy, q, m, d, ww, h, n, s).")),
    })
}

/// `Format(x; "jj/mm/aaaa")`, `Format(x; "0,00")`, `Format(x; "Pourcentage")`.
fn format_access(valeur: &str, motif: &str) -> Resultat<String> {
    let m = sans_guillemets(motif).ok_or_else(|| err("le format doit être un texte littéral."))?;
    let nommes = match m.as_str() {
        "date, abrégé" | "date abrege" | "short date" => Some("%d/%m/%Y"),
        "date, général" | "general date" => Some("%d/%m/%Y %H:%M:%S"),
        "heure, abrégé" | "short time" => Some("%H:%M"),
        _ => None,
    };
    if let Some(f) = nommes {
        return Ok(format!("strftime('{f}', {valeur})"));
    }
    if m == "pourcentage" || m == "percent" {
        return Ok(format!("printf('%.2f %%', ({valeur}) * 100)"));
    }
    if !m.is_empty() && m.chars().all(|c| matches!(c, '0' | '#' | '.' | ',')) {
        let decimales = m.split(['.', ',']).nth(1).map_or(0, str::len);
        return Ok(format!("printf('%.{decimales}f', {valeur})"));
    }
    let mut f = String::new();
    let mut reste = m.as_str();
    let codes = [
        ("yyyy", "%Y"), ("aaaa", "%Y"), ("dd", "%d"), ("jj", "%d"), ("mm", "%m"),
        ("hh", "%H"), ("nn", "%M"), ("ss", "%S"),
    ];
    while !reste.is_empty() {
        if let Some((code, sql)) = codes.iter().find(|(c, _)| reste.starts_with(c)) {
            f.push_str(sql);
            reste = &reste[code.len()..];
        } else {
            let c = reste.chars().next().unwrap_or(' ');
            if !matches!(c, '/' | '-' | ':' | ' ' | '.' | ',' | 'h') {
                return Err(err(format!("format « {m} » non pris en charge.")));
            }
            f.push(c);
            reste = &reste[c.len_utf8()..];
        }
    }
    Ok(format!("strftime({}, {valeur})", litteral(&f)))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn req(e: &str) -> String {
        Traducteur::nouveau(Contexte::Requete, None).expression(e).unwrap_or_else(|x| x.to_string())
    }

    #[test]
    fn concatenation_et_fonctions_francaises() {
        assert_eq!(req("[Nom] & \" \" & [Prénom]"), "\"Nom\" || ' ' || \"Prénom\"");
        assert_eq!(
            req("VraiFaux([Stock]>0;\"oui\";\"non\")"),
            "(CASE WHEN \"Stock\" > 0 THEN 'oui' ELSE 'non' END)"
        );
        assert_eq!(req("Arrondi([Prix]*1,2;2)"), "round(\"Prix\" * 1.2, 2)");
        assert_eq!(req("Gauche([Nom], 3)"), "substr(\"Nom\", 1, 3)");
    }

    #[test]
    fn criteres_implicites() {
        let mut t = Traducteur::nouveau(Contexte::Requete, Some(&["Ville".to_string()]));
        assert_eq!(t.critere(">5 Et <10", "\"x\"").unwrap_or_default(), "(\"x\" > 5 AND \"x\" < 10)");
        assert_eq!(t.critere("\"Paris\" Ou Lyon", "\"x\"").unwrap_or_default(), "(\"x\" = ('Paris') OR \"x\" = 'Lyon')");
        assert_eq!(t.critere("Entre 1 Et 5", "\"x\"").unwrap_or_default(), "(\"x\" BETWEEN 1 AND 5)");
        assert_eq!(t.critere("Comme \"Du*\"", "\"x\"").unwrap_or_default(), "(\"x\" LIKE 'Du%' ESCAPE '\\')");
        assert_eq!(t.critere("Est Pas Null", "\"x\"").unwrap_or_default(), "(\"x\" IS NOT NULL)");
        assert_eq!(t.critere("[Ville saisie]", "\"x\"").unwrap_or_default(), "(\"x\" = (:p1))");
        assert_eq!(t.parametres(), ["Ville saisie"]);
    }

    #[test]
    fn dates_et_securite() {
        assert_eq!(req("#31/12/2024#"), "'2024-12-31'");
        assert!(req("1; DROP TABLE x").contains("invalide") || req("1; DROP TABLE x").contains("inconnu"));
        let mut s = Traducteur::nouveau(Contexte::Schema, Some(&[]));
        assert!(s.expression("Maintenant()").is_err());
        assert!(s.expression("[Inconnu] > 0").is_err());
        assert_eq!(req("'a'';--'"), "'a'';--'");
    }
}
