// Dupliqué de socle/packages/ui-v2/src/components/badge.tsx @ ad2e7fdc2 — adaptations : en-tête de provenance ; rayon lu dans `--ui2-badge-radius` (6 px dans les thèmes ANTSIA, ADR-0027), 999 px en repli.
import type { CSSProperties, ReactNode } from "react"
import { Icon, type IconName } from "./icon"
import type { Tone } from "../types"

export interface BadgeProps {
  tone?: Tone
  children?: ReactNode
  dot?: boolean
  icon?: IconName
  size?: "sm" | "md"
  style?: CSSProperties
}

interface ToneSpec {
  bg: string
  fg: string
  dot: string
}

const TONES: Record<Tone, ToneSpec> = {
  neutral: { bg: "var(--ink-150)", fg: "var(--ink-700)", dot: "var(--ink-500)" },
  primary: { bg: "var(--primary-50)", fg: "var(--primary-600)", dot: "var(--primary-500)" },
  success: { bg: "var(--success-50)", fg: "var(--success-600)", dot: "var(--success-500)" },
  warning: { bg: "var(--warning-50)", fg: "var(--warning-600)", dot: "var(--warning-500)" },
  danger: { bg: "var(--danger-50)", fg: "var(--danger-600)", dot: "var(--danger-500)" },
  info: { bg: "var(--info-50)", fg: "var(--info-600)", dot: "var(--info-500)" },
  archived: {
    bg: "var(--status-archived-bg)",
    fg: "var(--success-600)",
    dot: "var(--status-archived)",
  },
  active: { bg: "var(--status-active-bg)", fg: "var(--primary-600)", dot: "var(--status-active)" },
  semi: { bg: "var(--status-semi-bg)", fg: "var(--ink-700)", dot: "var(--status-semi)" },
  inactive: {
    bg: "var(--status-inactive-bg)",
    fg: "var(--ink-600)",
    dot: "var(--status-inactive)",
  },
  destruct: {
    bg: "var(--status-destruct-bg)",
    fg: "var(--warning-600)",
    dot: "var(--status-destruct)",
  },
}

export const Badge = ({
  tone = "neutral",
  children,
  dot,
  icon,
  size = "md",
  style,
}: BadgeProps) => {
  const t = TONES[tone]
  const sz =
    size === "sm"
      ? { padding: "1px 8px", fontSize: 11, height: 18 }
      : { padding: "2px 10px", fontSize: 12, height: 22 }
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        background: t.bg,
        color: t.fg,
        ...sz,
        borderRadius: "var(--ui2-badge-radius, 999px)",
        fontWeight: 600,
        letterSpacing: "0.01em",
        ...style,
      }}
    >
      {dot && (
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: t.dot }} />
      )}
      {icon && (
        <Icon name={icon} size={11} stroke={2.25} style={{ color: t.dot }} />
      )}
      {children}
    </span>
  )
}
