// Rejoue un cas : node --stack-size=900 scripts/fuzz/repro.mjs <cible> <graine> <numero>
import { targets, makeCase } from './lib.mjs';
const [name, seed, i] = [process.argv[2], Number(process.argv[3]), Number(process.argv[4])];
const T = (await targets())[name];
const b = await makeCase(T, name, seed, i);
console.log('bytes', b.length);
const t0 = Date.now();
try { await T.run(b); console.log('ok', Date.now() - t0); } catch (e) { console.log('thrown', e.name, e.message, Date.now() - t0); console.log(String(e.stack).split('\n').slice(0, 8).join('\n')); }
