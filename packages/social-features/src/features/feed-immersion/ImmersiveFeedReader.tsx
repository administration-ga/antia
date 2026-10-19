"use client"

/**
 * ImmersiveFeedReader — le lecteur immersif du fil (lot P04 de l'étude
 * social-commerce du 18/10/2026, 04 §3–§4 ; ADR-0017 §4).
 *
 * UNE publication principale par hauteur disponible, défilement vertical
 * NATIF accroché (pourquoi pas `VerticalPager` : `immersive-reader-model.ts`).
 * Le lecteur ne lit AUCUNE donnée : ses enfants sont les pages du fil
 * (`FeedPage`, mêmes requêtes, mêmes curseurs, même fenêtre lacunaire) ou les
 * créneaux d'une autre source (le fil national) ; ils se déclarent par
 * `ImmersiveFeedSlot`. Aucun second fil de données.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * CE QUE LE LECTEUR TIENT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  · la place : il remplit la hauteur restante de son défileur
 *    (`useFillAvailableHeight`) et devient le seul défileur du fil ;
 *  · la publication LUE (créneau le plus visible, `IntersectionObserver`) et
 *    sa voisine : leur rôle passe aux médias (`MediaRoleProvider`) — le
 *    coordinateur de lecture n'autorise qu'une vidéo, préparée seulement pour
 *    la voisine ;
 *  · la position : une insertion ou un retrait au-dessus ne déplace pas la
 *    lecture (ancre recalée), les nouvelles publications reçues en tête sont
 *    RETENUES derrière une commande dédiée (« N nouvelles publications ») ;
 *  · le retour : une publication à retrouver (retour de navigation, changement
 *    de mode, re-calage temps réel qui a emporté des pages profondes) est
 *    recherchée en rechargeant la profondeur page par page, puis rétablie avec
 *    son décalage ;
 *  · le clavier, SEULEMENT quand le focus est dans le lecteur : flèches et
 *    Page haut/bas passent d'une publication à l'autre, sauf dans un champ, un
 *    curseur, un menu, une feuille ou une vidéo ; un créneau plus haut que
 *    l'écran, ou dont le détail est ouvert, défile d'abord ;
 *  · la fin : « Charger la suite » toujours offerte (et un chargement borné en
 *    approchant de la fin), une fenêtre vide avec suite n'est jamais une fin,
 *    l'avertissement de couverture limitée reste visible dans la barre ;
 *  · les annonces : chargement, retrait de la publication lue, retour.
 *
 * Le focus n'est jamais recyclé : aucun créneau n'est démonté pour la fenêtre
 * de rendu (`content-visibility: auto` borne le rendu, pas le DOM).
 */

import { Button } from "@antsia/ui"
import { ArrowUp, CircleAlert } from "lucide-react"
import { useReducedMotion } from "motion/react"
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react"
import { useTranslation } from "react-i18next"

import type { MediaRole } from "../media-playback/media-playback-policy"
import { MediaRoleProvider } from "../media-playback/media-role-context"
import { loadMoreAnnouncement } from "../reseau-personnel/reseau-feed-pages"
import { FEED_RETURN_MAX_DEPTH } from "./feed-return-memory"
import { FeedPostMemoryScope } from "./feed-post-memory"
import {
  anchorCorrection,
  approachingEnd,
  canScrollWithin,
  endSlotState,
  frozenHeadCount,
  IMMERSIVE_AUTO_LOAD_PAGES,
  neighborOf,
  pickActiveSlot,
  READER_KEY_OWNER_SELECTOR,
  readerKeyIntent,
  restoreStep,
  slotNavigationTarget,
} from "./immersive-reader-model"
import { FeedImmersionStyles } from "./immersive-styles"
import { scheduleFrame, useFillAvailableHeight } from "./layout-measure"

/** Les deux créneaux propres au lecteur — un identifiant de publication ne contient jamais `:`. */
export const IMMERSIVE_HEAD_KEY = "fil:head"
export const IMMERSIVE_END_KEY = "fil:end"

/** Une saisie de la personne il y a moins que cela : le défilement est le sien. */
const USER_SCROLL_WINDOW_MS = 1500

type SlotKind = "head" | "post" | "status" | "end"

interface RegisteredSlot {
  element: HTMLElement
  kind: SlotKind
  /** La page qui l'a rendu (`FeedPage`), pour distinguer un retrait d'un démontage de page. */
  group: string | null
}

/** Ce qu'une page du fil dit d'elle au lecteur. */
export interface ImmersivePageReport {
  pageKey: string
  isFirst: boolean
  isLast: boolean
  status: "loading" | "error" | "ready"
  /** Publications rendues en créneaux (nouvelles publications retenues exclues). */
  count: number
  lacunar: boolean
  preparing: boolean
  materializedSince: number | null
  /** Nouvelles publications retenues en tête (première page). */
  newCount: number
}

