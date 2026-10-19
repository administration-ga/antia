/**
 * La LÉGENDE bornée d'une publication — module pur, testé (lot P03 de l'étude
 * social-commerce du 18/10/2026, 04 §2 : « aperçu borné puis Lire la suite ;
 * hashtags et mentions accessibles ; texte complet disponible »).
 *
 * L'aperçu est bâti sur les SEGMENTS du domaine (`splitBodyRich`), jamais sur
 * une coupe brute de la chaîne : un mot-dièse ou une mention entre entier dans
 * l'aperçu ou n'y entre pas — une coupe au milieu de « #numerique » rendrait
 * un lien vers un autre sujet, une coupe dans un long mot pourrait fabriquer
 * une mention qui n'existe pas. L'écran rend ces segments tels quels, sans
 * les redécouper.
 *
 * Le texte se coupe à la dernière espace avant la borne (jamais au milieu d'un
 * mot, sauf mot unique plus long que la borne), et au plus à la troisième
 * ligne : un saut de ligne compte, une liste ne déborde pas de l'aperçu.
 */
import { splitBodyRich, type PostBodySegment } from "@antsia/social-domain/richText"

export interface CaptionLimits {
  /** Caractères affichés au plus dans l'aperçu (points de code, préfixes # et @ compris). */
  maxChars: number
  /** Lignes affichées au plus dans l'aperçu (sauts de ligne de l'auteur). */
  maxLines: number
}

/** Bornes de l'aperçu dans le fil : trois lignes de téléphone environ. */
export const CAPTION_PREVIEW_LIMITS: CaptionLimits = { maxChars: 150, maxLines: 3 }

export interface CaptionPreview {
  /** Les segments de l'aperçu — tous les segments quand rien n'est coupé. */
  segments: PostBodySegment[]
  /** Vrai quand le texte complet dépasse l'aperçu (« Lire la suite » proposé). */
  truncated: boolean
}

const SPACE = /\s/u

/** Taille AFFICHÉE d'un segment, en points de code (le préfixe d'un jeton compris). */
function displayedLength(segment: PostBodySegment): number {
  const size = Array.from(segment.value).length
  return segment.type === "text" ? size : size + 1
}

/** Retire les espaces de fin du dernier segment de texte (l'ellipse suit). */
function trimTrailing(segments: PostBodySegment[]): PostBodySegment[] {
  const last = segments.at(-1)
  if (last?.type !== "text") return segments
  const value = last.value.trimEnd()
  return value.length > 0 ? [...segments.slice(0, -1), { type: "text", value }] : segments.slice(0, -1)
}

/**
 * L'aperçu d'un corps sous les bornes données. Sans dépassement, les segments
 * complets ; sinon les segments entiers qui tiennent, puis le texte coupé à la
 * dernière espace avant la borne.
 */
export function captionPreview(body: string, limits: CaptionLimits = CAPTION_PREVIEW_LIMITS): CaptionPreview {
  // Les espaces et sauts de ligne FINAUX ne sont pas du contenu : ils ne
  // déclenchent jamais un « Lire la suite » qui ne révélerait rien.
  const segments = splitBodyRich(body.trimEnd())
  const kept: PostBodySegment[] = []
  let used = 0
  let lines = 1

  for (const segment of segments) {
    if (segment.type !== "text") {
      const size = displayedLength(segment)
      if (used + size > limits.maxChars) return { segments: trimTrailing(kept), truncated: true }
      kept.push(segment)
      used += size
      continue
    }

    const chars = Array.from(segment.value)
    let stop: number | null = null
    for (let index = 0; index < chars.length; index++) {
      if (chars[index] === "\n") {
        lines += 1
        if (lines > limits.maxLines) {
          stop = index
          break
        }
      }
      if (used + index + 1 > limits.maxChars) {
        stop = index
        break
      }
    }

    if (stop === null) {
      kept.push(segment)
      used += chars.length
      continue
    }

    // Coupe à la dernière espace AVANT la borne : un mot n'est jamais tranché,
    // sauf s'il est seul et plus long que toute la borne.
    let cut = stop
    if (cut < chars.length && !SPACE.test(chars[cut] ?? "")) {
      let space = -1
      for (let index = cut - 1; index >= 0; index--) {
        if (SPACE.test(chars[index] ?? "")) {
          space = index
          break
        }
      }
      if (space >= 0) cut = space
      else if (kept.length > 0) cut = 0
    }
    const value = chars.slice(0, cut).join("")
    if (value.length > 0) kept.push({ type: "text", value })
    return { segments: trimTrailing(kept), truncated: true }
  }

  return { segments, truncated: false }
}
