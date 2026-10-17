// @vitest-environment jsdom
import { api } from "@antsia/api/engine"
import { useViewerTimeZone } from "@antsia/api/viewer-preferences"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { type ReactNode, useState } from "react"
import { useTranslation } from "react-i18next"
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => {
  vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "https://engine.example")
  return { authenticated: false, person: null as { locale: "fr" | "en"; timeZone: string } | null, query: vi.fn() }
})
vi.mock("@antsia/api/hooks", () => ({ useStableConvexAuth: () => ({ isAuthenticated: mocks.authenticated, isLoading: false }) }))
vi.mock("@antsia/api/next-provider", () => ({ EngineConvexProvider: ({ children }: { children: ReactNode }) => <>{children}</> }))
vi.mock("@/lib/auth-client", () => ({ authClient: {} }))
vi.mock("convex/react", () => ({ useQuery: (reference: unknown, args: unknown) => { mocks.query(reference, args); return args === "skip" ? undefined : mocks.person } }))
vi.mock("sonner", () => ({ Toaster: ({ containerAriaLabel }: { containerAriaLabel: string }) => <p data-testid="toast-label">{containerAriaLabel}</p> }))

import { Providers } from "./providers"

function PreferenceReader() {
  const timeZone = useViewerTimeZone()
  const { i18n } = useTranslation()
  const [draft, setDraft] = useState("")
  return <div><p data-testid="zone">{timeZone}</p><p data-testid="locale">{i18n.language}</p><label>Persistent draft<input value={draft} onChange={(event) => setDraft(event.target.value)} /></label></div>
}
function mount() { return render(<Providers locale="fr"><PreferenceReader /></Providers>) }

beforeEach(() => { vi.clearAllMocks(); mocks.authenticated = false; mocks.person = null; document.documentElement.lang = "fr" })
afterEach(cleanup)
afterAll(() => vi.unstubAllEnvs())

describe("console PA7 — préférence personnelle sans remontage", () => {
  it("n'interroge aucune personne pour une session anonyme et garde la langue SSR", () => {
    mount()
    expect(mocks.query).toHaveBeenCalledWith(api.modules.people.persons.getMyPerson, "skip")
    expect(screen.getByTestId("locale").textContent).toBe("fr")
    expect(document.documentElement.lang).toBe("fr")
  })
  it("applique langue, document et fuseau personnels après preuve de session", async () => {
    mocks.authenticated = true
    mocks.person = { locale: "en", timeZone: "Asia/Tokyo" }
    mount()
    await waitFor(() => expect(screen.getByTestId("locale").textContent).toBe("en"))
    expect(document.documentElement.lang).toBe("en")
    expect(screen.getByTestId("zone").textContent).toBe("Asia/Tokyo")
    expect(screen.getByTestId("toast-label").textContent).toBe("Console notifications")
    expect(mocks.query).toHaveBeenCalledWith(api.modules.people.persons.getMyPerson, {})
  })
  it("un changement de préférence garde le brouillon des enfants montés", async () => {
    mocks.authenticated = true
    mocks.person = { locale: "fr", timeZone: "Africa/Libreville" }
    const view = mount()
    await userEvent.type(screen.getByLabelText("Persistent draft"), "À conserver")
    mocks.person = { locale: "en", timeZone: "America/New_York" }
    view.rerender(<Providers locale="fr"><PreferenceReader /></Providers>)
    await waitFor(() => expect(screen.getByTestId("locale").textContent).toBe("en"))
    expect(screen.getByTestId("zone").textContent).toBe("America/New_York")
    expect((screen.getByLabelText("Persistent draft") as HTMLInputElement).value).toBe("À conserver")
  })
})
