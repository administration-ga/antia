/**
 * CC-5 — décisions PURES de l'interface contextuelle (écrit le 19/10/2026, NON EXÉCUTÉ :
 * décision du propriétaire « Continuer sans vérifier »). Clés de l'i18n réelle du moteur (FR).
 */
import { afterEach, describe, expect, it } from "vitest"

import { createAppI18n } from "../../i18n"
import {
  contextualBubbles,
  contextualCallee,
  contextualCallNeedsTarget,
  contextualCallNotes,
  contextualCallsRelevant,
  contextualCounterpartName,
  contextualDraftKey,
  contextualDraftStore,
  contextualErrorText,
  contextualMessageActions,
  contextualReadReceipt,
  contextualSendBlockKey,
  contextualSenderName,
  contextualVisibleState,
  contextualVoiceText,
  filterContextualThreads,
  orderedContextualMessages,
  type ContextualMessageView,
  type ContextualThreadView,
} from "./contextual-conversation-model"
import { MessageSendInProgress } from "./messagerie-send-intent"

const t = createAppI18n({ locale: "fr", appResources: { fr: {}, en: {} }, defaultNS: "messagerie" }).getFixedT("fr")

const PAGE = { name: "Atelier Mbolo", handle: "atelier-mbolo", logoUrl: null }
/** CC-4 : MES réglages d'appel tels que la projection les porte — ici, aucun réglage actif. */
const SETTINGS_NONE = { outsideRelationsSilenceWaived: false, dndUntil: null, meetingSilence: false, callWaitingOff: false, incomingPushOff: false }
const BILAL = { displayName: "Bilal", handle: "bilal", avatarUrl: null }
const AWA = { displayName: "Awa", handle: "awa", avatarUrl: null }

function thread(overrides: Partial<ContextualThreadView> = {}): ContextualThreadView {
  return {
    threadId: "thread-1",
    kind: "diasporaServiceRequest",
    object: { kind: "diasporaServiceRequest", id: "request-1" },
    viewer: { side: "requester", voice: "person" },
    counterpart: { kind: "page", page: PAGE },
    state: { kind: "open" },
    capabilities: { canSend: true, canAttach: true, canClose: true, canSetCallConsent: false, canCall: false },
    sendRefusal: null,
    callConsent: false,
    callTargets: [],
    callSettings: SETTINGS_NONE,
    unread: false,
    revision: 3,
    lastMessageAt: 2_000,
    createdAt: 1_000,
    ...overrides,
  }
}

function message(overrides: Partial<ContextualMessageView> = {}): ContextualMessageView {
  return {
    messageId: "m1",
    side: "responder",
    voice: "page",
    sender: { kind: "page", page: PAGE, teammate: AWA },
    isMine: false,
    content: "Bonjour, nous pouvons passer jeudi.",
    deleted: false,
    withheld: false,
    attachmentFiles: [],
    createdAt: 1_500,
    ...overrides,
  }
}

afterEach(() => contextualDraftStore.__resetForTests())

