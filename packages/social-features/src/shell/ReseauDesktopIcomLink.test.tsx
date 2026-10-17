// Dupliqué de socle/packages/agent-features/src/features/reseau-personnel/ReseauDesktopIcomLink.test.tsx @ ad2e7fdc2 — adaptations : déplacé dans la coque avec son composant ; mocks visant les références du moteur (`messaging.inbox.totalUnread`, `groups.threads.totalUnread`) et le magasin du dock à son chemin du moteur ; rendu dans l'enveloppe du moteur (`renderWithEngine` : i18n française, réseau courant) ; nom accessible lu dans l'i18n — `desktopIcomLabel(unread, t)` ; cas ajouté : l'anglais accorde aussi le pluriel.
// @vitest-environment jsdom

import { fireEvent, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { createAppI18n } from "../i18n"
import { renderWithEngine } from "../tests/engine-wrapper"

const mocks = vi.hoisted(() => ({
  directUnread: 0,
  /* IC-06 : les groupes ne se COMPTENT plus sur la liste rendue — le serveur
     rend un total plafonné, comme pour les tête-à-tête. */
  groupUnread: 0,
  detach: vi.fn(),
}))

vi.mock("@antsia/api/engine", async (importOriginal) => {
  const original = await importOriginal<typeof import("@antsia/api/engine")>()
  const modules = original.api.modules
  return {
    ...original,
    api: {
      modules: {
        messaging: {
          inbox: { totalUnread: "totalUnread", startThreadWithHandle: modules.messaging.inbox.startThreadWithHandle },
          messages: modules.messaging.messages,
          typing: modules.messaging.typing,
          pins: modules.messaging.pins,
          reactions: modules.messaging.reactions,
          forward: modules.messaging.forward,
        },
        groups: {
          threads: { totalUnread: "groupesTotalUnread", markGroupRead: modules.groups.threads.markGroupRead },
          messages: modules.groups.messages,
          typing: modules.groups.typing,
        },
        calls: modules.calls,
      },
    },
  }
})

vi.mock("@antsia/api/hooks", () => ({
  useAuthenticatedConvexQuery: (reference: string) =>
    reference === "totalUnread"
      ? {
          data: { total: mocks.directUnread, capped: false },
          isLoading: false,
          isError: false,
          refetch: vi.fn(),
        }
      : {
          data: { total: mocks.groupUnread, capped: false },
          isLoading: false,
          isError: false,
          refetch: vi.fn(),
        },
}))

vi.mock("../features/messagerie/dock-store", () => ({
  dockStore: { detach: mocks.detach },
}))

vi.mock("@antsia/ui", () => ({
  Icon: () => <span aria-hidden="true" />,
}))

import { desktopIcomLabel, icomUnreadTotal, ReseauDesktopIcomLink } from "./ReseauDesktopIcomLink"

const fr = createAppI18n({ locale: "fr", appResources: { fr: {}, en: {} }, defaultNS: "reseau" }).getFixedT("fr")
const en = createAppI18n({ locale: "en", appResources: { fr: {}, en: {} }, defaultNS: "reseau" }).getFixedT("en")

beforeEach(() => {
  mocks.directUnread = 0
  mocks.groupUnread = 0
  mocks.detach.mockClear()
})

describe("porte iCom de la page réseau au bureau", () => {
  it("détache le téléphone iCom sans ouvrir une page de messagerie", () => {
    renderWithEngine(<ReseauDesktopIcomLink />)

    const button = screen.getByRole("button", { name: "Ouvrir iCom" })
    expect(button.getAttribute("href")).toBeNull()
    fireEvent.click(button)
    expect(mocks.detach).toHaveBeenCalledTimes(1)
    expect(screen.getByText("iCom")).toBeTruthy()
  })

  it("additionne les conversations directes et les groupes dans un seul nom accessible", () => {
    mocks.directUnread = 2
    mocks.groupUnread = 5
    renderWithEngine(<ReseauDesktopIcomLink />)

    expect(
      screen.getByRole("button", {
        name: "Ouvrir iCom — 7 conversations non lues",
      }),
    ).toBeTruthy()
    expect(screen.getByText("7").getAttribute("aria-hidden")).toBe("true")
  })

  it("accorde le singulier et normalise une réponse absente", () => {
    expect(icomUnreadTotal(undefined, undefined)).toBe(0)
    expect(icomUnreadTotal({ total: 1, capped: false }, undefined)).toBe(1)
    expect(desktopIcomLabel(1, fr)).toBe("Ouvrir iCom — 1 conversation non lue")
    expect(desktopIcomLabel(0, fr)).toBe("Ouvrir iCom")
  })

  it("accorde aussi le pluriel en anglais", () => {
    expect(desktopIcomLabel(1, en)).toBe("Open iCom — 1 unread conversation")
    expect(desktopIcomLabel(4, en)).toBe("Open iCom — 4 unread conversations")
  })

  it("ne dépasse jamais le plafond du serveur", () => {
    // Deux moitiés déjà plafonnées à 99 ne font pas 198 : la pastille rend
    // « 99+ », et le nom accessible le chiffre une seule fois.
    expect(icomUnreadTotal({ total: 99, capped: true }, { total: 99, capped: true })).toBe(99)
  })
})
