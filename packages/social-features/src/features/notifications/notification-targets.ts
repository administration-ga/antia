// Dupliqué de socle/packages/agent-features/src/features/notifications/notification-targets.ts @ ad2e7fdc2 — adaptations : plus aucune adresse écrite — la cible se compose sur les adresses INJECTÉES de l'application (`NotificationRoutes`, tirées de `useRoutes()` : page réseau `home()` et ses paramètres de vue de `reseau-agent-nav`, messagerie `messages()` par `conversationHref`, journal iAppel par `icomMobileTabHref`, profil `profile(handle)` et albums d'un profil composés dessus, conférence `conference(sessionId)`) ; `reseauBaseHref` retiré (la page réseau du moteur est toujours l'accueil, la publication n'est plus masquée) ; sujet du moteur en forme générique `{ kind, id }` au lieu des colonnes `subject…Id`, aiguillé par un `switch` exhaustif sur les natures du domaine ; cible « direct » (démarrage, invitations, rediffusion publiée) composée sur l'adresse INJECTÉE de la conférence (`conference(sessionId)`) pour le sujet `liveSession` du moteur au lieu de `subjectDirectSessionId` et d'une adresse de l'espace, avec son rappel `onOpenDirect` ; cibles ajoutées pour les sujets du moteur (album d'un profil, appel et message vocal vers le journal iAppel ; analyse de fichier sans cible) et profil du parrain pour `sponsorship_received` ; état d'invitation du domaine (`@antsia/social-domain/connectionState`) ; libellés et phrases traduits (`t` en DERNIER paramètre de `notificationTarget`, `notificationRowAction`, `connectionInviteOutcome` ; clés qualifiées `notifications:notificationTargets.…`) ; ajouts : `notificationRowSentence` (phrase de TOUS les genres du moteur — ceux de `shared.notificationSentence` et, ici, page suivie, album, fichier retenu, appel manqué, message vocal, parrainages et attestations de DIASPORALE ; nom neutre quand le profil n'est pas publié), `notificationRowNote` (résultat d'une invitation, statut vivant d'un fichier retenu) et `targetCallback`.
/**
 * notification-targets — CE QU'OUVRE une ligne de notification, par où, et ce
 * qu'elle DIT.
 *
 * La cloche vit dans la COQUE, pas seulement dans la page réseau : elle n'a
 * donc pas de parent capable de « changer de volet ». La cible se résout par
 * adresse, ici, dans un module PUR — ce qui reste dans le corps d'un composant
 * n'est vérifiable qu'à l'œil.
 *
 * ⚠️ AUCUNE adresse n'est écrite ici : seule l'application sait ses URL. Les
 * fabriques reçoivent les adresses de `useRoutes()` (`NotificationRoutes`) et
 * n'y ajoutent que des paramètres de VUE, dont le contrat vit chez leurs
 * propriétaires (`reseau-agent-nav`, `messagerie-routes`, `icom-mobile-tabs`).
 * La PUBLICATION n'est pas une route : `?post=` est un paramètre que la page
 * réseau consomme (`RESEAU_AGENT_POST_PARAM`).
 *
 * ⚠️ La ligne ne dit jamais le CONTENU du sujet : le serveur ne l'a pas
 * donné (le DTO ne porte que le genre, l'acteur et une référence). Ce module
 * ne fabrique que des adresses et des phrases de GENRE.
 */

import type { ConnectionInviteState } from "@antsia/social-domain/connectionState"
import type { FileScanStatus } from "@antsia/social-domain/filePolicy"
import { isServableStatus } from "@antsia/social-domain/filePolicy"
import type { NotificationKind, NotificationSubject, NotificationSubjectKind } from "@antsia/social-domain/notifications"
import type { TFunction } from "i18next"

import { RESEAU_AGENT_POST_PARAM, reseauAgentGroupeHref, reseauAgentHref } from "../../shell/reseau-agent-nav"
import { icomMobileTabHref } from "../messagerie/icom-mobile-tabs"
import { groupeKey } from "../messagerie/messagerie-dock"
import { conversationHref } from "../messagerie/messagerie-routes"
import { NOTIFICATION_SENTENCE_KINDS, notificationSentence, type NotificationSentenceKind, resolutionSentence } from "../reseau-personnel/shared"

