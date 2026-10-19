/**
 * P14 : qui peut demander un devis, un rendez-vous ou une prestation, et à quelle boutique.
 *
 * Adhésion `declaree` du réseau de lecture (refus indistinct sinon), personne non effacée,
 * session Better Auth vivante, configuration commerce présente, politique « services » du
 * réseau OUVERTE (fermée par défaut, pour le réseau de lecture ET celui de la boutique),
 * vitrine lisible et catalogue public consenti (P09), liaison vivante portant la permission
 * du parcours, offre de type `service`. Le sujet acheteur est le helper commun P10/P11 : il
 * reste distinct de tout mandat vendeur et n'est dérivable d'aucun identifiant ou contact.
 */
import type { CommerceLinkPermission } from "@antsia/social-domain/commerce/command"
import { type Infer, v } from "convex/values"

import type { Doc, Id } from "../../_generated/dataModel"
import type { MutationCtx, QueryCtx } from "../../_generated/server"
import { requireMembership } from "../../lib/access"
import { getActiveIdentity } from "../../lib/session"
import { assertSocialWriteAllowed } from "../moderation/policy"
import { findPageByHandle } from "../pages/access"
import { isStorefrontInReadingContext, shopOfPage } from "./access"
import { readableCatalogMapping } from "./catalogAccess"
import { resolveCatalogOffer } from "./catalogRead"
import { ensureCommerceBuyerSubject } from "./commerceBuyerSubjects"
import { readCommerceLinkConfig } from "./commerceLinkConfig"
import { sha256Hex } from "./commerceLinkCrypto"
import type { ServiceMode } from "./serviceRules"
import { serviceAuthorityFields } from "./serviceTables"

export const serviceAuthorityValidator = v.object(serviceAuthorityFields)
export type ServiceAuthority = Infer<typeof serviceAuthorityValidator>
export const SERVICE_MODE_PERMISSIONS: Readonly<Record<ServiceMode, CommerceLinkPermission>> = {
  quote: "receive_inquiries", booking: "receive_bookings", fixed_order: "receive_orders",
}
const opaque = (value: string) => value.length >= 8 && value.length <= 100 && /^[A-Za-z0-9][A-Za-z0-9._:-]*$/u.test(value)
export const validServiceId = opaque

export async function servicePolicyOpen(ctx: Pick<QueryCtx, "db">, networkId: Id<"networks">): Promise<boolean> {
  return (await ctx.db.query("commerceServicePolicies").withIndex("by_network", (q) => q.eq("networkId", networkId)).unique())?.enabled === true
}

/** Autorité de lecture d'une offre de service ; `null` pour tout refus (indistinct). */
export async function serviceCatalogAuthority(ctx: QueryCtx | MutationCtx, networkId: Id<"networks">, handle: string, offerRef: string) {
  const access = await requireMembership(ctx, networkId, "declaree")
  if (access.person.erasedAt !== undefined || access.person.deletionRequestedAt !== undefined) return null
  const identity = await getActiveIdentity(ctx), config = await readCommerceLinkConfig()
  if (!identity || typeof identity.sessionId !== "string" || !config || handle.length > 100 || offerRef.length > 200) return null
  const page = await findPageByHandle(ctx, handle), shop = page ? await shopOfPage(ctx, page._id) : null
  if (!shop || !await isStorefrontInReadingContext(ctx, shop, access.network) || !await servicePolicyOpen(ctx, networkId) ||
    (shop.networkId !== networkId && !await servicePolicyOpen(ctx, shop.networkId))) return null
  const live = await readableCatalogMapping(ctx, access.rootNetwork, shop._id, access.person._id)
  if (!live || live.link.configFingerprint !== config.fingerprint) return null
  const offer = await resolveCatalogOffer(ctx, { root: access.rootNetwork, network: access.network, readerPersonId: access.person._id }, shop._id, offerRef)
  if (!offer || offer.kind !== "service") return null
  return { access, config, live, offer, sessionDigest: await sha256Hex(identity.sessionId) }
}

/** Autorité figée d'une nouvelle demande ; `modes` vides = lecture (au moins une permission). */
export async function initialServiceAuthority(ctx: MutationCtx, networkId: Id<"networks">, handle: string, offerRef: string, mode: ServiceMode | "read") {
  const current = await serviceCatalogAuthority(ctx, networkId, handle, offerRef)
  if (!current) return null
  const permissions = current.live.link.permissions
  const allowed = mode === "read" ? Object.values(SERVICE_MODE_PERMISSIONS).some((permission) => permissions.includes(permission)) : permissions.includes(SERVICE_MODE_PERMISSIONS[mode])
  if (!allowed) return null
  await assertSocialWriteAllowed(ctx, networkId, current.access.person._id)
  const { live, config, access } = current
  const authority: ServiceAuthority = {
    networkId, shopId: live.shop._id, personId: access.person._id, handle: live.page.handle, sessionDigest: current.sessionDigest,
    configFingerprint: config.fingerprint, source: config.source, environment: config.environment, linkRef: live.link.linkRef, shopRef: live.link.shopRef,
    subjectRef: await ensureCommerceBuyerSubject(ctx, { networkId, personId: access.person._id, shopId: live.shop._id, source: config.source, environment: config.environment }),
  }
  return { authority, offer: current.offer, permissions }
}