describe("voix : une page parle d'une seule voix (D3, N33)", () => {
  it("le demandeur ne voit jamais le signataire, même si une réponse le portait par erreur", () => {
    expect(contextualSenderName(message(), "requester", t)).toBe("Atelier Mbolo")
    const bubbles = contextualBubbles([message()], { selfId: "persons_me", viewerSide: "requester" }, t)
    expect(bubbles[0]?.senderName).toBe("Atelier Mbolo")
    expect(JSON.stringify(bubbles)).not.toContain("Awa")
  })

  it("l'équipe voit son coéquipier pour se coordonner, et ses salves se coupent par coéquipier", () => {
    expect(contextualSenderName(message(), "responder", t)).toBe("Awa pour Atelier Mbolo")
    const [first, second] = contextualBubbles(
      [message(), message({ messageId: "m2", sender: { kind: "page", page: PAGE, teammate: { displayName: "Chloé", handle: "chloe", avatarUrl: null } }, createdAt: 1_600 })],
      { selfId: "persons_me", viewerSide: "responder" },
      t,
    )
    expect(first?.senderId).not.toBe(second?.senderId)
  })

  it("dit la voix du lecteur : signataire au nom de la page, demandeur face à une page, personne", () => {
    expect(contextualVoiceText(thread(), t)).toBe("Vous échangez avec l'équipe de Atelier Mbolo, qui vous répond d'une seule voix.")
    expect(contextualVoiceText(thread({ viewer: { side: "responder", voice: "page" }, counterpart: { kind: "person", label: BILAL } }), t)).toBe(
      "Vous écrivez au nom de la page : Bilal voit la page, jamais votre nom.",
    )
    expect(contextualVoiceText(thread({ kind: "diasporaMentoring", counterpart: { kind: "person", label: BILAL } }), t)).toBe("Vous écrivez sous votre nom publié.")
  })

  it("nomme l'autre côté sans jamais inventer un identifiant", () => {
    expect(contextualCounterpartName(thread(), t)).toBe("Atelier Mbolo")
    expect(contextualCounterpartName(thread({ counterpart: { kind: "page", page: null } }), t)).toBe("Page indisponible")
    expect(contextualCounterpartName(thread({ counterpart: { kind: "person", label: { displayName: null, handle: "bilal", avatarUrl: null } } }), t)).toBe("@bilal")
    expect(contextualCounterpartName(thread({ counterpart: { kind: "person", label: { displayName: null, handle: null, avatarUrl: null } } }), t)).toBe("Membre au profil retiré")
  })
})

describe("bulles : aucune promesse non prouvée", () => {
  it("ordonne, dédoublonne (la dernière projection gagne) et ne dessine ni accusé, ni réaction, ni citation", () => {
    const rows = orderedContextualMessages([message({ messageId: "b", createdAt: 20 }), message({ messageId: "a", createdAt: 10 }), message({ messageId: "b", createdAt: 20, content: "corrigé" })])
    expect(rows.map((row) => [row.messageId, row.content])).toEqual([["a", "Bonjour, nous pouvons passer jeudi."], ["b", "corrigé"]])
    const [bubble] = contextualBubbles([message()], { selfId: "persons_me", viewerSide: "requester" }, t)
    expect(bubble).toMatchObject({ reply: null, reactions: null, forwarded: false, pinned: false, systemText: null, editedAt: null })
    expect(bubble).not.toHaveProperty("readAt")
  })

  it("un message retenu se lit masqué, sans contenu ni pièce ; un message retiré, supprimé", () => {
    const file = { filename: "devis.pdf", mimeType: "application/pdf", sizeBytes: 10, durationMs: null, url: "https://fichiers.test/devis", withheld: null }
    const [withheld, deleted] = contextualBubbles(
      [message({ withheld: true, content: null, attachmentFiles: [file] }), message({ messageId: "m2", deleted: true, content: null, createdAt: 1_600 })],
      { selfId: "persons_me", viewerSide: "requester" },
      t,
    )
    expect(withheld).toMatchObject({ masked: true, text: null, attachments: [] })
    expect(deleted).toMatchObject({ deleted: true, masked: false, text: null })
  })

  it("mon propre message est le mien, quelle que soit sa voix", () => {
    const [bubble] = contextualBubbles([message({ isMine: true, side: "responder" })], { selfId: "persons_me", viewerSide: "responder" }, t)
    expect(bubble?.senderId).toBe("persons_me")
  })
})

