/** P10 : intention fermée, jamais une URL de retour fournie par le navigateur. */
export const SHOP_CONTACT_PARAM = "contactBoutique"
export const SHOP_CONTACT_OFFER_PARAM = "contactOffre"
export type ShopContactContinuation = { kind: "shop_contact"; handle: string; offerRef?: string }

export function parseShopContactContinuation(value: unknown): ShopContactContinuation | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined
  const row = value as Record<string, unknown>
  if (Object.keys(row).some((key) => !["kind", "handle", "offerRef"].includes(key)) || row.kind !== "shop_contact"
    || typeof row.handle !== "string" || !/^[a-z0-9][a-z0-9._-]{0,62}[a-z0-9]$|^[a-z0-9]$/u.test(row.handle)) return undefined
  if (row.offerRef !== undefined && (typeof row.offerRef !== "string" || !/^pro\.ga:offer:[0-9A-HJKMNP-TV-Z]{10,32}$/u.test(row.offerRef))) return undefined
  return { kind: "shop_contact", handle: row.handle, ...(typeof row.offerRef === "string" ? { offerRef: row.offerRef } : {}) }
}

export function shopContactFromSearch(search: Record<string, string | string[] | undefined>): ShopContactContinuation | undefined {
  return parseShopContactContinuation({ kind: "shop_contact", handle: search[SHOP_CONTACT_PARAM], ...(search[SHOP_CONTACT_OFFER_PARAM] === undefined ? {} : { offerRef: search[SHOP_CONTACT_OFFER_PARAM] }) })
}

export function appendShopContact(query: URLSearchParams, value: unknown): void {
  const contact = parseShopContactContinuation(value)
  if (!contact) return
  query.set(SHOP_CONTACT_PARAM, contact.handle)
  if (contact.offerRef) query.set(SHOP_CONTACT_OFFER_PARAM, contact.offerRef)
}
