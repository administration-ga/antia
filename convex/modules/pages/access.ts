// Dupliqué de socle/convex/modules/reseauPages/access.ts @ ad2e7fdc2 — adaptations : réécrit (owner map §6.15) — identité lue sur la PAGE au lieu d'être dérivée d'une organisation, images servies par la garde des fichiers (`servableUrl`, D05 : plus de `getUrl` brut, aucun identifiant de stockage hors d'ici) ; page lisible DEPUIS son réseau, ou depuis la racine si elle y est (`onRoot`) ; autorité = SIGNATAIRE VIVANT (habilitation acceptée, page active, adhésion active au réseau de la page, identité forte pour une page officielle) relue à chaque acte, au lieu de `communication.publish` sur une organisation ; badge CALCULÉ de la confiance ; refus indistinct à code (`notFound`), rôle manquant `pageRoleRequired` ; adresse prise refusée par `handleUnavailable` ; `pageForOrg` retiré (plus d'organisation).
/**
 * Les gardes des pages — le point de passage unique.
 *
 * Aucune fonction Convex ici. Une seule définition de « cette page est
 * servable », de « elle se lit d'ici » et de « cette personne parle en son
 * nom » : deux définitions divergeraient au premier oubli, et c'est sur cette
 * différence que reposerait une fuite depuis une page retirée.
 */
import { computePageBadge } from "@antsia/social-domain/badges"
import { derivePageHandle, PAGE_SIGNATORIES_MAX, type PageRole } from "@antsia/social-domain/pages"
import { buildSearchableText } from "@antsia/social-domain/searchText"

import type { Doc, Id } from "../../_generated/dataModel"
import type { QueryCtx } from "../../_generated/server"
import { isActiveMember } from "../../lib/access"
import { fail, notFound } from "../../lib/errors"
import { servableUrl } from "../files/storageGuard"
import { hasStrongIdentityFor } from "../people/persons"
import type { PageCard } from "./validators"

type ReadCtx = Pick<QueryCtx, "db">
type UrlCtx = Pick<QueryCtx, "db" | "storage">

// ═══════════════════════════════════════════════════════════════
// Lire une page
// ═══════════════════════════════════════════════════════════════

/** Lisible depuis la racine : page de la racine, ou page à la règle `root` — dénormalisé à chaque écriture. */
export function isPageOnRoot(network: Pick<Doc<"networks">, "kind">, visibility: Doc<"pages">["visibility"]): boolean {
  return network.kind === "root" || visibility === "root"
}

/** La page se lit-elle DEPUIS ce réseau ? Le sien, ou la racine si elle y est (`onRoot`). */
export function isPageInReadingContext(page: Doc<"pages">, network: Doc<"networks">): boolean {
  if (page.networkId === network._id) return true
  return network.kind === "root" && page.onRoot
}

/**
 * La page SERVABLE (active) et lisible d'ici, ou `null` — jamais d'exception.
 * Page inconnue, retirée, ou d'un autre réseau : le même `null`. Distinguer
 * dirait à qui cherche qu'une organisation a « déjà eu » une page.
 */
export async function readablePageOrNull(ctx: ReadCtx, network: Doc<"networks">, pageId: Id<"pages">): Promise<Doc<"pages"> | null> {
  const page = await ctx.db.get(pageId)
  if (!page || page.status !== "active" || !isPageInReadingContext(page, network)) return null
  return page
}

export async function requireReadablePage(ctx: ReadCtx, network: Doc<"networks">, pageId: Id<"pages">): Promise<Doc<"pages">> {
  return (await readablePageOrNull(ctx, network, pageId)) ?? notFound()
}

/** La page désignée par son adresse, QUEL QUE SOIT son état — l'adresse saisie est repliée comme à la création. */
export async function findPageByHandle(ctx: ReadCtx, rawHandle: string): Promise<Doc<"pages"> | null> {
  const handle = derivePageHandle(rawHandle)
  if (handle.length === 0) return null
  return await ctx.db
    .query("pages")
    .withIndex("by_handle", (q) => q.eq("handle", handle))
    .unique()
}

export async function readablePageByHandle(ctx: ReadCtx, network: Doc<"networks">, rawHandle: string): Promise<Doc<"pages"> | null> {
  const page = await findPageByHandle(ctx, rawHandle)
  if (!page || page.status !== "active" || !isPageInReadingContext(page, network)) return null
  return page
}

export async function requireReadablePageByHandle(ctx: ReadCtx, network: Doc<"networks">, rawHandle: string): Promise<Doc<"pages">> {
  return (await readablePageByHandle(ctx, network, rawHandle)) ?? notFound()
}

/**
 * L'adresse est-elle libre ? Refus EXPLICITE (`handleUnavailable`), comme pour
 * l'identifiant d'une personne : qui crée ou renomme doit savoir pourquoi.
 */
export async function assertPageHandleFree(ctx: ReadCtx, handle: string, exceptPageId?: Id<"pages">): Promise<void> {
  const taken = await ctx.db
    .query("pages")
    .withIndex("by_handle", (q) => q.eq("handle", handle))
    .unique()
  if (taken && taken._id !== exceptPageId) fail("handleUnavailable")
}

/** Le texte indexé d'une page — recalculé à chaque changement de nom, de sigle ou d'adresse. */
export function pageSearchText(page: { name: string; shortName?: string; handle: string }): string {
  return buildSearchableText(page.name, page.shortName, page.handle)
}

