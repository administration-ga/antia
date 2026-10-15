// Dupliqué de socle/packages/agent-features/src/features/reseau-albums/albums-api.ts @ ad2e7fdc2 — adaptations : RÉÉCRIT — les 13 références `makeFunctionReference` écrites à la main (« par nom », sans contrôle du typage) deviennent les références TYPÉES du moteur `api.modules.albums.albums.*` (`listMine` → `paginateMyAlbums`, `listForPerson` → `paginatePersonAlbums`) ; le dépôt d'octets passe par `media.media.generateUploadUrl` du moteur, usage `album_image` ; les DTO recopiés à la main sont TIRÉS de l'API (`FunctionReturnType` / `FunctionArgs`) — couverture `{ url, withheld, altText }`, photo retenue par la garde des fichiers (`url: null`, `withheld`) montrée à son seul propriétaire, champs absents en `null`, identifiants typés ; toute fonction prend le réseau courant (`networkId`).
/**
 * Les références de fonctions de la tranche ALBUMS, et les formes qu'elles
 * échangent — TOUTES tirées de l'API générée du moteur.
 *
 * Le socle passait par des références écrites à la main (`makeFunctionReference`
 * sur un NOM de fonction), faute de génération : renommer une fonction du
 * serveur les cassait sans que le typage ne bronche, et les DTO recopiés
 * pouvaient diverger en silence. Ici, un renommage ou un changement de forme
 * côté serveur casse la COMPILATION des écrans, ce qui est voulu.
 *
 * ⚠️ Toute fonction des albums est une fonction RÉSEAU : elle prend
 * `networkId` (`useNetwork().networkId`) en plus de ses arguments, et ne voit
 * que les albums de ce réseau.
 */
import { api } from "@antia/api/engine"
import type { FunctionArgs, FunctionReturnType } from "convex/server"

const albums = api.modules.albums.albums

export const albumsApi = {
  create: albums.create,
  update: albums.update,
  addItems: albums.addItems,
  setCaption: albums.setCaption,
  reorder: albums.reorder,
  setCover: albums.setCover,
  removeItem: albums.removeItem,
  publish: albums.publish,
  withdraw: albums.withdraw,
  remove: albums.remove,
  getAlbum: albums.getAlbum,
  paginateMyAlbums: albums.paginateMyAlbums,
  paginatePersonAlbums: albums.paginatePersonAlbums,
} as const

/**
 * Le dépôt d'octets d'une photo d'album : l'URL de dépôt du moteur, sous
 * l'usage `album_image` (`ALBUM_UPLOAD_USAGE`). Une URL de dépôt ne publie
 * rien : c'est `addItems` qui vérifie le dépôt (neuf, de l'appelant, conforme
 * à la politique de l'usage) et l'embarque sur une ligne.
 */
export const albumUploadUrlRef = api.modules.media.media.generateUploadUrl

/** L'usage déclaré au dépôt d'une photo d'album. */
export const ALBUM_UPLOAD_USAGE = "album_image" satisfies FunctionArgs<typeof albumUploadUrlRef>["usage"]

/** Un album et ses photos, tel que `getAlbum` le sert quand il est visible. */
export type AlbumDetail = NonNullable<FunctionReturnType<typeof albums.getAlbum>>

/** Le résumé d'un album — listes et en-tête de galerie. */
export type AlbumSummary = AlbumDetail["album"]

/** La couverture d'un album : l'URL par la garde des fichiers, ou la retenue (au propriétaire seul). */
export type AlbumCover = NonNullable<AlbumSummary["cover"]>

/** Une photo d'album : `url` nulle quand la garde la retient (son propriétaire seul la reçoit ainsi). */
export type AlbumItem = AlbumDetail["items"][number]

/** Une page de liste d'albums — la forme de `paginate` de Convex. */
export type AlbumListPage = FunctionReturnType<typeof albums.paginatePersonAlbums>

export type AlbumPaginationOpts = FunctionArgs<typeof albums.paginatePersonAlbums>["paginationOpts"]

export type AlbumAudienceValue = AlbumSummary["audience"]
export type AlbumStatusValue = AlbumSummary["status"]

/** L'identifiant d'un album et celui d'une photo. */
export type AlbumId = AlbumSummary["albumId"]
export type AlbumItemId = AlbumItem["itemId"]

/** Ce qu'un client DÉCLARE d'une photo — la clé est tirée PAR FICHIER. */
export type DeclaredAlbumItem = FunctionArgs<typeof albums.addItems>["items"][number]
