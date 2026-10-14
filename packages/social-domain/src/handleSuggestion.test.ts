// Dupliqué de socle/convex/modules/reseauPersonnel/handleSuggestion.test.ts @ ad2e7fdc2 — adaptations : `assertHandle` importé de ./content (le domaine du socle est scindé) ; cas inchangés.
/**
 * Propositions d'identifiant public — le test qui tient deux règles de fond :
 * aucun ordre n'est privilégié, et rien ne sort qui ne passerait `assertHandle`.
 *
 * Environnement `node` (défaut du projet) : fonctions pures, aucun harnais.
 */
import { describe, expect, it } from "vitest"
import { assertHandle } from "./content"
import {
  handleLadder,
  handleNameComponents,
  handleToken,
  isCandidateHandle,
  pickFreeHandle,
  provisionalHandleBase,
} from "./handleSuggestion"

const NONE: ReadonlySet<string> = new Set()

describe("handleToken — translittérer, pas transformer", () => {
  it("retire les diacritiques et la casse", () => {
    expect(handleToken("NZÉ")).toBe("nze")
    expect(handleToken("Ondö")).toBe("ondo")
  })

  it("colle un prénom composé au trait d'union court", () => {
    expect(handleToken("Jean-Pierre")).toBe("jeanpierre")
  })

  it("ne laisse passer aucun caractère hors [a-z0-9]", () => {
    expect(handleToken("O'Brien Mba_2")).toBe("obrienmba2")
  })
})

describe("handleNameComponents — ce qui sépare et ce qui ne sépare pas", () => {
  it("sépare sur l'espace, pas sur le trait d'union court", () => {
    expect(handleNameComponents("Jean-Pierre Marie")).toEqual([
      "jeanpierre",
      "marie",
    ])
  })

  it("rend un tableau vide sur une entrée absente", () => {
    expect(handleNameComponents(null)).toEqual([])
    expect(handleNameComponents("   ")).toEqual([])
  })
})

describe("handleLadder — aucun ordre privilégié", () => {
  const lynda = { firstName: "Lynda", lastName: "Onanga" }

  it("propose les DEUX ordres, et le fait dès le premier palier", () => {
    const ladder = handleLadder(lynda)
    expect(ladder).toContain("lynda.onanga")
    expect(ladder).toContain("onanga.lynda")
    expect(ladder.slice(0, 2).sort()).toEqual(["lynda.onanga", "onanga.lynda"])
  })

  it("monte en discrimination quand l'état civil le permet", () => {
    const ladder = handleLadder({
      firstName: "Lynda Estelle",
      lastName: "Onanga Issambo",
    })
    expect(ladder).toContain("lynda.onanga")
    expect(ladder).toContain("lyndaestelle.onanga")
    expect(ladder).toContain("onangaissambo.lynda")
  })

  it("ne rend jamais deux fois le même candidat", () => {
    const ladder = handleLadder({ firstName: "Paul", lastName: "Ndong" })
    expect(new Set(ladder).size).toBe(ladder.length)
  })

  it("écarte les candidats hors bornes plutôt que de différer le refus", () => {
    // 3 caractères minimum : « Ba Li » donnerait `li.ba` (5) mais un mononyme
    // trop court doit disparaître de l'échelle.
    expect(handleLadder({ firstName: "A", lastName: "" })).toEqual([])
    // 30 caractères maximum.
    const long = handleLadder({
      firstName: "Marie Christine Bernadette",
      lastName: "Nzengue Moussavou Ondo",
    })
    for (const candidate of long) expect(candidate.length).toBeLessThanOrEqual(30)
  })

  it("replie un compte de rôle sur son organisme, sans inventer d'état civil", () => {
    const ladder = handleLadder({ name: "Agent — DGDI" })
    expect(ladder).toContain("dgdi.agent")
    expect(ladder).toContain("agent.dgdi")
  })

  it("rend vide quand rien n'est dérivable", () => {
    expect(handleLadder({})).toEqual([])
    expect(handleLadder({ firstName: null, lastName: null, name: null })).toEqual(
      [],
    )
  })

  it("TOUT candidat produit passe assertHandle", () => {
    const people = [
      { firstName: "Lynda", lastName: "Onanga" },
      { firstName: "Jean-Pierre", lastName: "Nzé Mba" },
      { firstName: "Marie Christine", lastName: "Ondo" },
      { name: "Agent — DGDI" },
      { firstName: "Aïcha", lastName: "Mboumba" },
    ]
    for (const person of people) {
      for (const candidate of handleLadder(person)) {
        expect(() => assertHandle(candidate)).not.toThrow()
      }
    }
  })
})

describe("provisionalHandleBase — nom.prenom, par cohérence souveraine", () => {
  it("suit l'ordre des identifiants IDN du dépôt", () => {
    expect(provisionalHandleBase({ firstName: "Lynda", lastName: "Onanga" })).toBe(
      "onanga.lynda",
    )
  })

  it("se replie sur l'échelle quand la forme nominale est irrecevable", () => {
    const base = provisionalHandleBase({ name: "Agent — DGDI" })
    expect(base).not.toBeNull()
    expect(() => assertHandle(base!)).not.toThrow()
  })

  it("rend null quand rien n'est dérivable", () => {
    expect(provisionalHandleBase({})).toBeNull()
  })
})

describe("pickFreeHandle — la collision se lève, elle ne bloque pas", () => {
  const paul = { firstName: "Paul", lastName: "Ndong" }

  it("pose la forme nominale d'abord, puis descend l'échelle", () => {
    expect(pickFreeHandle(paul, NONE)).toBe("ndong.paul")
    expect(pickFreeHandle(paul, new Set(["ndong.paul"]))).toBe("paul.ndong")
  })

  it("suffixe la forme NOMINALE quand toute l'échelle est prise", () => {
    const taken = new Set(handleLadder(paul))
    const picked = pickFreeHandle(paul, taken)
    expect(picked).toBe("ndong.paul2")
  })

  it("tronque sans jamais laisser un séparateur en bord", () => {
    const person = {
      firstName: "Bernadette Christine",
      lastName: "Nzengue Moussavou",
    }
    const taken = new Set([
      ...handleLadder(person),
      provisionalHandleBase(person)!,
    ])
    const picked = pickFreeHandle(person, taken)
    expect(picked).not.toBeNull()
    expect(picked!.length).toBeLessThanOrEqual(30)
    expect(picked).not.toMatch(/[._-]\d+$/)
    expect(() => assertHandle(picked!)).not.toThrow()
  })

  it("rend null quand rien n'est dérivable", () => {
    expect(pickFreeHandle({}, NONE)).toBeNull()
  })
})

describe("isCandidateHandle — le miroir exact d'assertHandle", () => {
  it("accepte ce qu'assertHandle accepte", () => {
    for (const ok of ["a_n-d.o1", "abc", "paul.ndong"]) {
      expect(isCandidateHandle(ok)).toBe(true)
      expect(() => assertHandle(ok)).not.toThrow()
    }
  })

  it("refuse ce qu'assertHandle refuse", () => {
    for (const ko of ["ab", "a".repeat(31), ".paul", "paul.", "Paul", "nzé"]) {
      expect(isCandidateHandle(ko)).toBe(false)
    }
  })
})