export type { ConnectionInviteState } from "@antsia/social-domain/connectionState"

/** Les natures de cible qu'une notification peut désigner. */
export type NotificationTargetKind =
	| "post"
	| "groupThread"
	| "group"
	| "event"
	| "connection"
	| "profile"
	/** L'album d'un profil — l'auteur de la notification en est le propriétaire. */
	| "album"
	/** Le journal iAppel : appel manqué, message vocal. */
	| "calls"
	/** Une conférence en direct — ou sa rediffusion : la SESSION, relue avec sa garde. */
	| "direct"

export interface NotificationTargetRef {
	kind: NotificationTargetKind
	/** L'identifiant du sujet tel que le serveur l'a rendu (le `@handle` pour un profil). */
	id: string
	/** L'adresse à ouvrir quand l'hôte ne fournit aucun rappel. */
	href: string
	/** Le libellé du geste — « Ouvrir » ne convient pas à un profil. */
	label: string
}

/**
 * Les adresses de l'application qu'une cible compose — `useRoutes()` s'y
 * passe tel quel (la table du moteur porte ces quatre entrées, et d'autres).
 */
export interface NotificationRoutes {
	/** La page réseau : l'accueil, le fil et ses volets. */
	home: () => string
	/** La base de la messagerie (iCom en pages). */
	messages: () => string
	/** Le profil d'une personne, par son identifiant public. */
	profile: (handle: string) => string
	/** La page d'une conférence en direct (et de sa rediffusion), par sa session. */
	conference: (sessionId: string) => string
}

/**
 * La forme MINIMALE d'une notification vue d'ici. Structurelle : le DTO du
 * moteur (`notifications.bell.paginateNotifications`) s'y passe tel quel, et ce
 * module se teste en `node` sans charger l'API.
 */
export interface NotificationTargetInput {
	/** Une chaîne et non le genre du domaine : un serveur en avance peut servir un genre inconnu d'ici. */
	kind: string
	/** Ce que la notification DÉSIGNE (`{ kind, id }`), ou `null`. */
	subject?: NotificationSubject | null
	actor?: { handle?: string | null } | null
	/**
	 * Ce que l'invitation est DEVENUE, posé par le serveur dans la transaction
	 * qui tranche. `undefined` vaut `null` — rien n'a été tranché.
	 */
	resolution?: { kind: string; at: number } | null
	/**
	 * `connection_request` seulement : l'état VIVANT de la connexion, relu
	 * par le serveur à chaque page (même forme que `graph.connections.pendingState`).
	 * `undefined` vaut `null` — aucun état connu, la ligne relira au clic.
	 */
	inviteState?: ConnectionInviteState | null
}

/**
 * Ce que l'HÔTE de la liste sait faire sur place. Les rappels sont
 * facultatifs : une page qui monte la liste peut changer de vue à moindre coût
 * qu'une navigation ; la cloche n'en fournit aucun et la liste tombe sur les
 * adresses.
 */
export interface NotificationTargets {
	onOpenPost?: (postId: string) => void
	onOpenGroupThread?: (threadId: string) => void
	onOpenDirect?: (sessionId: string) => void
	onOpenGroup?: (groupId: string) => void
	onOpenPersonalEvent?: (eventId: string) => void
	/** Ouvrir l'invitation de relation désignée (le volet Relations). */
	onOpenConnection?: (connectionId: string) => void
	/** Ouvrir le profil public de l'acteur, par son `@handle`. */
	onOpenProfile?: (handle: string) => void
}

