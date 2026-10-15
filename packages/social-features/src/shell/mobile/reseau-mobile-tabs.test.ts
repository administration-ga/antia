// Dupliqué de socle/packages/agent-features/src/features/reseau-personnel/mobile/reseau-mobile-tabs.test.ts @ ad2e7fdc2 — adaptations : adresses et vues immersives jugées sur une table de routes INJECTÉE (celle du test) au lieu des chemins de l'espace — « Actus » et les lieux hors de la page réseau compris (statuts, messagerie et conférence lus sur la table, « iRéseau » devenu « la page réseau ») ; libellés lus par leurs clés dans l'i18n du moteur ; menu bâti sur des destinations au lieu de la navigation personnelle du socle (`personal-nav` retirée) — les cas qui la vérifiaient (entrées gardées, icône d'une entrée inconnue, non-mutation, menu réel) sont portés sur les destinations ; cliquet de parité RÉTABLI au lot F2 sur `shell/mobile/ReseauMobilePage.tsx`, relue commentaires ôtés (trois cas) — chaque panneau du contrat garde son `case` (switch exhaustif, « Conférences » compris) et le panneau monté est celui du volet MONTRÉ : tout volet est rabattu sur un volet SERVI (`servedReseauTab`) dont la branche rend un composant, « Conférences » n'étant pas servi tant que le direct n'existe pas ; cas ajoutés : page réseau à la racine, query et ancre ignorées, composeur qui n'est qu'une feuille, destination absente retirée.
import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import { createAppI18n } from "../../i18n"
import { mainPanelFor, RESEAU_AGENT_TAB_IDS, reseauAgentHref } from "../reseau-agent-nav"
import { RESEAU_SERVED_TAB_IDS, servedReseauTab } from "../reseau-menu"
import {
  activeReseauTab,
  defaultReseauMenuSections,
  isImmersiveRoute,
  RESEAU_MOBILE_TAB_IDS,
  RESEAU_MOBILE_TABS,
  reseauMobileMenuSections,
  reseauMenuSections,
  reseauTabHref,
  shouldShowTabBar,
  tabBadge,
  type ReseauMenuDestinations,
  type ReseauMenuFlags,
  type ReseauMenuSection,
  type ReseauMobileRoutes,
} from "./reseau-mobile-tabs"

const t = createAppI18n({ locale: "fr", appResources: { fr: {}, en: {} }, defaultNS: "reseau" }).getFixedT("fr")

/** Une table de routes de test : l'application seule sait ses adresses. */
const ROUTES: ReseauMobileRoutes = {
  home: () => "/accueil",
  messages: () => "/messages",
  stories: () => "/actus",
  conference: (sessionId) => `/conference/${sessionId}`,
}
const HOME = ROUTES.home()

const DESTINATIONS: ReseauMenuDestinations = Object.freeze({
  home: HOME,
  stories: ROUTES.stories(),
  profile: "/profil/awa.ndong",
  settings: "/reglages",
})

const NO_FLAGS: ReseauMenuFlags = {
  pages: false,
  directs: false,
  evenements: false,
  enregistrements: false,
}

const ALL_FLAGS: ReseauMenuFlags = {
  pages: true,
  directs: true,
  evenements: true,
  enregistrements: true,
}

const urlsOf = (sections: ReseauMenuSection[]) => sections.flatMap((section) => section.items.map((item) => item.url))

