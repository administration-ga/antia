// Dupliqué de socle/packages/agent-features/src/features/reseau-albums/AlbumComposer.tsx @ ad2e7fdc2 — adaptations : fonctions TYPÉES du moteur (`albums.albums.*`, dépôt par `media.media.generateUploadUrl` sous l'usage `album_image`) appelées avec le réseau courant (`useNetwork().networkId`) ; identifiants d'album et de photo typés ; phrases par l'i18n (espace de noms `albums`, clés `albumComposer.*`, et `album-model` avec `t`) ; pourcentage dit dans la langue courante (`Intl.NumberFormat`) ; refus du moteur traduits par leur règle ou leur code (`albumEngineErrorText`), jamais le texte brut ; `ReencodeImage` reçoit `t` en second paramètre ; ajout des photos par lots de `ALBUM_ADD_BATCH_MAX` (le moteur refuse un lot plus grand, quand le composeur en propose jusqu'à soixante) ; barre de progression rendue sur place (`Progress` n'existe pas dans `@antia/ui`) ; bornes lues au domaine du moteur.
"use client"

/**
 * Le composeur d'ALBUM — titre et audience → photos → ordre et couverture →
 * aperçu → publier (plan 09D, ADR-0145).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * TROIS CHOSES QUE CE COMPOSANT NE DÉCIDE PAS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * · Les ÉTAPES, ce qui bloque, la progression par fichier, le déplacement au
 *   clavier et les lots d'ajout vivent dans `album-model.ts`, module PUR et
 *   testé.
 * · Les REFUS de fond restent au SERVEUR, qui relit les métadonnées réelles du
 *   stockage. Les refus d'ici évitent un téléversement perdu, rien de plus.
 * · Le brouillon d'album est le brouillon SERVEUR (`status: "draft"`), pas un
 *   état de composant : l'album est créé à l'envoi des photos, et reste privé
 *   jusqu'à « Publier ». Fermer la fenêtre ne perd donc rien.
 *
 * ⚠️ Les métadonnées EXIF partent AVANT le téléversement : chaque image est
 * ré-encodée sur un `<canvas>`, et un ré-encodage impossible REFUSE le fichier
 * (fail-closed) au lieu de laisser passer l'original. La décision est dans
 * `albumReencodePlan` ; l'exécution est injectable (`reencode`) pour être
 * vérifiable sans navigateur.
 */

import { useNetwork } from "@antia/api/network"
import { ALBUM_ITEMS_MAX } from "@antia/social-domain/albums"
import { Alert, Badge, Button, Card, Icon, TextArea, TextInput } from "@antia/ui"
import { useMutation } from "convex/react"
import type { TFunction } from "i18next"
import { useCallback, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import {
  IMAGE_ONLY_ACCEPT,
  useMediaDraft,
} from "../reseau-personnel/useMediaDraft"
import {
  ALBUM_UPLOAD_USAGE,
  albumsApi,
  albumUploadUrlRef,
  type AlbumAudienceValue,
  type AlbumId,
  type AlbumItemId,
  type DeclaredAlbumItem,
} from "./albums-api"
import {
  ALBUM_STEPS,
  ALBUM_REENCODE_QUALITY,
  albumAddBatches,
  albumAudienceHint,
  albumAudienceLabel,
  albumCountLabel,
  albumEngineErrorText,
  albumReencodePlan,
  albumStepBlocker,
  albumStepLabel,
  albumUploadProgress,
  moveAlbumItem,
  moveAnnouncement,
  nextAlbumStep,
  previousAlbumStep,
  orderChanged,
  reencodeFailureMessage,
  remainingSlots,
  type AlbumStep,
} from "./album-model"

/** Ce que le ré-encodage rend : un fichier NU, ou un refus (phrase déjà traduite). */
export type ReencodeResult =
  | { ok: true; file: File }
  | { ok: false; reason: string }

/** Le ré-encodage, injectable ; `t` traduit la phrase d'un refus. */
export type ReencodeImage = (file: File, t: TFunction) => Promise<ReencodeResult>

/** Les deux audiences proposées, la plus fermée d'abord (c'est aussi le défaut). */
const AUDIENCE_CHOICES = ["connections", "public"] as const satisfies readonly AlbumAudienceValue[]

/**
 * Le ré-encodage RÉEL — décodage puis ré-encodage sur canvas.
 *
 * Aucun bloc APP1/EXIF n'est recopié par ce chemin : ce qui sort est une image
 * nue. L'orientation est aplatie au passage (le navigateur applique
 * `image-orientation` au décodage), ce qui rend le champ EXIF correspondant
 * inutile.
 *
 * ⚠️ FAIL-CLOSED : tout échec — canvas indisponible, image illisible, encodeur
 * muet — rend un refus. Jamais l'original.
 */
const reencodeOnCanvas: ReencodeImage = async (file, t) => {
  const plan = albumReencodePlan(file.type, t)
  if (plan.action === "refuse") return { ok: false, reason: plan.reason }
  try {
    const bitmap = await createImageBitmap(file)
    const canvas = document.createElement("canvas")
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const context = canvas.getContext("2d")
    if (!context) return { ok: false, reason: reencodeFailureMessage(file.name, t) }
    context.drawImage(bitmap, 0, 0)
    bitmap.close?.()
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((result) => resolve(result), plan.targetType, ALBUM_REENCODE_QUALITY)
    })
    if (!blob) return { ok: false, reason: reencodeFailureMessage(file.name, t) }
    return {
      ok: true,
      file: new File([blob], file.name, { type: plan.targetType }),
    }
  } catch {
    return { ok: false, reason: reencodeFailureMessage(file.name, t) }
  }
}

