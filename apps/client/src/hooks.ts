import { useCallback, useMemo } from 'react';
import type { DecreeCard, Resource, Terrain } from '@kervan/shared';
import { useStore } from './store';
import { translate, type Key, type TFn, type Vars } from './i18n';
import { THEMES, type Lang, type PieceKind, type ThemeDef } from './themes';

export function useLang(): Lang {
  return useStore((s) => s.settings.lang);
}

export function useT(): TFn {
  const lang = useLang();
  return useCallback((key: Key, vars?: Vars) => translate(lang, key, vars), [lang]);
}

export function useThemeDef(): ThemeDef {
  const override = useStore((s) => s.settings.themeOverride);
  const roomTheme = useStore((s) => s.room?.config.theme);
  return THEMES[override ?? roomTheme ?? 'anatolia'] ?? THEMES.anatolia;
}

export interface Names {
  res: (r: Resource) => string;
  terrain: (t: Terrain) => string;
  piece: (p: PieceKind) => string;
  card: (c: DecreeCard) => string;
  bandit: string;
  decree: string;
}

export function makeNames(theme: ThemeDef, lang: Lang): Names {
  return {
    res: (r) => theme.res[r][lang],
    terrain: (t) => theme.terrain[t][lang],
    piece: (p) => theme.piece[p][lang],
    card: (c) => theme.card[c][lang],
    bandit: theme.bandit[lang],
    decree: theme.decree[lang],
  };
}

export function useNames(): Names {
  const theme = useThemeDef();
  const lang = useLang();
  return useMemo(() => makeNames(theme, lang), [theme, lang]);
}