/**
 * La même personne, la même session, la même configuration. `strict` (nouvel engagement) relit
 * aussi la vitrine, la liaison et l'offre ; un engagement EXISTANT (annulation, relecture)
 * reste gérable après le retrait public de la vitrine, sans ouvrir de nouvelle vente.
 */
export async function sameServiceAuthority(ctx: MutationCtx, before: ServiceAuthority, strict: { offerRef: string; mode: ServiceMode } | null): Promise<boolean> {
  const access = await requireMembership(ctx, before.networkId, "declaree")
  if (access.person._id !== before.personId || access.person.deletionRequestedAt !== undefined || access.person.erasedAt !== undefined) return false
  const identity = await getActiveIdentity(ctx), config = await readCommerceLinkConfig()
  if (!identity || typeof identity.sessionId !== "string" || await sha256Hex(identity.sessionId) !== before.sessionDigest ||
    !config || config.fingerprint !== before.configFingerprint || config.source !== before.source || config.environment !== before.environment) return false
  await assertSocialWriteAllowed(ctx, before.networkId, access.person._id)
  if (!strict) return true
  const live = await serviceCatalogAuthority(ctx, before.networkId, before.handle, strict.offerRef)
  return !!live && live.live.shop._id === before.shopId && live.live.link.linkRef === before.linkRef && live.live.link.shopRef === before.shopRef &&
    live.live.link.permissions.includes(SERVICE_MODE_PERMISSIONS[strict.mode])
}

/**
 * La même personne, vivante, avec UNE session vivante (pas forcément celle de l'admission) et la
 * même configuration : suffit à CONSULTER une réponse perdue, jamais à engager un nouvel envoi.
 * Une reconnexion ne laisse ainsi aucune demande « inconnue » pour toujours.
 */
export async function liveServicePerson(ctx: MutationCtx, before: Pick<ServiceAuthority, "networkId" | "personId" | "configFingerprint" | "source" | "environment">): Promise<boolean> {
  const access = await requireMembership(ctx, before.networkId, "declaree")
  if (access.person._id !== before.personId || access.person.deletionRequestedAt !== undefined || access.person.erasedAt !== undefined) return false
  const identity = await getActiveIdentity(ctx), config = await readCommerceLinkConfig()
  if (!identity || typeof identity.sessionId !== "string" || !config || config.fingerprint !== before.configFingerprint || config.source !== before.source || config.environment !== before.environment) return false
  await assertSocialWriteAllowed(ctx, before.networkId, access.person._id)
  return true
}

/** La demande de CETTE personne dans CE réseau ; jamais celle d'autrui (refus indistinct `null`). */
export async function ownedServiceRequest(ctx: QueryCtx | MutationCtx, networkId: Id<"networks">, requestRowId: string): Promise<Doc<"commerceServiceRequests"> | null> {
  const access = await requireMembership(ctx, networkId, "declaree")
  if (!opaque(requestRowId) || access.person.deletionRequestedAt !== undefined || access.person.erasedAt !== undefined) return null
  const row = await ctx.db.query("commerceServiceRequests").withIndex("by_request", (q) => q.eq("requestRowId", requestRowId)).unique()
  return row && row.networkId === networkId && row.personId === access.person._id && row.cancelledAt === undefined ? row : null
}

/** Autorité d'un engagement existant, figée sur la demande et la session courante. */
export async function existingServiceAuthority(ctx: MutationCtx, row: Doc<"commerceServiceRequests">): Promise<ServiceAuthority | null> {
  const identity = await getActiveIdentity(ctx), config = await readCommerceLinkConfig()
  if (!identity || typeof identity.sessionId !== "string" || !config || config.source !== row.source || config.environment !== row.environment) return null
  await assertSocialWriteAllowed(ctx, row.networkId, row.personId)
  return {
    networkId: row.networkId, shopId: row.shopId, personId: row.personId, handle: row.handle, sessionDigest: await sha256Hex(identity.sessionId),
    configFingerprint: config.fingerprint, source: row.source, environment: row.environment, linkRef: row.linkRef, shopRef: row.shopRef, subjectRef: row.subjectRef,
  }
}
