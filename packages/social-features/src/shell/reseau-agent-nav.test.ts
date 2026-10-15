// Dupliqué de socle/packages/agent-features/src/features/reseau-personnel/reseau-agent-nav.test.ts @ ad2e7fdc2 — adaptations : adresses composées sur une BASE injectée (celle du test) au lieu de la route en dur de l'espace — le cas « garde la route… » devient « aucune route en dur : la base est rendue telle quelle » ; relecture des paramètres par `URLSearchParams` (aucune origine en dur) ; volets décrits par leurs clés, résolues dans l'i18n du moteur ; alias « administrations » retiré avec son attente ; cas ajoutés : graphie héritée (`toString`) et base qui porte déjà une query ou une ancre.
import { describe, expect, it } from "vitest"

import { createAppI18n } from "../i18n"
import {
  RESEAU_AGENT_GROUPE_PARAM,
  RESEAU_AGENT_NOTIFICATIONS_PARAM,
  RESEAU_AGENT_QUERY_PARAM,
  RESEAU_AGENT_TAB_DEFAULT,
  RESEAU_AGENT_TAB_IDS,
  RESEAU_AGENT_TAB_PARAM,
  RESEAU_AGENT_TABS,
  RESEAU_AGENT_TAG_PARAM,
  RESEAU_AGENT_VUE_PARAM,
  legacyNotificationsRequested,
  notificationsRequested,
  reseauAgentGroupeHref,
  reseauAgentHref,
  reseauAgentSearchHref,
  reseauAgentTabById,
  reseauAgentTagHref,
  reseauNotificationsHref,
  initialViewFor,
  mainPanelFor,
  parseReseauAgentGroupe,
  parseReseauAgentQuery,
  parseReseauAgentTab,
  parseReseauAgentTag,
  railPanelsFor,
  searchNavigationFor,
  RESEAU_AGENT_POST_PARAM,
  parseReseauAgentPost,
} from "./reseau-agent-nav"

const t = createAppI18n({ locale: "fr", appResources: { fr: {}, en: {} }, defaultNS: "reseau" }).getFixedT("fr")

/** La base de la page réseau, telle que l'application l'injecterait (`useRoutes().home()`). */
const BASE = "/reseau-test"

/** Les paramètres d'une adresse produite — sans origine inventée. */
function paramsOf(href: string): URLSearchParams {
  return new URLSearchParams(href.split("?")[1] ?? "")
}

describe("la séparation du 2026-08-12 n'a touché AUCUN volet", () => {
  // Le risque d'un renommage n'est pas le typage — le typage attrape un
  // symbole manquant — mais les CHAÎNES : un alias d'URL perdu ne casse rien,
  // il fait juste atterrir tous les liens sur le volet par défaut. Un échec
  // indiscernable d'un clic mal visé, et que rien ne signale.
  const ALIASES: ReadonlyArray<[string, string]> = [
    // Le plus important : `reseau` est le nom que portait la page des
    // relations avant la fusion des volets.
    ["reseau", "relations"],
    ["mon-reseau", "relations"],
    ["connexions", "relations"],
    ["people", "relations"],
    ["accueil", "fil"],
    ["feed", "fil"],
    ["publications", "fil"],
    // Les trois graphies de l'ancien volet « Activité » aboutissent au FIL —
    // la cloche prend le relais.
    ["activite", "fil"],
    ["activity", "fil"],
    ["notifications", "fil"],
  ]

  it("fait toujours aboutir les dix anciennes adresses", () => {
    for (const [alias, cible] of ALIASES) {
      expect(parseReseauAgentTab(alias)).toBe(cible)
    }
  })

  it("garde le nom des paramètres, et n'écrit AUCUNE route — la base est injectée", () => {
    // Les liens profonds (`?tab=relations`) en dépendent : renommer un
    // paramètre rendrait la page inatteignable en profondeur. La page, elle,
    // vit où l'application la sert : la base est rendue telle quelle.
    expect(RESEAU_AGENT_TAB_PARAM).toBe("tab")
    expect(RESEAU_AGENT_TAG_PARAM).toBe("tag")
    expect(reseauAgentHref(undefined, BASE)).toBe(BASE)
    expect(reseauAgentHref(undefined, "/")).toBe("/")
  })
})

