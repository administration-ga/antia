// Dupliqué de socle/packages/agent-features/src/features/iappel/dnd-presets.ts @ ad2e7fdc2 — adaptations : portée du silence retirée (`DndScope`, `DND_SCOPE_OPTIONS` — option « Appels poste seulement » et type tiré d'un validateur Convex) : le « ne pas déranger » du moteur n'a pas de portée (`calls.preferences.setDnd({ until })`), tous les appels étant personnels ; borne de durée lue dans le contrat du moteur (`MAX_DND_DURATION_MS` de `@antsia/social-contracts/calls`) ; libellés des pastilles en CLÉS i18n (`labelKey`, clés `iappel:dndPresets.…`, traduites par l'écran) ; PA6 : demain à 08:00 est converti depuis le jour civil du fuseau personnel, paramètre facultatif pour le repli appareil ; les durées relatives restent absolues.
/**
 * Les PRESETS du « Ne pas déranger » — un seul vocabulaire pour toutes les
 * surfaces (réglages des appels, menu avatar).
 *
 * Extraits d'`AppelsTab` le 2026-09-01 : deux surfaces à presets différents
 * (30 min/1 h/2 h/demain/7 j ici, 15/60/240 min dans un autre sélecteur)
 * disaient deux produits. `computeUntil` est évalué AU CLIC, jamais à
 * l'affichage : une pilule visible depuis un moment ne doit pas poser un
 * `until` déjà périmé.
 *
 * Le libellé est une CLÉ de traduction qualifiée (`labelKey`) : l'écran la
 * traduit (`t(pill.labelKey)`).
 */

import { civilDateTimeMs, tomorrowCivilDate } from "@antsia/api/civil-date"
import { MAX_DND_DURATION_MS } from "@antsia/social-contracts/calls"

/** Demain 08:00 dans le fuseau du lecteur ; sans préférence, repli appareil. */
export function tomorrowAt8(now: number, timeZone?: string): number {
	return civilDateTimeMs(tomorrowCivilDate(now, timeZone), "08:00", timeZone)
}

export const DND_DURATION_PILLS: { labelKey: string; computeUntil: (timeZone?: string) => number }[] = [
	{ labelKey: "iappel:dndPresets.thirtyMinutes", computeUntil: () => Date.now() + 30 * 60 * 1000 },
	{ labelKey: "iappel:dndPresets.oneHour", computeUntil: () => Date.now() + 60 * 60 * 1000 },
	{ labelKey: "iappel:dndPresets.twoHours", computeUntil: () => Date.now() + 2 * 60 * 60 * 1000 },
	{ labelKey: "iappel:dndPresets.tomorrowMorning", computeUntil: (timeZone) => tomorrowAt8(Date.now(), timeZone) },
	{
		labelKey: "iappel:dndPresets.untilDisabled",
		// Le serveur refuse tout `until` à plus de MAX_DND_DURATION_MS (7 jours) :
		// ce bouton pose le plus long silence accepté, que la personne coupe
		// elle-même avec « Désactiver » — `setDnd` n'a pas de notion d'échéance
		// infinie.
		computeUntil: () => Date.now() + MAX_DND_DURATION_MS,
	},
]
