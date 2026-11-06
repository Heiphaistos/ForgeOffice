// Synchronisation du diaporama entre deux fenetres (diaporama du public / ecran du presentateur) par BroadcastChannel :
// la fenetre du diaporama (meneur) publie l'etat et la presentation, la fenetre du presentateur (suiveuse) envoie des commandes.
// Aucune dependance a React : testable dans Node.

export const SHOW_CHANNEL = 'forgeoffice-powerpoint-show';

/** Identifiant de cette fenetre : une fenetre n'obeit jamais a sa propre invitation (un BroadcastChannel reçoit aussi les messages des autres canaux de la meme page). */
const WINDOW_ID = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : String(Math.random());

/** Etat du diaporama diffuse par le meneur. */
export interface ShowSnapshot {
  /** Position dans l'ordre de lecture. */
  pos: number;
  /** Indice de la diapositive dans la presentation. */
  index: number;
  /** Indices des diapositives lues, dans l'ordre (diapositives masquees exclues). */
  order: number[];
  /** Nombre d'etapes d'animation deja jouees sur la diapositive. */
  step: number;
  /** Debut du minuteur (ms depuis 1970) et instant de la pause (null = en marche). */
  startedAt: number;
  paused: number | null;
  blank: 'black' | 'white' | null;
  ended: boolean;
}

export type ShowCommand = 'next' | 'prev' | 'end' | 'pause' | 'reset' | 'blank' | 'goto';

/** Messages du meneur vers le presentateur. */
export type DownMessage =
  | { kind: 'announce'; from?: string }
  | { kind: 'deck'; bytes: Uint8Array; name: string }
  | { kind: 'state'; state: ShowSnapshot }
  | { kind: 'bye' };

/** Messages du presentateur vers le meneur. */
export type UpMessage = { kind: 'hello' } | { kind: 'cmd'; cmd: ShowCommand; pos?: number };

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

/** Message recu d'un autre contexte : verifie sa forme avant usage. */
export function parseDown(data: unknown): DownMessage | null {
  if (!isRecord(data)) return null;
  switch (data.kind) {
    case 'announce':
      return { kind: 'announce', from: typeof data.from === 'string' ? data.from : undefined };
    case 'bye':
      return { kind: 'bye' };
    case 'deck':
      return data.bytes instanceof Uint8Array && typeof data.name === 'string' ? { kind: 'deck', bytes: data.bytes, name: data.name } : null;
    case 'state': {
      const s = data.state;
      if (!isRecord(s) || typeof s.pos !== 'number' || typeof s.index !== 'number' || !Array.isArray(s.order) || typeof s.step !== 'number' || typeof s.startedAt !== 'number') return null;
      return {
        kind: 'state',
        state: {
          pos: s.pos,
          index: s.index,
          order: s.order.filter((n): n is number => typeof n === 'number'),
          step: s.step,
          startedAt: s.startedAt,
          paused: typeof s.paused === 'number' ? s.paused : null,
          blank: s.blank === 'black' || s.blank === 'white' ? s.blank : null,
          ended: s.ended === true,
        },
      };
    }
    default:
      return null;
  }
}

const COMMANDS: readonly ShowCommand[] = ['next', 'prev', 'end', 'pause', 'reset', 'blank', 'goto'];

export function parseUp(data: unknown): UpMessage | null {
  if (!isRecord(data)) return null;
  if (data.kind === 'hello') return { kind: 'hello' };
  if (data.kind === 'cmd' && typeof data.cmd === 'string' && (COMMANDS as readonly string[]).includes(data.cmd)) {
    return { kind: 'cmd', cmd: data.cmd as ShowCommand, pos: typeof data.pos === 'number' ? data.pos : undefined };
  }
  return null;
}

/** Cote diaporama : diffuse l'etat, sert la presentation a la demande, applique les commandes recues. */
export class ShowLeader {
  private readonly channel: BroadcastChannel;
  private last: ShowSnapshot | null = null;
  private lastKey = '';
  private readonly bytes: () => Promise<{ bytes: Uint8Array; name: string }>;
  private readonly onCommand: (cmd: ShowCommand, pos?: number) => void;
  private announceTimer: ReturnType<typeof setInterval> | null = null;
  /** Vrai des qu'un presentateur a repondu. */
  connected = false;
  onConnected: (() => void) | null = null;

  constructor(bytes: () => Promise<{ bytes: Uint8Array; name: string }>, onCommand: (cmd: ShowCommand, pos?: number) => void, name = SHOW_CHANNEL) {
    this.channel = new BroadcastChannel(name);
    this.bytes = bytes;
    this.onCommand = onCommand;
    this.channel.onmessage = (e: MessageEvent<unknown>) => {
      const msg = parseUp(e.data);
      if (!msg) return;
      if (msg.kind === 'hello') {
        this.connected = true;
        this.stopAnnouncing();
        this.onConnected?.();
        void this.bytes().then((d) => {
          this.channel.postMessage({ kind: 'deck', bytes: d.bytes, name: d.name } satisfies DownMessage);
          if (this.last) this.channel.postMessage({ kind: 'state', state: this.last } satisfies DownMessage);
        });
      } else this.onCommand(msg.cmd, msg.pos);
    };
  }

