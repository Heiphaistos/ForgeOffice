import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pageCss, pageClass } from '../src/pagecss.ts';
import { continuationRules } from '../src/pagecss.ts';
import { parseSettings, serializeSettings } from '../src/model.ts';
import { reflow } from '../src/chain.ts';
import type { RunProps } from '@forgeoffice/pptx';
import { CATALOG } from '../src/templates/index.ts';

const measure = (text: string, props: RunProps): number => text.length * (props.size ?? 18) * 0.5;

function newsletter() {
  const built = CATALOG.find((c) => c.kind === 'newsletter')!.build();
  const flowed = reflow(built.deck, built.pub, measure);
  const doc = { deck: flowed.deck, pub: flowed.pub };
  const crossing = doc.pub.chains.find((c) => c.boxes.some((b, i) => i > 0 && b.page !== c.boxes[i - 1]!.page));
  return { doc, crossing };
}

test('indications de suite : « Suite page n » en pied, « Suite de la page n » en tête, numéros par rang de page', () => {
  const { doc, crossing } = newsletter();
  assert.ok(crossing, 'la lettre d information contient un article sur plusieurs pages');
  const ids = doc.deck.slides.map((s) => s.id);
  const all = doc.deck.slides.flatMap((s) => continuationRules(s, doc.pub, ids, `.${pageClass(s.id)}`));
  assert.ok(all.some((r) => /Suite page \d/.test(r) && r.includes('::after')), all.join('\n'));
  assert.ok(all.some((r) => /Suite de la page \d/.test(r) && r.includes('::before')));
  const from = crossing.boxes.findIndex((b, i) => i > 0 && b.page !== crossing.boxes[i - 1]!.page);
  const target = ids.indexOf(crossing.boxes[from]!.page) + 1;
  assert.ok(all.some((r) => r.includes(`Suite page ${target}`)));
  assert.ok(all.some((r) => r.includes(`Suite de la page ${ids.indexOf(crossing.boxes[from - 1]!.page) + 1}`)));
});

test('pageCss : rien sans l option, indications avec l option ; l option survit à publication.json', () => {
  const { doc } = newsletter();
  const ids = doc.deck.slides.map((s) => s.id);
  const css = (continued: boolean): string => doc.deck.slides.map((s) => pageCss(s, { ...doc.pub, continued }, '#077568', undefined, ids)).join('\n');
  assert.ok(!/Suite/.test(css(false)));
  assert.ok(/Suite/.test(css(true)));
  assert.equal(parseSettings(serializeSettings({ ...doc.pub, continued: true })).continued, true);
  assert.equal(parseSettings('{"continued":"oui"}').continued, false);
});

test('une zone vide ou une page inconnue ne produit aucune indication', () => {
  const { doc, crossing } = newsletter();
  const emptied = { ...doc.pub, continued: true, chains: doc.pub.chains.map((c) => (c === crossing ? { ...c, empty: c.boxes.map(() => true) } : c)) };
  const ids = doc.deck.slides.map((s) => s.id);
  const rulesFor = (pub: typeof emptied, pageIds: number[]): string[] => doc.deck.slides.flatMap((s) => continuationRules(s, pub, pageIds, '.x'));
  const before = rulesFor({ ...doc.pub, continued: true }, ids).length;
  assert.ok(rulesFor(emptied, ids).length < before);
  assert.equal(rulesFor({ ...doc.pub, continued: true }, []).length, 0);
});
