/**
 * Outils de DÉVELOPPEMENT — jamais en production.
 *
 * Double garde, comme les graines : la variable `ANTIA_DEV_TOOLS=true` posée
 * par le propriétaire ET un déploiement LOCAL (backend Convex sur la machine,
 * `CONVEX_CLOUD_URL` en `http://127.0.0.1` ou `http://localhost`). Une variable
 * oubliée sur un déploiement en nuage n'ouvre donc rien.
 */
type Env = Record<string, string | undefined>

/** Le déploiement courant tourne-t-il sur la machine (backend local) ? */
export function isLocalDeployment(env: Env = process.env): boolean {
  return /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(env.CONVEX_CLOUD_URL ?? "")
}

/** Les outils de développement sont-ils ouverts ici ? */
export function devToolsAllowed(env: Env = process.env): boolean {
  return env.ANTIA_DEV_TOOLS === "true" && isLocalDeployment(env)
}
