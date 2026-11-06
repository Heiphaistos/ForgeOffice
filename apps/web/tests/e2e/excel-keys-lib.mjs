// Outils du banc des raccourcis du Tableur : touche reelle (CDP) avec tous les modificateurs, lecture de la zone Nom et de la barre de formule.
import { launch, sleep } from './harness.mjs';

export { launch, sleep };

const VK = { Enter: 13, Escape: 27, Tab: 9, Backspace: 8, Delete: 46, ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40, Home: 36, End: 35, PageUp: 33, PageDown: 34, ' ': 32,
  F1: 112, F2: 113, F3: 114, F4: 115, F5: 116, F6: 117, F7: 118, F8: 119, F9: 120, F10: 121, F11: 122, F12: 123, ContextMenu: 93 };

/** Touche reelle : keyDown puis keyUp avec modificateurs (Alt 1, Ctrl 2, Maj 8). `text` fait taper le caractere dans un champ. */
export async function key(b, k, { ctrl = false, alt = false, shift = false, code, text, wait = 220 } = {}) {
  const modifiers = (alt ? 1 : 0) | (ctrl ? 2 : 0) | (shift ? 8 : 0);
  const vk = VK[k] ?? (k.length === 1 ? k.toUpperCase().charCodeAt(0) : 0);
  const base = { key: k, code: code ?? (k.length === 1 && /[a-z]/i.test(k) ? `Key${k.toUpperCase()}` : /^[0-9]$/.test(k) ? `Digit${k}` : k), modifiers, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk };
  await b.send('Input.dispatchKeyEvent', { type: text ? 'keyDown' : 'rawKeyDown', ...base, ...(text ? { text } : {}) });
  await b.send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
  await sleep(wait);
}

export const nameBox = (b) => b.ev(`(document.querySelector('.xl-namebox input') ?? [...document.querySelectorAll('input')].find((e) => /^[A-Z]{1,3}[0-9]+(:[A-Z]{1,3}[0-9]+)?$/.test(e.value)))?.value ?? null`);
export const bar = (b) => b.ev(`document.querySelector('.xl-fbar .xl-fi__input')?.value ?? null`);
export const cellEditor = (b) => b.ev(`document.querySelector('.xl-cellinput, .xl-grid textarea')?.value ?? null`);
export const statusMode = (b) => b.ev(`document.querySelector('.xl-status__mode, [data-xl-mode]')?.textContent ?? null`);

/** Va a une adresse par la zone Nom puis rend le focus a la grille. */
export async function goto(b, addr) {
  await b.ev(`(() => { const i = document.querySelector('.xl-namebox input'); i.focus(); i.select(); })()`);
  await sleep(120);
  await b.send('Input.insertText', { text: addr });
  await key(b, 'Enter');
  await focusGrid(b);
}

export async function focusGrid(b) {
  await b.ev(`document.querySelector('.xl-grid')?.focus()`);
  await sleep(120);
}

/** Saisit du texte dans la cellule active (frappe reelle puis Entree). */
export async function typeCell(b, text) {
  await b.press(text);
  await key(b, 'Enter');
}
