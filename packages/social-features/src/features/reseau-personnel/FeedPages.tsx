// Dupliqué de socle/packages/agent-features/src/features/reseau-personnel/FeedPages.tsx @ ad2e7fdc2 — adaptations : fil `posts.posts.myFeed` du moteur avec le réseau courant (`useNetwork().networkId`), portées du domaine (sans « mon_administration ») ; cartes rendues avec la projection du moteur (clé `_id`) ; le rail des pages à suivre est celui que le lot des pages réécrit sur le moteur (`./PagesSuggestionsRail`, mêmes nom et props qu'au socle) ; état vide du kit d'espace de `@antsia/ui/espace-kit` ; commentaires rapportés à la page réseau (« personnes » au lieu d'« agents »).
"use client"

/**
 * FeedPages — UNE page du fil, et l'état vide qui la remplace.
 *
 * Ces deux composants vivaient au bas de `ReseauAgentPage.tsx` jusqu'au
 * 2026-08-18. Ils en sont sortis pour la même raison que `useReseauFeedState` :
 * la coquille mobile monte un AUTRE écran sur la page réseau, qui rend la
 * même chaîne de pages. Les recopier aurait donné deux machines à pagination —
 * celle du bureau et celle du téléphone — qui divergent au premier correctif.
 *
 * Rien d'autre n'a changé : ni les props, ni l'effet de publication du curseur,
 * ni l'entrelacement des suggestions.
 */

import { api } from "@antsia/api/engine"
import { useAuthenticatedConvexQuery } from "@antsia/api/hooks"
import { useNetwork } from "@antsia/api/network"
import { SkeletonCard } from "@antsia/ui"
import { EspaceEmptyState } from "@antsia/ui/espace-kit"
import { Fragment, useEffect, type ReactNode } from "react"
import { PostCard } from "./PostCard"
import { PagesSuggestionsRail } from "./PagesSuggestionsRail"
import { SuggestionsPanel } from "./SuggestionsPanel"
import { feedScopeArg, type FeedScope } from "./feed-scopes"
import { feedCursorKey } from "./reseau-feed-pages"
import type { ReseauFeedCursor } from "./useReseauFeedState"

/**
 * Adaptateur vers l'état vide du kit d'espace (`EspaceEmptyState`) : bordure
 * pointillée et radius 8 disparaissent, remplacés par le filet plein et le
 * radius 18 de `.esk-empty` — la même grammaire que le reste de l'espace.
 * Export et props INCHANGÉS : l'arbre mobile (`mobile/ReseauMobileFeed.tsx`)
 * monte ce composant tel quel.
 */
export function EmptyFeed({ text }: { text: string }) {
  return <EspaceEmptyState text={text} />
}

/**
 * UNE page du fil, avec son curseur et son abonnement.
 *
 * Composant à part entière — et pas une boucle dans le parent — parce qu'un
 * `useQuery` par page est ce qui permet à chacune de rester en temps réel sans
 * jamais appeler un hook dans une condition.
 */
export function FeedPage({
  cursor,
  pageIndex,
  pageKey,
  nextMountedCursor,
  tag,
  scope,
  now,
  isFirst,
  isLast,
  interleaveAfter,
  onTag,
  onMention,
  onTail,
  onBoundaryShift,
  emptyFallback,
}: {
  cursor: ReseauFeedCursor | null
  pageIndex: number
  pageKey: string
  nextMountedCursor: ReseauFeedCursor | null | undefined
  tag?: string
  scope: FeedScope
  now: number
  isFirst: boolean
  isLast: boolean
  interleaveAfter: ((count: number) => number | null) | null
  onTag: (tag: string) => void
  onMention: (handle: string) => void
  onTail: (pageKey: string, cursor: ReseauFeedCursor | null) => void
  onBoundaryShift: (pageIndex: number, cursor: ReseauFeedCursor | null) => void
  emptyFallback: ReactNode
}) {
  const { networkId } = useNetwork()
  const page = useAuthenticatedConvexQuery(
    api.modules.posts.posts.myFeed,
    {
      networkId,
      ...(cursor === null ? {} : { cursor }),
      ...(tag === undefined ? {} : { tag }),
      // `undefined` pour la portée par défaut : la query garde exactement la
      // signature qu'elle avait avant les chips (cf. `feedScopeArg`).
      ...(feedScopeArg(scope) === undefined
        ? {}
        : { scope: feedScopeArg(scope) }),
    }
  )

  const items = page.data?.items ?? []
  const nextCursor = page.data?.nextCursor ?? null

  /**
   * La DERNIÈRE page publie son curseur au parent — elle seule peut en avoir
   * un. Dans un EFFET, jamais pendant le rendu : remonter un état au parent
   * pendant qu'on rend est un effet de bord que React n'a aucune obligation de
   * respecter (double rendu du mode strict, rendu abandonné, concurrence).
   */
  useEffect(() => {
    if (page.data === undefined) return
    if (isLast) {
      onTail(pageKey, nextCursor)
      return
    }
    if (
      feedCursorKey(nextCursor) !== feedCursorKey(nextMountedCursor ?? null)
    ) {
      onBoundaryShift(pageIndex, nextCursor)
    }
  }, [
    isLast,
    nextCursor,
    nextMountedCursor,
    onBoundaryShift,
    onTail,
    page.data,
    pageIndex,
    pageKey,
  ])

  if (page.isLoading) {
    return (
      <>
        <SkeletonCard />
        {isFirst ? <SkeletonCard /> : null}
      </>
    )
  }

  if (items.length === 0) return isFirst ? <>{emptyFallback}</> : null

  const interleaveIndex = interleaveAfter ? interleaveAfter(items.length) : null

  return (
    <>
      {items.map((post, index) => (
        <Fragment key={post._id}>
          <PostCard post={post} now={now} onTag={onTag} onMention={onMention} />
          {/* La découverte se consomme AU FIL du défilement sur mobile : deux
              modules distincts, personnes réciproques puis pages unilatérales.
              Le bureau masque cette pile car son rail droit porte les mêmes
              données en vertical. */}
          {index + 1 === interleaveIndex ? (
            <div
              className="rp-feed-inline"
              style={{ flexDirection: "column", gap: 12 }}
            >
              <SuggestionsPanel presentation="carousel" />
              <PagesSuggestionsRail presentation="carousel" />
            </div>
          ) : null}
        </Fragment>
      ))}
    </>
  )
}
