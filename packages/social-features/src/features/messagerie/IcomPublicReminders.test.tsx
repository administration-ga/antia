// Dupliqué de socle/packages/agent-features/src/features/messagerie/IcomPublicReminders.test.tsx @ ad2e7fdc2 — adaptations : rendu dans l'enveloppe du moteur (i18n français, routeur en mémoire, table des routes injectée) au lieu d'un `Link` moqué ; « iRéseau » devient « le réseau » ; le badge est celui que le serveur a CALCULÉ (« Officiel » pour une page officielle) ; la page mène à la fiche que sert l'application (`routes.page`, table injectée), jamais au profil homonyme, « Tout voir » mène à l'accueil du réseau ; cas neuf : une page de communauté n'est pas dite officielle.
// @vitest-environment jsdom

import type { EngineRoutes } from "@antia/api/network"
import { fireEvent, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import { EngineTestWrapper, renderWithEngine, TEST_ROUTES } from "../../tests/engine-wrapper"

import { IcomPublicRemindersView } from "./IcomPublicReminders"
import type { IcomPublicReminder } from "./icom-public-reminders"

const REMINDER: IcomPublicReminder = {
  kind: "page",
  postId: "post-1",
  publishedAt: 1_000_000,
  excerpt: "Le service public ouvre un nouveau guichet.",
  pageId: "page-1",
  pageHandle: "service-public",
  pageName: "Service public",
  pageLogoUrl: null,
  pageBadge: "official",
}

/** Une application qui SERT les pages : sa table des routes en porte une. */
const ROUTES_AVEC_PAGES: EngineRoutes & { page: (handle: string) => string } = {
  ...TEST_ROUTES,
  page: (handle) => `/pages/${handle}`,
}

function renderAvecPages(ui: ReactNode) {
  return render(ui, {
    wrapper: ({ children }) => (
      <EngineTestWrapper routes={ROUTES_AVEC_PAGES}>{children}</EngineTestWrapper>
    ),
  })
}

describe("IcomPublicRemindersView", () => {
  it("nomme la frontière privé/public et renvoie vers le réseau", () => {
    renderAvecPages(
      <IcomPublicRemindersView
        reminders={[REMINDER]}
        now={REMINDER.publishedAt + 3_600_000}
      />,
    )

    expect(
      screen.getByRole("heading", { name: "À ne pas manquer dans le réseau" }),
    ).toBeTruthy()
    expect(screen.getByText(/échanges restent privés dans iCom/i)).toBeTruthy()
    expect(screen.getByText("Officiel")).toBeTruthy()
    expect(screen.getByText("il y a 1 h")).toBeTruthy()
    expect(
      screen.getByRole("link", { name: /Service public/i }).getAttribute("href"),
    ).toBe("/pages/service-public")
    expect(
      screen
        .getByRole("link", { name: "Tout voir dans le réseau" })
        .getAttribute("href"),
    ).toBe("/fil")
    expect(screen.queryByRole("button", { name: /réagir|commenter/i })).toBeNull()
  })

  it("le rappel mène à la fiche de la page — jamais vers un profil homonyme", () => {
    renderWithEngine(
      <IcomPublicRemindersView reminders={[REMINDER]} now={REMINDER.publishedAt} />,
    )

    const lien = screen.getByRole("link", { name: /Service public/i })
    expect(lien.getAttribute("href")).toBe(TEST_ROUTES.page("service-public"))
    expect(lien.getAttribute("href")).not.toBe(TEST_ROUTES.profile("service-public"))
    // La porte vers le réseau, elle, mène à l'accueil.
    expect(
      screen.getByRole("link", { name: "Tout voir dans le réseau" }).getAttribute("href"),
    ).toBe("/fil")
  })

  it("une page de communauté porte son badge calculé, pas « Officiel »", () => {
    renderWithEngine(
      <IcomPublicRemindersView
        reminders={[{ ...REMINDER, pageBadge: "community" }]}
        now={REMINDER.publishedAt}
      />,
    )

    expect(screen.getByText("Communauté")).toBeTruthy()
    expect(screen.queryByText("Officiel")).toBeNull()
  })

  it("rend des états sobres de chargement, vide et erreur réessayable", () => {
    const onRetry = vi.fn()
    const { rerender } = renderWithEngine(
      <IcomPublicRemindersView reminders={[]} now={0} loading />,
    )
    expect(screen.getByRole("status").textContent).toContain("Chargement")

    rerender(<IcomPublicRemindersView reminders={[]} now={0} />)
    expect(screen.getByText(/Aucune publication publique récente/i)).toBeTruthy()

    rerender(
      <IcomPublicRemindersView
        reminders={[]}
        now={0}
        failed
        onRetry={onRetry}
      />,
    )
    fireEvent.click(screen.getByRole("button", { name: "Réessayer" }))
    expect(onRetry).toHaveBeenCalledOnce()
  })
})
