// OPML vers Markdown puis vers les formats du moteur Texte.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { convertFile, DEFAULT_OPTIONS } from '../src/engines.ts';
import { planEngine } from '../src/formats.ts';
import { opmlToMarkdown } from '../src/opml.ts';

const OPML = `<?xml version="1.0"?><opml version="2.0"><head><title>Mes &amp; notes</title></head><body>
<outline text="Courses"><outline text="Pain *frais*"/><outline text="Fromage" url="https://exemple.fr/f?a=1&amp;b=2"/></outline>
<outline title="Travail"><outline text="Rapport"><outline text="Relire"/></outline></outline></body></opml>`;

test('opml : titre, imbrication, liens, echappement', () => {
  const md = opmlToMarkdown(OPML);
  assert.equal(md, '# Mes & notes\n\n- Courses\n  - Pain \*frais\*\n  - [Fromage](https://exemple.fr/f?a=1&b=2)\n- Travail\n  - Rapport\n    - Relire\n');
  assert.throws(() => opmlToMarkdown('<a/>'), /OPML/);
});

test('opml -> html / docx / md / txt par le moteur Texte', async () => {
  const bytes = new TextEncoder().encode(OPML);
  for (const t of ['html', 'docx', 'md', 'txt']) {
    const engine = planEngine('opml', t, false);
    assert.equal(engine, 'texte', t);
    const [out] = await convertFile({ name: 'plan.opml', bytes }, t, engine, `plan.${t}`, null, DEFAULT_OPTIONS);
    assert.ok(out && out.bytes.length > 20, t);
    if (t === 'html') assert.match(new TextDecoder().decode(out.bytes), /Relire/);
  }
});
