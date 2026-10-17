import { describe, expect, it } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import type { PublicPost } from "@antsia/social-contracts/publicNetwork"
import { PublicPostCard } from "./public-post-card"
import { PublicFeed } from "./public-feed"

const post: PublicPost = { id: "visible", body: "<script>forbidden()</script> #gabon @alice", publishedAt: 1_700_000_000_000, editedAt: null, tags: ["gabon"], province: null, author: { kind: "person", handle: null, displayName: null, badges: [], avatarUrl: null }, origin: { slug: "diasporale", name: "DIASPORALE" }, media: [{ kind: "image", mimeType: "image/png", url: "https://media.example/withheld", withheld: "fileQuarantined" }], shared: { available: false } }

describe("carte publique serveur", () => {
  it("rend texte, identité neutre et origine en HTML initial sans HTML usager ni URL retenue", () => {
    const html = renderToStaticMarkup(<PublicPostCard post={post} locale="fr" />)
    expect(html).toContain("&lt;script&gt;")
    expect(html).not.toContain("<script>")
    expect(html).toContain("Profil non publié")
    expect(html).toContain("Origine : DIASPORALE")
    expect(html).toContain('href="/tags/gabon"')
    expect(html).not.toContain("media.example/withheld")
    expect(html).toContain("originale n’est plus disponible")
    expect(html).not.toContain("toggleReaction")
  })
  it("montre l'origine du partage original et conserve la continuation d'une fenêtre vide", () => {
    const shared: PublicPost = { ...post, shared: { available: true, id: "original", body: "Source publique", publishedAt: post.publishedAt, author: post.author, origin: { slug: "antsia", name: "ANTSIA" }, media: [] } }
    expect(renderToStaticMarkup(<PublicPostCard post={shared} locale="en" />)).toContain("Origin: ANTSIA")
    const html = renderToStaticMarkup(<PublicFeed result={{ status: "ready", viewer: "anonymous", data: { page: [], isDone: false, continueCursor: "next=opaque" } }} locale="fr" base="/decouvrir" />)
    expect(html).toContain("fenêtre")
    expect(html).toContain("cursor=next%3Dopaque")
    expect(html).toContain("Page suivante")
  })
})