// ═══════════════════════════════════════════════════════════════
// Signataires — l'autorité ACTUELLE
// ═══════════════════════════════════════════════════════════════

/** La ligne de signataire d'une personne pour une page, ou `null`. */
export async function signatoryRowOf(ctx: ReadCtx, pageId: Id<"pages">, personId: Id<"persons">): Promise<Doc<"pageSignatories"> | null> {
  return await ctx.db
    .query("pageSignatories")
    .withIndex("by_page_person", (q) => q.eq("pageId", pageId).eq("personId", personId))
    .unique()
}

/**
 * Le rôle VIVANT d'une personne sur une page, ou `null` : la ligne existe et
 * est ACCEPTÉE, la page est active, et la personne est membre active du réseau
 * de la page. Un signataire parti du réseau, ou suspendu, ne parle plus au nom
 * de personne ; une invitation en attente ne donne rien. Pour une page
 * OFFICIELLE, l'identité forte (IDN `loa ≥ 2`) se relit aussi : un lien IDN
 * révoqué referme la signature.
 */
export async function liveSignatoryRole(ctx: ReadCtx, page: Doc<"pages">, personId: Id<"persons">): Promise<PageRole | null> {
  if (page.status !== "active") return null
  const row = await signatoryRowOf(ctx, page._id, personId)
  if (!row || row.acceptedAt === undefined) return null
  if (!(await isActiveMember(ctx, page.networkId, personId))) return null
  if (page.trust === "official" && !(await hasStrongIdentityFor(ctx, personId))) return null
  return row.role
}

/** Exige un rôle vivant (`signatory` : tout signataire ; `admin` : un administrateur). */
export async function requirePageRole(ctx: ReadCtx, page: Doc<"pages">, personId: Id<"persons">, min: PageRole): Promise<PageRole> {
  const role = await liveSignatoryRole(ctx, page, personId)
  if (role === null || (min === "admin" && role !== "admin")) return fail("pageRoleRequired")
  return role
}

/**
 * Une page GÉRÉE depuis ce réseau : la sienne (on ne publie ni ne gère une page
 * d'un autre réseau depuis la racine), active, et l'appelant y a le rôle
 * demandé. Page inconnue, retirée ou d'ailleurs : refus indistinct.
 */
export async function requireManagedPage(
  ctx: ReadCtx,
  caller: { networkId: Id<"networks">; personId: Id<"persons"> },
  pageId: Id<"pages">,
  min: PageRole,
): Promise<{ page: Doc<"pages">; role: PageRole }> {
  const page = await ctx.db.get(pageId)
  if (!page || page.networkId !== caller.networkId || page.status !== "active") return notFound()
  return { page, role: await requirePageRole(ctx, page, caller.personId, min) }
}

/** Les signataires d'une page (bornés par le plafond), lignes brutes. */
export async function signatoryRowsOf(ctx: ReadCtx, pageId: Id<"pages">): Promise<Doc<"pageSignatories">[]> {
  const [admins, signatories] = await Promise.all(
    (["admin", "signatory"] as const).map(
      async (role) =>
        await ctx.db
          .query("pageSignatories")
          .withIndex("by_page_role", (q) => q.eq("pageId", pageId).eq("role", role))
          .take(PAGE_SIGNATORIES_MAX + 1),
    ),
  )
  return [...(admins ?? []), ...(signatories ?? [])]
}

/** Combien d'administrateurs VIVANTS (acceptés, membres actifs du réseau de la page) — le garde-fou du dernier. */
export async function countLiveAdmins(ctx: ReadCtx, page: Doc<"pages">): Promise<number> {
  const admins = await ctx.db
    .query("pageSignatories")
    .withIndex("by_page_role", (q) => q.eq("pageId", page._id).eq("role", "admin"))
    .take(PAGE_SIGNATORIES_MAX + 1)
  let live = 0
  for (const row of admins) if (row.acceptedAt !== undefined && (await isActiveMember(ctx, page.networkId, row.personId))) live += 1
  return live
}

// ═══════════════════════════════════════════════════════════════
// Identité affichée
// ═══════════════════════════════════════════════════════════════

/** La CARTE d'une page (`pageCardValidator`) : le logo par la garde des fichiers (`null` sans logo, ou retenu). */
export async function pageCardOf(ctx: UrlCtx, page: Doc<"pages">): Promise<PageCard> {
  return {
    pageId: page._id,
    networkId: page.networkId,
    handle: page.handle,
    name: page.name,
    shortName: page.shortName ?? null,
    logoUrl: page.logoStorageId ? await servableUrl(ctx, page.logoStorageId) : null,
    badge: computePageBadge(page.trust),
    ownerKind: page.ownerKind,
    country: page.country ?? null,
  }
}

/**
 * Un CACHE de cartes pour une lecture de fil : dix publications d'une même page
 * ne résolvent qu'une fois sa ligne et son logo. Une page retirée rend `null` —
 * sa publication n'est alors servie par personne (jamais rabattue sur
 * l'identité de son signataire).
 */
export function pageCardCache(ctx: UrlCtx): (pageId: Id<"pages">) => Promise<PageCard | null> {
  const cache = new Map<string, PageCard | null>()
  return async (pageId) => {
    const hit = cache.get(pageId)
    if (hit !== undefined) return hit
    const page = await ctx.db.get(pageId)
    const card = page && page.status === "active" ? await pageCardOf(ctx, page) : null
    cache.set(pageId, card)
    return card
  }
}
