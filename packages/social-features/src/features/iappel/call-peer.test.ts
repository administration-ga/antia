// Dupliqué de socle/packages/agent-features/src/features/iappel/call-peer.test.ts @ ad2e7fdc2 — adaptations : libellés lus dans les locales françaises du moteur (`t` réel) ; cas de la portée poste retirés (sous-titre « au titre du poste … » et badge « Appel poste ») — le sous-titre personnel et le badge personnel gardent les leurs.
import { describe, expect, it } from "vitest"

import { createAppI18n } from "../../i18n"
import {
	isLikelyIdentityHash,
	peerDisplayName,
	peerInitials,
	peerSubtitle,
	scopeBadgeLabel,
} from "./call-peer"
import type { CallPeerIdentity } from "./call-types"

const t = createAppI18n({ locale: "fr", appResources: { fr: {}, en: {} }, defaultNS: "iappel" }).getFixedT("fr")

/**
 * Ce que ces cas gardent : un identifiant technique (`570rjg5chav8n2k1p`) qui
 * réapparaît à l'écran par un chemin de repli oublié — c'est exactement le
 * défaut vécu dans `DirectCallView` avant l'extraction de ce module.
 */

function peer(over: Partial<CallPeerIdentity> = {}): CallPeerIdentity {
	return { name: null, ...over }
}

describe("isLikelyIdentityHash", () => {
	it("une suite de 16+ caractères sans espace : c'est un hachage", () => {
		expect(isLikelyIdentityHash("570rjg5chav8n2k1p")).toBe(true)
	})

	it("un nom avec espaces, même long, n'EST PAS un hachage", () => {
		expect(isLikelyIdentityHash("Rudie Sangani Mayombo Obiang")).toBe(false)
	})

	it("une courte chaîne sans espace n'est pas un hachage (sous le seuil de 16)", () => {
		expect(isLikelyIdentityHash("Ali-ben")).toBe(false)
	})

	it("null : pas un hachage", () => {
		expect(isLikelyIdentityHash(null)).toBe(false)
	})

	it("undefined : pas un hachage", () => {
		expect(isLikelyIdentityHash(undefined)).toBe(false)
	})

	it("chaîne vide : pas un hachage", () => {
		expect(isLikelyIdentityHash("")).toBe(false)
	})
})

describe("peerDisplayName — jamais un identifiant technique", () => {
	it("un nom normal est rendu tel quel", () => {
		expect(peerDisplayName(peer({ name: "Marie Ndong" }), undefined, t)).toBe("Marie Ndong")
	})

	it("un nom qui ressemble à un hachage retombe sur le fallback", () => {
		expect(peerDisplayName(peer({ name: "570rjg5chav8n2k1p" }), "Berny Itoutou", t)).toBe(
			"Berny Itoutou",
		)
	})

	it("un nom-hachage SANS fallback retombe sur le repli générique — jamais sur le hachage", () => {
		expect(peerDisplayName(peer({ name: "570rjg5chav8n2k1p" }), undefined, t)).toBe(
			"Votre correspondant",
		)
	})

	it("peer absent (null), fallback fourni : le fallback", () => {
		expect(peerDisplayName(null, "Berny Itoutou", t)).toBe("Berny Itoutou")
	})

	it("peer absent (undefined), aucun fallback : le repli générique", () => {
		expect(peerDisplayName(undefined, undefined, t)).toBe("Votre correspondant")
	})

	it("name null sur le peer : bascule directement sur le fallback", () => {
		expect(peerDisplayName(peer({ name: null }), "Fallback", t)).toBe("Fallback")
	})
})

describe("peerSubtitle — scope personnel : le handle, ou rien", () => {
	it("handle connu : préfixé d'une arobase", () => {
		expect(peerSubtitle(peer({ handle: "marie.ndong" }), "personnel")).toBe("@marie.ndong")
	})

	it("handle absent : PAS de ligne — le badge de scope le dit déjà", () => {
		expect(peerSubtitle(peer(), "personnel")).toBeNull()
	})

	it("peer absent : null également, jamais « Appel personnel »", () => {
		expect(peerSubtitle(null, "personnel")).toBeNull()
	})
})

describe("peerInitials — deux lettres au plus, jamais du repli générique", () => {
	it("nom à trois mots : les DEUX premiers", () => {
		expect(peerInitials(peer({ name: "Rudie SANGANI MAYOMBO" }))).toBe("RS")
	})

	it("nom à un seul mot : une seule lettre", () => {
		expect(peerInitials(peer({ name: "Marie" }))).toBe("M")
	})

	it("rien d'exploitable (hachage, pas de fallback) : point d'interrogation", () => {
		expect(peerInitials(peer({ name: "570rjg5chav8n2k1p" }))).toBe("?")
	})

	it("peer absent, aucun fallback : point d'interrogation, jamais « VC »", () => {
		expect(peerInitials(undefined)).toBe("?")
	})

	it("nom-hachage avec fallback exploitable : initiales du fallback", () => {
		expect(peerInitials(peer({ name: "570rjg5chav8n2k1p" }), "Berny Itoutou")).toBe("BI")
	})
})

describe("scopeBadgeLabel", () => {
	it("personnel", () => {
		expect(scopeBadgeLabel("personnel", t)).toBe("Appel personnel")
	})
})