const OPEN_LABEL = "notifications:notificationTargets.open"
const PROFILE_LABEL = "notifications:notificationTargets.viewProfile"
const CONNECTION_LABEL = "notifications:notificationTargets.respond"
/** Une invitation qui n'appelle plus de réponse, sans plus de précision. */
const INVITE_ALREADY_HANDLED = "notifications:notificationTargets.inviteAlreadyHandled"
const INVITE_CANCELLED = "notifications:notificationTargets.inviteCancelled"
/** Le nom d'un acteur sans profil publié : un libellé neutre, jamais une devinette. */
const UNKNOWN_ACTOR = "notifications:notificationTargets.unknownActor"
/** La phrase d'un genre que ce client ne connaît pas encore. */
const OTHER_SENTENCE = "notifications:notificationTargets.sentence.other"

/**
 * Les genres RELATIONNELS qui mènent à une PERSONNE : le profil de l'acteur.
 * `connection_accepted` porte aussi une connexion, mais il n'y a plus rien à y
 * décider — le genre tranche.
 */
const PROFILE_KINDS: readonly string[] = Object.freeze(["connection_accepted", "new_follower", "sponsorship_received"])

function clean(value: string | null | undefined): string | null {
	if (typeof value !== "string") return null
	const trimmed = value.trim()
	return trimmed.length === 0 ? null : trimmed
}

/**
 * Ajoute un paramètre de VUE à une base injectée — après sa propre query si
 * elle en porte une, et avant son ancre (même règle que `reseau-agent-nav`).
 */
function withQuery(base: string, query: string): string {
	const hashAt = base.indexOf("#")
	const path = hashAt === -1 ? base : base.slice(0, hashAt)
	const hash = hashAt === -1 ? "" : base.slice(hashAt)
	return `${path}${path.includes("?") ? "&" : "?"}${query}${hash}`
}

/**
 * Une nature de sujet que ce client ne connaît pas : aucune cible inventée.
 * Le paramètre `never` rend le `switch` EXHAUSTIF : une nature ajoutée au
 * domaine sans cible ici ne compile pas.
 */
function unknownSubject(kind: never): null {
	void kind
	return null
}

/**
 * La cible d'une notification — `null` quand il n'y en a AUCUNE (sujet absent
 * ou sans page, acteur sans `@handle`). La ligne se contente alors de
 * « Marquer lu », jamais d'un lien inventé.
 */
export function notificationTarget(item: NotificationTargetInput, routes: NotificationRoutes, t: TFunction): NotificationTargetRef | null {
	const subject = item.subject ?? null

	// Les genres RELATIONNELS n'ont pas de sujet « ouvrable » : l'un porte une
	// invitation à laquelle on RÉPOND, les autres une personne qu'on va voir.
	if (item.kind === "connection_request") {
		const connectionId = subject?.kind === "connection" ? clean(subject.id) : null
		if (connectionId === null) return null
		return { kind: "connection", id: connectionId, href: reseauAgentHref("relations", routes.home()), label: t(CONNECTION_LABEL) }
	}
	if (PROFILE_KINDS.includes(item.kind)) {
		const handle = clean(item.actor?.handle)
		if (handle === null) return null
		return { kind: "profile", id: handle, href: routes.profile(handle), label: t(PROFILE_LABEL) }
	}

	if (subject === null) return null
	const id = clean(subject.id)
	if (id === null) return null
	const kind: NotificationSubjectKind = subject.kind
	switch (kind) {
		case "post":
			return { kind: "post", id, href: withQuery(routes.home(), `${RESEAU_AGENT_POST_PARAM}=${encodeURIComponent(id)}`), label: t(OPEN_LABEL) }
		case "groupThread": {
			const href = conversationHref(groupeKey(id), routes.messages())
			return href === null ? null : { kind: "groupThread", id, href, label: t(OPEN_LABEL) }
		}
		case "thematicGroup":
			return { kind: "group", id, href: reseauAgentGroupeHref(id, routes.home()), label: t(OPEN_LABEL) }
		case "event":
			return { kind: "event", id, href: reseauAgentHref("evenements", routes.home()), label: t(OPEN_LABEL) }
		case "album": {
			// L'album vit sur le profil de son propriétaire — l'auteur de la
			// notification (`album_published`). Sans `@handle`, aucune adresse.
			const handle = clean(item.actor?.handle)
			if (handle === null) return null
			return { kind: "album", id, href: `${routes.profile(handle)}/albums/${encodeURIComponent(id)}`, label: t(OPEN_LABEL) }
		}
		case "liveSession":
			// Démarrage, invitations et ENREGISTREMENT publié (`live_replay_published`)
			// désignent la même SESSION : la page de conférence relit sa garde et sert
			// le direct ou son enregistrement.
			return { kind: "direct", id, href: routes.conference(id), label: t(OPEN_LABEL) }
		case "call":
		case "voicemail":
			// L'appel manqué et le message vocal se relisent dans le journal
			// d'iAppel, la brique de la messagerie — jamais dans la ligne.
			return { kind: "calls", id, href: icomMobileTabHref("iappel", { home: routes.home(), messages: routes.messages() }), label: t(OPEN_LABEL) }
		case "connection":
		case "fileScan":
		case "report":
			// Une connexion ne s'ouvre pas hors de son genre (traité plus haut) ;
			// un fichier retenu n'a pas de page ici (la modération a sa console).
			return null
		default:
			return unknownSubject(kind)
	}
}