describe("RESEAU_AGENT_TABS", () => {
  it("porte EXACTEMENT les sept volets, dans l'ordre du rendu", () => {
    // L'ordre est un contrat : la barre d'onglets, le rail-menu de bureau et
    // la feuille « Menu » du téléphone le lisent tous ici. Le figer empêche
    // qu'un ajout se glisse au milieu et déplace les cibles sous le doigt.
    expect(RESEAU_AGENT_TABS.map((tab) => tab.id)).toEqual([
      "fil",
      "relations",
      "groupes",
      "pages",
      "conferences",
      "evenements",
      "enregistrements",
    ])
    // La liste déclarée et le type doivent rester la même chose : deux
    // sources donneraient un volet rendu sans être adressable, ou l'inverse.
    expect(RESEAU_AGENT_TABS.map((tab) => tab.id)).toEqual([
      ...RESEAU_AGENT_TAB_IDS,
    ])
  })

  it("décrit chaque volet — un onglet ne se devine pas", () => {
    for (const tab of RESEAU_AGENT_TABS) {
      // Chaque clé existe dans la locale : `t` rendrait sinon la clé elle-même.
      for (const key of [tab.labelKey, tab.shortLabelKey, tab.descriptionKey]) {
        expect(t(key).length).toBeGreaterThan(0)
        expect(t(key)).not.toBe(key.replace(/^reseau:/, ""))
      }
    }
    expect(t(reseauAgentTabById("relations").labelKey)).toBe("Relations")
    expect(t(reseauAgentTabById("enregistrements").shortLabelKey)).toBe("Signets")
  })

  it("ouvre sur le FIL, comme un réseau social", () => {
    // C'est la décision de l'ADR-0043, que la fusion ne renverse pas : la
    // page d'accueil d'un réseau est son fil, pas un formulaire ni un
    // annuaire.
    expect(RESEAU_AGENT_TAB_DEFAULT).toBe("fil")
    expect(RESEAU_AGENT_TABS[0]?.id).toBe(RESEAU_AGENT_TAB_DEFAULT)
  })
})

describe("parseReseauAgentTab", () => {
  it("rend le volet demandé", () => {
    for (const id of RESEAU_AGENT_TAB_IDS) {
      expect(parseReseauAgentTab(id)).toBe(id)
    }
  })

  it("fait ABOUTIR les anciennes adresses, `reseau` en tête", () => {
    // `reseau` a été le nom d'une PAGE avant d'être un volet : les liens
    // antérieurs le portent. Le perdre les ferait atterrir sur le fil — un
    // échec silencieux, qui ressemble à un clic mal visé.
    expect(parseReseauAgentTab("reseau")).toBe("relations")
    expect(parseReseauAgentTab("mon-reseau")).toBe("relations")
    expect(parseReseauAgentTab("connexions")).toBe("relations")
    expect(parseReseauAgentTab("people")).toBe("relations")
    expect(parseReseauAgentTab("notifications")).toBe("fil")
    expect(parseReseauAgentTab("activity")).toBe("fil")
    expect(parseReseauAgentTab("activite")).toBe("fil")
    expect(parseReseauAgentTab("accueil")).toBe("fil")
    expect(parseReseauAgentTab("feed")).toBe("fil")
  })

  it("pardonne la casse et les espaces d'une URL recopiée à la main", () => {
    expect(parseReseauAgentTab("  Relations ")).toBe("relations")
    expect(parseReseauAgentTab("RESEAU")).toBe("relations")
  })

  it("ne prend JAMAIS une graphie héritée pour un volet", () => {
    // L'objet des alias hérite de `Object.prototype` : `toString` y trouvait
    // une fonction, rendue comme un identifiant de volet.
    for (const raw of ["toString", "constructor", "__proto__", "hasOwnProperty"]) {
      expect(parseReseauAgentTab(raw)).toBe(RESEAU_AGENT_TAB_DEFAULT)
    }
  })

  it("retombe sur le volet par défaut plutôt que de refuser de s'ouvrir", () => {
    for (const raw of [null, undefined, "", "   ", "inexistant"]) {
      expect(parseReseauAgentTab(raw)).toBe(RESEAU_AGENT_TAB_DEFAULT)
    }
  })
})

