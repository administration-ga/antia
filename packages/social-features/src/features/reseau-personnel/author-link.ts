// Dupliqué de socle/packages/agent-features/src/features/reseau-personnel/author-link.ts @ ad2e7fdc2 — adaptations : adresses par la table des routes INJECTÉE (`personHref(handle, profile)`, `pageHref(handle, page)`, `authorHref(author, routes)` — `routes` = `useRoutes()` ou toute table qui porte `profile` et, quand l'application la sert, `page`) au lieu des chemins de l'espace écrits en dur ; sans route de page, une page ne mène nulle part (jamais au profil d'une personne) ; libellés par l'i18n (`t` en dernier paramètre de `authorBadgeLabel`, `authorHeadlineFor` et `signedByLabel`) ; branche « page » gardée en l'état (pages d'administration → pages à identité propre du moteur), à réécrire sur le module `pages` du moteur.
/**
 * author-link — où mène l'auteur d'une carte, et sous quel visage.
 *
 * Une publication du fil peut être signée par une PAGE (institution,
 * association, entreprise, média, communauté) : le nom de la page, son adresse
 * et son logo remplacent l'identité de la personne, qui n'en est que la
 * signataire — la publication appartient à la page. La carte n'a pas deux
 * gabarits d'en-tête à tenir ; ce qui change, ce sont quatre décisions — où
 * l'on MÈNE, quel badge se pose, quelle forme prend la pastille, et ce que le
 * menu « … » a le droit de proposer.
 *
 * ⚠️ Ce module ne connaît AUCUNE adresse : l'application les injecte
 * (`useRoutes()`), et seule elle sait ses URL. Une décision laissée en ternaire
 * au milieu du TSX n'est vérifiable qu'à l'œil : elles vivent donc ici, où
 * elles sont testées. Même patron que `post-overflow.ts` et
 * `shell/reseau-agent-nav.ts`.
 *
 * ⚠️ La branche « page » est gardée telle que le socle l'avait écrite pour ses
 * pages d'administration ; elle sera réécrite sur le module `pages` du moteur
 * (badge de confiance calculé de la page, signataires). La branche « personne »
 * est celle du moteur.
 */

import type { TFunction } from "i18next"

/** Le genre de l'auteur, tel que le DTO du fil le rend. */
export type AuthorKind = "person" | "page"

/**
 * Le strict nécessaire pour décider — jamais la carte entière.
 *
 * ⚠️ **`authorKind` est OPTIONNEL**, et le sens du décalage porte la raison :
 * un navigateur qui exécute un JS NEUF face à un backend encore ANCIEN ne reçoit
 * pas le champ. L'absence vaut « personne » — le comportement d'avant les pages
 * — plutôt que de faire tomber une carte, donc le fil entier, une exception de
 * rendu remontant.
 */
export interface AuthorRef {
  authorKind?: AuthorKind
  handle: string | null
}

/**
 * Les adresses dont l'auteur a besoin — celles de la table des routes de
 * l'application (`useRoutes()`), jamais écrites ici.
 *
 * Chaque fabrique reçoit un SEGMENT DÉJÀ ENCODÉ : l'encodage se fait ici, une
 * seule fois — la table des routes ne le refait pas.
 */
export interface AuthorRoutes {
  /** Le profil d'une personne, par son identifiant public (`EngineRoutes.profile`). */
  profile: (handle: string) => string
  /**
   * La page d'une PAGE, par son adresse. Absente tant que l'application ne sert
   * pas les pages : une page ne mène alors nulle part — un texte vaut mieux qu'un
   * lien vers le profil d'une personne qui n'est pas elle.
   */
  page?: (handle: string) => string
}

/** Une seule lecture du genre : le repli n'est écrit qu'ici. */
function isPage(author: Pick<AuthorRef, "authorKind">): boolean {
  return author.authorKind === "page"
}

/**
 * Le profil d'une PERSONNE.
 *
 * L'encodage n'est pas décoratif : un caractère non encodé casse la route ou,
 * pire, la détourne (une barre oblique sort du segment).
 */