/**
 * Ce que la LIGNE rend : rien, une invitation à décider, un rappel de
 * l'hôte, un lien — ou le RÉSULTAT d'une invitation déjà tranchée, qui
 * n'appelle plus aucun geste.
 */
export type NotificationRowAction =
	| { mode: "none" }
	| { mode: "connection"; connectionId: string }
	| { mode: "callback"; kind: NotificationTargetKind; id: string; label: string }
	| { mode: "link"; kind: NotificationTargetKind; href: string; label: string }
	| { mode: "resolved"; text: string }

/**
 * Le rappel de l'hôte pour une nature de cible, s'il en fournit un. L'album et
 * le journal d'appels ne s'ouvrent jamais sur place : toujours une adresse.
 */
export function targetCallback(kind: NotificationTargetKind, targets: NotificationTargets): ((id: string) => void) | undefined {
	switch (kind) {
		case "post":
			return targets.onOpenPost
		case "groupThread":
			return targets.onOpenGroupThread
		case "direct":
			return targets.onOpenDirect
		case "group":
			return targets.onOpenGroup
		case "event":
			return targets.onOpenPersonalEvent
		case "connection":
			return targets.onOpenConnection
		case "profile":
			return targets.onOpenProfile
		case "album":
		case "calls":
			return undefined
	}
}

/**
 * La décision complète d'une ligne, hors React. Le rappel de l'hôte l'emporte
 * sur l'adresse (rester dans la page coûte moins qu'une navigation) ; sans
 * cible, la ligne n'offre que « Marquer lu ».
 *
 * ⚠️ Une invitation de relation ne se « suit » pas : elle se décide sur
 * place (Accepter / Refuser), après relecture de l'état courant. Elle sort
 * donc en `connection` même quand l'hôte offre un rappel — sauf si elle est
 * déjà TRANCHÉE : elle sort alors en `resolved`, avec la phrase du résultat,
 * et la ligne ne propose plus rien.
 */
export function notificationRowAction(item: NotificationTargetInput, routes: NotificationRoutes, targets: NotificationTargets, t: TFunction): NotificationRowAction {
	const settled = settledConnectionRequest(item, t)
	if (settled !== null) return { mode: "resolved", text: settled }

	const target = notificationTarget(item, routes, t)
	if (target === null) return { mode: "none" }
	if (target.kind === "connection") {
		return { mode: "connection", connectionId: target.id }
	}
	if (targetCallback(target.kind, targets) !== undefined) {
		return { mode: "callback", kind: target.kind, id: target.id, label: target.label }
	}
	return { mode: "link", kind: target.kind, href: target.href, label: target.label }
}