/** La publication à retrouver. `offset` : le défilement intérieur de son créneau. */
export interface FeedRestoreTarget {
  anchorPostId: string
  offset: number
  galleryIndex: number | null
  depth: number
}

export interface FeedAnchor {
  postId: string
  offset: number
}

export type ImmersiveLoadReason = "user" | "approach" | "restore"

/**
 * L'état partagé avec les créneaux, hors React : chaque créneau ne se re-rend
 * que si SON rôle ou SA position change (une carte de publication coûte cher).
 */
class ReaderStore {
  private activeKey: string | null = null
  private neighborKey: string | null = null
  private positions: ReadonlyMap<string, number> = new Map()
  private frozenHead: string | null = null
  private readonly listeners = new Set<() => void>()

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  roleOf(key: string): MediaRole {
    if (key === this.activeKey) return "active"
    if (key === this.neighborKey) return "neighbor"
    return "distant"
  }

  positionOf(key: string): number | null {
    return this.positions.get(key) ?? null
  }

  active(): string | null {
    return this.activeKey
  }

  setActive(active: string | null, neighbor: string | null): void {
    if (this.activeKey === active && this.neighborKey === neighbor) return
    this.activeKey = active
    this.neighborKey = neighbor
    this.emit()
  }

  setPositions(next: ReadonlyMap<string, number>): void {
    const current = this.positions
    if (current.size === next.size) {
      let same = true
      for (const [key, value] of next) {
        if (current.get(key) !== value) {
          same = false
          break
        }
      }
      if (same) return
    }
    this.positions = next
    this.emit()
  }

  frozenHeadId(): string | null {
    return this.frozenHead
  }

  setFrozenHead(id: string | null): void {
    if (this.frozenHead === id) return
    this.frozenHead = id
    this.emit()
  }

  private emit(): void {
    for (const listener of this.listeners) listener()
  }
}

interface ImmersiveReaderContextValue {
  store: ReaderStore
  registerSlot: (key: string, element: HTMLElement, kind: SlotKind, group: string | null) => () => void
  reportPage: (report: ImmersivePageReport) => void
  forgetPage: (pageKey: string) => void
  freezeHead: (id: string) => void
}

const ImmersiveReaderContext = createContext<ImmersiveReaderContextValue | null>(null)

/** Le lecteur englobant, ou `null` hors du lecteur (mode Liste). */
export function useImmersiveFeedReader(): ImmersiveReaderContextValue | null {
  return useContext(ImmersiveReaderContext)
}

const noopSubscribe = () => () => {}

/**
 * Les nouvelles publications reçues en tête pendant la lecture : la PREMIÈRE
 * page passe ses identifiants ; le lecteur fige la tête au premier passage et
 * rend combien de publications la précèdent — elles ne sont pas rendues tant
 * que la personne ne demande pas à les voir. `null` : rien à figer.
 */
export function useImmersiveFrozenHead(ids: readonly string[] | null): number {
  const reader = useContext(ImmersiveReaderContext)
  const store = reader?.store ?? null
  const frozen = useSyncExternalStore(store === null ? noopSubscribe : store.subscribe, () => store?.frozenHeadId() ?? null, () => null)
  const first = ids?.[0] ?? null
  const known = ids !== null && frozen !== null && ids.includes(frozen)
  useEffect(() => {
    if (reader === null || first === null) return
    // Premier passage, tête retirée ou poussée hors de la première fenêtre :
    // la tête se refige sur la plus récente, rien n'est caché.
    if (!known) reader.freezeHead(first)
  }, [reader, first, known])
  return ids === null ? 0 : frozenHeadCount(ids, frozen)
}

/** Déclare l'état d'une page au lecteur (objet mémoïsé par l'appelant), et le retire au démontage. */
export function useImmersivePageReport(report: ImmersivePageReport | null): void {
  const reader = useContext(ImmersiveReaderContext)
  const pageKey = report?.pageKey ?? null
  useEffect(() => {
    if (reader !== null && report !== null) reader.reportPage(report)
  }, [reader, report])
  useEffect(() => {
    if (reader === null || pageKey === null) return
    return () => reader.forgetPage(pageKey)
  }, [reader, pageKey])
}

function useSlotRegistration(key: string, kind: SlotKind, group: string | null) {
  const reader = useContext(ImmersiveReaderContext)
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const element = ref.current
    if (reader === null || element === null) return
    return reader.registerSlot(key, element, kind, group)
  }, [reader, key, kind, group])
  return { reader, ref }
}