export function personHref(handle: string, profile: AuthorRoutes["profile"]): string {
  return profile(encodeURIComponent(handle))
}

/**
 * La page d'une PAGE. Même encodage que pour une personne : les adresses de page
 * dérivent d'un nom, et un nom porte des accents.
 */
export function pageHref(handle: string, page: NonNullable<AuthorRoutes["page"]>): string {
  return page(encodeURIComponent(handle))
}

/**
 * Où mène l'auteur — `null` quand il n'y a nulle part où aller.
 *
 * Sans adresse publiée il n'existe aucune page de destination, et un lien mort
 * vaut moins qu'un texte : c'est déjà la condition qui décide des initiales de
 * l'avatar (`hasIdentity`). Une adresse VIDE ou blanche compte comme absente —
 * elle produirait la base nue du profil, c'est-à-dire un lien qui aboutit
 * ailleurs sans jamais se signaler comme cassé.
 *
 * Une page sans route de page ne mène nulle part : jamais au profil d'une
 * personne, où elle afficherait un homonyme ou une identité usurpée.
 */
export function authorHref(author: AuthorRef, routes: AuthorRoutes): string | null {
  const handle = author.handle?.trim() ?? ""
  if (handle.length === 0) return null
  if (isPage(author)) return routes.page ? pageHref(handle, routes.page) : null
  return personHref(handle, routes.profile)
}

/**
 * « Page officielle » sur une publication de page, rien sur celle d'une
 * personne.
 *
 * Une page qui publie engage la parole de ce qu'elle représente ; l'avis
 * personnel d'une personne n'engage qu'elle. La différence doit se voir AVANT
 * d'avoir lu le corps du message, pas après.
 */
export function authorBadgeLabel(author: AuthorRef, t: TFunction): string | null {
  return isPage(author) ? t("reseau:authorLink.pageBadge") : null
}

/**
 * Ce que la ligne discrète de l'en-tête garde de `author.headline`.
 *
 * `null` quand l'intitulé ne dirait rien de plus que le badge : rendu en plus
 * du badge, il ferait bégayer la carte.
 */
export function authorHeadlineFor(
  author: {
    authorKind?: AuthorKind
    headline: string | null
  },
  t: TFunction,
): string | null {
  const headline = author.headline?.trim() ?? ""
  if (headline.length === 0) return null
  if (isPage(author) && headline === t("reseau:authorLink.pageBadge")) return null
  return headline
}

/**
 * La pastille : médaillon ROND pour une personne, tuile CARRÉE pour une page.
 *
 * Le rond est, dans tout réseau, la forme du visage. Un logo rogné en cercle
 * perd son cadre et le plus souvent son sigle — et il n'y a aucun visage à
 * évoquer : c'est une marque.
 */
export function avatarShapeFor(author: AuthorRef): "round" | "square" {
  return isPage(author) ? "square" : "round"
}

/**
 * Une PAGE ne se met pas en sourdine.
 *
 * « Ne plus voir les publications de … » vise une PERSONNE : appliqué à une
 * carte de page, il ferait taire la SIGNATAIRE — donc ses publications
 * personnelles — sans rien changer à la page que le lecteur croyait viser.
 * D'une page on se désabonne, et cela se décide depuis sa page.
 *
 * Seul le GENRE entre dans cette décision — l'adresse n'y joue aucun rôle.
 */
export function authorIsMutable(author: AuthorRef): boolean {
  return !isPage(author)
}

/**
 * La signataire, nommée sans être mise en avant : la page publie, la personne
 * signe.
 *
 * `null` quand il n'y a personne à nommer — une publication de personne, mais
 * aussi une signataire qui n'a pas publié de profil : son identité n'est pas
 * une publication (doctrine de l'opt-in), et le serveur rend alors
 * `signedBy: null`. Un nom vide vaut absence : « Publié par » suivi de rien
 * affirmerait une signature qu'on ne peut pas montrer.
 */
export function signedByLabel(signedBy: { displayName: string } | null, t: TFunction): string | null {
  const name = signedBy?.displayName.trim() ?? ""
  if (name.length === 0) return null
  return t("reseau:authorLink.signedBy", { name })
}