/**
 * Le résultat d'une demande de relation DÉJÀ tranchée, ou `null` quand elle
 * attend encore une réponse (ou n'est pas une demande de relation). Deux
 * sources, dans cet ordre :
 *   1. la RÉSOLUTION stockée — posée par le serveur dans la transaction qui
 *      a tranché, elle dit CE QUI a été décidé ;
 *   2. l'état VIVANT de la connexion — le filet contre un chemin qui aurait
 *      tranché sans résoudre la ligne ; il ne dit que « plus rien à décider ».
 *
 * Vérifié AVANT la cible : un résultat se dit même quand la référence de
 * connexion manque.
 *
 * ⚠️ `readAt` n'entre PAS dans la décision : lire n'est pas décider. Une
 * invitation lue mais non tranchée garde ses boutons.
 */
function settledConnectionRequest(item: NotificationTargetInput, t: TFunction): string | null {
	if (item.kind !== "connection_request") return null
	const resolution = item.resolution ?? null
	if (resolution !== null) {
		// Une valeur que ce client ne sait pas dire reste une décision prise :
		// la ligne perd ses boutons, avec la phrase générique.
		return resolutionSentence(item.kind, resolution.kind, t) ?? t(INVITE_ALREADY_HANDLED)
	}
	const state = item.inviteState ?? null
	if (state === null) return null
	const outcome = connectionInviteOutcome(state, t)
	return outcome.actionable ? null : outcome.message
}

export type ConnectionInviteOutcome = { actionable: true } | { actionable: false; message: string }

/**
 * Peut-on encore répondre à cette invitation ? Lu AVANT d'agir : accepter une
 * invitation déjà traitée ailleurs échouerait au serveur, et une mutation
 * aveugle ne dirait pas POURQUOI.
 *
 * Une ligne disparue (`missing`) a été ANNULÉE par son auteur ; tout le reste
 * — acceptée, déclinée, bloquée, ou en attente mais dont je suis l'AUTEUR —
 * a été traité et ne m'appartient plus.
 */
export function connectionInviteOutcome(state: ConnectionInviteState, t: TFunction): ConnectionInviteOutcome {
	if (state.status === "missing") {
		return { actionable: false, message: t(INVITE_CANCELLED) }
	}
	if (state.status === "requested" && state.iAmRecipient) {
		return { actionable: true }
	}
	return { actionable: false, message: t(INVITE_ALREADY_HANDLED) }
}

// ─────────────────────────── Ce que dit la ligne ───────────────────────────

/**
 * Les genres du MOTEUR que `shared.notificationSentence` ne phrase pas. Le type
 * se DÉDUIT du domaine : un genre ajouté à `NOTIFICATION_KINDS` sans phrase
 * ici ne compile pas.
 */
type EngineOnlyKind = Exclude<NotificationKind, NotificationSentenceKind>

/**
 * Deux formes par genre : la phrase qui NOMME l'acteur (`{{actor}}`), et la
 * phrase entière du système, sans nom devant (avis de la garde des fichiers,
 * page qui publie, attestation). Un retrait de parrainage a les deux : par le
 * parrain lui-même, ou par la modération, qui ne se désigne pas.
 */
const ENGINE_ONLY_SENTENCES: Readonly<Record<EngineOnlyKind, { actor: string | null; system: string | null }>> = Object.freeze({
		membership_changed: { actor: null, system: "notifications:notificationTargets.sentence.membershipChanged" },
		badge_changed: { actor: null, system: "notifications:notificationTargets.sentence.badgeChanged" },
		moderation_decision: { actor: null, system: "notifications:notificationTargets.sentence.moderationDecision" },
	// C'est la PAGE qui parle : aucun acteur, la publication est le sujet.
	page_post: { actor: null, system: "notifications:notificationTargets.sentence.pagePost" },
	album_published: { actor: "notifications:notificationTargets.sentence.albumPublished", system: null },
	// Prévient le déposant ET les modérateurs : la phrase ne dit pas « votre ».
	file_withheld: { actor: null, system: "notifications:notificationTargets.sentence.fileWithheld" },
	call_missed: { actor: "notifications:notificationTargets.sentence.callMissed", system: null },
	voicemail_left: { actor: "notifications:notificationTargets.sentence.voicemailLeft", system: null },
	// Tranche DIASPORALE (`convex/modules/diaspora/`), sans sujet.
	sponsorship_received: { actor: "notifications:notificationTargets.sentence.sponsorshipReceived", system: null },
	sponsorship_withdrawn: {
		actor: "notifications:notificationTargets.sentence.sponsorshipWithdrawn",
		system: "notifications:notificationTargets.sentence.sponsorshipWithdrawnSystem",
	},
	attestation_verified: { actor: null, system: "notifications:notificationTargets.sentence.attestationVerified" },
	attestation_not_confirmed: { actor: null, system: "notifications:notificationTargets.sentence.attestationNotConfirmed" },
})