describe("reseauAgentHref", () => {
  it("rend l'URL NUE pour le volet par défaut", () => {
    // Deux adresses pour la même page en feraient deux entrées d'historique
    // et deux liens à comparer.
    expect(reseauAgentHref(undefined, BASE)).toBe(BASE)
    expect(reseauAgentHref(RESEAU_AGENT_TAB_DEFAULT, BASE)).toBe(BASE)
  })

  it("adresse chaque autre volet par le paramètre attendu des liens profonds", () => {
    expect(reseauAgentHref("relations", BASE)).toBe(`${BASE}?${RESEAU_AGENT_TAB_PARAM}=relations`)
    expect(reseauAgentHref("enregistrements", BASE)).toBe(`${BASE}?${RESEAU_AGENT_TAB_PARAM}=enregistrements`)
  })

  it("boucle : toute adresse produite se relit sur le même volet", () => {
    for (const id of RESEAU_AGENT_TAB_IDS) {
      const href = reseauAgentHref(id, BASE)
      expect(href.startsWith(BASE)).toBe(true)
      expect(parseReseauAgentTab(paramsOf(href).get(RESEAU_AGENT_TAB_PARAM))).toBe(id)
    }
  })

  it("respecte une base qui porte déjà une query ou une ancre", () => {
    // La table des routes reste libre de sa forme : les paramètres de vue
    // s'ajoutent après sa query et avant son ancre.
    expect(reseauAgentHref("relations", `${BASE}?reseau=antia`)).toBe(`${BASE}?reseau=antia&tab=relations`)
    expect(reseauAgentHref("relations", `${BASE}#haut`)).toBe(`${BASE}?tab=relations#haut`)
  })
})

describe("mot-clic", () => {
  it("ouvre le fil filtré, sur un paramètre DISTINCT du volet", () => {
    // Un `#hashtag` est un filtre du fil, pas un quatrième volet.
    expect(reseauAgentTagHref("numerique", BASE)).toBe(`${BASE}?${RESEAU_AGENT_TAG_PARAM}=numerique`)
    expect(RESEAU_AGENT_TAG_PARAM).not.toBe(RESEAU_AGENT_TAB_PARAM)
  })

  it("échappe ce qui doit l'être", () => {
    expect(reseauAgentTagHref("fonction publique", BASE)).toContain(
      "fonction%20publique"
    )
  })

  it("retire le croisillon de tête — sinon le fil sort VIDE", () => {
    // Le défaut visé : un lien composé à la main écrit `#numerique`, alors
    // que les publications indexent le mot nu. Le fil vide se lit alors
    // « personne n'a publié là-dessus », ce qui est faux.
    expect(parseReseauAgentTag("#numerique")).toBe("numerique")
    expect(parseReseauAgentTag("##numerique")).toBe("numerique")
    expect(parseReseauAgentTag(" numerique ")).toBe("numerique")
  })

  it("ne rend jamais un mot-clic vide", () => {
    for (const raw of [null, undefined, "", "   ", "#", "###"]) {
      expect(parseReseauAgentTag(raw)).toBeNull()
    }
  })
})

