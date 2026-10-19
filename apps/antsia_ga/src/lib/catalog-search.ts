/** Entrées publiques bornées ; aucune URL ou référence privée n'est acceptée. */
export type CatalogFilters = { kind?: "product" | "service"; collectionRef?: string; query?: string }
export type CatalogSearch = CatalogFilters & { cursor: string | null }
export const CATALOG_PAGE_SIZE = 12
export const CATALOG_QUERY_MAX_LENGTH = 120

export function catalogSearch(params: Record<string, string | string[] | undefined>): CatalogSearch | null {
  const kind = params.type
  const collection = params.collection
  const query = params.recherche
  const cursor = params.curseur
  if ((kind !== undefined && kind !== "" && kind !== "product" && kind !== "service") ||
    (collection !== undefined && (typeof collection !== "string" || (collection !== "" && !/^pro\.ga:offer_collection:[0-9A-HJKMNP-TV-Z]{10,32}$/.test(collection)))) ||
    (query !== undefined && (typeof query !== "string" || query.length > CATALOG_QUERY_MAX_LENGTH || /[\u0000-\u001f\u007f]/.test(query))) ||
    (cursor !== undefined && (typeof cursor !== "string" || cursor.length > 8192))) return null
  const normalized = typeof query === "string" ? query.normalize("NFC").trim() : ""
  return {
    ...(kind === "product" || kind === "service" ? { kind } : {}),
    ...(typeof collection === "string" && collection !== "" ? { collectionRef: collection } : {}),
    ...(normalized ? { query: normalized } : {}),
    cursor: typeof cursor === "string" && cursor !== "" ? cursor : null,
  }
}

export function catalogFilters(search: CatalogFilters): CatalogFilters {
  return { ...(search.kind ? { kind: search.kind } : {}), ...(search.collectionRef ? { collectionRef: search.collectionRef } : {}), ...(search.query ? { query: search.query } : {}) }
}
