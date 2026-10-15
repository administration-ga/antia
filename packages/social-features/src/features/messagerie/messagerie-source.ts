// Dupliqué de socle/packages/agent-features/src/features/messagerie/messagerie-source.ts @ ad2e7fdc2 — adaptations : SEULE la source personnelle demeure (`SOURCE_AGENT`) — `SOURCE_POSTE`, `useOptionalOrg`, l'espace « poste » et son texte d'administration absente retirés ; branchée sur le moteur, réseau courant en argument (`useNetwork().networkId`) : fils par `messaging.inbox.paginateMyThreads` (la fenêtre ET les pages, curseur à deux côtés `low`/`high`), `messaging.inbox.getThread`, `messaging.inbox.totalUnread`, groupes par la première page de `groups.threads.paginateMyGroupThreads`, `groups.threads.totalUnread`, appel par `calls.direct.callMember` (cible `{ personId }` quand l'écran la connaît, sinon `{ handle }`) ; données TYPÉES depuis l'API (`MessagerieThread`, `MessagerieGroupThread`, curseurs tirés de `FunctionReturnType`) au lieu de `any` ; dédoublonnage des pages par `threadId` ; `ResultatAppel` aligné sur le moteur (identifiants `Id<"calls">` et `Id<"persons">`, appelé rendu par le moteur, même d'un appel adressé par identifiant public, ni phrase serveur ni renvoi de secrétariat) et normalisé par `resultatAppelDe`.
"use client"

/**
 * messagerie-source — D'OÙ viennent les fils, et OÙ partent les gestes.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * UNE SOURCE INJECTÉE, JAMAIS UN TEST SUR L'ESPACE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * La messagerie riche — réactions, citations, notes vocales, suppression pour
 * moi, séparateurs de jour, salves, accusés — lit ses fils, ses groupes, ses
 * décomptes et passe ses appels par UNE source. Au socle, deux espaces se la
 * partageaient (le réseau personnel et la boîte d'un poste) ; le moteur n'en
 * garde qu'une : la boîte personnelle, DANS le réseau courant.
 *
 * ⚠️ On injecte une SOURCE, jamais un `if (espace === …)`. Même doctrine que
 * `nav`, qui injecte un GESTE : le jour où une autre surface arrive, une
 * implémentation de plus ne touche à aucune branche existante, et les vues se
 * testent avec une source factice, sans rien mocker.
 *
 * ⚠️ Une source est une CONSTANTE DE MODULE, et ses membres sont des hooks.
 * React exige que l'ordre des hooks soit stable : une source construite dans
 * le rendu (ou choisie par une condition) casserait cette règle au premier
 * changement. Les hooks d'une source peuvent, eux, en appeler d'autres
 * (`useNetwork`, `useAuthenticatedConvexQuery`) — ils sont appelés
 * inconditionnellement par la vue.
 */

import { api } from "@antia/api/engine"
import type { Id } from "@antia/api/engine"
import {
	useAuthenticatedConvexQuery,
	useConvexMutationQuery,
} from "@antia/api/hooks"
import { useNetwork } from "@antia/api/network"
import type { CallAdmissionReason } from "@antia/social-domain/callJournal"
import type { FunctionReturnType } from "convex/server"
import { useCallback, useEffect, useMemo, useState } from "react"
import { etatDeQuery, type EtatListe } from "../../shell/query-state"

/** L'espace d'une source — le moteur n'en connaît qu'un : la boîte personnelle. */
export type MessagerieEspace = "personnel"

/** Un fil 1:1 de MA boîte, tel que le moteur le projette. */
export type MessagerieThread = FunctionReturnType<
	typeof api.modules.messaging.inbox.paginateMyThreads
>["items"][number]

/** Un fil de GROUPE de MA liste, tel que le moteur le projette. */
export type MessagerieGroupThread = FunctionReturnType<
	typeof api.modules.groups.threads.paginateMyGroupThreads
>["page"][number]

/** Le curseur d'une page de fils : un côté `low`, un côté `high`. */
export type ThreadsPageCursor = NonNullable<
	FunctionReturnType<typeof api.modules.messaging.inbox.paginateMyThreads>["nextCursor"]
>

/** Un côté du curseur — `null` quand ce côté n'a encore rien examiné. */
export type ThreadsPageSideCursor = ThreadsPageCursor["low"]

