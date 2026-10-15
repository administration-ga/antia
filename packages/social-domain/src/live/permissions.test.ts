// Dupliqué de socle/convex/modules/direct/permissions.test.ts @ ad2e7fdc2 — adaptations : aucune ; les seize cas portés tels quels, à côté du module déplacé dans le domaine.
/**
 * La MATRICE de gestion du direct (D-11, ADR-0144), ligne par ligne.
 *
 * Module PUR : ni backend, ni `edge-runtime`. C'est tout l'intérêt de l'avoir
 * sorti — la règle se couvre entièrement sans salle, sans compte et sans
 * transaction, y compris les combinaisons qu'aucun écran ne montre.
 */
import { describe, expect, it } from "vitest"
import {
  DIRECT_PERMISSION_KEYS,
  defaultDelegationFlags,
  directDelegationKindLabel,
  directPermissionsFor,
  hasAnyDirectManagement,
  noDirectPermissions,
  type DirectDelegationFacts,
  type DirectPermissionKey,
} from "./permissions"

const delegation = (
  over: Partial<DirectDelegationFacts> = {},
): DirectDelegationFacts => ({
  kind: "moderator",
  canAdmitToStage: false,
  canExclude: false,
  canEndOrTransfer: false,
  ...over,
})

/** Les clés VRAIES d'une matrice — comparer des ensembles, pas neuf booléens. */
function accordees(input: Parameters<typeof directPermissionsFor>[0]) {
  const p = directPermissionsFor(input)
  return DIRECT_PERMISSION_KEYS.filter((key) => p[key]).sort()
}

describe("l'hôte peut tout, et lui seul peut déléguer", () => {
  it("les neuf clés sont accordées", () => {
    expect(
      accordees({ isHost: true, delegation: null, isSpeaker: true }),
    ).toEqual([...DIRECT_PERMISSION_KEYS].sort())
  })

  it("une délégation ne RETIRE jamais rien à l'hôte", () => {
    // Un hôte qui se serait vu poser une ligne (seed, migration) garde tout.
    expect(
      accordees({
        isHost: true,
        delegation: delegation({ kind: "moderator" }),
        isSpeaker: false,
      }),
    ).toEqual([...DIRECT_PERMISSION_KEYS].sort())
  })
})

describe("le délégué — la conversation toujours, le reste par drapeau", () => {
  it("un modérateur SANS drapeau modère et ferme le chat, rien de plus", () => {
    expect(
      accordees({
        isHost: false,
        delegation: delegation({ kind: "moderator" }),
        isSpeaker: false,
      }),
    ).toEqual(["closeChat", "moderateChat"])
  })

  it("un cohôte SANS drapeau n'a pas plus qu'un modérateur", () => {
    // ⚠️ Le genre n'est PAS une permission : c'est une étiquette et un jeu de
    // défauts. Le jour où il déciderait, il y aurait deux sources de vérité.
    expect(
      accordees({
        isHost: false,
        delegation: delegation({ kind: "cohost" }),
        isSpeaker: false,
      }),
    ).toEqual(["closeChat", "moderateChat"])
  })

  it("`canAdmitToStage` ouvre l'antenne DANS LES DEUX SENS", () => {
    const keys = accordees({
      isHost: false,
      delegation: delegation({ kind: "cohost", canAdmitToStage: true }),
      isSpeaker: false,
    })
    expect(keys).toContain("admitToStage")
    // Retirer de l'antenne accompagne toujours le fait d'y faire monter :
    // pouvoir accepter une main sans pouvoir la redescendre est une impasse.
    expect(keys).toContain("removeFromStage")
    expect(keys).not.toContain("exclude")
  })

  it("`canExclude` ouvre l'exclusion ET la réintégration", () => {
    const keys = accordees({
      isHost: false,
      delegation: delegation({ canExclude: true }),
      isSpeaker: false,
    })
    expect(keys).toContain("exclude")
    // Exclure sans pouvoir réintégrer ferait de chaque erreur une peine
    // définitive que seul l'hôte pourrait lever.
    expect(keys).toContain("reinstate")
    expect(keys).not.toContain("admitToStage")
  })

  it("`canEndOrTransfer` ouvre la fin, jamais la délégation", () => {
    const keys = accordees({
      isHost: false,
      delegation: delegation({ kind: "cohost", canEndOrTransfer: true }),
      isSpeaker: false,
    })
    expect(keys).toContain("endOrTransfer")
    expect(keys).not.toContain("delegate")
  })

  it("audience et replay ne se délèguent JAMAIS, tous drapeaux levés", () => {
    const keys = accordees({
      isHost: false,
      delegation: delegation({
        kind: "cohost",
        canAdmitToStage: true,
        canExclude: true,
        canEndOrTransfer: true,
      }),
      isSpeaker: true,
    })
    expect(keys).not.toContain("changeAudienceOrReplay")
    expect(keys).not.toContain("delegate")
    // Tout le reste, en revanche, est bien là.
    expect(keys).toEqual(
      [
        "admitToStage",
        "removeFromStage",
        "moderateChat",
        "exclude",
        "reinstate",
        "closeChat",
        "endOrTransfer",
      ].sort(),
    )
  })
})

