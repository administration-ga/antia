/** Copie serveur bornée des seuls assets générés de la démonstration, vérifiés par empreinte. */
import { makeFunctionReference } from "convex/server"
import { v } from "convex/values"
import { internalAction } from "../_generated/server"
import { assertDemoContentAllowed, DEMO_CONTENT_VERSION } from "./demoContentConfig"
import { DEMO_MEDIA_MANIFEST } from "./demoMediaManifest"

type MediaTarget = { key:string; kind:"post"|"story"|"page_banner"|"person_cover"; ownerHandle:string; asset:string; targetId:string|null; caption:string|null; attached:boolean }
const targetsRef = makeFunctionReference<"query", {confirmNonProduction:string}, MediaTarget[]>("seeds/demoContent:mediaTargets")
const attachRef = makeFunctionReference<"mutation", {confirmNonProduction:string;key:string;storageId:string;asset:string}, {attached:boolean}>("seeds/demoContent:attachMedia")

/** Pas d'URL fournie par l'appelant : uniquement l'origine déjà configurée du site de cette démo. */
function assetOrigin(): string {
  const url = new URL(process.env.SITE_URL ?? "")
  const local = (url.hostname === "localhost" || url.hostname === "127.0.0.1") && url.protocol === "http:" && url.port === "3030"
  const demo = url.protocol === "https:" && url.hostname === "antsia-demo.vercel.app" && !url.port
  if ((!local && !demo) || url.username || url.password) throw new Error("Origine des illustrations de démonstration refusée.")
  return url.origin
}

export const runBatch = internalAction({
  args: {confirmNonProduction:v.string()},
  returns: v.object({ attached:v.number(), remaining:v.number() }),
  handler: async (ctx,args):Promise<{attached:number;remaining:number}> => {
    assertDemoContentAllowed(args.confirmNonProduction)
    const origin = assetOrigin()
    const targets = await ctx.runQuery(targetsRef,args)
    const pending = targets.filter(target=>!target.attached)
    let attached = 0
    for (const target of pending.slice(0,3)) {
      const asset = DEMO_MEDIA_MANIFEST[target.asset]
      if (!asset || asset.bytes > 8*1024*1024 || !/^[a-z0-9-]+\.png$/.test(asset.filename)) throw new Error("Illustration inconnue.")
      const response = await fetch(new URL(`/demo-media/${DEMO_CONTENT_VERSION}/${asset.filename}`,origin),{redirect:"error"})
      if (!response.ok || response.headers.get("content-type")?.split(";")[0] !== asset.mimeType) throw new Error("Illustration indisponible.")
      const announced = Number(response.headers.get("content-length") ?? "0")
      if (announced > 8*1024*1024) throw new Error("Illustration trop volumineuse.")
      const bytes = new Uint8Array(await response.arrayBuffer())
      if (bytes.byteLength !== asset.bytes) throw new Error("Taille de l'illustration incohérente.")
      const hash = new Uint8Array(await crypto.subtle.digest("SHA-256",bytes))
      const digest = Array.from(hash,n=>n.toString(16).padStart(2,"0")).join("")
      if (digest !== asset.sha256) throw new Error("Empreinte de l'illustration refusée.")
      // Le serveur écrit lui-même ces octets immuables, jamais un storageId fourni par un client.
      const storageId = await ctx.storage.store(new Blob([bytes],{type:asset.mimeType}))
      const result = await ctx.runMutation(attachRef,{...args,key:target.key,asset:target.asset,storageId})
      if (result.attached) attached++
      // Une autre exécution a pu gagner la course ; seule notre copie neuve et non rattachée est supprimée.
      else await ctx.storage.delete(storageId)
    }
    return {attached,remaining:(await ctx.runQuery(targetsRef,args)).filter(target=>!target.attached).length}
  },
})