describe("initialViewFor", () => {
  it("ouvre le fil sur le mot-clic demandé", () => {
    expect(initialViewFor("fil", "numerique")).toEqual({
      kind: "tag",
      tag: "numerique",
    })
  })

  it("ouvre le fil nu quand aucun mot-clic n'est demandé", () => {
    expect(initialViewFor("fil", null)).toEqual({ kind: "feed" })
  })

  it("tranche l'adresse CONTRADICTOIRE en faveur du volet", () => {
    // `?tab=relations&tag=x` : ouvrir les relations en laissant croire qu'un
    // filtre s'applique quelque part serait le pire des deux.
    for (const tab of ["relations", "groupes", "enregistrements"] as const) {
      expect(initialViewFor(tab, "numerique")).toEqual({ kind: "feed" })
      expect(initialViewFor(tab, null, "Test")).toEqual({ kind: "feed" })
    }
  })

  it("ouvre le fil sur la RECHERCHE demandée par l'URL (R-06)", () => {
    // Le défaut visé : arriver sur `?q=Test` depuis un lien partagé rendait
    // le fil nu — la recherche n'était qu'un état local.
    expect(initialViewFor("fil", null, null, "p1")).toEqual({
      kind: "post",
      postId: "p1",
    })
    // La publication prime sur la recherche, le mot-clic prime sur les deux.
    expect(initialViewFor("fil", null, "Test", "p1")).toEqual({
      kind: "post",
      postId: "p1",
    })
    expect(initialViewFor("fil", "numerique", "Test", "p1")).toEqual({
      kind: "tag",
      tag: "numerique",
    })
    expect(initialViewFor("relations", null, null, "p1")).toEqual({ kind: "feed" })
    expect(parseReseauAgentPost("  ")).toBeNull()
    expect(parseReseauAgentPost(" p1 ")).toBe("p1")
    expect(RESEAU_AGENT_POST_PARAM).toBe("post")
    expect(initialViewFor("fil", null, "Test")).toEqual({
      kind: "search",
      query: "Test",
    })
  })

  it("donne le mot-clic pour gagnant quand l'URL porte les deux", () => {
    // Aucune fabrique n'émet `tag` ET `q` : cette adresse vient d'une main
    // humaine. Le mot-clic l'emporte — c'est le contrat le plus ancien, et un
    // filtre nommé est plus précis qu'une recherche plein texte.
    expect(initialViewFor("fil", "numerique", "Test")).toEqual({
      kind: "tag",
      tag: "numerique",
    })
  })

  it("reste rétrocompatible à DEUX arguments", () => {
    // Le troisième paramètre est optionnel : les appels antérieurs à R-06 se
    // comportent exactement comme avant.
    expect(initialViewFor("fil", null)).toEqual({ kind: "feed" })
    expect(initialViewFor("fil", "numerique")).toEqual({
      kind: "tag",
      tag: "numerique",
    })
  })
})

describe("recherche adressable (R-06)", () => {
  it("nomme le paramètre `q`, distinct des trois autres", () => {
    expect(RESEAU_AGENT_QUERY_PARAM).toBe("q")
    for (const other of [
      RESEAU_AGENT_TAB_PARAM,
      RESEAU_AGENT_TAG_PARAM,
      RESEAU_AGENT_GROUPE_PARAM,
    ]) {
      expect(RESEAU_AGENT_QUERY_PARAM).not.toBe(other)
    }
  })

  it("nettoie la requête sans jamais la deviner", () => {
    expect(parseReseauAgentQuery("  Test  ")).toBe("Test")
    for (const raw of [null, undefined, "", "   "]) {
      expect(parseReseauAgentQuery(raw)).toBeNull()
    }
  })

  it("adresse les résultats SANS `tab=fil` — le fil est le défaut", () => {
    expect(reseauAgentSearchHref("Test", BASE)).toBe(`${BASE}?${RESEAU_AGENT_QUERY_PARAM}=Test`)
    expect(reseauAgentSearchHref("fonction publique", BASE)).toContain("fonction%20publique")
  })

  it("rend l'URL NUE pour une requête vide", () => {
    for (const raw of ["", "   "]) {
      expect(reseauAgentSearchHref(raw, BASE)).toBe(BASE)
    }
  })

  it("boucle : l'adresse produite se relit sur la vue résultats", () => {
    const params = paramsOf(reseauAgentSearchHref("Test", BASE))
    const tab = parseReseauAgentTab(params.get(RESEAU_AGENT_TAB_PARAM))
    const query = parseReseauAgentQuery(params.get(RESEAU_AGENT_QUERY_PARAM))
    expect(initialViewFor(tab, null, query)).toEqual({
      kind: "search",
      query: "Test",
    })
  })
})

