import type { PublicAuthor, PublicPost, PublicSharedPost } from "@antsia/social-contracts/publicNetwork"
import type { PostMediaDto } from "@antsia/social-contracts/media"
import type { Locale } from "@antsia/social-features/i18n"
import { splitBodyRich } from "@antsia/social-domain/richText"
import Image from "next/image"
import Link from "next/link"
import { Fragment } from "react"
import { routes } from "@/lib/routes"
import { getPublicT, publicDate } from "./public-copy"

export function PublicIdentity({ author, locale }: { author: PublicAuthor; locale: Locale }) {
  const t = getPublicT(locale)
  const label = author.displayName ?? t("post.withdrawnAuthor")
  const href = author.handle ? author.kind === "page" ? routes.officialPage(author.handle) : routes.publicProfile(author.handle) : null
  return <div className="flex min-w-0 items-center gap-3">
    {author.avatarUrl ? <Image unoptimized src={author.avatarUrl} width={44} height={44} alt="" loading="lazy" className="size-11 shrink-0 rounded-xl object-cover" /> : <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted font-semibold">{author.displayName?.slice(0, 1) ?? "·"}</span>}
    <div className="min-w-0"><p className="break-words font-semibold">{href ? <Link href={href} prefetch={false} className="rounded-sm hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">{label}</Link> : label}</p>
      {author.handle ? <p className="break-all text-sm text-muted-foreground">@{author.handle}</p> : null}
      {author.badges.length ? <ul aria-label={t("post.badges")} className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">{author.badges.map((badge) => <li key={badge}>{t(`badges.${badge}`)}</li>)}</ul> : null}
    </div>
  </div>
}

function PublicBody({ body }: { body: string }) {
  return <p className="whitespace-pre-wrap break-words leading-relaxed">{splitBodyRich(body).map((part, index) => <Fragment key={index}>{part.type === "text" ? part.value : <Link href={part.type === "tag" ? routes.tag(part.value) : routes.publicProfile(part.value)} prefetch={false} className="rounded-sm font-medium text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">{part.type === "tag" ? "#" : "@"}{part.value}</Link>}</Fragment>)}</p>
}

function PublicMedia({ media, locale }: { media: PostMediaDto[]; locale: Locale }) {
  const t = getPublicT(locale)
  return <div className="flex flex-col gap-3">{media.map((item, index) => <figure key={index} className="overflow-hidden rounded-xl bg-muted">
    {item.url === null || item.withheld !== null ? <figcaption className="flex min-h-32 items-center justify-center px-5 py-8 text-center text-sm text-muted-foreground">{t(item.withheld === "fileScanPending" ? "media.pending" : item.withheld === "fileQuarantined" ? "media.quarantined" : "media.unavailable")}</figcaption> : item.kind === "image" ? <Image unoptimized src={item.url} width={item.width ?? 1200} height={item.height ?? 750} alt={item.altText?.trim() || t("media.image")} loading="lazy" decoding="async" className="max-h-[34rem] w-full object-contain" /> : <video src={item.url} width={item.width ?? 1200} height={item.height ?? 750} controls preload="metadata" playsInline aria-label={item.altText?.trim() || t("media.video")} className="max-h-[34rem] w-full" />}
  </figure>)}</div>
}

function SharedPublicPost({ shared, locale }: { shared: PublicSharedPost; locale: Locale }) {
  const t = getPublicT(locale)
  if (!shared.available) return <p className="rounded-xl border border-border bg-muted p-4 text-sm text-muted-foreground">{t("post.originalUnavailable")}</p>
  return <blockquote className="flex flex-col gap-4 rounded-xl border border-border p-4"><PublicIdentity author={shared.author} locale={locale} /><p className="border-l-2 border-primary pl-3 text-xs text-muted-foreground">{t("post.origin", { name: shared.origin.name })}</p><PublicBody body={shared.body} /><PublicMedia media={shared.media} locale={locale} /><Link href={routes.publication(shared.id)} prefetch={false} className="inline-flex min-h-11 items-center rounded-lg text-sm font-medium text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">{t("post.original")}</Link></blockquote>
}

/** Présentation serveur seulement : aucun faux NetworkProvider ni geste d'écriture. */
export function PublicPostCard({ post, locale }: { post: PublicPost; locale: Locale }) {
  const t = getPublicT(locale)
  return <article className="flex min-w-0 flex-col gap-5 rounded-2xl border border-border bg-card p-5 text-card-foreground sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><PublicIdentity author={post.author} locale={locale} /><Link href={routes.publication(post.id)} prefetch={false} className="inline-flex min-h-11 shrink-0 items-center rounded-lg px-1 py-2 text-xs text-muted-foreground hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"><time dateTime={new Date(post.publishedAt).toISOString()}>{publicDate(post.publishedAt, locale)}</time></Link></div>
    <p className="border-l-2 border-primary pl-3 text-xs font-medium text-muted-foreground">{t("post.origin", { name: post.origin.name })}</p>
    <PublicBody body={post.body} /><PublicMedia media={post.media} locale={locale} />
    {post.shared ? <SharedPublicPost shared={post.shared} locale={locale} /> : null}
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3 text-xs text-muted-foreground">
      <span>{t("post.publicAudience")}</span>
      {post.editedAt ? <time dateTime={new Date(post.editedAt).toISOString()}>{t("post.edited", { date: publicDate(post.editedAt, locale) })}</time> : null}
      <Link href={routes.signIn()} prefetch={false} className="inline-flex min-h-11 items-center rounded-lg px-2 font-medium text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">{t("post.participate")}</Link>
    </div>
  </article>
}
