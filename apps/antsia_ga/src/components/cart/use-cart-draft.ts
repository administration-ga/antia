"use client"

import { useNetwork } from "@antsia/api/network"
import { isSigningOutEverywhere } from "@antsia/api/sign-out-everywhere"
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react"
import { useCheckoutClock } from "@/components/checkout/use-checkout-clock"
import { CART_CHANGED_EVENT, CART_DRAFT_TTL_MS, cartDraftKey, parseCartDraft, removeCartDraft, writeCartDraft, type CartDraft } from "@/lib/cart-draft"

function subscribe(callback: () => void) {
  window.addEventListener(CART_CHANGED_EVENT, callback)
  window.addEventListener("storage", callback)
  return () => { window.removeEventListener(CART_CHANGED_EVENT, callback); window.removeEventListener("storage", callback) }
}
export function useCartDraft() {
  const { networkId, personId } = useNetwork()
  const key = cartDraftKey(String(networkId), String(personId))
  const [readyKey, setReadyKey] = useState<string | null>(null)
  useEffect(() => { setReadyKey(key) }, [key])
  const snapshot = useCallback(() => { try { return window.sessionStorage.getItem(key) } catch { return null } }, [key])
  const raw = useSyncExternalStore(subscribe, snapshot, () => null)
  const initial = useMemo(() => parseCartDraft(raw, String(networkId), String(personId), Date.now()), [raw, networkId, personId])
  const now = useCheckoutClock(initial ? initial.updatedAt + CART_DRAFT_TTL_MS : null)
  const draft = parseCartDraft(raw, String(networkId), String(personId), Math.max(now, Date.now()))
  const save = useCallback((next: CartDraft | null) => {
    if (isSigningOutEverywhere() || readyKey !== key || next && (next.networkId !== String(networkId) || next.personId !== String(personId))) return false
    try {
      const saved = next ? writeCartDraft(window.sessionStorage, next, Date.now()) : removeCartDraft(window.sessionStorage, String(networkId), String(personId))
      if (saved) window.dispatchEvent(new Event(CART_CHANGED_EVENT))
      return saved
    } catch { return false }
  }, [key, readyKey, networkId, personId])
  return { draft, save, ready: readyKey === key, networkId, personId }
}

/** Les lectures/écritures financières restent manuelles après le retour du réseau. */
export function useCartConnectivity() {
  const [state, setState] = useState({ online: true, generation: 0 })
  useEffect(() => {
    const update = () => setState((previous) => ({ online: navigator.onLine, generation: previous.generation + 1 }))
    setState((previous) => ({ ...previous, online: navigator.onLine }))
    window.addEventListener("online", update); window.addEventListener("offline", update)
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update) }
  }, [])
  return state
}
