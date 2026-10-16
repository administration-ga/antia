// Dupliqué de socle/packages/agent-features/src/features/messagerie/transfert-api.ts @ ad2e7fdc2 — adaptations : les `makeFunctionReference` typées à la main (et leurs types miroirs) remplacés par les références TYPÉES du moteur (`api.modules.messaging.forward.forwardMessage` / `forwardGroupMessage`, la porte 1:1 renommée `forwardMessage` comme au serveur) ; cibles `personal` / `group` / `handle` du moteur ; ajout de `forwardTargetArg`, qui brande les identifiants de la cible choisie (chaînes du module pur) au dernier moment.
/**
 * Les références des mutations de TRANSFERT (ADR-0143), et le passage de la
 * cible choisie dans la feuille à l'argument que le moteur valide.
 *
 * Au socle, ces références étaient typées À LA MAIN (`makeFunctionReference`)
 * faute de génération : le NOM était le contrat, et un renommage côté serveur
 * cassait l'appel sans que le typage ne bronche. Ici, elles viennent de
 * l'API générée du moteur (`@antsia/api/engine`) : arguments, cibles et
 * résultat sont ceux de `convex/modules/messaging/forward.ts`, vérifiés à la
 * compilation.
 *
 * Deux portes, selon la SOURCE : `forwardMessage` pour un message d'un fil
 * 1:1, `forwardGroupMessage` pour un message de groupe. Les cibles sont les
 * mêmes : un fil 1:1 (`personal`), un groupe (`group`), ou une personne du
 * réseau par son identifiant public (`handle`), dont le fil s'ouvre au besoin.
 */
import { api, type Id } from "@antsia/api/engine"
import type { FunctionArgs } from "convex/server"

import type { ForwardTargetArg } from "./forward-targets"

export const transfertApi = {
	forwardMessage: api.modules.messaging.forward.forwardMessage,
	forwardGroupMessage: api.modules.messaging.forward.forwardGroupMessage,
} as const

/** La cible telle que le moteur la valide (`forwardTargetValidator`). */
export type ForwardTarget = FunctionArgs<typeof api.modules.messaging.forward.forwardMessage>["to"]

/**
 * La cible choisie dans la feuille — des chaînes, venues d'un module pur — en
 * argument typé de la mutation. Le serveur valide la FORME (`v.id(…)`) à
 * l'arrivée et rejuge tout le reste (réseau, participation, relation).
 */
export function forwardTargetArg(target: ForwardTargetArg): ForwardTarget {
	switch (target.kind) {
		case "personal":
			return { kind: "personal", threadId: target.threadId as Id<"personalThreads"> }
		case "group":
			return { kind: "group", threadId: target.threadId as Id<"groupThreads"> }
		case "handle":
			return { kind: "handle", handle: target.handle }
	}
}
