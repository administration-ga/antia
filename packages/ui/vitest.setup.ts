// Matchers DOM de testing-library (`toHaveAttribute`…) et démontage entre deux
// cas : seuls les tests en jsdom montent des composants.
import "@testing-library/jest-dom/vitest"

import { afterEach } from "vitest"

afterEach(async () => {
  if (typeof document === "undefined") return
  const { cleanup } = await import("@testing-library/react")
  cleanup()
})
