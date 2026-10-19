// Dupliqué de socle/packages/agent-features/src/features/messagerie/messagerie-erreur.ts @ ad2e7fdc2 — adaptations : le moteur rend des CODES, jamais des phrases — le texte vient de la règle du domaine enfreinte (`engineErrorRule`, espace `rules`, bornes en paramètres), sinon du code (`engineErrorCode`, espace `errors`), sinon de la phrase générique de l'espace `messagerie` ; `t` reçu en dernier paramètre (clés qualifiées) ; la constante `REFUS_GENERIQUE` (phrase française) devient la clé `REFUS_GENERIQUE_KEY`.
/**
 * messagerie-erreur — le texte d'un refus, tel qu'on peut le MONTRER.
 *
 * ⚠️ Ne jamais afficher `error.message` : Convex y verse la trace serveur en
 * développement — constaté au socle le 2026-08-12 en tentant d'écrire à un
 * identifiant inconnu :
 *
 *     [CONVEX M(modules/…:startThreadWithHandle)] [Request ID: …] Server Error
 *     Uncaught ConvexError: …
 *         at error (../../convex/lib/errors.ts:158:0)
 *         …
 *
 * Et en production, « Server Error », qui ne dit rien.
 *
 * Le moteur ne compose plus la phrase : il lève une `ConvexError` dont la
 * charge porte un CODE (`notFound`, `rateLimited`…) et, pour une règle du
 * domaine, son nom et ses bornes. Ce module lit l'un ou l'autre et le fait
 * traduire ; faute de charge reconnue, une phrase neutre de la messagerie.
 *
 * Duck-typing volontaire, jamais `instanceof ConvexError` : deux copies du
 * paquet `convex` peuvent coexister, et l'instanceof serait faux sur une
 * erreur construite par l'autre copie (les lecteurs du contrat lisent `data`).
 */

import { engineErrorCode, engineErrorRule } from "@antsia/social-contracts/errors"
import type { TFunction } from "i18next"

/** La phrase neutre, quand le refus ne porte aucun code reconnu. */
export const REFUS_GENERIQUE_KEY = "messagerie:messagerieErreur.generic"

/** Une phrase montrable, jamais une trace. */
export function messageErreurLisible(err: unknown, t: TFunction): string {
	const regle = engineErrorRule(err)
	if (regle !== null) return t(`rules:${regle.rule}`, regle.params)

	const code = engineErrorCode(err)
	if (code !== null) return t(`errors:${code}`)

	return t(REFUS_GENERIQUE_KEY)
}
