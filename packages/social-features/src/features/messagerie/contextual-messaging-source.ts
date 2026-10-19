"use client"

/**
 * CC-5 (contrat CONVERSATION-CONTEXTUELLE-V1 §10.1, §11.3 ; ADR-0025) — la SOURCE des
 * conversations contextuelles : d'où viennent leurs fils et leurs messages, où partent leurs
 * gestes. Troisième famille, à côté de la boîte personnelle (`SOURCE_AGENT`) et du canal P10
 * (`COMMERCIAL_MESSAGING_SOURCE`) : elle n'en lit aucune, ne leur écrit rien, et aucun de ses
 * identifiants ne se convertit vers l'une d'elles (§11.3, N44).
 *
 * Même contrat que la source personnelle (`messagerie-source.ts`) :
 *  · une CONSTANTE DE MODULE dont les membres sont des hooks, appelés inconditionnellement par
 *    les vues — jamais une source construite dans le rendu ;
 *  · les listes rendent `SourcePageListe` : une panne, une attente et une query désactivée se
 *    DISENT (IC-07), la première page reste VIVANTE et les suivantes s'accumulent (IC-06) ;
 *  · le RÉSEAU appartient à la source : il est injecté APRÈS les arguments, si bien qu'un appelant
 *    qui glisserait un `networkId` ne choisirait jamais un autre réseau.
 *
 * Les droits ne sont jamais reconstruits ici : chaque lecture et chaque écriture est relue en
 * entier par le moteur (§4.2). Un non-partie reçoit `null` en lecture et `notFound` en écriture,
 * comme pour un identifiant inventé — la source ne fait que le transmettre.
 *
 * Appels (CC-4, livré le 19/10) : `calls.setCallConsent` `{ threadId, allowed }` → `null` et
 * `calls.start` `{ threadId, targetPersonId?, mediaType }` → le résultat d'un appel direct
 * (`DirectCallResult`, jamais de messagerie vocale). L'effet des réglages du LECTEUR se lit dans la
 * projection du fil (`callSettings`) : la source ne lit aucun autre réglage. Les types de ces portes
 * n'existent qu'après la génération du moteur.
 */
import { api, type Id } from "@antsia/api/engine"
import { useAuthenticatedConvexQuery, useAuthenticatedPaginatedQuery } from "@antsia/api/hooks"
import { useNetwork } from "@antsia/api/network"
import { CONTEXTUAL_THREADS_PAGE_MAX, type ContextualKind } from "@antsia/social-domain/contextualMessaging"
import { useMutation } from "convex/react"
import type { FunctionArgs, FunctionReturnType } from "convex/server"
import { useCallback, useEffect, useMemo, useState } from "react"

import { fusionnerPagesFils, type SourcePageListe } from "./messagerie-source"

const backend = api.modules.contextualMessaging

/** UN fil contextuel, tel que le moteur le projette pour CE lecteur (§10.1). */
export type ContextualThread = NonNullable<FunctionReturnType<typeof backend.threads.getThread>>
export type ContextualThreadId = ContextualThread["threadId"]
/** L'objet ouvrant (nature + identifiant typé) — jamais une chaîne libre. */
export type ContextualObjectRef = NonNullable<ContextualThread["object"]>
/** UN message projeté (forme P10) : ni clé, ni empreinte, ni identifiant de stockage. */
export type ContextualMessage = FunctionReturnType<typeof backend.messages.paginateMessages>["page"][number]
export type ContextualMessageId = ContextualMessage["messageId"]
/** Une pièce DÉCLARÉE à l'envoi (dépôt frais, au nom de l'émetteur — la garde le relit). */
export type ContextualAttachment = NonNullable<FunctionArgs<typeof backend.messages.send>["attachments"]>[number]
/** Le curseur de `paginateMine` : un côté demandeur, un côté répondant-personne. */
export type ContextualMineCursor = NonNullable<FunctionReturnType<typeof backend.threads.paginateMine>["nextCursor"]>
/** Ce que rend le démarrage d'un appel contextuel (CC-4) : le résultat d'un appel direct. */
export type ContextualStartCallResult = FunctionReturnType<typeof backend.calls.start>

/** La taille d'une page de fils — la borne du moteur (`CONTEXTUAL_THREADS_PAGE_MAX`). */
export const CONTEXTUAL_THREADS_PAGE = CONTEXTUAL_THREADS_PAGE_MAX

/** La taille d'une page de messages (≤ 40, la borne de `paginateMessages`). */
export const CONTEXTUAL_MESSAGES_PAGE = 30

