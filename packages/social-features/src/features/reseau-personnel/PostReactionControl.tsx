// Dupliqué de socle/packages/agent-features/src/features/reseau-personnel/PostReactionControl.tsx @ ad2e7fdc2 — adaptations : réactions au format du moteur (`counts` : un décompte par genre, au lieu de la liste `byKind`) ; libellés par l'i18n (nom des réactions par leur clé de `shared.ts`, textes `reseau:postReactionControl.*`, « réaction » accordé au nombre) ; ombre de la palette par le jeton `--shadow-lg` au lieu d'une couleur littérale ; gestes (appui long, clavier, palette) inchangés ; feuille de style sortie du JSX dans une constante de module (`REACTION_CONTROL_CSS`) — un littéral enfant de `<style>` passerait pour une chaîne d'interface — règles inchangées.
"use client"

import {
  Handshake,
  Lightbulb,
  PartyPopper,
  ThumbsUp,
  type LucideIcon,
} from "lucide-react"
import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react"
import { useTranslation } from "react-i18next"
import { REACTION_OPTIONS, formatCount, type ReactionKind } from "./shared"

const LONG_PRESS_MS = 500
const POINTER_MOVE_TOLERANCE = 12

const REACTION_ICONS: Record<ReactionKind, LucideIcon> = {
  like: ThumbsUp,
  bravo: PartyPopper,
  soutien: Handshake,
  instructif: Lightbulb,
}

interface PostReactionControlProps {
  /** Les réactions TELLES QUE le moteur les rend (`FeedItem.reactions`). */
  reactions: {
    total: number
    /** Un décompte par genre — le domaine les connaît tous, aucun ne manque. */
    counts: Readonly<Record<ReactionKind, number>>
    mine: ReactionKind | null
  }
  pending: boolean
  onReact: (kind: ReactionKind) => void | Promise<void>
}

/**
 * La feuille du contrôle, hors du JSX : un littéral enfant de `<style>`
 * passerait pour une chaîne d'interface (cliquet `no-hardcoded-strings`).
 */
const REACTION_CONTROL_CSS = `
        .rp-reaction-control button {
          transition: background-color 140ms ease, color 140ms ease, transform 140ms ease;
        }
        .rp-reaction-control button:hover:not(:disabled) {
          background: var(--ink-100) !important;
        }
        .rp-reaction-control button:focus-visible {
          outline: 3px solid var(--primary-300, var(--primary-500));
          outline-offset: 2px;
        }
        .rp-reaction-palette {
          animation: rp-reaction-palette-in 140ms ease-out both;
        }
        @keyframes rp-reaction-palette-in {
          from { opacity: 0; transform: translateY(4px) scale(.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          .rp-reaction-control button { transition: none; }
          .rp-reaction-palette { animation: none; }
        }
      `

/**
 * Un geste principal, quatre nuances à la demande.
 *
 * Le clic reste volontairement toujours « J'aime » : la palette est un
 * complément progressif, pas un changement de la cible du geste familier.
 * Le serveur garde seul la sémantique de bascule (ajout, changement ou retrait).
 */
