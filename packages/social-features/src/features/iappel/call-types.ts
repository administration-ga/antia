// Dupliqué de socle/packages/agent-features/src/features/iappel/call-types.ts @ ad2e7fdc2 — adaptations : identifiants du moteur (`Id<"calls">` au lieu de `Id<"meetings">`, `Id<"persons">` au lieu de `Id<"users">` ; les NOMS de champs `meetingId` et `userId` sont gardés, d'autres lots les lisent) ; branche poste élaguée (portée `poste`, fonction et administration de l'interlocuteur, routage du secrétariat `RoutedCall`, priorité ADR-0217 `CallPriority` et `isPriorityDirectCall`) ; genre `meeting` (iRéunion) et slot `queue` (file du centre d'appels) retirés ; genres d'appel, raisons d'admission et états d'un convié tirés du domaine et des contrats du moteur (une seule source) ; résultat de placement tiré de l'API (`calls.direct.callMember` : refus à code, sans phrase du serveur) ; fil d'origine porté par l'identité de groupe.
/**
 * iAppel — le vocabulaire partagé de la couche d'appel.
 *
 * Un seul fichier de types pour la surface, le store, les modules de décision
 * et les hooks : ces objets voyagent entre eux à chaque rendu, et deux
 * définitions du même appel finiraient par diverger sur le champ qui compte.
 *
 * Aucun import React, aucun import LiveKit : ce module se lit depuis un test
 * en environnement `node`, sans DOM (cf. `vitest.config.ts` du paquet). Les
 * imports ci-dessous sont des TYPES seulement.
 */

import type { api, Id } from "@antia/api/engine"
import type { GroupParticipantState } from "@antia/social-contracts/callGroup"
import type {
	CallAdmissionReason as EngineCallAdmissionReason,
	CallKind as EngineCallKind,
} from "@antia/social-domain/callJournal"
import type { FunctionReturnType } from "convex/server"

/**
 * AU TITRE DE QUOI l'appel a lieu.
 *
 * Dans le moteur, un appel est toujours de PERSONNE À PERSONNE : la portée
 * « poste » du socle (un appel reçu au titre d'une fonction dans une
 * administration) n'existe pas ici. Le type reste, à une seule valeur, parce
 * que la surface, le magasin et la messagerie se le passent de main en main.
 */
export type CallScope = "personnel"

/** Qui a composé le numéro — décide du vocabulaire et des actions offertes. */
export type CallDirection = "outgoing" | "incoming"

/**
 * À COMBIEN — et surtout : un appel, PAS une réunion.
 *
 *  · `direct` — tête-à-tête, deux places, la machine du 1:1 (refus qui termine
 *    l'appel, messagerie vocale, écran d'admission) ;
 *  · `group`  — appel à plusieurs, jusqu'à onze (`callGroup` du moteur). Il
 *    SONNE chez chacun, chaque invité décroche ou refuse pour son compte, et
 *    quitter ne raccroche pas pour les autres.
 *
 * Miroir exact des genres du domaine (`CALL_KINDS`, `callJournal`) : une
 * valeur qui n'existerait que d'un côté produirait une case vide à l'écran.
 * La conférence, elle, n'est pas un appel : c'est un direct (lot `live`).
 */
export type CallKind = EngineCallKind

/** Un convié, tel que l'écran d'appel entrant le montre dans sa pile. */
export interface CallGroupInviteePreview {
	/** La personne conviée (`Id<"persons">`, en chaîne). */
	userId: string
	name: string | null
	avatarUrl?: string | null
}

/** Ce qu'un appel de groupe annonce AVANT même qu'on décroche. */
export interface CallGroupIdentity {
	/** Titre du fil, ou noms composés pour un appel sans fil. */
	title: string
	/** Nombre de personnes conviées, hôte compris. */
	memberCount: number
	/**
	 * Les premiers AUTRES conviés (appelant et moi exclus, quatre au plus) —
	 * la pile d'avatars de l'écran d'appel entrant (ADR-0149). Absente sur un
	 * appel posé depuis le magasin : l'écran retombe alors sur le seul
	 * décompte.
	 */
	invitees?: readonly CallGroupInviteePreview[]
	/**
	 * Le fil d'où part l'appel, quand j'en suis membre vivant (`listRinging`
	 * le rend) — l'écran peut y lire le titre du fil. Absent ou `null` : un
	 * appel sans fil, ou un fil que j'ai quitté.
	 */
	threadId?: Id<"groupThreads"> | null
}

/**
 * L'état d'UN interlocuteur dans un appel de groupe.
 *
 * Miroir exact de `GroupParticipantState` côté moteur
 * (`@antia/social-contracts/callGroup`) : c'est le même type, si bien qu'une
 * valeur ne peut pas exister d'un seul côté.
 */
export type CallParticipantState = GroupParticipantState

/** Un interlocuteur d'appel de groupe, tel que la grille le rend. */
export interface CallParticipantView {
	/** La personne (`Id<"persons">`) — le nom du champ est celui du socle. */
	userId: Id<"persons">
	name: string | null
	avatarUrl?: string | null
	handle?: string | null
	state: CallParticipantState
	/** Pourquoi il est `unavailable` — jamais autre chose qu'une raison connue. */
	reason: CallAdmissionReason | null
	isMe: boolean
	/**
	 * L'AUTEUR de l'appel — la puce « Appelant » de sa vignette, lisible par
	 * les invités (ADR-0149). Optionnel : sans lui, la grille ne montre pas de
	 * puce.
	 */
	isCaller?: boolean
}

