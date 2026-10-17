"use client"

import { api } from "@antsia/api/engine"
import { useAuthenticatedConvexQuery } from "@antsia/api/hooks"
import { useNetwork } from "@antsia/api/network"
import { GABON_PROVINCES, isProvinceSlug } from "@antsia/social-domain/provinces"
import { PostCard } from "@antsia/social-features/reseau-personnel"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useId } from "react"
import { useTranslation } from "react-i18next"

import { MemberPage } from "@/components/member-chrome"
import { Button, Field } from "@/components/shared/controls"
import { routes } from "@/lib/routes"
import type { MemberFeedFilter } from "./member-feed-filter"

export function MemberDiscoveryFeed({ filter }: { filter: Extract<MemberFeedFilter, { kind: "national" }> }) {
  const { t } = useTranslation("memberNetwork")
  const { networkId } = useNetwork()
  const router = useRouter()
  const id = useId()
  const query = useAuthenticatedConvexQuery(api.modules.discovery.discovery.rootFeed, {
    networkId,
    paginationOpts: { numItems: 20, cursor: filter.cursor ?? null, maximumRowsRead: 100, maximumBytesRead: 1_048_576 },
    ...(filter.province ? { province: filter.province } : {}),
    ...(filter.tag ? { tag: filter.tag } : {}),
  })
  const province = GABON_PROVINCES.find((item) => item.slug === filter.province)
  const page = query.data
  const now = Date.now()

  return <MemberPage>
    <div className="mx-auto flex max-w-3xl flex-col gap-5 pb-[env(safe-area-inset-bottom)]">
      <header className="flex flex-col gap-2">
        <Link href={routes.feed()} className="inline-flex min-h-11 items-center self-start rounded-lg px-3 text-sm underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{t("discovery.back")}</Link>
        <h1 className="text-2xl font-semibold">{province ? t("discovery.provinceTitle", { name: province.name }) : filter.tag ? t("discovery.tagTitle", { tag: filter.tag }) : t("discovery.nationalTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("discovery.memberScope")}</p>
      </header>
      <Field id={id} label={t("discovery.provinceLabel")}>
        <select id={id} value={filter.province ?? ""} className="min-h-11 w-full rounded-lg border border-input bg-background px-3 text-base text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onChange={(event) => router.push(isProvinceSlug(event.target.value) ? routes.memberProvince(event.target.value) : routes.nationalFeed())}>
          <option value="">{t("discovery.allProvinces")}</option>
          {GABON_PROVINCES.map((item) => <option key={item.slug} value={item.slug}>{item.name}</option>)}
        </select>
      </Field>
      <Link href={routes.discover()} className="inline-flex min-h-11 items-center self-start rounded-lg px-3 text-sm underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{t("discovery.publicDiscover")}</Link>
      {query.error ? <div role="alert" className="rounded-xl border border-destructive p-4"><p>{t("common.failed")}</p><Button variant="outline" onClick={() => void query.refetch()}>{t("common.retry")}</Button></div>
        : !page ? <p role="status">{t("common.loading")}</p>
          : <>
            {page.page.length === 0 ? <p role="status" className="rounded-xl border border-border bg-card p-5 text-muted-foreground">{t(page.isDone ? "discovery.empty" : "discovery.emptyWindow")}</p> : page.page.map((post) => <PostCard key={post._id} post={post} now={now} onTag={(tag) => router.push(routes.memberTag(tag))} onMention={(handle) => router.push(routes.profile(handle))} />)}
            <nav aria-label={t("discovery.pagination")} className="flex flex-wrap items-center justify-between gap-2">
              {filter.cursor ? <Link href={routes.memberFeedWindow(filter)} className="inline-flex min-h-11 items-center rounded-lg border border-border px-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{t("common.firstPage")}</Link> : <span />}
              {!page.isDone ? <Button variant="outline" disabled={!page.continueCursor || page.continueCursor === filter.cursor} onClick={() => router.push(routes.memberFeedWindow(filter, page.continueCursor))}>{t("common.next")}</Button> : <p role="status" className="text-sm text-muted-foreground">{t("common.end")}</p>}
            </nav>
          </>}
    </div>
  </MemberPage>
}
