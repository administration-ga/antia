/**
 * Projection native des sept chartes de l’arbre courant, 20/10/2026 (sources non commitées).
 * Sources : ../styles/charte.css et ./antsia{,-soleil,-foret,-corail,-lagon,-electrique,-sable}.css.
 * Registre : ./antsia-themes.ts, module pur jumeau de social-contracts/appearance.
 * Couleurs CSS résolues en valeurs statiques ; primary = --primary-fill, primaryOn =
 * --primary-fill-on, danger/success = encres --role-*-ink, rayons = jetons des primitives.
 * Aucune dépendance React/DOM/CSS, police non embarquée ni conversion au runtime.
 * Mettre à jour cette projection à chaque changement des sources ; aucune parité runtime annoncée.
 */
import type { ANTSIA_THEME_IDS } from "./antsia-themes"

type NativeThemeId = (typeof ANTSIA_THEME_IDS)[number]
export type NativeThemeAppearance = "light" | "dark"
export type NativeThemeTokens = Readonly<{
  background: string
  foreground: string
  card: string
  muted: string
  mutedForeground: string
  border: string
  input: string
  primary: string
  primaryOn: string
  danger: string
  success: string
  radiusCard: number
  radiusField: number
  radiusMedia: number
}>

const tokens = {
  gaboma: {
    light: Object.freeze({
      background: "#ffffff",
      foreground: "#0a0a0a",
      card: "#f7f7f7",
      muted: "#eeeeee",
      mutedForeground: "#616161",
      border: "#e6e6e6",
      input: "#878787",
      primary: "#2f67b5",
      primaryOn: "#ffffff",
      danger: "#b50e29",
      success: "#006b42",
      radiusCard: 24,
      radiusField: 14,
      radiusMedia: 16,
    }),
    dark: Object.freeze({
      background: "#000000",
      foreground: "#f5f5f5",
      card: "#141414",
      muted: "#1e1e1e",
      mutedForeground: "#a1a1a1",
      border: "#262626",
      input: "#707070",
      primary: "#6fa2f0",
      primaryOn: "#06142e",
      danger: "#ff8592",
      success: "#4ad898",
      radiusCard: 24,
      radiusField: 14,
      radiusMedia: 16,
    }),
  },
  soleil: {
    light: Object.freeze({
      background: "#f5f4f2",
      foreground: "#1c1917",
      card: "#ffffff",
      muted: "#efeeeb",
      mutedForeground: "#645e59",
      border: "#e7e5e2",
      input: "#8a8682",
      primary: "#ec8b34",
      primaryOn: "#1f1300",
      danger: "#b42d1b",
      success: "#1b6434",
      radiusCard: 24,
      radiusField: 14,
      radiusMedia: 16,
    }),
    dark: Object.freeze({
      background: "#0c0c0d",
      foreground: "#f2f2f3",
      card: "#161618",
      muted: "#1f1f22",
      mutedForeground: "#a0a0a8",
      border: "#29292d",
      input: "#75757c",
      primary: "#f29a4a",
      primaryOn: "#1f1300",
      danger: "#ff8b78",
      success: "#6bd192",
      radiusCard: 24,
      radiusField: 14,
      radiusMedia: 16,
    }),
  },
  foret: {
    light: Object.freeze({
      background: "#f4efe7",
      foreground: "#1e1b16",
      card: "#fffdf9",
      muted: "#ece6db",
      mutedForeground: "#655e52",
      border: "#e3dccf",
      input: "#8c8373",
      primary: "#317a45",
      primaryOn: "#ffffff",
      danger: "#a3221b",
      success: "#28723d",
      radiusCard: 24,
      radiusField: 14,
      radiusMedia: 16,
    }),
    dark: Object.freeze({
      background: "#141312",
      foreground: "#efebe4",
      card: "#1e1d1b",
      muted: "#282624",
      mutedForeground: "#aca69c",
      border: "#33312d",
      input: "#86817a",
      primary: "#76bf85",
      primaryOn: "#031c09",
      danger: "#f59a90",
      success: "#76bf85",
      radiusCard: 24,
      radiusField: 14,
      radiusMedia: 16,
    }),
  },
  corail: {
    light: Object.freeze({
      background: "#f1f1f2",
      foreground: "#0a0a0b",
      card: "#ffffff",
      muted: "#eaeaec",
      mutedForeground: "#5f5f67",
      border: "#e2e2e5",
      input: "#83838b",
      primary: "#e25f78",
      primaryOn: "#2b0711",
      danger: "#a81f31",
      success: "#22603c",
      radiusCard: 24,
      radiusField: 14,
      radiusMedia: 16,
    }),
    dark: Object.freeze({
      background: "#121212",
      foreground: "#ededee",
      card: "#1b1b1d",
      muted: "#252527",
      mutedForeground: "#a0a0a6",
      border: "#2c2c2f",
      input: "#76767d",
      primary: "#f07a90",
      primaryOn: "#2b0711",
      danger: "#ff9a9a",
      success: "#7dd8a3",
      radiusCard: 24,
      radiusField: 14,
      radiusMedia: 16,
    }),
  },
  lagon: {
    light: Object.freeze({
      background: "#edece8",
      foreground: "#1a1a18",
      card: "#fafaf8",
      muted: "#e4e2dd",
      mutedForeground: "#5c5a54",
      border: "#dcdad3",
      input: "#817f77",
      primary: "#4ecdc4",
      primaryOn: "#0b2d2a",
      danger: "#b82b2b",
      success: "#17633f",
      radiusCard: 24,
      radiusField: 14,
      radiusMedia: 16,
    }),
    dark: Object.freeze({
      background: "#1a1a1a",
      foreground: "#ececec",
      card: "#242424",
      muted: "#2e2e2e",
      mutedForeground: "#a8a8a8",
      border: "#363636",
      input: "#7c7c7c",
      primary: "#4ecdc4",
      primaryOn: "#0b2d2a",
      danger: "#ff8f87",
      success: "#6fdca6",
      radiusCard: 24,
      radiusField: 14,
      radiusMedia: 16,
    }),
  },
  electrique: {
    light: Object.freeze({
      background: "#ffffff",
      foreground: "#09090b",
      card: "#ffffff",
      muted: "#f4f4f5",
      mutedForeground: "#67676f",
      border: "#e4e4e7",
      input: "#8b8b94",
      primary: "#0033ff",
      primaryOn: "#ffffff",
      danger: "#c81e1e",
      success: "#126e35",
      radiusCard: 24,
      radiusField: 14,
      radiusMedia: 16,
    }),
    dark: Object.freeze({
      background: "#09090b",
      foreground: "#fafafa",
      card: "#09090b",
      muted: "#18181b",
      mutedForeground: "#a1a1aa",
      border: "#27272a",
      input: "#71717a",
      primary: "#4060ff",
      primaryOn: "#ffffff",
      danger: "#fc9595",
      success: "#34d399",
      radiusCard: 24,
      radiusField: 14,
      radiusMedia: 16,
    }),
  },
  sable: {
    light: Object.freeze({
      background: "#fdfdfb",
      foreground: "#25211e",
      card: "#f1efeb",
      muted: "#e7e4de",
      mutedForeground: "#595550",
      border: "#dddad4",
      input: "#84817b",
      primary: "#0167a8",
      primaryOn: "#ffffff",
      danger: "#b3261e",
      success: "#0f5f2f",
      radiusCard: 24,
      radiusField: 14,
      radiusMedia: 16,
    }),
    dark: Object.freeze({
      background: "#151311",
      foreground: "#e7e4de",
      card: "#24221f",
      muted: "#302e2a",
      mutedForeground: "#b8b4ac",
      border: "#3c3935",
      input: "#7c7872",
      primary: "#5ba5e5",
      primaryOn: "#151311",
      danger: "#e18c85",
      success: "#6ebe85",
      radiusCard: 24,
      radiusField: 14,
      radiusMedia: 16,
    }),
  },
} as const satisfies Readonly<Record<NativeThemeId, Readonly<Record<NativeThemeAppearance, NativeThemeTokens>>>>

export function nativeThemeTokens(theme: NativeThemeId, appearance: NativeThemeAppearance): NativeThemeTokens {
  return tokens[theme][appearance]
}
