// @vitest-environment jsdom
/**
 * P18b (A06, A07) — la liste des commentaires n'est plus une région vivante ;
 * seuls l'AJOUT (« Commentaire publié. ») et l'ÉCHEC s'annoncent, par deux
 * régions persistantes du dialogue — l'échec est redit hors du toast.
 */
import { act, fireEvent, screen } from "@testing-library/react"
import type { ButtonHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { renderWithEngine } from "../../tests/engine-wrapper"

const mocks = vi.hoisted(() => ({
  comment: vi.fn(),
  remove: vi.fn(),
  edit: vi.fn(),
  toastError: vi.fn(),
}))

vi.mock("@antsia/api/engine", () => ({
  api: {
    modules: {
      engagement: {
        engagement: {
          paginateComments: "paginateComments",
          paginateReplies: "paginateReplies",
          comment: "comment",
          removeComment: "removeComment",
          editComment: "editComment",
        },
      },
    },
  },
}))
vi.mock("@antsia/api/hooks", () => ({
  useAuthenticatedPaginatedQuery: () => ({ results: [], status: "Exhausted", loadMore: vi.fn(), isLoading: false }),
}))
vi.mock("convex/react", () => ({
  useMutation: (reference: string) =>
    reference === "comment" ? mocks.comment : reference === "editComment" ? mocks.edit : mocks.remove,
}))
vi.mock("@antsia/ui", () => ({
  Alert: ({ children, title }: { children: ReactNode; title?: string }) => (
    <div role="alert">
      {title}
      {children}
    </div>
  ),
  Button: ({ children, variant: _variant, size: _size, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string; size?: string }) => (
    <button {...props}>{children}</button>
  ),
  TextArea: (props: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...props} />,
  useModalA11y: () => undefined,
}))
vi.mock("./Avatar", () => ({ Avatar: ({ displayName }: { displayName: string }) => <span aria-hidden="true">{displayName}</span> }))
vi.mock("./RichText", () => ({ RichText: ({ body }: { body: string }) => <p>{body}</p> }))
vi.mock("@antsia/ui/overlay", () => ({ useBodyScrollLock: () => undefined, useVisualViewport: () => undefined }))
vi.mock("sonner", () => ({ toast: { error: mocks.toastError } }))

import { CommentsSurface } from "./CommentsSurface"

function renderSurface() {
  renderWithEngine(<CommentsSurface postId={"post-1" as never} now={1_700_000_060_000} onClose={vi.fn()} onReportComment={vi.fn()} />)
}

async function writeAndSend(text: string) {
  fireEvent.change(await screen.findByRole("textbox", { name: "Écrire un commentaire" }), { target: { value: text } })
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Publier" }))
  })
}

beforeEach(() => {
  mocks.comment.mockReset().mockResolvedValue(undefined)
  mocks.remove.mockReset().mockResolvedValue(undefined)
  mocks.edit.mockReset().mockResolvedValue(undefined)
  mocks.toastError.mockReset()
})

describe("annonces de la surface des commentaires (P18b, A06)", () => {
  it("la liste défilante n'est plus une région vivante", async () => {
    renderSurface()
    const dialog = await screen.findByRole("dialog", { name: "Commentaires" })
    expect(dialog.querySelector(".rp-comments-list")).not.toHaveAttribute("aria-live")
    expect(dialog.querySelectorAll("[aria-live]")).toHaveLength(0)
  })

  it("un commentaire publié s'annonce une fois, par la région polie persistante", async () => {
    renderSurface()
    const dialog = await screen.findByRole("dialog", { name: "Commentaires" })
    const status = dialog.querySelector('[role="status"].sr-only')!
    expect(status.textContent).toBe("")

    await writeAndSend("Merci pour l'information")

    expect(mocks.comment).toHaveBeenCalledOnce()
    expect(status.textContent).toBe("Commentaire publié.")
  })

  it("un échec de publication est dit par le toast ET redit dans le dialogue", async () => {
    mocks.comment.mockRejectedValue(new Error("refus"))
    renderSurface()
    const dialog = await screen.findByRole("dialog", { name: "Commentaires" })
    const alert = dialog.querySelector('[role="alert"].sr-only')!

    await writeAndSend("Un commentaire refusé")

    expect(mocks.toastError).toHaveBeenCalledWith("Le commentaire n'a pas pu être publié.")
    expect(alert.textContent).toBe("Le commentaire n'a pas pu être publié.")
    expect(dialog.querySelector('[role="status"].sr-only')?.textContent).toBe("")
  })
})
