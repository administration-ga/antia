// Dupliqué de socle/convex/modules/reseauPersonnel/tables.ts (l. 391-455, `reseauPersonnel_notifications`) @ ad2e7fdc2 — adaptations : UNE cloche sociale réseau/personne, références seules ; index de lecture et rétention active PA5 ; préférences par catégorie, abonnements quatre fournisseurs et file de livraison sans contenu, budgets hebdomadaires et reçus de digest.
/**
 * La cloche sociale d'un réseau : le RÉSIDU d'un geste social (quelqu'un a
 * réagi, commenté, demandé une connexion), jamais un contenu. Le sujet est une
 * RÉFÉRENCE, relue avec sa garde à l'ouverture. Dédoublonnage par `dedupKey`
 * (`genre|sujet|acteur`). Écrite par la porte unique `notify.ts` seulement.
 */
import { NOTIFICATION_KINDS, NOTIFICATION_RESOLUTIONS } from "@antsia/social-domain/notifications"
import { NOTIFICATION_CATEGORIES, PUSH_PROVIDERS } from "@antsia/social-domain/notificationDelivery"
import { defineTable } from "convex/server"
import { v } from "convex/values"

import { literals } from "../../lib/validators"

export const notificationKindValidator = literals(NOTIFICATION_KINDS)

export const notificationResolutionValidator = literals(NOTIFICATION_RESOLUTIONS)
export const notificationCategoryValidator = literals(NOTIFICATION_CATEGORIES)
export const pushProviderValidator = literals(PUSH_PROVIDERS)
export const notificationCategorySettingsValidator = v.object({ social: v.boolean(), messages: v.boolean(), calls: v.boolean(), network: v.boolean(), moderation: v.boolean(), files: v.boolean() })
export const pushCredentialValidator = v.union(
  v.object({ provider: v.literal("web"), endpoint: v.string(), keys: v.object({ p256dh: v.string(), auth: v.string() }) }),
  v.object({ provider: v.literal("expo"), token: v.string() }),
  v.object({ provider: v.literal("fcm"), token: v.string() }),
  v.object({ provider: v.literal("apns"), token: v.string() }),
)
export const deliveryStateValidator = v.union(v.literal("queued"), v.literal("delivering"), v.literal("accepted"), v.literal("sent"), v.literal("unavailable"), v.literal("failed"), v.literal("cancelled"))

/** Le sujet d'une notification, tel que l'émetteur le désigne : une référence typée. */
export const notificationSubjectValidator = v.union(
  v.object({ post: v.id("posts") }),
  v.object({ connection: v.id("connections") }),
  v.object({ fileScan: v.id("fileScans") }),
  v.object({ thematicGroup: v.id("thematicGroups") }),
  v.object({ groupThread: v.id("groupThreads") }),
  v.object({ event: v.id("events") }),
  v.object({ album: v.id("albums") }),
  v.object({ call: v.id("calls") }),
  v.object({ voicemail: v.id("voicemails") }),
  v.object({ liveSession: v.id("liveSessions") }),
  v.object({ report: v.id("reports") }),
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
    subjectEventId: v.optional(v.id("events")),
    subjectAlbumId: v.optional(v.id("albums")),
    subjectCallId: v.optional(v.id("calls")),
    subjectVoicemailId: v.optional(v.id("voicemails")),
    subjectLiveSessionId: v.optional(v.id("liveSessions")),
    subjectReportId: v.optional(v.id("reports")),
    dedupKey: v.string(),
    createdAt: v.number(),
    readAt: v.optional(v.number()),
    /** Résolution d'une notification actionnable, posée par le serveur ; une ligne résolue est lue d'office. */
    resolvedAt: v.optional(v.number()),
    resolution: v.optional(notificationResolutionValidator),
  })
    .index("by_network_recipient_createdAt", ["networkId", "recipientPersonId", "createdAt"])
    .index("by_network_recipient_readAt_createdAt", ["networkId", "recipientPersonId", "readAt", "createdAt"])
    .index("by_network_recipient_dedupKey", ["networkId", "recipientPersonId", "dedupKey"])
    .index("by_readAt_createdAt", ["readAt", "createdAt"]),

  notificationPreferences: defineTable({
    networkId: v.id("networks"), personId: v.id("persons"),
    pushCategories: notificationCategorySettingsValidator,
    digestCategories: notificationCategorySettingsValidator,
    emailDigest: v.boolean(), weeklyLimit: v.number(), updatedAt: v.number(),
  }).index("by_network_person", ["networkId", "personId"]),

  pushSubscriptions: defineTable({
    networkId: v.id("networks"), personId: v.id("persons"), applicationId: v.string(), deviceId: v.string(),
    provider: pushProviderValidator, credential: pushCredentialValidator,
    /** Empreinte stable du canal, jamais un endpoint réattribué à une autre personne. */
    credentialHash: v.string(), active: v.boolean(), createdAt: v.number(), updatedAt: v.number(),
    failureCount: v.number(),
    /** L’appareil ne reçoit rien après révocation de sa session PA4. */
    sessionId: v.optional(v.string()),
  })
    .index("by_provider_hash", ["provider", "credentialHash"])
    .index("by_network_person_active", ["networkId", "personId", "active"]),

  notificationWeeklyUsage: defineTable({
    networkId: v.id("networks"), personId: v.id("persons"), weekStart: v.number(), reserved: v.number(),
  }).index("by_network_person_week", ["networkId", "personId", "weekStart"])
    .index("by_week", ["weekStart"]),

  /** Aucune donnée de contenu ni de contact : une référence et un état de livraison. */
  notificationDeliveryJobs: defineTable({
    networkId: v.id("networks"), recipientPersonId: v.id("persons"), channel: v.union(v.literal("push"), v.literal("digest"), v.literal("call")),
    notificationId: v.optional(v.id("notifications")), callId: v.optional(v.id("calls")),
    subscriptionId: v.optional(v.id("pushSubscriptions")), applicationId: v.string(),
    category: notificationCategoryValidator, dedupKey: v.string(), weekStart: v.number(),
    state: deliveryStateValidator, attempts: v.number(), nextAttemptAt: v.number(),
    leaseUntil: v.optional(v.number()), leaseToken: v.optional(v.string()),
    /** Expo : reçu opaque ; « accepté » n'est pas « livré ». */
    providerReceiptId: v.optional(v.string()),
    resultCode: v.optional(v.union(v.literal("configuration"), v.literal("invalid_subscription"), v.literal("transport"), v.literal("policy"), v.literal("expired"))),
    createdAt: v.number(), updatedAt: v.number(),
  }).index("by_dedup", ["dedupKey"])
    .index("by_notification", ["notificationId"])
    .index("by_call_recipient", ["callId", "recipientPersonId"])
    .index("by_state_due", ["state", "nextAttemptAt"])
    .index("by_createdAt", ["createdAt"])
    .index("by_network_recipient", ["networkId", "recipientPersonId"]),

  notificationDigestReceipts: defineTable({
    networkId: v.id("networks"), personId: v.id("persons"), weekStart: v.number(),
    jobId: v.id("notificationDeliveryJobs"), createdAt: v.number(),
  }).index("by_network_person_week", ["networkId", "personId", "weekStart"])
    .index("by_createdAt", ["createdAt"]),
}
