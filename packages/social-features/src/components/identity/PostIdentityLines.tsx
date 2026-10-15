// Dupliqué de socle/packages/agent-features/src/components/identity/PostIdentityLines.tsx @ ad2e7fdc2 — adaptations : identité SANS fonction ni administration (props `positionTitle`, `orgName` et `scope` retirées, avec la branche « poste ») : nom, badges CALCULÉS (prop `badges`, « Communauté » seul ne s'affiche pas), puis la ligne `@handle`, désormais toujours montrée quand elle est fournie ; `positionClassName` et `orgClassName` deviennent `badgesClassName` et `handleClassName` ; échelles réduites au nom et aux lignes d'appoint (tailles de l'espace personnel du socle) ; libellés des badges par l'i18n.
"use client"

/**
 * PostIdentityLines — l'identité d'une personne, en trois lignes au plus.
 *
 *     Lynda ONANGA ISSAMBO          ← le nom
 *     Vérifié · Agent public        ← les badges CALCULÉS, quand ils disent quelque chose
 *     @lynda.onanga                 ← l'adresse
 *
 * Deux personnes s'y parlent en leur nom propre : aucune fonction ni
 * administration ne se pose sur un nom. Les badges de confiance sont calculés
 * par le serveur à chaque projection — jamais déclarés ; « Communauté » seul
 * n'est pas un signal et ne prend pas de ligne (`post-identity.ts`).
 *
 * ⚠️ Ne PAS fusionner les lignes : chacune est tronquée pour elle-même. Une
 * adresse longue ne doit pas emporter les badges hors du cadre, ni l'inverse.
 *
 * ⚠️ Aucune couleur posée : les lignes HÉRITENT de l'encre ambiante et
 * s'atténuent. C'est ce qui leur permet de tenir sur le fond clair d'une liste
 * comme sur la scène sombre d'un appel, sans variante à maintenir.
 */

import type { Badge } from "@antia/social-domain/badges"
import { cn } from "@antia/ui"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"

import { postEyebrow } from "./post-identity"

export interface PostIdentityLinesProps {
  /** Le nom de la personne, déjà résolu (jamais un identifiant technique). */
  name: ReactNode
  /** Les badges CALCULÉS par le serveur (DTO de personne). */
  badges?: readonly Badge[] | null
  /** La ligne d'appoint — le `@handle`, éventuellement suivi de l'accroche. */
  handleLine?: ReactNode
  /** `md` (défaut) pour une liste, `lg` pour un écran d'appel plein cadre. */
  size?: "sm" | "md" | "lg"
  className?: string
  nameClassName?: string
  badgesClassName?: string
  handleClassName?: string
}

/** Les échelles, par taille : le nom domine, les lignes d'appoint s'effacent. */
const SCALE = {
  sm: { name: "text-[12.5px]", meta: "text-[10.5px]" },
  md: { name: "text-[13.5px]", meta: "text-[11px]" },
  lg: { name: "text-[17px]", meta: "text-[12.5px]" },
} as const

export function PostIdentityLines({
  name,
  badges,
  handleLine,
  size = "md",
  className,
  nameClassName,
  badgesClassName,
  handleClassName,
}: PostIdentityLinesProps) {
  const { t } = useTranslation("reseau")
  const scale = SCALE[size]
  const badgeLine = postEyebrow({ badges }, t)

  return (
    <span className={cn("flex min-w-0 flex-col", className)}>
      <span className={cn("truncate font-medium", scale.name, nameClassName)}>{name}</span>

      {badgeLine !== null ? (
        <span className={cn("truncate leading-tight font-semibold", scale.meta, badgesClassName)} title={badgeLine}>
          {badgeLine}
        </span>
      ) : null}

      {handleLine !== undefined && handleLine !== null ? (
        <span className={cn("truncate opacity-70", scale.meta, handleClassName)}>{handleLine}</span>
      ) : null}
    </span>
  )
}