/**
 * Ce qu'une liste rend.
 *
 * ⚠️ Les cinq derniers champs ne sont pas décoratifs (IC-07 du socle) : sans
 * eux la source réduisait un `UseQueryResult` TanStack complet à
 * `{data, isLoading}`, si bien qu'une PANNE arrivait à l'écran sous la forme
 * d'une boîte vide (« Aucune conversation »), et qu'une query DÉSACTIVÉE
 * passait pour une attente réseau sans fin. La vue ne peut pas deviner ces
 * situations : la source doit les DIRE.
 */
export interface SourceListe<T> {
	data: T[] | undefined
	isLoading: boolean
	/** La lecture a échoué. Les données précédentes, si le cache en tient, restent. */
	isError: boolean
	error: unknown
	/** Relancer la lecture — le geste derrière « Réessayer ». */
	refetch: () => void
	/** Un aller-retour est en cours (premier chargement OU rafraîchissement). */
	isFetching: boolean
	/** La query est-elle armée ? Faux = rien n'est attendu, donc pas de squelette. */
	enabled: boolean
}

/**
 * Le décompte de non-lus tel que le SERVEUR le rend — total et plafond.
 *
 * Le plafond est une information, pas une troncature à deviner côté client :
 * « 99+ » se dit quand `capped`, jamais parce que le nombre vaut 99.
 */
export type { TotalNonLus } from "./groupe-liste"
import type { TotalNonLus } from "./groupe-liste"

/** Le plafond commun des pastilles (aligné sur `UNREAD_CAP` du serveur). */
export const ICOM_UNREAD_CAP = 99

const ZERO_NON_LUS: TotalNonLus = { total: 0, capped: false }

/**
 * Additionner deux décomptes SERVEUR (tête-à-tête + groupes) sans jamais
 * dépasser le plafond, ni perdre l'information « plafonné ».
 *
 * Fonction PURE, exportée pour être vérifiable : c'est elle qui remplace les
 * sommes client de page (IC-06 du socle) — chacune additionnait les
 * `unreadCount` de la FENÊTRE chargée, si bien que le chiffre changeait d'une
 * barre à l'autre et retombait à zéro quand la liste n'était pas encore là.
 */
export function combinerNonLus(
	directs: TotalNonLus | undefined,
	groupes: TotalNonLus | undefined,
): TotalNonLus {
	const a = directs ?? ZERO_NON_LUS
	const b = groupes ?? ZERO_NON_LUS
	const somme = a.total + b.total
	if (a.capped || b.capped || somme >= ICOM_UNREAD_CAP) {
		return { total: ICOM_UNREAD_CAP, capped: true }
	}
	return { total: somme, capped: false }
}

/** Ce qu'un écran a besoin de savoir des DEUX décomptes, en une seule lecture. */
export interface SourceNonLus {
	/** Les tête-à-tête de MA boîte, comptés par le serveur. */
	directs: TotalNonLus
	/** Mes groupes, comptés par le serveur. */
	groupes: TotalNonLus
	/** La somme plafonnée — le chiffre de la pastille. */
	total: TotalNonLus
	/** Aucune des deux réponses n'est encore arrivée. */
	isLoading: boolean
	isError: boolean
	refetch: () => void
}

/**
 * Une liste PAGINÉE par activité (IC-06). `data` porte TOUT ce qui a été
 * chargé jusqu'ici, pages précédentes comprises.
 */
export interface SourcePageListe<T> extends SourceListe<T> {
	/** Reste-t-il des conversations plus anciennes à aller chercher ? */
	hasMore: boolean
	/** Charger la page suivante. Sans effet quand `hasMore` est faux. */
	loadMore: () => void
	/** Une page SUPPLÉMENTAIRE est en route (la liste affichée reste valide). */
	isLoadingMore: boolean
}

/** La taille d'une page de conversations — la valeur par défaut du serveur. */
export const THREADS_PAGE_SIZE = 30

/**
 * La fenêtre des GROUPES : la première page de la liste du moteur, à son
 * plafond. Le socle lisait de même une fenêtre (cinquante appartenances) ;
 * la liste se tient dans une page.
 */
export const GROUP_THREADS_WINDOW = 50

/**
 * Fusionner la page VIVANTE (la première, toujours souscrite) et les pages
 * plus anciennes accumulées. Pure, donc vérifiable.
 *
 * Dédoublonnage par `threadId`, la page vivante gagne : un fil réactivé
 * remonte en tête et ne doit pas rester une seconde fois à sa place ancienne.
 * L'ordre du serveur est conservé — il est déjà celui de l'activité.
 */
