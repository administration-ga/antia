/**
 * Tâches planifiées du moteur.
 *
 * Chaque tâche est un passage BORNÉ qui se poursuit par chaîne paginée
 * (jamais un balayage complet dans une transaction). Les passages des modules
 * dupliqués du socle (saisie, stories, présence, appels, direct, fichiers)
 * s'ajoutent ici avec leur module (owner map `docs/02` §4.2, lot 17).
 */
import { cronJobs } from "convex/server"

import { internal } from "./_generated/api"

const crons = cronJobs()

// Tranche DIASPORALE (session DIASPORALE, PD1) : compteurs matérialisés des hubs
// pays. Sans réseau `diasporale` gouverné par la tranche, le passage ne fait rien.
crons.daily("compteurs des hubs DIASPORALE", { hourUTC: 2, minuteUTC: 30 }, internal.modules.diaspora.hubs.refreshHubCounters, {})

// Garde des fichiers : relance des analyses perdues (job tombé, redéploiement),
// et purge des fichiers infectés au-delà de la rétention (la ligne reste).
// Identifiants en ASCII : Convex refuse tout autre caractère (`é` compris).
crons.interval("files-retry-stale-scans", { minutes: 5 }, internal.modules.files.mutations.retryStale, {})
crons.daily("files-purge-infected-blobs", { hourUTC: 3, minuteUTC: 15 }, internal.modules.files.mutations.purgeQuarantinedBlobs, {})

// Messagerie : purge des signaux « en train d'écrire » expirés (la lecture les
// écarte déjà ; le passage ne fait que vider la table).
crons.interval("messaging-purge-expired-typing", { minutes: 1 }, internal.modules.messaging.typing.purgeExpiredTyping, {})
crons.interval("groups-purge-expired-typing", { minutes: 1 }, internal.modules.groups.typing.purgeExpiredGroupTyping, {})

// Stories : la ligne, ses vues, son blob ET sa ligne d'analyse disparaissent à l'expiration.
crons.interval("stories-purge-expired", { minutes: 10 }, internal.modules.stories.stories.purgeExpired, {})

// Appels : les appels périmés (composés sans suite, sonneries sans réponse, salles
// vidées par un onglet fermé, fantômes) se closent ; les présences dont le battement
// s'est tu passent hors ligne. Lectures indexées, poursuivies par chaîne.
crons.interval("calls-cleanup-stale", { seconds: 30 }, internal.modules.calls.cleanup.cleanupStaleCalls, {})
crons.interval("calls-presence-cleanup-stale", { seconds: 60 }, internal.modules.calls.presence.cleanupStalePresence, {})

// Direct (`live`, socle `crons.ts` l. 264-296) : la RÉCOLTE ferme les sessions
// programmées jamais démarrées (24 h) et les directs fantômes (4 h, hôte parti
// sans terminer), arrête leur Egress et recompose les compteurs de salle —
// l'écrivain unique (D28), le chemin chaud n'écrit jamais la session.
crons.interval("live-reap-stale", { seconds: 60 }, internal.modules.live.reap.reapStaleDirects, {})
// Filet de la conservation des rediffusions : l'échéance exacte est planifiée à
// la livraison Egress, ce passage horaire récupère les jobs manqués et
// matérialise l'échéance des rediffusions qui n'en ont pas, par lots de 50.
crons.interval("live-purge-expired-replays", { hours: 1 }, internal.modules.live.replay.purgeExpiredReplays, {})
// Le filet des webhooks : une terminaison reçue AVANT la corrélation est
// absorbée et rien ne la rejoue — ce passage reprend les sessions terminées dont
// la rediffusion n'a pas abouti, demande son sort à LiveKit et conclut
// (fichier rapatrié, échec nommé, ou abandon motivé après 24 h).
crons.interval("live-reconcile-replays", { minutes: 15 }, internal.modules.live.replay.reconcileStalePending, {})

// PA5 — bornes, reprises et absence de contenu dans les notifications.
crons.interval("moderation-expire-sanctions", { minutes: 5 }, internal.modules.moderation.maintenance.expireSanctions, {})
crons.daily("moderation-aggregate-transparency", { hourUTC: 4, minuteUTC: 10 }, internal.modules.moderation.maintenance.aggregateTransparency, {})
crons.interval("notifications-drain-deliveries", { seconds: 30 }, internal.modules.notifications.deliveries.drain, {})
crons.daily("notifications-reserve-digests", { hourUTC: 7, minuteUTC: 0 }, internal.modules.notifications.deliveries.reserveDigests, {})
crons.daily("notifications-retention-active", { hourUTC: 3, minuteUTC: 45 }, internal.modules.notifications.retention.run, {})
crons.interval("data-resume-erasure", { minutes: 15 }, internal.modules.people.erasure.resumeDueErasures, {})
crons.daily("data-purge-export-receipts", { hourUTC: 4, minuteUTC: 30 }, internal.modules.people.erasure.purgeExpiredExports, {})
// PA7 : la lecture ferme immédiatement les preuves expirées ; rétention par lots de 100.
crons.daily("operators-purge-expired-idn-proofs", { hourUTC: 3, minuteUTC: 55 }, internal.modules.platform.operatorAccess.purgeExpiredProofs, {})

// PA8 : mesures publiques par générations et tranches bornées, sans identités.
crons.interval("public-refresh-aggregates", { minutes: 15 }, internal.modules.public.aggregate.refresh, {})

export default crons
