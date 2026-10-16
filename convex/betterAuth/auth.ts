// Dupliqué de socle/convex/betterAuth/auth.ts @ ad2e7fdc2 — adaptations : comptes LÉGERS par code à usage unique seulement (ni mot de passe, ni PIN, ni session bureau) ; IDN (`genericOAuth`) et SMS reportés au prompt PA4 ; origines lues dans SITE_URL et TRUSTED_ORIGINS sans repli en dur ; code de développement lisible à l'écran en local (`modules/platform/devTools`) ; limitation de débit par les seaux du moteur ; refus sans phrase (codes).
/**
 * Better Auth du moteur — l'émetteur UNIQUE des jetons Convex (ADR-0002).
 *
 * Les applications parlent à Better Auth par leur propre origine (proxy Next
 * `/api/auth/*` → actions HTTP Convex) ; le greffon `crossDomain` garde la
 * session par origine et `oneTimeToken` prépare le passage entre applications
 * (PA4).
 */
import { createClient, type GenericCtx } from "@convex-dev/better-auth"
import { convex, crossDomain } from "@convex-dev/better-auth/plugins"
import type { BetterAuthPlugin } from "better-auth"
import { APIError, createAuthMiddleware } from "better-auth/api"
import { betterAuth } from "better-auth/minimal"
import { emailOTP, oneTimeToken } from "better-auth/plugins"

import { BRAND_NAME } from "@antsia/social-contracts/brand"

import { components, internal } from "../_generated/api"
import type { DataModel } from "../_generated/dataModel"
import authConfig from "../auth.config"
import { devToolsAllowed } from "../lib/devTools"

export const authComponent = createClient<DataModel>(components.betterAuth)

/** Ports des applications du moteur en développement (antsia.ga, diasporale.com, console). */
const DEV_APP_PORTS = [3030, 3031, 3032] as const

/** Durée de vie d'un code à usage unique : cinq minutes. */
export const OTP_TTL_SECONDS = 300

/** L'origine principale, lue dans le déploiement — jamais une adresse écrite ici (dépôt public). */
function primarySiteUrl(): string {
  const siteUrl = process.env.SITE_URL
  if (!siteUrl) throw new Error("[Auth] SITE_URL manquant : variable du déploiement Convex.")
  return new URL(siteUrl).origin
}

/** Origines valides d'une liste brute (séparateurs : virgules ou espaces). */
export function parseOriginList(raw: string | undefined): string[] {
  const origins: string[] = []
  for (const part of (raw ?? "").split(/[\s,]+/)) {
    if (!part) continue
    try {
      const url = new URL(part)
      if (url.protocol === "https:" || url.protocol === "http:") origins.push(url.origin)
    } catch {
      // une entrée illisible est ignorée, jamais devinée
    }
  }
  return origins
}

/**
 * Origines de confiance : l'origine principale, celles des applications
 * déclarées (TRUSTED_ORIGINS) et, en développement local seulement, les ports
 * des applications du moteur.
 */
export function trustedOrigins(env: Record<string, string | undefined> = process.env): string[] {
  const origins = [...(env.SITE_URL ? parseOriginList(env.SITE_URL) : []), ...parseOriginList(env.TRUSTED_ORIGINS)]
  if (devToolsAllowed(env)) {
    for (const port of DEV_APP_PORTS) origins.push(`http://localhost:${port}`, `http://127.0.0.1:${port}`)
  }
  return Array.from(new Set(origins))
}

/**
 * L'origine qui demande, si elle est de confiance ; sinon l'origine principale.
 * Le greffon `crossDomain` y renvoie la personne après un parcours de connexion.
 */
export function resolveSiteUrl(origin: string | null | undefined, allowlist: string[], fallback: string): string {
  if (origin) {
    try {
      const normalized = new URL(origin).origin
      if (allowlist.includes(normalized)) return normalized
    } catch {
      // origine illisible : repli
    }
  }
  return fallback
}

/** Valide que BETTER_AUTH_SECRET est présent et assez long. */
function validateAuthSecret(): string {
  const secret = process.env.BETTER_AUTH_SECRET
  if (!secret) throw new Error("[Auth] BETTER_AUTH_SECRET manquant.")
  if (secret.length < 32) throw new Error(`[Auth] BETTER_AUTH_SECRET trop court (${secret.length} caractères, 32 requis).`)
  return secret
}

type RunMutationCtx = { runMutation: (reference: never, args: never) => Promise<unknown> }

function canRunMutation(ctx: unknown): ctx is RunMutationCtx {
  return typeof ctx === "object" && ctx !== null && "runMutation" in ctx && typeof (ctx as RunMutationCtx).runMutation === "function"
}

// Limitation de débit : avant l'envoi d'un code et avant une connexion. Clé =
// adresse normalisée ; au-delà du quota, 429 avec le code `rateLimited`.
const RL_LOGIN_PATHS = new Set<string>(["/sign-in/email-otp"])
const RL_OTP_SEND_PATHS = new Set<string>(["/email-otp/send-verification-otp"])