function isSentenceKind(kind: string): kind is NotificationSentenceKind {
	return (NOTIFICATION_SENTENCE_KINDS as readonly string[]).includes(kind)
}

function isEngineOnlyKind(kind: string): kind is EngineOnlyKind {
	// `Object.hasOwn` : un genre comme `toString` ne trouve rien d'hérité.
	return Object.hasOwn(ENGINE_ONLY_SENTENCES, kind)
}

/** Ce qu'il faut d'une notification pour la DIRE. */
export interface NotificationSentenceInput {
	kind: string
	/** `null` pour un avis du système ; `displayName: null` pour un profil non publié. */
	actor?: { displayName?: string | null } | null
	/**
	 * `page_post` : la page qui a publié, nommée par le serveur (carte publique
	 * relue) ; `null` quand elle n'est plus active — la ligne se dit alors sans
	 * nom, jamais sous l'identité d'un signataire.
	 */
	page?: { name: string } | null
}

/**
 * La phrase d'une ligne — sans jamais recopier le contenu du sujet. Les genres
 * du réseau personnel viennent de `shared.notificationSentence` ; ceux que le
 * moteur ajoute sont phrasés ici. Un acteur au profil non publié se dit par le
 * libellé neutre ; un genre inconnu de ce client, par une phrase générique.
 */
export function notificationRowSentence(item: NotificationSentenceInput, t: TFunction): string {
	if (item.kind === "page_post") {
		const pageName = clean(item.page?.name)
		if (pageName !== null) return t("notifications:notificationTargets.sentence.pagePostNamed", { page: pageName })
	}
	const actorName = clean(item.actor?.displayName) ?? t(UNKNOWN_ACTOR)
	if (isSentenceKind(item.kind)) return notificationSentence(item.kind, actorName, t)
	if (isEngineOnlyKind(item.kind)) {
		const phrase = ENGINE_ONLY_SENTENCES[item.kind]
		const hasActor = item.actor !== null && item.actor !== undefined
		if (phrase.actor !== null && (hasActor || phrase.system === null)) return t(phrase.actor, { actor: actorName })
		if (phrase.system !== null) return t(phrase.system)
	}
	return t(OTHER_SENTENCE)
}

/** Ce qu'il faut d'une notification pour dire ce qu'elle est DEVENUE. */
export interface NotificationNoteInput {
	kind: string
	resolution?: { kind: string; at: number } | null
	/** `file_withheld` : le statut VIVANT de l'analyse (une libération l'a peut-être levé). */
	fileScanStatus?: FileScanStatus | null
}

/**
 * La ligne de RÉSULTAT sous la phrase, ou `null` : ce qu'une invitation est
 * devenue (tranchée sur place ou ailleurs), ou ce qu'est devenu un fichier
 * retenu — libéré depuis, ou de nouveau à l'analyse. Un fichier toujours
 * retenu ne dit rien de plus que sa phrase.
 */
export function notificationRowNote(item: NotificationNoteInput, action: NotificationRowAction, t: TFunction): string | null {
	if (action.mode === "resolved") return action.text
	const resolution = item.resolution ?? null
	if (resolution !== null) return resolutionSentence(item.kind, resolution.kind, t)
	if (item.kind === "file_withheld") {
		const status = item.fileScanStatus ?? null
		if (status === null) return null
		if (isServableStatus(status)) return t("notifications:notificationTargets.fileScan.released")
		if (status === "pending" || status === "running") return t("notifications:notificationTargets.fileScan.pending")
	}
	return null
}
