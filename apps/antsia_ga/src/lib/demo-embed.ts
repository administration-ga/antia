/** Entrée publique du build principal ; le backend est choisi au déploiement. */
export function demoEntryEnabled(): boolean {
  return process.env.NEXT_PUBLIC_DEMO_ENTRY_ENABLED === "true"
}
