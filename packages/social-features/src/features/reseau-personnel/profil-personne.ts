// Dupliqué de socle/packages/agent-features/src/features/reseau-personnel/profil-personne.ts @ ad2e7fdc2 — adaptations : textes du mur par l'i18n (`wallEmptyText(isSelf, t)`, `wallErrorText(t)` et `wallLoadMoreLabel(t)` au lieu de `WALL_ERROR_TITLE`, `WALL_ERROR_MESSAGE` et `WALL_LOAD_MORE_LABEL` ; clés `reseau:profilPersonne.*`) ; ajouts du moteur : paramètres de vue de la fiche composés sur l'adresse du profil injectée (`profileApercuHref`, `profileManageHref` — aucune route écrite ici) et texte d'un refus du moteur (`profileErrorText` : règle, puis code, puis phrase de repli) ; décisions de couverture inchangées ; jumeau `profil-page.ts` (page d'administration) retiré des commentaires.
/**
 * profil-personne — décisions VÉRIFIABLES de la fiche d'une PERSONNE dans le
 * réseau (`ProfilPersonnePage`, `useRoutes().profile(handle)`).
 *
 * Ce qui se décide à l'écran vit ici, où c'est vérifiable, et non dans le
 * corps du composant.
 *
 * ── R-10 : la couverture publiée s'affiche ────────────────────────────────
 * `people.profile.getPublicProfile` rend la couverture (`cover.url`) ; le
 * repli reste le dégradé de la charte — mais il devient le cas SANS
 * couverture (ou retenue par l'analyse), plus le cas unique.
 *
 * ⚠️ Aucune couleur n'est prononcée ici, et c'est la contrainte qui dicte la
 * forme : le cliquet de charte refuse toute couleur brute dans un TSX, et un
 * dégradé est une valeur COMPOSÉE qui ne se dit pas en jeton nu. La bascule se
 * fait donc par CLASSE — `esp-banner` (dégradé de la charte) d'un côté,
 * `<base>--photo` (fond neutre en jeton, sous la photo) de l'autre.
 *
 * Ce module ne connaît ni React ni Convex : il n'importe que des TYPES
 * (`CSSProperties`, `TFunction`, effacés à la compilation) et les lecteurs
 * d'erreur PURS du contrat du moteur (`@antia/social-contracts/errors`).
 */

import { engineErrorCode, engineErrorRule } from "@antia/social-contracts/errors"
import type { TFunction } from "i18next"
import type { CSSProperties } from "react"

/** Le dégradé de la charte, seule valeur composée admise pour un repli. */
const COVER_FALLBACK_CLASS = "esp-banner"

/** La bannière par défaut d'une fiche d'identité (`ProfilFrame`). */
export const COVER_BASE_PROFIL = "pp-banner"

/** La bannière de la carte de rappel du réseau (`ProfileMiniCard`). */
export const COVER_BASE_MINI = "rp-mini-banner"

/**
 * Les classes de la bannière.
 *
 * Avec photo : `<base> <base>--photo` — le modificateur ne porte QU'un fond
 * neutre en jeton, pour qu'un chargement d'image échoué ne laisse pas un trou
 * transparent au-dessus de la carte.
 *
 * Sans photo : `esp-banner <base>` — exactement ce que l'écran rendait avant,
 * au caractère près. Retirer sa couverture ramène donc le dégradé, sans état
 * intermédiaire ni classe orpheline.
 */
export function coverBannerClassName(
  coverUrl: string | null | undefined,
  base: string = COVER_BASE_PROFIL,
): string {
  return coverUrl ? `${base} ${base}--photo` : `${COVER_FALLBACK_CLASS} ${base}`
}

