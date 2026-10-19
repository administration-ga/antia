"use client"

import { api, type Id } from "@antsia/api/engine"
import { useAuthenticatedConvexQuery } from "@antsia/api/hooks"
import { useNetwork } from "@antsia/api/network"
import { Button } from "@antsia/ui"
import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from "react"
import { useTranslation } from "react-i18next"

import { AGENDA_NATIVE_PAGE_SIZE, AGENDA_STREAMS, agendaPageState, appendAgendaPages, initialAgendaPages, mergedAgendaRows, recordAgendaPage, type AgendaStream, type AgendaStreamKey } from "./agenda-pagination"
import type { AgendaRow, AssociationAgendaItem } from "./association-agenda"
import type { CursorPageMount, CursorPageSnapshot } from "./cursor-pages"
import type { EvenementListItem } from "./evenements-list"

export interface AgendaPaginationValue {
  readonly data: { readonly items: readonly EvenementListItem[]; readonly associationItems: readonly AssociationAgendaItem[]; readonly truncated: false } | undefined
  readonly isLoading: boolean
  readonly isPending: boolean
  readonly isFetching: boolean
  readonly isError: boolean
  readonly refetch: () => void
  readonly controls: ReactNode
  readonly canLoadMore: boolean
  readonly loadingMore: boolean
}

interface AgendaPaginationProps {
  readonly now: number
  readonly children: (value: AgendaPaginationValue) => ReactNode
}

const INACTIVE: AgendaPaginationValue = { data: undefined, isLoading: false, isPending: false, isFetching: false, isError: false, refetch: () => {}, controls: null, canLoadMore: false, loadingMore: false }

export function AgendaPagination(props: AgendaPaginationProps) {
  const { networkId, personId } = useNetwork()
  if (!personId) return <>{props.children(INACTIVE)}</>
  return <ScopedAgendaPagination key={`${networkId}:${personId}`} {...props} networkId={networkId} personId={personId} />
}

function AgendaWindow(props: {
  readonly networkId: Id<"networks">
  readonly personId: Id<"persons">
  readonly anchor: number
  readonly stream: AgendaStream
  readonly mount: CursorPageMount
  readonly generation: number
  readonly report: (generation: number, stream: AgendaStreamKey, mount: CursorPageMount, snapshot: CursorPageSnapshot<AgendaRow>) => void
}) {
  const query = useAuthenticatedConvexQuery(api.modules.events.events.paginateMyAgenda, {
    networkId: props.networkId, expectedReaderPersonId: props.personId, source: props.stream.source, period: props.stream.period, anchor: props.anchor,
    paginationOpts: { cursor: props.mount.cursor, numItems: AGENDA_NATIVE_PAGE_SIZE },
  })
  const needsRefresh = props.generation > 0 && props.mount.cursor === null
  const [refreshed, setRefreshed] = useState(!needsRefresh)
  const [refreshFailed, setRefreshFailed] = useState(false)
  const refetch = useRef(query.refetch)
  useLayoutEffect(() => {
    if (!needsRefresh) return
    let active = true
    void Promise.resolve().then(() => refetch.current()).then(
      () => { if (active) setRefreshed(true) },
      () => { if (active) { setRefreshFailed(true); setRefreshed(true) } },
    )
    return () => { active = false }
  }, [needsRefresh])
  useLayoutEffect(() => {
    const pending = !refreshed || query.isPending || query.isLoading || query.isFetching
    props.report(props.generation, props.stream.key, props.mount, {
      data: pending || query.isError || refreshFailed ? undefined : query.data,
      isPending: pending,
      // Pendant Réessayer, l'ancien drapeau d'erreur n'est pas une réponse neuve.
      isError: refreshFailed || (refreshed && query.isError),
    })
  }, [props.generation, props.stream.key, props.mount, props.report, query.data, query.isPending, query.isLoading, query.isFetching, query.isError, refreshed, refreshFailed])
  return null
}

function ScopedAgendaPagination(props: AgendaPaginationProps & { readonly networkId: Id<"networks">; readonly personId: Id<"persons"> }) {
  const { t } = useTranslation("reseau")
  const [anchor] = useState(props.now)
  const [generation, setGeneration] = useState(0)
  const liveGeneration = useRef(0)
  const [state, setState] = useState(initialAgendaPages)
  const report = useCallback((fromGeneration: number, stream: AgendaStreamKey, mount: CursorPageMount, snapshot: CursorPageSnapshot<AgendaRow>) => {
    if (fromGeneration !== liveGeneration.current) return
    setState((current) => recordAgendaPage(current, stream, mount, snapshot))
  }, [])
  const retry = () => {
    liveGeneration.current += 1
    setState(initialAgendaPages())
    setGeneration(liveGeneration.current)
  }
  const status = agendaPageState(state)
  const rows = mergedAgendaRows(state)
  const data: AgendaPaginationValue["data"] = state.failed || status.waiting ? undefined : {
    items: rows.flatMap((row) => row.kind === "personal" ? [row.event] : []),
    associationItems: rows.flatMap((row) => row.kind === "association" ? [row.event] : []),
    truncated: false,
  }
  const controls = <div style={{ display: "grid", gap: 8 }}>
    {!state.failed && !status.exhausted ? <p role="status" aria-live="polite" style={{ margin: 0, fontSize: 12, color: "var(--muted-foreground)" }}>{t(status.waiting ? "associationAgenda.pagination.loading" : "associationAgenda.pagination.loaded")}</p> : null}
    {status.canLoadMore || status.loadingMore || state.failed ? <Button variant="secondary" disabled={status.waiting || state.failed} onClick={() => setState(appendAgendaPages)}>{t(status.loadingMore ? "associationAgenda.pagination.loadingMore" : "associationAgenda.pagination.more")}</Button> : null}
  </div>
  const readers = AGENDA_STREAMS.flatMap((stream) => state.streams[stream.key].mounts.map((mount) => <AgendaWindow key={`${generation}:${stream.key}:${mount.id}`} networkId={props.networkId} personId={props.personId} anchor={anchor} stream={stream} mount={mount} generation={generation} report={report} />))
  return <>{readers}{props.children({ data, isLoading: status.waiting, isPending: status.waiting, isFetching: status.waiting, isError: state.failed, refetch: retry, controls, canLoadMore: status.canLoadMore, loadingMore: status.loadingMore })}</>
}