type Networkless<T> = Omit<T, "networkId">

/** UN fil lu : `undefined` tant que la réponse n'est pas là, `null` pour tout refus (indistinct). */
export interface ContextualThreadQuery {
  data: ContextualThread | null | undefined
  isLoading: boolean
  isError: boolean
  enabled: boolean
  refetch: () => void
}

/**
 * Les messages d'un fil, en pages Convex VIVANTES (un retrait ou une décision de modération dans
 * une page ancienne se voit aussitôt). ⚠️ Une page refusée LÈVE au rendu : la vue la tient dans
 * `ReseauPaginatedErrorBoundary`.
 */
export interface ContextualMessagesPage {
  results: readonly ContextualMessage[]
  status: "LoadingFirstPage" | "CanLoadMore" | "LoadingMore" | "Exhausted"
  loadMore: (numItems: number) => void
  isLoading: boolean
}

/** Les écritures d'un fil contextuel, réseau injecté par la source. */
export interface ContextualWrites {
  /** Ouverture idempotente par une partie actuelle d'un objet déjà en phase `open` (§4.1). */
  openForObject: (object: ContextualObjectRef) => Promise<FunctionReturnType<typeof backend.threads.openForObject>>
  /** L'envoi idempotent : la clé est celle de l'intention locale (`useConversationSend`). */
  send: (args: Networkless<FunctionArgs<typeof backend.messages.send>>) => Promise<FunctionReturnType<typeof backend.messages.send>>
  /** L'URL de dépôt GARDÉE (`chat_attachment`) : la seule porte d'une pièce. */
  generateUploadUrl: (threadId: ContextualThreadId) => Promise<string>
  /** Lecture marquée : aucune trace montrée à l'autre côté. */
  markRead: (threadId: ContextualThreadId) => Promise<null>
  /** Clôture par un côté (D12), irréversible, contre la révision lue. */
  close: (args: Networkless<FunctionArgs<typeof backend.threads.close>>) => Promise<null>
  /** Retrait de SON message (émetteur seul) ; ses pièces sont purgées avec lui. */
  remove: (args: Networkless<FunctionArgs<typeof backend.messages.remove>>) => Promise<null>
  /** Signalement d'un message d'en face, sur la surface unique `contextualMessage`. */
  report: (messageId: ContextualMessageId, reason: string) => Promise<FunctionReturnType<typeof api.modules.moderation.cases.report>>
  /** CC-4 : son PROPRE accord d'appel, dans ce fil seulement ; le retrait est toujours possible. */
  setCallConsent: (args: { threadId: ContextualThreadId; allowed: boolean }) => Promise<null>
  /** CC-4 : démarrer un appel ; `targetPersonId` seulement pour le demandeur face à une page. */
  startCall: (args: { threadId: ContextualThreadId; targetPersonId?: Id<"persons">; mediaType: "audio" | "video" }) => Promise<ContextualStartCallResult>
}

export interface ContextualMessagingSource {
  espace: "contextuel"
  /** MES fils (demandeur ou répondant-personne), par pages d'activité ; filtre de nature facultatif. */
  useMyThreadsPage: (kind?: ContextualKind) => SourcePageListe<ContextualThread>
  /** Les fils d'une page dont je suis signataire VIVANT ; `null` désarme la lecture. */
  usePageThreadsPage: (pageId: Id<"pages"> | null, kind?: ContextualKind) => SourcePageListe<ContextualThread>
  /** UN fil par son identifiant (route, notification) ; `null` désarme la lecture. */
  useThread: (threadId: ContextualThreadId | null) => ContextualThreadQuery
  /** Le fil d'un objet, pour les écrans de l'objet ; ne crée rien. */
  useThreadForObject: (object: ContextualObjectRef | null) => ContextualThreadQuery
  /** Les messages d'un fil ; `null` désarme la lecture (aucun message n'est demandé sans fil). */
  useMessages: (threadId: ContextualThreadId | null) => ContextualMessagesPage
  useWrites: () => ContextualWrites
}

/**
 * Deux curseurs de `paginateMine` désignent-ils le MÊME endroit ? Garde-fou de boucle : le
 * curseur est un objet reconstruit par chaque réponse — on compare ses quatre nombres.
 */
export function contextualCursorsEqual(a: ContextualMineCursor | null, b: ContextualMineCursor | null): boolean {
  if (a === null || b === null) return a === b
  const side = (x: ContextualMineCursor["requester"], y: ContextualMineCursor["requester"]) => (x === null || y === null ? x === y : x.at === y.at && x.ct === y.ct)
  return side(a.requester, b.requester) && side(a.responder, b.responder)
}

