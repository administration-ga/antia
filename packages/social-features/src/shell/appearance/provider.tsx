// Dupliqué de socle/packages/ui-v2/src/components/theme-toggle.tsx @ 25398f565 — adaptations : lecture et suivi du système conservés ; provider persistant système/clair/sombre, préférence isolée par réseau, synchronisation entre onglets et stockage indisponible toléré ; la charte du moteur utilise .dark et color-scheme, sans data-theme ni dépendance additionnelle.
"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"

export type AppearanceMode = "system" | "light" | "dark"
export type ResolvedAppearance = "light" | "dark"

interface AppearanceContextValue {
  mode: AppearanceMode
  resolvedAppearance: ResolvedAppearance
  setMode: (mode: AppearanceMode) => void
}

const AppearanceContext = createContext<AppearanceContextValue | null>(null)

function isAppearanceMode(value: unknown): value is AppearanceMode {
  return value === "system" || value === "light" || value === "dark"
}

function readPreference(storageKey: string): AppearanceMode {
  try {
    const stored = window.localStorage.getItem(storageKey)
    return isAppearanceMode(stored) ? stored : "system"
  } catch {
    return "system"
  }
}

export interface AppearanceProviderProps {
  /** Le préfixe du réseau courant, fourni aussi aux magasins de la coque. */
  storagePrefix: string
  children: ReactNode
}

/** Une seule préférence à la racine : changer d'habit ne remonte aucune salle. */
export function AppearanceProvider({ storagePrefix, children }: AppearanceProviderProps) {
  // Valeurs stables au serveur et au premier rendu client ; le navigateur est
  // consulté après le montage, comme dans le patron du socle.
  const [mode, setModeState] = useState<AppearanceMode>("system")
  const [systemDark, setSystemDark] = useState(false)
  const storageKey = `${storagePrefix}appearance`

  useEffect(() => {
    let media: MediaQueryList | null = null
    try {
      media = window.matchMedia("(prefers-color-scheme: dark)")
    } catch {
      // Un navigateur sans cette API conserve le repli clair.
    }
    setSystemDark(media?.matches ?? false)
    setModeState(readPreference(storageKey))

    const onSystemChange = (event: MediaQueryListEvent) => setSystemDark(event.matches)
    const onStorage = (event: StorageEvent) => {
      if (event.key !== storageKey && event.key !== null) return
      try {
        if (event.storageArea !== null && event.storageArea !== window.localStorage) return
      } catch {
        return
      }
      if (event.newValue === null) setModeState("system")
      else if (isAppearanceMode(event.newValue)) setModeState(event.newValue)
    }

    media?.addEventListener("change", onSystemChange)
    window.addEventListener("storage", onStorage)
    return () => {
      media?.removeEventListener("change", onSystemChange)
      window.removeEventListener("storage", onStorage)
    }
  }, [storageKey])

  const resolvedAppearance: ResolvedAppearance = mode === "system" ? (systemDark ? "dark" : "light") : mode

  useEffect(() => {
    document.documentElement.classList.toggle("dark", resolvedAppearance === "dark")
    document.documentElement.style.colorScheme = resolvedAppearance
  }, [resolvedAppearance])

  const setMode = useCallback((next: AppearanceMode) => {
    if (!isAppearanceMode(next)) return
    setModeState(next)
    try {
      // L'absence de choix explicite retrouve le suivi du système, y compris
      // dans les autres onglets. Aucune autre préférence n'est touchée.
      if (next === "system") window.localStorage.removeItem(storageKey)
      else window.localStorage.setItem(storageKey, next)
    } catch {
      // Le choix en mémoire reste actif même quand le stockage est refusé.
    }
  }, [storageKey])

  const value = useMemo(() => ({ mode, resolvedAppearance, setMode }), [mode, resolvedAppearance, setMode])
  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>
}

/** Les applications qui n'ont pas encore monté le provider n'offrent pas le contrôle. */
export function useOptionalAppearance(): AppearanceContextValue | null {
  return useContext(AppearanceContext)
}
