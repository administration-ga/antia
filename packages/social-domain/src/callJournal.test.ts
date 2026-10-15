// Dupliqué de socle/convex/modules/iappel/scope.test.ts @ ad2e7fdc2 — adaptations : cas de portée poste / personnel (`resolveCallScope`) et d'environnement (`callSideOf` par environnement, `isCrossEnvironmentSelfCall`, `DEFAULT_CALL_ENVIRONMENT`) retirés avec leur code ; refus automatiques du moteur (sans `outside_hours` ni `secretariat_unavailable`) ; cas ajoutés : listes source des validateurs, états établis, en sonnerie et terminaux.
import { describe, expect, it } from "vitest"

import {
  AUTO_DECLINE_REASONS,
  CALL_ADMISSION_REASONS,
  CALL_END_REASONS,
  callSideOf,
  categorizeCall,
  isAutoDeclineReason,
  isLiveCallStatus,
  isRingingCallStatus,
  isTerminalCallStatus,
} from "./callJournal"

const MOI = "person-moi"
const AUTRE = "person-autre"

describe("categorizeCall — qui a composé le numéro", () => {
  it("un appel REÇU est entrant", () => {
    expect(categorizeCall({ createdBy: AUTRE }, MOI).category).toBe("incoming")
  })

  it("un appel que j'ai passé est sortant", () => {
    expect(categorizeCall({ createdBy: MOI }, MOI).category).toBe("outgoing")
  })

  it("un appel sans réponse est manqué", () => {
    expect(categorizeCall({ createdBy: AUTRE, callStatus: "missed" }, MOI).category).toBe("missed")
  })

  it("un refus humain est un refus", () => {
    const category = categorizeCall({ createdBy: AUTRE, callStatus: "declined" }, MOI)
    expect(category.category).toBe("declined")
    expect(category.reason).toBeNull()
  })

  it("les quatre refus AUTOMATIQUES sont distingués, avec leur raison", () => {
    for (const reason of ["dnd", "busy", "in_meeting", "outside_relations"] as const) {
      const category = categorizeCall({ createdBy: MOI, callStatus: "declined", endReason: reason }, MOI)
      expect(category.category).toBe("auto_declined")
      expect(category.reason).toBe(reason)
    }
  })

  it("un refus automatique n'est PAS rangé comme un refus humain", () => {
    // Sinon l'appelant croirait que quelqu'un a vu son appel et l'a écarté.
    expect(categorizeCall({ createdBy: MOI, callStatus: "declined", endReason: "dnd" }, MOI).category).not.toBe("declined")
  })

  it("une fin normale reste classée par sa direction", () => {
    expect(categorizeCall({ createdBy: AUTRE, callStatus: "ended", endReason: "normal" }, MOI).category).toBe("incoming")
  })

  it("un appel `offline` se range en MANQUÉ, sans raison de refus", () => {
    const category = categorizeCall({ createdBy: AUTRE, callStatus: "missed", endReason: "offline" }, MOI)
    expect(category.category).toBe("missed")
    expect(category.reason).toBeNull()
  })
})

describe("isAutoDeclineReason", () => {
  it("reconnaît les raisons de RÉGLAGE et rien d'autre", () => {
    expect(isAutoDeclineReason("dnd")).toBe(true)
    expect(isAutoDeclineReason("outside_relations")).toBe(true)
    expect(isAutoDeclineReason("timeout")).toBe(false)
    expect(isAutoDeclineReason(null)).toBe(false)
    expect(isAutoDeclineReason(undefined)).toBe(false)
  })

  it("« offline » n'en est PAS une — être absent n'est pas refuser", () => {
    // L'y ajouter classerait un appelé simplement absent en « refusé
    // automatiquement » dans les DEUX journaux : `categorizeCall` teste cette
    // liste AVANT `callStatus === "missed"`.
    expect(isAutoDeclineReason("offline")).toBe(false)
    expect(AUTO_DECLINE_REASONS).not.toContain("offline")
  })

  it("les raisons du socle propres aux postes n'existent pas dans le moteur", () => {
    expect(isAutoDeclineReason("outside_hours")).toBe(false)
    expect(isAutoDeclineReason("secretariat_unavailable")).toBe(false)
  })
})

describe("callSideOf — un seul critère : qui a composé", () => {
  it("l'appel d'un autre : je suis l'appelé ; le mien : l'appelant", () => {
    expect(callSideOf({ createdBy: AUTRE }, MOI)).toBe("callee")
    expect(callSideOf({ createdBy: MOI }, MOI)).toBe("caller")
  })
})

describe("les états d'un appel", () => {
  it("établi = décroché ou parqué ; en sonnerie = composé ou qui sonne ; terminal = les trois fins", () => {
    expect(["connected", "on_hold"].every(isLiveCallStatus)).toBe(true)
    expect(isLiveCallStatus("ringing")).toBe(false)
    expect(["initiating", "ringing"].every(isRingingCallStatus)).toBe(true)
    expect(isRingingCallStatus("connected")).toBe(false)
    expect(["ended", "missed", "declined"].every(isTerminalCallStatus)).toBe(true)
    expect(isTerminalCallStatus("on_hold")).toBe(false)
  })

  it("chaque raison d'admission est aussi une fin d'appel (un refus est inscrit déjà terminé, avec sa raison)", () => {
    for (const reason of CALL_ADMISSION_REASONS) expect(CALL_END_REASONS).toContain(reason)
  })
})