describe("searchNavigationFor — faut-il changer de volet ?", () => {
  it("POUSSE vers le fil depuis tout autre volet — le défaut R-06", () => {
    // Le parcours : Relations → loupe → « Test ». Les résultats ne sont
    // rendus que par le fil, et le volet vient de l'URL : sans ce push,
    // l'écran calculerait une réponse que rien ne montre.
    for (const tab of [
      "relations",
      "groupes",
      "pages",
      "conferences",
      "evenements",
      "enregistrements",
    ] as const) {
      expect(searchNavigationFor(tab, "Test", BASE)).toEqual({
        view: { kind: "search", query: "Test" },
        href: `${BASE}?${RESEAU_AGENT_QUERY_PARAM}=Test`,
      })
    }
  })

  it("ne navigue PAS quand on est déjà sur le fil", () => {
    expect(searchNavigationFor("fil", "Test", BASE)).toEqual({
      view: { kind: "search", query: "Test" },
      href: null,
    })
  })

  it("ne navigue JAMAIS sur une requête vide", () => {
    // Effacer sa recherche depuis les Relations ne doit pas éjecter du volet
    // qu'on regarde.
    for (const raw of ["", "   "]) {
      expect(searchNavigationFor("relations", raw, BASE)).toEqual({
        view: { kind: "feed" },
        href: null,
      })
      expect(searchNavigationFor("fil", raw, BASE)).toEqual({
        view: { kind: "feed" },
        href: null,
      })
    }
  })

  it("rogne la requête avant de la porter dans l'URL", () => {
    expect(searchNavigationFor("relations", "  Test  ", BASE)).toEqual({
      view: { kind: "search", query: "Test" },
      href: `${BASE}?${RESEAU_AGENT_QUERY_PARAM}=Test`,
    })
  })
})

describe("la cloche remplace le volet Activité", () => {
  it("ne déclare PLUS de volet `activite`", () => {
    expect(RESEAU_AGENT_TAB_IDS).toHaveLength(7)
    expect(RESEAU_AGENT_TAB_IDS as readonly string[]).not.toContain("activite")
    expect(RESEAU_AGENT_TABS.map((tab) => tab.id as string)).not.toContain(
      "activite"
    )
  })

  it("reconnaît les trois graphies de l'ancien lien de cloche", () => {
    // `parseReseauAgentTab` rend « fil » pour ces valeurs COMME pour une
    // inconnue : sans ce prédicat, un lien de cloche atterrirait sur le fil
    // sans rien montrer.
    for (const raw of [
      "activite",
      "activity",
      "notifications",
      " Activite ",
      "ACTIVITY",
    ]) {
      expect(legacyNotificationsRequested(raw)).toBe(true)
    }
  })

  it("ne confond PAS un volet vivant avec une demande de cloche", () => {
    for (const raw of [
      null,
      undefined,
      "",
      "   ",
      "fil",
      "relations",
      "enregistrements",
      "inexistant",
    ]) {
      expect(legacyNotificationsRequested(raw)).toBe(false)
    }
  })

  it("adresse la cloche par un paramètre à part, jamais un volet", () => {
    expect(RESEAU_AGENT_NOTIFICATIONS_PARAM).toBe("notifications")
    expect(RESEAU_AGENT_NOTIFICATIONS_PARAM).not.toBe(RESEAU_AGENT_TAB_PARAM)
    expect(reseauNotificationsHref(BASE)).toBe(`${BASE}?notifications=1`)
    // Et l'adresse ouvre bien le FIL : la carte se superpose, elle ne
    // remplace pas la page.
    const params = paramsOf(reseauNotificationsHref(BASE))
    expect(parseReseauAgentTab(params.get(RESEAU_AGENT_TAB_PARAM))).toBe("fil")
    expect(notificationsRequested(params.get(RESEAU_AGENT_NOTIFICATIONS_PARAM))).toBe(true)
  })

  it("tolère les graphies d'un booléen tapé à la main", () => {
    for (const raw of ["1", "true", "TRUE", "oui", " yes "]) {
      expect(notificationsRequested(raw)).toBe(true)
    }
    for (const raw of [null, undefined, "", "   ", "0", "false", "non", "no"]) {
      expect(notificationsRequested(raw)).toBe(false)
    }
  })
})

