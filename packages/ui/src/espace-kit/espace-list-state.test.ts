// Dupliqué de socle/packages/agent-features/src/components/espace-kit/espace-list-state.test.ts @ ad2e7fdc2 — adaptations : aucune (copie textuelle, 5 cas) ; en-tête de provenance.
import { describe, expect, it } from "vitest"
import { resolveListState } from "./espace-list-state"

describe("resolveListState", () => {
  it("loading tant que les items ne sont pas arrivés", () => {
    expect(resolveListState({ hasError: false, items: undefined })).toBe(
      "loading",
    )
  })

  it("error quand la lecture a échoué", () => {
    expect(resolveListState({ hasError: true, items: undefined })).toBe(
      "error",
    )
  })

  it("empty quand la liste est vide", () => {
    expect(resolveListState({ hasError: false, items: [] })).toBe("empty")
  })

  it("ready quand la liste porte au moins un élément", () => {
    expect(resolveListState({ hasError: false, items: [1] })).toBe("ready")
  })

  it("l'erreur prime sur le chargement, même si des items sont déjà présents", () => {
    // Une query en échec qui repasse `items` à `undefined` au retry ne doit
    // jamais redevenir "loading" tant que l'erreur est présente — et un
    // résultat périmé encore en mémoire ne doit pas non plus faire passer
    // l'état pour "ready" ou "empty".
    expect(resolveListState({ hasError: true, items: undefined })).toBe(
      "error",
    )
    expect(resolveListState({ hasError: true, items: [] })).toBe("error")
    expect(resolveListState({ hasError: true, items: ["stale"] })).toBe(
      "error",
    )
  })
})
