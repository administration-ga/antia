/**
 * La PAGE SOCIALE d'une boutique (P07, ADR-0019) — aucune fonction Convex ici.
 *
 * Une boutique est une capacité d'une page. À l'ADMISSION de sa vitrine
 * (décision tracée d'un opérateur, ou politique du réseau qui admet d'office
 * une adhésion vérifiée), la page qui la porte naît ici. `createPage` garde sa
 * règle (`verifiee`) : ce chemin n'est ouvert QUE par une admission, crée une
 * page d'entreprise `community` (aucune confiance déclarée, aucun badge
 * attribué, jamais une institution), dont le premier administrateur est le
 * préparateur de la boutique.
 *
 * Écrit à neuf avec les aides EXPORTÉES du module (adresse, recherche, lecture
 * depuis la racine, purge d'image) : aucun fichier existant n'est modifié.
 */
import type { PageOwnerKind } from "@antsia/social-domain/badges"
import { assertMemberCreatableOwnerKind, assertPageHandle, assertPageName, normalizePageDescription, pageTrustRank } from "@antsia/social-domain/pages"

import type { Doc, Id } from "../../_generated/dataModel"
import type { MutationCtx } from "../../_generated/server"
import { checked } from "../../lib/errors"
import { moderateContentWrite } from "../moderation/policy"
import { findPageByHandle, isPageOnRoot, pageSearchText } from "./access"
import { purgePageImage } from "./identity"

/** Une page peut-elle porter une boutique ? Ni institution, ni « Officiel » : l'usurpation reste fermée. */
export function isShopEligiblePage(page: Pick<Doc<"pages">, "ownerKind" | "trust">): boolean {
  return page.ownerKind !== "institution" && page.trust !== "official"
}

export type ShopPageInput = {
  network: Doc<"networks">
  /** Le préparateur de la boutique, premier administrateur de sa page. */
  adminPersonId: Id<"persons">
  name: string
  description?: string
  /** Logo du brouillon, déjà ADMIS par la garde des fichiers (source `page`) : il passe à la page. */
  logoStorageId?: Id<"_storage">
  ownerKind: PageOwnerKind
  /** Adresses candidates, dans l'ordre (`shopHandleCandidates`) : la première libre l'emporte. */
  handleCandidates: readonly string[]
  /** Le texte que relit la modération de la page (identité et présentation de la boutique). */
  moderationText: string
}

/**
 * Crée la page d'une boutique admise. `null` si aucune adresse candidate n'est
 * libre : l'appelant refuse, rien n'est écrit.
 */
export async function createShopPage(ctx: MutationCtx, input: ShopPageInput): Promise<{ pageId: Id<"pages">; handle: string } | null> {
  checked(() => assertMemberCreatableOwnerKind(input.ownerKind))
  const name = checked(() => assertPageName(input.name))
  const description = checked(() => normalizePageDescription(input.description))
  let handle: string | null = null
  for (const candidate of input.handleCandidates) {
    const valid = checked(() => assertPageHandle(candidate))
    if (!(await findPageByHandle(ctx, valid))) {
      handle = valid
      break
    }
  }
  if (handle === null) return null
  const now = Date.now()
  // La règle de la page reste `network` : la lecture hors du réseau d'une vitrine relève de la boutique (son consentement, sa règle).
  const visibility = "network" as const
  const pageId = await ctx.db.insert("pages", {
    networkId: input.network._id,
    handle,
    name,
    ...(description !== undefined ? { description } : {}),
    ...(input.logoStorageId !== undefined ? { logoStorageId: input.logoStorageId } : {}),
    ownerKind: input.ownerKind,
    trust: "community",
    trustRank: pageTrustRank("community"),
    visibility,
    onRoot: isPageOnRoot(input.network, visibility),
    status: "active",
    createdByPersonId: input.adminPersonId,
    searchText: pageSearchText({ name, handle }),
    createdAt: now,
    updatedAt: now,
  })
  await moderateContentWrite(ctx, { networkId: input.network._id, ownerPersonId: input.adminPersonId, kind: "page", id: pageId, text: input.moderationText })
  await ctx.db.insert("pageSignatories", { networkId: input.network._id, pageId, personId: input.adminPersonId, role: "admin", acceptedAt: now, createdAt: now, updatedAt: now })
  return { pageId, handle }
}

/**
 * L'identité (nom, description) de la page d'une boutique, modifiée depuis
 * l'éditeur de la boutique par un administrateur VIVANT (l'appelant l'a
 * vérifié). Mêmes règles que `identity.updatePageIdentity` : valeurs d'AVANT
 * dans l'historique, recherche recalculée. Rien n'est écrit si rien ne change ;
 * la relecture de modération reste à l'appelant (elle porte aussi les champs
 * propres à la boutique).
 */
export async function updateShopPageIdentity(
  ctx: MutationCtx,
  page: Doc<"pages">,
  actorPersonId: Id<"persons">,
  change: { name?: string; description?: string | null },
): Promise<boolean> {
  const patch: { name?: string; description?: string | undefined } = {}
  const previous: Doc<"pageIdentityHistory">["previous"] = {}
  if (change.name !== undefined) {
    const name = checked(() => assertPageName(change.name ?? ""))
    if (name !== page.name) {
      patch.name = name
      previous.name = page.name
    }
  }
  if (change.description !== undefined) {
    const description = change.description === null ? undefined : checked(() => normalizePageDescription(change.description ?? undefined))
    if (description !== page.description) {
      patch.description = description
      previous.description = page.description ?? null
    }
  }
  if (Object.keys(previous).length === 0) return false
  const now = Date.now()
  const name = patch.name ?? page.name
  await ctx.db.patch(page._id, { ...patch, searchText: pageSearchText({ name, ...(page.shortName !== undefined ? { shortName: page.shortName } : {}), handle: page.handle }), updatedAt: now })
  await ctx.db.insert("pageIdentityHistory", { networkId: page.networkId, pageId: page._id, actorPersonId, previous, at: now })
  return true
}

/**
 * Poser, remplacer ou retirer (`null`) le logo de la page d'une boutique. Le
 * fichier neuf est déjà ADMIS par l'appelant (garde de fraîcheur, puis
 * admission) ; l'ancien logo est purgé (il n'appartient qu'à cette page) ;
 * l'historique d'identité en garde la trace.
 */
export async function setShopPageLogo(ctx: MutationCtx, page: Doc<"pages">, actorPersonId: Id<"persons">, storageId: Id<"_storage"> | null): Promise<void> {
  const current = page.logoStorageId
  if (storageId !== null && storageId === current) return
  if (storageId === null && current === undefined) return
  const now = Date.now()
  await ctx.db.patch(page._id, { logoStorageId: storageId ?? undefined, updatedAt: now })
  if (current !== undefined) await purgePageImage(ctx, current)
  await ctx.db.insert("pageIdentityHistory", { networkId: page.networkId, pageId: page._id, actorPersonId, previous: { logoChanged: true }, at: now })
}