/** Le curseur d'une pagination Convex standard (`paginateForPage`) : une chaîne opaque. */
function samePageCursor(a: string | null, b: string | null): boolean {
  return a === b
}

/** Une page de fils, ramenée à ses éléments et au curseur de la suivante (`null` : épuisée). */
interface ThreadsPage<Cursor> {
  items: readonly ContextualThread[]
  next: Cursor | null
}

interface PageQuery<Cursor> {
  data: ThreadsPage<Cursor> | undefined
  isLoading: boolean
  isError: boolean
  error: unknown
  isFetching: boolean
  refetch: () => void
}

/**
 * L'accumulation des pages de fils, commune aux deux listes (technique de
 * `SOURCE_AGENT.useThreadsPage`) : la PREMIÈRE page reste souscrite (c'est là qu'un fil réactivé
 * remonte), la page suivante est lue par une seconde query puis accumulée ; un fil réactivé n'est
 * jamais compté deux fois (`fusionnerPagesFils`, la page vivante gagne). Les pages anciennes sont
 * des photographies — le compromis assumé de la boîte personnelle.
 */
function useAccumulatedThreads<Cursor>(input: {
  first: PageQuery<Cursor>
  more: PageQuery<Cursor>
  cursor: Cursor | null
  setCursor: (cursor: Cursor) => void
  equal: (a: Cursor | null, b: Cursor | null) => boolean
  enabled: boolean
}): SourcePageListe<ContextualThread> {
  const { first, more, cursor, setCursor, equal, enabled } = input
  const [older, setOlder] = useState<ContextualThread[]>([])
  const [next, setNext] = useState<Cursor | null>(null)
  const [exhausted, setExhausted] = useState(false)
  const firstPage = first.data
  const firstNext = firstPage?.next ?? null
  // Tant qu'aucune suite n'a été demandée, le curseur de la première page EST le suivant.
  useEffect(() => {
    if (cursor !== null) return
    setNext((current) => (equal(current, firstNext) ? current : firstNext))
    setExhausted(firstPage !== undefined && firstNext === null)
  }, [cursor, firstNext, firstPage, equal])
  // Une page supplémentaire est arrivée : elle s'ajoute, son curseur devient le suivant.
  const morePage = more.data
  useEffect(() => {
    if (morePage === undefined) return
    setOlder((already) => fusionnerPagesFils(already, morePage.items))
    setNext(morePage.next)
    setExhausted(morePage.next === null)
  }, [morePage])
  const items = useMemo(() => (firstPage === undefined ? undefined : fusionnerPagesFils(firstPage.items, older)), [firstPage, older])
  const loadMore = useCallback(() => {
    if (next !== null) setCursor(next)
  }, [next, setCursor])
  return {
    data: enabled ? items : undefined,
    isLoading: enabled && first.isLoading,
    isError: enabled && (first.isError || more.isError),
    error: first.error ?? more.error,
    refetch: () => {
      first.refetch()
      if (cursor !== null) more.refetch()
    },
    isFetching: enabled && first.isFetching,
    enabled,
    hasMore: enabled && !exhausted && next !== null,
    loadMore,
    isLoadingMore: enabled && cursor !== null && more.isFetching,
  }
}

/** Une query TanStack ramenée à une page de fils (`select` local, données de l'API inchangées). */
function pageQuery<Data, Cursor>(
  query: { data: Data | undefined; isLoading: boolean; isError: boolean; error: unknown; isFetching: boolean; refetch: () => unknown },
  data: ThreadsPage<Cursor> | undefined,
): PageQuery<Cursor> {
  return { data, isLoading: query.isLoading, isError: query.isError, error: query.error, isFetching: query.isFetching, refetch: () => void query.refetch() }
}

/** Le filtre de nature n'est transmis que s'il est choisi (aucun champ `undefined` vers le moteur). */
function kindFilter(kind: ContextualKind | undefined): { kind?: ContextualKind } {
  return kind === undefined ? {} : { kind }
}