describe("reseau-mobile-tabs — la géométrie de la barre", () => {
  it("reprend TOUS les vrais volets du réseau", () => {
    expect(RESEAU_MOBILE_TAB_IDS).toEqual(RESEAU_AGENT_TAB_IDS)
    expect(RESEAU_MOBILE_TABS).toHaveLength(RESEAU_AGENT_TAB_IDS.length)
  })

  it("décrit chaque identifiant exactement une fois, dans l'ordre", () => {
    expect(RESEAU_MOBILE_TABS.map((tab) => tab.id)).toEqual([...RESEAU_MOBILE_TAB_IDS])
    expect(new Set(RESEAU_MOBILE_TABS.map((tab) => tab.id)).size).toBe(RESEAU_MOBILE_TABS.length)
  })

  it("nomme chaque sous-menu comme le volet réel, jamais Réseau pour Relations", () => {
    expect(RESEAU_MOBILE_TABS.map((tab) => t(tab.shortLabelKey))).toEqual([
      "Fil",
      "Relations",
      "Groupes",
      "Pages",
      "Conférences",
      "Évènements",
      "Signets",
    ])
    for (const id of RESEAU_MOBILE_TAB_IDS) {
      expect(reseauTabHref(id, HOME)).toBe(reseauAgentHref(id, HOME))
    }
  })

  it("donne à chaque onglet un libellé court non vide", () => {
    for (const tab of RESEAU_MOBILE_TABS) {
      expect(t(tab.labelKey).length).toBeGreaterThan(0)
      expect(t(tab.shortLabelKey).length).toBeGreaterThan(0)
      expect(tab.icon.length).toBeGreaterThan(0)
    }
  })

  it("ne porte ni Messages ni Actus — la messagerie a son entrée, les statuts leur menu", () => {
    expect(RESEAU_MOBILE_TAB_IDS).not.toContain("messages")
    expect(RESEAU_MOBILE_TAB_IDS).not.toContain("stories")
    // Le relevé des notifications est le contenu de la cloche de l'en-tête,
    // pas un onglet de la barre.
    expect(RESEAU_MOBILE_TAB_IDS as readonly string[]).not.toContain("activite")
  })

  it("mène chaque sous-menu à son VOLET, jamais à une page inventée", () => {
    expect(reseauTabHref("fil", HOME)).toBe(HOME)
    expect(reseauTabHref("relations", HOME)).toBe(`${HOME}?tab=relations`)
    expect(reseauTabHref("enregistrements", HOME)).toBe(`${HOME}?tab=enregistrements`)
    expect(reseauTabHref("groupes", HOME)).toBe(`${HOME}?tab=groupes`)
  })
})

/**
 * Le pilote mobile de la page réseau, commentaires ôtés : ce cliquet vérifie du
 * CODE — un commentaire qui cite un `case` ne le rend pas.
 */
const MOBILE_PAGE_SOURCE = readFileSync(new URL("./ReseauMobilePage.tsx", import.meta.url), "utf8")
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^\s*\/\/[^\n]*$/gm, "")