/**
 * UNE publication dans le lecteur : un article nommé, focalisable par
 * programme (navigation au clavier), à la hauteur de la scène, qui défile
 * dans soi quand son contenu la dépasse. Son rôle (lue, voisine, lointaine)
 * passe aux médias ; sa mémoire de galerie à la galerie.
 */
export function ImmersiveFeedSlot({ postId, label, group, children }: { postId: string; label: string; group?: string; children: ReactNode }) {
  const { reader, ref } = useSlotRegistration(postId, "post", group ?? null)
  const store = reader?.store ?? null
  const role = useSyncExternalStore<MediaRole>(
    store === null ? noopSubscribe : store.subscribe,
    () => (store === null ? "unmanaged" : store.roleOf(postId)),
    () => "distant",
  )
  const position = useSyncExternalStore<number | null>(
    store === null ? noopSubscribe : store.subscribe,
    () => store?.positionOf(postId) ?? null,
    () => null,
  )
  return (
    <div
      ref={ref}
      className="fil-imm-slot"
      data-fil-slot="post"
      data-feed-anchor={postId}
      role="article"
      aria-label={label}
      aria-posinset={position ?? undefined}
      aria-setsize={position === null ? undefined : -1}
      tabIndex={-1}
    >
      <div className="fil-imm-slot-inner">
        <MediaRoleProvider value={role}>
          <FeedPostMemoryScope postId={postId}>{children}</FeedPostMemoryScope>
        </MediaRoleProvider>
      </div>
    </div>
  )
}

/** Un état de page (chargement, erreur, fil vide) à la place d'une publication, à la hauteur de la scène. */
export function ImmersiveStatusSlot({ id, busy = false, children }: { id: string; busy?: boolean; children: ReactNode }) {
  const { ref } = useSlotRegistration(`fil:status:${id}`, "status", null)
  return (
    <div ref={ref} className="fil-imm-slot fil-imm-status" data-fil-slot="status" aria-busy={busy || undefined}>
      <div className="fil-imm-slot-inner">{children}</div>
    </div>
  )
}

export interface ImmersiveFeedReaderProps {
  /** Nom accessible du lecteur, déjà traduit. */
  label: string
  /** Bandeaux, composeur, actus, portées : défilent avec le fil, avant la première publication. */
  head?: ReactNode
  /** La bascule Liste/Immersion — toujours visible, dans la barre du lecteur. */
  toggle?: ReactNode
  /** Les pages du fil (`FeedPage`) ou les créneaux d'une autre source. */
  children: ReactNode
  /** Une fin propre à la source (fenêtres par adresse) ; sinon la fin intégrée. */
  end?: ReactNode
  /** La dernière page a répondu avec une suite (`shouldShowLoadMore`). */
  canLoadMore?: boolean
  /** La chaîne est close : aucune suite. */
  exhausted?: boolean
  onLoadMore?: (reason: ImmersiveLoadReason) => void
  /** Pages montées : une baisse (re-calage temps réel) peut emporter la publication lue. */
  depth?: number
  /** Une publication à retrouver (retour, changement de mode). */
  restore?: FeedRestoreTarget | null
  onRestored?: (outcome: "found" | "missing") => void
  /** La publication lue et son décalage, pour la mémoire de retour. */
  onAnchor?: (anchor: FeedAnchor) => void
}

