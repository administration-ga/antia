// Dupliqué de socle/packages/agent-features/src/features/reseau-personnel/feed-scopes.ts @ ad2e7fdc2 — adaptations : portées LUES dans le domaine du moteur (`FEED_SCOPES`, `FEED_SCOPE_DEFAULT`, type `FeedScope` de `@antia/social-domain/content`) au lieu d'un miroir ; portée « mon_administration » et ses alias (`mon-administration`, `administration`, `collegues`) retirés — une ancienne adresse retombe sur la portée par défaut ; chips décrites par des CLÉS i18n (`labelKey`, `descriptionKey`, clés qualifiées `reseau:feedScopes.chips.*`) au lieu de libellés ; « agents » → « personnes » ; références au manifeste de navigation d'iAsted retirées des commentaires ; `parseFeedScope` ne lit plus une propriété héritée de l'objet des alias.
/**
 * feed-scopes — les « chips » de portée du fil, côté client.
 *
 * Ce qui se DÉCIDE ici — quelles portées existent, laquelle s'ouvre par
 * défaut, quelles valeurs d'URL aboutissent, quand les chips ont seulement un
 * sens — vit dans ce module, où c'est vérifiable en environnement `node`, sans
 * monter de composant.
 *
 * Les portées elles-mêmes sont celles du DOMAINE (`@antia/social-domain/content`) :
 * ce module n'en recopie aucune. Il ne porte que des CLÉS de libellés et de la
 * navigation : la règle d'admission reste au serveur, seul endroit où elle
 * protège quelque chose.
 *
 * ⚠️ **`scope` n'entre PAS dans `FeedView`.** `FeedView` décrit ce qui
 * REMPLACE le fil — un mot-clic, une recherche, une publication ouverte — et
 * porte l'invariant « toute vue ≠ fil expose un retour ». Une chip ne remplace
 * rien : elle RECOMPOSE le fil, et il n'y a donc rien d'où revenir. Les
 * confondre ferait apparaître un bouton « Revenir au fil » alors qu'on y est.
 *
 * Aucun import React : ce module ne connaît que des données de navigation.
 */

import { FEED_SCOPE_DEFAULT as DOMAIN_FEED_SCOPE_DEFAULT, FEED_SCOPES, type FeedScope as DomainFeedScope } from "@antia/social-domain/content"

import type { FeedView } from "../../shell/reseau-layout"
import type { ReseauAgentTabId } from "../../shell/reseau-agent-nav"

/**
 * Le paramètre de query. DISTINCT de `tab` (les volets) et de `tag` (le
 * mot-clic) : les trois se combinent sur la même adresse et doivent pouvoir
 * coexister.
 */
export const FEED_SCOPE_PARAM = "scope"

/** Les portées du domaine, dans l'ordre du rendu. */
export const FEED_SCOPE_IDS = FEED_SCOPES

export type FeedScope = DomainFeedScope

/** Portée servie quand rien n'est demandé — le fil d'avant les chips. */
export const FEED_SCOPE_DEFAULT: FeedScope = DOMAIN_FEED_SCOPE_DEFAULT

export interface FeedScopeChip {
	id: FeedScope
	/** Clé i18n qualifiée du libellé de la chip. Court : la rangée défile sur un téléphone. */
	labelKey: string
	/**
	 * Clé i18n qualifiée de ce que la portée montre — rendu sous la rangée pour
	 * la chip active, et jamais deviné. « Récents » ne dit pas de quoi, ni
	 * pourquoi c'est différent.
	 */
	descriptionKey: string
}

/** Les deux clés d'une chip, sous `reseau:feedScopes.chips.<id>`. */
function chipKeys(id: FeedScope): FeedScopeChip {
	const base = `reseau:feedScopes.chips.${id}`
	return { id, labelKey: `${base}.label`, descriptionKey: `${base}.description` }
}

export const FEED_SCOPE_CHIPS: readonly FeedScopeChip[] = Object.freeze(FEED_SCOPE_IDS.map(chipKeys))

/**
 * Anciennes valeurs et synonymes qui doivent aboutir. Une chip partagée par
 * lien vit au-delà de la session qui l'a posée.
 */
const FEED_SCOPE_ALIASES: Readonly<Record<string, FeedScope>> = Object.freeze({
	pourvous: "pour_vous",
	"pour-vous": "pour_vous",
	foryou: "pour_vous",
	recent: "recents",
})

/**
 * La portée désignée par une valeur d'URL — jamais une valeur morte.
 * Inconnue, vide ou absente rendent la portée par défaut : un fil ne refuse pas
 * de s'ouvrir.
 */
export function parseFeedScope(raw: string | null | undefined): FeedScope {
	if (raw === null || raw === undefined) return FEED_SCOPE_DEFAULT
	const key = raw.trim().toLowerCase()
	if (key.length === 0) return FEED_SCOPE_DEFAULT
	if ((FEED_SCOPE_IDS as readonly string[]).includes(key)) {
		return key as FeedScope
	}
	// `Object.hasOwn` : une graphie comme `toString` ne trouve rien d'hérité.
	const alias = Object.hasOwn(FEED_SCOPE_ALIASES, key) ? FEED_SCOPE_ALIASES[key] : undefined
	return alias ?? FEED_SCOPE_DEFAULT
}

/**
 * L'argument à passer à `myFeed` — `undefined` pour la portée par défaut, afin
 * que la query garde exactement la signature qu'elle avait avant les chips.
 */
export function feedScopeArg(scope: FeedScope): FeedScope | undefined {
	return scope === FEED_SCOPE_DEFAULT ? undefined : scope
}

/** La chip, telle qu'elle se décrit. */
export function feedScopeById(id: FeedScope): FeedScopeChip {
	const found = FEED_SCOPE_CHIPS.find((chip) => chip.id === id)
	if (found === undefined) {
		throw new Error(`Portée de fil inconnue : ${id}`)
	}
	return found
}

/**
 * Les chips n'ont de sens QUE dans le fil non filtré.
 *
 * Sur les relations ou les signets, elles ne recomposeraient rien. Dans une
 * recherche, un mot-clic ou une publication ouverte, elles laisseraient croire
 * qu'on filtre un filtre — et le bouton de retour du filtre en cours, lui,
 * ramène au fil ENTIER, pas à la chip.
 */
export function chipsVisibleFor(
	tab: ReseauAgentTabId,
	view: FeedView,
): boolean {
	return tab === "fil" && view.kind === "feed"
}