const rateLimitPlugin = (ctx: GenericCtx<DataModel>): BetterAuthPlugin => ({
  id: "engine-auth-rate-limit",
  hooks: {
    before: [
      {
        matcher: (hookCtx) => RL_LOGIN_PATHS.has(hookCtx.path ?? "") || RL_OTP_SEND_PATHS.has(hookCtx.path ?? ""),
        handler: createAuthMiddleware(async (hookCtx) => {
          const body = (hookCtx as { body?: { email?: unknown } }).body ?? {}
          const key = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
          if (!key || !canRunMutation(ctx)) return
          const bucket = RL_OTP_SEND_PATHS.has(hookCtx.path ?? "") ? "auth.otp.send" : "auth.login"
          const result = (await ctx.runMutation(
            internal.modules.platform.authRateLimit.checkAuthRateLimit as never,
            { bucket, key } as never,
          )) as { ok: boolean; retryAfterMs: number }
          if (!result.ok) throw new APIError("TOO_MANY_REQUESTS", { message: "rateLimited", code: "rateLimited" })
        }),
      },
    ],
  },
})

/** Retire le champ `mode` des clauses `where`, que l'adaptateur Convex refuse (contournement repris du socle). */
function stripModeClauses<T>(args: T): T {
  const strip = (clause: unknown) => {
    if (clause && typeof clause === "object" && "mode" in clause) {
      const { mode: _mode, ...rest } = clause as Record<string, unknown>
      return rest
    }
    return clause
  }
  if (!args || typeof args !== "object") return args
  const copy = { ...(args as Record<string, unknown>) }
  if ("where" in copy) copy.where = Array.isArray(copy.where) ? copy.where.map(strip) : strip(copy.where)
  const input = copy.input
  if (input && typeof input === "object" && "where" in input) {
    const inputCopy = { ...(input as Record<string, unknown>) }
    inputCopy.where = Array.isArray(inputCopy.where) ? inputCopy.where.map(strip) : strip(inputCopy.where)
    copy.input = inputCopy
  }
  return copy as T
}

/** Le contexte passé à l'adaptateur, avec le contournement `mode`. */
export function adapterContext(ctx: GenericCtx<DataModel>): GenericCtx<DataModel> {
  const base = ctx as unknown as Record<string, unknown> & {
    runQuery?: (reference: unknown, args: unknown) => Promise<unknown>
    runMutation?: (reference: unknown, args: unknown) => Promise<unknown>
  }
  return {
    ...base,
    ...(base.runQuery ? { runQuery: (reference: unknown, args: unknown) => base.runQuery?.(reference, stripModeClauses(args)) } : {}),
    ...(base.runMutation ? { runMutation: (reference: unknown, args: unknown) => base.runMutation?.(reference, stripModeClauses(args)) } : {}),
  } as unknown as GenericCtx<DataModel>
}

export const createAuth = (ctx: GenericCtx<DataModel>, requestOrigin?: string | null) => {
  const siteUrl = primarySiteUrl()
  const allowedOrigins = trustedOrigins()
  const isLocalDev = devToolsAllowed()

  return betterAuth({
    appName: BRAND_NAME,
    baseURL: siteUrl,
    secret: validateAuthSecret(),
    session: {
      // Sept jours, rafraîchis chaque jour ; le JWT Convex (30 minutes) reste la
      // vraie frontière d'autorisation et la fenêtre de révocation.
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
    },
    trustedOrigins: allowedOrigins,
    database: authComponent.adapter(adapterContext(ctx)),
    advanced: {
      // Le proxy de développement parle en http://localhost : cookies non sécurisés en local seulement.
      useSecureCookies: isLocalDev ? false : undefined,
    },
    plugins: [
      convex({ authConfig, jwt: { expirationSeconds: 60 * 30 } }) as unknown as BetterAuthPlugin,
      crossDomain({ siteUrl: resolveSiteUrl(requestOrigin, allowedOrigins, siteUrl) }),
      oneTimeToken({ expiresIn: 3, storeToken: "plain" }),
      rateLimitPlugin(ctx),
      emailOTP({
        otpLength: 6,
        expiresIn: OTP_TTL_SECONDS,
        async sendVerificationOTP({ email, otp }) {
          if (isLocalDev && canRunMutation(ctx)) {
            await ctx.runMutation(
              internal.modules.platform.devTools.recordOtp as never,
              { email, code: otp, expiresAt: Date.now() + OTP_TTL_SECONDS * 1000 } as never,
            )
            return
          }
          // L'envoi par courriel (Resend, adresse d'expédition du déploiement)
          // arrive avec les comptes légers complets (PA4) : d'ici là, hors
          // développement local, aucun code ne part — refus explicite.
          throw new APIError("SERVICE_UNAVAILABLE", { message: "otpDeliveryUnavailable", code: "otpDeliveryUnavailable" })
        },
      }),
    ],
  })
}
