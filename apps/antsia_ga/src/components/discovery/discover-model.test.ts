import { PROVINCE_SLUGS } from "@antsia/social-domain/provinces"
import { reseauAgentHref } from "@antsia/social-features/shell/reseau-agent-nav"
import { describe, expect, it } from "vitest"

import { routes } from "@/lib/routes"
import {
  DISCOVER_TABS,
  DISCOVER_TAG_PATTERN,
  discoverContentEntries,
  discoverHrefs,
  discoverJobEntry,
  discoverNetworkEntries,
  discoverProvinceEntries,
  discoverPublicEntry,
  discoverServiceEntry,
  discoverShopEntry,
  discoverTagSchema,
  servedDiscoverTabs,
  showsDiscoverTabs,
} from "./discover-model"
import { memberFeedFilter } from "./member-feed-filter"

describe("Découvrir — ce que la destination regroupe (P02)", () => {
  it("le fil national, ses neuf provinces et la vue publique, sur la table des routes", () => {
    expect(discoverContentEntries().map((entry) => entry.href)).toEqual([routes.nationalFeed()])
    expect(discoverProvinceEntries().map((entry) => entry.slug)).toEqual([...PROVINCE_SLUGS])
    for (const entry of discoverProvinceEntries()) expect(entry.href).toBe(routes.memberProvince(entry.slug))
    expect(discoverPublicEntry().href).toBe(routes.discover())
  })

  it("les volets de découverte du réseau, dans l'ordre du moteur — relations, groupes, pages, conférences, évènements", () => {
    const entries = discoverNetworkEntries()
    expect(entries.map((entry) => entry.id)).toEqual(["relations", "groupes", "pages", "conferences", "evenements"])
    for (const entry of entries) {
      expect(entry.href).toBe(reseauAgentHref(entry.id, routes.feed()))
      expect(entry.labelKey).toBe(`reseau:reseauAgentNav.tabs.${entry.id}.label`)
    }
    // Les anciennes adresses des groupes et évènements mènent au même volet.
    expect(entries.find((entry) => entry.id === "groupes")?.href).toBe(routes.memberTab("groupes"))
    expect(entries.find((entry) => entry.id === "evenements")?.href).toBe(routes.memberTab("evenements"))
  })

  it("chaque entrée porte une adresse distincte, sans doublon", () => {
    const hrefs = discoverHrefs()
    expect(new Set(hrefs).size).toBe(hrefs.length)
    expect(hrefs).not.toContain(routes.memberDiscover())
  })

  it("ouvre l’annuaire de vitrines P07 et réserve Services et Emplois à leurs lots", () => {
    expect(servedDiscoverTabs().map((tab) => tab.id)).toEqual(["tout", "boutiques"])
    expect(showsDiscoverTabs()).toBe(true)
    expect(discoverShopEntry().href).toBe(routes.shopDirectory())
    expect(discoverHrefs()).toContain(routes.shopDirectory())
    const reserved = DISCOVER_TABS.filter((tab) => tab.availability === "reserved")
    // P14 et P15 livrés : plus aucun onglet réservé, Services et Emplois dépendent de données réelles.
    expect(reserved.map((tab) => tab.id)).toEqual([])
    for (const tab of reserved) expect(tab.availability === "reserved" && tab.requires.length).toBeGreaterThan(0)
  })

  // P15 — écrit, non exécuté : Emplois n'est servi qu'avec de vraies offres reçues, confirmées par le moteur.
  it("sert l'onglet Emplois seulement quand le moteur confirme des offres réelles", () => {
    expect(servedDiscoverTabs({ jobs: false }).map((tab) => tab.id)).toEqual(["tout", "boutiques"])
    expect(servedDiscoverTabs({ jobs: true }).map((tab) => tab.id)).toEqual(["tout", "boutiques", "emplois"])
    expect(DISCOVER_TABS.find((tab) => tab.id === "emplois")).toEqual({ id: "emplois", availability: "data", source: "jobs" })
    expect(discoverJobEntry()).toMatchObject({ href: routes.jobDirectory(), labelKey: "jobs:directory.title" })
    // L'adresse des emplois n'est pas une entrée permanente : elle n'apparaît qu'avec ses données.
    expect(discoverHrefs()).not.toContain(routes.jobDirectory())
  })

  // P14 — écrit, non exécuté : Services n'est servi qu'avec de vraies offres de service publiées.
  it("sert l'onglet Services seulement quand le moteur montre des offres de service publiées", () => {
    expect(servedDiscoverTabs({ services: false }).map((tab) => tab.id)).toEqual(["tout", "boutiques"])
    expect(servedDiscoverTabs({ services: true }).map((tab) => tab.id)).toEqual(["tout", "boutiques", "services"])
    expect(servedDiscoverTabs({ services: true, jobs: true }).map((tab) => tab.id)).toEqual(["tout", "boutiques", "services", "emplois"])
    expect(DISCOVER_TABS.find((tab) => tab.id === "services")).toEqual({ id: "services", availability: "data", source: "services" })
    expect(discoverServiceEntry()).toMatchObject({ href: routes.serviceDirectory(), labelKey: "services:discover.title", descriptionKey: "services:discover.lead" })
    // Comme Emplois, l'adresse des services n'est pas une entrée permanente.
    expect(discoverHrefs()).not.toContain(routes.serviceDirectory())
  })
})

describe("Découvrir — le mot-clé suit la règle du fil membre", () => {
  const schema = discoverTagSchema("invalide")

  it("tolère le # de tête et les espaces, puis ouvre un filtre ACCEPTÉ par le fil", () => {
    for (const raw of ["numerique", "#école", "  ##santé_publique ", "2026", "ab"]) {
      const parsed = schema.safeParse({ tag: raw })
      expect(parsed.success).toBe(true)
      if (!parsed.success) continue
      const url = new URL(routes.memberTag(parsed.data.tag), "https://example.test")
      expect(memberFeedFilter(Object.fromEntries(url.searchParams)).kind).toBe("national")
    }
  })

  it("refuse ce que le fil refuserait — avec le message donné", () => {
    for (const raw of ["", "a", "#", "deux mots", "trait-d-union", "x".repeat(31), "point.final"]) {
      const parsed = schema.safeParse({ tag: raw })
      expect(parsed.success).toBe(false)
      if (!parsed.success) expect(parsed.error.issues[0]?.message).toBe("invalide")
      const cleaned = raw.trim().replace(/^#+/, "")
      expect(memberFeedFilter({ portee: "national", tag: cleaned }).kind).toBe(DISCOVER_TAG_PATTERN.test(cleaned) ? "national" : "invalid")
    }
  })
})
