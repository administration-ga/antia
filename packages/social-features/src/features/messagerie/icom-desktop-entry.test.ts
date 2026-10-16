// Dupliqué de socle/packages/agent-features/src/features/messagerie/icom-desktop-entry.test.ts @ ad2e7fdc2 — adaptations : accueil INJECTÉ (`home`, celui des routes de test) au lieu de l'accueil de l'espace agent écrit en dur ; un cas ajouté pour un accueil imbriqué ; le reste tel quel.
import { describe, expect, it } from "vitest"
import {
	icomDesktopEntryHref,
	readIcomDesktopEntry,
	withoutIcomDesktopEntry,
} from "./icom-desktop-entry"

const TOKEN = "InviteToken_1234567890"
/** L'accueil de l'application, tel que les routes de test l'injectent. */
const HOME = "/fil"

describe("passerelle des anciennes adresses Messages vers iCom", () => {
	it("ouvre le téléphone à sa racine sans recréer de page bureau", () => {
		expect(icomDesktopEntryHref({ home: HOME, conversationKey: null })).toBe(
			"/fil?icom=ouvrir",
		)
		expect(readIcomDesktopEntry("icom=ouvrir")).toMatchObject({
			conversation: null,
			compose: null,
			brique: "ichat",
			infosOpen: false,
			invitation: null,
		})
	})

	it("arrive sur l'accueil de L'APPLICATION, quel qu'il soit", () => {
		expect(
			icomDesktopEntryHref({ home: "/r/antsia", conversationKey: null }),
		).toBe("/r/antsia?icom=ouvrir")
	})

	it("transmet une conversation ou l'un des deux composeurs", () => {
		expect(
			icomDesktopEntryHref({ home: HOME, conversationKey: "chat:conversation-1" }),
		).toBe("/fil?icom=chat%3Aconversation-1")
		expect(
			readIcomDesktopEntry("icom=chat%3Aconversation-1")?.conversation,
		).toEqual({ kind: "chat", chatId: "conversation-1" })
		expect(
			icomDesktopEntryHref({ home: HOME, conversationKey: null, compose: "personne" }),
		).toBe("/fil?icom=nouveau")
		expect(
			icomDesktopEntryHref({ home: HOME, conversationKey: null, compose: "groupe" }),
		).toBe("/fil?icom=nouveau-groupe")
	})

	it("conserve la brique, la fiche de groupe et une invitation", () => {
		const href = icomDesktopEntryHref({
			home: HOME,
			conversationKey: "groupe:equipe-1",
			search: `brique=iappel&infos=1&invitation-groupe=${TOKEN}`,
		})
		const query = href.split("?")[1] ?? ""
		expect(readIcomDesktopEntry(query)).toEqual({
			conversation: { kind: "groupe", threadId: "equipe-1" },
			compose: null,
			brique: "iappel",
			infosOpen: true,
			invitation: { token: TOKEN },
		})
	})

	it("consomme seulement les paramètres iCom et garde le volet réseau", () => {
		expect(
			withoutIcomDesktopEntry(
				HOME,
				`tab=relations&icom=ouvrir&brique=actus&infos=1&invitation-groupe=${TOKEN}`,
			),
		).toBe("/fil?tab=relations")
	})

	it("refuse une clé ou un jeton abîmé sans bloquer l'ouverture", () => {
		expect(readIcomDesktopEntry("icom=inconnu&invitation-groupe=x")).toEqual({
			conversation: null,
			compose: null,
			brique: "ichat",
			infosOpen: false,
			invitation: { token: null },
		})
	})
})
