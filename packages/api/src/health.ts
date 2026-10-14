/**
 * Santé FONCTIONNELLE de l'application : une sonde qui répond « ok » à une
 * application incapable de servir ne supervise rien (doctrine du socle). La
 * configuration est complète quand l'URL du moteur est connue.
 */
export type HealthReport = {
  status: "ok" | "degraded"
  application: string
  version: string
  backend: "configured" | "missing"
}

export function computeHealth(env: {
  NEXT_PUBLIC_CONVEX_URL?: string
  NEXT_PUBLIC_BUILD_SHA?: string
}, application: string): HealthReport {
  const backend = env.NEXT_PUBLIC_CONVEX_URL ? "configured" : "missing"
  return {
    status: backend === "configured" ? "ok" : "degraded",
    application,
    version: env.NEXT_PUBLIC_BUILD_SHA ?? "dev",
    backend,
  }
}
