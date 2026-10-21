import type { PostMediaDto } from "@antsia/social-contracts/media"
import { useVideoPlayer, VideoView } from "expo-video"
import { useEffect, useState } from "react"
import { Image, View } from "react-native"
import { useNativeAppearance } from "../appearance"
import { Label, useNativeGuard, useReducedMotion } from "./ui"
import { useNativeCalls } from "../calls"

function GuardedVideo({ url }: { url: string }) {
  const { tokens, t } = useNativeAppearance(), guard = useNativeGuard(), calls = useNativeCalls()
  const reducedMotion = useReducedMotion()
  const player = useVideoPlayer({ uri: url }, (created) => { created.loop = false; created.muted = true })
  useEffect(() => {
    if (guard.current() && !reducedMotion) player.play()
    else player.pause()
    const unregister = guard.runtime.registerCleanup(() => { try { player.pause() } catch { /* Le lecteur peut déjà être libéré. */ } })
    return () => { unregister(); try { player.pause() } catch { /* useVideoPlayer libère au démontage. */ } }
  }, [guard.current, guard.runtime.registerCleanup, player, reducedMotion])
  useEffect(() => calls.registerMediaStop(() => { try { player.pause() } catch { /* Reader already released. */ } }), [calls.registerMediaStop, player])
  return <View accessibilityLabel={t("mobile.media.video")} style={{ borderRadius: tokens.radiusMedia, overflow: "hidden" }}><VideoView player={player} nativeControls contentFit="contain" style={{ width: "100%", height: 240 }} /></View>
}
export function GuardedMedia({ items, active }: { items: readonly PostMediaDto[]; active: boolean }) {
  const { tokens, t } = useNativeAppearance(), guard = useNativeGuard(), calls = useNativeCalls()
  const [failed, setFailed] = useState<ReadonlySet<string>>(new Set())
  const firstVideo = items.findIndex(item => item.kind === "video")
  if (!guard.canRead) return null
  return <View style={{ gap: 8 }}>{items.map((item, index) => {
    const key = String(index) + ":" + (item.url ?? item.withheld ?? "")
    if (item.withheld !== null || item.url === null) return <Label key={key} muted>{t(item.withheld === "fileQuarantined" ? "mobile.media.quarantined" : "mobile.media.withheld")}</Label>
    if (failed.has(key)) return <Label key={key} muted>{t("mobile.media.unavailable")}</Label>
    if (item.kind === "video") return active && index === firstVideo && guard.canAct && !calls.busy
      ? <GuardedVideo key={key} url={item.url} />
      : <Label key={key} muted>{t("mobile.media.videoInactive")}</Label>
    const ratio = item.width && item.height && item.width > 0 && item.height > 0 ? item.width / item.height : 1
    return <Image key={key} source={{ uri: item.url }} accessibilityLabel={item.altText ?? t("mobile.media.image")} resizeMode="contain" onError={() => setFailed(previous => new Set([...previous, key]))} style={{ width: "100%", aspectRatio: ratio, maxHeight: 420, borderRadius: tokens.radiusMedia, backgroundColor: tokens.muted }} />
  })}</View>
}
