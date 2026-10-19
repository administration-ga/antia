// Dupliqué de socle/packages/agent-features/src/features/iagenda/agenda-create-intent.test.ts @ ad2e7fdc2 — adaptations : la base est INJECTÉE (l'adresse de la page réseau des routes de test) au lieu des deux préfixes (espace personnel, iAgenda) écrits en dur ; l'adresse construite vise le volet Évènements de la page réseau ; tous les cas de refus du socle portés (schémas, protocol-relative, anti-slash, espaces, hors base, borne, vide) ; cas ajoutés pour une application servie à la racine et pour l'adresse nettoyée après consommation.
/**
 * agenda-create-intent — l'intention de création et son retour (R-16).
 *
 * Le paramètre `retour` est un vecteur d'open redirect : la moitié de ce
 * fichier ne teste que des REFUS, et c'est voulu.
 */
import { describe, expect, it } from "vitest"

import {
  AGENDA_CREATE_CONSUMED_PARAMS,
  AGENDA_CREATE_EVENT_VALUE,
  AGENDA_CREATE_PARAM,
  AGENDA_RETURN_PARAM,
  agendaCreateConsumedHref,
  buildAgendaCreateHref,
  isSafeReturnPath,
  parseAgendaCreateIntent,
} from "./agenda-create-intent"

/** La page réseau, telle que l'application l'injecte (`useRoutes().home()`) — ici, celle des routes de test. */
const HOME = "/fil"
/** Le volet Évènements de cette page. */
const EVENTS = `${HOME}?tab=evenements`

const params = (query: string) => new URLSearchParams(query)

describe("isSafeReturnPath — fermé par défaut", () => {
  it("accepte un chemin interne sous la page réseau", () => {
    expect(isSafeReturnPath(HOME, HOME)).toBe(true)
    expect(isSafeReturnPath(EVENTS, HOME)).toBe(true)
    expect(isSafeReturnPath(`${HOME}/sous-vue`, HOME)).toBe(true)
    expect(isSafeReturnPath(`${HOME}?tab=groupes&groupe=g1#mur`, HOME)).toBe(true)
  })

  it("refuse une URL absolue ou protocol-relative", () => {
    expect(isSafeReturnPath("//evil.example", HOME)).toBe(false)
    expect(isSafeReturnPath(`//evil.example${HOME}`, HOME)).toBe(false)
    expect(isSafeReturnPath(`https://evil.example${HOME}`, HOME)).toBe(false)
    expect(isSafeReturnPath(`http://localhost:3030${HOME}`, HOME)).toBe(false)
  })

  it("refuse un schéma exécutable", () => {
    expect(isSafeReturnPath("javascript:alert(1)", HOME)).toBe(false)
    expect(isSafeReturnPath("JavaScript:alert(1)", HOME)).toBe(false)
    expect(isSafeReturnPath("data:text/html,<script>", HOME)).toBe(false)
  })

  it("refuse les contournements par caractère", () => {
    // Un anti-slash est lu comme un slash par plusieurs navigateurs.
    expect(isSafeReturnPath("/\\evil.example", HOME)).toBe(false)
    expect(isSafeReturnPath(`${HOME}\\..\\..`, HOME)).toBe(false)
    // Espace, tabulation, caractère de contrôle.
    expect(isSafeReturnPath(` ${HOME}`, HOME)).toBe(false)
    expect(isSafeReturnPath(`${HOME} ?tab=fil`, HOME)).toBe(false)
    expect(isSafeReturnPath("	javascript:alert(1)", HOME)).toBe(false)
  })

  it("refuse un chemin interne HORS de la page réseau", () => {
    expect(isSafeReturnPath("/messages", HOME)).toBe(false)
    expect(isSafeReturnPath("/", HOME)).toBe(false)
    // La BORNE : un préfixe n'est pas un début de mot.
    expect(isSafeReturnPath(`${HOME}x`, HOME)).toBe(false)
    expect(isSafeReturnPath(`${HOME}x/y`, HOME)).toBe(false)
  })

  it("refuse le vide et le non-chemin", () => {
    expect(isSafeReturnPath(null, HOME)).toBe(false)
    expect(isSafeReturnPath(undefined, HOME)).toBe(false)
    expect(isSafeReturnPath("", HOME)).toBe(false)
    expect(isSafeReturnPath(HOME.slice(1), HOME)).toBe(false)
  })

  it("une application servie à la RACINE accepte tout chemin interne — et rien de plus", () => {
    expect(isSafeReturnPath("/profil/awa", "/")).toBe(true)
    expect(isSafeReturnPath("/", "/")).toBe(true)
    expect(isSafeReturnPath("//evil.example", "/")).toBe(false)
    expect(isSafeReturnPath("https://evil.example", "/")).toBe(false)
  })
})

