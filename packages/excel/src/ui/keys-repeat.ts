// Repeter la derniere action (F4 hors saisie, Ctrl+Y quand il n'y a rien a retablir) : les commandes de mise en forme et d'edition
// appelees via `cmd` sont memorisees (nom + arguments) et rejouees sur la selection courante.
const REPEATABLE: ReadonlySet<string> = new Set([
  'fontName', 'fontSize', 'growFont', 'bold', 'italic', 'underline', 'strike', 'fontColor', 'fillColor', 'borders', 'clearFormatting',
  'align', 'valign', 'wrap', 'indent', 'rotate', 'merge', 'numberFormat', 'decimals', 'cellStyle', 'insert', 'remove', 'hide', 'clear',
  'fill', 'autoSum', 'sortQuick', 'addCf', 'clearCf',
]);

type AnyFn = (...args: unknown[]) => unknown;
let last: { name: string; args: unknown[] } | null = null;

export const lastAction = (): string | null => last?.name ?? null;
export const forgetLastAction = (): void => {
  last = null;
};

/** Enveloppe l'objet de commandes : chaque appel d'une commande repetable est memorise avant d'etre execute. */
export function recordCommands<T extends object>(cmd: T): T {
  return new Proxy(cmd, {
    get(target, prop, receiver) {
      const value: unknown = Reflect.get(target, prop, receiver);
      if (typeof prop !== 'string' || !REPEATABLE.has(prop) || typeof value !== 'function') return value;
      return (...args: unknown[]): unknown => {
        last = { name: prop, args };
        return (value as AnyFn).apply(target, args);
      };
    },
  });
}

/** Rejoue la derniere action sur la selection courante de `cmd` ; faux s'il n'y en a pas. */
export function repeatLast(cmd: object): boolean {
  if (!last) return false;
  const fn = (cmd as Record<string, unknown>)[last.name];
  if (typeof fn !== 'function') return false;
  (fn as AnyFn).apply(cmd, last.args);
  return true;
}
