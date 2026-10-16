// Dupliqué de socle/packages/agent-features/src/features/stories/stories-viewer.ts @ ad2e7fdc2 — adaptations : surfaces `reseau`/`icom` (ADR-0079 du socle) retirées avec le moteur — paramètre d'URL `surface` et son analyse supprimés ; clé d'un écran par le `personId` de l'auteur du plateau du moteur ; carte de direct sans l'audience « organisation » et hôte au nom nullable (contrat `counterpartLabel`, lot `live` à venir) ; média suivant retenu par la garde des fichiers (URL nulle) jamais préchargé ; nom accessible d'un écran traduit (`t` en dernier paramètre, clés `stories:storiesViewer.*`).
/**
 * stories-viewer — CE QUE le pager plein écran empile, et par où l'on entre.
 *
 * Le socle testait ses surfaces en environnement `node`, SANS
 * testing-library : ce qui reste dans le corps d'un composant n'y était
 * vérifiable qu'à l'œil. La composition de la pile — quels éléments, dans
 * quel ordre, lequel s'ouvre en premier — vit donc ici ; `StoriesViewerPage`
 * ne fait que la rendre dans un `VerticalPager`.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * LES DIRECTS EN TÊTE, ET C'EST UNE DÉCISION DE PRODUIT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Un direct EN COURS est périssable à la minute : le manquer, c'est le
 * manquer pour de bon (un replay n'est pas un direct). Une story tient
 * vingt-quatre heures. Mettre les directs en tête n'est donc pas un choix
 * d'esthétique mais l'ordre des urgences.
 *
 * ⚠️ Une carte de direct ne joue AUCUN flux. Entrer dans un direct reste un
 * geste explicite (cf. l'en-tête de `features/direct/DirectPage.tsx`) : un
 * pager qui ouvre une salle en glissant consommerait une place de spectateur
 * et allumerait un micro sur un simple mouvement du pouce.
 *
 * ⚠️ L'ORDRE DES GROUPES N'EST PAS DÉCIDÉ ICI. Ce module reçoit les groupes
 * dans l'ordre où ils doivent être lus — celui d'`orderTray` — et se contente
 * de les faire suivre. Deux tris concurrents feraient que la troisième
 * vignette de la barre n'ouvre pas le troisième écran du lecteur : le défaut
 * le plus déroutant qu'un lecteur de stories puisse avoir.
 *
 * Aucun import de composant : ce module ne connaît que des données.
 */

import type { TFunction } from "i18next"
import type { DirectAudience } from "@antsia/social-domain/live/domain"

import { storyAuthorName, type StoryTrayGroup } from "./stories-tray"

/**
 * La carte d'un direct EN COURS — sous-ensemble LU de la liste des directs en
 * cours (`direct.sessions.listLive` au socle ; lot `live` du moteur, pas
 * encore branché : le lecteur en reçoit aujourd'hui une liste vide).
 *
 * Type STRUCTUREL : le DTO serveur le satisfait tel quel (un identifiant de
 * session est une chaîne).
 */
export interface LiveDirectCard {
	sessionId: string
	title: string
	/**
	 * ⚠️ Miroir de l'audience d'un direct (serveur). L'audience
	 * « organisation » du socle (conférence d'administration) est RETIRÉE :
	 * le moteur la remplace par la page (lot `live`), et ce miroir suivra son
	 * DTO — l'omettre ici fera échouer le typage de toute liste de directs, ce
	 * qui est le bon comportement, à condition de savoir pourquoi. `invitees`
	 * (« Invités seulement ») : un invité voit la conférence dans ses directs
	 * en cours.
	 */
	audience: DirectAudience
	startedAt: number
	/** `displayName` nul : rien à nommer (contrat `counterpartLabel`) — libellé neutre à l'écran. */
	host: { displayName: string | null; handle: string | null; avatarUrl: string | null }
	counters: { viewerGrantCount: number; comments: number; reactions: number }
	isHost: boolean
}

/** Un écran du pager : soit un direct, soit LA SÉRIE d'un auteur. */
export type ViewerItem =
	| { kind: "direct"; direct: LiveDirectCard }
	| { kind: "stories"; group: StoryTrayGroup }

export interface BuildViewerOptions {
	/**
	 * Le handle par lequel entrer (`?auteur=`). Introuvable ⇒ on entre par le
	 * début, sans erreur : un lien partagé survit à l'expiration des stories
	 * qu'il visait, et retomber sur le premier écran vaut mieux qu'une page
	 * vide.
	 */
	startAuthor?: string | null
	/** N'empiler que les directs — les stories sont écartées. */
	onlyDirects?: boolean
}

export interface ViewerPlan {
	items: ViewerItem[]
	/** Toujours dans `[0, items.length - 1]`, et `0` sur une pile vide. */
	startIndex: number
}

/**
 * Compose la pile du lecteur.
 *
 * Un groupe SANS story est écarté : le plateau serveur n'en rend pas, mais une
 * fusion locale (story publiée à l'instant, réponse partielle) peut en
 * fabriquer un — et un écran de pager vide, entre deux écrans pleins, ne se
 * distingue pas d'un bug de rendu.
 */
export function buildViewerItems(
	liveDirects: readonly LiveDirectCard[],
	groups: readonly StoryTrayGroup[],
	options: BuildViewerOptions = {},
): ViewerPlan {
	const items: ViewerItem[] = liveDirects.map((direct) => ({
		kind: "direct" as const,
		direct,
	}))

	if (options.onlyDirects !== true) {
		for (const group of groups) {
			if (group.storyCount <= 0) continue
			items.push({ kind: "stories", group })
		}
	}

	const wanted = options.startAuthor
	if (wanted !== undefined && wanted !== null && wanted.length > 0) {
		const found = items.findIndex(
			(item) => item.kind === "stories" && item.group.author.handle === wanted,
		)
		if (found >= 0) return { items, startIndex: found }
	}
	return { items, startIndex: 0 }
}

