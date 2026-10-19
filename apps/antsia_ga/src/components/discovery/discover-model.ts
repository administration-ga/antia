/**
 * La destination « Découvrir » des membres (P02, navigation par destinations) :
 * CE QU'ELLE REGROUPE, hors de tout composant — testé en environnement `node`.
 *
 * Découvrir ne crée aucun contenu et n'invente aucune donnée : il RANGE des
 * entrées qui existent déjà — le fil national, ses provinces et ses mots-clés,
 * les volets de découverte de la page réseau (relations, groupes, pages,
 * conférences, évènements), la vue publique. Chaque entrée mène à une adresse
 * servie ; la liste des volets vient du moteur (`voletsUnder("decouvrir")`),
 * jamais recopiée.
 *
 * P07 sert l'annuaire des VITRINES ; il ne propose aucun catalogue P09.
 * Services et Emplois restent réservés à leurs lots et à des données réelles :
 * P15 sert Emplois seulement quand le moteur confirme des offres reçues ;
 * P14 sert Services seulement quand le moteur montre des offres de service publiées.
 */
import { GABON_PROVINCES, type ProvinceSlug } from "@antsia/social-domain/provinces"
import { reseauAgentHref, type ReseauAgentTabId } from "@antsia/social-features/shell/reseau-agent-nav"
import { voletsUnder } from "@antsia/social-features/shell/reseau-menu-destinations"
import { z } from "zod"

import { routes } from "@/lib/routes"

/** Les données RÉELLES dont dépend un onglet, lues dans le moteur (P15 : offres d'emploi reçues et lisibles). */
export type DiscoverData = { jobs?: boolean; services?: boolean }

/** Un onglet de Découvrir : servi, réservé à un lot qui n'est pas livré, ou servi seulement avec de vraies données. */
export type DiscoverTab =
  | { id: "tout" | "boutiques"; availability: "served" }
  | { id: "services" | "emplois"; availability: "reserved"; requires: readonly string[] }
  | { id: "emplois" | "services"; availability: "data"; source: keyof DiscoverData }

export const DISCOVER_TABS: readonly DiscoverTab[] = Object.freeze([
  { id: "tout", availability: "served" },
  { id: "boutiques", availability: "served" },
  { id: "services", availability: "data", source: "services" },
  { id: "emplois", availability: "data", source: "jobs" },
])

export type ServedDiscoverTab = Extract<DiscoverTab, { availability: "served" | "data" }>

/** Les onglets à RENDRE : servis, ou adossés à des données réelles confirmées par le moteur. */
export function servedDiscoverTabs(data: DiscoverData = {}): ServedDiscoverTab[] {
  return DISCOVER_TABS.filter((tab): tab is ServedDiscoverTab => tab.availability === "served" || (tab.availability === "data" && data[tab.source] === true))
}

/** Une rangée d'onglets n'a de sens qu'à partir de deux onglets servis. */
export function showsDiscoverTabs(data: DiscoverData = {}): boolean {
  return servedDiscoverTabs(data).length > 1
}

/** P14 : la rubrique Services de Découvrir (offres de service publiées et consenties, projection P09). */
export function discoverServiceEntry(): DiscoverEntry {
  return { id: "services", href: routes.serviceDirectory(), labelKey: "services:discover.title", descriptionKey: "services:discover.lead" }
}

/** P15 : la section Emplois de Découvrir (offres reçues de PRO.GA, jamais classées par popularité). */
export function discoverJobEntry(): DiscoverEntry {
  return { id: "emplois", href: routes.jobDirectory(), labelKey: "jobs:directory.title", descriptionKey: "jobs:directory.lead" }
}

/** Une entrée de Découvrir : une adresse servie, un libellé et sa phrase (clés i18n qualifiées). */
export interface DiscoverEntry {
  id: string
  href: string
  labelKey: string
  descriptionKey: string
}

/** Le fil national, première entrée des contenus. */
export function discoverContentEntries(): DiscoverEntry[] {
  return [{ id: "national", href: routes.nationalFeed(), labelKey: "memberNetwork:discovery.nationalTitle", descriptionKey: "memberNetwork:discoverHub.nationalLead" }]
}

/** L'annuaire membre des vitrines, distinct de toute future liste de produits. */
export function discoverShopEntry(): DiscoverEntry {
  return { id: "boutiques", href: routes.shopDirectory(), labelKey: "memberNetwork:commerce.shops", descriptionKey: "memberNetwork:commerce.shopsLead" }
}

/** Les provinces : leurs noms sont des données du domaine, leur adresse celle du fil membre. */
export function discoverProvinceEntries(): { slug: ProvinceSlug; name: string; href: string }[] {
  return GABON_PROVINCES.map((province) => ({ slug: province.slug, name: province.name, href: routes.memberProvince(province.slug) }))
}

/** Les volets de découverte de la page réseau, dans l'ordre du contrat du moteur. */
export function discoverNetworkEntries(): (DiscoverEntry & { id: ReseauAgentTabId })[] {
  return voletsUnder("decouvrir").map((tab) => ({
    id: tab,
    href: reseauAgentHref(tab, routes.feed()),
    labelKey: `reseau:reseauAgentNav.tabs.${tab}.label`,
    descriptionKey: `reseau:reseauAgentNav.tabs.${tab}.description`,
  }))
}

/**
 * La vue PUBLIQUE (ce que voit un visiteur sans compte). Elle vit hors de la
 * coque des membres : sa phrase le dit avant le geste.
 */
export function discoverPublicEntry(): DiscoverEntry {
  return { id: "public", href: routes.discover(), labelKey: "memberNetwork:discovery.publicDiscover", descriptionKey: "memberNetwork:discoverHub.publicLead" }
}

/** Toutes les adresses que Découvrir sert — la preuve qu'aucune n'est perdue. */
export function discoverHrefs(): string[] {
  return [
    ...discoverContentEntries().map((entry) => entry.href),
    ...discoverProvinceEntries().map((entry) => entry.href),
    ...discoverNetworkEntries().map((entry) => entry.href),
    discoverShopEntry().href,
    discoverPublicEntry().href,
  ]
}

/**
 * Le mot-clé saisi : un `#` de tête est toléré (on l'écrit naturellement),
 * puis la même règle que le filtre du fil membre (`member-feed-filter`) —
 * lettres, chiffres ou soulignés, de 2 à 30. Un test confronte les deux.
 */
export const DISCOVER_TAG_PATTERN = /^[\p{L}\p{N}_]{2,30}$/u

export function discoverTagSchema(invalidMessage: string) {
  return z.object({
    tag: z
      .string()
      .trim()
      .transform((value) => value.replace(/^#+/, ""))
      .pipe(z.string().regex(DISCOVER_TAG_PATTERN, invalidMessage)),
  })
}

export type DiscoverTagValues = z.input<ReturnType<typeof discoverTagSchema>>
