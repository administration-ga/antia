// Dupliqué de socle/packages/agent-features/src/features/messagerie/GroupCallInviteePicker.tsx @ ad2e7fdc2 — adaptations : textes traduits (i18n `messagerie`, clés `groupCallInviteePicker.…`) ; phrases des modules purs avec `t` (`selectionHint`, `selectionBlockReason`, `conferenceHintCopy`) ; plafond d'appel constant du moteur (aucune lecture serveur du plafond) ; comptes exemptés retirés (prop `exempt` ôtée, comme dans `planConferenceHint`) ; doc recadrée (plus d'appel ad hoc de poste).
"use client"

/**
 * GroupCallInviteePicker — CHOISIR QUI APPELER dans un grand groupe (IC-08).
 *
 * Un fil de groupe porte plus de monde qu'un appel, qui s'arrête à onze
 * personnes, appelant compris (plafond CONSTANT du moteur) : « Appeler le
 * groupe » échouait sur les grands fils, sans issue nommée. Cet écran est
 * l'issue — il REMPLACE la
 * conversation, comme la fiche du groupe (`MessagerieGroupeInfos`), plutôt que
 * de s'empiler par-dessus : on ne compose pas un appel dans une modale
 * au-dessus d'un fil qui continue.
 *
 * Quatre règles portées ici, toutes venues du constat :
 *
 *  · le PLAFOND s'annonce avant la soumission (compteur permanent, cases
 *    inertes au-delà) — pas au clic sur « Appeler » ;
 *  · la conférence est une ALTERNATIVE EXPLICITE, jamais une conversion
 *    silencieuse d'une conversation privée en diffusion ;
 *  · à la dernière case cochable, la carte T2 le DIT une fois (fiche §6.2) :
 *    l'appel est complet, la conférence accueille tout le groupe. Fermée,
 *    elle ne revient pas pendant cette ouverture — décocher puis recocher
 *    n'est pas une nouvelle information ;
 *  · une personne non cochée NE SONNE PAS — le serveur ne reçoit que les
 *    identifiants cochés, et les re-contrôle.
 *
 * ⚠️ La liste DÉFILE et le pied NE DÉFILE PAS. Cet écran était un unique bloc
 * posé dans `.msg-panel`, qui porte `overflow: hidden` : sur un fil de
 * vingt-cinq membres dans le téléphone iCom, la fin de la liste — et les
 * boutons Appeler / Vidéo sous elle — étaient coupés sans barre de défilement
 * pour le signaler. Le compteur, la carte T2 et les boutons vivent donc dans
 * un pied fixe, sous le défilement : c'est là que la fiche les ancre.
 *
 * Ce qui décide vit dans `groupe-appel-selection.ts` et
 * `iappel/conference-hint.ts` (modules purs, testés en `node`) : ce composant
 * ne fait que les rendre.
 */

import { Phone, Search, Users, Video, X } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { ConferenceHintCard } from "../iappel/ConferenceHintCard"
import {
	conferenceHintCopy,
	planConferenceHint,
	type ConferenceHintKind,
} from "../iappel/conference-hint"
import { effectiveCapacity } from "../iappel/group-call-capacity"
import { Avatar } from "../reseau-personnel/Avatar"
import {
	canStartGroupCall,
	invalidInvitees,
	maxInvitees,
	selectionBlockReason,
	selectionHint,
	toggleInvitee,
} from "./groupe-appel-selection"
import { filtrerMembres, type MembreDuGroupe } from "./groupe-gestion"
import type { MessagerieVariant } from "./messagerie-views"

export interface GroupCallInviteePickerProps {
	/** Le nom du groupe — l'écran remplace le fil, il doit se situer. */
	title: string
	/** Les membres VIVANTS du fil (`groups.threads.paginateGroupMembers`, mis en vue). */
	members: readonly MembreDuGroupe[]
	/** Le plafond de l'appel, appelant compris — absent : le plafond constant du moteur. */
	capacity?: number | null
	/** Un lancement est en vol. */
	pending?: boolean
	/** Le refus du serveur, déjà traduit depuis son code (`error.data`). */
	errorMessage?: string | null
	variant?: MessagerieVariant
	onCancel: () => void
	onStart: (mediaType: "audio" | "video", userIds: string[]) => void
	/**
	 * L'ALTERNATIVE : lancer une conférence, pour réunir tout le groupe. Le
	 * geste est explicite et porte son nom — jamais une conversion automatique
	 * de l'appel demandé.
	 */
	onConvokeMeeting?: (() => void) | null
}

