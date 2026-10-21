/**
 * P16 — confiance et cycle des données du commerce (tests ÉCRITS, NON EXÉCUTÉS, décision du
 * propriétaire du 18/10/2026 « Continuer sans vérifier »).
 *
 * Inventaire relu des tables ajoutées par P07–P15 : chacune existe dans le schéma, porte une
 * disposition explicite, et aucune ligne n'est exportable ni effaçable à la demande d'une autre
 * personne. Un blocage commercial est une intention de PAIRE : il suit le demandeur ; le membre
 * d'équipe qui l'a posé n'en est qu'une référence d'audit, anonymisée à son effacement.
 */
import { describe, expect, it } from "vitest"

import { anonymizeReferences, dataTableNames, directlyOwned, exportableRecord, shapeFor, type DataRecord } from "./dataInventory"
import { DATA_TABLE_POLICIES } from "./dataPolicies"

const COMMERCE_TABLES = [
  // P07 — boutiques et politique de vitrine.
  "shops", "shopNetworkPolicies",
  // P08 — liaison et transport.
  "shopCommerceSubjects", "shopCommerceShopRefs", "shopCommerceLinks", "shopCommerceLinkChallenges", "shopCommerceLinkCommands", "federationCommerceProbes",
  // P09 — catalogue reflété et médias admis.
  "shopCatalogPolicies", "commerceCatalogMappings", "commerceCatalogHeads", "commerceCatalogMediaAssets",
  // P10 — contact commercial et transfert CRM.
  "commercialThreads", "commercialMessages", "shopContactMandates", "commercialBlocks", "commercialReadStates", "shopContactSettings", "commercialNetworkPolicies",
  "shopCommerceBuyerSubjects", "commercialCrmTransfers",
  // P11 — préparation privée.
  "shopCheckoutPolicies", "checkoutAttempts", "checkoutRequests", "checkoutClientIntentFences",
  // P12 — paiement privé.
  "shopPaymentPolicies", "shopPaymentOptions", "shopPaymentAttempts", "shopPaymentRequests",
  // P13 — achats privés.
  "shopPurchaseSnapshots", "shopPurchaseRequests",
  // P14 — services, devis et rendez-vous.
  "commerceServicePolicies", "commerceServiceRequests", "commerceServiceCommands",
  // P15 — emploi et candidatures.
  "commerceJobPolicies", "commerceJobHeads", "commerceApplicationSubjects", "commerceApplicationFiles", "commerceApplications",
  // DG-011–016 — catalogue de page, demandes personnelles, propositions, rendez-vous et avis.
  "serviceOffers", "serviceRequests", "serviceProposals", "serviceBookings", "serviceReviews", "serviceReviewReplies",
] as const

const OWNER = "owner_person", STRANGER = "stranger_person"

describe("P16 — inventaire des tables commerciales", () => {
  it("chaque table commerciale existe dans le schéma et porte une disposition explicite", () => {
    const names = new Set(dataTableNames())
    for (const table of COMMERCE_TABLES) {
      expect(names.has(table), table).toBe(true)
      expect(Object.prototype.hasOwnProperty.call(DATA_TABLE_POLICIES, table), table).toBe(true)
    }
  })

  it("aucune table commerciale nouvelle n'échappe à cette revue (classement à relire avant ajout)", () => {
    const commerceLike = dataTableNames().filter((name) => /^(shop|commerce|commercial|checkout|service)/u.test(name) || name === "federationCommerceProbes")
    expect(commerceLike.filter((name) => !(COMMERCE_TABLES as readonly string[]).includes(name))).toEqual([])
  })

  it("autre personne : aucune ligne commerciale ne lui est exportable ni effaçable à sa demande", () => {
    const row: DataRecord = {
      _id: "row_1", _creationTime: 1, networkId: "network_1", shopId: "shop_1", threadId: "thread_1",
      personId: OWNER, requesterPersonId: OWNER, senderPersonId: OWNER, ownerPersonId: OWNER, preparedByPersonId: OWNER,
      publicConsentByPersonId: OWNER, updatedByPersonId: OWNER, assignedRespondentPersonId: OWNER,
      rawBody: '{"address":"privée"}', sessionDigest: "session-proof", subjectRef: "antsia:sub:opaque", leaseToken: "lease",
    }
    for (const table of COMMERCE_TABLES) {
      expect(exportableRecord(table, row, STRANGER), table).toBeNull()
      expect(directlyOwned(table, row, STRANGER), table).toBe(false)
    }
  })

  it("une réponse de la boutique n'appartient pas au demandeur : ni export ni effacement par lui", () => {
    const reply: DataRecord = { _id: "message_1", _creationTime: 1, networkId: "network_1", threadId: "thread_1", senderPersonId: "team_member", senderKind: "shop", content: "Disponible.", idempotencyKey: "key", digest: "digest", createdAt: 1 }
    expect(exportableRecord("commercialMessages", reply, "buyer")).toBeNull()
    expect(directlyOwned("commercialMessages", reply, "buyer")).toBe(false)
    expect(directlyOwned("commercialMessages", reply, "team_member")).toBe(true)
  })
})

