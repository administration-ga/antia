// Dupliqué de socle/packages/agent-features/src/hooks/ringtone-pref.test.ts @ ad2e7fdc2 — adaptations : aucune sur les cas (module pur inchangé) ; commentaires alignés sur les réglages de la personne du moteur.
import { describe, expect, it } from "vitest";
import { resolveRingtonePrefs, ringtoneWritePayload } from "./ringtone-pref";

describe("resolveRingtonePrefs", () => {
	it("sans rien : les défauts de preferences.getMine (muted false, vibrate true)", () => {
		expect(resolveRingtonePrefs(null, null)).toEqual({
			muted: false,
			vibrate: true,
		});
	});

	it("le cache local du mute PRIME sur le serveur — le clic vient de l'écrire", () => {
		// Une écriture serveur est en vol : préférer le serveur ferait
		// « rebondir » l'interrupteur le temps de l'aller-retour.
		expect(
			resolveRingtonePrefs({ muted: false, vibrate: true }, true).muted,
		).toBe(true);
		expect(
			resolveRingtonePrefs({ muted: true, vibrate: true }, false).muted,
		).toBe(false);
	});

	it("sans cache, le serveur décide le mute", () => {
		expect(
			resolveRingtonePrefs({ muted: true, vibrate: false }, null),
		).toEqual({ muted: true, vibrate: false });
	});

	it("la vibration vient TOUJOURS du serveur (pas de cache local)", () => {
		expect(
			resolveRingtonePrefs({ muted: false, vibrate: false }, true).vibrate,
		).toBe(false);
		expect(resolveRingtonePrefs(null, true).vibrate).toBe(true);
	});
});

describe("ringtoneWritePayload", () => {
	it("porte TOUJOURS les deux champs — l'update serveur remplace le sous-objet", () => {
		// Une écriture qui n'enverrait que `muted` effacerait `vibrate` (le
		// serveur remplace le sous-objet entier).
		expect(
			ringtoneWritePayload({ muted: false, vibrate: false }, { muted: true }),
		).toEqual({ muted: true, vibrate: false });
		expect(
			ringtoneWritePayload({ muted: true, vibrate: true }, { vibrate: false }),
		).toEqual({ muted: true, vibrate: false });
	});

	it("un patch vide réécrit l'état courant à l'identique", () => {
		expect(ringtoneWritePayload({ muted: true, vibrate: false }, {})).toEqual({
			muted: true,
			vibrate: false,
		});
	});
});
