// Dupliqué de socle/packages/agent-features/src/features/messagerie/ForwardMessageSheet.tsx @ ad2e7fdc2 — adaptations : tiroir du paquet `@antsia/ui/sheet` (croix nommée par `closeLabel` traduit) ; libellés traduits (espace de noms `messagerie`, clés `forwardMessageSheet.*`, `buildForwardTargets`/`forwardTargetHint` reçoivent `t`) ; fils et groupes du réseau courant (« espace » → « réseau » dans la doctrine).
"use client"

/**
 * ForwardMessageSheet — choisir EXPLICITEMENT la cible d'un transfert
 * (ADR-0143 §5).
 *
 * Une feuille basse (le gabarit de `MessageActionsSheet`) : un champ de
 * recherche, puis les conversations 1:1 et les groupes du réseau courant.
 * En recherche, les RELATIONS sans fil existant s'y ajoutent — le serveur
 * ouvrira la conversation à la livraison, avec ses gardes.
 *
 * Ce composant ne DÉCIDE rien : les lignes, le filtre et les libellés viennent
 * de `forward-targets.ts` (module pur, testé). Lui exécute le geste choisi et
 * en rend compte — envoi en cours par ligne, erreur lisible en place.
 *
 * ⚠️ La conversation COURANTE est exclue de la liste : s'y transférer serait
 * un doublon silencieux dans le même fil.
 *
 * Feuille en tranches (ADR-0191) : titre visible et conséquence du geste dans
 * l'en-tête, recherche FIXE dessous, et seule la liste défile (`SheetBody`) —
 * la feuille défilait d'un bloc et emportait le champ de recherche.
 */

import {
	Sheet,
	SheetBody,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@antsia/ui/sheet"
import { Loader2, Users } from "lucide-react"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { useRelationSearch } from "../reseau-personnel/use-relation-search"
import {
	buildForwardTargets,
	existingChatHandlesOf,
	filterForwardTargets,
	forwardTargetHint,
	relationForwardTargets,
	type ForwardGroupLike,
	type ForwardTargetRow,
	type ForwardThreadLike,
} from "./forward-targets"

export interface ForwardMessageSheetProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	/** Les fils 1:1 de la source — `undefined` tant qu'ils chargent. */
	threads: readonly ForwardThreadLike[] | undefined
	/** Mes groupes du réseau. */
	groupThreads: readonly ForwardGroupLike[]
	/** La conversation COURANTE (`chat:<id>` / `groupe:<id>`), exclue. */
	currentKey: string | null
	/** Les relations sans fil sont-elles proposées ? (la source sert le brouillon) */
	showRelations: boolean
	/** La lecture des fils a échoué — la feuille le dit, avec « Réessayer ». */
	isError?: boolean
	onRetry?: () => void
	/** Envoi en cours — la clé de la ligne choisie, sinon `null`. */
	sendingKey: string | null
	/** Le refus du serveur, rendu lisible par l'appelant. */
	errorMessage: string | null
	onSelect: (row: ForwardTargetRow) => void
}

