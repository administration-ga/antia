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

export default crons
