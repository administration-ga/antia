// Dupliqué de socle/packages/agent-features/src/features/messagerie/groupe-invitation-link.ts @ ad2e7fdc2 — adaptations : la base de la messagerie n'est plus une constante (`MESSAGES_URL` retirée) mais un paramètre — `invitationGroupeHref(token, base, origin?)`, `base` = `useRoutes().messages()` de l'application ; le reste inchangé.
/**
 * L'invitation par lien reste une QUERY de la liste iCom : aucune nouvelle
 * route n'est nécessaire, et le chrome mobile conserve ainsi sa structure.
 * Le jeton est opaque ; ce module ne tente jamais d'en déduire une identité.
 *
 * Ce module ne connaît AUCUNE adresse : la base de la messagerie lui est
 * passée par l'écran, qui la tient de la table des routes de l'application.
 */

export const INVITATION_GROUPE_PARAM = "invitation-groupe"

/**
 * Les jetons émis par le serveur sont URL-safe. Refuser les espaces, les
 * contrôles et les valeurs démesurées évite d'envoyer une entrée manifestement
 * abîmée au backend, sans interpréter son contenu.
 */
export function normaliserJetonInvitationGroupe(
	value: string | null | undefined,
): string | null {
	if (typeof value !== "string") return null
	const token = value.trim()
	if (token.length < 16 || token.length > 256) return null
	return /^[A-Za-z0-9_-]+$/.test(token) ? token : null
}

/** Lit le premier jeton dans une query, un chemin complet ou une URL. */
export function lireJetonInvitationGroupe(
	source: string | null | undefined,
): string | null {
	if (typeof source !== "string" || source.length === 0) return null

	let query = source
	const question = source.indexOf("?")
	if (question >= 0) query = source.slice(question + 1)
	const hash = query.indexOf("#")
	if (hash >= 0) query = query.slice(0, hash)

	return normaliserJetonInvitationGroupe(
		new URLSearchParams(query).get(INVITATION_GROUPE_PARAM),
	)
}

/**
 * Compose le lien partageable sur la base de la messagerie (`base`). Sans
 * origine, le résultat reste relatif afin de fonctionner dans toutes les
 * applications du moteur.
 */
export function invitationGroupeHref(
	tokenBrut: string,
	base: string,
	origin?: string,
): string | null {
	const token = normaliserJetonInvitationGroupe(tokenBrut)
	if (token === null) return null
	const relatif = `${base}?${INVITATION_GROUPE_PARAM}=${encodeURIComponent(token)}`
	if (origin === undefined) return relatif
	try {
		return new URL(relatif, origin).toString()
	} catch {
		return relatif
	}
}

/** Retire seulement l'invitation et conserve la brique iCom éventuelle. */
export function hrefSansInvitationGroupe(
	pathname: string,
	search: string | null | undefined,
): string {
	const brut = typeof search === "string" ? search : ""
	const params = new URLSearchParams(brut.startsWith("?") ? brut.slice(1) : brut)
	params.delete(INVITATION_GROUPE_PARAM)
	const query = params.toString()
	return query.length === 0 ? pathname : `${pathname}?${query}`
}
