// Dupliqué de socle/packages/agent-features/src/features/iappel/call-line-sync.ts @ ad2e7fdc2 — adaptations : exclusion de la file du centre d'appels retirée (champ `kind` de `LineSlotView` — tous les slots du moteur sont des appels directs) ; mutations nommées comme dans le moteur (`calls.ringing.hold` / `resume`, refus de groupe `CALL_GROUP_NO_HOLD`).
/**
 * call-line-sync — remettre le SERVEUR d'accord avec l'écran.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * LE DÉFAUT QUE CE MODULE CORRIGE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Décrocher un second appel parquait le premier — mais CÔTÉ CLIENT SEULEMENT.
 * `callStore.acceptIncoming` appelle `parkBusySlot`, et rien n'en informait le
 * serveur : ni `calls.ringing.hold`, ni quoi que ce soit. Le serveur gardait
 * l'appel en `connected`.
 *
 * La suite se déroulait toute seule. Vouloir revenir sur l'appel parqué
 * appelait `resume`, que le serveur refusait — il exigeait `on_hold`. Le
 * `catch` « correcteur » de l'appelant reparquait alors le slot côté client,
 * ce qui blanchissait `activeSlotId`, ce qui faisait tomber `frontSlot` à
 * `null`, ce qui faisait **disparaître la surface d'appel entière** pendant
 * que les deux conversations LiveKit vivaient toujours dans le pool. Plus rien
 * à l'écran, et aucun moyen de décrocher quoi que ce soit.
 *
 * ── Pourquoi un réconciliateur, et pas un appel dans `answer` ──────────────
 * Parce que CINQ chemins parquent un appel : `acceptIncoming`, `upsertSlot`
 * en `active`, `resumeSlot`, `openOutgoingCall`, et la promotion de survivant
 * de `removeSlot` / `markSlotEnded`. Câbler le geste de décrochage réparerait
 * un cinquième du défaut et laisserait les quatre autres dériver en silence.
 * Un réconciliateur les couvre par construction : il ne regarde pas ce qui
 * vient de se passer, il regarde l'état voulu.
 *
 * ── Ce que ce module N'EST PAS ────────────────────────────────────────────
 * Il ne décide RIEN de l'écran. Il traduit un état de magasin en une liste
 * d'opérations serveur, et c'est tout. Le hook qui l'applique
 * (`use-call-line-sync.ts`) n'écrit JAMAIS dans le magasin : un écran ne se
 * réorganise pas sur une réponse réseau — c'est précisément cette règle qui
 * manquait.
 *
 * Aucun import React, aucun import Convex : module pur, testable en `node`.
 */

import type { CallKind } from "./call-types"

/** L'état de ligne voulu pour un appel, du point de vue du serveur. */
export type LineWant = "connected" | "on_hold"

/** Ce que le réconciliateur a besoin de savoir d'un slot — et rien de plus. */
export interface LineSlotView {
	meetingId: string
	status: "incoming" | "connecting" | "active" | "held" | "ended"
	/**
	 * `direct` ou `group`. Un appel de GROUPE n'a pas de ligne à piloter : le
	 * serveur le refuse (`CALL_GROUP_NO_HOLD`), et « mettre en attente » n'a
	 * pas de sens à N. Absent = tête-à-tête.
	 */
	callKind?: CallKind
	/** La salle est-elle négociée ? Sans jeton, le meeting n'est pas rejoint. */
	hasToken: boolean
}

/**
 * Ce que le SERVEUR a réellement fait d'une opération de ligne — ce qui peut
 * être acquitté, et ce qui doit être rejoué.
 *
 * ⚠️ Le défaut du 2026-09-22 : `hold` sur un appel pas encore `connected`
 * rendait `{ noop: true, deferred: true }`, que le hook acquittait comme un
 * succès. L'opération ne repartait jamais, et la base restait `ringing` —
 * « mettre en attente » n'atteignait pas le serveur, une fois sur deux.
 *
 * Depuis, le serveur sait DIFFÉRER l'attente jusqu'au décrochage
 * (`holdOnAnswer`) : ce cas-là s'acquitte, puisqu'il aboutira tout seul. Seul
 * un différé SANS promesse (`deferred` sans `holdOnAnswer`) doit être rejoué.
 */
export function lineAckFor(
	op: "hold" | "resume",
	result: { noop?: boolean; deferred?: boolean; holdOnAnswer?: boolean },
): LineWant | null {
	if (op === "hold") {
		// Différé sans promesse de reprise au décrochage : rien n'a été retenu
		// côté serveur, l'opération se rejoue (dans la limite des essais).
		if (result.deferred === true && result.holdOnAnswer !== true) return null
		return "on_hold"
	}
	// La reprise n'a pas de différé à rejouer : annuler une attente qui n'a
	// pas encore pris est précisément ce que le serveur fait alors.
	return "connected"
}

/** Une opération à envoyer au serveur. */
export interface LineSyncOp {
	meetingId: string
	op: "hold" | "resume"
}

export interface LineSyncInput {
	slots: readonly LineSlotView[]
	activeSlotId: string | null
}

