// @vitest-environment jsdom
// P04 (18/10/2026) : le lecteur immersif — clavier dans le lecteur seulement, gestes laissés aux curseurs et aux feuilles, fin honnête, nouvelles publications, retrait, retour.
import { fireEvent, screen, waitFor } from "@testing-library/react"
import { useMemo, useState } from "react"
import { createPortal } from "react-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { renderWithEngine } from "../../tests/engine-wrapper"
import {
  ImmersiveFeedReader,
  ImmersiveFeedSlot,
  useImmersiveFrozenHead,
  useImmersivePageReport,
  type FeedRestoreTarget,
  type ImmersivePageReport,
} from "./ImmersiveFeedReader"
import { FEED_IMMERSION_CSS } from "./immersive-styles"

/** Une publication de test : un bouton, un curseur, et des extras facultatifs. */
function Post({ id, detailOpen = false, portal = false }: { id: string; detailOpen?: boolean; portal?: boolean }) {
  return (
    <ImmersiveFeedSlot postId={id} label={`Publication ${id}`}>
      <div>
        <p>{`Contenu ${id}`}</p>
        <button type="button">{`Aimer ${id}`}</button>
        <input type="range" aria-label={`Curseur ${id}`} />
        {detailOpen ? (
          <div data-post-caption="">
            <button type="button" aria-expanded="true">{`Réduire ${id}`}</button>
          </div>
        ) : null}
        {portal ? createPortal(<div><button type="button">{`Bouton du portail ${id}`}</button></div>, document.body) : null}
      </div>
    </ImmersiveFeedSlot>
  )
}

function Reporter({ report }: { report: ImmersivePageReport }) {
  useImmersivePageReport(report)
  return null
}

const ready: ImmersivePageReport = { pageKey: "page", isFirst: true, isLast: true, status: "ready", count: 2, lacunar: false, preparing: false, materializedSince: null, newCount: 0 }

beforeEach(() => {
  // jsdom ne fait pas défiler : la position est simulée.
  Element.prototype.scrollTo = vi.fn()
})

describe("structure", () => {
  it("rend la tête, une publication par créneau nommé et la fin, dans une région nommée et focalisable", () => {
    renderWithEngine(
      <ImmersiveFeedReader label="Fil en immersion" head={<p>Tête du fil</p>}>
        <Post id="p1" />
        <Post id="p2" />
      </ImmersiveFeedReader>,
    )
    const region = screen.getByRole("region", { name: "Fil en immersion" })
    expect(region).toHaveAttribute("tabindex", "0")
    expect(screen.getByText("Tête du fil")).toBeInTheDocument()
    expect(screen.getAllByRole("article").map((article) => article.getAttribute("aria-label"))).toEqual(["Publication p1", "Publication p2"])
  })

  it("accroche chaque publication sans forcer un contenu plus haut que l'écran", () => {
    // La mécanique est native : accrochage obligatoire, arrêt à chaque créneau,
    // défilement INTÉRIEUR d'un créneau trop haut, aucun geste capturé.
    expect(FEED_IMMERSION_CSS).toContain("scroll-snap-type: y mandatory")
    expect(FEED_IMMERSION_CSS).toContain("scroll-snap-stop: always")
    expect(FEED_IMMERSION_CSS).toMatch(/\.fil-imm-slot \{[^}]*overflow-y: auto/)
    expect(FEED_IMMERSION_CSS).toContain("overscroll-behavior-y: contain")
    expect(FEED_IMMERSION_CSS).not.toContain("touch-action: none")
    expect(FEED_IMMERSION_CSS).toContain('.fil-imm-slot:has([data-post-caption] button[aria-expanded="true"])')
  })
})

