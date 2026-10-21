// @vitest-environment jsdom
import { fireEvent, render } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { identityToneStyle } from "../reseau-personnel/avatar-presentation"
import { StoryRing } from "./StoryRing"

describe("StoryRing — repli du média servi", () => {
  it("une image en échec rend les initiales et une nouvelle URL peut être chargée", () => {
    const view = render(<StoryRing state="unseen" displayName="Awa NDONG" coverUrl="/story-one" />)
    const first = view.container.querySelector("img")!
    expect(first).toHaveAttribute("alt", "")
    expect(view.container.firstElementChild).toHaveAttribute("aria-hidden", "true")
    fireEvent.error(first)
    expect(view.container.querySelector("img")).toBeNull()
    expect(view.container).toHaveTextContent("AN")
    view.rerender(<StoryRing state="seen" displayName="Awa NDONG" coverUrl="/story-two" />)
    expect(view.container.querySelector("img")).toHaveAttribute("src", "/story-two")
  })

  it("limite la palette et les initiales de 15 px aux médaillons, sans changer les cartes", () => {
    const view = render(<StoryRing state="unseen" displayName="Awa NDONG" />)
    expect(view.container.querySelector(".st-tray-fallback")).toBeNull()
    expect(view.getByText("AN")).toHaveStyle({ fontSize: "18px" })

    view.rerender(<StoryRing presentation="rings" state="unseen" displayName="Awa NDONG" />)
    expect(view.container.querySelector(".st-tray-fallback")).toHaveStyle(identityToneStyle("Awa NDONG"))
    expect(view.getByText("AN")).toHaveStyle({ fontSize: "15px" })
  })

  it("décline les six tons du nom public indépendamment de l'état de lecture", () => {
    const view = render(<>{["A", "B", "C", "D", "E", "F"].map((name) => <StoryRing key={name} presentation="rings" state="unseen" displayName={name} />)}</>)
    const tones = [...view.container.querySelectorAll(".st-tray-fallback")].map((fallback) => fallback.getAttribute("style"))
    expect(new Set(tones).size).toBe(6)

    view.rerender(<StoryRing presentation="rings" state="seen" displayName="Awa NDONG" />)
    expect(view.container.firstElementChild).toHaveClass("esp-story-ring-seen")
    const tone = view.container.querySelector(".st-tray-fallback")!.getAttribute("style")
    view.rerender(<StoryRing presentation="rings" state="unseen" displayName="  AWA   NDONG  " />)
    expect(view.container.firstElementChild).toHaveClass("esp-story-ring")
    expect(view.container.querySelector(".st-tray-fallback")).toHaveAttribute("style", tone)
  })

  it("garde la couverture ou le portrait valide avant le repli coloré", () => {
    const view = render(<StoryRing presentation="rings" state="unseen" displayName="Awa NDONG" coverUrl="/cover" avatarUrl="/portrait" />)
    expect(view.container.querySelector("img")).toHaveAttribute("src", "/cover")
    expect(view.container.querySelector(".st-tray-fallback")).toBeNull()

    view.rerender(<StoryRing presentation="rings" state="seen" displayName="Awa NDONG" avatarUrl="/portrait" />)
    const portrait = view.container.querySelector("img")!
    expect(portrait).toHaveAttribute("src", "/portrait")
    fireEvent.error(portrait)
    expect(view.container.querySelector("img")).toBeNull()
    expect(view.container.querySelector(".st-tray-fallback")).toHaveStyle(identityToneStyle("Awa NDONG"))
    expect(view.container.firstElementChild).toHaveClass("esp-story-ring-seen")
  })

  it("un nom absent garde une silhouette neutre, y compris après une erreur d'image", () => {
    const view = render(<StoryRing presentation="rings" state="seen" displayName={" \t "} avatarUrl="/portrait" />)
    fireEvent.error(view.container.querySelector("img")!)
    expect(view.container.querySelector(".st-tray-fallback")).toHaveStyle(identityToneStyle("", false))
    expect(view.container.querySelector("svg")).not.toBeNull()
    expect(view.container.textContent).toBe("")
  })
})
