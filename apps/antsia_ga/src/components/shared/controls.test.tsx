import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { Button, buttonClassName } from "./controls"

describe("variante commerce des boutons (ADR-0027)", () => {
  it("lit la couleur du commerce et garde l'aplat d'identité en repli", () => {
    const classes = buttonClassName("commerce")
    expect(classes).toContain("bg-[var(--role-commerce-fill,var(--primary-fill))]")
    expect(classes).toContain("text-[color:var(--role-commerce-on,var(--primary-fill-on,var(--primary-foreground)))]")
    // Même facture que le bouton principal : seule la couleur change.
    expect(classes).toContain("min-h-11")
    expect(classes).not.toContain("bg-[var(--primary-fill)]")
  })

  it("laisse le bouton principal sur l'aplat d'identité", () => {
    expect(buttonClassName()).toContain("bg-[var(--primary-fill)]")
    expect(buttonClassName()).not.toContain("--role-commerce-fill")
  })

  it("applique la variante au composant Button", () => {
    const html = renderToStaticMarkup(<Button variant="commerce">Commander</Button>)
    expect(html).toContain("--role-commerce-fill")
  })
})

describe("variantes des messages (ADR-0027)", () => {
  it("met Écrire en tonal des messages, carte et encre d'identité en repli", () => {
    const classes = buttonClassName("message")
    expect(classes).toContain("bg-[var(--role-message-soft,var(--card))]")
    expect(classes).toContain("text-[color:var(--role-message-ink,var(--primary))]")
    // Le filet prend le fond tonal : aucun contour visible quand le thème déclare la couleur.
    expect(classes).toContain("border-[color:var(--role-message-soft,var(--border))]")
    expect(classes).toContain("min-h-11")
    expect(classes).not.toContain("--role-message-fill")
  })

  it("met Envoyer à l'aplat des messages, l'aplat d'identité en repli", () => {
    const classes = buttonClassName("send")
    expect(classes).toContain("bg-[var(--role-message-fill,var(--primary-fill))]")
    expect(classes).toContain("text-[color:var(--role-message-on,var(--primary-fill-on,var(--primary-foreground)))]")
    expect(classes).not.toContain("bg-[var(--primary-fill)]")
    expect(classes).not.toContain("--role-message-soft")
  })

  it("applique les deux variantes au composant Button", () => {
    expect(renderToStaticMarkup(<Button variant="message">Écrire</Button>)).toContain("--role-message-soft")
    expect(renderToStaticMarkup(<Button variant="send">Envoyer</Button>)).toContain("--role-message-fill")
  })
})
