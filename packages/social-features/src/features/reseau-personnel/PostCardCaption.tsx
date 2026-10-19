"use client"

/**
 * La LÉGENDE d'une publication dans la présentation « media » (lot P03 de
 * l'étude social-commerce du 18/10/2026, 04 §2) : un aperçu borné, puis
 * « Lire la suite » ; le texte complet reste disponible, mots-dièse et
 * mentions compris.
 *
 * La coupe est décidée par `post-card-caption.ts` (module pur) sur les
 * segments du domaine : un jeton n'est jamais tranché ni fabriqué, l'aperçu
 * est rendu tel quel (`RichText segments`). Le bouton est une divulgation
 * (`aria-expanded`, `aria-controls`) : le focus reste sur lui, le lecteur
 * d'écran annonce l'état, et « Réduire » rend l'aperçu.
 */
import { useId, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import { captionPreview } from "./post-card-caption"
import { RichText } from "./RichText"

/**
 * « Lire la suite » se distingue du texte par la graisse ET le trait, pas
 * par sa seule couleur (le gris secondaire n'est qu'à ~2,7:1 de l'encre).
 */
const TOGGLE_STYLE = {
  background: "none",
  border: "none",
  padding: 0,
  margin: 0,
  font: "inherit",
  fontWeight: 700,
  color: "var(--muted-foreground)",
  cursor: "pointer",
  textDecorationLine: "underline",
  textUnderlineOffset: "0.16em",
  display: "inline-flex",
  alignItems: "center",
  minHeight: 44,
} as const

export function PostCardCaption({
  body,
  onTag,
  onMention,
}: {
  body: string
  onTag?: (tag: string) => void
  onMention?: (handle: string) => void
}) {
  return <CaptionContent key={body} body={body} onTag={onTag} onMention={onMention} />
}

function CaptionContent({ body, onTag, onMention }: { body: string; onTag?: (tag: string) => void; onMention?: (handle: string) => void }) {
  const { t } = useTranslation("reseau")
  const id = useId()
  const [expanded, setExpanded] = useState(false)
  const preview = useMemo(() => captionPreview(body), [body])

  if (!preview.truncated) return <RichText body={body} onTag={onTag} onMention={onMention} />

  return (
    <div id={id} data-post-caption="">
      <RichText
        body={body}
        segments={expanded ? undefined : preview.segments}
        onTag={onTag}
        onMention={onMention}
        trailing={
          <>
            {expanded ? " " : <span aria-hidden="true">… </span>}
            <button type="button" aria-expanded={expanded} aria-controls={id} onClick={() => setExpanded((value) => !value)} style={TOGGLE_STYLE}>
              {expanded ? t("postCard.caption.less") : t("postCard.caption.more")}
            </button>
          </>
        }
      />
    </div>
  )
}
