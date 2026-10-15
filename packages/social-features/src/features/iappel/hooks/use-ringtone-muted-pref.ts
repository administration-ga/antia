// Dupliqué de socle/packages/agent-features/src/hooks/use-ringtone-muted-pref.ts @ ad2e7fdc2 — adaptations : réglages de la PERSONNE du moteur (`calls.preferences.getMine({ now })` et `update`, fonctions sur soi, sans réseau ; `now` arrondi à la minute et figé au montage) ; clés locales renommées sans « call-center » et préfixées par le réseau (`useNetwork().storagePrefix` + `ringtone-muted`) ; consommateurs de poste et du centre d'appels retirés de la documentation.
"use client";

/**
 * useRingtoneMutedPref — LES réglages de sonnerie, une seule vérité (S3-S5).
 *
 * Avant ce lot, ce hook ne lisait que le localStorage : les interrupteurs
 * « Sonner pour les appels entrants » et « Vibrer » écrivaient
 * `callPreferences.ringtone` que personne ne lisait — persistés en base, sans
 * effet. Désormais :
 *
 *  - la préférence SERVEUR (`calls.preferences.getMine`) est la vérité — un
 *    réglage posé sur un appareil vaut sur tous ;
 *  - le localStorage reste un CACHE OPTIMISTE du mute : le clic est instantané,
 *    et le cache est resynchronisé sur le serveur dès qu'aucune écriture n'est
 *    en vol (règles pures : `ringtone-pref.ts`) ;
 *  - toute écriture porte les DEUX champs (`ringtoneWritePayload`) : côté
 *    serveur, `update({ ringtone })` REMPLACE le sous-objet entier.
 *
 * Consommateurs : `use-incoming-calls` (la sonnerie et la vibration) et la
 * section « Sonnerie et vibration » des réglages d'appel.
 *
 * `useSyncExternalStore` + événement : plusieurs composants souscrivent au
 * même localStorage dans la même fenêtre (le storage event natif ne se
 * déclenche que pour les AUTRES fenêtres). La clé est préfixée par le réseau
 * (`storagePrefix`) : un état par réseau, comme tout stockage local du moteur.
 */

import { api } from "@antia/api/engine";
import {
	useAuthenticatedConvexQuery,
	useConvexMutationQuery,
} from "@antia/api/hooks";
import { useNetwork } from "@antia/api/network";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
	resolveRingtonePrefs,
	ringtoneWritePayload,
	type RingtonePrefs,
} from "./ringtone-pref";

/** Le suffixe de la clé locale — préfixée par le réseau (`storagePrefix`). */
const STORAGE_KEY_SUFFIX = "ringtone-muted";
/** L'événement de même fenêtre — même préfixe que la clé. */
const EVENT_SUFFIX = "ringtone-muted-changed";

/** L'instant passé à `getMine` : arrondi à la minute, pour une souscription stable. */
const NOW_ROUNDING_MS = 60_000;

/** `null` = jamais réglé localement (on laisse alors parler le serveur). */
function readCachedMuted(storageKey: string): boolean | null {
	try {
		const raw = localStorage.getItem(storageKey);
		return raw === null ? null : raw === "true";
	} catch {
		return null;
	}
}

function writeCachedMuted(storageKey: string, eventName: string, next: boolean) {
	try {
		const asString = String(next);
		if (localStorage.getItem(storageKey) === asString) return;
		localStorage.setItem(storageKey, asString);
		window.dispatchEvent(new Event(eventName));
	} catch {
		/* SSR / quota / privacy mode */
	}
}

function getServerSnapshot(): boolean | null {
	return null;
}

/**
 * Écritures serveur en vol, PARTAGÉES entre toutes les instances du hook :
 * tant qu'il y en a une, la resynchronisation cache←serveur se tait — sinon
 * la query (encore sur l'ancienne valeur) écraserait le clic optimiste.
 */
let pendingServerWrites = 0;

export function useRingtoneMutedPref(): {
	muted: boolean;
	vibrate: boolean;
	toggle: () => void;
	setMuted: (next: boolean) => void;
	setVibrate: (next: boolean) => void;
} {
	const { storagePrefix } = useNetwork();
	const storageKey = `${storagePrefix}${STORAGE_KEY_SUFFIX}`;
	const eventName = `${storagePrefix}${EVENT_SUFFIX}`;

	const subscribe = useCallback(
		(callback: () => void): (() => void) => {
			if (typeof window === "undefined") return () => {};
			window.addEventListener("storage", callback);
			window.addEventListener(eventName, callback);
			return () => {
				window.removeEventListener("storage", callback);
				window.removeEventListener(eventName, callback);
			};
		},
		[eventName],
	);
	const getSnapshot = useCallback(() => readCachedMuted(storageKey), [storageKey]);
	const cachedMuted = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

	// La query ne lit pas l'horloge : l'écran lui passe un instant ARRONDI, figé
	// au montage — un instant qui changerait à chaque rendu referait la
	// souscription à chaque rendu. Seul le « ne pas déranger » en dépend, pas
	// la sonnerie lue ici.
	const [now] = useState(() => Math.floor(Date.now() / NOW_ROUNDING_MS) * NOW_ROUNDING_MS);
	const { data: serverPrefs } = useAuthenticatedConvexQuery(
		api.modules.calls.preferences.getMine,
		{ now },
	);
	const { mutateAsync: updatePrefs } = useConvexMutationQuery(
		api.modules.calls.preferences.update,
	);

	const server: RingtonePrefs | null = serverPrefs
		? {
				muted: serverPrefs.ringtone.muted,
				vibrate: serverPrefs.ringtone.vibrate,
			}
		: null;
	const prefs = resolveRingtonePrefs(server, cachedMuted);
	const prefsRef = useRef(prefs);
	prefsRef.current = prefs;

	// Resynchronise le cache sur le serveur (réglage venu d'un autre appareil)
	// — jamais pendant qu'une écriture est en vol : elle a raison, pas la query.
	const serverMuted = server === null ? null : server.muted;
	useEffect(() => {
		if (serverMuted === null) return;
		if (pendingServerWrites > 0) return;
		writeCachedMuted(storageKey, eventName, serverMuted);
	}, [serverMuted, storageKey, eventName]);

	const write = useCallback(
		(patch: Partial<RingtonePrefs>) => {
			const payload = ringtoneWritePayload(prefsRef.current, patch);
			if (patch.muted !== undefined) writeCachedMuted(storageKey, eventName, patch.muted);
			pendingServerWrites += 1;
			void updatePrefs({ ringtone: payload })
				.catch(() => {
					// Best-effort : le cache local garde la main ; la query
					// resynchronisera au prochain aller-retour réussi.
				})
				.finally(() => {
					pendingServerWrites -= 1;
				});
		},
		[updatePrefs, storageKey, eventName],
	);

	const setMuted = useCallback((next: boolean) => write({ muted: next }), [write]);
	const setVibrate = useCallback(
		(next: boolean) => write({ vibrate: next }),
		[write],
	);
	const toggle = useCallback(
		() => write({ muted: !prefsRef.current.muted }),
		[write],
	);

	return { muted: prefs.muted, vibrate: prefs.vibrate, toggle, setMuted, setVibrate };
}
