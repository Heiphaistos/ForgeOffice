// Usage : node scripts/fuzz/run.mjs [--targets a,b] [--n 300] [--seed 1] [--save]
// Chaque cible tourne dans un worker (limite memoire 1 Go) ; un cas > 5 s ou une mort du worker est une anomalie.
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { targets, makeCase } from './lib.mjs';

const TIMEOUT_MS = 5000;
// Erreurs internes (message illisible pour l'utilisateur) : un importeur doit refuser avec sa propre erreur.
const UNCLEAN = /^(TypeError|ReferenceError|RangeError: Maximum call stack|RangeError: Invalid (array|string)|RangeError: Array buffer)/;

if (!isMainThread) {
  const { name, seed, from, to } = workerData;
  const T = (await targets())[name];
  let cur = -1;
  const bad = (i, kind, msg) => parentPort.postMessage({ i, kind, msg: String(msg).slice(0, 200) });
  process.on('unhandledRejection', (e) => bad(cur, 'unhandled-rejection', e?.stack ?? e));
  for (let i = from; i < to; i++) {
    cur = i;
    parentPort.postMessage({ start: i });
    const bytes = await makeCase(T, name, seed, i);
    parentPort.postMessage({ start: i }); // la generation (zip) ne compte pas dans le delai
    const t0 = Date.now();
    try {
      let timer;
      try {
        await Promise.race([Promise.resolve(T.run(bytes)), new Promise((_, rej) => { timer = setTimeout(() => rej(Object.assign(new Error('timeout'), { hang: true })), TIMEOUT_MS); })]);
      } finally { clearTimeout(timer); }
      if (i === 0) continue; // temoin
    } catch (e) {
      if (e?.hang) bad(i, 'hang', 'async > 5 s');
      else if (!(e instanceof Error)) bad(i, 'non-error-throw', e);
      else if (UNCLEAN.test(`${e.name}: ${e.message}`)) bad(i, 'unclean', `${e.name}: ${e.message}`);
      else if (i === 0) bad(i, 'valid-rejected', e.message);
    }
    if (Date.now() - t0 > TIMEOUT_MS) bad(i, 'slow', `${Date.now() - t0} ms`);
  }
  parentPort.postMessage({ done: true });
} else {
  const argv = process.argv.slice(2);
  const opt = (k, d) => { const j = argv.indexOf('--' + k); return j >= 0 ? argv[j + 1] : d; };
  const N = Number(opt('n', 300)); const seed = Number(opt('seed', 1)); const save = argv.includes('--save');
  const T = await targets();
  const list = opt('targets', '') ? opt('targets', '').split(',') : Object.keys(T);
  const found = [];
  for (const name of list) {
    let from = 0; const t0 = Date.now(); const counts = {};
    while (from < N) {
      let cur = from; let lastStart = Date.now(); let finished = false;
      const w = new Worker(fileURLToPath(import.meta.url), { workerData: { name, seed, from, to: N }, resourceLimits: { maxOldGenerationSizeMb: 1024, stackSizeMb: 4 } });
      const rec = (i, kind, msg) => { found.push({ name, i, kind, msg }); counts[kind] = (counts[kind] ?? 0) + 1; };
      await new Promise((resolve) => {
        const timer = setInterval(() => { if (Date.now() - lastStart > TIMEOUT_MS + 1500) { rec(cur, 'hang', 'sync > 5 s'); w.terminate(); } }, 250);
        w.on('message', (m) => { if (m.start !== undefined) { cur = m.start; lastStart = Date.now(); } else if (m.done) finished = true; else rec(m.i, m.kind, m.msg); });
        w.on('error', (e) => { rec(cur, /memory/i.test(String(e?.code) + e?.message) ? 'oom' : 'worker-crash', e?.message ?? e); });
        w.on('exit', () => { clearInterval(timer); resolve(); });
      });
      from = finished ? N : cur + 1;
    }
    console.log(`${name.padEnd(8)} ${N} cas  ${((Date.now() - t0) / 1000).toFixed(1)} s  ${JSON.stringify(counts)}`);
  }
  const sig = new Map();
  for (const f of found) {
    const k = `${f.name}|${f.kind}|${f.msg.replace(/\d+/g, 'N').slice(0, 90)}`;
    if (!sig.has(k)) sig.set(k, f); else sig.get(k).n = (sig.get(k).n ?? 1) + 1;
  }
  for (const [k, f] of sig) console.log(`#${f.i} x${f.n ?? 1}  ${k}`);
  if (save) {
    for (const f of sig.values()) {
      const bytes = await makeCase(T[f.name], f.name, seed, f.i);
      if (bytes.length > 300_000) { console.log(`(trop gros pour le corpus: ${f.name} #${f.i}, ${bytes.length} o)`); continue; }
      const dir = `tests/fuzz-corpus/${f.name}`; mkdirSync(dir, { recursive: true });
      const h = createHash('sha1').update(bytes).digest('hex').slice(0, 10);
      writeFileSync(`${dir}/${f.kind}-${h}.bin`, bytes);
    }
  }
  console.log(`${found.length} anomalies, ${sig.size} signatures`);
  process.exit(0);
}