/**
 * Le cadrage de la couverture — `cover` + `center`, la seule combinaison qui
 * remplit une bande de hauteur fixe sans déformer l'image.
 *
 * `undefined` sans couverture : la classe de repli porte alors seule le fond,
 * et aucun style en ligne ne vient contredire la charte.
 *
 * L'URL est CITÉE (`JSON.stringify` produit une chaîne CSS valide, guillemets
 * et échappements compris) : une URL de stockage porte des paramètres de
 * requête, et une parenthèse non citée y terminerait `url(` avant la fin.
 */
export function coverBannerStyle(
  coverUrl: string | null | undefined,
): CSSProperties | undefined {
  if (!coverUrl) return undefined
  return {
    backgroundImage: `url(${JSON.stringify(coverUrl)})`,
    backgroundSize: "cover",
    backgroundPosition: "center",
  }
}

// ═══════════════════════════════════════════════════════════════
// R-11 — le mur paginé
// ═══════════════════════════════════════════════════════════════

/** Une page du mur qu'on n'a pas pu lire le DIT — elle ne se vide pas (R-08). */
export function wallErrorText(t: TFunction): { title: string; message: string } {
  return {
    title: t("reseau:profilPersonne.wall.errorTitle"),
    message: t("reseau:profilPersonne.wall.errorMessage"),
  }
}

/**
 * Le mur vide — la raison dépend de QUI regarde : celui qui peut publier ici a
 * un geste à faire, l'autre n'apprend rien de ce qui lui est fermé.
 */
export function wallEmptyText(isSelf: boolean, t: TFunction): string {
  return isSelf
    ? t("reseau:profilPersonne.wall.emptySelf")
    : t("reseau:profilPersonne.wall.emptyOther")
}

/** Le libellé du geste explicite de continuation — jamais un défilement infini. */
export function wallLoadMoreLabel(t: TFunction): string {
  return t("reseau:profilPersonne.wall.loadMore")
}

// ═══════════════════════════════════════════════════════════════
// Paramètres de vue de la fiche
// ═══════════════════════════════════════════════════════════════

/**
 * L'APERÇU (X-07) : la fiche jouée comme celle d'un tiers. Le paramètre ne
 * part JAMAIS au serveur — il ne change que ce que l'écran rend.
 */
export const PROFILE_APERCU_PARAM = "apercu"

/**
 * La GESTION de mon profil (publication, photo, couverture, mode privé,
 * retrait) ouverte d'emblée sur ma fiche — l'entrée des rappels qui demandent
 * un geste sur le profil.
 */
export const PROFILE_MANAGE_PARAM = "gerer"

/** Ajoute un paramètre à une adresse, qu'elle porte déjà une requête ou non. */
function withFlag(href: string, param: string): string {
  return `${href}${href.includes("?") ? "&" : "?"}${param}=1`
}

/**
 * L'adresse de l'aperçu de MA fiche. L'adresse du profil est celle de
 * l'application (`useRoutes().profile(handle)`) : aucune route n'est écrite ici.
 */
export function profileApercuHref(profileHref: string): string {
  return withFlag(profileHref, PROFILE_APERCU_PARAM)
}

/** L'adresse de ma fiche, gestion du profil ouverte. */
export function profileManageHref(profileHref: string): string {
  return withFlag(profileHref, PROFILE_MANAGE_PARAM)
}

/**
 * Le texte d'un refus du moteur, tel qu'on peut le MONTRER.
 *
 * Le moteur rend des CODES, jamais des phrases : la règle du domaine enfreinte
 * (espace `rules`, bornes en paramètres) d'abord, sinon le code (espace
 * `errors`), sinon la phrase de l'écran (`fallbackKey`, clé qualifiée). Jamais
 * `error.message` : Convex y verse la trace serveur en développement.
 */
export function profileErrorText(err: unknown, fallbackKey: string, t: TFunction): string {
  const rule = engineErrorRule(err)
  if (rule !== null) return t(`rules:${rule.rule}`, rule.params)
  const code = engineErrorCode(err)
  if (code !== null) return t(`errors:${code}`)
  return t(fallbackKey)
}