/**
 * L'état de ligne VOULU, par appel.
 *
 * Quatre exclusions, chacune pour une raison précise :
 *
 *  · `callKind: "group"` — un appel de groupe ne se met pas en attente, des
 *    deux côtés : le serveur refuse `hold` sur lui, et le pousser dans le plan
 *    ferait trois essais perdus par appel à plusieurs ;
 *  · `ended` — il n'y a plus de ligne à piloter ;
 *  · `incoming` — l'appel sonne, on ne l'a pas rejoint ;
 *  · sans jeton — le meeting n'est pas rejoint côté serveur, qui refuserait.
 *    L'appel rentre au plan dès que le jeton arrive, sans geste particulier :
 *    c'est tout l'intérêt de réconcilier plutôt que de réagir.
 *
 * Un `connecting` qui n'est PAS l'actif se veut parqué : c'est le cas d'un
 * appel sortant en sonnerie quand on décroche un entrant. Le magasin le parque
 * déjà (décision documentée dans `parkBusySlot`), et le serveur répondra
 * « différé » tant que la salle n'est pas là — ce qui est le bon dialogue.
 */
export function desiredLineState(input: LineSyncInput): Map<string, LineWant> {
	const wanted = new Map<string, LineWant>()
	for (const slot of input.slots) {
		if ((slot.callKind ?? "direct") === "group") continue
		if (slot.status === "ended" || slot.status === "incoming") continue
		if (!slot.hasToken) continue

		if (slot.status === "held") {
			wanted.set(slot.meetingId, "on_hold")
			continue
		}
		wanted.set(
			slot.meetingId,
			slot.meetingId === input.activeSlotId ? "connected" : "on_hold",
		)
	}
	return wanted
}

/**
 * Les opérations à envoyer, dans l'ORDRE où elles doivent partir.
 *
 * ⚠️ Tous les `hold` avant tous les `resume`, et ce n'est pas une préférence.
 * L'invariant « au plus un appel audible » ne doit jamais être faux du point
 * de vue du serveur, et le correspondant que l'on parque doit cesser
 * d'entendre AVANT que l'autre ne revienne. L'ordre inverse ouvre une fenêtre
 * — courte, mais réelle — pendant laquelle deux personnes entendent la même
 * conversation.
 *
 * `acknowledged` est ce que le serveur a déjà confirmé : une opération n'est
 * proposée que si l'état voulu a changé. Le plan est donc vide au repos, et
 * rejouable sans dommage.
 */
export function planLineSync(input: {
	slots: readonly LineSlotView[]
	activeSlotId: string | null
	acknowledged: ReadonlyMap<string, LineWant>
}): LineSyncOp[] {
	const wanted = desiredLineState(input)
	const holds: LineSyncOp[] = []
	const resumes: LineSyncOp[] = []

	for (const [meetingId, want] of wanted) {
		if (input.acknowledged.get(meetingId) === want) continue
		if (want === "on_hold") holds.push({ meetingId, op: "hold" })
		else resumes.push({ meetingId, op: "resume" })
	}

	return [...holds, ...resumes]
}

/**
 * Les appels disparus du magasin — leur accusé n'a plus lieu d'être gardé.
 *
 * Sans cette purge, un appel raccroché puis rappelé (même `meetingId` sur un
 * rappel immédiat) hériterait de l'accusé du précédent et l'opération ne
 * partirait jamais.
 */
export function forgottenLines(
	slots: readonly LineSlotView[],
	acknowledged: ReadonlyMap<string, LineWant>,
): string[] {
	const vivants = new Set(slots.map((s) => s.meetingId))
	const oubliables: string[] = []
	for (const meetingId of acknowledged.keys()) {
		if (!vivants.has(meetingId)) oubliables.push(meetingId)
	}
	return oubliables
}

/**
 * Les appels qui NAISSENT connectés — leur accusé initial, sans rien envoyer.
 *
 * ⚠️ Constaté le 2026-09-13 : chaque appel SORTANT produisait trois erreurs
 * `calls:resume` « Cet appel n'est pas en attente ». Un slot neuf n'a aucun
 * accusé ; il se veut `connected` (c'est l'actif) ; `planLineSync` proposait
 * donc `resume` — et le serveur, qui n'accepte la reprise que d'un appel
 * `on_hold` (il tolère `connected`, pas `ringing`), refusait jusqu'à
 * l'abandon. Or une ligne est connectée À LA NAISSANCE : la reprise n'a de
 * sens qu'après une mise en attente ACQUITTÉE. On sème donc `connected` pour
 * tout slot vivant, direct, muni d'un jeton et non parqué, qui n'a pas encore
 * d'accusé. Un slot qui naît PARQUÉ (parqué par `acceptIncoming` avant
 * d'avoir jamais été synchronisé) garde son `hold` à envoyer.
 */
export function seedConnectedLines(
	slots: readonly LineSlotView[],
	acknowledged: ReadonlyMap<string, LineWant>,
): string[] {
	const naissants: string[] = []
	for (const slot of slots) {
		if ((slot.callKind ?? "direct") === "group") continue
		if (slot.status === "ended" || slot.status === "incoming" || slot.status === "held") continue
		if (!slot.hasToken) continue
		if (acknowledged.has(slot.meetingId)) continue
		naissants.push(slot.meetingId)
	}
	return naissants
}
