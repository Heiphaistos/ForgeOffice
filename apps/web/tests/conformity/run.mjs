// Banc de conformite : teste chaque commande du ruban de chaque application par de vrais clics CDP.
// Usage : node apps/web/tests/conformity/run.mjs [module ...] [--mobile] [--only=texte] [--limit=N] [--port=5401] [--cdp=9661]
// Modules : word excel powerpoint publisher notes pdf convert access (defaut : tous sauf access). Sortie : docs/conformite/.
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MODULES } from './config.mjs';
import { openSession, loadFixture, discover, makeRunner, lookup } from './driver.mjs';
import { moduleReport, summaryReport } from './report.ts';
import { tally, workingRate } from './logic.ts';
import { sleep } from '../e2e/harness.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..', '..', '..');
const args = process.argv.slice(2);
const flag = (n) => args.find((a) => a.startsWith(`--${n}=`))?.split('=')[1];
const mobile = args.includes('--mobile');
const port = Number(flag('port') ?? 5401);
const cdp = Number(flag('cdp') ?? 9661);
const only = flag('only');
const limit = Number(flag('limit') ?? 0);
const names = args.filter((a) => !a.startsWith('--'));
const targets = names.length ? names : Object.keys(MODULES).filter((m) => !MODULES[m].readOnly);
const outRoot = join(root, 'docs', 'conformite', mobile ? 'mobile' : '');
const base = `http://127.0.0.1:${port}`;

async function ensureServer() {
  try { await fetch(base); return null; } catch { /* a demarrer */ }
  const p = spawn(process.execPath, [join(root, 'node_modules', 'vite', 'bin', 'vite.js'), '--port', String(port), '--host', '127.0.0.1'], { cwd: join(root, 'apps', 'web'), env: { ...process.env, FO_PORT: String(port) }, stdio: 'ignore' });
  for (let i = 0; i < 60; i++) { try { await fetch(base); return p; } catch { await sleep(500); } }
  throw new Error('le banc ne demarre pas');
}

async function fixtureB64(cfg) {
  if (!cfg.fixture) return '';
  const { buildFixture } = await import('./fixtures.ts');
  const bytes = await buildFixture(cfg.app);
  return Buffer.from(bytes).toString('base64');
}

const server = await ensureServer();
const results = {};
try {
  for (const m of targets) {
    const cfg = MODULES[m];
    if (!cfg) throw new Error(`module inconnu : ${m}`);
    const t0 = Date.now();
    const logf = (s) => console.log(`[${m}] ${s}`);
    let b = await openSession({ base, port: cdp, mobile });
    try {
      const fx = await fixtureB64(cfg);
      const { extraFiles } = await import('./fixtures.ts');
      cfg.extra = await extraFiles(cfg.app);
      await loadFixture(b, cfg, fx);
      const { entries, presets } = await discover(b, cfg, fx, logf);
      logf(`${entries.length} commandes enumerees (contextes : ${presets.join(', ')})`);
      const all = lookup(entries);
      const captures = join(outRoot, 'captures', m);
      let runner = makeRunner(b, cfg, fx, all, captures, logf);
      let list = entries;
      if (only) list = list.filter((e) => only.split(',').some((o) => e.tab === o || e.id.startsWith(o)));
      if (limit) list = list.slice(0, limit);
      const rows = [];
      let i = 0;
      for (const cmd of list) {
        i++;
        let row;
        try {
          row = await Promise.race([runner.test(cmd), sleep(120000).then(() => { throw new Error('delai depasse (page quittee ou navigateur bloque)'); })]);
        } catch (e) {
          row = { id: cmd.id, tab: cmd.tab, path: cmd.path, label: cmd.label, type: cmd.type, verdict: 'ERREUR', detail: `pilote : ${e.message}` };
          // Reprise : nouveau navigateur et document rechargé avant la commande suivante.
          if (/delai|closed|ferme|context|websocket/i.test(e.message)) {
            logf(`reprise apres ${cmd.id} : ${e.message}`);
            await b.close().catch(() => undefined);
            b = await openSession({ base, port: cdp, mobile });
            await loadFixture(b, cfg, fx);
            runner = makeRunner(b, cfg, fx, all, captures, logf);
          }
        }
        rows.push(row);
        if (i % 20 === 0) logf(`${i}/${list.length}  ${Object.entries(tally(rows)).filter(([, n]) => n).map(([k, n]) => `${k}=${n}`).join(' ')}`);
        if (i % 50 === 0) { mkdirSync(outRoot, { recursive: true }); writeFileSync(join(outRoot, `${m}.partiel.json`), JSON.stringify(rows)); }
      }
      const seconds = (Date.now() - t0) / 1000;
      results[m] = { rows, seconds };
      mkdirSync(outRoot, { recursive: true });
      writeFileSync(join(outRoot, `${m}.json`), `${JSON.stringify({ module: m, mobile, seconds: Math.round(seconds), total: rows.length, classes: tally(rows), tauxFonctionnel: Number(workingRate(rows).toFixed(4)), commandes: rows }, null, 1)}
`);
      writeFileSync(join(outRoot, `${m}.md`), `${moduleReport(m, rows, { seconds, mobile })}
`);
      rmSync(join(outRoot, `${m}.partiel.json`), { force: true });
      logf(`termine en ${Math.round(seconds)} s : ${JSON.stringify(tally(rows))}`);
    } finally {
      await b.close();
    }
  }
  if (!only && !limit) {
    // Resume de tous les modules deja mesures (pas seulement ceux de cette execution).
    const all = {};
    for (const m of Object.keys(MODULES)) {
      try {
        const j = JSON.parse(readFileSync(join(outRoot, `${m}.json`), 'utf8'));
        all[m] = { rows: j.commandes, seconds: j.seconds };
      } catch { /* module pas encore mesure */ }
    }
    writeFileSync(join(outRoot, 'RESUME.md'), `${summaryReport(all, mobile)}
`);
  }
} finally {
  server?.kill();
}
