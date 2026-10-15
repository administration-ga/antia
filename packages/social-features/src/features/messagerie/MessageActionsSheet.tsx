// Dupliqué de socle/packages/agent-features/src/features/messagerie/MessageActionsSheet.tsx @ ad2e7fdc2 — adaptations : vocabulaire des réactions lu au contrat du moteur (`@antia/social-contracts/messageReactions`, emojis seuls) — les noms accessibles des réactions (`MESSAGE_REACTION_LABEL`, retiré du contrat) deviennent des clés i18n (`messageActionsSheet.reactions.*`) ; tiroir du paquet `@antia/ui/sheet` (croix nommée par `closeLabel` traduit) ; titre traduit ; `actionsFor(…, t)`.
"use client"

/**
 * MessageActionsSheet — ce qu'un appui long sur une bulle ouvre.
 *
 * Une feuille basse (`Sheet side="bottom"` d'`@antia/ui/sheet`, le même
 * gabarit que le menu du réseau) : barre d'emojis en haut, actions en dessous. C'est
 * le geste des messageries, et il vaut aussi au clavier — la bulle est un
 * bouton, `Entrée` ouvre la même feuille.
 *
 * ⚠️ La liste des actions vient de `actionsFor` (module PUR, testé), jamais
 * d'une suite de conditions ici : « supprimer pour tout le monde » n'existe
 * que sur MON message d'un fil 1:1, et le proposer ailleurs promettrait un
 * geste que le serveur refuse — ou qui n'existe pas du tout côté groupes.
 *
 * ⚠️ Les emojis viennent de `@antia/social-contracts/messageReactions`, le
 * vocabulaire que le SERVEUR valide. Les recopier ici ferait afficher un
 * emoji que la mutation refuserait, ou un emoji différent de celui qui a été
 * enregistré. Leurs NOMS accessibles, eux, sont du texte d'écran : ils vivent
 * dans les locales (`messageActionsSheet.reactions.<genre>`).
 *
 * Feuille en tranches (ADR-0191) : l'en-tête porte un titre VISIBLE et
 * réserve la place de la croix — titre masqué, la croix de 44 px recouvrait
 * le dernier emoji de la barre ; seul le corps (`SheetBody`) défile.
 */

import {
	MESSAGE_REACTION_EMOJI,
	MESSAGE_REACTION_KINDS,
	type MessageReactionKind,
} from "@antia/social-contracts/messageReactions"
import {
	Sheet,
	SheetBody,
	SheetContent,
	SheetHeader,
	SheetTitle,
} from "@antia/ui/sheet"
import { useTranslation } from "react-i18next"
import { actionsFor, type MessageActionContext, type MessageActionId } from "./message-actions"

/**
 * La clé du NOM d'une réaction — partagée avec les pastilles de la bulle
 * (`MessageBubble`), qui annoncent « J'aime : 3 » avec le même mot.
 */
export function reactionLabelKey(kind: MessageReactionKind): string {
	return `messagerie:messageActionsSheet.reactions.${kind}`
}

export function MessageActionsSheet({
	open,
	onOpenChange,
	context,
	myReaction,
	onReact,
	onAction,
}: {
	open: boolean
	onOpenChange: (open: boolean) => void
	context: MessageActionContext
	/** Ma réaction courante — `null` si je n'ai pas réagi. */
	myReaction: MessageReactionKind | null
	onReact: (kind: MessageReactionKind) => void
	onAction: (id: MessageActionId) => void
}) {
	const { t } = useTranslation("messagerie")
	const actions = actionsFor(context, t)
	const montreLesEmojis = actions.some((action) => action.id === "reagir")

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			{/* Exceptions assumées : 70 % de la hauteur au plus (la conversation
			    reste visible au-dessus) et une croix de 44 px, cible tactile —
			    d'où l'en-tête élargi à droite (`pr-16`). */}
			<SheetContent
				side="bottom"
				closeLabel={t("messageActionsSheet.close")}
				className="max-h-[70dvh] rounded-t-2xl border-border/60 bg-secondary [&_[data-slot=sheet-close]]:!size-11"
			>
				<SheetHeader className="pr-16">
					<SheetTitle>{t("messageActionsSheet.title")}</SheetTitle>
				</SheetHeader>

				{/* `gap-0` : la barre d'emojis porte son propre espacement. */}
				<SheetBody className="gap-0">
					{montreLesEmojis ? (
						<div className="msg-reaction-bar">
							{MESSAGE_REACTION_KINDS.map((kind) => (
								<button
									key={kind}
									type="button"
									className="msg-reaction-key"
									data-mine={myReaction === kind ? "true" : "false"}
									aria-label={t(reactionLabelKey(kind))}
									aria-pressed={myReaction === kind}
									onClick={() => {
										onReact(kind)
										onOpenChange(false)
									}}
								>
									<span aria-hidden="true">{MESSAGE_REACTION_EMOJI[kind]}</span>
								</button>
							))}
						</div>
					) : null}

					<ul className="msg-list">
						{actions
							// « Réagir » n'est pas une ligne : c'est la barre au-dessus.
							// La garder ferait deux chemins pour le même geste, dont l'un
							// n'ouvrirait rien.
							.filter((action) => action.id !== "reagir")
							.map((action) => (
								<li key={action.id}>
									<button
										type="button"
										className="msg-row"
										style={
											action.destructive
												? { color: "var(--danger-700, var(--ink-900))" }
												: undefined
										}
										onClick={() => {
											onAction(action.id)
											onOpenChange(false)
										}}
									>
										<span className="msg-row-main">
											<span className="msg-row-name">{action.label}</span>
										</span>
									</button>
								</li>
							))}
					</ul>
				</SheetBody>
			</SheetContent>
		</Sheet>
	)
}
