// Dupliqué de socle/packages/agent-features/src/features/reseau-personnel/Avatar.test.tsx @ ad2e7fdc2 — adaptations : mock de `@antia/ui` ; photo servie par une adresse relative (aucune origine en dur) ; cas inchangé.
// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("@antia/ui", () => ({
  Icon: () => <span data-testid="fallback-icon" />,
}))

import { Avatar } from "./Avatar"

afterEach(cleanup)

describe("Avatar", () => {
  it("charge immédiatement une photo d'identité visible", () => {
    const { container } = render(
      <Avatar
        displayName="Ada Mba"
        avatarUrl="/medias/ada.webp"
      />
    )

    const image = container.querySelector("img")
    expect(image).not.toBeNull()
    expect(image?.getAttribute("loading")).toBe("eager")
    expect(image?.getAttribute("decoding")).toBe("async")
  })
})