describe("parseAgendaCreateIntent", () => {
  it("lit l'intention et son retour", () => {
    const intent = parseAgendaCreateIntent(
      params(`${AGENDA_CREATE_PARAM}=${AGENDA_CREATE_EVENT_VALUE}&${AGENDA_RETURN_PARAM}=${encodeURIComponent(EVENTS)}`),
      HOME,
    )
    expect(intent.create).toBe("evenement")
    expect(intent.returnTo).toBe(EVENTS)
  })

  it("ignore une valeur d'intention inconnue", () => {
    const intent = parseAgendaCreateIntent(params(`${AGENDA_CREATE_PARAM}=reunion&${AGENDA_RETURN_PARAM}=${HOME}`), HOME)
    expect(intent.create).toBeNull()
    expect(intent.returnTo).toBeNull()
  })

  it("laisse tomber un retour refusé sans annuler l'intention", () => {
    const intent = parseAgendaCreateIntent(
      params(`${AGENDA_CREATE_PARAM}=${AGENDA_CREATE_EVENT_VALUE}&${AGENDA_RETURN_PARAM}=${encodeURIComponent("https://evil.example")}`),
      HOME,
    )
    expect(intent.create).toBe("evenement")
    expect(intent.returnTo).toBeNull()
  })

  it("ne retient pas un retour ORPHELIN", () => {
    const intent = parseAgendaCreateIntent(params(`${AGENDA_RETURN_PARAM}=${HOME}`), HOME)
    expect(intent.create).toBeNull()
    expect(intent.returnTo).toBeNull()
  })

  it("ne lit rien d'une URL nue", () => {
    expect(parseAgendaCreateIntent(params("tab=evenements"), HOME)).toEqual({ create: null, returnTo: null })
  })
})

describe("buildAgendaCreateHref", () => {
  it("vise le volet Évènements de la page réseau, encode le retour, et l'aller-retour se relit", () => {
    const href = buildAgendaCreateHref(EVENTS, HOME)
    expect(href.startsWith(`${EVENTS}&`)).toBe(true)
    const relu = parseAgendaCreateIntent(new URLSearchParams(href.slice(href.indexOf("?") + 1)), HOME)
    expect(relu).toEqual({ create: "evenement", returnTo: EVENTS })
    // Le `?` du retour est ENCODÉ, sinon il ouvrirait un second paramètre.
    expect(href).toContain(`retour=${encodeURIComponent(EVENTS)}`)
  })

  it("ouvre quand même la composition quand le retour est refusé", () => {
    for (const mauvais of ["//evil.example", "https://evil.example", "javascript:x", null, undefined]) {
      const href = buildAgendaCreateHref(mauvais, HOME)
      expect(href).toBe(`${EVENTS}&nouveau=evenement`)
      expect(parseAgendaCreateIntent(new URLSearchParams(href.slice(href.indexOf("?") + 1)), HOME).returnTo).toBeNull()
    }
  })
})

describe("la consommation de l'intention", () => {
  it("retire les DEUX paramètres — un retour orphelin se rejouerait", () => {
    expect(AGENDA_CREATE_CONSUMED_PARAMS).toEqual({
      [AGENDA_CREATE_PARAM]: null,
      [AGENDA_RETURN_PARAM]: null,
    })
  })

  it("l'adresse nettoyée garde le volet ouvert et le reste de la query", () => {
    const query = params(`tab=evenements&${AGENDA_CREATE_PARAM}=${AGENDA_CREATE_EVENT_VALUE}&${AGENDA_RETURN_PARAM}=${encodeURIComponent(EVENTS)}`)
    expect(agendaCreateConsumedHref(HOME, query)).toBe(EVENTS)
    expect(agendaCreateConsumedHref(HOME, params(`${AGENDA_CREATE_PARAM}=${AGENDA_CREATE_EVENT_VALUE}`))).toBe(HOME)
  })
})
