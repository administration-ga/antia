"use client"

import { PERSONAL_REACTION_KINDS, type PersonalReactionKind } from "@antia/social-domain/content"
import { splitBodyRich } from "@antia/social-domain/richText"
import { cn } from "@antia/ui/lib/cn"
import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"
import type { FunctionReturnType } from "convex/server"
import { useMutation } from "convex/react"
import { HandHeart, Lightbulb, type LucideIcon, PartyPopper, ThumbsUp, Users } from "lucide-react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { engineErrorMessage } from "@/lib/engine-errors"

export type FeedItem = FunctionReturnType<typeof api.modules.posts.posts.feed>["page"][number]

const REACTION_ICONS: Record<PersonalReactionKind, LucideIcon> = {
  like: ThumbsUp,
  bravo: PartyPopper,
  soutien: HandHeart,
  instructif: Lightbulb,
}

/** Clés i18n des badges (espace `social`), depuis les valeurs calculées par le serveur. */
const BADGE_KEYS = { official: "official", verified: "verified", public_agent: "publicAgent", community: "community" } as const

/** Corps riche SANS HTML : texte, #mots-clés et @mentions en nœuds React. */
function RichBody({ body }: { body: string }) {
  return (
    <p className="whitespace-pre-wrap break-words text-base leading-relaxed">
      {splitBodyRich(body).map((segment, index) =>
        segment.type === "text" ? (
          <span key={index}>{segment.value}</span>
        ) : (
          <span key={index} className="font-medium text-primary">
            {segment.type === "tag" ? "#" : "@"}
            {segment.value}
          </span>
        ),
      )}
    </p>
  )
}

function initialsOf(name: string | null): string {
  if (!name) return "·"
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
}

function RelativeTime({ at }: { at: number }) {
  const { i18n } = useTranslation()
  const seconds = Math.round((at - Date.now()) / 1000)
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["day", 86_400],
    ["hour", 3_600],
    ["minute", 60],
  ]
  const format = new Intl.RelativeTimeFormat(i18n.language, { numeric: "auto" })
  const [unit, size] = units.find(([, length]) => Math.abs(seconds) >= length) ?? ["second", 1]
  return (
    <time dateTime={new Date(at).toISOString()} className="text-xs text-muted-foreground">
      {format.format(Math.round(seconds / size), unit)}
    </time>
  )
}

function ReactionBar({ networkId, item }: { networkId: Id<"networks">; item: FeedItem }) {
  const { t } = useTranslation()
  const toggleReaction = useMutation(api.modules.engagement.engagement.toggleReaction)
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t("antia:reactions.groupLabel")}>
      {PERSONAL_REACTION_KINDS.map((kind) => {
        const Icon = REACTION_ICONS[kind]
        const active = item.reactions.mine === kind
        const count = item.reactions.counts[kind]
        return (
          <button
            key={kind}
            type="button"
            aria-pressed={active}
            aria-label={t(`antia:reactions.${kind}`)}
            title={t(`antia:reactions.${kind}`)}
            onClick={() => {
              toggleReaction({ networkId, postId: item._id, kind }).catch((error: unknown) => toast.error(engineErrorMessage(error, t)))
            }}
            className={cn(
              "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-muted-foreground hover:bg-muted",
            )}
          >
            <Icon aria-hidden="true" className="size-4" />
            {count > 0 ? <span className="tabular-nums">{count}</span> : null}
          </button>
        )
      })}
      {item.reactions.total > 0 ? <span className="ml-auto text-xs text-muted-foreground">{t("antia:reactions.total", { count: item.reactions.total })}</span> : null}
    </div>
  )
}

export function PostCard({ networkId, item }: { networkId: Id<"networks">; item: FeedItem }) {
  const { t } = useTranslation()
  const name = item.author.displayName
  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 text-card-foreground sm:p-5">
      <header className="flex items-start gap-3">
        <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-foreground">
          {initialsOf(name)}
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="truncate font-semibold">{name ?? t("antia:feed.withdrawnAuthor")}</span>
            {item.author.handle ? <span className="truncate text-sm text-muted-foreground">@{item.author.handle}</span> : null}
            {item.isMine ? <span className="text-xs text-muted-foreground">{t("antia:feed.you")}</span> : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <RelativeTime at={item.publishedAt} />
            {item.author.badges.map((badge) => (
              <span key={badge} className="rounded-full bg-muted px-2 py-0.5 text-xs text-foreground">
                {t(`social:badges.${BADGE_KEYS[badge]}`)}
              </span>
            ))}
            {item.audience === "connections" ? (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Users aria-hidden="true" className="size-3.5" />
                {t("antia:feed.audience.connections")}
              </span>
            ) : null}
          </div>
        </div>
      </header>
      <RichBody body={item.body} />
      <ReactionBar networkId={networkId} item={item} />
    </article>
  )
}
