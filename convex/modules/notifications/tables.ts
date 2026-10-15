// Dupliqué de socle/convex/modules/reseauPersonnel/tables.ts (l. 391-455, `reseauPersonnel_notifications`) @ ad2e7fdc2 — adaptations : UNE seule table `notifications` du moteur (le centre administratif `functions/notifications.ts` est exclu) ; `networkId` et personnes ; acteur facultatif (avis du système) ; sujets typés ajoutés avec leur module (publication, connexion, analyse de fichier, groupe thématique, conversation de groupe) ; non-lus indexés jusqu'à la date (`markAllRead` sans `.filter()`) ; index de rétention reportés avec la rétention (PA5, D30).
/**
 * La cloche sociale d'un réseau : le RÉSIDU d'un geste social (quelqu'un a
 * réagi, commenté, demandé une connexion), jamais un contenu. Le sujet est une
 * RÉFÉRENCE, relue avec sa garde à l'ouverture. Dédoublonnage par `dedupKey`
 * (`genre|sujet|acteur`). Écrite par la porte unique `notify.ts` seulement.
 */
import { NOTIFICATION_KINDS, NOTIFICATION_RESOLUTIONS } from "@antia/social-domain/notifications"
import { defineTable } from "convex/server"
import { v } from "convex/values"

import { literals } from "../../lib/validators"

export const notificationKindValidator = literals(NOTIFICATION_KINDS)

export const notificationResolutionValidator = literals(NOTIFICATION_RESOLUTIONS)

/** Le sujet d'une notification, tel que l'émetteur le désigne : une référence typée. */
export const notificationSubjectValidator = v.union(
  v.object({ post: v.id("posts") }),
  v.object({ connection: v.id("connections") }),
  v.object({ fileScan: v.id("fileScans") }),
  v.object({ thematicGroup: v.id("thematicGroups") }),
  v.object({ groupThread: v.id("groupThreads") }),
)

export const notificationsTables = {
  notifications: defineTable({
    networkId: v.id("networks"),
    recipientPersonId: v.id("persons"),
    /** L'auteur du geste ; absent pour un avis du système (garde des fichiers). */
    actorPersonId: v.optional(v.id("persons")),
    kind: notificationKindValidator,
    /** Ce que la notification DÉSIGNE — jamais ce qu'elle contient. */
    subjectPostId: v.optional(v.id("posts")),
    subjectConnectionId: v.optional(v.id("connections")),
    subjectFileScanId: v.optional(v.id("fileScans")),
    subjectThematicGroupId: v.optional(v.id("thematicGroups")),
    subjectGroupThreadId: v.optional(v.id("groupThreads")),
    dedupKey: v.string(),
    createdAt: v.number(),
    readAt: v.optional(v.number()),
    /** Résolution d'une notification actionnable, posée par le serveur ; une ligne résolue est lue d'office. */
    resolvedAt: v.optional(v.number()),
    resolution: v.optional(notificationResolutionValidator),
  })
    .index("by_network_recipient_createdAt", ["networkId", "recipientPersonId", "createdAt"])
    .index("by_network_recipient_readAt_createdAt", ["networkId", "recipientPersonId", "readAt", "createdAt"])
    .index("by_network_recipient_dedupKey", ["networkId", "recipientPersonId", "dedupKey"]),
}