describe("clavier — seulement quand le focus est dans le lecteur", () => {
  it("flèche bas et Page suivante passent à la publication suivante, flèche haut revient", () => {
    renderWithEngine(
      <ImmersiveFeedReader label="Fil en immersion">
        <Post id="p1" />
        <Post id="p2" />
        <Post id="p3" />
      </ImmersiveFeedReader>,
    )
    const like = screen.getByRole("button", { name: "Aimer p1" })
    like.focus()
    expect(fireEvent.keyDown(like, { key: "ArrowDown" })).toBe(false)
    expect(screen.getByRole("article", { name: "Publication p2" })).toHaveFocus()
    fireEvent.keyDown(screen.getByRole("article", { name: "Publication p2" }), { key: "PageDown" })
    expect(screen.getByRole("article", { name: "Publication p3" })).toHaveFocus()
    fireEvent.keyDown(screen.getByRole("article", { name: "Publication p3" }), { key: "ArrowUp" })
    expect(screen.getByRole("article", { name: "Publication p2" })).toHaveFocus()
    expect(Element.prototype.scrollTo).toHaveBeenCalled()
  })

  it("un curseur garde ses flèches : aucun geste ni touche n'est capturé", () => {
    renderWithEngine(
      <ImmersiveFeedReader label="Fil en immersion">
        <Post id="p1" />
        <Post id="p2" />
      </ImmersiveFeedReader>,
    )
    const slider = screen.getByRole("slider", { name: "Curseur p1" })
    slider.focus()
    expect(fireEvent.keyDown(slider, { key: "ArrowDown" })).toBe(true)
    expect(slider).toHaveFocus()
    // Un geste commencé sur le curseur ne déplace rien : le lecteur n'écoute pas le pointeur pour décider.
    fireEvent.pointerDown(slider, { clientX: 10, clientY: 10 })
    fireEvent.pointerMove(slider, { clientX: 10, clientY: 200 })
    fireEvent.pointerUp(slider, { clientX: 10, clientY: 200 })
    expect(slider).toHaveFocus()
  })

  it("une feuille en portail ne pilote jamais le fil, même si ses évènements remontent l'arbre React", () => {
    renderWithEngine(
      <ImmersiveFeedReader label="Fil en immersion">
        <Post id="p1" portal />
        <Post id="p2" />
      </ImmersiveFeedReader>,
    )
    const inPortal = screen.getByRole("button", { name: "Bouton du portail p1" })
    inPortal.focus()
    expect(fireEvent.keyDown(inPortal, { key: "ArrowDown" })).toBe(true)
    expect(inPortal).toHaveFocus()
  })

  it("une touche modifiée reste au navigateur", () => {
    renderWithEngine(
      <ImmersiveFeedReader label="Fil en immersion">
        <Post id="p1" />
        <Post id="p2" />
      </ImmersiveFeedReader>,
    )
    const like = screen.getByRole("button", { name: "Aimer p1" })
    like.focus()
    expect(fireEvent.keyDown(like, { key: "ArrowDown", ctrlKey: true })).toBe(true)
    expect(like).toHaveFocus()
  })

  it("détail ouvert (« Lire la suite ») : le fil ne change pas de publication", () => {
    renderWithEngine(
      <ImmersiveFeedReader label="Fil en immersion">
        <Post id="p1" detailOpen />
        <Post id="p2" />
      </ImmersiveFeedReader>,
    )
    const collapse = screen.getByRole("button", { name: "Réduire p1" })
    collapse.focus()
    expect(fireEvent.keyDown(collapse, { key: "ArrowDown" })).toBe(false)
    expect(collapse).toHaveFocus()
  })
})

describe("fin du lecteur", () => {
  it("« Charger la suite » reste une commande accessible", () => {
    const onLoadMore = vi.fn()
    renderWithEngine(
      <ImmersiveFeedReader label="Fil en immersion" canLoadMore onLoadMore={onLoadMore}>
        <Post id="p1" />
      </ImmersiveFeedReader>,
    )
    fireEvent.click(screen.getByRole("button", { name: "Charger la suite" }))
    expect(onLoadMore).toHaveBeenCalledWith("user")
  })

  it("une page vide AVEC suite n'est pas une fin, et l'avertissement de couverture reste visible", () => {
    renderWithEngine(
      <ImmersiveFeedReader label="Fil en immersion" canLoadMore>
        <Reporter report={{ ...ready, count: 0, lacunar: true }} />
      </ImmersiveFeedReader>,
    )
    expect(screen.getByText("Aucune publication dans cette partie du fil. La suite peut en contenir.")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Charger la suite" })).toBeInTheDocument()
    expect(screen.getByText("Fil incomplet")).toBeInTheDocument()
    expect(screen.getByText("Ce fil est incomplet. Certaines publications peuvent ne pas être affichées.")).toBeInTheDocument()
    expect(screen.queryByText("Vous avez vu toutes les publications disponibles de ce fil.")).toBeNull()
  })

  it("la fin réelle se dit ; une page sans réponse ne conclut rien", async () => {
    const view = renderWithEngine(
      <ImmersiveFeedReader label="Fil en immersion">
        <Post id="p1" />
      </ImmersiveFeedReader>,
    )
    expect(screen.getByText("Chargement de la suite…")).toBeInTheDocument()
    view.rerender(
      <ImmersiveFeedReader label="Fil en immersion" exhausted>
        <Post id="p1" />
      </ImmersiveFeedReader>,
    )
    expect(await screen.findByText("Vous avez vu toutes les publications disponibles de ce fil.")).toBeInTheDocument()
  })

  it("une fin propre à la source (fenêtres par adresse) remplace la fin intégrée", () => {
    renderWithEngine(
      <ImmersiveFeedReader label="Fil en immersion" canLoadMore end={<button type="button">Suivant</button>}>
        <Post id="p1" />
      </ImmersiveFeedReader>,
    )
    expect(screen.getByRole("button", { name: "Suivant" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Charger la suite" })).toBeNull()
  })

  it("après « Charger la suite », le résultat s'annonce et le focus rejoint la première publication ajoutée (réponse tardive)", async () => {
    function LoadHarness() {
      const [pages, setPages] = useState<string[][]>([["p1", "p2"]])
      const [loading, setLoading] = useState(false)
      const report = useMemo<ImmersivePageReport>(() => ({ ...ready, isFirst: pages.length === 1, status: loading ? "loading" : "ready" }), [pages.length, loading])
      return (
        <ImmersiveFeedReader label="Fil en immersion" canLoadMore={!loading && pages.length === 1} exhausted={pages.length > 1 && !loading} onLoadMore={() => setLoading(true)}>
          {pages.flat().map((id) => (
            <Post key={id} id={id} />
          ))}
          <Reporter report={report} />
          {loading ? (
            <button type="button" onClick={() => { setPages((current) => [...current, ["p3", "p4"]]); setLoading(false) }}>
              Réponse de la page
            </button>
          ) : null}
        </ImmersiveFeedReader>
      )
    }
    renderWithEngine(<LoadHarness />)
    await waitFor(() => expect(screen.getByRole("article", { name: "Publication p2" })).toHaveAttribute("aria-posinset", "2"))
    const more = screen.getByRole("button", { name: "Charger la suite" })
    more.focus()
    fireEvent.click(more)
    fireEvent.click(await screen.findByRole("button", { name: "Réponse de la page" }))
    expect(await screen.findByText("2 publications de plus.")).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole("article", { name: "Publication p3" })).toHaveFocus())
  })
})

describe("nouvelles publications reçues pendant la lecture", () => {
  function HeadPage({ ids }: { ids: string[] }) {
    const hidden = useImmersiveFrozenHead(ids)
    const report = useMemo<ImmersivePageReport>(() => ({ ...ready, count: ids.length - hidden, newCount: hidden }), [ids.length, hidden])
    useImmersivePageReport(report)
    return (
      <>
        {ids.slice(hidden).map((id) => (
          <Post key={id} id={id} />
        ))}
      </>
    )
  }

  it("ne s'insèrent pas sous la lecture : une commande dédiée les montre", async () => {
    const view = renderWithEngine(
      <ImmersiveFeedReader label="Fil en immersion">
        <HeadPage ids={["a", "b"]} />
      </ImmersiveFeedReader>,
    )
    view.rerender(
      <ImmersiveFeedReader label="Fil en immersion">
        <HeadPage ids={["n", "a", "b"]} />
      </ImmersiveFeedReader>,
    )
    expect(screen.queryByRole("article", { name: "Publication n" })).toBeNull()
    fireEvent.click(await screen.findByRole("button", { name: "1 nouvelle publication" }))
    expect(await screen.findByRole("article", { name: "Publication n" })).toBeInTheDocument()
    expect(screen.getByText("Retour aux publications les plus récentes.")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "1 nouvelle publication" })).toBeNull()
  })
})

