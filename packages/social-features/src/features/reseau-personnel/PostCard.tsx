// Dupliqué de socle/packages/agent-features/src/features/reseau-personnel/PostCard.tsx @ 25398f565 — adaptations : la carte est la PROJECTION du moteur (`PostCardPost` = `FunctionReturnType<typeof api.modules.posts.posts.getPost>`, rendue telle quelle par le fil, la recherche, les murs, les groupes et les pages : `_id`, `isMine`, `author.personId`, `page`, réactions `counts`) au lieu du DTO du socle (`postId`, `authorUserId`, `authorKind`, `signedBy`, `page.orgId`) ; identité d'auteur par `PostIdentityLines` (nom, badges CALCULÉS par le serveur — ni fonction ni administration) et `author-link` (lien, forme de pastille, signature) avec les adresses INJECTÉES (`useRoutes()` : profil d'une personne, `page(handle)` d'une page) ; une publication de PAGE parle sous l'identité de la page (nom, logo, badge de confiance), son auteur n'en est que le signataire ; nom neutre traduit pour un profil non publié ; annonce du direct branchée sur sa projection vivante et la route de conférence injectée ; gestes du moteur avec le réseau courant (`engagement.engagement.toggleReaction`, `posts.posts.{edit, remove, pinOnMyWall}`, `pages.pages.removePagePost` pour une publication de page, `moderation.moderation.{reportPost, reportComment}`) ; l'épinglage personnel n'est pas offert sur une publication de page ; libellés, toasts et noms accessibles par l'i18n (clés `reseau:postCard.*`) ; refus du moteur dit par son code (`postEngineErrorText`) ; partage cité avec la page de l'original quand c'est une page qui parle, ses mots-dièse et mentions suivant les gestionnaires de la carte. ; PA6 : dates de publication et citation dans la préférence du lecteur, origine réseau attribuée sans lien, carte de l’évènement annoncé avec dates/statut/réponse réellement projetés et sans droits inventés ; P03 (étude social-commerce du 18/10/2026) : présentation « media » déclarée par l'application (`useNetwork().postPresentation`) — auteur → média (photo, galerie, vidéo, citation, direct, évènement) → actions (réagir avec choix explicite, commenter, partager et copier le lien, enregistrer) → légende bornée « Lire la suite » → offre liée facultative (`offer`, emplacement typé vide jusqu'au lot P09) ; texte seul à hauteur naturelle ; la présentation historique reste le défaut, à l'identique.
"use client"

/**
 * Une publication du fil : identité, corps riche, médias, partage cité,
 * réactions, commentaires.
 *
 * Le composant ne DÉCIDE rien : libellés, dates, décomptes et bornes viennent
 * de `shared.ts` (module pur, testé), l'identité de `author-link.ts` et de
 * `components/identity`, le découpage du corps du domaine. Ce qui reste ici
 * est du rendu.
 *
 * La carte reçoit la projection du MOTEUR telle quelle (`PostCardPost`) : le
 * fil, la recherche, le mur d'une personne, celui d'un groupe et celui d'une
 * page rendent la même — un seul gabarit à tenir.
 */