export function fusionnerPagesFils<T extends { threadId: unknown }>(
	vivante: readonly T[],
	anciennes: readonly T[],
): T[] {
	const vus = new Set(vivante.map((fil) => String(fil.threadId)))
	const suite = anciennes.filter((fil) => !vus.has(String(fil.threadId)))
	return [...vivante, ...suite]
}

/**
 * Deux curseurs de page désignent-ils le MÊME endroit ?
 *
 * ⚠️ Garde-fou de boucle : le curseur est un OBJET rendu par le serveur. Si
 * une lecture le reconstruit à l'identique, poser bêtement le nouvel objet
 * dans l'état relance le rendu, qui relance l'effet, indéfiniment. On compare
 * donc les VALEURS — le curseur n'a que quatre nombres.
 */
export function curseursEgaux(
	a: ThreadsPageCursor | null,
	b: ThreadsPageCursor | null,
): boolean {
	if (a === null || b === null) return a === b
	const cote = (x: ThreadsPageSideCursor, y: ThreadsPageSideCursor) =>
		x === null || y === null ? x === y : x.at === y.at && x.ct === y.ct
	return cote(a.low, b.low) && cote(a.high, b.high)
}

/**
 * L'état d'une liste de la messagerie, dérivé du CONTRAT partagé du réseau
 * (`query-state`) — même vocabulaire partout.
 */
export function etatDeSource<T>(source: SourceListe<T>): EtatListe {
	return etatDeQuery(
		{
			isPending: source.isLoading,
			isFetching: source.isFetching,
			isError: source.isError,
		},
		source.data?.length ?? 0,
		source.enabled,
	)
}

/**
 * Le résultat d'une demande d'appel, NORMALISÉ pour l'écran (`resultatAppelDe`).
 *
 * Un refus n'est PAS une exception : le moteur inscrit l'appel, déjà terminé,
 * et rend sa raison — l'écran de fin la traduit et offre ce qu'elle permet.
 */
export interface ResultatAppel {
	/**
	 * L'appel inscrit par le moteur (refusé ou non). Le nom reste celui que le
	 * magasin d'appel attend pour ses créneaux (`meetingId`).
	 *
	 * ⚠️ Les identifiants restent BRANDÉS (`Id<…>`) : les dé-brander ici
	 * obligerait l'appelant à des conversions, et une conversion est un endroit
	 * où l'on peut se tromper de table.
	 */
	meetingId: Id<"calls">
	/** Faux quand le correspondant a écarté l'appel (ne pas déranger, ligne occupée…). */
	admitted: boolean
	/** Le motif du refus, tel que le moteur le nomme — l'écran de fin le traduit. */
	reason?: CallAdmissionReason
	/** Le destinataire accepte-t-il un message vocal ? (refus seulement) */
	voicemailOffered?: boolean
	/**
	 * QUI l'on a appelé — rendu par le moteur (`calleePersonId`), même quand
	 * l'écran ne connaissait que son identifiant public (brouillon).
	 */
	targetUserId: Id<"persons">
	/** Le média RETENU par le serveur, pas celui demandé. */
	mediaType: "audio" | "video"
}

export interface DemandeAppel {
	/** L'identifiant public du correspondant (handle). */
	adresse: string
	/** La personne du correspondant, quand l'écran la connaît déjà (fil existant). */
	userId?: Id<"persons"> | null
	mediaType: "audio" | "video"
}

/** Ce que rend `calls.direct.callMember`. */
export type ResultatCallMember = FunctionReturnType<
	typeof api.modules.calls.direct.callMember
>

/**
 * Normalise la réponse du moteur. PURE : la décision (que retenir d'un
 * refus, quel média) vit hors du composant, là où elle se teste.
 */
export function resultatAppelDe(
	reponse: ResultatCallMember,
	demande: DemandeAppel,
): ResultatAppel {
	const targetUserId = reponse.calleePersonId
	if (reponse.admitted) {
		return {
			meetingId: reponse.callId,
			admitted: true,
			voicemailOffered: false,
			targetUserId,
			mediaType: reponse.mediaType,
		}
	}
	return {
		meetingId: reponse.callId,
		admitted: false,
		reason: reponse.reason,
		voicemailOffered: reponse.voicemailOffered,
		targetUserId,
		// Refusé, l'appel n'a pas de média retenu : on rend celui demandé.
		mediaType: demande.mediaType,
	}
}

