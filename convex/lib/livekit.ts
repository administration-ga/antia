// Dupliqué de socle/convex/lib/livekit.ts @ ad2e7fdc2 — adaptations : refus à code du moteur (`mediaServerNotConfigured`, levé par `fail`, nom de fournisseur absent du code rendu à l'écran) au lieu de `error(ErrorCode.LIVEKIT_NOT_CONFIGURED)`.
import { fail } from "./errors"

/**
 * Configuration LiveKit — SOURCE UNIQUE DE VÉRITÉ.
 *
 * L'instance est configurée EXCLUSIVEMENT par les variables d'environnement du
 * déploiement Convex. Jamais d'URL en dur : un littéral de repli divergent
 * enverrait des participants sur des serveurs différents selon le chemin de
 * code — des correspondants qui ne se voient pas, panne difficile à lire.
 *
 * On LÈVE si une variable manque, plutôt que de retomber sur un défaut faux.
 * L'erreur est une `ConvexError` portant un CODE (`mediaServerNotConfigured`) :
 * le message d'un `Error` nu est masqué en production (« Server Error »), le
 * `data` d'une `ConvexError` traverse intact. La LISTE des variables
 * manquantes reste côté serveur (journaux du déploiement) : elle renseigne
 * l'exploitant sans rien apprendre au client de la configuration.
 */
export function getLiveKitConfig(): { apiKey: string; apiSecret: string; wsUrl: string } {
  // `.trim()` défensif : un retour à la ligne parasite (mauvais guillemets lors
  // d'un `convex env set`) a déjà été observé sur LIVEKIT_WS_URL. Une valeur
  // uniquement blanche devient "" : manquante.
  const apiKey = process.env.LIVEKIT_API_KEY?.trim()
  const apiSecret = process.env.LIVEKIT_API_SECRET?.trim()
  const wsUrl = process.env.LIVEKIT_WS_URL?.trim()

  if (!apiKey || !apiSecret || !wsUrl) {
    const missing = [!apiKey && "LIVEKIT_API_KEY", !apiSecret && "LIVEKIT_API_SECRET", !wsUrl && "LIVEKIT_WS_URL"].filter(Boolean).join(", ")
    // Détail d'exploitation : visible dans les journaux du déploiement, jamais renvoyé au client.
    console.error(`[livekit] Configuration incomplète (manquant : ${missing}). Définir par « convex env set <KEY> <VALUE> » sur le déploiement.`)
    return fail("mediaServerNotConfigured")
  }

  return { apiKey, apiSecret, wsUrl }
}
