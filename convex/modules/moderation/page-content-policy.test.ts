// @vitest-environment edge-runtime
import { engineErrorCode } from "@antsia/social-contracts/errors"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { internal } from "../../_generated/api"
import type { Id } from "../../_generated/dataModel"
import { SEED_CONFIRMATION } from "../../seeds/foundations"
import { testConvex } from "../../test.setup"
import { moderatePageContentWrite } from "./policy"

type T = ReturnType<typeof testConvex>
const NOW = Date.UTC(2026, 9, 18, 12)
const TEXT = "Réponse collective à une expérience partagée."

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(NOW)
})

afterEach(() => {
  vi.useRealTimers()
})

async function fixture() {
  const t = testConvex()
  const { root, testClosed } = await t.mutation(internal.seeds.foundations.run, { confirmNonProduction: SEED_CONFIRMATION })
  const page = (networkId: Id<"networks">, handle: string) => t.run((ctx) => ctx.db.insert("pages", {
    networkId, handle, name: handle, ownerKind: "company", trust: "community", trustRank: 0,
    visibility: "network", onRoot: networkId === root, status: "active", searchText: handle,
    createdAt: NOW, updatedAt: NOW,
  }))
  const pageA = await page(root, "page-a-recette")
  const pageB = await page(root, "page-b-recette")
  const childPage = await page(testClosed, "page-enfant-recette")
  return { t, root, testClosed, pageA, pageB, childPage }
}

type Fixture = Awaited<ReturnType<typeof fixture>>

function write(f: Fixture, id: string, options: { networkId?: Id<"networks">; pageId?: Id<"pages">; text?: string } = {}) {
  // Cible interne de la politique seulement : aucune fausse prestation ni projection sociale.
  return f.t.run((ctx) => moderatePageContentWrite(ctx, {
    networkId: options.networkId ?? f.root,
    pageId: options.pageId ?? f.pageA,
    kind: "serviceReviewReply",
    id,
    text: options.text ?? TEXT,
  }))
}

async function state(t: T, id: string) {
  const row = await t.run((ctx) => ctx.db.query("moderationContentStates")
    .withIndex("by_target", (q) => q.eq("targetKind", "serviceReviewReply").eq("targetId", id)).unique())
  if (!row) throw new Error("État de modération de fixture absent")
  return row
}

function allowPageReplies(f: Fixture, maxWrites = 1) {
  return f.t.run((ctx) => ctx.db.insert("moderationPolicies", {
    networkId: f.root, surface: "serviceReviewReply", preReview: false,
    maxLinks: 2, maxWrites, windowMs: 60_000, updatedAt: NOW,
  }))
}

async function errorCode(promise: Promise<unknown>) {
  try { await promise; return null } catch (error) { return engineErrorCode(error) }
}

describe("DG-016 — politique des réponses collectives de page", () => {
  it("sans politique explicite, garde la réponse en attente et attribue son état à la page seule", async () => {
    const f = await fixture()
    expect(await write(f, "policy-reply-without-policy")).toBe(false)
    const first = await state(f.t, "policy-reply-without-policy")
    expect(first).toMatchObject({
      networkId: f.root, targetKind: "serviceReviewReply", targetId: "policy-reply-without-policy",
      ownerPageId: f.pageA, status: "pending_review", createdAt: NOW, updatedAt: NOW,
    })
    expect(first.ownerPersonId).toBeUndefined()
    expect(JSON.stringify(first)).not.toContain(TEXT)

    expect(await write(f, "policy-reply-without-policy", { text: "Réponse corrigée avant décision de modération." })).toBe(false)
    const edited = await state(f.t, "policy-reply-without-policy")
    expect(edited._id).toBe(first._id)
    expect(edited.status).toBe("pending_review")
    expect(edited.ownerPageId).toBe(f.pageA)
    expect(edited.ownerPersonId).toBeUndefined()
  })

  it("borne les écritures par page, sans compter une édition comme une seconde réponse", async () => {
    const f = await fixture()
    await allowPageReplies(f)
    expect(await write(f, "policy-reply-page-a-first")).toBe(true)
    const original = await state(f.t, "policy-reply-page-a-first")
    expect(await write(f, "policy-reply-page-a-first", { text: "La même réponse est corrigée par l’équipe." })).toBe(true)
    const edited = await state(f.t, "policy-reply-page-a-first")
    expect(edited._id).toBe(original._id)
    expect(edited.status).toBe("published")
    expect(edited.ownerPersonId).toBeUndefined()

    expect(await write(f, "policy-reply-page-b-first", { pageId: f.pageB })).toBe(true)
    expect(await write(f, "policy-reply-page-a-second")).toBe(false)
    expect((await state(f.t, "policy-reply-page-a-second")).status).toBe("pending_review")
    expect((await state(f.t, "policy-reply-page-b-first")).status).toBe("published")
    const pageAStates = await f.t.run((ctx) => ctx.db.query("moderationContentStates")
      .withIndex("by_network_page_updatedAt", (q) => q.eq("networkId", f.root).eq("ownerPageId", f.pageA).gte("updatedAt", NOW - 60_000)).take(3))
    expect(pageAStates).toHaveLength(2)
  })

  it("un état retiré reste retiré malgré une politique permettant les nouvelles réponses", async () => {
    const f = await fixture()
    await allowPageReplies(f)
    expect(await write(f, "policy-reply-removed")).toBe(true)
    const original = await state(f.t, "policy-reply-removed")
    await f.t.run((ctx) => ctx.db.patch(original._id, { status: "removed" }))
    const removed = await state(f.t, "policy-reply-removed")

    expect(await errorCode(write(f, "policy-reply-removed", { text: "Tentative de republication du même contenu." }))).toBe("policyRefused")
    expect(await state(f.t, "policy-reply-removed")).toEqual(removed)
  })

  it("refuse indistinctement un autre réseau ou une autre page et préserve l'état propriétaire", async () => {
    const f = await fixture()
    await allowPageReplies(f)
    expect(await write(f, "policy-reply-owned")).toBe(true)
    const original = await state(f.t, "policy-reply-owned")

    expect(await errorCode(write(f, "policy-reply-owned", { pageId: f.pageB }))).toBe("notFound")
    expect(await errorCode(write(f, "policy-reply-owned", { networkId: f.testClosed, pageId: f.childPage }))).toBe("notFound")
    expect(await state(f.t, "policy-reply-owned")).toEqual(original)
  })
})
