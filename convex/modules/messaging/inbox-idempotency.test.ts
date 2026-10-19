// @vitest-environment edge-runtime
import { engineErrorCode } from "@antsia/social-contracts/errors"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { api, internal } from "../../_generated/api"
import type { Id } from "../../_generated/dataModel"
import { SEED_CONFIRMATION } from "../../seeds/foundations"
import { testConvex } from "../../test.setup"

beforeEach(() => vi.stubEnv("CONVEX_CLOUD_URL", "http://127.0.0.1:3210"))
afterEach(() => vi.unstubAllEnvs())

async function pair() {
	const t = testConvex()
	const { root } = await t.mutation(internal.seeds.foundations.run, { confirmNonProduction: SEED_CONFIRMATION })
	async function enter(handle: string) {
		const as = t.withIdentity({ subject: `auth-${handle}` })
		const personId = await as.mutation(api.modules.people.persons.ensureMyPerson, {})
		await as.mutation(api.modules.people.consents.recordConsent, { purpose: "social_profile", origin: "onboarding" })
		await as.mutation(api.modules.people.profile.publishMyProfile, { handle, displayName: handle })
		await as.mutation(api.modules.people.memberships.joinNetwork, { networkId: root })
		return { as, personId, handle }
	}
	const alice = await enter("alice")
	const bob = await enter("bob")
	await t.run(async (ctx) => {
		const [low, high] = alice.personId < bob.personId ? [alice.personId, bob.personId] : [bob.personId, alice.personId]
		await ctx.db.insert("connections", { networkId: root, personIdLow: low, personIdHigh: high, requestedByPersonId: alice.personId, recipientPersonId: bob.personId, status: "accepted", requestedAt: 1, respondedAt: 1, updatedAt: 1 })
	})
	return { t, root, alice, bob, enter }
}

describe("Premier message idempotent P05", () => {
	it("rejoue le même premier message sans réadmettre ses pièces déjà rattachées", async () => {
		const { t, root, alice } = await pair()
		const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13])
		const storageId = await t.run(async (ctx) => ctx.storage.store(new Blob([bytes], { type: "image/png" })))
		const args = { networkId: root, handle: "bob", initialMessage: "Une photo", initialAttachmentFiles: [{ storageId, filename: "photo.png", mimeType: "image/png", sizeBytes: bytes.length }], idempotencyKey: "same-intention" }
		const first = await alice.as.mutation(api.modules.messaging.inbox.startThreadWithHandle, args)
		const replay = await alice.as.mutation(api.modules.messaging.inbox.startThreadWithHandle, args)
		expect(first.created).toBe(true)
		expect(replay).toEqual({ threadId: first.threadId, messageId: first.messageId, created: false })
		const page = await alice.as.query(api.modules.messaging.messages.paginateMessages, { networkId: root, threadId: first.threadId, paginationOpts: { cursor: null, numItems: 10 } })
		expect(page.page.map((message) => message.messageId)).toEqual([first.messageId])
	})

	it("une intention différente ajoute un message dans le même fil", async () => {
		const { root, alice } = await pair()
		const first = await alice.as.mutation(api.modules.messaging.inbox.startThreadWithHandle, { networkId: root, handle: "bob", initialMessage: "Premier", idempotencyKey: "first" })
		const other = await alice.as.mutation(api.modules.messaging.inbox.startThreadWithHandle, { networkId: root, handle: "bob", initialMessage: "Second", idempotencyKey: "other" })
		expect(other.threadId).toBe(first.threadId)
		expect(other.messageId).not.toBe(first.messageId)
	})

	it("ne transforme pas la clé d'un autre auteur en réussite et relit le blocage avant rejeu", async () => {
		const { root, alice, bob } = await pair()
		const args = { networkId: root, handle: "bob", initialMessage: "Bonjour", idempotencyKey: "first" }
		await alice.as.mutation(api.modules.messaging.inbox.startThreadWithHandle, args)
		async function refusal(promise: Promise<unknown>) {
			try { await promise; return null } catch (error) { return engineErrorCode(error) }
		}
		expect(await refusal(bob.as.mutation(api.modules.messaging.inbox.startThreadWithHandle, { ...args, handle: "alice" }))).toBe("notFound")
		await alice.as.mutation(api.modules.graph.connections.blockPerson, { networkId: root, targetPersonId: bob.personId as Id<"persons"> })
		expect(await refusal(alice.as.mutation(api.modules.messaging.inbox.startThreadWithHandle, args))).toBe("notFound")
	})

	it.each(["", " ", "x".repeat(257), "bad\nkey"])("refuse une clé initiale invalide sans créer de fil : %j", async (idempotencyKey) => {
		const { t, root, alice } = await pair()
		let code: string | null = null
		try {
			await alice.as.mutation(api.modules.messaging.inbox.startThreadWithHandle, { networkId: root, handle: "bob", initialMessage: "Bonjour", idempotencyKey })
		} catch (error) { code = engineErrorCode(error) }
		expect(code).toBe("invalidArgument")
		expect(await t.run(async (ctx) => ctx.db.query("personalThreads").take(1))).toEqual([])
	})

	it("les envois directs et de groupe refusent aussi la clé d'un autre auteur", async () => {
		const { t, root, alice, bob, enter } = await pair()
		const initial = await alice.as.mutation(api.modules.messaging.inbox.startThreadWithHandle, { networkId: root, handle: "bob", initialMessage: "Bonjour", idempotencyKey: "initial" })
		const directArgs = { networkId: root, threadId: initial.threadId, content: "Personnel", idempotencyKey: "direct" }
		const direct = await alice.as.mutation(api.modules.messaging.messages.sendMessage, directArgs)
		expect(await alice.as.mutation(api.modules.messaging.messages.sendMessage, directArgs)).toEqual({ messageId: direct.messageId, deduplicated: true })
		async function refusal(promise: Promise<unknown>) {
			try { await promise; return null } catch (error) { return engineErrorCode(error) }
		}
		expect(await refusal(bob.as.mutation(api.modules.messaging.messages.sendMessage, directArgs))).toBe("notFound")
		const carla = await enter("carla")
		await t.run(async (ctx) => {
			const [low, high] = alice.personId < carla.personId ? [alice.personId, carla.personId] : [carla.personId, alice.personId]
			await ctx.db.insert("connections", { networkId: root, personIdLow: low, personIdHigh: high, requestedByPersonId: alice.personId, recipientPersonId: carla.personId, status: "accepted", requestedAt: 1, respondedAt: 1, updatedAt: 1 })
		})
		const group = await alice.as.mutation(api.modules.groups.threads.createGroup, { networkId: root, title: "Groupe", memberHandles: ["bob", "carla"], idempotencyKey: "group" })
		await bob.as.mutation(api.modules.groups.invites.respondGroupInvite, { networkId: root, threadId: group.threadId, accept: true })
		await carla.as.mutation(api.modules.groups.invites.respondGroupInvite, { networkId: root, threadId: group.threadId, accept: true })
		const groupArgs = { networkId: root, threadId: group.threadId, content: "Groupe", idempotencyKey: "group-message" }
		const message = await alice.as.mutation(api.modules.groups.messages.sendGroupMessage, groupArgs)
		expect(await alice.as.mutation(api.modules.groups.messages.sendGroupMessage, groupArgs)).toEqual({ messageId: message.messageId, deduplicated: true })
		expect(await refusal(bob.as.mutation(api.modules.groups.messages.sendGroupMessage, groupArgs))).toBe("notFound")
	})
})
