"use client"

import { api, type Id } from "@antsia/api/engine"
import { useMutation, useQuery } from "convex/react"
import type { FunctionReturnType } from "convex/server"
import { ConvexError } from "convex/values"
import { Scale } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import { ConsoleDate, EmptyRows, LoadingRows, MotiveAction, panelClass, useWindowCursor, WindowPagination } from "./console-operation-controls"

type Appeal = FunctionReturnType<typeof api.modules.moderation.cases.paginatePlatformQueue>["page"][number]
function AppealDecision({ appeal }: { appeal: Appeal }) {
  const { t } = useTranslation("operations")
  const review = useMutation(api.modules.moderation.cases.reviewPlatformAppeal)
  const locked = useRef(false)
  const live = useRef(true)
  const [pending, setPending] = useState(false)
  useEffect(() => { live.current = true; return () => { live.current = false } }, [])
  const decide = async (overturn: boolean, reason: string) => {
    if (locked.current || !live.current) throw new ConvexError({ code: "conflict" })
    locked.current = true
    setPending(true)
    try { return await review({ appealId: appeal.appealId, overturn, reason }) }
    finally { locked.current = false; if (live.current) setPending(false) }
  }
  return <li className="flex min-w-0 flex-col gap-3 rounded-lg border border-border p-4">
    <p className="text-sm text-muted-foreground"><ConsoleDate at={appeal.createdAt} /></p>
    <p className="whitespace-pre-wrap break-words text-sm">{appeal.reason}</p>
    <div className="flex flex-wrap gap-3">
      <MotiveAction label={t("appeals.uphold")} disabled={pending} onDecision={(reason) => decide(false, reason)} />
      <MotiveAction label={t("appeals.overturn")} disabled={pending} onDecision={(reason) => decide(true, reason)} />
    </div>
  </li>
}

export function AppealsPanel({ networkId }: { networkId: Id<"networks"> }) {
  const { t } = useTranslation("operations")
  const window = useWindowCursor()
  const appeals = useQuery(api.modules.moderation.cases.paginatePlatformQueue, { networkId, paginationOpts: { cursor: window.cursor, numItems: 20, maximumRowsRead: 50, maximumBytesRead: 262_144 } })
  return <section className={`${panelClass} flex min-w-0 flex-col gap-4`}>
    <h2 className="flex items-center gap-2 text-xl font-semibold"><Scale size={22} aria-hidden="true" />{t("appeals.title")}</h2>
    <p className="text-sm text-muted-foreground">{t("appeals.lead")}</p>
    <p className="rounded-lg bg-muted p-3 text-sm">{t("appeals.independence")}</p>
    {appeals === undefined ? <LoadingRows /> : appeals.page.length === 0 ? <EmptyRows done={appeals.isDone} /> : <ul className="flex flex-col gap-4">{appeals.page.map((appeal) => <AppealDecision key={appeal.appealId} appeal={appeal} />)}</ul>}
    <WindowPagination window={window} result={appeals} />
  </section>
}
