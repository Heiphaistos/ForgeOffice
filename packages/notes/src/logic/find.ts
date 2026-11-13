// Recherche : mode etendu (\n \r \t \0 \\ \xNN) et historique des recherches (haut / bas dans le champ), comme WinNote.

/** Interprete \n \r \t \0 \\ et \xNN (mode « etendu » de Notepad++) ; toute autre sequence est gardee telle quelle. */
export function unescapeExtended(text: string): string {
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const c = text[i] as string;
    const next = text[i + 1];
    if (c !== '\\' || next === undefined) {
      out += c;
      continue;
    }
    if (next === 'n') out += '\n';
    else if (next === 'r') out += '\r';
    else if (next === 't') out += '\t';
    else if (next === '0') out += '\0';
    else if (next === '\\') out += '\\';
    else if (next === 'x' && /^[0-9a-fA-F]{2}$/.test(text.slice(i + 2, i + 4))) {
      out += String.fromCharCode(Number.parseInt(text.slice(i + 2, i + 4), 16));
      i += 2;
    } else {
      out += c + next;
    }
    i++;
  }
  return out;
}

export const HISTORY_MAX = 30;

/** Dernieres recherches (la plus recente en dernier), sans doublon. */
export class SearchHistory {
  private items: string[];
  private pos: number;
  private readonly onChange: (items: readonly string[]) => void;

  constructor(items: readonly string[] = [], onChange: (items: readonly string[]) => void = () => undefined) {
    this.onChange = onChange;
    this.items = items.filter((s) => typeof s === 'string' && s !== '').slice(-HISTORY_MAX);
    this.pos = this.items.length;
  }

  get list(): readonly string[] {
    return this.items;
  }

  push(query: string): void {
    if (query === '') return;
    this.items = [...this.items.filter((x) => x !== query), query].slice(-HISTORY_MAX);
    this.pos = this.items.length;
    this.onChange(this.items);
  }

  /** `up` = plus ancien. Renvoie l'entree a afficher (chaine vide au-dela de la plus recente), null si l'historique est vide. */
  step(up: boolean): string | null {
    if (this.items.length === 0) return null;
    this.pos = up ? Math.max(0, this.pos - 1) : Math.min(this.items.length, this.pos + 1);
    return this.items[this.pos] ?? '';
  }
}