/**
 * La clé de rendu d'un écran.
 *
 * Pour une série, c'est le `personId` de l'auteur et JAMAIS son handle : le
 * handle peut être `null` (profil non publié), et deux clés `stories:null`
 * dans la même pile feraient que React réutilise le mauvais nœud — deux
 * lecteurs partageraient alors leur position de lecture.
 */
export function viewerItemKey(item: ViewerItem): string {
	return item.kind === "direct"
		? `direct:${item.direct.sessionId}`
		: `stories:${item.group.author.personId}`
}

/**
 * QUELLE requête sert la série d'un auteur — et c'est une décision, pas un
 * détail de câblage.
 *
 * Le backend offre deux portes : `listByAuthor({handle})` pour la série de
 * quelqu'un, `myActive({})` pour la mienne. La seconde existe parce qu'« on
 * peut publier une story sans avoir publié de profil de réseau, et il serait
 * absurde d'exiger l'un pour relire l'autre ».
 *
 * ⚠️ Le cas qui décide : un auteur SANS handle, dans MON plateau. Sans profil
 * publié on n'est ni trouvable ni connectable — un tel auteur ne peut donc
 * être que MOI, et `myActive` est la bonne porte. Mais cela ne vaut QUE si je
 * n'ai pas de handle non plus : si j'en ai un, ma propre série le porte, et
 * une série sans handle est alors une anomalie. Servir MES stories sous la
 * vignette de quelqu'un d'autre serait un écran qui affirme le faux — on rend
 * « indisponible ».
 *
 * ⚠️ Cette règle N'EST PAS celle d'`isSelf` (`stories-tray.ts`), qui refuse
 * d'apparier deux `null`. Les deux questions diffèrent : là-bas il s'agit de
 * COLORER un anneau, où prendre un inconnu pour soi est le pire résultat ;
 * ici il s'agit de choisir une requête, où l'invariant du plateau tranche.
 */
export type StorySource = "mine" | "author" | "unavailable"

export function storySourceFor(
	handle: string | null,
	selfHandle: string | null,
): StorySource {
	if (handle !== null && handle.length > 0) {
		return handle === selfHandle ? "mine" : "author"
	}
	return selfHandle === null || selfHandle.length === 0
		? "mine"
		: "unavailable"
}

/**
 * Le nom accessible d'un écran — ce que le pager annonce en arrivant dessus.
 */
export function viewerItemLabel(item: ViewerItem, t: TFunction): string {
	return item.kind === "direct"
		? t("stories:storiesViewer.label.direct", {
				host: storyAuthorName(item.direct.host.displayName, t),
				title: item.direct.title,
			})
		: t("stories:storiesViewer.label.stories", {
				name: storyAuthorName(item.group.author.displayName, t),
			})
}

/**
 * Comment le lecteur se FERME : `back` quand la navigation venait de l'app
 * (le fil, les Actus — revenir restaure la position de défilement et les
 * pages déjà montées), `push` sur un lien direct (il n'y a rien derrière —
 * `router.back()` sortirait de l'application). Le drapeau vit dans
 * `stories-entry.ts` ; la décision est ici, où elle se teste.
 */
export function storiesCloseAction(openedFromApp: boolean): "back" | "push" {
	return openedFromApp ? "back" : "push"
}

/** Ce que le corps du lecteur affiche — et l'ORDRE dans lequel ça se décide. */
export type ViewerBodyState = "error" | "loading" | "empty" | "pager"

/**
 * L'état du corps du lecteur, par priorité stricte `error > loading > empty >
 * pager`.
 *
 * L'erreur passe AVANT le chargement, et c'est la raison d'être de cette
 * fonction : une requête en échec laisse `data` à `undefined` pour toujours —
 * décider « chargement » sur ce seul critère affichait « Chargement… » éternel,
 * sans message ni sortie. Une requête en erreur n'est PAS une requête en vol.
 */
export function viewerBodyState(input: {
	/** Le plateau (et la liste des directs, avec le lot `live`) en échec — le profil, lui, dégrade sans bloquer. */
	fatalError: boolean
	/** Les requêtes ont répondu ET l'écran d'entrée est calé. */
	loaded: boolean
	/** La pile est vide — rien à empiler dans le pager. */
	empty: boolean
}): ViewerBodyState {
	if (input.fatalError) return "error"
	if (!input.loaded) return "loading"
	if (input.empty) return "empty"
	return "pager"
}

/**
 * Le média à RÉCHAUFFER pendant qu'on regarde `index` : celui de la story
 * suivante de la MÊME série, `null` en fin de série (le pager précharge déjà
 * les auteurs voisins en les montant — les doubler ici téléchargerait deux
 * fois).
 *
 * Un média RETENU par la garde des fichiers (URL nulle : analyse en cours ou
 * bloqué — seul son auteur le voit) n'a rien à précharger.
 */
export function preloadTarget(
	stories: readonly { media: { url: string | null; kind: "image" | "video" } }[],
	index: number,
): { url: string; kind: "image" | "video" } | null {
	if (!Number.isInteger(index) || index < 0) return null
	const next = stories[index + 1]
	if (next === undefined || next.media.url === null) return null
	return { url: next.media.url, kind: next.media.kind }
}
