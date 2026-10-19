// Dupliqué de socle/packages/agent-features/src/features/messagerie/icom-desktop-entry.ts @ ad2e7fdc2 — adaptations : la page d'arrivée n'est plus écrite en dur (l'accueil de l'espace agent) mais INJECTÉE — champ `home` de `icomDesktopEntryHref` (`useRoutes().home()` de l'application) ; doc ajoutée ; lecture et consommation de l'intention inchangées.
/**
 * icom-desktop-entry — la passerelle des anciennes adresses Messages vers le
 * téléphone iCom du bureau.
 *
 * Au bureau, la messagerie ne se rend plus en page : elle vit dans la carte
 * iCom (`MessagerieDock`), montée par la coque. Une adresse de messagerie
 * (notification, favori, lien partagé) transmet donc son INTENTION à l'accueil
 * de l'application par `?icom=` — conversation, composeur, brique, fiche de
 * groupe, invitation —, et la carte la consomme une fois, détachée.
 *
 * Aucune URL écrite ici : l'accueil est celui de l'application (`home`).
 */
import {
	INVITATION_GROUPE_PARAM,
	lireJetonInvitationGroupe,
} from "./groupe-invitation-link"
import { ICOM_BRIQUE_PARAM, parseIcomBrique } from "./icom-mobile-tabs"
import { parseKey, type ConversationKey } from "./messagerie-dock"
import { INFOS_PARAM, infosOuvertes } from "./messagerie-routes"

/** Une ancienne adresse Messages transmet son intention au téléphone iCom. */
export const ICOM_ENTRY_PARAM = "icom"

export function icomDesktopEntryHref({
	home,
	conversationKey,
	compose,
	search = "",
}: {
	/** L'accueil de l'application (`useRoutes().home()`), où la carte iCom est montée. */
	home: string
	conversationKey: ConversationKey | null
	compose?: "personne" | "groupe"
	search?: string
}): string {
	const source = new URLSearchParams(search)
	const target = new URLSearchParams()
	const entry =
		compose === "groupe"
			? "nouveau-groupe"
			: compose === "personne"
				? "nouveau"
				: conversationKey !== null && parseKey(conversationKey) !== null
					? conversationKey
					: "ouvrir"
	target.set(ICOM_ENTRY_PARAM, entry)
	for (const key of [ICOM_BRIQUE_PARAM, INFOS_PARAM, INVITATION_GROUPE_PARAM]) {
		const value = source.get(key)
		if (value !== null) target.set(key, value)
	}
	return `${home}?${target.toString()}`
}

export function readIcomDesktopEntry(search: string): {
	conversation: ReturnType<typeof parseKey>
	compose: "personne" | "groupe" | null
	brique: ReturnType<typeof parseIcomBrique>
	infosOpen: boolean
	invitation: { token: string | null } | null
} | null {
	const params = new URLSearchParams(search)
	const raw = params.get(ICOM_ENTRY_PARAM)
	if (raw === null) return null
	return {
		conversation: parseKey(raw),
		compose:
			raw === "nouveau-groupe"
				? "groupe"
				: raw === "nouveau"
					? "personne"
					: null,
		brique: parseIcomBrique(params.get(ICOM_BRIQUE_PARAM)),
		infosOpen: infosOuvertes(search),
		invitation: params.has(INVITATION_GROUPE_PARAM)
			? { token: lireJetonInvitationGroupe(search) }
			: null,
	}
}

/** Consommer l'intention évite de rouvrir iCom au rechargement. */
export function withoutIcomDesktopEntry(pathname: string, search: string): string {
	const params = new URLSearchParams(search)
	for (const key of [ICOM_ENTRY_PARAM, ICOM_BRIQUE_PARAM, INFOS_PARAM, INVITATION_GROUPE_PARAM]) {
		params.delete(key)
	}
	const query = params.toString()
	return query.length > 0 ? `${pathname}?${query}` : pathname
}
