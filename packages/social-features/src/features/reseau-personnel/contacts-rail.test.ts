// Dupliqué de socle/packages/agent-features/src/features/reseau-personnel/contacts-rail.test.ts @ ad2e7fdc2 — adaptations : contact au DTO du graphe du moteur (`otherPersonId`) ; tri dans la langue passée (« fr » donné par le test, plus en dur dans le module) ; textes lus dans l'i18n du moteur (`t` français en dernier paramètre) ; « collègues » devient « personnes » ; cas neufs : une relation sans nom reste trouvable par son identifiant et se range en dernier, décompte en anglais ; tous les cas du socle gardés.
import { describe, expect, it } from "vitest"

import { createAppI18n } from "../../i18n"
import { contactSubtitle, contactsCountLabel, emptyContactsText, filterContacts, sortContacts, type ContactRailPerson } from "./contacts-rail"

const t = createAppI18n({ locale: "fr", appResources: { fr: {}, en: {} }, defaultNS: "reseau" }).getFixedT("fr")
const tEn = createAppI18n({ locale: "en", appResources: { fr: {}, en: {} }, defaultNS: "reseau" }).getFixedT("en")

function person(over: Partial<ContactRailPerson> & { displayName: string | null }): ContactRailPerson {
  return {
    otherPersonId: over.displayName ?? over.handle ?? "anonyme",
    handle: null,
    headline: null,
    avatarUrl: null,
    ...over,
  }
}

describe("contactSubtitle", () => {
  it("préfère la ligne de présentation — c'est ce que la personne a choisi de dire", () => {
    expect(contactSubtitle(person({ displayName: "Awa", headline: "Cheffe de service", handle: "awa" }))).toBe("Cheffe de service")
  })

  it("retombe sur le handle, qui est public par construction", () => {
    expect(contactSubtitle(person({ displayName: "Awa", handle: "awa" }))).toBe("@awa")
  })

  it("ne dit RIEN plutôt que d'inventer", () => {
    // Ni organisation ni poste ne sont dans ce DTO. Les chercher ailleurs
    // ferait dire au rail ce que la personne n'a pas publié.
    expect(contactSubtitle(person({ displayName: "Awa" }))).toBeNull()
  })

  it("ignore une ligne de présentation vide ou blanche", () => {
    expect(contactSubtitle(person({ displayName: "Awa", headline: "   ", handle: "awa" }))).toBe("@awa")
  })
})

describe("filterContacts", () => {
  const contacts = [
    person({ displayName: "Élise Ndong", handle: "elise", headline: "Juriste" }),
    person({ displayName: "Bruno Obame", handle: "bruno", headline: "Comptable" }),
  ]

  it("rend tout le monde quand la recherche est vide", () => {
    expect(filterContacts(contacts, "")).toHaveLength(2)
    expect(filterContacts(contacts, "   ")).toHaveLength(2)
  })

  it("ignore accents et casse — sinon on ne trouve rien sans savoir pourquoi", () => {
    expect(filterContacts(contacts, "elise")).toHaveLength(1)
    expect(filterContacts(contacts, "ÉLISE")).toHaveLength(1)
    expect(filterContacts(contacts, "élise")).toHaveLength(1)
  })

  it("cherche AUSSI dans le handle et la présentation", () => {
    expect(filterContacts(contacts, "bruno")).toHaveLength(1)
    expect(filterContacts(contacts, "comptable")).toHaveLength(1)
  })

  it("une relation sans nom reste trouvable par son identifiant", () => {
    const sansNom = person({ displayName: null, handle: "zoe.k" })
    expect(filterContacts([...contacts, sansNom], "zoe")).toEqual([sansNom])
  })

  it("rend une liste vide sans erreur quand rien ne correspond", () => {
    expect(filterContacts(contacts, "zzz")).toEqual([])
  })

  it("ne mute pas la liste reçue", () => {
    const source = [...contacts]
    filterContacts(source, "")
    expect(source).toHaveLength(2)
  })
})

describe("sortContacts", () => {
  it("range par nom, à la française", () => {
    // ⚠️ Et non par date de connexion, l'ordre que rend le serveur : une
    // liste qu'on PARCOURT pour trouver quelqu'un se range par nom.
    const sorted = sortContacts([person({ displayName: "Zita" }), person({ displayName: "Élise" }), person({ displayName: "Bruno" })], "fr")
    expect(sorted.map((contact) => contact.displayName)).toEqual(["Bruno", "Élise", "Zita"])
  })

  it("place l'accent à SA place, pas après Z", () => {
    // Un tri brut par point de code renverrait « Élise » après « Zita ».
    const sorted = sortContacts([person({ displayName: "Zita" }), person({ displayName: "Élise" })], "fr")
    expect(sorted[0]?.displayName).toBe("Élise")
  })

  it("une relation sans nom se range en dernier", () => {
    const sorted = sortContacts([person({ displayName: null, handle: "anonyme" }), person({ displayName: "Zita" }), person({ displayName: "Bruno" })], "fr")
    expect(sorted.map((contact) => contact.displayName)).toEqual(["Bruno", "Zita", null])
  })

  it("ne mute pas la liste reçue", () => {
    const source = [person({ displayName: "Zita" }), person({ displayName: "Bruno" })]
    sortContacts(source, "fr")
    expect(source[0]?.displayName).toBe("Zita")
  })
})

describe("emptyContactsText", () => {
  it("distingue « rien trouvé » de « carnet vide »", () => {
    // Proposer « trouvez des personnes » à qui vient de taper trois lettres
    // répond à côté de la question posée.
    expect(emptyContactsText("awa", t)).toContain("recherche")
    expect(emptyContactsText("", t)).toContain("Relations")
  })
})

describe("contactsCountLabel", () => {
  it("accorde, zéro compris", () => {
    expect(contactsCountLabel(0, t)).toBe("Aucun contact")
    expect(contactsCountLabel(1, t)).toBe("1 contact")
    expect(contactsCountLabel(7, t)).toBe("7 contacts")
  })

  it("accorde aussi en anglais", () => {
    expect(contactsCountLabel(0, tEn)).toBe("No contacts")
    expect(contactsCountLabel(1, tEn)).toBe("1 contact")
    expect(contactsCountLabel(7, tEn)).toBe("7 contacts")
  })
})
