// Evaluation de formule pas a pas : ordre des pas, references, IF paresseux, pas a pas detaille et sortant.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FormulaEngine } from '@forgeoffice/formulas';
import {
  evaluateStep, isFinished, startEvaluation, stepIn, stepOut, viewOf, type EvalEnv, type EvalState,
} from '../src/logic/formulas/evaluate.ts';

function setup(): { env: EvalEnv; start: (f: string) => EvalState } {
  const e = new FormulaEngine({ locale: 'fr-FR' });
  e.addSheet('Feuil1');
  e.setCell('Feuil1', 'A1', 5);
  e.setCell('Feuil1', 'A2', 7);
  e.setCell('Feuil1', 'A3', -3);
  e.setCell('Feuil1', 'B1', 'x');
  e.setFormula('Feuil1', 'C1', 'A1*2+A2');
  const env: EvalEnv = {
    evaluate: (f, sheet) => e.evaluate(f, sheet),
    formulaAt: (sheet, row, col) => e.getFormula(sheet, { row, col })?.slice(1),
  };
  return { env, start: (f) => startEvaluation(f, 'Feuil1', 'Feuil1!D1') };
}

/** Textes successifs jusqu'a la fin. */
function run(s0: EvalState, env: EvalEnv): string[] {
  const out = [viewOf(s0, env).text];
  let s = s0;
  for (let i = 0; i < 50 && !isFinished(s); i++) {
    s = evaluateStep(s, env);
    out.push(viewOf(s, env).text);
  }
  return out;
}

test('operations : references d abord, puis priorite des operateurs', () => {
  const { env, start } = setup();
  assert.deepEqual(run(start('A1*2+A2'), env), ['=A1*2+A2', '=5*2+A2', '=10+A2', '=10+7', '=17']);
});

test('fonction : plage developpee, puis la fonction', () => {
  const { env, start } = setup();
  assert.deepEqual(run(start('SUM(A1:A2)'), env), ['=SOMME(A1:A2)', '=SOMME({5;7})', '=12']);
});

test('le texte souligne est la prochaine sous-expression', () => {
  const { env, start } = setup();
  const v = viewOf(start('SUM(A1:A2)*3'), env);
  assert.ok(v.underline);
  assert.equal(v.text.slice(v.underline[0], v.underline[1]), 'A1:A2');
  const w = viewOf(evaluateStep(start('1+2*3'), env), env);
  assert.equal(w.text, '=1+6');
  assert.equal(w.text.slice(w.underline?.[0], w.underline?.[1]), '1+6');
});

test('SI ne calcule que la branche choisie', () => {
  const { env, start } = setup();
  assert.deepEqual(run(start('IF(A1>3,A2,1/0)'), env), ['=SI(A1>3;A2;1/0)', '=SI(5>3;A2;1/0)', '=SI(VRAI;A2;1/0)', '=A2', '=7']);
});

test('SIERREUR : la valeur de secours n est lue qu en cas d erreur', () => {
  const { env, start } = setup();
  const steps = run(start('IFERROR(1/0,A2)'), env);
  assert.equal(steps[steps.length - 1], '=7');
  const ok = run(start('IFERROR(A1,A2)'), env);
  assert.equal(ok[ok.length - 1], '=5');
});

test('un nombre negatif garde ses parentheses sous un operateur', () => {
  const { env, start } = setup();
  const steps = run(start('A3^2'), env);
  assert.equal(steps[1], '=(-3)^2');
  assert.equal(steps[steps.length - 1], '=9');
});

test('erreur propagee jusqu au bout', () => {
  const { env, start } = setup();
  const steps = run(start('1/0+A1'), env);
  assert.equal(steps[steps.length - 1], '=#DIV/0!');
});

test('pas a pas detaille puis sortant : la formule de C1 est evaluee dans son cadre', () => {
  const { env, start } = setup();
  let s = start('C1+1');
  assert.equal(viewOf(s, env).canStepIn, true);
  s = stepIn(s, env, (sheet, row, col) => `${sheet}!R${row + 1}C${col + 1}`);
  const inner = viewOf(s, env);
  assert.equal(inner.text, '=A1*2+A2');
  assert.equal(inner.depth, 1);
  assert.equal(inner.canStepOut, true);
  s = evaluateStep(s, env);
  assert.equal(viewOf(s, env).text, '=5*2+A2');
  s = stepOut(s, env);
  assert.equal(viewOf(s, env).depth, 0);
  assert.equal(viewOf(s, env).text, '=17+1');
  assert.equal(run(s, env).pop(), '=18');
});

test('une constante ne s ouvre pas en pas a pas detaille', () => {
  const { env, start } = setup();
  assert.equal(viewOf(start('A1+1'), env).canStepIn, false);
});

test('texte et concatenation', () => {
  const { env, start } = setup();
  const steps = run(start('B1&"y"'), env);
  assert.deepEqual(steps, ['=B1&"y"', '="x"&"y"', '="xy"']);
});
