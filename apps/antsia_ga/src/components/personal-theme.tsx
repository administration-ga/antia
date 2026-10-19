"use client"

import { isMemberThemeId, type MemberThemeId } from "@antsia/social-contracts/appearance"
import { useOptionalAppearance } from "@antsia/social-features/shell/appearance"
import { api } from "@convex/_generated/api"
import { useMutation } from "convex/react"
import { createContext, type ReactNode, useCallback, useContext, useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { engineErrorMessage } from "@/lib/engine-errors"
import { createThemeAccountSync, type ThemeAccountSync } from "@/lib/theme-account-sync"

type ThemeChoice = (theme: string) => void

const ThemeChoiceContext = createContext<ThemeChoice | null>(null)

/** Choisir un thème EN SESSION : appliqué tout de suite, enregistré sur le compte. `null` hors session. */
export function useThemeChoice(): ThemeChoice | null {
  return useContext(ThemeChoiceContext)
}

/**
 * Le thème du compte, sous la session : il s'applique à l'appareil (et y reste en
 * cache pour le script d'amorçage), et le choix du membre s'y enregistre — règles
 * dans `lib/theme-account-sync.ts`. Hors session (`signedIn` faux), aucun choix
 * n'est enregistré : le sélecteur retombe sur la mémoire de l'appareil.
 */
export function PersonalTheme({ signedIn, accountTheme, children }: { signedIn: boolean; accountTheme: MemberThemeId | undefined; children: ReactNode }) {
  const appearance = useOptionalAppearance()
  const savePreferences = useMutation(api.modules.people.preferences.setMyPreferences)
  const { t } = useTranslation("antsia")
  // La synchronisation vit aussi longtemps que le composant : créée au montage,
  // elle relit les fonctions courantes plutôt que celles du premier rendu.
  const current = useRef({ setTheme: appearance?.setTheme, savePreferences, t })
  const sync = useRef<ThemeAccountSync<MemberThemeId> | null>(null)
  useEffect(() => {
    current.current = { setTheme: appearance?.setTheme, savePreferences, t }
  })
  useEffect(() => {
    sync.current = createThemeAccountSync<MemberThemeId>({
      apply: (theme) => current.current.setTheme?.(theme),
      save: (theme) => current.current.savePreferences({ theme }),
      onSaveFailed: (error) => {
        const translate = current.current.t
        toast.error(translate("preferences.theme.saveFailed", { reason: engineErrorMessage(error, translate) }))
      },
    })
    return () => {
      sync.current = null
    }
  }, [])

  useEffect(() => {
    sync.current?.accountChanged(accountTheme)
  }, [accountTheme])

  const choose = useCallback((theme: string) => {
    if (isMemberThemeId(theme)) sync.current?.choose(theme)
  }, [])

  return <ThemeChoiceContext.Provider value={signedIn ? choose : null}>{children}</ThemeChoiceContext.Provider>
}
