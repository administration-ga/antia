// Dupliqué de socle/packages/agent-features/src/features/notifications/notification-center-tabs.ts @ ad2e7fdc2 — adaptations : RÉÉCRIT pour UNE seule source (la cloche sociale du réseau) — onglets, onglet par défaut et addition des deux décomptes retirés avec l'onglet « Administration » (`CENTER_TABS`, `CenterTab`, `CenterTabDefinition`, `defaultCenterTab`, `combineUnread`, `combinedUnreadLabel`, `tabBadgeLabel`) ; `tabBadge` gardé et instruit de la LACUNE du décompte du moteur (`capped` de `notifications.bell.unreadCount`), plafond lu dans le domaine (`NOTIFICATION_UNREAD_CAP`) ; nom accessible du décompte traduit (`unreadLabel`, `t` en dernier paramètre, pluriels par `count`) ; texte d'un marquage refusé par le code du moteur (`readFailureText`).
/**
 * notification-center-tabs — ce que la cloche DIT de l'état de lecture : la
 * pastille, son nom accessible, et le refus d'un marquage.
 *
 * Une seule source depuis la duplication : la cloche sociale du réseau
 * (`notifications.bell`). Le serveur compte les non-lues JUSQU'AU plafond du
 * domaine (`NOTIFICATION_UNREAD_CAP`, 99) et dit, par `capped`, qu'il en reste
 * au-delà : la pastille affiche alors « 99+ », et son nom dit « plus de 99 ».
 * Sans `capped`, 99 est un nombre EXACT et s'affiche tel quel.
 *
 * ⚠️ Pas `formatUnreadBadge` de `reseau-personnel/shared` : il écrit « 99+ »
 * dès 99, un plancher présenté là où le décompte est exact.
 *
 * Module PUR : ce qui se décide ici se vérifie en environnement `node`. Les
 * phrases viennent des locales (`notifications:notificationCenterTabs.…`), par
 * le `t` reçu en dernier paramètre.
 */

import { engineErrorCode } from "@antsia/social-contracts/errors"
import { NOTIFICATION_UNREAD_CAP } from "@antsia/social-domain/notifications"
import type { TFunction } from "i18next"

/** Le décompte tel que le moteur le rend (`notifications.bell.unreadCount`). */
export interface UnreadCount {
	/** Les non-lues comptées, au plus `NOTIFICATION_UNREAD_CAP`. */
	count: number
	/** `true` : il y en a AU-DELÀ du plafond — le décompte est un plancher. */
	capped: boolean
}

/** Au-delà, la pastille dit « 99+ » : le plafond du serveur, lu et non recopié. */
const BADGE_CAP = NOTIFICATION_UNREAD_CAP

/**
 * Un décompte connu, ou `undefined` quand il ne l'est pas (encore chargé, ou
 * valeur aberrante). Négatif vaut zéro ; une fraction se tronque.
 */
function knownCount(count: number | undefined): number | undefined {
	if (typeof count !== "number" || !Number.isFinite(count)) return undefined
	return count > 0 ? Math.floor(count) : 0
}

/**
 * La pastille : « 1 »…« 99 », « 99+ » quand le serveur dit qu'il en reste au-delà
 * (ou qu'un décompte dépasse le plafond) ; `null` quand il n'y a rien à signaler
 * (zéro, ou décompte pas encore connu) — une cloche sans nouveauté ne porte pas
 * de pastille.
 */
export function tabBadge(count: number | undefined, capped = false): string | null {
	const value = knownCount(count)
	if (value === undefined || value === 0) return null
	return capped || value > BADGE_CAP ? `${BADGE_CAP}+` : String(value)
}

/**
 * Le nombre tel qu'on l'ANNONCE : ce que dit la pastille, en mots. Au-delà du
 * plafond, « plus de 99 » — un libellé qui annoncerait « 100 » affirmerait un
 * total que le serveur n'a pas compté.
 */
export function unreadLabel(count: number | undefined, capped: boolean, t: TFunction): string | null {
	const value = knownCount(count)
	if (value === undefined || value === 0) return null
	if (capped || value > BADGE_CAP) {
		return t("notifications:notificationCenterTabs.unreadCapped", { count: BADGE_CAP })
	}
	return t("notifications:notificationCenterTabs.unread", { count: value })
}

/**
 * Ce qu'on DIT d'un marquage refusé. Le moteur rend un CODE (`rateLimited`,
 * `notFound`…), traduit par l'espace `errors` ; faute de code reconnu (panne
 * réseau), la phrase générique. Jamais `error.message` : Convex y verse la
 * trace serveur en développement.
 */
export function readFailureText(error: unknown, t: TFunction): string {
	const code = engineErrorCode(error)
	if (code !== null) return t(`errors:${code}`)
	return t("notifications:notificationCenterTabs.markFailed")
}
