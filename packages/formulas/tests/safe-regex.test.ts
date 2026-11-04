// ReDoS : motifs pathologiques refuses vite, motifs legitimes inchanges ; jokers sans retour arriere exponentiel.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateFormula, FormulaError, wildcardMatcher, type Scalar } from '../src/index.ts';
import { analyzePattern } from '../src/functions/safe-regex.ts';

const run = (formula: string, cells: Record<string, Scalar> = {}): unknown => evaluateFormula(formula, { cells, locale: 'en-US' });
const isValueError = (v: unknown): boolean => v instanceof FormulaError && v.code === '#VALUE!';
const BAD = 'a'.repeat(5000) + 'b';

test('ReDoS : motifs pathologiques refuses en moins de 100 ms', () => {
  const patterns = ['(a+)+$', '(a*)*$', '(a|aa)+$', '(.*a){20}$', '(a+)\\1', '(a?)+b', '(\\w+\\s?)+$', '(a{1,3})*c'];
  for (const p of patterns) {
    for (const fn of ['REGEXTEST', 'REGEXEXTRACT']) {
      const t0 = performance.now();
      const v = run(`=${fn}(A1,"${p}")`, { A1: BAD });
      assert.ok(performance.now() - t0 < 100, `${fn} ${p} trop lent`);
      assert.ok(isValueError(v), `${fn} ${p} devrait etre #VALUE!`);
    }
  }
  assert.ok(isValueError(run('=REGEXREPLACE(A1,"(a+)+$","x")', { A1: BAD })));
});

test('ReDoS : limites de longueur (motif 200, texte 10 000)', () => {
  assert.ok(isValueError(run(`=REGEXTEST("abc","${'a'.repeat(201)}")`)));
  assert.equal(run(`=REGEXTEST("abc","${'a'.repeat(200)}")`), false);
  assert.ok(isValueError(run('=REGEXTEST(A1,"a")', { A1: 'a'.repeat(10_001) })));
  assert.equal(run('=REGEXTEST(A1,"a$")', { A1: 'a'.repeat(10_000) }), true);
});

test('ReDoS : motifs legitimes (fr/en, classes, groupes simples) inchanges', () => {
  assert.equal(run('=REGEXTEST("abc123","[0-9]+")'), true);
  assert.equal(run('=REGEXTEST("Éric","^É[a-z]+$")'), true);
  assert.equal(run('=REGEXEXTRACT("tel 192.168.1.10 ok","(?:\\d{1,3}\\.){3}\\d{1,3}")'), '192.168.1.10');
  assert.equal(run('=REGEXTEST("foo","^(foo|bar)+$")'), true);
  assert.equal(run('=REGEXREPLACE("a1b22c","[0-9]+","#")'), 'a#b#c');
  assert.equal(run('=REGEXTEST("jean@ex.fr","^[\\w.-]+@[\\w-]+\\.[a-z]{2,}$")'), true);
  assert.ok(analyzePattern('(ab)+') > 0);
  assert.equal(analyzePattern('(a|aa)+'), 0);
  assert.equal(analyzePattern('(a+)+'), 0);
  assert.equal(analyzePattern('((a)'), 0);
});

test('XMATCH mode 3 : motif pathologique = pas de correspondance, rapide', () => {
  const t0 = performance.now();
  const v = run('=XMATCH("(a+)+$",A1:A2,3)', { A1: BAD, A2: 'x' });
  assert.ok(performance.now() - t0 < 100);
  assert.ok(v instanceof FormulaError);
  assert.equal(run('=XMATCH("^b",A1:A2,3)', { A1: 'abc', A2: 'bcd' }), 2);
});

test('Jokers : NB.SI / SEARCH sans explosion et resultats corrects', () => {
  const t0 = performance.now();
  const stars = '*a'.repeat(30) + '*b';
  assert.equal(wildcardMatcher(stars).test(BAD.slice(-3000)), true);
  assert.equal(wildcardMatcher(stars).test('a'.repeat(3000)), false);
  assert.equal(run(`=COUNTIF(A1:A2,"${stars}")`, { A1: 'a'.repeat(5000), A2: 'x' }), 0);
  assert.ok(run(`=SEARCH("${stars}",A1)`, { A1: 'a'.repeat(2000) }) instanceof FormulaError);
  assert.ok(performance.now() - t0 < 500);
  const w = wildcardMatcher('a?c*e');
  assert.equal(w.test('ABCDE'), true);
  assert.equal(w.test('abce'), true);
  assert.equal(w.test('abxcde'), false);
  assert.equal(wildcardMatcher('~*x').test('*x'), true);
  assert.equal(wildcardMatcher('~*x').test('ax'), false);
  assert.equal(wildcardMatcher('*').test(''), true);
  assert.equal(wildcardMatcher('').test(''), true);
  assert.equal(wildcardMatcher('a*').test('abc'), true);
  assert.equal(wildcardMatcher('*c').test('abc'), true);
  assert.equal(wildcardMatcher('a*a').test('a'), false);
  assert.equal(wildcardMatcher('a*a').test('aba'), true);
  assert.equal(wildcardMatcher('b*').search('aabxx'), 2);
  assert.equal(wildcardMatcher('z*').search('aabxx'), -1);
  assert.equal(run('=SEARCH("b?d",A1)', { A1: 'abcdbxd' }), 2);
  assert.equal(run('=SEARCH("c*d",A1)', { A1: 'abcdbxd' }), 3);
  assert.equal(run('=COUNTIF(A1:A3,"a*")', { A1: 'abc', A2: 'bcd', A3: 'AXE' }), 2);
  assert.equal(run('=COUNTIF(A1:A3,"?c?")', { A1: 'acb', A2: 'bcd', A3: 'AXE' }), 2);
});
