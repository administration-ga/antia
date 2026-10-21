import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react"
import type { Id } from "@antsia/api/engine"
import { createNativeCallController } from "./call-controller"
import { NativeCallSurface } from "./native-call-surface"
import { callOwner, EMPTY_CALL, type NativeCallAuthority, type NativeCallProviderProps, type NativeCallSnapshot } from "./types"
import type { NativeCallMedia } from "./call-state"

export type { NativeCallAuthority, NativeCallProviderProps } from "./types"
export type NativeCalls = NativeCallSnapshot & {
  startCall: (personId: Id<"persons">, media: NativeCallMedia) => Promise<void>
  enableSystemCalls: () => Promise<void>
  answer: () => void
  end: () => Promise<void>
  toggleMute: () => Promise<void>
  toggleHeld: () => Promise<void>
  toggleCamera: () => Promise<void>
  minimize: () => void
  restore: () => void
  registerMediaStop: (stop: () => void) => () => void
}
const noop = async () => undefined
const UNAVAILABLE: NativeCalls = { ...EMPTY_CALL, startCall: noop, enableSystemCalls: noop, answer: () => undefined, end: noop, toggleMute: noop, toggleHeld: noop, toggleCamera: noop, minimize: () => undefined, restore: () => undefined, registerMediaStop: () => () => undefined }
const Calls = createContext<NativeCalls>(UNAVAILABLE)
/** Honest fallback also keeps the P17b media component usable without a call provider. */
export function useNativeCalls(): NativeCalls { return useContext(Calls) }

function ActiveCalls({ authority, env, registerSessionCleanup, children }: Omit<NativeCallProviderProps, "authority"> & { authority: NativeCallAuthority }) {
  const latest = useRef(authority); latest.current = authority
  const [controller] = useState(() => createNativeCallController(() => latest.current, env, process.env.EXPO_PUBLIC_NATIVE_NOTIFICATION_APPLICATION_ID))
  const state = useSyncExternalStore(controller.subscribe, controller.snapshot, controller.snapshot)
  const lifetime = useRef(0)
  useEffect(() => {
    const generation = ++lifetime.current
    void controller.initialize()
    const remove = registerSessionCleanup(() => controller.close(true))
    return () => {
      remove()
      // Development effect replay must not replace an already-owned Room or duplicate enrollment.
      queueMicrotask(() => { if (lifetime.current === generation) void controller.close(true).catch(() => undefined) })
    }
  }, [controller, registerSessionCleanup])
  useEffect(() => controller.foregroundChanged(), [controller, authority.foreground])
  const value: NativeCalls = { ...state, startCall: controller.startCall, enableSystemCalls: controller.enableSystemCalls,
    answer: controller.answer, end: controller.end, toggleMute: controller.toggleMute, toggleHeld: controller.toggleHeld,
    toggleCamera: controller.toggleCamera, minimize: controller.minimize, restore: controller.restore, registerMediaStop: controller.registerMediaStop }
  return <Calls.Provider value={value}>{children}<NativeCallSurface calls={value} foreground={authority.foreground} videos={controller.videos()} dismiss={controller.dismiss} /></Calls.Provider>
}

/** Lives above the private route/transport. Only changing its actual owner replaces this controller. */
export function NativeCallProvider({ authority, ...props }: NativeCallProviderProps): ReactNode {
  if (!authority) return <Calls.Provider value={UNAVAILABLE}>{props.children}</Calls.Provider>
  return <ActiveCalls key={callOwner(authority) + ":" + props.env.convexUrl} authority={authority} {...props} />
}
