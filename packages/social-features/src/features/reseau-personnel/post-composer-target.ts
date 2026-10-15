// Dupliqué de socle/packages/agent-features/src/features/reseau-personnel/post-composer-target.ts @ ad2e7fdc2 — adaptations : la PAGE est celle du moteur (publication au nom d'une page par un signataire vivant, `pages.pages.publishAsPage`) au lieu d'une page d'administration ; libellés par l'i18n — `composerHeadingLabel`, `composerAudienceNote`, `composerDisclaimer` et `composerSubmitLabel` reçoivent `t` en DERNIER paramètre (clés qualifiées `reseau:postComposerTarget.*`) ; le mot du bas de composeur ne parle plus d'administration ni d'iCorrespondance (une communication qui engage une organisation se publie au nom de sa page) ; note aux abonnés au lieu de la note de service.
/**
 * post-composer-target — QUI publie depuis `PostComposer`, et ce que ce choix
 * change à l'écran : le libellé au-dessus de la zone de saisie, la présence
 * du sélecteur d'audience, la phrase qui le remplace quand il est masqué, le
 * mot du bas de composeur, et ce que dit le bouton d'envoi.
 *
 * `group` (publication de groupe) et `asPage` (publication AU NOM d'une page,
 * dont la personne est signataire) sont MUTUELLEMENT EXCLUSIFS : un composeur
 * ne peut pas publier à la fois DANS un groupe et AU NOM d'une page. Les
 * fournir tous les deux est une ERREUR DE PROGRAMMATION de l'appelant — jamais
 * un état d'utilisateur à absorber en silence — et `resolveComposerTarget`
 * lève.
 *
 * Ce module ne connaît ni React ni Convex, et c'est ce qui le rend testable
 * en environnement `node`. Aucune phrase n'y est écrite : les fonctions
 * reçoivent `t` en dernier paramètre et n'emploient que des clés qualifiées.
 * Même patron que `author-link.ts` et `post-overflow.ts`.
 */

import type { TFunction } from "i18next"

export type ComposerTarget =
  | { kind: "feed" }
  | { kind: "group"; name: string }
  | { kind: "page"; displayName: string }

export function resolveComposerTarget(input: {
  group?: { name: string }
  asPage?: { displayName: string }
}): ComposerTarget {
  if (input.group && input.asPage) {
    throw new Error(
      "PostComposer: `group` et `asPage` sont mutuellement exclusifs — un composeur ne publie jamais à la fois dans un groupe et au nom d'une page."
    )
  }
  if (input.asPage) return { kind: "page", displayName: input.asPage.displayName }
  if (input.group) return { kind: "group", name: input.group.name }
  return { kind: "feed" }
}

/** Le texte au-dessus de la zone de saisie. */
export function composerHeadingLabel(target: ComposerTarget, t: TFunction): string {
  switch (target.kind) {
    case "group":
      return t("reseau:postComposerTarget.heading.group", { name: target.name })
    case "page":
      return t("reseau:postComposerTarget.heading.page", { name: target.displayName })
    case "feed":
      return t("reseau:postComposerTarget.heading.feed")
  }
}

/**
 * Le sélecteur d'audience ne vaut que pour le fil : dans un groupe comme sur
 * une page, l'audience vient du LIEU, elle ne se choisit pas.
 */
export function showsAudienceSelector(target: ComposerTarget): boolean {
  // ⚠️ La PAGE en montre un aussi — avec sa propre liste (communiqué / note
  // aux abonnés). Seul le GROUPE n'en a pas : là, l'audience vient du LIEU et
  // ne se choisit pas.
  return target.kind === "feed" || target.kind === "page"
}

/**
 * Ce qui remplace le sélecteur quand il est masqué. `null` sur le fil, où il
 * est montré — la case n'a alors rien à dire à sa place.
 */
export function composerAudienceNote(target: ComposerTarget, t: TFunction): string | null {
  switch (target.kind) {
    case "group":
      return t("reseau:postComposerTarget.audienceNote.group")
    case "page":
      // Plus jamais atteint depuis que la page a son sélecteur — conservé
      // pour que le `switch` reste exhaustif sans branche par défaut.
      return null
    case "feed":
      return null
  }
}

/**
 * La ligne de bas de composeur — ce que la publication ENGAGE. Une page ne
 * reprend pas le mot pensé pour le fil personnel : rien n'y « appartient » à
 * qui signe, et la publication n'est pas la sienne — la personne n'en est que
 * la signataire.
 */
export function composerDisclaimer(target: ComposerTarget, t: TFunction): string {
  return target.kind === "page"
    ? t("reseau:postComposerTarget.disclaimer.page")
    : t("reseau:postComposerTarget.disclaimer.personal")
}

/** Ce que dit le bouton d'envoi, au repos ou pendant l'envoi. */
export function composerSubmitLabel(
  target: ComposerTarget,
  submitting: boolean,
  t: TFunction
): string {
  if (submitting) return t("reseau:postComposerTarget.submit.pending")
  return target.kind === "page"
    ? t("reseau:postComposerTarget.submit.page", { name: target.displayName })
    : t("reseau:postComposerTarget.submit.idle")
}

/**
 * Le composeur est-il DÉPLIÉ ?
 *
 * Replié, il tient sur une ligne de saisie et sa rangée de contrôles : il
 * ouvre le fil sans le remplir. Il se déplie dès qu'on s'en sert — focus,
 * première frappe, ou média déjà joint.
 *
 * ⚠️ Le média compte, et c'est le cas qui se rate : joindre une photo puis
 * cliquer ailleurs replierait un composeur qui porte pourtant un brouillon,
 * cachant l'avertissement de publication au moment précis où il s'applique.
 */
export function isComposerExpanded(input: {
  focused: boolean
  bodyLength: number
  mediaCount: number
}): boolean {
  return input.focused || input.bodyLength > 0 || input.mediaCount > 0
}