export function GroupCallInviteePicker({
	title,
	members,
	capacity,
	pending = false,
	errorMessage = null,
	variant = "page",
	onCancel,
	onStart,
	onConvokeMeeting,
}: GroupCallInviteePickerProps) {
	const { t } = useTranslation("messagerie")
	const [selection, setSelection] = useState<ReadonlySet<string>>(new Set())
	const [recherche, setRecherche] = useState("")
	/**
	 * La carte T2 a-t-elle été fermée pendant CETTE ouverture ?
	 *
	 * L'état est local au composant, et c'est voulu : l'écran se démonte quand
	 * on revient à la conversation, si bien que la mémoire de fermeture dure
	 * exactement une ouverture du sélecteur (fiche §6.2).
	 */
	const [t2Fermee, setT2Fermee] = useState(false)

	const autres = useMemo(
		() => members.filter((membre) => !membre.isMe),
		[members],
	)
	const vivants = useMemo(
		() => new Set(autres.map((membre) => membre.userId)),
		[autres],
	)
	/** Voisins STABLES du pied, où le focus revient quand T2 se range. */
	const appelerRef = useRef<HTMLButtonElement | null>(null)
	const rechercheRef = useRef<HTMLInputElement | null>(null)
	/**
	 * ⚠️ Cet écran REMPLACE ce qui l'a ouvert (la conversation, ou la carte T1) :
	 * le bouton qui portait le focus est démonté, et le focus retombait sur
	 * `<body>`, hors du téléphone. On le pose sur le titre de la section — pas
	 * sur la recherche, qui ouvrirait le clavier d'un téléphone sans qu'on l'ait
	 * demandé.
	 */
	const titreRef = useRef<HTMLHeadingElement | null>(null)
	useEffect(() => {
		titreRef.current?.focus({ preventScroll: true })
	}, [])
	const affiches = useMemo(
		() => filtrerMembres(autres, recherche),
		[autres, recherche],
	)
	const plafond = effectiveCapacity(capacity)
	const max = maxInvitees(capacity)
	// La liste a pu vieillir pendant la composition : on ne soumet que ce qui
	// est encore membre, sinon le serveur refuse l'appel ENTIER.
	const perimes = invalidInvitees(
		selection,
		autres.map((membre) => membre.userId),
	)
	const choisis = [...selection].filter((userId) => !perimes.includes(userId))
	const complet = choisis.length >= max
	const pret = canStartGroupCall({ count: choisis.length, capacity })
	const empeche = selectionBlockReason({ count: choisis.length, capacity }, t)

	const dismissed = useMemo<ReadonlySet<ConferenceHintKind>>(
		() => (t2Fermee ? new Set<ConferenceHintKind>(["T2"]) : new Set()),
		[t2Fermee],
	)
	const carte = planConferenceHint({
		moment: "picking",
		picked: choisis.length,
		capacity: plafond,
		dismissed,
	})

	/**
	 * ⚠️ « Continuer l'appel » démonte la carte T2 sur laquelle se trouve le
	 * focus : sans ce geste, le clavier retombait sur `<body>`. Le focus va sur
	 * « Appeler » (actif dès que la sélection compte deux personnes), sinon sur
	 * la recherche — AVANT de ranger la carte, tant que la cible est montée.
	 */
	const rangerT2 = () => {
		const cible = appelerRef.current
		if (cible !== null && !cible.disabled) cible.focus()
		else rechercheRef.current?.focus()
		setT2Fermee(true)
	}

	const lancer = (mediaType: "audio" | "video") => {
		if (!pret || pending) return
		onStart(mediaType, choisis)
	}

	return (
		<>
			<div className="msg-head-row">
				<button
					type="button"
					className="msg-icon-btn"
					aria-label={t("groupCallInviteePicker.back")}
					onClick={onCancel}
				>
					<X aria-hidden="true" size={18} />
				</button>
				<span className="msg-head" style={{ cursor: "default" }}>
					<span aria-hidden="true" className="msg-row-emblem">
						<Users size={15} />
					</span>
					<span className="msg-row-main">
						<span className="msg-head-title">
							{t("groupCallInviteePicker.title", { titre: title })}
						</span>
					</span>
				</span>
			</div>

			<div
				className="msg-scroller msg-infos-scroller"
				role="region"
				aria-label={t("groupCallInviteePicker.listLabel")}
				tabIndex={0}
			>
				<div className="msg-infos" data-variant={variant}>
					<section className="msg-infos-block" aria-labelledby="msg-appel-groupe">
						<h2
							id="msg-appel-groupe"
							ref={titreRef}
							tabIndex={-1}
							className="msg-infos-soustitre"
						>
							{t("groupCallInviteePicker.heading")}
						</h2>
						{/* Le plafond, dit AVANT la soumission — c'est tout l'objet de
						    l'écran. Les mots sont ceux de la fiche (§6.2), et le
						    chiffre est le plafond EFFECTIF, jamais écrit ici. */}
						<p className="msg-infos-meta">
							{t("groupCallInviteePicker.capacity", {
								membres: members.length,
								plafond,
							})}
						</p>

						<div className="msg-infos-search">
							<Search aria-hidden="true" size={17} />
							<label className="sr-only" htmlFor="msg-appel-recherche">
								{t("groupCallInviteePicker.searchLabel")}
							</label>
							<input
								ref={rechercheRef}
								id="msg-appel-recherche"
								type="search"
								value={recherche}
								placeholder={t("groupCallInviteePicker.searchPlaceholder")}
								onChange={(event) => setRecherche(event.currentTarget.value)}
							/>
						</div>

						{affiches.length === 0 ? (
							<p className="msg-infos-meta">
								{t("groupCallInviteePicker.noMatch")}
							</p>
						) : (
							<ul className="msg-infos-liste">
								{affiches.map((membre) => {
									const coche = selection.has(membre.userId)
									// Une case inerte ne se rend PAS invisible : elle dit qu'il
									// n'y a plus de place, et décocher en libère une.
									const bloquee = !coche && complet
									return (
										<li key={membre.userId} className="msg-infos-member">
											<label
												className="msg-row"
												style={{ cursor: bloquee ? "not-allowed" : "pointer" }}
											>
												<input
													type="checkbox"
													// La CIBLE tactile est la ligne entière (`.msg-row`,
													// 58 px de haut) : la case elle-même est agrandie pour
													// être visible, pas pour être visée.
													style={{ width: 20, height: 20, flex: "0 0 auto" }}
													checked={coche}
													disabled={bloquee || pending}
													// ⚠️ La bascule part de la sélection ÉLAGUÉE des
													// personnes parties. Sinon, à 10/10 avec une partie,
													// l'écran compte 9 (cases réactivées, T2 retirée)
													// pendant que `toggleInvitee` compte encore 10 et rend
													// l'ensemble inchangé : une case active mais inerte.
													onChange={() =>
														setSelection((current) =>
															toggleInvitee(
																new Set([...current].filter((id) => vivants.has(id))),
																membre.userId,
																max,
															),
														)
													}
													aria-label={t("groupCallInviteePicker.callMember", {
														nom: membre.displayName,
													})}
												/>
												<Avatar
													displayName={membre.displayName}
													avatarUrl={membre.avatarUrl}
													hasIdentity={membre.handle !== null}
													size={40}
												/>
												<div className="msg-row-main">
													<span className="msg-row-name">{membre.displayName}</span>
													{membre.handle === null ? null : (
														<span className="msg-row-handle">@{membre.handle}</span>
													)}
												</div>
											</label>
										</li>
									)
								})}
							</ul>
						)}
					</section>

					{onConvokeMeeting ? (
						<div className="msg-infos-confirm-actions">
							<button
								type="button"
								className="msg-infos-mini"
								onClick={onConvokeMeeting}
							>
								<Users aria-hidden="true" size={15} />{" "}
								{t("groupCallInviteePicker.convoke")}
							</button>
						</div>
					) : null}
				</div>
			</div>

			{/* Le PIED — hors du défilement. Compteur, carte T2 et boutons restent
			    visibles quelle que soit la longueur de la liste. */}
			<div className="msg-picker-footer" data-variant={variant}>
				<div className="msg-picker-footer-inner">
					<p className="msg-infos-meta msg-picker-counter" role="status">
						{selectionHint(choisis.length, capacity, t)}
					</p>

					{carte?.kind === "T2" ? (
						<ConferenceHintCard
							kind="T2"
							tone="espace"
							copy={conferenceHintCopy(
								"T2",
								{
									capacity: plafond,
									members: members.length,
									context: "thread",
								},
								t,
							)}
							onPrimary={onConvokeMeeting ?? null}
							// « Continuer l'appel » EST la fermeture : T2 ne bloque rien,
							// une croix de plus doublerait le même geste.
							onSecondary={rangerT2}
						/>
					) : null}

					<div
						className="msg-infos-quick-actions msg-picker-actions"
						role="group"
						aria-label={t("groupCallInviteePicker.launch")}
					>
						<button
							ref={appelerRef}
							type="button"
							className="msg-infos-quick"
							disabled={!pret || pending}
							onClick={() => lancer("audio")}
						>
							<Phone aria-hidden="true" size={18} />
							<span>
								{pending
									? t("groupCallInviteePicker.calling")
									: t("groupCallInviteePicker.call")}
							</span>
						</button>
						<button
							type="button"
							className="msg-infos-quick"
							disabled={!pret || pending}
							onClick={() => lancer("video")}
						>
							<Video aria-hidden="true" size={18} />
							<span>{t("groupCallInviteePicker.video")}</span>
						</button>
					</div>

					{empeche !== null && choisis.length > 0 ? (
						<p className="msg-infos-meta">{empeche}</p>
					) : null}
					{perimes.length > 0 ? (
						<p className="msg-error" role="alert">
							{/* ⚠️ « Elle a été retirée » était faux : l'identifiant reste
							    dans la sélection jusqu'au prochain geste, et reviendrait
							    coché si la personne rejoignait le fil. Ce qui est VRAI :
							    elle ne sonnera pas (`choisis` l'écarte). */}
							{t("groupCallInviteePicker.leftGroup", {
								count: perimes.length,
							})}
						</p>
					) : null}
					{errorMessage !== null ? (
						<p className="msg-error" role="alert">
							{errorMessage}
						</p>
					) : null}
				</div>
			</div>
		</>
	)
}
