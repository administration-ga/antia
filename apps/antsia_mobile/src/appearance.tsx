import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react"
import { useColorScheme } from "react-native"
import { isMemberThemeId, type MemberThemeId } from "@antsia/social-contracts/appearance"
import { nativeThemeTokens, type NativeThemeTokens } from "@antsia/ui/themes/antsia-native"
import fr from "./i18n/fr.json"
import en from "./i18n/en.json"

type Appearance = {
  tokens: NativeThemeTokens
  theme: MemberThemeId
  mode: "light" | "dark" | "system"
  locale: "fr" | "en"
  setTheme: (theme: MemberThemeId) => void
  setMode: (mode: "light" | "dark" | "system") => void
  setLocale: (locale: "fr" | "en") => void
  t: (key: string) => string
}
const Context = createContext<Appearance | null>(null)
export function NativeAppearanceProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<MemberThemeId>("gaboma")
  const [mode, setMode] = useState<Appearance["mode"]>("system")
  const [locale, setLocale] = useState<"fr" | "en">("fr")
  const system = useColorScheme()
  const tokens = nativeThemeTokens(theme, mode === "system" ? system === "dark" ? "dark" : "light" : mode)
  const t = useCallback((key: string) => {
    const messages: Record<string, string> = locale === "fr" ? fr : en
    return messages[key] ?? key
  }, [locale])
  const value = useMemo(() => ({ tokens, theme, mode, locale, setTheme, setMode, setLocale, t }), [tokens, theme, mode, locale, t])
  return <Context.Provider value={value}>{children}</Context.Provider>
}
export function useNativeAppearance() {
  const value = useContext(Context)
  if (!value) throw new Error("nativeAppearanceMissing")
  return value
}
export function validNativeTheme(value: unknown): MemberThemeId | undefined {
  return isMemberThemeId(value) ? value : undefined
}
