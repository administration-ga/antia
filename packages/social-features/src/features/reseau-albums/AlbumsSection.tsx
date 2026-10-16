// Dupliqué de socle/packages/agent-features/src/features/reseau-albums/AlbumsSection.tsx @ ad2e7fdc2 — adaptations : liste servie par la fonction TYPÉE du moteur `albums.albums.paginatePersonAlbums` (ex `listForPerson`), avec le réseau courant ; couverture du DTO du moteur (`cover: { url, withheld, altText }` — une couverture retenue par la garde des fichiers, que seul le propriétaire reçoit, se rend comme une couverture absente) ; ouverture d'un album par l'adresse composée sous le profil que sert l'application (`useRoutes().profile`) ; phrases par l'i18n (espace de noms `albums`, clés `albumsSection.*`) ; mention du dossier iProfil retirée (administratif, absent du moteur) ; props inchangées (montée par le profil).
"use client"

/**
 * Les ALBUMS d'une personne, sur son profil public.
 *
 * Les albums sont une vitrine sociale : ce composant ne lit que la liste que
 * le serveur sert, jamais un autre dossier de la personne.
 *
 * La liste est celle du SERVEUR (`paginatePersonAlbums`), qui re-juge
 * l'audience album par album : un brouillon n'en sort jamais, et un blocage
 * rend exactement la même page vide qu'un handle inconnu.
 */

import { useAuthenticatedConvexQuery } from "@antsia/api/hooks"
import { useNetwork, useRoutes } from "@antsia/api/network"
import { useRouter } from "@antsia/api/routing"
import { Badge, Button, Card, Icon, SkeletonCard } from "@antsia/ui"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { ReseauQueryError } from "../../shell/ReseauQueryError"
import {
  etatDeQuery,
  montreElements,
  montreEtatVide,
  montreSquelette,
} from "../../shell/query-state"
import { albumsApi, type AlbumSummary } from "./albums-api"
import {
  albumCountLabel,
  albumHref,
  albumStatusLabel,
  albumsEmptyText,
} from "./album-model"

const PAGE_SIZE = 12

/**
 * La feuille de la section, hors du JSX : un littéral enfant de `<style>`
 * passerait pour une chaîne d'interface. Jetons de la charte seulement.
 */
const ALBUMS_SECTION_CSS = `
  .as-grid {
    display: grid; gap: 12px; margin: 0; padding: 0; list-style: none;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  }
  .as-card {
    border: 1px solid var(--ink-200); border-radius: 12px; overflow: hidden;
    background: var(--ink-0); display: flex; flex-direction: column;
    text-align: left; width: 100%; padding: 0; cursor: pointer;
    min-height: 44px;
  }
  .as-cover { width: 100%; aspect-ratio: 4 / 3; object-fit: cover; display: block; background: var(--ink-150); }
  .as-cover--vide {
    width: 100%; aspect-ratio: 4 / 3; display: flex;
    align-items: center; justify-content: center; background: var(--ink-150);
    color: var(--ink-500);
  }
  .as-body { padding: 10px; display: flex; flex-direction: column; gap: 4px; }
`

export interface AlbumsSectionProps {
  handle: string
  /** Est-ce MON profil ? Décide de l'état vide et de l'entrée de création. */
  isSelf: boolean
  /**
   * Ne montrer que les vignettes, sans titre de section — l'onglet « Photos »
   * du profil, qui rend la même donnée sous une autre forme (une mosaïque de
   * couvertures plutôt qu'une liste d'albums).
   */
  variant?: "albums" | "photos"
  /** Ouvre le composeur — porté par le parent, qui tient la surface. */
  onCreate?: () => void
}

export function AlbumsSection({
  handle,
  isSelf,
  variant = "albums",
  onCreate,
}: AlbumsSectionProps) {
  const router = useRouter()
  const routes = useRoutes()
  const { networkId } = useNetwork()
  const { t } = useTranslation("albums")
  const [cursor] = useState<string | null>(null)
  const albums = useAuthenticatedConvexQuery(albumsApi.paginatePersonAlbums, {
    networkId,
    handle,
    paginationOpts: { numItems: PAGE_SIZE, cursor },
  })

  const page: AlbumSummary[] = albums.data?.page ?? []
  const etat = etatDeQuery(albums, page.length)

  if (montreSquelette(etat)) {
    return (
      <>
        <SkeletonCard />
      </>
    )
  }

  // La panne AVANT l'état vide : « aucun album » et « la lecture a échoué » ne
  // se disent pas de la même façon (R-08).
  if (albums.isError && page.length === 0) {
    return (
      <ReseauQueryError
        title={t("albumsSection.errorTitle")}
        message={t("albumsSection.errorMessage")}
        onRetry={() => void albums.refetch()}
      />
    )
  }

  if (montreEtatVide(etat, page.length)) {
    return (
      <Card style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <p style={{ margin: 0, fontSize: 14, color: "var(--ink-600)" }}>
          {albumsEmptyText(isSelf, t)}
        </p>
        {isSelf && onCreate ? (
          <div>
            <Button icon="plus" onClick={onCreate}>
              {t("albumsSection.create")}
            </Button>
          </div>
        ) : null}
      </Card>
    )
  }

  if (!montreElements(etat, page.length)) return null

  const profileHref = routes.profile(handle)

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <style href="albums-section" precedence="default">
        {ALBUMS_SECTION_CSS}
      </style>

      {/* Une panne APRÈS données conserve la liste, sous un bandeau. */}
      {albums.isError ? (
        <ReseauQueryError
          title={t("albumsSection.errorTitle")}
          message={t("albumsSection.errorMessage")}
          onRetry={() => void albums.refetch()}
        />
      ) : null}

      {isSelf && onCreate ? (
        <div>
          <Button icon="plus" size="sm" onClick={onCreate}>
            {t("albumsSection.create")}
          </Button>
        </div>
      ) : null}

      <ul className="as-grid">
        {page.map((album) => (
          <li key={album.albumId}>
            <button
              type="button"
              className="as-card"
              onClick={() => router.push(albumHref(profileHref, album.albumId))}
            >
              {/* Une couverture RETENUE par la garde des fichiers (seul le
                  propriétaire la reçoit) se rend comme une couverture
                  absente : jamais une image cassée. */}
              {album.cover?.url ? (
                <img
                  className="as-cover"
                  src={album.cover.url}
                  loading="lazy"
                  alt={album.cover.altText ?? ""}
                />
              ) : (
                <span className="as-cover--vide" aria-hidden="true">
                  <Icon name="image" size={24} />
                </span>
              )}
              <span className="as-body">
                <span style={{ fontSize: 14, color: "var(--ink-900)", fontWeight: 600 }}>
                  {album.title}
                </span>
                <span style={{ fontSize: 12, color: "var(--ink-600)" }}>
                  {albumCountLabel(album.itemCount, t)}
                </span>
                {/* Le statut n'a de sens que pour le propriétaire : les autres
                    ne voient que du publié, l'afficher serait du bruit. */}
                {album.isOwner && album.status !== "published" ? (
                  <span>
                    <Badge tone="neutral" size="sm">
                      {albumStatusLabel(album.status, t)}
                    </Badge>
                  </span>
                ) : null}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {/* L'onglet « Photos » ne montre que les couvertures : la galerie
          complète vit dans l'album, jamais aplatie ici — un mur de photos sans
          leur collection perd le titre qui les explique. */}
      {variant === "photos" ? (
        <p style={{ margin: 0, fontSize: 12, color: "var(--ink-600)" }}>
          {t("albumsSection.photosHint")}
        </p>
      ) : null}
    </div>
  )
}
