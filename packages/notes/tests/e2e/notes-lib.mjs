import { killChrome, start, key, sleep, ok, shot, done } from './lib.mjs';
export { key, sleep, ok, shot, done };
export async function openNotes() {
  const b = await start('notes', 'notes', 'essai.md');
  await b.waitFor(`document.querySelector('.cm-content')`, 15000);
  await sleep(800);
  return b;
}
export const snap = (b) => b.ev(`window.__FO__.snapshot()`);
export const docText = async (b) => { const s = await snap(b); return s.tabs[s.active].text; };
export const selection = async (b) => (await snap(b)).selection;
/** Remplace tout le document (sélection « tout » puis insertion de texte). */
export async function setDoc(b, text) {
  await b.ev(`window.__FO__.select('tout')`);
  await sleep(100);
  await b.send('Input.insertText', { text });
  await sleep(250);
}
export const selectAllText = (b) => b.ev(`window.__FO__.select('tout')`);
export const invoke = async (b, id) => { const r = await b.ev(`window.__FO__.invoke(${JSON.stringify(id)})`); await sleep(250); return r; };
export async function palette(b, label) {
  await b.ev(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'P', ctrlKey: true, shiftKey: true, bubbles: true }))`);
  await sleep(350);
  await b.press(label); await sleep(300);
  await key(b, 'Enter'); await sleep(350);
}
