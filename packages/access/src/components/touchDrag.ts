// Glisser-deposer au doigt d'un champ (jointures du createur de requetes et du diagramme des relations) : le glisser-deposer HTML5
// n'existe pas au toucher. Appui long sur le champ, glisser, relacher sur un champ ou une colonne : on rejoue les evenements
// dragover/drop avec le meme transfert de donnees, donc les gestionnaires existants servent tels quels.
const HOLD_MS = 380;
const SLOP = 10;

export interface TouchDragOptions {
  mime: string;
  payload: unknown;
  label: string;
}

export function startTouchDrag(e: { pointerId: number; clientX: number; clientY: number; pointerType: string }, opts: TouchDragOptions): void {
  if (e.pointerType !== 'touch') return;
  const { pointerId, clientX: x0, clientY: y0 } = e;
  let active = false;
  let ghost: HTMLDivElement | null = null;
  const block = (ev: Event): void => ev.preventDefault();

  const cleanup = (): void => {
    window.clearTimeout(timer);
    ghost?.remove();
    ghost = null;
    window.removeEventListener('pointermove', move, true);
    window.removeEventListener('pointerup', up, true);
    window.removeEventListener('pointercancel', cleanup, true);
    document.removeEventListener('touchmove', block);
  };
  const place = (x: number, y: number): void => {
    if (ghost) ghost.style.transform = `translate(${x + 12}px, ${y - 40}px)`;
  };
  const timer = window.setTimeout(() => {
    active = true;
    ghost = document.createElement('div');
    ghost.className = 'acc-dragghost';
    ghost.textContent = opts.label;
    document.body.append(ghost);
    place(x0, y0);
    navigator.vibrate?.(15);
    document.addEventListener('touchmove', block, { passive: false });
  }, HOLD_MS);

  function move(ev: PointerEvent): void {
    if (ev.pointerId !== pointerId) return;
    if (!active) {
      if (Math.hypot(ev.clientX - x0, ev.clientY - y0) > SLOP) cleanup(); // le doigt defile : ce n'est pas un glisser
      return;
    }
    place(ev.clientX, ev.clientY);
  }
  function up(ev: PointerEvent): void {
    if (ev.pointerId !== pointerId) return;
    const wasActive = active;
    cleanup();
    if (!wasActive) return;
    const target = document.elementFromPoint(ev.clientX, ev.clientY);
    if (!target) return;
    const dt = new DataTransfer();
    dt.setData(opts.mime, JSON.stringify(opts.payload));
    for (const type of ['dragover', 'drop']) target.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt }));
  }
  window.addEventListener('pointermove', move, true);
  window.addEventListener('pointerup', up, true);
  window.addEventListener('pointercancel', cleanup, true);
}