describe("retrait de la publication lue", () => {
  it("le dit, et ne laisse pas le focus dans le vide", async () => {
    const view = renderWithEngine(
      <ImmersiveFeedReader label="Fil en immersion">
        <Post id="p1" />
        <Post id="p2" />
        <Post id="p3" />
      </ImmersiveFeedReader>,
    )
    screen.getByRole("button", { name: "Aimer p2" }).focus()
    view.rerender(
      <ImmersiveFeedReader label="Fil en immersion">
        <Post id="p1" />
        <Post id="p3" />
      </ImmersiveFeedReader>,
    )
    expect(await screen.findByText("Cette publication n'est plus disponible. La lecture continue avec la suivante.")).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole("article", { name: "Publication p3" })).toHaveFocus())
  })
})

describe("retour à la publication lue", () => {
  const target: FeedRestoreTarget = { anchorPostId: "p9", offset: 0, galleryIndex: null, depth: 2 }

  it("recharge la profondeur page par page, attend la réponse, puis rétablit la publication", async () => {
    const onRestored = vi.fn()
    const loads: string[] = []
    function RestoreHarness() {
      const [ids, setIds] = useState(["p1", "p2"])
      const [loading, setLoading] = useState(false)
      return (
        <>
          <ImmersiveFeedReader
            label="Fil en immersion"
            canLoadMore={!loading && !ids.includes("p9")}
            onLoadMore={(reason) => {
              loads.push(reason)
              setLoading(true)
            }}
            restore={target}
            onRestored={onRestored}
          >
            {ids.map((id) => (
              <Post key={id} id={id} />
            ))}
          </ImmersiveFeedReader>
          <button type="button" onClick={() => { setIds((current) => [...current, "p9"]); setLoading(false) }}>
            Page reçue
          </button>
        </>
      )
    }
    renderWithEngine(<RestoreHarness />)
    await waitFor(() => expect(loads).toEqual(["restore"]))
    expect(onRestored).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "Page reçue" }))
    await waitFor(() => expect(onRestored).toHaveBeenCalledWith("found"))
    expect(screen.getByText("Retour à la publication que vous lisiez.")).toBeInTheDocument()
    expect(loads).toEqual(["restore"])
  })

  it("une publication qui a quitté le fil ne bloque rien : la recherche s'arrête", async () => {
    const onRestored = vi.fn()
    renderWithEngine(
      <ImmersiveFeedReader label="Fil en immersion" exhausted restore={target} onRestored={onRestored}>
        <Post id="p1" />
      </ImmersiveFeedReader>,
    )
    await waitFor(() => expect(onRestored).toHaveBeenCalledWith("missing"))
    expect(screen.getByText("La publication que vous lisiez n'est plus dans ce fil.")).toBeInTheDocument()
  })
})
