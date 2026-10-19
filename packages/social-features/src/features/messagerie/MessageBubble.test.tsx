// @vitest-environment jsdom
/**
 * P18b (A02) — la bulle de message n'est plus un bouton englobant : son corps
 * est lisible en entier, précédé de son auteur ; la citation, l'image, la vidéo
 * et le vocal restent atteignables pour eux-mêmes ; un bouton d'actions
 * distinct, nommé par l'auteur, ouvre la feuille — et un clic sur un contrôle
 * de la bulle ne l'ouvre pas par-dessus.
 */
import { fireEvent, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { renderWithEngine } from "../../tests/engine-wrapper"
import { MessageBubble, type BubbleMessage, type MessageBubbleProps } from "./MessageBubble"

// La feuille réelle (tiroir Radix) n'est pas l'objet de ce test : sa présence suffit.
vi.mock("./MessageActionsSheet", () => ({
  MessageActionsSheet: ({ open }: { open: boolean }) => (open ? <div role="dialog" aria-label="feuille d'actions" /> : null),
  reactionLabelKey: (kind: string) => `messagerie:messageActionsSheet.reactions.${kind}`,
}))

const LONG_TEXT =
  "Bonjour, je confirme le rendez-vous de jeudi à dix heures devant la mairie, avec les trois dossiers complets et les copies demandées."

function row(message: Partial<BubbleMessage> = {}, mine = false): MessageBubbleProps["row"] {
  return {
    kind: "message",
    id: "m1",
    mine,
    first: true,
    last: true,
    showTime: true,
    message: {
      id: "m1",
      senderId: mine ? "persons_me" : "persons_awa",
      createdAt: Date.UTC(2026, 9, 18, 10, 0),
      text: LONG_TEXT,
      senderName: "Awa",
      attachments: [
        { filename: "vocal.webm", mimeType: "audio/webm", sizeBytes: 1_000, durationMs: 4_000, url: "https://fichiers.test/vocal" },
        { filename: "photo.jpg", mimeType: "image/jpeg", sizeBytes: 2_000, url: "https://fichiers.test/photo" },
        { filename: "clip.mp4", mimeType: "video/mp4", sizeBytes: 3_000, url: "https://fichiers.test/clip" },
      ],
      reply: { messageId: "m0", authorName: "Bilal", excerpt: "Question d'origine", deleted: false },
      reactions: null,
      readAt: null,
      editedAt: Date.UTC(2026, 9, 18, 10, 5),
      forwarded: true,
      pinned: false,
      ...message,
    },
  }
}

function renderBubble(props: Partial<MessageBubbleProps> = {}) {
  const handlers = { onReply: vi.fn(), onReact: vi.fn(), onAction: vi.fn(), onOpenQuoted: vi.fn() }
  const view = renderWithEngine(
    <MessageBubble row={row()} conversationKind="chat" showSender={false} canReply {...handlers} {...props} />,
  )
  return { ...view, ...handlers }
}

describe("MessageBubble (P18b, A02)", () => {
  it("aucun contrôle n'est enfermé dans un bouton, et le corps est lisible en entier avec son auteur", () => {
    const { container } = renderBubble()

    expect(container.querySelectorAll("button a, button audio, button video, button button")).toHaveLength(0)
    expect(container.textContent).toContain(LONG_TEXT)
    expect(screen.getByText("Message de Awa :")).toHaveClass("sr-only")
    expect(screen.getByText("Transféré")).toBeInTheDocument()
    expect(screen.getByText("(modifié)", { exact: false })).toBeInTheDocument()
  })

  it("la citation, l'image, la vidéo et le vocal sont atteignables, sans ouvrir la feuille", () => {
    const { container, onOpenQuoted } = renderBubble()

    const quote = screen.getByRole("button", { name: "Aller au message cité de Bilal" })
    fireEvent.click(quote)
    expect(onOpenQuoted).toHaveBeenCalledWith("m0")

    const link = screen.getByRole("link", { name: "photo.jpg" })
    // jsdom ne navigue pas : la navigation est neutralisée, le clic remonte.
    link.addEventListener("click", (event) => event.preventDefault())
    fireEvent.click(link)
    const audio = container.querySelector("audio")!
    expect(audio).toHaveAttribute("controls")
    expect(audio).toHaveAccessibleName(/^Message vocal/)
    fireEvent.click(audio)
    const video = container.querySelector("video")!
    expect(video).toHaveAttribute("controls")
    fireEvent.click(video)

    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("un bouton d'actions distinct, nommé par l'auteur, ouvre la feuille ; le clic sur le texte aussi", () => {
    renderBubble()

    const actions = screen.getByRole("button", { name: "Actions sur le message de Awa" })
    expect(actions).toHaveAttribute("aria-haspopup", "dialog")
    expect(actions).toHaveClass("msg-actions-btn")
    fireEvent.click(actions)
    expect(screen.getByRole("dialog")).toBeInTheDocument()
  })

  it("le clic de souris sur le corps de la bulle ouvre toujours la feuille", () => {
    renderBubble()
    fireEvent.click(screen.getByText(LONG_TEXT))
    expect(screen.getByRole("dialog")).toBeInTheDocument()
  })

  it("mon propre message se dit « Votre message » et son bouton « Actions sur votre message »", () => {
    renderBubble({ row: row({ attachments: [], reply: null }, true) })
    expect(screen.getByText("Votre message :")).toHaveClass("sr-only")
    expect(screen.getByRole("button", { name: "Actions sur votre message" })).toBeInTheDocument()
  })

  it("le nom de l'expéditeur affiché dans un groupe n'est pas lu deux fois", () => {
    const { container } = renderBubble({ showSender: true, conversationKind: "groupe" })
    expect(container.querySelector(".msg-sender")).toHaveAttribute("aria-hidden", "true")
    expect(screen.getByText("Message de Awa :")).toBeInTheDocument()
  })
})