export function ImmersiveFeedReader({
  label,
  head,
  toggle,
  children,
  end,
  canLoadMore = false,
  exhausted = false,
  onLoadMore,
  depth,
  restore = null,
  onRestored,
  onAnchor,
}: ImmersiveFeedReaderProps) {
  const { t, i18n } = useTranslation("reseau")
  const hintId = useId()
  const reduceMotion = useReducedMotion() === true
  const sectionRef = useRef<HTMLDivElement>(null)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const headRef = useRef<HTMLDivElement>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const height = useFillAvailableHeight(sectionRef, true)

  const [store] = useState(() => new ReaderStore())
  const registry = useRef(new Map<string, RegisteredSlot>())
  const keyOfElement = useRef(new WeakMap<Element, string>())
  const ratios = useRef(new Map<string, number>())
  const observerRef = useRef<IntersectionObserver | null>(null)
  const frameCancel = useRef<(() => void) | null>(null)
  /** Des créneaux ont changé depuis le dernier calcul de l'ordre : ce qui en dépend attend l'image suivante. */
  const registryDirty = useRef(false)
  const postOrder = useRef<readonly string[]>([])
  const anchorRef = useRef<{ key: string; top: number } | null>(null)
  const lastUserInput = useRef(0)
  const pointerDown = useRef(false)
  const pendingTop = useRef(false)
  const pendingFocusAfterLoad = useRef<number | null>(null)
  const pendingAnnounce = useRef<number | null>(null)
  const pendingRemovalCheck = useRef<{ key: string; group: string | null; hadFocus: boolean; index: number } | null>(null)
  const autoLoads = useRef(0)
  const disposing = useRef(false)
  const restoreState = useRef<{ target: FeedRestoreTarget | null; appended: number; done: boolean }>({ target: restore, appended: 0, done: restore === null })
  const reportsRef = useRef<ReadonlyMap<string, ImmersivePageReport>>(new Map())
  const [reports, setReports] = useState<ReadonlyMap<string, ImmersivePageReport>>(() => new Map())
  const [registryVersion, setRegistryVersion] = useState(0)
  const [announcement, setAnnouncement] = useState("")
  const activeKey = useSyncExternalStore(store.subscribe, () => store.active(), () => null)

  // Les valeurs les plus récentes, lues par les rappels stables et les écouteurs du DOM.
  const tRef = useRef(t)
  tRef.current = t
  const reduceMotionRef = useRef(reduceMotion)
  reduceMotionRef.current = reduceMotion
  const onAnchorRef = useRef(onAnchor)
  onAnchorRef.current = onAnchor

  // Démontage du lecteur : les créneaux qui partent avec lui ne sont pas des
  // retraits. Déclaré AVANT l'enregistrement de la tête et de la fin : son
  // nettoyage précède le leur, et React nettoie le lecteur avant ses enfants.
  useLayoutEffect(() => {
    disposing.current = false
    return () => {
      disposing.current = true
      frameCancel.current?.()
      frameCancel.current = null
    }
  }, [])

  const userIsScrolling = useCallback(() => pointerDown.current || performance.now() - lastUserInput.current < USER_SCROLL_WINDOW_MS, [])

  const keyOf = useCallback((element: Element): string | null => keyOfElement.current.get(element) ?? null, [])

  /** Les créneaux dans l'ordre du DOM (l'ordre lu par les technologies d'assistance). */
  const orderedSlots = useCallback((): HTMLElement[] => {
    const scroller = scrollerRef.current
    if (scroller === null) return []
    return Array.from(scroller.querySelectorAll<HTMLElement>("[data-fil-slot]")).filter((element) => keyOfElement.current.has(element))
  }, [])

  /** Retient la publication lue et sa position visible (jamais un créneau de tête, d'état ou de fin). */
  const captureAnchor = useCallback(() => {
    const scroller = scrollerRef.current
    const active = store.active()
    if (scroller === null || active === null) return
    const slot = registry.current.get(active)
    if (slot === undefined || slot.kind !== "post") return
    anchorRef.current = { key: active, top: slot.element.offsetTop - scroller.scrollTop }
    onAnchorRef.current?.({ postId: active, offset: slot.element.scrollTop })
  }, [store])

  /** Recalcule la publication lue depuis les visibilités (ou la position, sans observateur). */
  const updateActive = useCallback(() => {
    const scroller = scrollerRef.current
    if (scroller === null) return
    const slots = orderedSlots()
    let active: string | null
    if (observerRef.current !== null) {
      active = pickActiveSlot(
        slots.map((element) => keyOf(element) ?? ""),
        ratios.current,
      )
    } else {
      // Sans `IntersectionObserver` : le créneau dont le haut est le plus proche du défilement.
      let best: string | null = null
      let distance = Number.POSITIVE_INFINITY
      for (const element of slots) {
        const gap = Math.abs(element.offsetTop - scroller.scrollTop)
        if (gap < distance) {
          distance = gap
          best = keyOf(element)
        }
      }
      active = best
    }
    if (active === null) active = store.active()
    const posts = postOrder.current
    const neighbor = active === IMMERSIVE_HEAD_KEY ? (posts[0] ?? null) : neighborOf(posts, active)
    store.setActive(active, neighbor)
    if (userIsScrolling() || anchorRef.current === null) captureAnchor()
  }, [captureAnchor, keyOf, orderedSlots, store, userIsScrolling])

  const scrollToSlot = useCallback(
    (element: HTMLElement, options: { focus: boolean; smooth: boolean }) => {
      const scroller = scrollerRef.current
      if (scroller === null) return
      const top = element.offsetTop
      if (typeof scroller.scrollTo === "function") scroller.scrollTo({ top, behavior: options.smooth && !reduceMotionRef.current ? "smooth" : "auto" })
      else scroller.scrollTop = top
      const key = keyOf(element)
      if (key !== null && registry.current.get(key)?.kind === "post") anchorRef.current = { key, top: 0 }
      if (options.focus) element.focus({ preventScroll: true })
    },
    [keyOf],
  )

  /** Après tout ajout ou retrait de créneaux, au plus une fois par image. */
  const onRegistryFrame = useCallback(() => {
    frameCancel.current = null
    const scroller = scrollerRef.current
    if (scroller === null || disposing.current) return
    const slots = orderedSlots()
    const posts: string[] = []
    for (const element of slots) {
      const key = keyOf(element)
      if (key !== null && registry.current.get(key)?.kind === "post") posts.push(key)
    }
    postOrder.current = posts
    store.setPositions(new Map(posts.map((key, index): [string, number] => [key, index + 1])))

    const focusAfterLoad = pendingFocusAfterLoad.current
    if (pendingTop.current) {
      // « Nouvelles publications » : la lecture repart de la plus récente.
      pendingTop.current = false
      const firstKey = posts[0]
      const first = firstKey === undefined ? undefined : registry.current.get(firstKey)
      if (first !== undefined) scrollToSlot(first.element, { focus: true, smooth: true })
    } else if (focusAfterLoad !== null && posts.length > focusAfterLoad) {
      // « Charger la suite » : le focus quitte la commande pour la première publication ajoutée.
      pendingFocusAfterLoad.current = null
      const firstNewKey = posts[focusAfterLoad]
      const slot = firstNewKey === undefined ? undefined : registry.current.get(firstNewKey)
      if (slot !== undefined) scrollToSlot(slot.element, { focus: true, smooth: false })
    } else {
      // Une insertion ou un retrait AU-DESSUS ne déplace pas la publication lue.
      const anchor = anchorRef.current
      const slot = anchor === null ? undefined : registry.current.get(anchor.key)
      if (anchor !== null && slot !== undefined && !userIsScrolling()) {
        const delta = anchorCorrection({ slotTop: slot.element.offsetTop, scrollTop: scroller.scrollTop, anchorTop: anchor.top })
        if (delta !== 0) scroller.scrollTop += delta
      }
    }

    // Retrait de la publication lue : le dire, et ne pas laisser le focus dans le vide.
    const removal = pendingRemovalCheck.current
    if (removal !== null) {
      pendingRemovalCheck.current = null
      const pageStillMounted = removal.group === null || reportsRef.current.has(removal.group)
      if (!registry.current.has(removal.key) && pageStillMounted) {
        setAnnouncement(tRef.current("immersiveFeed.removed"))
        if (removal.hadFocus && slots.length > 0) {
          const fallback = slots[Math.max(0, Math.min(removal.index, slots.length - 1))]
          fallback?.focus({ preventScroll: true })
        }
      }
    }

    updateActive()
    registryDirty.current = false
    setRegistryVersion((version) => version + 1)
  }, [keyOf, orderedSlots, scrollToSlot, store, updateActive, userIsScrolling])

  const scheduleRegistryFrame = useCallback(() => {
    registryDirty.current = true
    if (frameCancel.current === null) frameCancel.current = scheduleFrame(onRegistryFrame)
  }, [onRegistryFrame])

  const registerSlot = useCallback(
    (key: string, element: HTMLElement, kind: SlotKind, group: string | null) => {
      registry.current.set(key, { element, kind, group })
      keyOfElement.current.set(element, key)
      observerRef.current?.observe(element)
      scheduleRegistryFrame()
      return () => {
        const current = registry.current.get(key)
        if (current === undefined || current.element !== element) return
        const hadFocus = typeof document !== "undefined" && element.contains(document.activeElement)
        const index = orderedSlots().indexOf(element)
        registry.current.delete(key)
        keyOfElement.current.delete(element)
        ratios.current.delete(key)
        observerRef.current?.unobserve(element)
        if (disposing.current) return
        if (kind === "post" && (key === store.active() || hadFocus)) pendingRemovalCheck.current = { key, group, hadFocus, index }
        scheduleRegistryFrame()
      }
    },
    [orderedSlots, scheduleRegistryFrame, store],
  )

  const reportPage = useCallback((report: ImmersivePageReport) => {
    setReports((current) => {
      const previous = current.get(report.pageKey)
      if (
        previous !== undefined &&
        previous.isFirst === report.isFirst &&
        previous.isLast === report.isLast &&
        previous.status === report.status &&
        previous.count === report.count &&
        previous.lacunar === report.lacunar &&
        previous.preparing === report.preparing &&
        previous.materializedSince === report.materializedSince &&
        previous.newCount === report.newCount
      ) {
        return current
      }
      const next = new Map(current)
      next.set(report.pageKey, report)
      reportsRef.current = next
      return next
    })
  }, [])

  const forgetPage = useCallback((pageKey: string) => {
    setReports((current) => {
      if (!current.has(pageKey)) return current
      const next = new Map(current)
      next.delete(pageKey)
      reportsRef.current = next
      return next
    })
  }, [])

  const freezeHead = useCallback((id: string) => store.setFrozenHead(id), [store])

  const context = useMemo<ImmersiveReaderContextValue>(
    () => ({ store, registerSlot, reportPage, forgetPage, freezeHead }),
    [store, registerSlot, reportPage, forgetPage, freezeHead],
  )

  // Les créneaux propres au lecteur : tête et fin.
  useLayoutEffect(() => {
    const headElement = headRef.current
    const endElement = endRef.current
    const cleanups: (() => void)[] = []
    if (headElement !== null) cleanups.push(registerSlot(IMMERSIVE_HEAD_KEY, headElement, "head", null))
    if (endElement !== null) cleanups.push(registerSlot(IMMERSIVE_END_KEY, endElement, "end", null))
    return () => {
      for (const cleanup of cleanups) cleanup()
    }
  }, [registerSlot])

  // La hauteur de la scène, publiée pour les créneaux et le cadre des médias.
  useLayoutEffect(() => {
    const scroller = scrollerRef.current
    if (scroller === null) return
    const apply = () => {
      if (scroller.clientHeight > 0) scroller.style.setProperty("--fil-stage-h", `${scroller.clientHeight}px`)
      scheduleRegistryFrame()
    }
    apply()
    if (typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(apply)
    observer.observe(scroller)
    // La tête qui grandit (actus chargées, bandeau) décale les publications.
    if (headRef.current !== null) observer.observe(headRef.current)
    return () => observer.disconnect()
  }, [scheduleRegistryFrame, height])

  // La publication lue : le créneau le plus visible dans la scène.
  useEffect(() => {
    const scroller = scrollerRef.current
    if (scroller === null || typeof IntersectionObserver === "undefined") return
    const observer = new IntersectionObserver(
      (records) => {
        for (const record of records) {
          const key = keyOfElement.current.get(record.target)
          if (key !== undefined) ratios.current.set(key, record.isIntersecting ? record.intersectionRatio : 0)
        }
        updateActive()
      },
      { root: scroller, threshold: [0, 0.25, 0.5, 0.75, 1] },
    )
    observerRef.current = observer
    for (const slot of registry.current.values()) observer.observe(slot.element)
    return () => {
      observer.disconnect()
      observerRef.current = null
    }
  }, [updateActive])

  // Le défilement de la personne déplace l'ancre ; celui de la mise en page, non.
  useEffect(() => {
    const scroller = scrollerRef.current
    if (scroller === null) return
    let cancel: (() => void) | null = null
    const onScroll = () => {
      if (cancel !== null) return
      cancel = scheduleFrame(() => {
        cancel = null
        if (observerRef.current === null) updateActive()
        else if (userIsScrolling()) captureAnchor()
      })
    }
    const onInput = () => {
      lastUserInput.current = performance.now()
    }
    const onPointerDown = () => {
      pointerDown.current = true
      onInput()
    }
    const onPointerUp = () => {
      pointerDown.current = false
      onInput()
    }
    scroller.addEventListener("scroll", onScroll, { passive: true, capture: true })
    scroller.addEventListener("wheel", onInput, { passive: true })
    scroller.addEventListener("touchstart", onPointerDown, { passive: true })
    scroller.addEventListener("touchend", onPointerUp, { passive: true })
    scroller.addEventListener("pointerdown", onPointerDown)
    scroller.addEventListener("pointerup", onPointerUp)
    scroller.addEventListener("pointercancel", onPointerUp)
    return () => {
      cancel?.()
      scroller.removeEventListener("scroll", onScroll, { capture: true })
      scroller.removeEventListener("wheel", onInput)
      scroller.removeEventListener("touchstart", onPointerDown)
      scroller.removeEventListener("touchend", onPointerUp)
      scroller.removeEventListener("pointerdown", onPointerDown)
      scroller.removeEventListener("pointerup", onPointerUp)
      scroller.removeEventListener("pointercancel", onPointerUp)
    }
  }, [captureAnchor, updateActive, userIsScrolling])

  const reportList = useMemo(() => [...reports.values()], [reports])
  const busy = reportList.some((report) => report.status === "loading")
  const firstReport = reportList.find((report) => report.isFirst) ?? null
  const lastReport = reportList.find((report) => report.isLast) ?? null
  const lacunar = reportList.some((report) => report.lacunar)
  const newCount = firstReport?.newCount ?? 0
  const preparing = firstReport?.preparing === true
  const historySince = firstReport?.materializedSince ?? null
  const lastPageEmpty = lastReport !== null && lastReport.status === "ready" && lastReport.count === 0 && lastReport.newCount === 0
  const lastStatus = lastReport?.status ?? null

  const requestLoad = useCallback(
    (reason: ImmersiveLoadReason) => {
      if (onLoadMore === undefined) return
      if (reason !== "restore") pendingAnnounce.current = postOrder.current.length
      if (reason === "user") pendingFocusAfterLoad.current = postOrder.current.length
      onLoadMore(reason)
    },
    [onLoadMore],
  )

  // Une nouvelle publication à retrouver (prop) : la recherche repart de zéro.
  useEffect(() => {
    restoreState.current = { target: restore, appended: 0, done: restore === null }
  }, [restore])

  // Re-calage temps réel : des pages profondes emportées avec la publication lue — on la recherche.
  const previousDepth = useRef(depth)
  useEffect(() => {
    const before = previousDepth.current
    previousDepth.current = depth
    if (depth === undefined || before === undefined || depth >= before) return
    const anchor = anchorRef.current
    if (anchor === null || registry.current.has(anchor.key) || !restoreState.current.done) return
    restoreState.current = { target: { anchorPostId: anchor.key, offset: 0, galleryIndex: null, depth: before }, appended: 0, done: false }
    setAnnouncement(tRef.current("immersiveFeed.restoring"))
  }, [depth])

  // Retrouver la publication : présente → la rétablir ; sinon recharger la profondeur, page par page.
  useEffect(() => {
    const state = restoreState.current
    const target = state.target
    if (target === null || state.done) return
    const slot = registry.current.get(target.anchorPostId)
    const step = restoreStep({
      present: slot !== undefined,
      canLoadMore,
      exhausted,
      appended: state.appended,
      maxAppends: Math.min(FEED_RETURN_MAX_DEPTH, target.depth + 1),
    })
    if (step === "found" && slot !== undefined) {
      state.done = true
      const scroller = scrollerRef.current
      if (scroller !== null) scroller.scrollTop = slot.element.offsetTop
      slot.element.scrollTop = Math.max(0, target.offset)
      anchorRef.current = { key: target.anchorPostId, top: 0 }
      updateActive()
      onRestored?.("found")
      setAnnouncement(tRef.current("immersiveFeed.restored"))
    } else if (step === "append") {
      state.appended += 1
      requestLoad("restore")
    } else if (step === "missing") {
      state.done = true
      onRestored?.("missing")
      setAnnouncement(tRef.current("immersiveFeed.restoreMissing"))
    }
  }, [registryVersion, canLoadMore, exhausted, onRestored, requestLoad, updateActive])

  // Approche de la fin : la page suivante se charge d'elle-même, au plus quelques fois.
  useEffect(() => {
    if (onLoadMore === undefined || !canLoadMore || !restoreState.current.done || registryDirty.current) return
    if (autoLoads.current >= IMMERSIVE_AUTO_LOAD_PAGES) return
    const posts = postOrder.current
    const index = activeKey === null ? -1 : posts.indexOf(activeKey)
    if (activeKey === IMMERSIVE_END_KEY || approachingEnd(index, posts.length)) {
      autoLoads.current += 1
      requestLoad("approach")
    }
  }, [activeKey, canLoadMore, onLoadMore, registryVersion, requestLoad])

  // L'annonce d'un chargement : le résultat, une fois la dernière page arrivée.
  useEffect(() => {
    const before = pendingAnnounce.current
    if (before === null || busy || lastStatus === null || lastStatus === "loading" || registryDirty.current) return
    pendingAnnounce.current = null
    // Le chargement est conclu : une suite qui n'a rien ajouté ne garde pas son
    // intention de focus (un chargement automatique ultérieur la volerait).
    pendingFocusAfterLoad.current = null
    // Une erreur s'annonce elle-même (alerte de la page) : pas de « rien de neuf ».
    if (lastStatus === "error") return
    setAnnouncement(loadMoreAnnouncement(Math.max(0, postOrder.current.length - before), tRef.current))
  }, [busy, lastStatus, registryVersion])

  const showNewPosts = () => {
    pendingTop.current = true
    store.setFrozenHead(null)
    setAnnouncement(t("immersiveFeed.newPostsShown"))
  }

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const scroller = scrollerRef.current
    if (scroller === null || event.defaultPrevented) return
    const intent = readerKeyIntent(event)
    if (intent === null) return
    const target = event.target instanceof Element ? event.target : null
    // Un portail (feuille, dialogue) remonte ses évènements par l'arbre React :
    // seul ce qui est DANS le lecteur le pilote.
    if (target === null || !scroller.contains(target)) return
    if (target !== scroller && target.closest(READER_KEY_OWNER_SELECTOR) !== null) return
    const slots = orderedSlots()
    const owner = target.closest<HTMLElement>("[data-fil-slot]")
    const ownerSlot = owner !== null && slots.includes(owner) ? owner : null
    const activeElement = activeKey === null ? undefined : registry.current.get(activeKey)?.element
    const current = ownerSlot ?? activeElement ?? null
    if (current !== null) {
      if (canScrollWithin(current, intent)) {
        // Plus haut que l'écran : le créneau défile d'abord. Le navigateur s'en
        // charge quand le focus y est ; depuis le lecteur lui-même, on le fait.
        if (ownerSlot === null) {
          event.preventDefault()
          const step = Math.round(current.clientHeight * 0.85) * (intent === "next" ? 1 : -1)
          if (typeof current.scrollBy === "function") current.scrollBy({ top: step, behavior: reduceMotion ? "auto" : "smooth" })
          else current.scrollTop += step
        }
        return
      }
      // Détail ouvert (« Lire la suite ») : le fil ne change pas de publication.
      if (current.querySelector('[data-post-caption] button[aria-expanded="true"]') !== null) {
        event.preventDefault()
        return
      }
    }
    const next = slotNavigationTarget(
      slots.map((element) => keyOf(element) ?? ""),
      current === null ? null : keyOf(current),
      intent,
    )
    if (next === null) return
    const element = registry.current.get(next)?.element
    if (element === undefined) return
    event.preventDefault()
    lastUserInput.current = performance.now()
    scrollToSlot(element, { focus: true, smooth: true })
  }

  const endState = endSlotState({ canLoadMore, exhausted, lastPageEmpty })
  const postCount = postOrder.current.length
  const historyDate = historySince === null ? null : new Intl.DateTimeFormat(i18n.resolvedLanguage ?? i18n.language, { dateStyle: "medium" }).format(historySince)

  return (
    <ImmersiveReaderContext.Provider value={context}>
      <FeedImmersionStyles />
      <div ref={sectionRef} className="fil-imm" data-feed-immersive="" style={height === null ? undefined : { height }}>
        <div className="fil-imm-bar">
          {lacunar ? (
            <p className="fil-imm-notice" role="status">
              <CircleAlert aria-hidden="true" size={15} strokeWidth={2.2} />
              <span>{t("immersiveFeed.incompleteShort")}</span>
            </p>
          ) : preparing ? (
            <p className="fil-imm-notice" role="status">
              {t("immersiveFeed.preparingShort")}
            </p>
          ) : null}
          {newCount > 0 ? (
            <button type="button" className="fil-imm-new" onClick={showNewPosts}>
              <ArrowUp aria-hidden="true" size={16} strokeWidth={2.4} />
              <span>{t("immersiveFeed.newPosts", { count: newCount })}</span>
            </button>
          ) : null}
          <span className="fil-imm-bar-spacer" />
          {toggle}
        </div>
        <div
          ref={scrollerRef}
          className="fil-imm-scroller citizen-scrollbar"
          role="region"
          aria-label={label}
          aria-describedby={hintId}
          aria-busy={busy || undefined}
          tabIndex={0}
          onKeyDown={onKeyDown}
        >
          <p id={hintId} className="sr-only">
            {t("immersiveFeed.keyboardHint")}
          </p>
          <div ref={headRef} className="fil-imm-head" data-fil-slot="head">
            {head}
          </div>
          <div className="fil-imm-feed">{children}</div>
          <div ref={endRef} className="fil-imm-slot fil-imm-end" data-fil-slot="end">
            <div className="fil-imm-slot-inner">
              {preparing ? (
                <p className="fil-imm-end-text" role="status">
                  {t("feedPages.preparing")}
                </p>
              ) : null}
              {historyDate !== null ? <p className="fil-imm-end-text">{t("feedPages.historySince", { date: historyDate })}</p> : null}
              {lacunar ? (
                <p className="fil-imm-end-text" role="status">
                  {t("feedPages.incomplete")}
                </p>
              ) : null}
              {end !== undefined ? (
                end
              ) : endState === "more" || endState === "emptyWindow" ? (
                <>
                  {endState === "emptyWindow" ? <p className="fil-imm-end-text">{t("immersiveFeed.emptyWindow")}</p> : null}
                  <div>
                    <Button variant="secondary" icon="arrowDown" onClick={() => requestLoad("user")}>
                      {t("immersiveFeed.loadMore")}
                    </Button>
                  </div>
                </>
              ) : endState === "end" ? (
                postCount > 0 ? <p className="fil-imm-end-text">{t("immersiveFeed.end")}</p> : null
              ) : (
                <p className="fil-imm-end-text" role="status">
                  {t("immersiveFeed.loadingMore")}
                </p>
              )}
            </div>
          </div>
        </div>
        <p className="sr-only" role="status" aria-live="polite">
          {announcement}
        </p>
      </div>
    </ImmersiveReaderContext.Provider>
  )
}