describe("états visibles et refus explicites (§3.4, §5.3)", () => {
  it("ouverte, fermée, indisponible — jamais « bloquée » ni « absente »", () => {
    expect(contextualVisibleState(thread())).toBe("open")
    expect(contextualVisibleState(thread({ state: { kind: "read_only", reason: "closed" } }))).toBe("closed")
    expect(contextualVisibleState(thread({ state: { kind: "read_only", reason: "unavailable" } }))).toBe("unavailable")
  })

  it("le composeur cède la place au refus explicite du moteur, sinon au statut insuffisant", () => {
    expect(contextualSendBlockKey(thread())).toBeNull()
    expect(contextualSendBlockKey(thread({ capabilities: { ...thread().capabilities, canSend: false }, sendRefusal: "CONTEXT_WAITING_RESPONDER" }))).toBe("rules:CONTEXT_WAITING_RESPONDER")
    expect(contextualSendBlockKey(thread({ capabilities: { ...thread().capabilities, canSend: false }, sendRefusal: null }))).toBe("errors:statusInsufficient")
    expect(t("rules:CONTEXT_WAITING_RESPONDER")).toBe("Vous pourrez écrire dès la première réponse de l'autre partie.")
  })

  it("traduit le code FERMÉ de la tranche par l'application, sinon une phrase neutre — jamais le code brut", () => {
    const addressRefusal = { data: { code: "invalidArgument", appRule: "context_address_forbidden", appParams: {} } }
    const describe = (code: string) => (code === "context_address_forbidden" ? "Retirez l'adresse exacte : indiquez seulement une ville ou un quartier." : null)
    expect(contextualErrorText(addressRefusal, t, describe)).toBe("Retirez l'adresse exacte : indiquez seulement une ville ou un quartier.")
    const neutral = contextualErrorText(addressRefusal, t)
    expect(neutral).toBe("Ce message ne respecte pas une règle de cette mise en relation. Modifiez-le avant de l'envoyer.")
    expect(neutral).not.toContain("context_address_forbidden")
  })

  it("une règle du domaine, un conflit d'idempotence, un envoi déjà en cours et une trace serveur", () => {
    expect(contextualErrorText({ data: { code: "conflict", rule: "CONTEXT_IDEMPOTENCY_CONFLICT" } }, t)).toBe("Ce message a déjà été envoyé avec un autre contenu. Rédigez-le à nouveau.")
    expect(contextualErrorText(new MessageSendInProgress(), t)).toBe("Un envoi est déjà en cours dans cette conversation.")
    expect(contextualErrorText(new Error("[CONVEX M(modules/contextualMessaging/messages:send)] Server Error"), t)).not.toContain("CONVEX")
  })
})

describe("gestes d'une bulle (§8, §10.1)", () => {
  it("copier et signaler le message d'en face ; jamais de réaction, de transfert ni d'épingle", () => {
    expect(contextualMessageActions(message(), "requester")).toEqual(["copier", "signaler"])
  })
  it("retirer son propre message, jamais le signaler", () => {
    expect(contextualMessageActions(message({ isMine: true, side: "requester", voice: "person" }), "requester")).toEqual(["copier", "retirer"])
  })
  it("un signataire ne signale pas la voix de sa propre page ; un message illisible ne se signale pas", () => {
    expect(contextualMessageActions(message(), "responder")).toEqual(["copier"])
    expect(contextualMessageActions(message({ withheld: true, content: null }), "requester")).toEqual([])
    expect(contextualMessageActions(message({ deleted: true, content: null, isMine: true, side: "requester" }), "requester")).toEqual([])
  })
})

