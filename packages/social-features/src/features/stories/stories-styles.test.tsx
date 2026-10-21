// @vitest-environment jsdom
import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { StoriesStyles } from "./stories-styles"

describe("stories — géométrie des médaillons", () => {
  it("garde les cartes historiques et applique les mesures du canevas aux seuls médaillons", () => {
    const view = render(<>
      <StoriesStyles />
      <div className="st-tray" data-presentation="cards"><button className="st-tray-tile" /></div>
      <div className="st-tray" data-presentation="rings"><button className="st-tray-tile"><span className="st-ring-tile"><span className="st-tray-ring"><span className="st-tray-disc" /></span></span><span className="st-ring-name" /></button></div>
    </>)
    const cards = view.container.querySelector<HTMLElement>('[data-presentation="cards"]')!
    const rings = view.container.querySelector<HTMLElement>('[data-presentation="rings"]')!
    expect(getComputedStyle(cards).gap).toBe("8px")
    expect(getComputedStyle(cards.querySelector("button")!).width).toBe("112px")
    expect(getComputedStyle(rings).gap).toBe("12px")
    expect(getComputedStyle(rings).padding).toBe("2px 2px 4px")
    const ring = getComputedStyle(rings.querySelector(".st-tray-ring")!)
    expect([ring.width, ring.height, ring.padding]).toEqual(["62px", "62px", "3px"])
    expect(getComputedStyle(rings.querySelector(".st-tray-disc")!).borderWidth).toBe("3px")
    const name = getComputedStyle(rings.querySelector(".st-ring-name")!)
    expect([name.maxWidth, name.fontSize]).toEqual(["66px", "11.5px"])
  })

  it("sépare la pastille de 24 px de sa cible interactive d'au moins 44 px", () => {
    const view = render(<>
      <StoriesStyles />
      <div className="st-tray" data-presentation="rings"><span className="st-ring-self"><button className="st-ring-plus-button"><span className="st-ring-plus" /></button></span></div>
    </>)
    const own = getComputedStyle(view.container.querySelector(".st-ring-self")!)
    expect([own.width, own.height]).toEqual(["62px", "62px"])
    const button = getComputedStyle(view.container.querySelector("button")!)
    expect([button.minWidth, button.minHeight]).toEqual(["44px", "44px"])
    const mark = getComputedStyle(view.container.querySelector(".st-ring-plus")!)
    expect([mark.width, mark.height]).toEqual(["24px", "24px"])
    expect(mark.pointerEvents).toBe("none")
  })
})