/** Le corps de la branche `case "<panneau>":` du switch des panneaux, jusqu'à la suivante. */
function caseBranch(panel: string): string {
  const label = `case "${panel}":`
  const start = MOBILE_PAGE_SOURCE.indexOf(label)
  if (start === -1) return ""
  const rest = MOBILE_PAGE_SOURCE.slice(start + label.length)
  const end = rest.search(/\bcase "|\bdefault:/)
  return end === -1 ? rest : rest.slice(0, end)
}

describe("ReseauMobilePage — parité des volets", () => {
  it("rend explicitement chaque panneau métier du contrat de navigation", () => {
    const panels = RESEAU_AGENT_TAB_IDS.map((tab) => mainPanelFor(tab))
    expect(new Set(panels).size).toBe(RESEAU_AGENT_TAB_IDS.length)
    for (const panel of panels) {
      expect(MOBILE_PAGE_SOURCE).toContain(`case "${panel}":`)
    }
    // Le panneau monté est celui du volet MONTRÉ. Un volet que le moteur ne
    // sert pas encore (« Conférences », en attente du direct) garde son
    // `case` — le switch reste exhaustif — mais n'est jamais atteint : il est
    // rabattu sur un volet servi, dont la branche rend un composant.
    expect(MOBILE_PAGE_SOURCE).toContain("const shownTab = servedReseauTab(tab)")
    expect(MOBILE_PAGE_SOURCE).toContain("const main = mainPanelFor(shownTab)")
    for (const tab of RESEAU_AGENT_TAB_IDS) {
      const shown = servedReseauTab(tab)
      expect(RESEAU_SERVED_TAB_IDS).toContain(shown)
      expect(caseBranch(mainPanelFor(shown))).toMatch(/return\s*\(?\s*</)
    }
  })

  it("ne retombe sur AUCUN panneau par défaut", () => {
    // Le `switch` exhaustif reste le garde-fou : un panneau ajouté au contrat
    // fait échouer le typage tant que son rendu mobile n'est pas décidé.
    expect(MOBILE_PAGE_SOURCE).toContain("return assertNeverMobilePanel(main)")
  })

  it("ne monte PLUS le panneau d'activité — la cloche l'a repris (R-03)", () => {
    expect(MOBILE_PAGE_SOURCE).not.toContain("<NotificationsPanel")
    expect(MOBILE_PAGE_SOURCE).not.toContain('case "activity":')
  })
})

describe("reseau-mobile-tabs — quel onglet est actif", () => {
  it("allume le Fil sur la page réseau nue et sur le volet fil", () => {
    expect(activeReseauTab(HOME, null, HOME)).toBe("fil")
    expect(activeReseauTab(HOME, "fil", HOME)).toBe("fil")
    expect(activeReseauTab(`${HOME}/`, null, HOME)).toBe("fil")
  })

  it("ramène les anciens liens d'Activité sur le Fil", () => {
    // L'onglet n'existe pas ; la cloche s'ouvre par-dessus le fil, cf.
    // `legacyNotificationsRequested`. Ce qui compte ici : aucun de ces liens
    // n'allume un onglet fantôme.
    expect(activeReseauTab(HOME, "activite", HOME)).toBe("fil")
    expect(activeReseauTab(HOME, "activity", HOME)).toBe("fil")
    expect(activeReseauTab(HOME, "notifications", HOME)).toBe("fil")
  })

  it("allume Relations et chacun des autres volets réels", () => {
    expect(activeReseauTab(HOME, "relations", HOME)).toBe("relations")
    expect(activeReseauTab(HOME, "groupes", HOME)).toBe("groupes")
    expect(activeReseauTab(HOME, "pages", HOME)).toBe("pages")
    expect(activeReseauTab(HOME, "conferences", HOME)).toBe("conferences")
    expect(activeReseauTab(HOME, "reseau", HOME)).toBe("relations")
  })

  it("n'allume aucun onglet sur Actus, qui est immersive", () => {
    // Les statuts — la liste comme chacun d'eux — occupent l'écran entier, au
    // jugement de la table de routes elle-même.
    const actus = ROUTES.stories()
    for (const path of [actus, `${actus}/abc`]) {
      expect(isImmersiveRoute(path, ROUTES)).toBe(true)
      expect(activeReseauTab(path, null, HOME)).toBeNull()
    }
  })

  it("n'allume rien hors de la page réseau ni sur les lieux sans onglet", () => {
    expect(activeReseauTab("/profil/awa.ndong", null, HOME)).toBeNull()
    expect(activeReseauTab(ROUTES.conference("1"), null, HOME)).toBeNull()
    expect(activeReseauTab(`${HOME}/pages`, null, HOME)).toBeNull()
    // La messagerie a sa propre barre : celle-ci n'y est pas rendue.
    expect(activeReseauTab(ROUTES.messages(), null, HOME)).toBeNull()
    expect(activeReseauTab(null, null, HOME)).toBeNull()
  })

  it("reconnaît une page réseau servie à la RACINE de l'application", () => {
    expect(activeReseauTab("/", "relations", "/")).toBe("relations")
    expect(activeReseauTab("/?tab=groupes", "groupes", "/")).toBe("groupes")
    expect(activeReseauTab("/messages", null, "/")).toBeNull()
  })
})

describe("reseau-mobile-tabs — les pastilles", () => {
  it("n'en pose AUCUNE : le décompte vit sur la cloche", () => {
    // Deux surfaces pour un chiffre, ce serait deux états de lecture à tenir
    // d'accord.
    for (const id of RESEAU_MOBILE_TAB_IDS) {
      expect(tabBadge(id, { unreadNotifications: 7 })).toBeNull()
      expect(tabBadge(id, { unreadNotifications: 0 })).toBeNull()
      expect(tabBadge(id, {})).toBeNull()
    }
  })
})

describe("reseau-mobile-tabs — quand la barre s'efface", () => {
  it("reste en place sur les lieux du réseau", () => {
    expect(shouldShowTabBar(HOME, ROUTES)).toBe(true)
    expect(shouldShowTabBar("/messages", ROUTES)).toBe(true)
    expect(shouldShowTabBar("/conference", ROUTES)).toBe(true)
    expect(shouldShowTabBar("/profil/awa.ndong", ROUTES)).toBe(true)
    expect(shouldShowTabBar(null, ROUTES)).toBe(true)
  })

  it("s'efface sur toute vue immersive", () => {
    expect(shouldShowTabBar("/actus", ROUTES)).toBe(false)
    expect(shouldShowTabBar("/actus/1", ROUTES)).toBe(false)
    expect(shouldShowTabBar("/messages/chat/1", ROUTES)).toBe(false)
    expect(shouldShowTabBar("/messages/nouveau", ROUTES)).toBe(false)
    expect(shouldShowTabBar("/messages/nouveau-groupe", ROUTES)).toBe(false)
    expect(shouldShowTabBar("/conference/1", ROUTES)).toBe(false)
  })

  it("juge le CHEMIN : la query et l'ancre ne changent pas de page", () => {
    expect(shouldShowTabBar("/messages?brique=relations", ROUTES)).toBe(true)
    expect(shouldShowTabBar("/messages/groupe/7?retour=1#fin", ROUTES)).toBe(false)
    expect(shouldShowTabBar("/actus/", ROUTES)).toBe(false)
  })

  it("ne prend pour composeur qu'une FEUILLE, et pour conversation que deux segments", () => {
    expect(isImmersiveRoute("/messages/nouveau/brouillon", ROUTES)).toBe(false)
    expect(isImmersiveRoute("/messages/chat", ROUTES)).toBe(false)
    expect(isImmersiveRoute("/messages/chat/1/details", ROUTES)).toBe(false)
    // Un SEGMENT entier : `/messagerie` n'est pas `/messages`.
    expect(isImmersiveRoute("/messagerie/chat/1", ROUTES)).toBe(false)
    expect(isImmersiveRoute("/actualites", ROUTES)).toBe(false)
  })
})

describe("reseau-mobile-tabs — le menu", () => {
  it("ouvre sur la section du réseau, et elle seule", () => {
    const sections = reseauMenuSections(DESTINATIONS, NO_FLAGS)
    expect(sections.map((section) => t(section.labelKey))).toEqual(["Réseau"])
  })

  it("porte les statuts et les Groupes — surfaces secondaires accessibles au menu", () => {
    const urls = urlsOf(reseauMenuSections(DESTINATIONS, NO_FLAGS))
    expect(urls).toContain(DESTINATIONS.stories)
    expect(urls).toContain(`${HOME}?tab=groupes`)
  })

  it("distingue le menu des sous-menus déjà visibles", () => {
    const sections = reseauMobileMenuSections(DESTINATIONS, ALL_FLAGS)
    expect(sections.map((section) => t(section.labelKey))).toEqual(["Autres dans le réseau"])
    const urls = urlsOf(sections)
    for (const id of RESEAU_MOBILE_TAB_IDS) {
      expect(urls).not.toContain(reseauTabHref(id, HOME))
    }
    expect(urls).toContain(DESTINATIONS.stories)
    expect(urls).toContain(DESTINATIONS.profile)
  })

  it("RETIRE une entrée dont le drapeau est faux — jamais un lien mort", () => {
    const closedUrls = urlsOf(reseauMenuSections(DESTINATIONS, NO_FLAGS))
    expect(closedUrls).not.toContain(reseauAgentHref("pages", HOME))
    expect(closedUrls).not.toContain(reseauAgentHref("conferences", HOME))
    expect(closedUrls).not.toContain(reseauAgentHref("evenements", HOME))
    expect(closedUrls).not.toContain(reseauAgentHref("enregistrements", HOME))
  })

  it("ajoute chaque entrée dès que son drapeau est vrai", () => {
    const open = reseauMenuSections(DESTINATIONS, ALL_FLAGS)
    const openUrls = urlsOf(open)
    expect(openUrls).toContain(reseauAgentHref("pages", HOME))
    expect(openUrls).toContain(reseauAgentHref("conferences", HOME))
    expect(openUrls).toContain(reseauAgentHref("evenements", HOME))
    expect(openUrls).toContain(reseauAgentHref("enregistrements", HOME))
    const conferences = open.flatMap((section) => section.items).find((item) => item.url === reseauAgentHref("conferences", HOME))
    expect(conferences && t(conferences.labelKey)).toBe("Conférences")
  })

  it("n'ouvre un drapeau qu'un à la fois — les quatre sont indépendants", () => {
    const urls = urlsOf(reseauMenuSections(DESTINATIONS, { ...NO_FLAGS, pages: true }))
    expect(urls).toContain(reseauAgentHref("pages", HOME))
    expect(urls).not.toContain(reseauAgentHref("conferences", HOME))
  })

  it("adresse les volets en `?tab=`, JAMAIS en fausse route", () => {
    // Un volet est un `?tab=` sur la page réseau (l'adresse canonique) ;
    // seules les ENTITÉS ont une route à elles — une page, une conférence.
    const urls = urlsOf(reseauMenuSections(DESTINATIONS, ALL_FLAGS))
    for (const dead of ["pages", "direct", "evenements", "enregistrements"]) {
      expect(urls).not.toContain(`${HOME}/${dead}`)
    }
    // Et chaque volet cité mène bien au volet qu'il annonce.
    for (const tab of ["pages", "conferences", "evenements", "enregistrements"] as const) {
      expect(urls).toContain(`${HOME}?tab=${tab}`)
    }
  })

  it("livre les quatre volets par DÉFAUT — le menu réel les porte", () => {
    // Un drapeau resté à `false` rendrait le volet inatteignable au
    // téléphone, sans que rien ne le signale.
    const urls = urlsOf(defaultReseauMenuSections(DESTINATIONS))
    expect(urls).toContain(reseauAgentHref("pages", HOME))
    expect(urls).toContain(reseauAgentHref("conferences", HOME))
    expect(urls).toContain(reseauAgentHref("evenements", HOME))
    expect(urls).toContain(reseauAgentHref("enregistrements", HOME))
  })

  it("porte le profil et les réglages — les deux destinations de compte", () => {
    const sections = reseauMenuSections(DESTINATIONS, NO_FLAGS)
    const urls = urlsOf(sections)
    expect(urls).toContain(DESTINATIONS.profile)
    expect(urls).toContain(DESTINATIONS.settings)
    const labels = sections.flatMap((section) => section.items).map((item) => t(item.labelKey))
    expect(labels).toContain("Mon profil")
    expect(labels).toContain("Paramètres")
  })

  it("RETIRE le profil et les réglages tant que leur adresse manque", () => {
    const urls = urlsOf(reseauMenuSections({ ...DESTINATIONS, profile: null, settings: null }, ALL_FLAGS))
    expect(urls).not.toContain(DESTINATIONS.profile)
    expect(urls).not.toContain(DESTINATIONS.settings)
    expect(urls).toContain(DESTINATIONS.stories)
  })

  it("ne porte AUCUN lien vers la page réseau — c'est la page qu'on regarde", () => {
    for (const flags of [NO_FLAGS, ALL_FLAGS]) {
      expect(urlsOf(reseauMenuSections(DESTINATIONS, flags))).not.toContain(HOME)
      // Même si une destination y mène par erreur.
      expect(urlsOf(reseauMenuSections({ ...DESTINATIONS, settings: HOME }, flags))).not.toContain(HOME)
    }
  })

  it("ne porte AUCUNE URL en double, drapeaux ouverts ou fermés", () => {
    for (const flags of [NO_FLAGS, ALL_FLAGS]) {
      const urls = urlsOf(reseauMenuSections(DESTINATIONS, flags))
      expect(new Set(urls).size).toBe(urls.length)
    }
  })

  it("garde le profil une seule fois, même si une destination le répète", () => {
    const sections = reseauMenuSections({ ...DESTINATIONS, settings: DESTINATIONS.profile }, NO_FLAGS)
    const profilCount = sections.flatMap((section) => section.items).filter((item) => item.url === DESTINATIONS.profile).length
    expect(profilCount).toBe(1)
  })

  it("donne une icône et un libellé à chaque entrée", () => {
    for (const item of defaultReseauMenuSections(DESTINATIONS).flatMap((section) => section.items)) {
      expect(item.icon.length).toBeGreaterThan(0)
      expect(t(item.labelKey)).not.toBe(item.labelKey.replace(/^reseau:/, ""))
    }
  })

  it("rend le menu réel sans route morte ni doublon", () => {
    const urls = urlsOf(defaultReseauMenuSections(DESTINATIONS))
    expect(urls).not.toContain(`${HOME}/pages`)
    expect(new Set(urls).size).toBe(urls.length)
  })

  it("ne mute pas les destinations reçues", () => {
    // `DESTINATIONS` est gelé : une écriture y lèverait.
    expect(() => reseauMenuSections(DESTINATIONS, ALL_FLAGS)).not.toThrow()
    expect(DESTINATIONS.home).toBe(HOME)
  })
})
