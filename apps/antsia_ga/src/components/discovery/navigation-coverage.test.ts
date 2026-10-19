/**
 * P02 — AUCUNE destination d'avant ne devient introuvable.
 *
 * Le tableau « avant » est celui des liens servis avant la navigation par
 * destinations (barre du haut, rail et barre « Menu » du fil, feuille « Menu »,
 * porte d'iCom, pastille du profil). Le tableau « après » se calcule sur les
 * MODÈLES que les écrans rendent (destinations du moteur, volets du rail,
 * pages Découvrir et Profil, choix « Créer ») — les tests d'écran vérifient
 * que chacun rend son modèle, ce test-ci que l'union couvre l'avant.
 */
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

import { reseauAgentHref, RESEAU_AGENT_TAB_IDS } from "@antsia/social-features/shell/reseau-agent-nav"
import { menuItemsFor } from "@antsia/social-features/shell/reseau-menu"
import { destinationRoutesOf, reseauCreationChoices, reseauDestinations, type ReseauDestinationRoutes } from "@antsia/social-features/shell/reseau-menu-destinations"
import { GABON_PROVINCES } from "@antsia/social-domain/provinces"
import { describe, expect, it } from "vitest"

import { meEntries } from "@/app/(membre)/moi/me-model"
import { engineRoutes, routes } from "@/lib/routes"
import { discoverHrefs } from "./discover-model"

const HANDLE = "awa.ndong"
const destinationRoutes = destinationRoutesOf(engineRoutes) as ReseauDestinationRoutes

/** Ce qu'on atteignait AVANT, en un geste ou deux, depuis une page de membre. */
const BEFORE: readonly { what: string; href: string }[] = [
  { what: "marque (retour au fil)", href: routes.feed() },
  { what: "Mon fil (préférences du fil)", href: routes.feedPreferences() },
  { what: "fil national", href: routes.nationalFeed() },
  ...GABON_PROVINCES.map((province) => ({ what: `province ${province.name}`, href: routes.memberProvince(province.slug) })),
  { what: "découverte publique", href: routes.discover() },
  { what: "modération", href: routes.moderation() },
  { what: "messages (iCom)", href: routes.messages() },
  { what: "mon profil", href: routes.profile(HANDLE) },
  { what: "mes données (identité, réglages du rail et du menu)", href: routes.personalControls() },
  { what: "actus (feuille « Menu »)", href: routes.stories() },
  ...RESEAU_AGENT_TAB_IDS.map((tab) => ({ what: `volet ${tab}`, href: reseauAgentHref(tab, routes.feed()) })),
  { what: "ancienne adresse des groupes", href: routes.memberTab("groupes") },
  { what: "ancienne adresse des évènements", href: routes.memberTab("evenements") },
]

/** Le TÉLÉPHONE : barre des cinq destinations, pages Découvrir et Profil, choix « Créer », marque. */
function phoneHrefs(): Set<string> {
  return new Set([
    routes.feed(),
    ...reseauDestinations(destinationRoutes).flatMap((destination) => (destination.href === null ? [] : [destination.href])),
    ...discoverHrefs(),
    ...meEntries(HANDLE).map((entry) => entry.href),
    ...reseauCreationChoices({ handle: HANDLE, liveAvailable: true }, destinationRoutes).flatMap((choice) => (choice.href === null ? [] : [choice.href])),
  ])
}

/** Le BUREAU : tout ce que porte le téléphone, plus les volets du rail (sans le Fil, déjà destination). */
function desktopHrefs(): Set<string> {
  return new Set([...phoneHrefs(), ...menuItemsFor({}, routes.feed()).filter((item) => item.id !== "fil").map((item) => item.href)])
}

describe("P02 — tableau avant/après des destinations", () => {
  it("au téléphone, chaque destination d'avant reste atteignable", () => {
    const after = phoneHrefs()
    expect(BEFORE.filter((entry) => !after.has(entry.href)).map((entry) => entry.what)).toEqual([])
  })

  it("au bureau aussi — et le rail garde les volets à un geste", () => {
    const after = desktopHrefs()
    expect(BEFORE.filter((entry) => !after.has(entry.href)).map((entry) => entry.what)).toEqual([])
    for (const tab of ["relations", "groupes", "pages", "conferences", "evenements", "enregistrements"] as const) {
      expect(menuItemsFor({}, routes.feed()).map((item) => item.href)).toContain(reseauAgentHref(tab, routes.feed()))
    }
  })

  it("les cinq destinations sont les mêmes aux deux formats, et chacune a son adresse servie (sauf Créer)", () => {
    const destinations = reseauDestinations(destinationRoutes)
    expect(destinations.map((destination) => destination.id)).toEqual(["fil", "decouvrir", "creer", "messages", "profil"])
    expect(destinations.map((destination) => destination.href)).toEqual([routes.feed(), routes.memberDiscover(), null, routes.messages(), routes.me()])
  })
})

describe("P02 — une seule coque de communication", () => {
  /** Les sources de l'application (hors tests). */
  function sources(directory: string): string[] {
    return readdirSync(directory).flatMap((name) => {
      const full = join(directory, name)
      if (statSync(full).isDirectory()) return sources(full)
      return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [full] : []
    })
  }

  it("la couche d'appel n'est montée QUE par le gabarit des membres (NetworkShell), jamais par une page ou la navigation", () => {
    const root = fileURLToPath(new URL("../../", import.meta.url))
    const mounting = sources(root).filter((file) => /<CommunicationShell\b/.test(readFileSync(file, "utf8")))
    expect(mounting.map((file) => file.slice(root.length))).toEqual(["components/network-shell.tsx"])
  })
})