export function PostReactionControl({
  reactions,
  pending,
  onReact,
}: PostReactionControlProps) {
  const { t } = useTranslation("reseau")
  const [paletteOpen, setPaletteOpen] = useState(false)
  const paletteId = useId()
  const wrapperRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([])
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressFired = useRef(false)
  const suppressClick = useRef(false)
  const focusCameFromPointer = useRef(false)
  const suppressFocusOpen = useRef(false)
  const pointerOrigin = useRef<{ x: number; y: number } | null>(null)
  const pendingFocusIndex = useRef<number | null>(null)

  const selectedKind = reactions.mine ?? "like"
  const SelectedIcon = REACTION_ICONS[selectedKind]
  const likeOption = REACTION_OPTIONS.find((option) => option.kind === "like")
  const likeLabel = likeOption ? t(likeOption.labelKey) : selectedKind
  const selectedOption = REACTION_OPTIONS.find((option) => option.kind === selectedKind)
  const selectedLabel = selectedOption ? t(selectedOption.labelKey) : likeLabel

  const clearLongPress = () => {
    if (longPressTimer.current !== null) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

  useEffect(() => clearLongPress, [])

  useEffect(() => {
    const index = pendingFocusIndex.current
    if (!paletteOpen || index === null) return
    pendingFocusIndex.current = null
    optionRefs.current[index]?.focus()
  }, [paletteOpen])

  const returnFocusToTrigger = () => {
    suppressFocusOpen.current = true
    triggerRef.current?.focus()
    window.setTimeout(() => {
      suppressFocusOpen.current = false
    }, 0)
  }

  const closePalette = (returnFocus = false) => {
    setPaletteOpen(false)
    pendingFocusIndex.current = null
    if (returnFocus) returnFocusToTrigger()
  }

  const openAndFocus = (index: number) => {
    if (paletteOpen) {
      optionRefs.current[index]?.focus()
      return
    }
    pendingFocusIndex.current = index
    setPaletteOpen(true)
  }

  const handleTriggerKeyDown = (
    event: ReactKeyboardEvent<HTMLButtonElement>
  ) => {
    if (event.key === "ArrowDown") {
      event.preventDefault()
      openAndFocus(0)
    } else if (event.key === "ArrowUp") {
      event.preventDefault()
      openAndFocus(REACTION_OPTIONS.length - 1)
    } else if (event.key === "Escape" && paletteOpen) {
      event.preventDefault()
      closePalette(true)
    }
  }

  const handleOptionKeyDown = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
    index: number
  ) => {
    let nextIndex: number | null = null
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextIndex = (index + 1) % REACTION_OPTIONS.length
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextIndex =
        (index - 1 + REACTION_OPTIONS.length) % REACTION_OPTIONS.length
    } else if (event.key === "Home") {
      nextIndex = 0
    } else if (event.key === "End") {
      nextIndex = REACTION_OPTIONS.length - 1
    } else if (event.key === "Escape") {
      event.preventDefault()
      closePalette(true)
      return
    }

    if (nextIndex !== null) {
      event.preventDefault()
      optionRefs.current[nextIndex]?.focus()
    }
  }

  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    focusCameFromPointer.current = true
    window.setTimeout(() => {
      focusCameFromPointer.current = false
    }, 0)

    if (event.pointerType !== "touch" && event.pointerType !== "pen") return
    clearLongPress()
    longPressFired.current = false
    pointerOrigin.current = { x: event.clientX, y: event.clientY }
    longPressTimer.current = setTimeout(() => {
      longPressTimer.current = null
      longPressFired.current = true
      suppressClick.current = true
      setPaletteOpen(true)
    }, LONG_PRESS_MS)
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const origin = pointerOrigin.current
    if (!origin || longPressTimer.current === null) return
    if (
      Math.abs(event.clientX - origin.x) > POINTER_MOVE_TOLERANCE ||
      Math.abs(event.clientY - origin.y) > POINTER_MOVE_TOLERANCE
    ) {
      clearLongPress()
      pointerOrigin.current = null
    }
  }

  const endPointerGesture = () => {
    clearLongPress()
    pointerOrigin.current = null
    if (longPressFired.current) {
      // Le `click` synthétique suit `pointerup` sur les écrans tactiles.
      // Le consommer empêche l'appui long de déclencher aussi « J'aime ».
      suppressClick.current = true
    }
    longPressFired.current = false
  }

  return (
    <div
      ref={wrapperRef}
      className="rp-reaction-control"
      style={{ position: "relative", display: "inline-flex", minWidth: 0 }}
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") setPaletteOpen(true)
      }}
      onPointerLeave={() => {
        if (!wrapperRef.current?.contains(document.activeElement)) {
          closePalette()
        }
      }}
      onBlurCapture={(event) => {
        const next = event.relatedTarget
        if (!(next instanceof Node) || !wrapperRef.current?.contains(next)) {
          closePalette()
        }
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        disabled={pending}
        aria-pressed={reactions.mine !== null}
        aria-haspopup="menu"
        aria-expanded={paletteOpen}
        aria-controls={paletteOpen ? paletteId : undefined}
        aria-label={
          reactions.total > 0
            ? t("postReactionControl.triggerWithCount", {
                label: selectedLabel,
                formatted: formatCount(reactions.total),
                count: reactions.total,
              })
            : t("postReactionControl.trigger", { label: selectedLabel })
        }
        title={t("postReactionControl.title")}
        onFocus={() => {
          if (!focusCameFromPointer.current && !suppressFocusOpen.current) {
            setPaletteOpen(true)
          }
        }}
        onKeyDown={handleTriggerKeyDown}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endPointerGesture}
        onPointerCancel={endPointerGesture}
        onClick={() => {
          if (suppressClick.current) {
            suppressClick.current = false
            return
          }
          void onReact("like")
        }}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 7,
          minWidth: 44,
          minHeight: 44,
          padding: "8px 11px",
          border: "none",
          borderRadius: 10,
          background:
            reactions.mine !== null ? "var(--primary-50)" : "transparent",
          color:
            reactions.mine !== null ? "var(--primary-600)" : "var(--ink-600)",
          fontFamily: "inherit",
          fontSize: 13,
          fontWeight: 700,
          cursor: pending ? "progress" : "pointer",
          touchAction: "manipulation",
          userSelect: "none",
          WebkitUserSelect: "none",
        }}
      >
        <SelectedIcon aria-hidden="true" size={18} strokeWidth={2.2} />
        <span>{reactions.mine ? selectedLabel : likeLabel}</span>
        {reactions.total > 0 ? (
          <span
            aria-hidden="true"
            style={{
              color: "var(--ink-500)",
              fontWeight: 600,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {formatCount(reactions.total)}
          </span>
        ) : null}
      </button>

      {paletteOpen ? (
        <div
          id={paletteId}
          role="menu"
          aria-label={t("postReactionControl.palette")}
          className="rp-reaction-palette"
          style={{
            position: "absolute",
            zIndex: 30,
            left: 0,
            bottom: "calc(100% + 8px)",
            display: "flex",
            gap: 4,
            padding: 6,
            border: "1px solid var(--ink-150)",
            borderRadius: 14,
            background: "var(--ink-0)",
            boxShadow: "var(--shadow-lg)",
          }}
        >
          {REACTION_OPTIONS.map((option, index) => {
            const ReactionIcon = REACTION_ICONS[option.kind]
            const count = reactions.counts[option.kind]
            const label = t(option.labelKey)
            return (
              <button
                key={option.kind}
                ref={(node) => {
                  optionRefs.current[index] = node
                }}
                type="button"
                role="menuitemradio"
                aria-checked={reactions.mine === option.kind}
                aria-label={
                  count > 0
                    ? t("postReactionControl.optionWithCount", { label, formatted: formatCount(count) })
                    : label
                }
                title={label}
                disabled={pending}
                onKeyDown={(event) => handleOptionKeyDown(event, index)}
                onClick={() => {
                  void onReact(option.kind)
                  closePalette(true)
                }}
                style={{
                  width: 48,
                  minWidth: 48,
                  minHeight: 48,
                  padding: 4,
                  border: "none",
                  borderRadius: 10,
                  display: "inline-flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 2,
                  background:
                    reactions.mine === option.kind
                      ? "var(--primary-50)"
                      : "transparent",
                  color:
                    reactions.mine === option.kind
                      ? "var(--primary-600)"
                      : "var(--ink-700)",
                  cursor: pending ? "progress" : "pointer",
                  fontFamily: "inherit",
                  fontSize: 10,
                  fontWeight: 700,
                }}
              >
                <ReactionIcon aria-hidden="true" size={19} strokeWidth={2.2} />
                <span aria-hidden="true">{label}</span>
              </button>
            )
          })}
        </div>
      ) : null}

      <style>{REACTION_CONTROL_CSS}</style>
    </div>
  )
}
