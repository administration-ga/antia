/** P09 : une URL déjà émise reste soumise aux droits et au retrait de sa source. */
import { makeFunctionReference } from "convex/server"

import type { Id } from "../../_generated/dataModel"
import { httpAction } from "../../_generated/server"

type Asset = { storageId: Id<"_storage">; mimeType: string; byteSize: number }
const gate = makeFunctionReference<"query", { token: string }, Asset | null>("modules/federation/commerceCatalogMedia:publicAsset")
const headers = { "Cache-Control": "no-store, max-age=0", "X-Content-Type-Options": "nosniff" }

export const media = httpAction(async (ctx, request): Promise<Response> => {
  const path = new URL(request.url).pathname
  const token = path.startsWith("/catalogue/media/") ? path.slice("/catalogue/media/".length) : ""
  if (token.length < 32 || token.length > 64 || /[^a-f0-9]/u.test(token)) return new Response(null, { status: 404, headers })
  try {
    const before = await ctx.runQuery(gate, { token })
    if (!before) return new Response(null, { status: 404, headers })
    const blob = await ctx.storage.get(before.storageId)
    if (!blob || blob.size !== before.byteSize || blob.size > 10 * 1024 * 1024) return new Response(null, { status: 404, headers })
    const after = await ctx.runQuery(gate, { token })
    if (!after || after.storageId !== before.storageId || after.mimeType !== before.mimeType || after.byteSize !== before.byteSize) return new Response(null, { status: 404, headers })
    return new Response(blob, { status: 200, headers: { ...headers, "Content-Type": after.mimeType, "Content-Length": String(after.byteSize) } })
  } catch { return new Response(null, { status: 404, headers }) }
})
