// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest"
import { configurePostDraftStorage, postDraftStore, usePostDraft } from "./post-draft-store"
import { act, cleanup, render, screen } from "@testing-library/react"
import { parseDrafts } from "./post-draft"

afterEach(() => { cleanup(); postDraftStore.resetForTests(); window.sessionStorage.clear() })
function Probe() { const draft = usePostDraft("feed", "key"); return <output>{JSON.stringify(draft)}</output> }

describe("PA8 — remplacement d'identité dans la même mémoire", () => {
  it("ne transporte ni texte ni choix public vers une autre personne, puis restaure le propriétaire", () => {
    configurePostDraftStorage("antsia:antsia:")
    postDraftStore.setScope("person-a")
    postDraftStore.setBody("feed", "Brouillon de A")
    postDraftStore.setAudience("feed", "public")
    postDraftStore.setPublication("feed", { alsoOnRoot: true })
    render(<Probe />)
    act(() => postDraftStore.setScope("person-b"))
    expect(screen.getByRole("status").textContent).not.toContain("Brouillon de A")
    expect(screen.getByRole("status").textContent).toContain('"alsoOnRoot":false')
    act(() => postDraftStore.setBody("feed", "Brouillon de B"))
    act(() => postDraftStore.setScope("person-a"))
    expect(screen.getByRole("status").textContent).toContain("Brouillon de A")
    expect(screen.getByRole("status").textContent).toContain('"alsoOnRoot":true')
    const storedB = parseDrafts(window.sessionStorage.getItem("antsia:antsia:post-drafts:v1:person-b"))
    expect(storedB.drafts.feed?.body).toBe("Brouillon de B")
    expect(storedB.drafts.feed?.alsoOnRoot).toBe(false)
  })
})