/**
 * Le genre de slot. Dans le moteur, un seul : `direct`, l'appel de personne à
 * personne dont la vie est tenue par la surface d'appel. La FILE du centre
 * d'appels du socle (`queue`) n'existe pas ici ; le type reste, à une valeur,
 * parce que le magasin et les réconciliateurs le lisent.
 */
export type CallSlotKind = "direct"

/** L'autre bout du fil, tel qu'on le montre à l'écran. */
export interface CallPeerIdentity {
	/** La personne (`Id<"persons">`) — le nom du champ est celui du socle. */
	userId?: Id<"persons">
	/** Nom PUBLIÉ. `null` quand il n'est pas encore résolu — jamais un UUID. */
	name: string | null
	avatarUrl?: string | null
	/** Adresse de réseau (`@marie.ndong`), quand elle est connue. */
	handle?: string | null
}

/** Intention MÉDIA de l'utilisateur pour un slot donné. */
export interface CallMediaIntent {
	micMuted: boolean
	cameraEnabled: boolean
}

/**
 * L'INTENTION de sortie audio — où l'usager veut entendre son correspondant.
 *
 * ⚠️ C'est une INTENTION, pas un état de périphérique, et la distinction
 * porte tout le lot : le web ne sait choisir qu'un PÉRIPHÉRIQUE énuméré
 * (`setSinkId`), et « écouteur » / « haut-parleur » n'en sont deux que sur
 * certains Android. L'intention, elle, survit à la salle, au changement
 * d'appel actif et au rechargement de la page ; c'est le pool média qui la
 * traduit en `switchActiveDevice("audiooutput", …)` quand il le peut, et
 * l'écran qui dit honnêtement quand il ne le peut pas.
 *
 *  · `earpiece` / `speaker` — le geste du téléphone, indépendant de tout
 *    identifiant de périphérique (celui-ci change d'une session à l'autre) ;
 *  · `device` — le choix explicite d'une sortie du bureau. Le `label` est
 *    conservé pour pouvoir NOMMER le choix quand le périphérique a disparu
 *    (casque débranché) : « Casque » vaut mieux qu'un identifiant opaque.
 */
export type AudioRouteIntent =
	| { kind: "earpiece" }
	| { kind: "speaker" }
	| { kind: "device"; deviceId: string; label: string | null }

/**
 * Un appel qui SONNE chez moi, tel que l'écran le présente — construit à
 * partir de `api.modules.calls.ringing.listRinging` (`use-incoming-calls.ts`).
 */
export interface RingingCall {
	/** L'appel (`Id<"calls">`) — le nom du champ est celui du socle. */
	meetingId: Id<"calls">
	/** Absent : un appel sans genre est un 1:1. */
	kind?: CallKind
	/** Renseigné pour un appel de groupe seulement. */
	group?: CallGroupIdentity | null
	scope: CallScope
	caller: CallPeerIdentity
	mediaType: "audio" | "video"
	/** Depuis quand ça sonne — sert au tri et au compte à rebours. */
	ringingSince: number
	/** Réponses rapides proposées au refus (mes propres réglages). */
	quickReplies?: readonly string[]
}

/**
 * L'état d'un appel, tel que l'écran doit le dire.
 *
 * `reconnecting` est un état À PART ENTIÈRE et non un sous-cas de `active` :
 * pendant une bascule réseau, l'appel n'est pas mort mais la voix ne passe
 * plus — le taire ferait croire à un correspondant devenu silencieux.
 */
export type CallPhase =
	| "connecting"
	| "ringing"
	| "active"
	| "held"
	/**
	 * Le CORRESPONDANT m'a mis en attente. La reprise est SON geste : rien à
	 * l'écran ne me permet de la provoquer — proposer « Reprendre » ici
	 * laisserait croire que je peux revenir dans une conversation que l'autre
	 * a suspendue. Mon micro et ma caméra, eux, restent pilotables : je les
	 * règle pendant que je patiente.
	 */
	| "peer_held"
	| "reconnecting"
	| "ended"
	| "failed"

/**
 * COMMENT un appel s'est terminé — ce qui décide de la phrase montrée à
 * l'appelant, et des actions qu'on lui laisse.
 *
 * Les quatre premiers sont les fins ordinaires. Les suivants viennent de
 * l'admission côté serveur : un appel peut être refusé AVANT de sonner, et
 * l'appelant a droit à une raison plutôt qu'à un écran qui se referme.
 */
export type CallEndKind =
	| "missed"
	| "declined"
	| "ended"
	| "cancelled"
	| "busy"
	| "dnd"
	| "in_meeting"
	// L'appelé n'avait ni présence fraîche ni canal push : l'appel n'a sonné
	// nulle part. Écran dédié « Hors ligne » ; au JOURNAL il reste un manqué.
	| "offline"
	// L'appelé ne prend les appels que de ses relations (réglage personnel).
	// L'appel est journalisé des deux côtés et l'appelant en est informé.
	| "outside_relations"
	| "error"

/**
 * Raisons de refus AUTOMATIQUE, telles que le serveur les nomme.
 *
 * ⚠️ C'est le type du domaine du moteur (`CALL_ADMISSION_REASONS`,
 * `callJournal`) et non une recopie : un littéral que le serveur émet et que
 * le client ignorerait retomberait sur un libellé générique — un écran qui en
 * dit moins que ce que l'on sait.
 */
export type CallAdmissionReason = EngineCallAdmissionReason

/**
 * Réponse de la mutation d'appel (`calls.direct.callMember`) — un refus est
 * une VALEUR, jamais une exception : `{ admitted: false, reason,
 * voicemailOffered }`. Le moteur ne compose aucune phrase : l'écran traduit la
 * raison (`refusalEndKind`, `describeCallEnd`).
 */
export type CallPlacementResult = FunctionReturnType<typeof api.modules.calls.direct.callMember>
