// Dupliqué de socle/packages/agent-features/src/features/messagerie/messagerie-typing.ts @ ad2e7fdc2 — adaptations : commentaires seulement — le TTL serveur est celui des tables du moteur (`personalTyping`, `groupTyping`, six secondes).
/**
 * messagerie-typing — la cadence du signal « écrit… ».
 *
 * Module PUR : une cadence enfouie dans un `onChange` n'est vérifiable qu'en
 * regardant l'écran d'un autre compte.
 */

/**
 * Intervalle entre deux pings de saisie.
 *
 * ⚠️ **Doit rester STRICTEMENT sous le TTL serveur de 6 s** (`personalTyping`
 * et `groupTyping` du moteur, purgés à la minute par un cron). Un ping plus lent que le TTL ferait
 * clignoter l'indicateur chez le correspondant : il s'éteindrait entre deux
 * frappes, et se rallumerait — un défaut qu'on prend pour une latence réseau.
 * 2,5 s laisse deux pings par fenêtre de vie.
 */
export const TYPING_PING_INTERVAL_MS = 2500

/** Le TTL serveur, recopié ici pour que le test puisse comparer les deux. */
export const TYPING_SERVER_TTL_MS = 6000

/**
 * Faut-il (re)signaler la saisie ?
 *
 * `true` à la première frappe — sans quoi l'indicateur n'apparaîtrait qu'après
 * 2,5 s, c'est-à-dire souvent après l'envoi d'un message court.
 */
export function shouldPingTyping(
  lastPingAt: number | null,
  now: number,
): boolean {
  if (lastPingAt === null) return true
  return now - lastPingAt >= TYPING_PING_INTERVAL_MS
}
