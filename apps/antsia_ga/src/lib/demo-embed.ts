import { appBasePath } from "./app-path"

export const DEMO_BANNER_HEIGHT_PROPERTY = "--antsia-demo-banner-height"

/** Le bandeau reste en flux ; seul le build démo retranche sa hauteur du workspace. */
export function demoWorkspaceHeight(): string | undefined {
  return appBasePath() ? `calc(100dvh - var(${DEMO_BANNER_HEIGHT_PROPERTY}, 0px))` : undefined
}

/** Entrée publique du build principal ; le backend est choisi au déploiement. */
export function demoEntryEnabled(): boolean {
  return process.env.NEXT_PUBLIC_DEMO_ENTRY_ENABLED === "true"
}