  /** Invite une fenetre vide a devenir l'ecran du presentateur (repete jusqu'a la reponse ou l'echeance). */
  announce(timeoutMs = 20000, every = 500): void {
    this.stopAnnouncing();
    const until = Date.now() + timeoutMs;
    const send = (): void => {
      if (this.connected || Date.now() > until) this.stopAnnouncing();
      else this.channel.postMessage({ kind: 'announce', from: WINDOW_ID } satisfies DownMessage);
    };
    send();
    this.announceTimer = setInterval(send, every);
  }

  private stopAnnouncing(): void {
    if (this.announceTimer) clearInterval(this.announceTimer);
    this.announceTimer = null;
  }

  /** Diffuse l'etat s'il a change. */
  publish(state: ShowSnapshot): void {
    const key = JSON.stringify(state);
    this.last = state;
    if (key === this.lastKey) return;
    this.lastKey = key;
    this.channel.postMessage({ kind: 'state', state } satisfies DownMessage);
  }

  close(): void {
    this.stopAnnouncing();
    this.channel.postMessage({ kind: 'bye' } satisfies DownMessage);
    this.channel.close();
  }
}

/** Cote presentateur : demande la presentation, recoit l'etat, envoie des commandes. */
export class ShowFollower {
  private readonly channel: BroadcastChannel;
  private helloTimer: ReturnType<typeof setInterval> | null = null;

  constructor(handlers: { onDeck: (bytes: Uint8Array, name: string) => void; onState: (state: ShowSnapshot) => void; onBye: () => void; onAnnounce?: () => void }, name = SHOW_CHANNEL) {
    this.channel = new BroadcastChannel(name);
    this.channel.onmessage = (e: MessageEvent<unknown>) => {
      const msg = parseDown(e.data);
      if (!msg) return;
      if (msg.kind === 'deck') {
        this.stopHello();
        handlers.onDeck(msg.bytes, msg.name);
      } else if (msg.kind === 'state') handlers.onState(msg.state);
      else if (msg.kind === 'bye') handlers.onBye();
      else handlers.onAnnounce?.();
    };
  }

  /** Demande la presentation (repete tant qu'elle n'est pas arrivee). */
  hello(every = 700): void {
    this.stopHello();
    const send = (): void => this.channel.postMessage({ kind: 'hello' } satisfies UpMessage);
    send();
    this.helloTimer = setInterval(send, every);
  }

  private stopHello(): void {
    if (this.helloTimer) clearInterval(this.helloTimer);
    this.helloTimer = null;
  }

  send(cmd: ShowCommand, pos?: number): void {
    this.channel.postMessage({ kind: 'cmd', cmd, pos } satisfies UpMessage);
  }

  close(): void {
    this.stopHello();
    this.channel.close();
  }
}

/** Ecoute les invitations d'un diaporama (fenetre vide qui devient l'ecran du presentateur). Renvoie la fonction d'arret. */
export function listenAnnounce(onAnnounce: () => void, name = SHOW_CHANNEL): () => void {
  const channel = new BroadcastChannel(name);
  channel.onmessage = (e: MessageEvent<unknown>) => {
    const msg = parseDown(e.data);
    if (msg?.kind === 'announce' && msg.from !== WINDOW_ID) onAnnounce();
  };
  return () => channel.close();
}

// ---- Repetition du minutage ----

/** Durees (ms) passees sur chaque diapositive pendant une repetition. */
export class Rehearsal {
  private readonly spent = new Map<number, number>();
  private current: number | null = null;
  private since = 0;

  /** Entre sur une diapositive a l'instant `at` (ms) : la precedente est creditee du temps ecoule. */
  enter(index: number, at: number): void {
    this.leave(at);
    this.current = index;
    this.since = at;
  }

  /** Quitte la diapositive courante a l'instant `at`. */
  leave(at: number): void {
    if (this.current !== null) this.spent.set(this.current, (this.spent.get(this.current) ?? 0) + Math.max(0, at - this.since));
    this.current = null;
  }

  /** Recommence la diapositive courante (bouton « Répéter »). */
  restartCurrent(at: number): void {
    if (this.current === null) return;
    this.spent.set(this.current, 0);
    this.since = at;
  }

  /** Temps deja passe sur la diapositive courante a l'instant `at`. */
  currentTime(at: number): number {
    return this.current === null ? 0 : (this.spent.get(this.current) ?? 0) + Math.max(0, at - this.since);
  }

  /** Durees arrondies a la seconde (une seconde au minimum) des diapositives vues. */
  timings(): Record<number, number> {
    const out: Record<number, number> = {};
    for (const [index, ms] of this.spent) out[index] = Math.max(1000, Math.round(ms / 1000) * 1000);
    return out;
  }

  total(): number {
    let sum = 0;
    for (const ms of this.spent.values()) sum += ms;
    return sum;
  }
}