/**
 * La barre d'avancement de l'envoi — décorative : la phrase `aria-live` qui la
 * suit porte l'information. Mêmes jetons que la barre de progression de
 * l'ancien ui-v2 (`@antia/ui` n'en porte pas encore).
 */
function UploadProgressBar({
  value,
  total,
  tone,
  label,
}: {
  value: number
  total: number
  tone: "primary" | "warning"
  label: string
}) {
  const pct = total > 0 ? Math.min(100, (value / total) * 100) : 0
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, width: "100%" }}>
      <div
        style={{
          flex: 1,
          height: 6,
          background: "var(--ink-200)",
          borderRadius: 999,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: tone === "warning" ? "var(--warning-500)" : "var(--primary-500)",
            borderRadius: 999,
            transition: "width .3s",
          }}
        />
      </div>
      <span
        style={{
          fontSize: 12,
          color: "var(--ink-700)",
          fontVariantNumeric: "tabular-nums",
          minWidth: 56,
          textAlign: "right",
        }}
      >
        {label}
      </span>
    </div>
  )
}

/**
 * La feuille du composeur, hors du JSX : un littéral enfant de `<style>`
 * passerait pour une chaîne d'interface. Jetons de la charte seulement.
 * AUCUN accent grave dans ce bloc : un backtick y terminerait la chaîne.
 */
const ALBUM_COMPOSER_CSS = `
  .ac-steps { display: flex; flex-wrap: wrap; gap: 8px; list-style: none; margin: 0; padding: 0; }
  .ac-step {
    font-size: 12px; padding: 4px 10px; border-radius: 999px;
    border: 1px solid var(--ink-200); color: var(--ink-600);
  }
  .ac-step[aria-current="step"] { border-color: var(--primary-500); color: var(--primary-600); font-weight: 600; }
  .ac-grid {
    display: grid; gap: 12px;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  }
  .ac-tile {
    border: 1px solid var(--ink-200); border-radius: 12px; overflow: hidden;
    display: flex; flex-direction: column; background: var(--ink-0);
  }
  .ac-tile img { width: 100%; aspect-ratio: 4 / 3; object-fit: cover; display: block; }
  .ac-tile-body { padding: 8px; display: flex; flex-direction: column; gap: 6px; }
  .ac-tile-actions { display: flex; gap: 6px; flex-wrap: wrap; }
  /* 44 px de cible tactile, y compris pour les commandes d'ordre. */
  .ac-tile-actions button { min-height: 44px; min-width: 44px; }
  .ac-actions { display: flex; gap: 8px; flex-wrap: wrap; }
  .ac-audience { display: flex; flex-direction: column; gap: 8px; }
  .ac-audience label {
    display: flex; gap: 10px; align-items: flex-start; padding: 10px;
    border: 1px solid var(--ink-200); border-radius: 10px; cursor: pointer;
    min-height: 44px;
  }
`