describe("publier n'est pas gérer", () => {
  it("un intervenant sans délégation n'a AUCUNE permission", () => {
    expect(
      accordees({ isHost: false, delegation: null, isSpeaker: true }),
    ).toEqual([])
  })

  it("un spectateur non plus", () => {
    expect(
      accordees({ isHost: false, delegation: null, isSpeaker: false }),
    ).toEqual([])
  })

  it("`isSpeaker` ne change RIEN à une matrice, quelle qu'elle soit", () => {
    for (const isHost of [true, false]) {
      for (const row of [null, delegation({ canExclude: true })]) {
        expect(
          directPermissionsFor({ isHost, delegation: row, isSpeaker: true }),
        ).toEqual(
          directPermissionsFor({ isHost, delegation: row, isSpeaker: false }),
        )
      }
    }
  })
})

describe("les outils autour de la matrice", () => {
  it("`noDirectPermissions` couvre les NEUF clés, toutes fausses", () => {
    const none = noDirectPermissions()
    expect(Object.keys(none).sort()).toEqual([...DIRECT_PERMISSION_KEYS].sort())
    expect(Object.values(none).every((value) => value === false)).toBe(true)
  })

  it("`hasAnyDirectManagement` est fail-closed sur l'absence", () => {
    expect(hasAnyDirectManagement(undefined)).toBe(false)
    expect(hasAnyDirectManagement(null)).toBe(false)
    expect(hasAnyDirectManagement(noDirectPermissions())).toBe(false)
    expect(
      hasAnyDirectManagement({ ...noDirectPermissions(), moderateChat: true }),
    ).toBe(true)
  })

  it("les DÉFAUTS distinguent les deux genres, la matrice non", () => {
    expect(defaultDelegationFlags("cohost").canAdmitToStage).toBe(true)
    expect(defaultDelegationFlags("moderator").canAdmitToStage).toBe(false)
    // Exclure et terminer ne sont JAMAIS un défaut : ils se cochent.
    for (const kind of ["cohost", "moderator"] as const) {
      expect(defaultDelegationFlags(kind).canExclude).toBe(false)
      expect(defaultDelegationFlags(kind).canEndOrTransfer).toBe(false)
    }
  })

  it("chaque genre a un libellé français distinct", () => {
    expect(directDelegationKindLabel("cohost")).toBe("Cohôte")
    expect(directDelegationKindLabel("moderator")).toBe("Modérateur")
  })

  it("aucune clé de la liste de référence n'est oubliée par la matrice", () => {
    // Garde-fou du cliquet lui-même : ajouter une clé au type sans l'ajouter
    // aux deux constructeurs rendrait `undefined` là où l'écran attend `false`.
    const keys: DirectPermissionKey[] = [...DIRECT_PERMISSION_KEYS]
    expect(keys).toHaveLength(9)
    const p = directPermissionsFor({
      isHost: false,
      delegation: delegation(),
      isSpeaker: false,
    })
    for (const key of keys) expect(typeof p[key]).toBe("boolean")
  })
})
