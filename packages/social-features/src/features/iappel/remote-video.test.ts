// Dupliqué de socle/packages/agent-features/src/features/iappel/remote-video.test.ts @ ad2e7fdc2 — adaptations : aucune (module pur inchangé, mêmes cas).
import { describe, expect, it } from "vitest"
import {
	classifyRemoteVideo,
	pickLocalCameraTrack,
	pickRemoteCameraTrack,
	probeOf,
	type CameraTrackLike,
} from "./remote-video"

/**
 * Ce que ces cas gardent : la vidéo distante était INVISIBLE alors que la
 * piste existait, parce qu'un seul critère (`!isMuted`) décidait de tout.
 * Chaque `it` ci-dessous décrit un état réel observé pendant un appel.
 */

function ref(over: Partial<CameraTrackLike["publication"]> & {
	identity?: string
	isLocal?: boolean
}): CameraTrackLike {
	const { identity = "remote-1", isLocal, ...pub } = over
	return {
		participant: { identity, ...(isLocal === undefined ? {} : { isLocal }) },
		publication: pub,
	}
}

describe("classifyRemoteVideo — quatre états, pas un seul", () => {
	it("aucune publication : l'appel est audio, on montre l'avatar", () => {
		expect(classifyRemoteVideo(null)).toBe("none")
		expect(
			classifyRemoteVideo({
				participantIdentity: "x",
				hasPublication: false,
				hasTrack: false,
				isSubscribed: false,
				isMuted: false,
			}),
		).toBe("none")
	})

	it("publiée mais pas encore souscrite : « connexion vidéo… », PAS « caméra coupée »", () => {
		// Le cas qui produisait un cadre noir : `onlySubscribed: false` rend la
		// publication, `track` est `undefined`, `<VideoTrack>` n'attache rien.
		expect(
			classifyRemoteVideo({
				participantIdentity: "x",
				hasPublication: true,
				hasTrack: false,
				isSubscribed: false,
				isMuted: false,
			}),
		).toBe("connecting")
	})

	it("souscrite mais piste pas encore arrivée : toujours « connexion vidéo… »", () => {
		expect(
			classifyRemoteVideo({
				participantIdentity: "x",
				hasPublication: true,
				hasTrack: false,
				isSubscribed: true,
				isMuted: false,
			}),
		).toBe("connecting")
	})

	it("coupée par le pair : « caméra coupée », même si la piste est là", () => {
		// L'ordre importe : une piste coupée reste souscrite ET attachée.
		expect(
			classifyRemoteVideo({
				participantIdentity: "x",
				hasPublication: true,
				hasTrack: true,
				isSubscribed: true,
				isMuted: true,
			}),
		).toBe("off")
	})

	it("souscrite, attachée, non coupée : l'image arrive", () => {
		expect(
			classifyRemoteVideo({
				participantIdentity: "x",
				hasPublication: true,
				hasTrack: true,
				isSubscribed: true,
				isMuted: false,
			}),
		).toBe("live")
	})
})

describe("probeOf — les champs absents ne doivent pas éteindre la vidéo", () => {
	it("`isSubscribed` absent vaut souscrite (piste locale)", () => {
		expect(probeOf(ref({ track: {} })).isSubscribed).toBe(true)
	})

	it("`track: null` compte comme absente", () => {
		expect(probeOf(ref({ track: null, isSubscribed: true })).hasTrack).toBe(false)
	})
})

describe("pickRemoteCameraTrack", () => {
	it("ignore ma propre piste, par `isLocal` comme par identité", () => {
		const tracks = [
			ref({ identity: "moi", isLocal: true, track: {}, isSubscribed: true }),
			ref({ identity: "moi-bis", track: {}, isSubscribed: true }),
		]
		expect(pickRemoteCameraTrack(tracks, "moi-bis")).toEqual({
			track: null,
			state: "none",
		})
	})

	it("rend la piste DÈS `connecting` — c'est ce qui déclenche la souscription", () => {
		// Sans cela : pas d'élément monté ⇒ `adaptiveStream` n'envoie rien ⇒ la
		// piste ne devient jamais vivante. La boucle ne se referme jamais.
		const tracks = [ref({ track: undefined, isSubscribed: false })]
		const picked = pickRemoteCameraTrack(tracks, "moi")
		expect(picked.state).toBe("connecting")
		expect(picked.track).toBe(tracks[0])
	})

	it("ne rend AUCUNE piste quand le pair a coupé : un cadre noir passerait pour une panne", () => {
		const tracks = [ref({ track: {}, isSubscribed: true, isMuted: true })]
		expect(pickRemoteCameraTrack(tracks, "moi")).toEqual({
			track: null,
			state: "off",
		})
	})

	it("entre deux publications du même pair, préfère celle qui montre quelque chose", () => {
		const coupee = ref({ identity: "pair", track: {}, isSubscribed: true, isMuted: true })
		const vivante = ref({ identity: "pair", track: {}, isSubscribed: true })
		expect(pickRemoteCameraTrack([coupee, vivante], "moi").state).toBe("live")
		expect(pickRemoteCameraTrack([coupee, vivante], "moi").track).toBe(vivante)
	})

	it("préfère « en connexion » à « coupée » — l'une va arriver, l'autre non", () => {
		const coupee = ref({ identity: "pair", track: {}, isSubscribed: true, isMuted: true })
		const arrive = ref({ identity: "pair", isSubscribed: false })
		expect(pickRemoteCameraTrack([coupee, arrive], "moi").state).toBe("connecting")
	})

	it("liste vide : rien à montrer", () => {
		expect(pickRemoteCameraTrack([], "moi")).toEqual({ track: null, state: "none" })
	})
})

describe("pickLocalCameraTrack", () => {
	it("retient la piste marquée locale", () => {
		const local = ref({ identity: "moi", isLocal: true, track: {} })
		const distant = ref({ identity: "pair", track: {} })
		expect(pickLocalCameraTrack([distant, local], "moi")).toBe(local)
	})

	it("retombe sur l'identité quand `isLocal` n'est pas renseigné", () => {
		const local = ref({ identity: "moi", track: {} })
		expect(pickLocalCameraTrack([local], "moi")).toBe(local)
	})

	it("aucune piste locale : la vignette ne se monte pas", () => {
		expect(pickLocalCameraTrack([ref({ identity: "pair" })], "moi")).toBeNull()
	})
})