import { api } from "@antsia/api/engine"
import type { Id } from "@antsia/api/engine"
import { useNetwork, useRoutes, type EnginePostPresentation } from "@antsia/api/network"
import { Link } from "@antsia/api/routing"
import { useViewerTimeZone } from "@antsia/api/viewer-preferences"
import type { Badge } from "@antsia/social-domain/badges"
import { BRAND_NAME } from "@antsia/social-contracts/brand"
import { LEGACY_ROOT_NETWORK_SLUG, ROOT_NETWORK_SLUG } from "@antsia/social-domain/network"
import { Button, Card, TextArea } from "@antsia/ui"
import { useMutation } from "convex/react"
import type { FunctionReturnType } from "convex/server"
import { Bookmark, BookmarkCheck, GlobeLock, MessageCircle, Share2 } from "lucide-react"
import { useEffect, useRef, useState, type ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { PostIdentityLines } from "../../components/identity"
import { POST_SURFACE_STYLE } from "../../shell/design-styles"
import { Avatar } from "./Avatar"
// Où mène l'auteur, sous quel visage, et ce qu'on a le droit de lui faire :
// module PUR, testé.
import {
  authorHeadlineFor,
  authorHref,
  avatarShapeFor,
  signedByLabel,
  type AuthorKind,
} from "./author-link"
import { CommentsSurface } from "./CommentsSurface"
import { formatEventRange, myResponseLabel } from "./evenements-list"
import { PostCardCaption } from "./PostCardCaption"
import { PostMedia } from "./PostMedia"
import { PostOverflowMenu } from "./PostOverflowMenu"
import { postEngineErrorText } from "./post-overflow"
import { PostReactionControl } from "./PostReactionControl"
import { RichText } from "./RichText"
import { SharePostDialog } from "./SharePostDialog"
import { ReportContentDialog, type ReportReason } from "./ReportContentDialog"
import {
  audienceLabel,
  feedReasonLabel,
  formatCount,
  formatRelativeDate,
  type ReactionKind,
} from "./shared"
/**
 * Le rembourrage LATERAL de la carte — et, au signe pres, le debord du media
 * qui la traverse (bord a bord, arbitrage du 2026-08-20). Une seule valeur
 * pour les deux : separees, elles se decaleraient et le media depasserait la
 * carte ou laisserait une lisiere de parchemin sur un cote.
 * 16 et non plus 20 depuis le 2026-08-21 : la carte a perdu son filet, ses
 * espaces se resserrent d'autant.
 */
const POST_CARD_GUTTER = 16

/**
 * Une publication TELLE QUE le moteur la projette (`feedItemValidator`) —
 * le même DTO pour toutes les lectures. Pour une publication de PAGE, `page`
 * porte l'identité qui parle (nom, adresse, logo, badge de confiance) et
 * `author` sa SIGNATAIRE ; `isMine` reste faux : la publication appartient à
 * la page.
 */
export type PostCardPost = FunctionReturnType<typeof api.modules.posts.posts.getPost>

type SharedPost = NonNullable<PostCardPost["share"]>

/** Qui PARLE sur une carte : la page, ou la personne — jamais les deux. */
interface CardIdentity {
  name: string
  handle: string | null
  avatarUrl: string | null
  headline: string | null
  badges: readonly Badge[]
}

/**
 * L'emplacement de l'OFFRE LIÉE à une publication — dernière zone de la carte
 * (04 §2 : « une carte compacte avec titre, prix correctement qualifié,
 * vendeur et Voir l'offre »). VIDE jusqu'au lot P09 : aucun appelant ne le
 * remplit aujourd'hui, et sans lui la carte ne rend RIEN de plus — ni espace
 * réservé, ni donnée de démonstration.
 *
 * La carte ne connaît ni prix, ni vendeur, ni disponibilité : P09 construira
 * la carte d'offre compacte sur la projection publique du contrat
 * PRO-COMMERCE-PUBLIC-V1 (catalogue PRO.GA reflété) et la passera ici, avec le
 * nom accessible de la zone. Une offre retirée ou non publiée ne se passe pas.
 */
export interface PostOfferSlot {
  /** Nom accessible de la zone, déjà traduit (« Offre liée : … »). */
  label: string
  /** La carte d'offre compacte, rendue par l'appelant. */
  content: ReactNode
}

interface PostCardProps {
  post: PostCardPost
  /** Rendu de l'horodatage : passé en prop pour rester déterministe. */
  now: number
  onTag?: (tag: string) => void
  onMention?: (handle: string) => void
  /** L'offre liée, facultative (lot P09) : absente, rien n'est rendu. */
  offer?: PostOfferSlot
}

export function PostCard(props: PostCardProps) {
  const { networkId, personId } = useNetwork()
  // Une carte réutilisée pour une autre publication ou un autre lecteur ne
  // garde ni éditeur, ni dialogue, ni média ouvert du contexte précédent.
  return <PostCardContent key={`${networkId}:${personId}:${props.post._id}`} {...props} />
}

function PostCardContent({ post, now, onTag, onMention, offer }: PostCardProps) {
  const { t, i18n } = useTranslation("reseau")
  const { networkId, personId, slug, postPresentation, PostOfferRenderer } = useNetwork()
  // La présentation que l'application déclare : « media » sur opt-in, sinon
  // la carte historique (aucune application ne change sans le demander).
  const presentation = postPresentation === "media" ? "media" : "classic"
  const routes = useRoutes()
  const timeZone = useViewerTimeZone()
  const [showComments, setShowComments] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [pendingReaction, setPendingReaction] = useState(false)
  const reactionLock = useRef(false)
  const [editing, setEditing] = useState(false)
  const [editedBody, setEditedBody] = useState(post.body)
  const [withdrawing, setWithdrawing] = useState(false)
  const withdrawalLock = useRef(false)
  const live = useRef(true)
  const context = `${networkId}:${personId}:${post._id}`
  const latestContext = useRef(context)
  latestContext.current = context
  useEffect(() => { live.current = true; return () => { live.current = false } }, [])
  const [reportTarget, setReportTarget] = useState<
    | { kind: "post" }
    | { kind: "comment"; commentId: Id<"postComments"> }
    | null
  >(null)

  const toggleReaction = useMutation(api.modules.engagement.engagement.toggleReaction)
  const removePost = useMutation(api.modules.posts.posts.remove)
  const withdrawFromRoot = useMutation(api.modules.posts.posts.withdrawFromRoot)
  const removePagePost = useMutation(api.modules.pages.pages.removePagePost)
  const editPost = useMutation(api.modules.posts.posts.edit)
  const pinPost = useMutation(api.modules.posts.posts.pinOnMyWall)
  const reportPost = useMutation(api.modules.moderation.moderation.reportPost)
  const reportComment = useMutation(api.modules.moderation.moderation.reportComment)
  // Enregistrer depuis la rangée d'actions (présentation « media ») : le MÊME
  // geste que l'entrée du menu « … » (`marks.marks.toggleMark`, réseau courant).
  const toggleMark = useMutation(api.modules.marks.marks.toggleMark)
  const [saving, setSaving] = useState(false)
  const saveLock = useRef(false)

  const submitReport = async (reason: ReportReason, note: string) => {
    if (!reportTarget) return
    try {
      if (reportTarget.kind === "post")
        await reportPost({ networkId, postId: post._id, reason, note: note || undefined })
      else
        await reportComment({
          networkId,
          commentId: reportTarget.commentId,
          reason,
          note: note || undefined,
        })
    } catch (error) {
      toast.error(postEngineErrorText(error, "reseau:postCard.toast.reportFailed", t))
      // La boîte reste ouverte pour un nouvel essai.
      throw error
    }
    toast.success(t("postCard.toast.reported"))
  }

  /*
   * QUI parle. Une publication de PAGE parle sous l'identité de la page — son
   * nom, son adresse, son logo, son badge de confiance —, et sa signataire
   * n'est que NOMMÉE. Une publication de personne parle sous le profil PUBLIÉ
   * de son auteur (nom neutre quand il n'en a pas publié).
   */
  const page = post.page
  const authorKind: AuthorKind = page !== null ? "page" : "person"
  const identity: CardIdentity =
    page !== null
      ? {
          name: page.name,
          handle: page.handle,
          avatarUrl: page.logoUrl,
          headline: null,
          badges: [page.badge],
        }
      : {
          name: post.author.displayName ?? t("postCard.unknownAuthor"),
          handle: post.author.handle,
          avatarUrl: post.author.avatarUrl,
          headline: post.author.headline,
          badges: post.author.badges,
        }

  // Ce que le GENRE de l'auteur change dans l'en-tête. Aucun ternaire ici :
  // les décisions sont prises — et testées — dans `author-link.ts`.
  const authorRef = { authorKind, handle: identity.handle }
  const authorLink = authorHref(authorRef, routes)
  const authorHeadline = authorHeadlineFor({ authorKind, headline: identity.headline }, t)
  const signature =
    page !== null && post.author.displayName !== null
      ? signedByLabel({ displayName: post.author.displayName }, t)
      : null

  /*
   * Les gestes d'AUTEUR : sur sa publication, ou sur celle d'une page qu'on a
   * signée tant qu'on en reste signataire (le serveur le dit par le titre
   * `own`, relu à chaque lecture).
   */
  const isOwn =
    post.isMine || (page !== null && post.reason === "own" && post.author.personId === personId)

  const withdrawPublic = async () => {
    if (!isOwn || post.visibility !== "root" || withdrawalLock.current || !window.confirm(t("postCard.publication.withdrawConfirm", { brand: BRAND_NAME }))) return
    withdrawalLock.current = true
    setWithdrawing(true)
    const submittedContext = context
    try {
      await withdrawFromRoot({ networkId, postId: post._id })
      if (live.current && latestContext.current === submittedContext) toast.success(t("postCard.publication.withdrawn"))
    } catch (error) {
      if (live.current && latestContext.current === submittedContext) toast.error(postEngineErrorText(error, "reseau:postCard.publication.withdrawFailed", t))
    } finally {
      withdrawalLock.current = false
      if (live.current) setWithdrawing(false)
    }
  }

  const handleReaction = async (kind: ReactionKind) => {
    if (reactionLock.current) return
    reactionLock.current = true
    setPendingReaction(true)
    try {
      await toggleReaction({ networkId, postId: post._id, kind })
    } catch (error) {
      // Le serveur relit l'autorisation à chaque acte : une connexion rompue
      // entre l'affichage et le clic referme la publication. Le dire, plutôt
      // que de laisser un bouton muet.
      if (live.current) toast.error(postEngineErrorText(error, "reseau:postCard.toast.reactionFailed", t))
    } finally {
      reactionLock.current = false
      if (live.current) setPendingReaction(false)
    }
  }

  /**
   * Bascule l'enregistrement. L'état affiché reste celui du SERVEUR
   * (`post.viewer.bookmarked`, relu par la projection) : aucun état optimiste.
   * Un seul envoi à la fois ; la réponse d'une autre carte (réseau, personne ou
   * publication changés entre-temps) ne s'annonce pas sur celle-ci.
   */
  const toggleSaved = async () => {
    if (saveLock.current) return
    saveLock.current = true
    setSaving(true)
    const submittedContext = context
    try {
      const result = await toggleMark({ networkId, postId: post._id, kind: "bookmark" })
      if (live.current && latestContext.current === submittedContext)
        toast.success(result.marked ? t("postOverflowMenu.toast.bookmarked") : t("postOverflowMenu.toast.unbookmarked"))
    } catch (error) {
      if (live.current && latestContext.current === submittedContext)
        toast.error(postEngineErrorText(error, "reseau:postOverflowMenu.toast.failed", t))
    } finally {
      saveLock.current = false
      if (live.current) setSaving(false)
    }
  }

  const commentLabel =
    post.commentCount > 0
      ? t("postCard.commentWithCount", { formatted: formatCount(post.commentCount) })
      : t("postCard.comment")
  const canQuote = post.audience === "public" && post.share?.available !== false
  const shareLabel =
    post.shareCount > 0
      ? t("postCard.shareWithCount", { formatted: formatCount(post.shareCount) })
      : t("postCard.share")

  /*
   * Les MORCEAUX de la carte, partagés par les deux présentations : chacun est
   * le même élément, seul l'ordre change (historique : corps → médias →
   * actions ; « media » : médias → actions → légende → offre).
   */
  const header = (
        <header style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Avatar
            displayName={identity.name}
            avatarUrl={identity.avatarUrl}
            size={40}
            hasIdentity={identity.handle !== null}
            shape={avatarShapeFor(authorRef)}
          />
          <div style={{ minWidth: 0, flex: 1, color: "var(--ink-900)" }}>
            {/*
             * L'auteur MÈNE chez lui — le geste attendu d'un fil social. Chez
             * lui, c'est la page d'une PAGE et le profil d'une personne : mener
             * une page vers un profil afficherait le compte d'un homonyme, ou
             * rien.
             *
             * Il ne devient un lien que si l'adresse est PUBLIÉE : sans elle il
             * n'y a pas de page où aller, et un lien mort vaut moins qu'un
             * texte. C'est la même condition qui décide déjà des initiales de
             * l'avatar (`hasIdentity`).
             *
             * Sous le nom, les badges CALCULÉS par le serveur (« Officiel »,
             * « Vérifié », « Agent public ») : la confiance se voit AVANT
             * d'avoir lu le corps du message. « Communauté » seul ne prend pas
             * de ligne.
             */}
            <PostIdentityLines
              name={
                authorLink ? (
                  <Link href={authorLink} style={{ color: "inherit", textDecoration: "none" }}>
                    {identity.name}
                  </Link>
                ) : (
                  <span>{identity.name}</span>
                )
              }
              badges={identity.badges}
              nameClassName="font-bold"
            />
            <p
              style={{
                margin: "1px 0 0",
                fontSize: 12.5,
                color: "var(--ink-500)",
                display: "flex",
                flexWrap: "wrap",
                gap: 4,
                alignItems: "center",
              }}
            >
              {authorHeadline ? (
                <>
                  <span>{authorHeadline}</span>
                  <span aria-hidden="true">·</span>
                </>
              ) : null}
              <time dateTime={new Date(post.publishedAt).toISOString()}>
                {formatRelativeDate(post.publishedAt, now, t, timeZone)}
              </time>
              {post.origin !== null ? (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{t("post.origin", { name: post.origin.name })}</span>
                </>
              ) : null}
              {/*
               * La signataire est NOMMÉE, jamais mise en avant : la page
               * publie, la personne signe. D'où cette ligne discrète plutôt
               * qu'un second lien — le geste de la carte mène à la page, et
               * un lien vers la personne ferait croire que la publication est
               * la sienne.
               */}
              {signature ? (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{signature}</span>
                </>
              ) : null}
              <span className="sr-only">
                {t("postCard.context", {
                  audience: audienceLabel(post.audience, t),
                  reason: feedReasonLabel(post.reason, t),
                })}
              </span>
            </p>
          </div>
          {/*
           * Le menu « … » vit dans l'EN-TÊTE, pas dans la barre d'actions :
           * ce sont des gestes sur la publication en tant qu'objet (la garder,
           * la faire disparaître), pas des réponses à son contenu. C'est aussi
           * là que tout réseau social le pose, et l'habitude compte.
           */}
          <PostOverflowMenu
            postId={post._id}
            authorPersonId={post.author.personId}
            authorName={identity.name}
            authorKind={authorKind}
            isOwn={isOwn}
            /* L'épinglage PERSONNEL ne vaut ni pour une publication de
               groupe (elle s'épingle dans son groupe, par ses modérateurs)
               ni pour celle d'une page (elle appartient à la page). Le menu
               retire l'entrée, il ne la grise pas. */
            canPin={post.audience !== "group" && page === null}
            bookmarked={post.viewer.bookmarked}
            notifying={post.viewer.notifying}
            onRemove={() =>
              void (page !== null
                ? removePagePost({ networkId, postId: post._id })
                : removePost({ networkId, postId: post._id }))
                .then(() => toast.success(t("postCard.toast.removed")))
                .catch((error: unknown) =>
                  toast.error(postEngineErrorText(error, "reseau:postCard.toast.removeFailed", t))
                )
            }
            onReport={() => setReportTarget({ kind: "post" })}
            /* Modifier et Épingler vivent dans ce menu depuis le 2026-08-21
               (décision utilisateur) : ils occupaient une rangée de boutons
               texte sous l'en-tête de chaque carte de l'auteur. */
            onEdit={() => {
              setEditedBody(post.body)
              setEditing(true)
            }}
            onPin={() =>
              void pinPost({ networkId, postId: post._id })
                .then(() => toast.success(t("postCard.toast.pinned")))
                .catch((error: unknown) =>
                  toast.error(postEngineErrorText(error, "reseau:postCard.toast.pinFailed", t))
                )
            }
          />
        </header>
  )

  const withdrawBlock = isOwn && post.visibility === "root" && post.audience === "public" ? <>
          {slug !== ROOT_NETWORK_SLUG && slug !== LEGACY_ROOT_NETWORK_SLUG ? <p className="text-xs text-muted-foreground">{t("postCard.publication.availableOnRoot", { brand: BRAND_NAME })}</p> : null}
          <Button type="button" variant="ghost" disabled={withdrawing} aria-busy={withdrawing || undefined} className="self-start" style={{ minHeight: 44, whiteSpace: "normal" }} onClick={() => void withdrawPublic()}><GlobeLock aria-hidden="true" size={16} />{t(withdrawing ? "postCard.publication.withdrawing" : "postCard.publication.withdraw")}</Button>
        </> : null

  const editor = (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <TextArea
              value={editedBody}
              onChange={(event) => setEditedBody(event.target.value)}
              aria-label={t("postCard.editLabel")}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <Button
                size="sm"
                onClick={() =>
                  void editPost({ networkId, postId: post._id, body: editedBody })
                    .then(() => {
                      setEditing(false)
                      toast.success(t("postCard.toast.edited"))
                    })
                    .catch((error: unknown) =>
                      toast.error(postEngineErrorText(error, "reseau:postCard.toast.editFailed", t))
                    )
                }
              >
                {t("postCard.save")}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setEditedBody(post.body)
                  setEditing(false)
                }}
              >
                {t("postCard.cancel")}
              </Button>
            </div>
          </div>
  )

  const liveBlock = post.live ? <Link href={routes.conference(post.live.sessionId)} className="mt-3 flex min-h-11 items-center justify-between gap-3 rounded-xl border border-border bg-muted p-4"><span>{post.live.title}</span><span>{t(`direct:status.${post.live.status}`)}</span></Link> : null

  const eventBlock = post.event !== null ? (
          <section aria-label={t("post.event.label")} className="grid gap-2 rounded-xl border border-border bg-muted p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-muted-foreground">{t("post.event.label")}</span>
              <span className={post.event.status === "cancelled" ? "text-xs font-semibold text-destructive" : "text-xs font-semibold text-muted-foreground"}>
                {t(`post.event.${post.event.status}`)}
              </span>
            </div>
            <h3 className="m-0 text-sm font-semibold text-foreground">{post.event.title}</h3>
            <p className="m-0 text-sm text-foreground">{formatEventRange(post.event.startAt, post.event.endAt, i18n.language, timeZone)}</p>
            <p className="m-0 text-xs text-muted-foreground">{t("post.event.timeZone", { timeZone })}</p>
            {post.event.myParticipation !== null ? (
              <p className="m-0 text-xs text-muted-foreground">
                {t("post.event.participation", { response: myResponseLabel(post.event.myParticipation, t) })}
              </p>
            ) : null}
          </section>
  ) : null

  // « Commenter » est une ICÔNE depuis le 2026-08-21 (décision utilisateur :
  // icônes d'abord) — l'arbitrage du 2026-08-20 qui le gardait textuel est
  // levé. Le NOM vit dans aria-label + title, le compteur reste visible.
  const commentButton = (
          <button
            type="button"
            onClick={() => setShowComments(true)}
            aria-expanded={showComments}
            aria-haspopup="dialog"
            aria-label={commentLabel}
            title={t("postCard.comment")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              minHeight: 44,
              minWidth: 44,
              justifyContent: "center",
              padding: "7px 10px",
              borderRadius: 9,
              fontFamily: "inherit",
              fontSize: 12.5,
              fontWeight: 700,
              cursor: "pointer",
              background: showComments ? "var(--primary-50)" : "transparent",
              color: showComments ? "var(--primary-600)" : "var(--ink-500)",
              border: "none",
            }}
          >
            <MessageCircle aria-hidden="true" size={17} strokeWidth={2.2} />
            {post.commentCount > 0 ? (
              <span style={{ fontVariantNumeric: "tabular-nums" }}>
                {formatCount(post.commentCount)}
              </span>
            ) : null}
          </button>
  )

  // Copier une adresse ne change pas l'audience ; seule la citation dans le
  // fil reste réservée à une publication publique disponible.
  const shareButton = routes.post || canQuote ? (
            <button
              type="button"
              onClick={() => setSharing(true)}
              aria-expanded={sharing}
              aria-haspopup="dialog"
              aria-label={shareLabel}
              title={t("postCard.share")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                minHeight: 44,
                minWidth: 44,
                justifyContent: "center",
                padding: "7px 10px",
                borderRadius: 9,
                fontFamily: "inherit",
                fontSize: 12.5,
                fontWeight: 700,
                cursor: "pointer",
                background: "transparent",
                color: "var(--ink-500)",
                border: "none",
              }}
            >
              <Share2 aria-hidden="true" size={17} strokeWidth={2.2} />
              {t("postCard.share")}
              {post.shareCount > 0 ? (
                <span style={{ fontVariantNumeric: "tabular-nums" }}>
                  · {formatCount(post.shareCount)}
                </span>
              ) : null}
            </button>
  ) : null

  const overlays = (
    <>
      {showComments ? (
        <CommentsSurface
          postId={post._id}
          now={now}
          onClose={() => setShowComments(false)}
          onTag={onTag}
          onMention={onMention}
          onReportComment={(commentId) =>
            setReportTarget({ kind: "comment", commentId })
          }
        />
      ) : null}

      {sharing ? (
        <SharePostDialog
          key={context}
          postId={post._id}
          authorName={identity.name}
          excerpt={post.body}
          canQuote={canQuote}
          onClose={() => setSharing(false)}
        />
      ) : null}
      {reportTarget ? (
        <ReportContentDialog
          kind={reportTarget.kind === "post" ? "publication" : "commentaire"}
          onClose={() => setReportTarget(null)}
          onSubmit={submitReport}
        />
      ) : null}
    </>
  )

  if (presentation === "media") {
    /*
     * PRÉSENTATION « MEDIA » (opt-in de l'application, lot P03) :
     * auteur → média → actions → légende → offre facultative.
     *
     * Le « média » est ce que la publication MONTRE : ses photos ou sa vidéo,
     * le direct ou l'évènement qu'elle annonce, la publication qu'elle cite.
     * Sans rien de tout cela, c'est un TEXTE SEUL : le texte est alors la
     * publication, à sa place de média, complet et à hauteur naturelle — aucun
     * aperçu coupé, aucune hauteur imposée. Sinon le corps devient la légende,
     * bornée avec « Lire la suite ».
     */
    const textOnly = post.media.length === 0 && post.share === null && post.event === null && !post.live
    const body = editing ? editor : post.body.length > 0 ? (
      textOnly
        ? <RichText body={post.body} onTag={onTag} onMention={onMention} />
        : <PostCardCaption body={post.body} onTag={onTag} onMention={onMention} />
    ) : null
    const saved = post.viewer.bookmarked
    return (
      <Card padded={false} style={POST_SURFACE_STYLE}>
        <article
          data-post-presentation="media"
          style={{
            padding: `14px ${POST_CARD_GUTTER}px`,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          {header}

          {textOnly ? body : (
            <>
              {/* Bord à bord, comme la présentation historique : la MÊME
                  gouttière sert au rembourrage et au débord du média. */}
              {post.media.length > 0 ? (
                <PostMedia media={post.media} gutter={POST_CARD_GUTTER} presentation="media" />
              ) : null}
              {liveBlock}
              {eventBlock}
              {post.share ? (
                <SharedPostCard share={post.share} now={now} onTag={onTag} onMention={onMention} presentation="media" />
              ) : null}
            </>
          )}

          {/* Les actions, nommées en groupe : réagir (le choix des quatre
              réactions s'ouvre aussi d'un simple toucher), commenter,
              partager ou copier le lien, enregistrer. */}
          <div
            role="group"
            aria-label={t("postCard.actionsLabel")}
            style={{ display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center" }}
          >
            <PostReactionControl
              reactions={post.reactions}
              pending={pendingReaction}
              onReact={handleReaction}
              choiceButton
            />
            {commentButton}
            {shareButton}
            {/* Le même enregistrement que le menu « … », à portée de pouce :
                bouton à bascule, état lu sur le serveur, forme de l'icône ET
                couleur (jamais la couleur seule). */}
            <button
              type="button"
              aria-pressed={saved}
              aria-busy={saving || undefined}
              aria-label={t(saved ? "postOverflow.bookmark.removeLabel" : "postOverflow.bookmark.addLabel")}
              title={t(saved ? "postOverflow.bookmark.removeLabel" : "postOverflow.bookmark.addLabel")}
              disabled={saving}
              onClick={() => void toggleSaved()}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                minHeight: 44,
                minWidth: 44,
                marginInlineStart: "auto",
                padding: "7px 10px",
                borderRadius: 9,
                cursor: saving ? "progress" : "pointer",
                background: saved ? "var(--primary-50)" : "transparent",
                color: saved ? "var(--primary-600)" : "var(--ink-500)",
                border: "none",
              }}
            >
              {saved ? (
                <BookmarkCheck aria-hidden="true" size={18} strokeWidth={2.2} />
              ) : (
                <Bookmark aria-hidden="true" size={18} strokeWidth={2.2} />
              )}
            </button>
          </div>

          {textOnly ? null : body}

          {withdrawBlock}

          {/* L'offre liée (lot P09) : rien sans donnée, ni place réservée. */}
          {offer ? (
            <section aria-label={offer.label} data-post-offer="">
              {offer.content}
            </section>
          ) : post.hasCommerceOffer && PostOfferRenderer ? <PostOfferRenderer networkId={networkId} postId={post._id} /> : null}
        </article>

        {overlays}
      </Card>
    )
  }

  return (
    <Card padded={false} style={POST_SURFACE_STYLE}>
      <article
        style={{
          padding: `14px ${POST_CARD_GUTTER}px`,
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {header}

        {withdrawBlock}

        {editing ? editor : post.body.length > 0 ? (
          <RichText body={post.body} onTag={onTag} onMention={onMention} />
        ) : null}

        {/* Bord à bord : le média traverse la gouttière de la carte
            (arbitrage du 2026-08-20). La MÊME constante sert au rembourrage
            ci-dessus et au débord ci-dessous — deux valeurs séparées se
            décaleraient au premier ajustement, et le média dépasserait la
            carte ou laisserait une lisière. */}
        {post.media.length > 0 ? (
          <PostMedia media={post.media} gutter={POST_CARD_GUTTER} presentation="classic" />
        ) : null}

        {liveBlock}

        {eventBlock}

        {post.share ? (
          <SharedPostCard share={post.share} now={now} onTag={onTag} onMention={onMention} presentation="classic" />
        ) : null}

        {/* Sans filet ni séparateur (2026-08-21) : la rangée se tient par son
            seul espacement — la carte a perdu ses bordures, un trait ici la
            recouperait en deux. */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 4,
            alignItems: "center",
            paddingTop: 2,
          }}
        >
          <PostReactionControl
            reactions={post.reactions}
            pending={pendingReaction}
            onReact={handleReaction}
          />

          {commentButton}

          {shareButton}
        </div>
      </article>

      {overlays}
    </Card>
  )
}

/**
 * La publication CITÉE par un partage.
 *
 * `available: false` ne dit RIEN d'autre que l'indisponibilité : le serveur ne
 * lui donne rien de plus, précisément pour qu'un partage ne devienne pas un
 * canal de lecture dérobé vers une publication retirée ou fermée.
 *
 * Les mots-dièse et mentions de la citation suivent les gestionnaires de la
 * carte : sur la page réseau, ils filtrent le fil EN PLACE, comme ceux du corps.
 */
function SharedPostCard({
  share,
  now,
  onTag,
  onMention,
  presentation,
}: {
  share: SharedPost
  now: number
  onTag?: (tag: string) => void
  onMention?: (handle: string) => void
  presentation: EnginePostPresentation
}) {
  const { t } = useTranslation("reseau")
  const timeZone = useViewerTimeZone()
  if (!share.available) {
    return (
      <div
        style={{
          // Le tiret disait « cadre vide » ; la surface teintée suffit
          // (2026-08-21, cartes sans bordure).
          background: "var(--ink-50, var(--ink-0))",
          borderRadius: 10,
          padding: 14,
          color: "var(--ink-600)",
          fontSize: 13,
        }}
      >
        {t("postCard.shareUnavailable")}
      </div>
    )
  }

  // Une PAGE qui parle se cite sous sa propre identité, comme sur sa carte.
  const quoted: { name: string; handle: string | null; avatarUrl: string | null; shape: "round" | "square" } =
    share.page !== null
      ? { name: share.page.name, handle: share.page.handle, avatarUrl: share.page.logoUrl, shape: "square" }
      : {
          name: share.author.displayName ?? t("postCard.unknownAuthor"),
          handle: share.author.handle,
          avatarUrl: share.author.avatarUrl,
          shape: "round",
        }

  return (
    <div
      style={{
        // Sans liseré (2026-08-21) : la citation se distingue par sa surface
        // teintée.
        borderRadius: 10,
        padding: 12,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        background: "var(--ink-50, var(--ink-0))",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Avatar
          displayName={quoted.name}
          avatarUrl={quoted.avatarUrl}
          size={28}
          hasIdentity={quoted.handle !== null}
          shape={quoted.shape}
        />
        <p style={{ margin: 0, fontSize: 13, color: "var(--ink-800)" }}>
          <span style={{ fontWeight: 600 }}>{quoted.name}</span>
          {quoted.handle ? (
            <span style={{ color: "var(--ink-600)" }}>
              {" "}
              @{quoted.handle}
            </span>
          ) : null}
          <span style={{ color: "var(--ink-600)" }}>
            {" · "}
            <time dateTime={new Date(share.publishedAt).toISOString()}>
              {formatRelativeDate(share.publishedAt, now, t, timeZone)}
            </time>
          </span>
        </p>
      </div>
      {share.body.length > 0 ? <RichText body={share.body} onTag={onTag} onMention={onMention} /> : null}
      {share.media.length > 0 ? <PostMedia media={share.media} presentation={presentation} /> : null}
    </div>
  )
}
