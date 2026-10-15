// Dupliqué de socle/convex/schemas/messageReactions.ts @ ad2e7fdc2 — adaptations : module PUR partagé par le moteur et les écrans (le validateur Convex vit côté backend, `convex/modules/messaging/tables.ts`) ; libellés accessibles retirés (clés i18n de l'écran) ; la table d'emoji reste, c'est une donnée.
/**
 * Vocabulaire des RÉACTIONS À UN MESSAGE — conversations 1:1 et de groupe.
 *
 * ⚠️ À ne pas confondre avec les réactions à une PUBLICATION (quatre genres
 * sobres) : une conversation privée est un autre registre. Liste FERMÉE, jamais
 * un emoji libre : un champ libre rendrait le décompte impossible à agréger.
 */

/** Les six genres, dans l'ordre d'affichage de la barre de réaction. */
export const MESSAGE_REACTION_KINDS = ["like", "love", "laugh", "wow", "sad", "pray"] as const

export type MessageReactionKind = (typeof MESSAGE_REACTION_KINDS)[number]

/** L'emoji rendu pour chaque genre — la seule table de correspondance. */
export const MESSAGE_REACTION_EMOJI: Readonly<Record<MessageReactionKind, string>> = Object.freeze({
  like: "👍",
  love: "❤️",
  laugh: "😂",
  wow: "😮",
  sad: "😢",
  pray: "🙏",
})

export type MessageReactionCounts = Readonly<Record<MessageReactionKind, number>>

/** Un décompte neuf — tous les genres à zéro. */
export function emptyMessageReactionCounts(): Record<MessageReactionKind, number> {
  return { like: 0, love: 0, laugh: 0, wow: 0, sad: 0, pray: 0 }
}

/**
 * Applique un basculement aux décomptes : poser (`previous === null`), retirer
 * (`next === null`) ou remplacer. Jamais de valeur négative : un décompte qui
 * descend sous zéro est un bug d'appariement, pas une information.
 */
export function applyMessageReactionDelta(
  counts: MessageReactionCounts | undefined,
  previous: MessageReactionKind | null,
  next: MessageReactionKind | null,
): Record<MessageReactionKind, number> {
  const result = { ...emptyMessageReactionCounts(), ...(counts ?? {}) }
  if (previous !== null) result[previous] = Math.max(0, result[previous] - 1)
  if (next !== null) result[next] = result[next] + 1
  return result
}

/** Le genre à écrire quand on rejoue un appui : reposer le même genre RETIRE (`null`). */
export function nextMessageReactionKind(previous: MessageReactionKind | null, pressed: MessageReactionKind): MessageReactionKind | null {
  return previous === pressed ? null : pressed
}

/** Total affiché sous une bulle — zéro signifie « aucune pastille ». */
export function totalMessageReactions(counts: MessageReactionCounts | undefined): number {
  if (!counts) return 0
  let total = 0
  for (const kind of MESSAGE_REACTION_KINDS) total += Math.max(0, counts[kind] ?? 0)
  return total
}
