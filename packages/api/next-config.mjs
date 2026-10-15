// @ts-check
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"

import { securityHeaders } from "./csp.mjs"

/**
 * Lit les variables d'un fichier `.env` (format écrit par le CLI Convex :
 * `CLE=valeur`, commentaires `#`). Volontairement minimal : `@next/env` garde un
 * cache de module partagé avec Next, qui renvoie l'environnement du PREMIER
 * dossier chargé (celui de l'application) et ignore le nôtre — mesuré.
 * @param {string} file
 * @returns {Record<string, string>}
 */
export function readEnvFile(file) {
  /** @type {Record<string, string>} */
  const values = {}
  if (!existsSync(file)) return values
  for (const raw of readFileSync(file, "utf8").split("\n")) {
    const line = raw.trim()
    if (!line || line.startsWith("#")) continue
    const index = line.indexOf("=")
    if (index <= 0) continue
    const key = line.slice(0, index).trim()
    let value = line.slice(index + 1).trim()
    const comment = value.search(/\s#/)
    if (comment >= 0 && !/^["']/.test(value)) value = value.slice(0, comment).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1)
    values[key] = value
  }
  return values
}

/**
 * Configuration Next.js commune aux applications du moteur (antia_ga,
 * admin_antia_ga, et les applications externes comme diasporale_com).
 *
 * - Racine de résolution et de traçage = ECOSYSTEMES : toutes les applications
 *   se construisent dans ce contexte (Dockerfile en contexte ECOSYSTEMES).
 * - En développement, le déploiement Convex courant est lu dans le
 *   `.env.local` QUE `bun run dev:convex` ÉCRIT LUI-MÊME à la racine d'ANTIA
 *   (`CONVEX_URL`, `CONVEX_SITE_URL`) : une seule source, aucun fichier
 *   d'environnement à recopier par application.
 * - En production, les valeurs arrivent par les ARG du Dockerfile (catalogue).
 *
 * @param {{ appDir: string, engineRoot?: string, transpilePackages?: string[] }} options
 * @returns {import("next").NextConfig}
 */
export function createEngineNextConfig(options) {
  const isDev = process.env.NODE_ENV !== "production"
  const ecosystemsRoot = path.resolve(options.appDir, "../../..")
  const engineRoot = options.engineRoot ?? path.join(ecosystemsRoot, "ANTIA")
  const local = isDev ? readEnvFile(path.join(engineRoot, ".env.local")) : {}
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL ?? local.CONVEX_URL ?? ""
  const convexSiteUrl = process.env.CONVEX_SITE_URL ?? local.CONVEX_SITE_URL ?? ""
  // Serveur média des appels : sa seule trace côté application est la CSP (le
  // client reçoit l'URL avec son jeton d'appel). Posée par le propriétaire avec les
  // clés LiveKit du déploiement — sans elle, aucune origine média n'est ouverte.
  const livekitUrl = process.env.LIVEKIT_WS_URL ?? local.LIVEKIT_WS_URL ?? ""

  return {
    output: "standalone",
    outputFileTracingRoot: ecosystemsRoot,
    turbopack: { root: ecosystemsRoot },
    reactCompiler: false,
    poweredByHeader: false,
    transpilePackages: [
      "@antia/api",
      "@antia/social-contracts",
      "@antia/social-domain",
      "@antia/social-features",
      "@antia/ui",
      ...(options.transpilePackages ?? []),
    ],
    typescript: {
      // Le typage est une porte de construction : aucune dette tolérée.
      ignoreBuildErrors: false,
    },
    env: {
      NEXT_PUBLIC_CONVEX_URL: convexUrl,
      CONVEX_SITE_URL: convexSiteUrl,
    },
    async headers() {
      return [{ source: "/(.*)", headers: securityHeaders({ convexUrl, livekitUrl, isDev }) }]
    },
  }
}