describe("volets pages, conférences, évènements, signets — adressage", () => {
  it("fait aboutir les graphies probables des quatre volets", () => {
    // Elles viennent de l'anglais ou du nom du module serveur, que portent
    // toasts et messages d'erreur.
    expect(parseReseauAgentTab("organisations")).toBe("pages")
    expect(parseReseauAgentTab("orgs")).toBe("pages")
    expect(parseReseauAgentTab("direct")).toBe("conferences")
    expect(parseReseauAgentTab("live")).toBe("conferences")
    expect(parseReseauAgentTab("lives")).toBe("conferences")
    expect(parseReseauAgentTab("evenement")).toBe("evenements")
    expect(parseReseauAgentTab("events")).toBe("evenements")
    expect(parseReseauAgentTab("agenda")).toBe("evenements")
    expect(parseReseauAgentTab("signets")).toBe("enregistrements")
    expect(parseReseauAgentTab("bookmarks")).toBe("enregistrements")
    expect(parseReseauAgentTab("marks")).toBe("enregistrements")
  })

  it("ne détourne AUCUN volet existant", () => {
    // `direct` alias de `conferences` et `RESEAU_AGENT_GROUPE_PARAM = "groupe"`
    // se ressemblent assez pour qu'une inattention fasse d'un volet le
    // paramètre de l'autre. Les sept identifiants restent leur propre valeur.
    for (const id of RESEAU_AGENT_TAB_IDS) {
      expect(parseReseauAgentTab(id)).toBe(id)
    }
  })
})

describe("volet Groupes — adressage", () => {
  it("fait aboutir les graphies probables", () => {
    expect(parseReseauAgentTab("groupes")).toBe("groupes")
    expect(parseReseauAgentTab("groups")).toBe("groupes")
    expect(parseReseauAgentTab("groupe")).toBe("groupes")
    expect(parseReseauAgentTab("groupes-thematiques")).toBe("groupes")
    expect(parseReseauAgentTab("communautes")).toBe("groupes")
  })

  it("adresse la page d'UN groupe — volet + paramètre, jamais l'un sans l'autre", () => {
    expect(reseauAgentGroupeHref("abc123", BASE)).toBe(`${BASE}?tab=groupes&groupe=abc123`)
    // Trois paramètres, trois noms distincts : ils coexistent sur la même
    // adresse et ne doivent jamais s'écraser.
    expect(RESEAU_AGENT_GROUPE_PARAM).not.toBe(RESEAU_AGENT_TAB_PARAM)
    expect(RESEAU_AGENT_GROUPE_PARAM).not.toBe(RESEAU_AGENT_TAG_PARAM)
  })

  it("nettoie l'identifiant demandé sans jamais le deviner", () => {
    expect(parseReseauAgentGroupe(" abc123 ")).toBe("abc123")
    for (const raw of [null, undefined, "", "   "]) {
      expect(parseReseauAgentGroupe(raw)).toBeNull()
    }
  })
})

