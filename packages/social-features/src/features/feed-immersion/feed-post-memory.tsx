"use client"

/**
 * feed-post-memory — la mémoire d'UNE publication du fil pour sa galerie
 * (lot P04, 04 §4 : « restaure post, index de galerie et décalage »).
 *
 * Deux contextes, du plus large au plus fin :
 *  · la SURFACE (le fil monté : téléphone, bureau, fil national) sait quel
 *    index de galerie restaurer pour la publication retrouvée, et retient
 *    l'index courant de chacune ;
 *  · la PUBLICATION (`FeedPostMemoryScope`, posé par le créneau du lecteur ou
 *    l'enveloppe de la carte en liste) donne à sa galerie son index initial et
 *    son rappel.
 *
 * La galerie de la présentation « media » (`PostMediaPresentation`) lit le
 * second, et seulement pour les médias de la publication elle-même (ceux qui
 * traversent la gouttière de la carte) — jamais pour une publication citée.
 * Hors de ces contextes : `null`, la galerie démarre à la première image comme
 * avant.
 */
import { createContext, useContext, useMemo, type ReactNode } from "react"

export interface FeedPostMemory {
  /** L'index de galerie à rétablir, ou `null` (première image). */
  initialGalleryIndex: number | null
  reportGalleryIndex: (index: number) => void
}

export interface FeedSurfaceMemory {
  initialGalleryIndex: (postId: string) => number | null
  reportGalleryIndex: (postId: string, index: number) => void
}

const FeedSurfaceMemoryContext = createContext<FeedSurfaceMemory | null>(null)
const FeedPostMemoryContext = createContext<FeedPostMemory | null>(null)

export function FeedSurfaceMemoryProvider({ value, children }: { value: FeedSurfaceMemory | null; children: ReactNode }) {
  return <FeedSurfaceMemoryContext.Provider value={value}>{children}</FeedSurfaceMemoryContext.Provider>
}

/** La mémoire d'une publication, bâtie sur celle de la surface (rien hors surface). */
export function FeedPostMemoryScope({ postId, children }: { postId: string; children: ReactNode }) {
  const surface = useContext(FeedSurfaceMemoryContext)
  const value = useMemo<FeedPostMemory | null>(
    () =>
      surface === null
        ? null
        : {
            initialGalleryIndex: surface.initialGalleryIndex(postId),
            reportGalleryIndex: (index: number) => surface.reportGalleryIndex(postId, index),
          },
    [surface, postId],
  )
  return <FeedPostMemoryContext.Provider value={value}>{children}</FeedPostMemoryContext.Provider>
}

/** La mémoire de la publication englobante, ou `null` hors du fil. */
export function useOptionalFeedPostMemory(): FeedPostMemory | null {
  return useContext(FeedPostMemoryContext)
}
