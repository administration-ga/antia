import { defineSchema } from "convex/server"

import { diasporaTables } from "./modules/diaspora/tables"
import { engagementTables } from "./modules/engagement/tables"
import { networksTables } from "./modules/networks/tables"
import { peopleTables } from "./modules/people/tables"
import { platformTables } from "./modules/platform/tables"
import { postsTables } from "./modules/posts/tables"

/**
 * Schéma du moteur social national ANTIA — agrégat des tranches verticales
 * (`convex/modules/<module>/tables.ts`).
 *
 * Fondations multi-réseaux (PA2) d'abord : réseaux, personnes, liens
 * d'identité, adhésions, facettes, consentements, opérateurs. Les modules
 * dupliqués du socle (PA3) s'y ajoutent, chacun avec `networkId`. Les
 * tranches d'application (`NETWORK_SLICES` : `modules/diaspora`, écrite par la
 * session DIASPORALE) aussi.
 *
 * `schemaValidation: true` est NON NÉGOCIABLE (le socle l'a désactivée, ce qui
 * laissait les validateurs de tables sans effet à l'exécution — annexe A §0.4).
 * Fichier partagé avec la session DIASPORALE : modifié par la session ANTIA
 * seulement, sur demande.
 */
export default defineSchema(
  {
    ...networksTables,
    ...peopleTables,
    ...platformTables,
    ...postsTables,
    ...engagementTables,
    ...diasporaTables,
  },
  { schemaValidation: true },
)
