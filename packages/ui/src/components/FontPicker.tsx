// Selecteur de police : sections Polices du theme / recentes / toutes, chaque nom affiche dans sa police.
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { ComboOption } from '../ribbon-types.ts';
import { S } from '../strings.ts';
import { FALLBACK_FONTS, THEME_FONTS, pushRecentFont, uniqueFonts } from '../logic/fonts.ts';
import { ComboBox } from './ComboBox.tsx';

let recentFonts: string[] = [];
const listeners = new Set<() => void>();
function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function rememberFont(font: string): void {
  recentFonts = pushRecentFont(recentFonts, font);
  for (const fn of listeners) fn();
}

/** Teste la presence d'une police en comparant sa largeur rendue a deux polices generiques. */
function isFontAvailable(name: string, ctx: CanvasRenderingContext2D): boolean {
  const sample = 'mmmmmmmmmmlli1WQ@#';
  return ['monospace', 'serif'].some((generic) => {
    ctx.font = `32px ${generic}`;
    const base = ctx.measureText(sample).width;
    ctx.font = `32px "${name}", ${generic}`;
    return ctx.measureText(sample).width !== base;
  });
}

interface LocalFontData {
  family: string;
}

let systemFonts: Promise<string[]> | null = null;

/** Polices du systeme : API Local Font Access si deja autorisee (pas de demande intempestive), sinon detection. */
export function listSystemFonts(): Promise<string[]> {
  systemFonts ??= (async () => {
    const nav = navigator as Navigator & { permissions?: Permissions };
    const query = (window as Window & { queryLocalFonts?: () => Promise<LocalFontData[]> }).queryLocalFonts;
    if (query && nav.permissions) {
      try {
        const status = await nav.permissions.query({ name: 'local-fonts' as PermissionName });
        if (status.state === 'granted') return uniqueFonts((await query()).map((f) => f.family));
      } catch {
        // permission inconnue de ce moteur : detection par mesure ci-dessous
      }
    }
    const ctx = document.createElement('canvas').getContext('2d');
    if (!ctx) return [...FALLBACK_FONTS];
    return FALLBACK_FONTS.filter((f) => isFontAvailable(f, ctx));
  })();
  return systemFonts;
}

export interface FontPickerProps {
  value: string;
  onChange: (font: string) => void;
  /** Polices supplementaires (incorporees au document, Web). */
  extraFonts?: readonly string[];
  width?: number;
  disabled?: boolean;
  keytip?: string;
}

export function FontPicker({ value, onChange, extraFonts = [], width = 150, disabled, keytip }: FontPickerProps) {
  const [fonts, setFonts] = useState<string[]>([]);
  const recent = useSyncExternalStore(subscribe, () => recentFonts);
  useEffect(() => {
    let alive = true;
    void listSystemFonts().then((list) => {
      if (alive) setFonts(list);
    });
    return () => {
      alive = false;
    };
  }, []);

  const options = useMemo<ComboOption[]>(() => {
    const opt = (font: string, group: string, label = font): ComboOption => ({ value: font, label, group, style: { fontFamily: `"${font}", var(--fo-font)`, fontSize: 15 } });
    return [
      opt(THEME_FONTS.headings, S.font.themeFonts, `${THEME_FONTS.headings} ${S.font.headings}`),
      opt(THEME_FONTS.body, S.font.themeFonts, `${THEME_FONTS.body} ${S.font.body}`),
      ...recent.map((f) => opt(f, S.font.recentFonts)),
      ...uniqueFonts([...fonts, ...extraFonts]).map((f) => opt(f, S.font.allFonts)),
    ];
  }, [fonts, extraFonts, recent]);

  return (
    <ComboBox
      label={S.font.fontLabel}
      value={value}
      options={options}
      editable
      width={width}
      disabled={disabled}
      keytip={keytip}
      listHeight={420}
      inputStyle={{ fontFamily: `"${value}", var(--fo-font)` }}
      onChange={(font) => {
        rememberFont(font);
        onChange(font);
      }}
    />
  );
}
