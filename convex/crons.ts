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

export default crons
