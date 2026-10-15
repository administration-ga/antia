// Dupliqué de socle/convex/lib/livekitWake.ts @ ad2e7fdc2 — adaptations : refus à code du moteur (`mediaServerNoCapacity`, `mediaServerUnavailable`, levés par `fail`) au lieu des codes `LIVEKIT_*` du socle.
import { fail } from "./errors"

/**
 * Réveil du serveur LiveKit avant l'émission d'un jeton.
 *
 * Le serveur peut se SUSPENDRE seul après un quart d'heure sans session. Sans
 * ce réveil, le premier participant de la journée reçoit un jeton valide pour
 * un serveur éteint : le navigateur échoue sur la poignée de main, l'écran
 * reste sur « Appel en cours… », micro coupé, et rien ne dit pourquoi.
 *
 * L'appel est donc BLOQUANT — le service de réveil ne répond qu'une fois le
 * serveur joignable, si bien qu'un jeton rendu est un jeton utilisable.
 *
 * ⚠️ À appeler APRÈS l'autorisation du participant, jamais avant : sinon
 * n'importe quel visiteur rallumerait le serveur en boucle.
 *
 * Sans `LIVEKIT_WAKE_URL` / `LIVEKIT_WAKE_TOKEN`, la fonction ne fait rien : un
 * déploiement dont le serveur tourne en permanence n'a pas à connaître ce
 * mécanisme.
 *
 * Le service de réveil répond 503 avec `{ error: "wake_failed", reason, detail }`
 * quand il échoue. `reason` est un CODE : celui de l'opération du nuage refusée.
 * Une pénurie de machines (zone sans capacité) a son propre code,
 * `mediaServerNoCapacity` : « le serveur démarre, patientez » serait faux, et
 * les personnes réessaieraient en boucle.
 */

/** Le service de réveil peut démarrer une machine froide : la marge est large. */
const WAKE_TIMEOUT_MS = 240_000
const PROBE_TIMEOUT_MS = 5_000

/** Raisons du service de réveil qui signifient « le nuage n'a pas de machine ». */
const CAPACITY_REASONS: ReadonlySet<string> = new Set(["ZONE_RESOURCE_POOL_EXHAUSTED", "ZONE_RESOURCE_POOL_EXHAUSTED_WITH_DETAILS"])

type WakeFailure = { reason?: string; detail?: string }

/**
 * Lit `{ reason, detail }` du corps d'un échec. Un corps absent, illisible ou
 * d'une autre forme rend `{}` — un 503 rendu par la plateforme d'hébergement
 * du service lui-même (délai dépassé) n'est pas du JSON.
 */
async function readWakeFailure(response: Response): Promise<WakeFailure> {
  try {
    const body: unknown = await response.json()
    if (typeof body !== "object" || body === null) return {}
    const { reason, detail } = body as { reason?: unknown; detail?: unknown }
    return {
      reason: typeof reason === "string" && reason.length > 0 ? reason : undefined,
      detail: typeof detail === "string" && detail.length > 0 ? detail : undefined,
    }
  } catch {
    return {}
  }
}

/** Le serveur répond en HTTP dès qu'il écoute : la sonde parle `https` là où les participants parlent `wss`. */
async function livekitReachable(wsUrl: string): Promise<boolean> {
  try {
    const probe = new URL(wsUrl)
    probe.protocol = probe.protocol === "ws:" ? "http:" : "https:"
    const response = await fetch(probe.origin, { signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) })
    return response.ok
  } catch {
    return false
  }
}

export async function ensureLiveKitAwake(wsUrl: string): Promise<void> {
  const wakeUrl = process.env.LIVEKIT_WAKE_URL?.trim()
  const wakeToken = process.env.LIVEKIT_WAKE_TOKEN?.trim()
  if (!wakeUrl || !wakeToken) return

  let capacityExhausted = false
  try {
    const response = await fetch(wakeUrl, { method: "POST", headers: { "x-waker-token": wakeToken }, signal: AbortSignal.timeout(WAKE_TIMEOUT_MS) })
    if (response.ok) return
    const { reason, detail } = await readWakeFailure(response)
    capacityExhausted = reason !== undefined && CAPACITY_REASONS.has(reason)
    // Détail d'exploitation : la cause se lit dans les journaux du déploiement, jamais côté client.
    console.error(`[livekit] Service de réveil en échec (HTTP ${response.status}${reason ? `, ${reason}` : ""})${detail ? ` : ${detail}` : ""} — sonde directe du serveur.`)
  } catch {
    // Le service de réveil est injoignable — reste à savoir si le serveur, lui,
    // tourne. Une panne du réveil ne doit pas couper une visio en cours.
    console.error("[livekit] Service de réveil injoignable — sonde directe du serveur.")
  }

  if (await livekitReachable(wsUrl)) return

  return fail(capacityExhausted ? "mediaServerNoCapacity" : "mediaServerUnavailable")
}