export interface MessagerieSource {
	espace: MessagerieEspace
	/** Les fils 1:1 de MA boîte — une fenêtre (la première page). */
	useThreads: () => SourceListe<MessagerieThread>
	/**
	 * Les mêmes fils, PAR PAGES d'activité (IC-06) — ce que la LISTE consomme.
	 *
	 * `useThreads` reste servie : la conversation et le dock n'ont besoin que
	 * d'une fenêtre. Ce qui va au bout de la boîte, lui, se pagine : la liste
	 * montrait 30 fils sur 200 et déclarait « rien d'autre ».
	 */
	useThreadsPage: () => SourcePageListe<MessagerieThread>
	/**
	 * UN fil par son identifiant, quand la page chargée ne le porte pas —
	 * lien profond, notification, conversation plus ancienne que la fenêtre.
	 * `undefined` tant que la réponse n'est pas là, `null` quand ce fil n'est
	 * pas (ou plus) dans ma boîte.
	 */
	useThreadById: (threadId: string | null) => {
		data: MessagerieThread | null | undefined
		isLoading: boolean
		isError: boolean
		enabled: boolean
	}
	/** Les conversations de groupe — une fenêtre (la première page). */
	useGroupThreads: () => SourceListe<MessagerieGroupThread>
	/**
	 * Les DEUX décomptes de non-lus, comptés par le SERVEUR (IC-06).
	 *
	 * ⚠️ Jamais une somme des `unreadCount` de la page rendue : la page est une
	 * fenêtre, et une pastille qui change de valeur selon la fenêtre chargée
	 * est un écran qui affirme le faux.
	 */
	useUnreadTotals: () => SourceNonLus
	/** Le brouillon (écrire à quelqu'un avant que le fil n'existe) est-il servi ? */
	supporteBrouillon: boolean
	/**
	 * La source a-t-elle des conversations de GROUPE ?
	 *
	 * ⚠️ Distinct de « `useGroupThreads` rend une liste vide » : une liste vide
	 * veut dire « vous n'en avez aucun », et l'écran propose alors d'en créer
	 * un. Faux ici voudrait dire « il n'y en a pas dans cette source » — le
	 * bouton lui-même n'aurait pas lieu d'être.
	 */
	supporteGroupes: boolean
	/** Demander un appel, et rendre un résultat normalisé. */
	useStartCall: () => {
		appeler: (demande: DemandeAppel) => Promise<ResultatAppel>
		isPending: boolean
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// La source PERSONNELLE — la boîte de la personne, dans le réseau courant.
// ═══════════════════════════════════════════════════════════════════════════

export const SOURCE_AGENT: MessagerieSource = {
	espace: "personnel",
	useThreads() {
		const { networkId } = useNetwork()
		const q = useAuthenticatedConvexQuery(
			api.modules.messaging.inbox.paginateMyThreads,
			{ networkId, limit: THREADS_PAGE_SIZE },
		)
		return {
			data: q.data?.items,
			isLoading: q.isLoading,
			isError: q.isError,
			error: q.error,
			refetch: () => void q.refetch(),
			isFetching: q.isFetching,
			enabled: true,
		}
	},
	useThreadsPage() {
		/**
		 * DEUX souscriptions, et pas une de plus, quel que soit le nombre de
		 * pages ouvertes :
		 *
		 *  · la PREMIÈRE page reste VIVANTE (sans curseur) — c'est là que les
		 *    messages arrivent, que les pastilles bougent et qu'un fil réactivé
		 *    remonte. La geler pour économiser une souscription rendrait la
		 *    liste muette exactement là où elle doit parler ;
		 *  · la page SUIVANTE est lue par une seconde query ; son résultat est
		 *    accumulé, puis la query passe au curseur d'après. Les pages
		 *    anciennes sont donc des photographies — c'est le compromis assumé,
		 *    et il ne coûte rien : plus on descend, moins ça bouge.
		 *
		 * La première page partage la clé de `useThreads` : une seule
		 * souscription au serveur pour les deux.
		 */
		const { networkId } = useNetwork()
		const [curseur, setCurseur] = useState<ThreadsPageCursor | null>(null)
		const [anciennes, setAnciennes] = useState<MessagerieThread[]>([])
		/** Le curseur à demander APRÈS ce qui est déjà accumulé, `null` si épuisé. */
		const [suivant, setSuivant] = useState<ThreadsPageCursor | null>(null)
		const [epuise, setEpuise] = useState(false)

		const premiere = useAuthenticatedConvexQuery(
			api.modules.messaging.inbox.paginateMyThreads,
			{ networkId, limit: THREADS_PAGE_SIZE },
		)
		const suite = useAuthenticatedConvexQuery(
			api.modules.messaging.inbox.paginateMyThreads,
			curseur === null
				? "skip"
				: { networkId, cursor: curseur, limit: THREADS_PAGE_SIZE },
		)

		// La première page dit, à elle seule, s'il y a une suite : tant qu'on
		// n'a rien demandé de plus, son `nextCursor` EST le curseur suivant.
		const curseurPremiere = premiere.data?.nextCursor ?? null
		useEffect(() => {
			if (curseur !== null) return
			setSuivant((actuel) =>
				curseursEgaux(actuel, curseurPremiere) ? actuel : curseurPremiere,
			)
			setEpuise(premiere.data !== undefined && curseurPremiere === null)
		}, [curseur, curseurPremiere, premiere.data])

		// Une page supplémentaire est arrivée : elle s'ajoute, et le curseur
		// d'après la remplace. `curseur` reste posé — la query garde sa clé de
		// cache et ne redemande rien.
		const pageSuite = suite.data
		useEffect(() => {
			if (pageSuite === undefined) return
			setAnciennes((deja) => fusionnerPagesFils(deja, pageSuite.items))
			setSuivant(pageSuite.nextCursor ?? null)
			setEpuise(pageSuite.nextCursor === null)
		}, [pageSuite])

		const items = useMemo(
			() =>
				premiere.data === undefined
					? undefined
					: fusionnerPagesFils(premiere.data.items, anciennes),
			[premiere.data, anciennes],
		)

		const loadMore = useCallback(() => {
			if (suivant === null) return
			setCurseur(suivant)
		}, [suivant])

		return {
			data: items,
			isLoading: premiere.isLoading,
			isError: premiere.isError || suite.isError,
			error: premiere.error ?? suite.error,
			refetch: () => {
				void premiere.refetch()
				if (curseur !== null) void suite.refetch()
			},
			isFetching: premiere.isFetching,
			enabled: true,
			hasMore: !epuise && suivant !== null,
			loadMore,
			isLoadingMore: curseur !== null && suite.isFetching,
		}
	},
	useThreadById(threadId) {
		const { networkId } = useNetwork()
		const q = useAuthenticatedConvexQuery(
			api.modules.messaging.inbox.getThread,
			threadId === null
				? "skip"
				: // L'identifiant vient d'une clé de conversation (adresse,
					// notification) : une chaîne, que le serveur valide.
					{ networkId, threadId: threadId as Id<"personalThreads"> },
		)
		return {
			data: threadId === null ? undefined : q.data,
			isLoading: threadId !== null && q.isLoading,
			isError: threadId !== null && q.isError,
			enabled: threadId !== null,
		}
	},
	useGroupThreads() {
		const { networkId } = useNetwork()
		const q = useAuthenticatedConvexQuery(
			api.modules.groups.threads.paginateMyGroupThreads,
			{ networkId, paginationOpts: { numItems: GROUP_THREADS_WINDOW, cursor: null } },
		)
		return {
			data: q.data?.page,
			isLoading: q.isLoading,
			isError: q.isError,
			error: q.error,
			refetch: () => void q.refetch(),
			isFetching: q.isFetching,
			enabled: true,
		}
	},
	useUnreadTotals() {
		const { networkId } = useNetwork()
		const directs = useAuthenticatedConvexQuery(
			api.modules.messaging.inbox.totalUnread,
			{ networkId },
		)
		const groupes = useAuthenticatedConvexQuery(
			api.modules.groups.threads.totalUnread,
			{ networkId },
		)
		return {
			directs: directs.data ?? ZERO_NON_LUS,
			groupes: groupes.data ?? ZERO_NON_LUS,
			total: combinerNonLus(directs.data, groupes.data),
			isLoading: directs.isLoading && groupes.isLoading,
			isError: directs.isError || groupes.isError,
			refetch: () => {
				void directs.refetch()
				void groupes.refetch()
			},
		}
	},
	supporteBrouillon: true,
	supporteGroupes: true,
	useStartCall() {
		const { networkId } = useNetwork()
		const m = useConvexMutationQuery(api.modules.calls.direct.callMember)
		const appeler = useCallback(
			async (demande: DemandeAppel): Promise<ResultatAppel> => {
				// La personne quand l'écran la connaît (fil existant) ; sinon son
				// identifiant public — le moteur accepte l'une ou l'autre.
				const target =
					demande.userId !== undefined && demande.userId !== null
						? { personId: demande.userId }
						: { handle: demande.adresse }
				const reponse = await m.mutateAsync({
					networkId,
					target,
					mediaType: demande.mediaType,
				})
				return resultatAppelDe(reponse, demande)
			},
			[m, networkId],
		)
		return { appeler, isPending: m.isPending }
	},
}