export const CONTEXTUAL_MESSAGING_SOURCE: ContextualMessagingSource = {
  espace: "contextuel",
  useMyThreadsPage(kind) {
    const { networkId } = useNetwork()
    const [cursor, setCursor] = useState<ContextualMineCursor | null>(null)
    const first = useAuthenticatedConvexQuery(backend.threads.paginateMine, { networkId, limit: CONTEXTUAL_THREADS_PAGE, ...kindFilter(kind) })
    const more = useAuthenticatedConvexQuery(backend.threads.paginateMine, cursor === null ? "skip" : { networkId, cursor, limit: CONTEXTUAL_THREADS_PAGE, ...kindFilter(kind) })
    const firstData = useMemo(() => (first.data === undefined ? undefined : { items: first.data.items, next: first.data.nextCursor }), [first.data])
    const moreData = useMemo(() => (more.data === undefined ? undefined : { items: more.data.items, next: more.data.nextCursor }), [more.data])
    return useAccumulatedThreads<ContextualMineCursor>({
      first: pageQuery(first, firstData),
      more: pageQuery(more, moreData),
      cursor,
      setCursor,
      equal: contextualCursorsEqual,
      enabled: true,
    })
  },
  usePageThreadsPage(pageId, kind) {
    const { networkId } = useNetwork()
    const [cursor, setCursor] = useState<string | null>(null)
    const first = useAuthenticatedConvexQuery(
      backend.threads.paginateForPage,
      pageId === null ? "skip" : { networkId, pageId, paginationOpts: { numItems: CONTEXTUAL_THREADS_PAGE, cursor: null }, ...kindFilter(kind) },
    )
    const more = useAuthenticatedConvexQuery(
      backend.threads.paginateForPage,
      pageId === null || cursor === null ? "skip" : { networkId, pageId, paginationOpts: { numItems: CONTEXTUAL_THREADS_PAGE, cursor }, ...kindFilter(kind) },
    )
    const firstData = useMemo(() => (first.data === undefined ? undefined : { items: first.data.page, next: first.data.isDone ? null : first.data.continueCursor }), [first.data])
    const moreData = useMemo(() => (more.data === undefined ? undefined : { items: more.data.page, next: more.data.isDone ? null : more.data.continueCursor }), [more.data])
    return useAccumulatedThreads<string>({
      first: pageQuery(first, firstData),
      more: pageQuery(more, moreData),
      cursor,
      setCursor,
      equal: samePageCursor,
      enabled: pageId !== null,
    })
  },
  useThread(threadId) {
    const { networkId } = useNetwork()
    const q = useAuthenticatedConvexQuery(backend.threads.getThread, threadId === null ? "skip" : { networkId, threadId })
    return {
      data: threadId === null ? undefined : q.data,
      isLoading: threadId !== null && q.isLoading,
      isError: threadId !== null && q.isError,
      enabled: threadId !== null,
      refetch: () => void q.refetch(),
    }
  },
  useThreadForObject(object) {
    const { networkId } = useNetwork()
    const q = useAuthenticatedConvexQuery(backend.threads.findForObject, object === null ? "skip" : { networkId, context: object })
    return {
      data: object === null ? undefined : q.data,
      isLoading: object !== null && q.isLoading,
      isError: object !== null && q.isError,
      enabled: object !== null,
      refetch: () => void q.refetch(),
    }
  },
  useMessages(threadId) {
    const { networkId } = useNetwork()
    return useAuthenticatedPaginatedQuery(
      backend.messages.paginateMessages,
      threadId === null ? "skip" : { networkId, threadId },
      { initialNumItems: CONTEXTUAL_MESSAGES_PAGE },
    )
  },
  useWrites() {
    const { networkId } = useNetwork()
    const open = useMutation(backend.threads.openForObject)
    const send = useMutation(backend.messages.send)
    const upload = useMutation(backend.messages.generateUploadUrl)
    const read = useMutation(backend.threads.markRead)
    const close = useMutation(backend.threads.close)
    const remove = useMutation(backend.messages.remove)
    const report = useMutation(api.modules.moderation.cases.report)
    const consent = useMutation(backend.calls.setCallConsent)
    const start = useMutation(backend.calls.start)
    return useMemo<ContextualWrites>(() => ({
      openForObject: (object) => open({ context: object, networkId }),
      send: (args) => send({ ...args, networkId }),
      generateUploadUrl: (threadId) => upload({ threadId, networkId }),
      markRead: (threadId) => read({ threadId, networkId }),
      close: (args) => close({ ...args, networkId }),
      remove: (args) => remove({ ...args, networkId }),
      report: (messageId, reason) => report({ target: { kind: "contextualMessage", id: messageId }, reason, networkId }),
      setCallConsent: (args) => consent({ threadId: args.threadId, allowed: args.allowed, networkId }),
      startCall: (args) => start({
        threadId: args.threadId,
        mediaType: args.mediaType,
        ...(args.targetPersonId === undefined ? {} : { targetPersonId: args.targetPersonId }),
        networkId,
      }),
    }), [networkId, open, send, upload, read, close, remove, report, consent, start])
  },
}