describe("appels : MES réglages, jamais ceux d'en face (D5 amendé)", () => {
  it("dit la règle, puis l'effet de mon silence hors relations avant et après l'accord, et mon « ne pas déranger »", () => {
    const now = 1_000_000
    expect(contextualCallNotes({ consent: false, settings: SETTINGS_NONE, now })).toEqual(["rule"])
    expect(contextualCallNotes({ consent: false, settings: { ...SETTINGS_NONE, outsideRelationsSilenceWaived: true }, now })).toEqual(["rule", "silentOverrideIfConsent"])
    expect(contextualCallNotes({ consent: true, settings: { ...SETTINGS_NONE, outsideRelationsSilenceWaived: true, dndUntil: now + 60_000 }, now })).toEqual(["rule", "silentOverride", "dndActive"])
  })
  it("un « ne pas déranger » échu ne se dit plus ; silence de réunion, signal d'appel et sonnerie hors onglet se disent", () => {
    const now = 1_000_000
    expect(contextualCallNotes({ consent: true, settings: { ...SETTINGS_NONE, dndUntil: now - 1 }, now })).toEqual(["rule"])
    expect(contextualCallNotes({ consent: true, settings: { ...SETTINGS_NONE, meetingSilence: true, callWaitingOff: true, incomingPushOff: true }, now })).toEqual([
      "rule",
      "meetingSilence",
      "callWaitingOff",
      "incomingPushOff",
    ])
  })
  it("CC-4 : plusieurs signataires consentants sans choix — « choisissez la personne », jamais l'argument brut", () => {
    expect(contextualErrorText({ data: { code: "invalidArgument", field: "targetPersonId" } }, t)).toBe("Choisissez la personne de l'équipe à appeler.")
    expect(contextualErrorText({ data: { code: "invalidArgument", rule: "CONTEXT_CALL_CONSENT_REQUIRED" } }, t)).toBe("Un appel exige l'accord des deux parties dans cette conversation.")
  })
  it("un accord donné se retire toujours ; la cible se choisit seulement face à une page", () => {
    expect(contextualCallsRelevant(thread())).toBe(false)
    expect(contextualCallsRelevant(thread({ callConsent: true }))).toBe(true)
    expect(contextualCallNeedsTarget(thread())).toBe(true)
    expect(contextualCallNeedsTarget(thread({ viewer: { side: "responder", voice: "page" }, counterpart: { kind: "person", label: BILAL } }))).toBe(false)
  })
  it("la fenêtre d'appel nomme le signataire CONSENTANT choisi, sinon la personne d'en face", () => {
    const targets = [{ personId: "persons_awa", label: AWA }]
    expect(contextualCallee(thread({ callTargets: targets }), "persons_awa", t)).toEqual({ name: "Awa", handle: "awa", avatarUrl: null })
    expect(contextualCallee(thread({ callTargets: targets }), "persons_inconnu", t).name).toBe("Atelier Mbolo")
    expect(contextualCallee(thread({ viewer: { side: "responder", voice: "page" }, counterpart: { kind: "person", label: BILAL } }), null, t)).toEqual({ name: "Bilal", handle: "bilal", avatarUrl: null })
  })
})

describe("liste, lecture marquée et brouillon", () => {
  it("cherche localement sur le nom, l'identifiant et la nature, sans accents", () => {
    const threads = [thread(), thread({ threadId: "thread-2", kind: "diasporaMentoring", counterpart: { kind: "person", label: BILAL } })]
    expect(filterContextualThreads(threads, "", t)).toBe(threads)
    expect(filterContextualThreads(threads, "atelier", t).map((row) => row.threadId)).toEqual(["thread-1"])
    expect(filterContextualThreads(threads, "MENTORAT", t).map((row) => row.threadId)).toEqual(["thread-2"])
  })
  it("acquitte une fois par dernier message, et seulement messages affichés", () => {
    expect(contextualReadReceipt(thread({ unread: true }), false)).toBeNull()
    expect(contextualReadReceipt(thread({ unread: false }), true)).toBeNull()
    expect(contextualReadReceipt(thread({ unread: true }), true)).toBe("thread-1:2000")
  })
  it("garde le brouillon en mémoire, par lecteur et par fil", () => {
    const mine = contextualDraftKey("owner-a", "thread-1")
    contextualDraftStore.set(mine, "Bonjour")
    expect(contextualDraftStore.get(mine)).toBe("Bonjour")
    expect(contextualDraftStore.get(contextualDraftKey("owner-b", "thread-1"))).toBe("")
    contextualDraftStore.set(mine, "")
    expect(contextualDraftStore.get(mine)).toBe("")
  })
})