export interface AlbumComposerProps {
  /** Le handle du propriétaire — sert au retour vers la galerie publiée. */
  handle: string
  /** Appelé après publication, avec l'identifiant de l'album créé. */
  onPublished?: (albumId: string) => void
  onCancel?: () => void
  /** Injecté par les tests : le canvas n'existe pas en `jsdom`. */
  reencode?: ReencodeImage
}

export function AlbumComposer({
  handle: _handle,
  onPublished,
  onCancel,
  reencode = reencodeOnCanvas,
}: AlbumComposerProps) {
  const { networkId } = useNetwork()
  const { t, i18n } = useTranslation("albums")
  const [step, setStep] = useState<AlbumStep>("identite")
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [audience, setAudience] = useState<AlbumAudienceValue>("connections")
  const [albumId, setAlbumId] = useState<AlbumId | null>(null)
  const [order, setOrder] = useState<readonly AlbumItemId[]>([])
  const [coverId, setCoverId] = useState<AlbumItemId | null>(null)
  const [busy, setBusy] = useState(false)
  const [announcement, setAnnouncement] = useState("")
  const [refusal, setRefusal] = useState<string | null>(null)

  /**
   * La clé d'idempotence de l'ALBUM, tirée AU MONTAGE : un renvoi après une
   * coupure ne fabrique pas un second album vide.
   */
  const idempotencyKey = useRef(
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `album-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  )
  /** Une clé par FICHIER — c'est elle qui rend la reprise exacte. */
  const itemKeys = useRef(new Map<string, string>())
  const fileInput = useRef<HTMLInputElement>(null)

  // Mode LOCAL du brouillon de médias : la cible durable d'un album est
  // l'album lui-même (créé côté serveur à l'envoi des photos), pas une clé
  // de `post-draft` — l'album n'est pas une publication.
  const draft = useMediaDraft(undefined, {
    maxCount: ALBUM_ITEMS_MAX,
    imagesOnly: true,
    tooManyMessage: (max) => t("albumComposer.tooMany", { max }),
  })

  const create = useMutation(albumsApi.create)
  const addItems = useMutation(albumsApi.addItems)
  const publish = useMutation(albumsApi.publish)
  const reorder = useMutation(albumsApi.reorder)
  const setCoverMutation = useMutation(albumsApi.setCover)
  const setCaption = useMutation(albumsApi.setCaption)
  const generateUploadUrl = useMutation(albumUploadUrlRef)

  const progress = useMemo(
    () => albumUploadProgress(draft.items, t),
    [draft.items, t],
  )
  const percentLabel = useMemo(
    () =>
      new Intl.NumberFormat(i18n.language, {
        style: "percent",
        maximumFractionDigits: 0,
      }).format(progress.percent / 100),
    [i18n.language, progress.percent],
  )
  const blocker = albumStepBlocker(
    {
      step,
      title,
      photoCount: draft.items.length,
    },
    t,
  )

  /** Le brouillon SERVEUR — créé une fois, repris ensuite. */
  const ensureAlbum = useCallback(async (): Promise<AlbumId> => {
    if (albumId !== null) return albumId
    const created = await create({
      networkId,
      title: title.trim(),
      ...(description.trim().length > 0 ? { description: description.trim() } : {}),
      audience,
      idempotencyKey: idempotencyKey.current,
    })
    setAlbumId(created.albumId)
    return created.albumId
  }, [albumId, create, networkId, title, description, audience])

  /**
   * Les fichiers choisis : ré-encodés d'abord, ajoutés au brouillon ensuite.
   *
   * Un refus de ré-encodage ne fait pas tomber la sélection entière : les
   * autres photos passent, et le refus est nommé.
   */
  const onFiles = useCallback(
    async (files: readonly File[]) => {
      setRefusal(null)
      const prets: File[] = []
      const refus: string[] = []
      for (const file of files) {
        const result = await reencode(file, t)
        if (result.ok) prets.push(result.file)
        else refus.push(result.reason)
      }
      if (prets.length > 0) draft.add(prets)
      if (refus.length > 0) setRefusal(refus[0]!)
    },
    [draft, reencode, t],
  )

  /**
   * Envoyer : téléverser ce qui reste, puis enregistrer le lot.
   *
   * ⚠️ Deux idempotences, à deux niveaux, et les deux sont nécessaires :
   * `useMediaDraft.upload` saute les octets déjà déposés, `addItems` saute les
   * photos déjà enregistrées. Une double soumission n'ajoute donc rien, et une
   * coupure au milieu ne coûte que le reste.
   *
   * ⚠️ L'enregistrement part par LOTS (`albumAddBatches`) : le moteur refuse un
   * appel de plus de `ALBUM_ADD_BATCH_MAX` photos. Un même brouillon donne
   * toujours les mêmes lots, dans le même ordre — la reprise reste exacte.
   */
  const onUpload = useCallback(async () => {
    setBusy(true)
    setRefusal(null)
    try {
      const id = await ensureAlbum()
      const uploaded = await draft.upload(() =>
        generateUploadUrl({ networkId, usage: ALBUM_UPLOAD_USAGE }),
      )
      const items: DeclaredAlbumItem[] = uploaded.map((media, index) => {
        const localId = draft.items[index]?.localId ?? `${index}`
        let key = itemKeys.current.get(localId)
        if (key === undefined) {
          key = `${idempotencyKey.current}-${localId}`
          itemKeys.current.set(localId, key)
        }
        return {
          // Le dépôt rendu par l'URL du moteur ; `addItems` le revérifie
          // (neuf, de l'appelant, conforme à l'usage) avant de l'embarquer.
          storageId: media.storageId,
          mimeType: media.mimeType,
          sizeBytes: media.sizeBytes,
          ...(media.altText !== undefined ? { altText: media.altText } : {}),
          idempotencyKey: key,
        }
      })
      const itemIds: AlbumItemId[] = []
      let skipped = 0
      for (const batch of albumAddBatches(items)) {
        const result = await addItems({ networkId, albumId: id, items: batch })
        itemIds.push(...result.itemIds)
        skipped += result.skipped
      }
      setOrder(itemIds)
      setCoverId((current) => current ?? itemIds[0] ?? null)
      setStep("ordre")
      setAnnouncement(
        t("albumComposer.addedAnnouncement", {
          photos: albumCountLabel(itemIds.length, t),
        }) + (skipped > 0 ? ` ${t("albumComposer.notDuplicated")}` : ""),
      )
    } catch (error) {
      // ⚠️ Le refus du moteur voyage dans `error.data` (une règle ou un code) :
      // on le traduit, on ne montre jamais le texte brut du serveur.
      setRefusal(albumEngineErrorText(error, "albums:albumComposer.uploadFailed", t))
    } finally {
      setBusy(false)
    }
  }, [addItems, draft, ensureAlbum, generateUploadUrl, networkId, t])

  const move = useCallback(
    (itemId: AlbumItemId, direction: "up" | "down") => {
      const next = moveAlbumItem(order, itemId, direction)
      if (!orderChanged(order, next)) return
      setOrder(next)
      setAnnouncement(
        moveAnnouncement(
          {
            position: next.indexOf(itemId) + 1,
            total: next.length,
          },
          t,
        ),
      )
    },
    [order, t],
  )

  const onPublish = useCallback(async () => {
    if (albumId === null) return
    setBusy(true)
    setRefusal(null)
    try {
      await reorder({ networkId, albumId, itemIds: [...order] })
      if (coverId !== null) await setCoverMutation({ networkId, albumId, itemId: coverId })
      await publish({ networkId, albumId })
      toast.success(t("albumComposer.published"))
      draft.clear()
      onPublished?.(albumId)
    } catch (error) {
      setRefusal(albumEngineErrorText(error, "albums:albumComposer.publishFailed", t))
    } finally {
      setBusy(false)
    }
  }, [albumId, coverId, draft, networkId, onPublished, order, publish, reorder, setCoverMutation, t])

  const stepIndex = ALBUM_STEPS.indexOf(step)

  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <style href="album-composer" precedence="default">
        {ALBUM_COMPOSER_CSS}
      </style>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: 18, color: "var(--ink-900)" }}>
          {t("albumComposer.title")}
        </h2>
        <ol className="ac-steps">
          {ALBUM_STEPS.map((value, index) => (
            <li
              key={value}
              className="ac-step"
              aria-current={value === step ? "step" : undefined}
            >
              {index + 1}. {albumStepLabel(value, t)}
            </li>
          ))}
        </ol>
      </div>

      {refusal ? (
        <Alert tone="danger" title={t("albumComposer.refusedTitle")}>
          {refusal}
        </Alert>
      ) : null}
      {draft.rejection ? (
        <Alert tone="warning" title={t("albumComposer.rejectedTitle")}>
          {draft.rejection}
        </Alert>
      ) : null}

      {step === "identite" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <label
            htmlFor="ac-titre"
            style={{ fontSize: 13, color: "var(--ink-700)" }}
          >
            {t("albumComposer.titleLabel")}
          </label>
          <TextInput
            id="ac-titre"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={t("albumComposer.titlePlaceholder")}
          />
          <label
            htmlFor="ac-description"
            style={{ fontSize: 13, color: "var(--ink-700)" }}
          >
            {t("albumComposer.descriptionLabel")}
          </label>
          <TextArea
            id="ac-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
          <fieldset
            className="ac-audience"
            style={{ border: 0, margin: 0, padding: 0 }}
          >
            <legend style={{ fontSize: 13, color: "var(--ink-700)", padding: 0 }}>
              {t("albumComposer.audienceLegend")}
            </legend>
            {AUDIENCE_CHOICES.map((value) => (
              <label key={value} htmlFor={`ac-audience-${value}`}>
                <input
                  id={`ac-audience-${value}`}
                  type="radio"
                  name="ac-audience"
                  value={value}
                  checked={audience === value}
                  onChange={() => setAudience(value)}
                />
                <span>
                  <strong style={{ color: "var(--ink-900)" }}>
                    {albumAudienceLabel(value, t)}
                  </strong>
                  <br />
                  <span style={{ fontSize: 12, color: "var(--ink-600)" }}>
                    {albumAudienceHint(value, t)}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>
          <p style={{ margin: 0, fontSize: 12, color: "var(--ink-600)" }}>
            <Icon name="lock" size={12} /> {t("albumComposer.nothingVisible")}
          </p>
        </div>
      ) : null}

      {step === "photos" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input
            ref={fileInput}
            type="file"
            multiple
            accept={IMAGE_ONLY_ACCEPT}
            aria-label={t("albumComposer.choosePhotos")}
            onChange={(event) => {
              const files = Array.from(event.target.files ?? [])
              event.target.value = ""
              void onFiles(files)
            }}
          />
          <p style={{ margin: 0, fontSize: 12, color: "var(--ink-600)" }}>
            {t("albumComposer.photosHint", {
              photos: albumCountLabel(draft.items.length, t),
              count: remainingSlots(draft.items.length),
            })}
          </p>
          {progress.total > 0 ? (
            <>
              <UploadProgressBar
                value={progress.uploaded}
                total={progress.total}
                tone={progress.failed > 0 ? "warning" : "primary"}
                label={percentLabel}
              />
              <p
                role="status"
                aria-live="polite"
                style={{ margin: 0, fontSize: 12, color: "var(--ink-600)" }}
              >
                {progress.label}
              </p>
            </>
          ) : null}
          <div className="ac-grid">
            {draft.items.map((item) => (
              <figure key={item.localId} className="ac-tile" style={{ margin: 0 }}>
                {item.previewUrl ? (
                  <img src={item.previewUrl} alt="" loading="lazy" />
                ) : null}
                <figcaption className="ac-tile-body">
                  <span style={{ fontSize: 12, color: "var(--ink-700)" }}>
                    {item.fileName}
                  </span>
                  <Badge
                    tone={
                      item.upload.status === "uploaded"
                        ? "success"
                        : item.upload.status === "failed"
                          ? "warning"
                          : "neutral"
                    }
                    size="sm"
                  >
                    {t(`albumComposer.uploadState.${item.upload.status}`)}
                  </Badge>
                  <div className="ac-tile-actions">
                    <Button
                      variant="ghost"
                      size="sm"
                      icon="trash"
                      onClick={() => draft.remove(item.localId)}
                      aria-label={t("albumComposer.removeFile", { name: item.fileName })}
                    >
                      {t("albumComposer.remove")}
                    </Button>
                  </div>
                </figcaption>
              </figure>
            ))}
          </div>
          <div className="ac-actions">
            <Button
              icon="upload"
              disabled={busy || draft.items.length === 0 || !progress.hasWork}
              onClick={() => void onUpload()}
            >
              {busy ? t("albumComposer.sending") : t("albumComposer.send")}
            </Button>
            {!progress.hasWork && progress.total > 0 ? (
              <Button
                variant="secondary"
                icon="arrowRight"
                onClick={() => void onUpload()}
                disabled={busy}
              >
                {t("albumComposer.continue")}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {step === "ordre" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <p style={{ margin: 0, fontSize: 13, color: "var(--ink-700)" }}>
            {t("albumComposer.orderHint")}
          </p>
          <ol
            className="ac-grid"
            style={{ listStyle: "none", margin: 0, padding: 0 }}
          >
            {order.map((itemId, index) => (
              <li key={itemId} className="ac-tile">
                <div className="ac-tile-body">
                  <span style={{ fontSize: 12, color: "var(--ink-700)" }}>
                    {t("albumComposer.photoPosition", { position: index + 1, total: order.length })}
                  </span>
                  {coverId === itemId ? (
                    <Badge tone="primary" size="sm">
                      {t("albumComposer.cover")}
                    </Badge>
                  ) : null}
                  <input
                    aria-label={t("albumComposer.captionLabel", { position: index + 1 })}
                    placeholder={t("albumComposer.captionPlaceholder")}
                    onBlur={(event) => {
                      const value = event.target.value.trim()
                      if (value.length === 0) return
                      void setCaption({ networkId, itemId, caption: value }).catch(() => {
                        toast.error(t("albumComposer.captionFailed"))
                      })
                    }}
                  />
                  <div className="ac-tile-actions">
                    <Button
                      variant="ghost"
                      size="sm"
                      icon="arrowUp"
                      aria-label={t("albumComposer.moveUpLabel", { position: index + 1 })}
                      disabled={index === 0}
                      onClick={() => move(itemId, "up")}
                    >
                      {t("albumComposer.moveUp")}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon="arrowDown"
                      aria-label={t("albumComposer.moveDownLabel", { position: index + 1 })}
                      disabled={index === order.length - 1}
                      onClick={() => move(itemId, "down")}
                    >
                      {t("albumComposer.moveDown")}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon="star"
                      aria-label={t("albumComposer.setCoverLabel", { position: index + 1 })}
                      aria-pressed={coverId === itemId}
                      onClick={() => setCoverId(itemId)}
                    >
                      {t("albumComposer.cover")}
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {step === "apercu" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <h3 style={{ margin: 0, fontSize: 16, color: "var(--ink-900)" }}>
            {title.trim()}
          </h3>
          {description.trim().length > 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: "var(--ink-600)" }}>
              {description.trim()}
            </p>
          ) : null}
          <p style={{ margin: 0, fontSize: 13, color: "var(--ink-700)" }}>
            <Icon name="users" size={14} /> {albumAudienceLabel(audience, t)} —{" "}
            {albumAudienceHint(audience, t)}
          </p>
          <p style={{ margin: 0, fontSize: 13, color: "var(--ink-700)" }}>
            <Icon name="image" size={14} /> {albumCountLabel(order.length, t)}
          </p>
          <Alert tone="info" title={t("albumComposer.beforePublishTitle")}>
            {t("albumComposer.beforePublishText")}
          </Alert>
        </div>
      ) : null}

      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <div className="ac-actions">
        {stepIndex > 0 ? (
          <Button
            variant="secondary"
            icon="arrowLeft"
            disabled={busy}
            onClick={() => setStep(previousAlbumStep(step))}
          >
            {t("albumComposer.back")}
          </Button>
        ) : onCancel ? (
          <Button variant="ghost" disabled={busy} onClick={onCancel}>
            {t("albumComposer.cancel")}
          </Button>
        ) : null}

        {step === "apercu" ? (
          <Button icon="check" disabled={busy} onClick={() => void onPublish()}>
            {busy ? t("albumComposer.publishing") : t("albumComposer.publish")}
          </Button>
        ) : step === "photos" ? null : (
          <Button
            icon="arrowRight"
            disabled={busy || blocker !== null}
            onClick={() => setStep(nextAlbumStep(step))}
          >
            {t("albumComposer.continue")}
          </Button>
        )}
      </div>

      {blocker ? (
        <p style={{ margin: 0, fontSize: 12, color: "var(--ink-600)" }}>
          {blocker}
        </p>
      ) : null}
    </Card>
  )
}