describe("P16 — revue des services ajoutés à l'inventaire", () => {
  const metadata = { _id: "row", _creationTime: 1, networkId: "network", createdAt: 1 }

  it("DG-011 : le catalogue appartient à la page, sans droit personnel sur son contenu", () => {
    const offer: DataRecord = { ...metadata, pageId: "page", title: "Offre de la page" }
    expect(DATA_TABLE_POLICIES.serviceOffers).toEqual({ shared: true })
    for (const person of [OWNER, STRANGER]) {
      expect(directlyOwned("serviceOffers", offer, person)).toBe(false)
      expect(exportableRecord("serviceOffers", offer, person)).toBeNull()
    }
  })

  it("DG-014 : seul le demandeur possède sa demande ; le signataire de clôture reste une référence", () => {
    const request: DataRecord = { ...metadata, requesterPersonId: OWNER, closedByPersonId: STRANGER, need: "Besoin du demandeur" }
    expect(DATA_TABLE_POLICIES.serviceRequests).toEqual({ owners: ["requesterPersonId"] })
    expect(directlyOwned("serviceRequests", request, OWNER)).toBe(true)
    expect(exportableRecord("serviceRequests", request, OWNER)).toMatchObject({ need: request.need })
    expect(directlyOwned("serviceRequests", request, STRANGER)).toBe(false)
    expect(exportableRecord("serviceRequests", request, STRANGER)).toBeNull()
    expect(anonymizeReferences(request, shapeFor("serviceRequests"), STRANGER, "anonymous")).toEqual({ ...metadata, requesterPersonId: OWNER, need: request.need })
  })

  it.each([
    ["serviceProposals", "requestId"],
    ["serviceReviewReplies", "reviewId"],
  ] as const)("%s : la signature de page ne possède pas le contenu ; l'effacement suit %s", (table, parent) => {
    const row: DataRecord = { ...metadata, [parent]: "parent", authorPersonId: OWNER, body: "Contenu de la page", details: "Proposition de la page" }
    expect(DATA_TABLE_POLICIES[table]).toEqual({ owners: [], parents: [parent] })
    for (const person of [OWNER, STRANGER]) {
      expect(directlyOwned(table, row, person)).toBe(false)
      expect(exportableRecord(table, row, person)).toBeNull()
    }
    expect(anonymizeReferences(row, shapeFor(table), OWNER, "anonymous")).toEqual({ ...row, authorPersonId: "anonymous" })
  })

  it("DG-015 : le rendez-vous suit sa demande, sans référence personnelle propriétaire", () => {
    const booking: DataRecord = { ...metadata, requestId: "request", proposalId: "proposal", pageId: "page", reason: "Motif de clôture" }
    expect(DATA_TABLE_POLICIES.serviceBookings).toEqual({ parents: ["requestId"] })
    for (const person of [OWNER, STRANGER]) {
      expect(directlyOwned("serviceBookings", booking, person)).toBe(false)
      expect(exportableRecord("serviceBookings", booking, person)).toBeNull()
    }
  })

  it("DG-016 : l'avis est au seul auteur et disparaît avec la demande", () => {
    const review: DataRecord = { ...metadata, authorPersonId: OWNER, requestId: "request", body: "Avis personnel" }
    expect(DATA_TABLE_POLICIES.serviceReviews).toEqual({ owners: ["authorPersonId"], parents: ["requestId"] })
    expect(directlyOwned("serviceReviews", review, OWNER)).toBe(true)
    expect(exportableRecord("serviceReviews", review, OWNER)).toMatchObject({ body: review.body })
    expect(directlyOwned("serviceReviews", review, STRANGER)).toBe(false)
    expect(exportableRecord("serviceReviews", review, STRANGER)).toBeNull()
  })
})

describe("P16 — blocage commercial : protection de la boutique et minimisation", () => {
  const shopSide: DataRecord = { _id: "block_1", _creationTime: 1, networkId: "network_1", threadId: "thread_1", shopId: "shop_1", personId: "team_member", requesterPersonId: "buyer", side: "shop", createdAt: 1 }

  it("l'effacement du membre d'équipe ne lève pas le blocage : la ligne est anonymisée, pas supprimée", () => {
    expect(directlyOwned("commercialBlocks", shopSide, "team_member")).toBe(false)
    const anonymized = anonymizeReferences(shopSide, shapeFor("commercialBlocks"), "team_member", "anonymous_person") as Record<string, unknown>
    expect(anonymized).toMatchObject({ personId: "anonymous_person", requesterPersonId: "buyer", side: "shop", shopId: "shop_1", threadId: "thread_1" })
  })

  it("l'effacement du demandeur emporte ses blocages, des deux côtés", () => {
    expect(directlyOwned("commercialBlocks", shopSide, "buyer")).toBe(true)
    expect(directlyOwned("commercialBlocks", { ...shopSide, _id: "block_2", personId: "buyer", side: "requester" }, "buyer")).toBe(true)
  })

  it("export : au seul auteur du geste, sans identité du membre ni du demandeur", () => {
    expect(exportableRecord("commercialBlocks", shopSide, "buyer")).toBeNull()
    const own = exportableRecord("commercialBlocks", shopSide, "team_member")
    expect(own).toMatchObject({ side: "shop", shopId: "shop_1", threadId: "thread_1" })
    expect(own).not.toHaveProperty("requesterPersonId")
    expect(own).not.toHaveProperty("personId")
    expect(exportableRecord("commercialBlocks", { ...shopSide, _id: "block_2", personId: "buyer", side: "requester" }, "buyer")).toMatchObject({ side: "requester" })
  })
})
