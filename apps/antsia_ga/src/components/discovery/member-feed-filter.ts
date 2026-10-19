import { isProvinceSlug, type ProvinceSlug } from "@antsia/social-domain/provinces"

export type MemberFeedFilter =
  | { kind: "personal" }
  | { kind: "invalid" }
  | { kind: "national"; province?: ProvinceSlug; tag?: string; cursor?: string }

/** Les filtres sont exacts ; une province inconnue n'ouvre jamais le fil entier. */
export function memberFeedFilter(params: Record<string, string | string[] | undefined>): MemberFeedFilter {
  const scope = params.portee
  if (scope === undefined) return { kind: "personal" }
  if (scope !== "national" && scope !== "province") return { kind: "invalid" }
  const province = params.province
  if (scope === "province" && !isProvinceSlug(province)) return { kind: "invalid" }
  if (scope === "national" && province !== undefined) return { kind: "invalid" }
  const tag = params.tag
  if (tag !== undefined && (typeof tag !== "string" || !/^[\p{L}\p{N}_]{2,30}$/u.test(tag))) return { kind: "invalid" }
  const cursor = params.curseur
  if (cursor !== undefined && (typeof cursor !== "string" || cursor.length === 0 || cursor.length > 4096)) return { kind: "invalid" }
  return { kind: "national", ...(isProvinceSlug(province) ? { province } : {}), ...(tag ? { tag: tag.toLowerCase() } : {}), ...(cursor ? { cursor } : {}) }
}
