/**
 * Harnais convex-test du moteur (patron du socle, `socle/convex/test.setup.ts`).
 *
 * `testConvex()` monte un mock complet du backend câblé sur le schéma RÉEL et
 * les modules de fonctions réels. Les fichiers de test qui l'utilisent
 * déclarent en tête : `// @vitest-environment edge-runtime`.
 *
 * Fichier à deux points dans son nom : ignoré par le bundler de Convex, qui
 * refuserait `import.meta.glob` (piège payé par PRO.GA).
 */
import aggregateTest from "@convex-dev/aggregate/test"
import betterAuthTest from "@convex-dev/better-auth/test"
import rateLimiterTest from "@convex-dev/rate-limiter/test"
import { convexTest, type TestConvex } from "convex-test"

import { components } from "./_generated/api"
import schema from "./schema"

// `import.meta.glob` est une primitive de Vite (vitest), remplacée au transform.
// Son type arrive par `@convex-dev/rate-limiter/test`, dont la référence
// `vite/client` augmente `ImportMeta` pour tout le programme : ne PAS le
// redéclarer ici (TS2717, piège déjà relevé au socle).

// Glob PARESSEUX de tous les modules de fonctions, plus les `.js` de
// `_generated/` (que convex-test exige pour situer la racine) ; tests, réglages
// et déclarations de types restent dehors — exactement ce que le bundler de
// Convex déploie. Un module n'est importé que si un test l'appelle.
// ⚠️ Forme TABLEAU avec exclusions « ! » : la négation extglob `!(…)` ne
// correspond à RIEN avec le glob de Vite (mesuré : zéro module, harnais muet).
// Référence littérale obligatoire (Vite la remplace statiquement).
export const modules = import.meta.glob([
  "./**/*.ts",
  "./_generated/*.js",
  "!./**/*.test.ts",
  "!./**/*.setup.ts",
  "!./**/*.d.ts",
  "!./vitest.config.ts",
])

/**
 * Instancie un backend Convex mocké contre le schéma et les modules réels, avec
 * le VRAI limiteur de débit et les VRAIS agrégats (composants montés) : les
 * tests exercent les seuils et les décomptes, ils ne les neutralisent pas.
 */
type BackendTest = TestConvex<typeof schema>

const TEST_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000

/** Une vraie ligne du composant, utilisable avec un claim `sessionId` explicite. */
export async function createTestSession(t: BackendTest, userId: string, expiresAt = Date.now() + TEST_SESSION_TTL_MS): Promise<string> {
  const now = Date.now()
  const session: unknown = await t.mutation(components.betterAuth.adapter.create, {
    input: {
      model: "session",
      data: { userId, expiresAt, token: `test-session-${crypto.randomUUID()}`, createdAt: now, updatedAt: now },
    },
  })
  if (typeof session !== "object" || session === null || !("_id" in session) || typeof session._id !== "string") {
    throw new Error("Le composant Better Auth n'a pas créé la session de test")
  }
  return session._id
}

/**
 * Les fixtures sociales antérieures à PA4 donnent seulement un `subject`.
 * Leur session est provisionnée une seule fois, dans le VRAI composant,
 * avant la première exécution. Une session supprimée n'est jamais recréée.
 * Les tests de sécurité utilisent `automaticSessions: false` ou un claim
 * explicite : aucune correction de leurs identités n'est alors faite.
 */
export function testConvex({ automaticSessions = true }: { automaticSessions?: boolean } = {}) {
  const t = convexTest(schema, modules)
  betterAuthTest.register(t, "betterAuth")
  rateLimiterTest.register(t, "rateLimiter")
  aggregateTest.register(t, "followerCounts")
  aggregateTest.register(t, "engineCounters")
  if (!automaticSessions) return t

  const sessions = new Map<string, Promise<string>>()
  return new Proxy(t, {
    get(target, property, receiver) {
      if (property !== "withIdentity") return Reflect.get(target, property, receiver)
      return (identity: Parameters<typeof t.withIdentity>[0]): ReturnType<typeof t.withIdentity> => {
        const raw = t.withIdentity(identity)
        if ("sessionId" in identity) return raw

        let authenticated: Promise<ReturnType<typeof t.withIdentity>> | undefined
        const withSession = () => authenticated ??= (async () => {
          const resolved = await raw.run(async (ctx) => ctx.auth.getUserIdentity())
          if (!resolved) throw new Error("Identité de test absente")
          let session = sessions.get(resolved.subject)
          if (!session) {
            session = createTestSession(t, resolved.subject)
            sessions.set(resolved.subject, session)
          }
          return t.withIdentity({ ...resolved, sessionId: await session })
        })()

        return new Proxy(raw, {
          get(accessor, method, accessorReceiver) {
            if (!["query", "mutation", "action", "run", "fetch"].includes(String(method))) {
              return Reflect.get(accessor, method, accessorReceiver)
            }
            return async (...args: unknown[]) => {
              const ready = await withSession()
              return Reflect.apply(Reflect.get(ready, method), ready, args)
            }
          },
        })
      }
    },
  })
}