describe("sous-vue d'un volet — `vue` ne remplace jamais `tab`", () => {
  it("porte un nom distinct de tous les autres paramètres", () => {
    expect(RESEAU_AGENT_VUE_PARAM).toBe("vue")
    for (const autre of [
      RESEAU_AGENT_TAB_PARAM,
      RESEAU_AGENT_TAG_PARAM,
      RESEAU_AGENT_GROUPE_PARAM,
      RESEAU_AGENT_QUERY_PARAM,
      RESEAU_AGENT_NOTIFICATIONS_PARAM,
      RESEAU_AGENT_POST_PARAM,
    ]) {
      expect(RESEAU_AGENT_VUE_PARAM).not.toBe(autre)
    }
  })

  it("n'ajoute AUCUN volet : la barre d'onglets reste celle des sept", () => {
    // Une sous-vue vit DANS un volet. Si `vue` en devenait un, la barre et le
    // rail-menu auraient trois entrées de plus pour un même écran.
    expect(parseReseauAgentTab("suggestions")).toBe(RESEAU_AGENT_TAB_DEFAULT)
    expect(parseReseauAgentTab("invitations")).toBe(RESEAU_AGENT_TAB_DEFAULT)
    expect(RESEAU_AGENT_TAB_IDS).not.toContain("suggestions")
    expect(RESEAU_AGENT_TAB_IDS).not.toContain("invitations")
  })
})

describe("reseauAgentTabById", () => {
  it("rend la fiche de chaque volet atteignable", () => {
    for (const id of RESEAU_AGENT_TAB_IDS) {
      expect(reseauAgentTabById(id).id).toBe(id)
    }
  })
})

describe("répartition colonne / rails", () => {
  it("donne à chaque volet UNE colonne centrale, et une seule", () => {
    expect(mainPanelFor("fil")).toBe("feed")
    expect(mainPanelFor("relations")).toBe("people")
    expect(mainPanelFor("groupes")).toBe("groups")
    expect(mainPanelFor("pages")).toBe("pages")
    expect(mainPanelFor("conferences")).toBe("conferences")
    expect(mainPanelFor("evenements")).toBe("events")
    expect(mainPanelFor("enregistrements")).toBe("bookmarks")
  })

  it("donne à chaque volet une colonne DISTINCTE", () => {
    // Deux volets qui rendent la même colonne seraient deux adresses pour
    // un seul écran : l'onglet actif ne dirait plus où l'on est.
    const panels = RESEAU_AGENT_TAB_IDS.map((id) => mainPanelFor(id))
    expect(new Set(panels).size).toBe(RESEAU_AGENT_TAB_IDS.length)
  })

  it("n'affiche JAMAIS deux fois le même panneau", () => {
    // Sur écran large, le rail de découverte accompagne la colonne : le
    // module correspondant au volet ouvert doit alors en sortir.
    for (const id of RESEAU_AGENT_TAB_IDS) {
      const rails = railPanelsFor(id)
      const main = mainPanelFor(id)
      if (main === "conferences") expect(rails.liveDirects).toBe(false)
      if (main === "pages") expect(rails.pagesToFollow).toBe(false)
      if (main === "events") expect(rails.events).toBe(false)
    }
  })

  it("garde chaque rail partout où il ne doublonne pas", () => {
    expect(railPanelsFor("fil")).toEqual({
      suggestions: true,
      liveDirects: true,
      pagesToFollow: true,
      events: true,
    })
    expect(railPanelsFor("conferences").pagesToFollow).toBe(true)
    expect(railPanelsFor("pages").liveDirects).toBe(true)
    expect(railPanelsFor("pages").events).toBe(true)
  })

  it("garde les suggestions à tous les volets", () => {
    // Des personnes à découvrir ne sont le contenu principal d'aucun volet :
    // rien ne les fait doublonner.
    for (const id of RESEAU_AGENT_TAB_IDS) {
      expect(railPanelsFor(id).suggestions).toBe(true)
    }
  })
})
