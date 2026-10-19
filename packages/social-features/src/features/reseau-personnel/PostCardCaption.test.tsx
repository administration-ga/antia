// @vitest-environment jsdom
import { fireEvent, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { renderWithEngine } from "../../tests/engine-wrapper"
import { PostCardCaption } from "./PostCardCaption"
import { captionPreview } from "./post-card-caption"

describe("Légende P03", () => {
  it("garde les mots-dièse et mentions entiers à la limite de l'aperçu", () => {
    expect(captionPreview("Début #numerique @awa.demo", { maxChars: 10, maxLines: 3 })).toEqual({
      segments: [{ type: "text", value: "Début" }],
      truncated: true,
    })
    expect(captionPreview("#numerique @awa.demo", { maxChars: 15, maxLines: 3 })).toEqual({
      segments: [{ type: "tag", value: "numerique" }],
      truncated: true,
    })
  })

  it("borne les sauts de ligne sans réduire un texte dont seuls les blancs finaux dépassent", () => {
    expect(captionPreview("Une\nDeux\nTrois\nQuatre").truncated).toBe(true)
    expect(captionPreview("Court\n\n\n\n")).toEqual({ segments: [{ type: "text", value: "Court" }], truncated: false })
  })

  it("révèle le texte et ses liens, puis referme l'aperçu quand le corps change", () => {
    const body = `${"Un récit de la communauté. ".repeat(8)}#numerique @awa.demo`
    const view = renderWithEngine(<PostCardCaption body={body} />)
    const toggle = screen.getByRole("button", { name: "Lire la suite" })
    expect(toggle).toHaveAttribute("aria-expanded", "false")
    expect(screen.queryByRole("link", { name: "#numerique" })).toBeNull()

    fireEvent.click(toggle)
    expect(screen.getByRole("button", { name: "Réduire" })).toHaveAttribute("aria-expanded", "true")
    expect(screen.getByRole("link", { name: "#numerique" })).toHaveAttribute("href", "/fil?tag=numerique")
    expect(screen.getByRole("link", { name: "@awa.demo" })).toHaveAttribute("href", "/profil/awa.demo")

    view.rerender(<PostCardCaption body={`${"Un autre texte. ".repeat(15)}#nouveau`} />)
    expect(screen.getByRole("button", { name: "Lire la suite" })).toHaveAttribute("aria-expanded", "false")
    expect(screen.queryByRole("link", { name: "#nouveau" })).toBeNull()
  })
})
