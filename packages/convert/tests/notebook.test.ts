// Notebook Jupyter vers Markdown puis vers les formats du paquet Texte.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { convertFile, DEFAULT_OPTIONS } from '../src/engines.ts';
import { planEngine } from '../src/formats.ts';
import { notebookToMarkdown } from '../src/notebook.ts';

const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const NB = JSON.stringify({
  nbformat: 4, metadata: { language_info: { name: 'python' } },
  cells: [
    { cell_type: 'markdown', source: ['# Analyse\n', 'Texte **gras**'] },
    { cell_type: 'code', source: ['print("a")\n', 'x = "```"'], outputs: [{ output_type: 'stream', name: 'stdout', text: ['a\n'] }, { output_type: 'display_data', data: { 'image/png': PNG, 'text/plain': ['<Figure>'] } }, { output_type: 'error', ename: 'ValueError', evalue: 'boom', traceback: ['\u001b[31mValueError\u001b[0m: boom'] }] },
    { cell_type: 'raw', source: 'brut' },
  ],
});

test('notebook : markdown, code (cloture adaptee), sorties texte, image et erreur sans ANSI', () => {
  const md = notebookToMarkdown(NB);
  assert.match(md, /^# Analyse\nTexte \*\*gras\*\*/);
  assert.match(md, /````python\nprint\("a"\)\nx = "```"\n````/);
  assert.match(md, /```\na\n```/);
  assert.match(md, /!\[Sortie\]\(data:image\/png;base64,iVBOR/);
  assert.ok(!md.includes('<Figure>'), 'le texte de repli est omis quand une image existe');
  assert.match(md, /ValueError: boom/);
  assert.ok(!md.includes('\u001b'));
});

test('notebook invalide : message clair', () => {
  assert.throws(() => notebookToMarkdown('pas du json'), /notebook Jupyter/);
  assert.throws(() => notebookToMarkdown('{"a":1}'), /notebook Jupyter/);
});

test('ipynb -> html / docx / md / odt par le moteur Texte', async () => {
  const bytes = new TextEncoder().encode(NB);
  for (const t of ['html', 'docx', 'md', 'odt', 'txt']) {
    const engine = planEngine('ipynb', t, false);
    assert.equal(engine, 'texte', t);
    const [out] = await convertFile({ name: 'nb.ipynb', bytes }, t, engine, `nb.${t}`, null, DEFAULT_OPTIONS);
    assert.ok(out && out.bytes.length > (t === 'txt' ? 20 : 100), t);
    if (t === 'html') {
      const html = new TextDecoder().decode(out.bytes);
      assert.match(html, /Analyse/);
      assert.match(html, /data:image\/png/);
    }
  }
});
