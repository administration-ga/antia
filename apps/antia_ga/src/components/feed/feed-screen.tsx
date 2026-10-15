"use client"

import { api, type Id } from "@antia/api/engine"
import { BRAND_NAME } from "@antia/social-contracts/brand"
import { MessagerieDock } from "@antia/social-features/messagerie"
import { STORIES_AUTHOR_PARAM, StoriesStyles, StoriesTray } from "@antia/social-features/stories"
import { usePaginatedQuery } from "convex/react"
import { LogOut, MessageCircle } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Suspense, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import { Composer } from "@/components/feed/composer"
import { PostCard } from "@/components/feed/post-card"
import { type MemberSession, useMemberSession } from "@/components/network-shell"
import { Button, CenteredStatus } from "@/components/shared/controls"
import { authClient } from "@/lib/auth-client"
import { routes } from "@/lib/routes"

const PAGE_SIZE = 20
/** L'horloge de l'écran avance à la minute : la rangée des statuts dit leur âge. */
const CLOCK_STEP_MS = 60_000

function useMinuteClock(): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), CLOCK_STEP_MS)
    return () => clearInterval(timer)
  }, [])
  return now
}

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

/** La rangée des statuts en tête du fil : la mienne d'abord, puis celles du réseau. */
function StoriesRow({ session }: { session: MemberSession }) {
  const router = useRouter()
  const now = useMinuteClock()
  const { person } = session
  return (
    <>
      {/* La feuille des statuts (hissée et dédoublonnée par React : un `<style href>`). */}
      <StoriesStyles />
      <StoriesTray
        myHandle={person.published && person.handle ? person.handle : null}
        myAvatarUrl={person.avatar?.url ?? null}
        now={now}
        onOpen={(handle) => router.push(handle ? `${routes.stories()}?${STORIES_AUTHOR_PARAM}=${encodeURIComponent(handle)}` : routes.stories())}
        onCreate={() => router.push(routes.storiesNew())}
      />
    </>
  )
}

function FeedLayout({ session }: { session: MemberSession }) {
  const { t } = useTranslation("antia")
  const [signingOut, setSigningOut] = useState(false)
  const { person, root } = session

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-3">
          <Link href={routes.home()} className="text-lg font-semibold tracking-tight">
            {BRAND_NAME}
          </Link>
          <div className="flex items-center gap-2">
            {person.handle ? <span className="hidden text-sm text-muted-foreground sm:inline">@{person.handle}</span> : null}
            {/* Au téléphone, iCom est une page ; au bureau, c'est la carte de la colonne de droite. */}
            <Link
              href={routes.messages()}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-[960px]:hidden"
            >
              <MessageCircle aria-hidden="true" className="size-4" />
              {t("nav.messages")}
            </Link>
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
      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-8 min-[960px]:grid-cols-[minmax(0,1fr)_minmax(340px,400px)]">
        <main id="contenu" className="flex min-w-0 flex-col gap-6">
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl">{t("feed.title")}</h1>
            <p className="text-muted-foreground">{t("feed.lead")}</p>
          </div>
          <StoriesRow session={session} />
          <Composer networkId={root._id} />
          <FeedList networkId={root._id} />
        </main>
        {/* La colonne d'iCom (bureau) : la carte ancrée en tête, qui se détache en
            téléphone flottant. Au téléphone, la carte ne se rend pas (≤ 959 px). */}
        <aside aria-label={t("feed.icomRail")} className="hidden min-[960px]:block">
          <div className="sticky top-20">
            <Suspense fallback={null}>
              <MessagerieDock />
            </Suspense>
          </div>
        </aside>
      </div>
    </div>
  )
}

export function FeedScreen() {
  return <FeedLayout session={useMemberSession()} />
}
