// Dupliqué de socle/packages/agent-features/src/hooks/ringtone-pref.ts @ ad2e7fdc2 — adaptations : documentation seulement — réglages de la personne du moteur (`callPreferences`, `calls.preferences.getMine` / `update`), et raison exacte de l'écriture à deux champs côté moteur (le sous-objet est remplacé, ses champs y sont facultatifs).
/**
 * ringtone-pref — ce que les réglages de sonnerie DÉCIDENT, hors de tout hook.
 *
 * Le défaut corrigé (S3) : « Sonner pour les appels entrants » et « Vibrer »
 * écrivaient `callPreferences.ringtone` que PERSONNE ne lisait — la
 * sonnerie n'obéissait qu'au localStorage, la vibration qu'à `isMobile`. Deux
 * interrupteurs persistés en base et sans effet.
 *
 * Depuis ce lot, la préférence SERVEUR est la vérité ; le localStorage n'est
 * qu'un CACHE optimiste du mute (réactivité immédiate au clic, valeur pendant
 * le chargement). Les règles de fusion et d'écriture vivent ici, pures et
 * testées ; `use-ringtone-muted-pref.ts` ne fait que les câbler.
 */

export interface RingtonePrefs {
	muted: boolean;
	vibrate: boolean;
}

/**
 * Fusion cache local / serveur.
 *
 * Le MUTE préfère le cache : c'est lui que le clic vient d'écrire, et une
 * écriture serveur est en vol — préférer le serveur ferait « rebondir »
 * l'interrupteur le temps de l'aller-retour. Le cache est resynchronisé sur
 * le serveur par le hook dès qu'aucune écriture n'est en vol (changement
 * venu d'un autre appareil). La VIBRATION n'a pas de cache : elle vient du
 * serveur, `true` par défaut (même défaut que `calls.preferences.getMine`).
 */
export function resolveRingtonePrefs(
	server: RingtonePrefs | null,
	cachedMuted: boolean | null,
): RingtonePrefs {
	return {
		muted: cachedMuted ?? server?.muted ?? false,
		vibrate: server?.vibrate ?? true,
	};
}

/**
 * Le corps d'une écriture `calls.preferences.update({ ringtone })`.
 *
 * ⚠️ Côté serveur, `ringtone` REMPLACE le sous-objet entier (ses deux champs
 * y sont facultatifs) : une écriture qui n'enverrait que `muted` EFFACERAIT
 * `vibrate`, qui retomberait sur son défaut. Toute écriture passe donc par ici
 * et porte toujours les DEUX champs.
 */
export function ringtoneWritePayload(
	current: RingtonePrefs,
	patch: Partial<RingtonePrefs>,
): RingtonePrefs {
	return {
		muted: patch.muted ?? current.muted,
		vibrate: patch.vibrate ?? current.vibrate,
	};
}
