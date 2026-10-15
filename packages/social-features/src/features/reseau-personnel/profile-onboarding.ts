// Dupliqué de socle/packages/agent-features/src/features/reseau-personnel/profile-onboarding.ts @ ad2e7fdc2 — adaptations : règle relue sur la personne du moteur (`people.persons.getMyPerson` : `published`, `private`) — rien n'est publié d'office (invariant 7), donc plus d'identifiant provisoire ni d'étape `choose_handle` (l'identifiant se choisit à la publication) ; un profil retiré redemande la publication même s'il était hors connexion ; le rattrapage ne publie plus rien, il crée la PERSONNE absente (`shouldEnsurePublishedProfile` → `shouldEnsureMyPerson`, champ `autoPublishPending` → `ensurePending`) ; textes par l'i18n (`profileOnboardingCopy(step, t)`, clés `reseau:profileOnboarding.*`, la phrase « hors connexion » lue dans `visibilityAction(…, t)`) ; état du dossier iProfil retiré (`profileNetworkStatus`, seul lecteur : `MonProfilPage`, retiré) ; facette de compte plateforme et historique ADR du socle retirés des commentaires.
/**
 * Ce que l'écran doit demander à la personne au sujet de SON profil de réseau.
 *
 * Module PUR : une seule règle, plusieurs surfaces (la barre de profil du fil,
 * le fil mobile, la carte d'édition du profil). Elles divergeaient quand
 * chacune portait sa propre alerte : elles lisent désormais la même fonction.
 *
 * ── Rien n'est publié d'office (invariant 7) ─────────────────────────────
 * La personne naît à la première session SANS identifiant, sans nom et sans
 * adhésion (`people.persons.ensureMyPerson`) : son profil n'existe que quand
 * elle le publie (`people.profile.publishMyProfile`), et l'identifiant se
 * CHOISIT à ce moment-là. Il n'y a donc ni adresse provisoire à confirmer, ni
 * rattrapage de publication — seulement, au plus, la personne elle-même à
 * créer si la session est arrivée avant elle.
 *
 * ⚠️ Aucun RÔLE n'entre dans cette règle : une personne a une existence
 * sociale quel que soit son compte. Ce qui décide, c'est ce que le moteur rend
 * d'elle — publiée ou non, privée ou non.
 */
import type { TFunction } from "i18next"

import { visibilityAction } from "./profile-visibility-copy"

/**
 * Ce que rend `people.persons.getMyPerson`, réduit à ce qui décide de l'écran
 * (la réponse du moteur s'y passe telle quelle).
 */
export interface MyProfileFacets {
  /** Publié et non retiré. */
  published: boolean
  /** Mode privé (« hors connexion ») : hors des recherches et des suggestions. */
  private: boolean
}

export type ProfileOnboardingStep =
  /** Aucun profil publié : jamais publié, ou retiré. Le geste est de PUBLIER. */
  | { kind: "publish" }
  /** Hors connexion : rien à demander, mais l'état doit se voir. */
  | { kind: "private" }
  /** Rien à demander. */
  | { kind: "settled" }

/**
 * Ce que le COMPTE dit de lui-même — le seul fait qui prime sur l'absence de
 * personne, et sans lequel l'écran annonce un manque qu'il est en train de
 * combler.
 */
export interface ProfileOnboardingAccount {
  /** La personne est EN COURS de création (`ensureMyPerson`). */
  ensurePending?: boolean
}

/**
 * L'étape courante. `profile` vaut `null` quand la personne n'existe pas
 * encore pour le moteur (première session), `undefined` tant que le serveur
 * n'a pas répondu — les surfaces écartent elles-mêmes ce dernier cas.
 *
 * ⚠️ L'ORDRE des tests porte tout le sens :
 *
 * 1. **Création en cours d'abord.** Entre le constat de l'absence de personne
 *    et la réponse d'`ensureMyPerson`, il n'y a rien à demander : sans ce
 *    test, l'écran ferait clignoter « Vous n'êtes pas encore trouvable » avant
 *    de se corriger tout seul.
 * 2. **La publication avant l'état privé.** Un profil RETIRÉ garde son mode
 *    privé d'avant (`withdrawMyProfile` ne le lève pas) : ce n'est pas un
 *    profil hors connexion, c'est un profil absent — le geste est de publier.
 */
export function profileOnboardingStep(
  profile: MyProfileFacets | null | undefined,
  account: ProfileOnboardingAccount = {},
): ProfileOnboardingStep {
  if (!profile) {
    return account.ensurePending === true
      ? { kind: "settled" }
      : { kind: "publish" }
  }
  if (!profile.published) return { kind: "publish" }
  if (profile.private) return { kind: "private" }
  return { kind: "settled" }
}

/**
 * Faut-il CRÉER la personne du compte connecté ?
 *
 * La décision vit ici, et non dans le hook qui l'exécute
 * (`use-profile-onboarding.ts`) : ce qui reste dans le corps d'un composant
 * n'est vérifiable qu'à l'œil.
 *
 * Deux faits, et deux seulement :
 *  · `undefined` = le serveur n'a pas répondu. On ne comble jamais un manque
 *    qu'on n'a pas constaté.
 *  · `attempted` = une création a déjà été tentée dans ce chargement
 *    d'application. La mutation est idempotente ; le verrou évite le bruit.
 *
 * ⚠️ Créer la personne ne PUBLIE rien : elle naît sans identifiant ni nom.
 */
export function shouldEnsureMyPerson(input: {
  /** Ce que `getMyPerson` a rendu (`undefined` = pas encore répondu). */
  profile: MyProfileFacets | null | undefined
  /** Une création a-t-elle déjà été tentée dans ce chargement ? */
  attempted: boolean
}): boolean {
  if (input.attempted) return false
  return input.profile === null
}

/** Le titre, le corps et le geste de l'alerte, par étape. Jamais de texte en dur ailleurs. */
export function profileOnboardingCopy(
  step: ProfileOnboardingStep,
  t: TFunction,
): {
  title: string
  body: string
  action: string
} | null {
  switch (step.kind) {
    case "publish":
      return {
        title: t("reseau:profileOnboarding.publish.title"),
        body: t("reseau:profileOnboarding.publish.body"),
        action: t("reseau:profileOnboarding.publish.action"),
      }
    case "private": {
      /*
       * ⚠️ Le texte n'est pas recopié ici : il vient du geste « hors
       * connexion » de `profile-visibility-copy.ts`. La carte de profil et ce
       * rattrapage décrivent le MÊME geste — deux phrases écrites à deux dates
       * finissent toujours par se contredire. Une seule source, deux moitiés
       * obligatoires : ce que le geste fait, et ce qu'il laisse intact.
       */
      const offline = visibilityAction("hors_connexion", t)
      return {
        title: t("reseau:profileOnboarding.private.title"),
        body: `${offline.consequence} ${offline.reversibilite}`,
        action: t("reseau:profileOnboarding.private.action"),
      }
    }
    case "settled":
      return null
  }
}

/**
 * L'étape appelle-t-elle une action de la personne ? `private` est un ÉTAT
 * choisi, pas une chose à régler : il s'affiche sans presser.
 */
export function profileOnboardingIsUrgent(step: ProfileOnboardingStep): boolean {
  return step.kind === "publish"
}
