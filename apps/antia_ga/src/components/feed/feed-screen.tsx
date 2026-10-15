"use client"

import { BRAND_NAME } from "@antia/social-contracts/brand"
import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"
import { usePaginatedQuery } from "convex/react"
import { LogOut } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import { Composer } from "@/components/feed/composer"
import { PostCard } from "@/components/feed/post-card"
import { Button, CenteredStatus } from "@/components/shared/controls"
import { useSessionState } from "@/components/use-session-state"
import { authClient } from "@/lib/auth-client"
import { routes } from "@/lib/routes"

const PAGE_SIZE = 20

function FeedList({ networkId }: { networkId: Id<"networks"> }) {
  const { t } = useTranslation("antia")
  const { results, status, loadMore } = usePaginatedQuery(api.modules.posts.posts.feed, { networkId }, { initialNumItems: PAGE_SIZE })
  if (status === "LoadingFirstPage") return <CenteredStatus label={t("feed.loading")} />
  if (results.length === 0 && status === "Exhausted") {
    return <p className="rounded-2xl border border-dashed border-border p-6 text-center text-muted-foreground">{t("feed.empty")}</p>
  }
  return (
    <div className="flex flex-col gap-4">
      <ol className="flex flex-col gap-4">
        {results.map((item) => (
          <li key={item._id}>
            <PostCard networkId={networkId} item={item} />
          </li>
        ))}
      </ol>
      {status === "CanLoadMore" || status === "LoadingMore" ? (
        <Button variant="outline" pending={status === "LoadingMore"} onClick={() => loadMore(PAGE_SIZE)}>
          {t("feed.loadMore")}
        </Button>
      ) : null}
    </div>
  )
}

export function FeedScreen() {
  const { t } = useTranslation("antia")
  const router = useRouter()
  const session = useSessionState()
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    if (session.status === "signedOut") router.replace(routes.signIn())
    else if (session.status === "welcome") router.replace(routes.welcome())
  }, [session.status, router])

  if (session.status !== "member") return <CenteredStatus label={t("session.checking")} />
  const { person, root } = session

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-5 py-3">
          <Link href={routes.home()} className="text-lg font-semibold tracking-tight">
            {BRAND_NAME}
          </Link>
          <div className="flex items-center gap-3">
            {person.handle ? <span className="hidden text-sm text-muted-foreground sm:inline">@{person.handle}</span> : null}
            <Button
              variant="ghost"
              pending={signingOut}
              onClick={async () => {
                setSigningOut(true)
                await authClient.signOut()
                window.location.assign(routes.home())
              }}
            >
              <LogOut aria-hidden="true" className="size-4" />
              {t("nav.signOut")}
            </Button>
          </div>
        </div>
      </header>
      <main id="contenu" className="mx-auto flex max-w-2xl flex-col gap-6 px-5 py-8">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl">{t("feed.title")}</h1>
          <p className="text-muted-foreground">{t("feed.lead")}</p>
        </div>
        <Composer networkId={root._id} />
        <FeedList networkId={root._id} />
      </main>
    </div>
  )
}