export function ForwardMessageSheet({
	open,
	onOpenChange,
	threads,
	groupThreads,
	currentKey,
	showRelations,
	isError = false,
	onRetry,
	sendingKey,
	errorMessage,
	onSelect,
}: ForwardMessageSheetProps) {
	const { t } = useTranslation("messagerie")
	const [term, setTerm] = useState("")

	const conversations = useMemo(
		() =>
			buildForwardTargets(
				{
					threads: threads ?? [],
					groupThreads,
					excludeKey: currentKey,
				},
				t,
			),
		[threads, groupThreads, currentKey, t],
	)
	const search = useRelationSearch(term, { limit: 10 })
	const relations = useMemo(() => {
		if (!showRelations || !search.eligible) return []
		return relationForwardTargets({
			relations: search.items,
			existingChatHandles: existingChatHandlesOf(threads ?? []),
		})
	}, [showRelations, search.eligible, search.items, threads])

	const visibles = filterForwardTargets(conversations, term)
	const enRecherche = term.trim().length > 0
	const rienDuTout =
		visibles.length === 0 && relations.length === 0 && !search.isPending

	const renderRow = (row: ForwardTargetRow) => {
		const sending = sendingKey === row.key
		return (
			<li key={row.key}>
				<button
					type="button"
					className="msg-row"
					disabled={sendingKey !== null}
					aria-label={t("forwardMessageSheet.rowLabel", { hint: forwardTargetHint(row, t), title: row.title })}
					onClick={() => onSelect(row)}
				>
					<span className="msg-row-main">
						<span className="msg-row-name" title={row.title}>
							{row.kind === "groupe" ? (
								<Users
									aria-hidden="true"
									size={13}
									style={{ marginRight: 6, verticalAlign: "-2px" }}
								/>
							) : null}
							{row.title}
							{sending ? (
								<Loader2
									aria-hidden="true"
									size={13}
									className="animate-spin"
									style={{ marginLeft: 6, verticalAlign: "-2px" }}
								/>
							) : null}
						</span>
						{row.subtitle !== null ? (
							<span className="msg-row-preview">{row.subtitle}</span>
						) : null}
					</span>
				</button>
			</li>
		)
	}

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			{/* Exceptions assumées : 70 % de la hauteur au plus (la conversation
			    reste visible au-dessus) et une croix de 44 px, cible tactile —
			    d'où l'en-tête élargi à droite (`pr-16`). */}
			<SheetContent
				side="bottom"
				closeLabel={t("forwardMessageSheet.close")}
				className="max-h-[70dvh] rounded-t-2xl border-border/60 bg-secondary [&_[data-slot=sheet-close]]:!size-11"
			>
				{/* `pb-0` : la recherche suit la description sans double espacement. */}
				<SheetHeader className="pr-16 pb-0">
					<SheetTitle>{t("forwardMessageSheet.title")}</SheetTitle>
					<SheetDescription>{t("forwardMessageSheet.description")}</SheetDescription>
				</SheetHeader>

				{/* Hors du corps : la recherche reste en place pendant que la liste défile. */}
				<div className="shrink-0 px-4">
					<div className="msg-search-row">
						<input
							type="search"
							placeholder={t("forwardMessageSheet.searchPlaceholder")}
							value={term}
							onChange={(event) => setTerm(event.target.value)}
							aria-label={t("forwardMessageSheet.searchLabel")}
						/>
					</div>
				</div>

				<SheetBody className="gap-0">
					{errorMessage !== null ? (
						<p className="msg-error" role="status">
							{errorMessage}
						</p>
					) : null}

					{threads === undefined && !isError ? (
						<p className="msg-empty" role="status">
							{t("forwardMessageSheet.loading")}
						</p>
					) : isError ? (
						<p className="msg-empty" role="status">
							{t("forwardMessageSheet.loadError")}{" "}
							{onRetry !== undefined ? (
								<button type="button" className="msg-filter-btn" onClick={onRetry}>
									{t("forwardMessageSheet.retry")}
								</button>
							) : null}
						</p>
					) : rienDuTout ? (
						<p className="msg-empty">
							{enRecherche
								? t("forwardMessageSheet.noMatch", { term: term.trim() })
								: t("forwardMessageSheet.noOther")}
						</p>
					) : (
						<>
							<ul className="msg-list">{visibles.map(renderRow)}</ul>
							{relations.length > 0 ? (
								<>
									<p className="msg-day" role="presentation">
										{t("forwardMessageSheet.newConversation")}
									</p>
									<ul className="msg-list">{relations.map(renderRow)}</ul>
								</>
							) : null}
							{search.isPending ? (
								<p className="msg-empty" role="status">
									{t("forwardMessageSheet.searching")}
								</p>
							) : null}
						</>
					)}
				</SheetBody>
			</SheetContent>
		</Sheet>
	)
}
