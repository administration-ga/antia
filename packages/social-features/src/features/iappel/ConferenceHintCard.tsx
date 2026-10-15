// Dupliqué de socle/packages/agent-features/src/features/iappel/ConferenceHintCard.tsx @ ad2e7fdc2 — adaptations : ton « poste » retiré (aucun espace de poste dans le moteur) ; nom accessible de la croix traduit (i18n `iappel`) ; pile Échap lue dans la coque (`shell/floating-surface`) ; `useModalA11y` de @antia/ui.
"use client"

/**
 * ConferenceHintCard — LA CARTE « CONFÉRENCE », DESSINÉE (ADR-0149, fiche
 * « Appels de groupe de 2 à 11 » §6.2, prompt P3).
 *
 * `conference-hint.ts` DÉCIDE quelle carte montrer et COMPOSE ses mots ; ce
 * composant ne fait que les rendre. Il ne connaît ni fil, ni plafond, ni
 * appel : il reçoit `copy` et des gestes. C'est ce qui permet la même carte
 * dans la messagerie du réseau et sur la scène sombre de l'appel — seul le
 * TON change, par `data-tone`, dans la feuille d'appel de @antia/ui (bloc
 * « CARTE CONFÉRENCE »).
 *
 * Trois formes, une par moment où le plafond se rencontre :
 *
 *  · T1 — écran EN FLUX qui remplit son parent, fond assombri, et au centre un
 *    dialogue BLOQUANT : on choisit ses interlocuteurs, ou on réunit tout le
 *    monde en conférence ;
 *  · T2 — carte EN FLUX, statut NON bloquant : l'appel est complet ;
 *  · T3 — une LIGNE posée comme la barre « Ajouter » de la scène, qu'elle
 *    remplace : jamais un bouton inerte.
 *
 * ⚠️ RIEN N'EST PORTAILLÉ. L'appel et tout ce qui le concerne restent DANS le
 * téléphone iCom (ADR-0148) : un portail vers `body` sortirait la carte de la
 * carte, et d'une carte de rail on la retrouverait au milieu de la page. Le
 * parent (sélecteur, scène, corps de la carte) décide de la place.
 *
 * NI `Sheet` NI dialogue shadcn — le cliquet du dossier les interdit
 * (`iappel-surface.ratchet.test.ts`).
 */

import { X } from "lucide-react"
import { useModalA11y } from "@antia/ui"
import { useId, useRef, type KeyboardEvent, type RefObject } from "react"
import { useTranslation } from "react-i18next"
import { ESCAPE_PRIORITY } from "../../shell/floating-surface/escape-stack"
import { useEscapeLayer } from "../../shell/floating-surface/use-escape-layer"
import type { ConferenceHintCopy, ConferenceHintKind } from "./conference-hint"

export interface ConferenceHintCardProps {
	kind: ConferenceHintKind
	/** Résultat de `conferenceHintCopy` — la carte ne compose aucun mot. */
	copy: ConferenceHintCopy
	/**
	 * La charte du support :
	 *  · `immersive` — la scène sombre de l'appel ;
	 *  · `espace` — la messagerie du réseau (jetons de la charte).
	 */
	tone: "immersive" | "espace"
	onPrimary?: (() => void) | null
	onSecondary?: (() => void) | null
	onDismiss?: (() => void) | null
}

export function ConferenceHintCard(props: ConferenceHintCardProps) {
	// Trois composants, pas un seul qui bifurque : `useModalA11y` ne s'installe
	// qu'au MONTAGE. Une carte qui passerait de T2 à T1 sans se remonter aurait
	// photographié un conteneur absent, et le dialogue n'aurait jamais reçu le
	// focus. Changer de type de composant force le remontage.
	switch (props.kind) {
		case "T1":
			return <ConferenceHintDialog {...props} />
		case "T2":
			return <ConferenceHintStatus {...props} />
		case "T3":
			return <ConferenceHintLine {...props} />
	}
}

/** Ce que `Tab` peut atteindre dans la carte — le même relevé que ui-v2. */
const FOCUSABLE_SELECTOR = [
	"a[href]",
	"button:not([disabled])",
	"input:not([disabled]):not([type='hidden'])",
	"select:not([disabled])",
	"textarea:not([disabled])",
	"[tabindex]:not([tabindex='-1'])",
].join(",")

/**
 * T1 — le choix BLOQUANT, avant l'appel.
 *
 * ⚠️ `useModalA11y` en `trapFocus: false`, et ce n'est PAS un relâchement du
 * régime modal. En `trapFocus: true`, le hook pose son propre écouteur Échap
 * sur `document` et y appelle `onClose` sans regarder si la frappe a déjà été
 * consommée. Or la carte iCom (`MessagerieDock`) écoute Échap sur sa racine
 * React pour se ranger, et une carte qui ARRÊTE la propagation native
 * empêcherait la frappe d'atteindre `document` : c'est la carte entière qui
 * se fermerait à la place du dialogue. Dans
 * l'autre sens, doubler l'écouteur du hook par la pile ferait fermer deux
 * fois.
 *
 * Le dialogue tient donc lui-même ses deux touches, sur SA racine :
 *
 *  · `Tab` boucle dans la carte (le piège du régime modal) ;
 *  · `Échap` appelle `onDismiss` et PRÉVIENT l'évènement. La carte iCom
 *    ignore une frappe prévenue, et la pile Échap aussi
 *    (`defaultPrevented`) : une frappe, une fermeture.
 *
 * La pile (`useEscapeLayer`, palier OVERLAY) couvre le cas restant — le focus
 * sorti du dialogue, sur le fond assombri ou sur `<body>` — et CÈDE la frappe
 * quand le focus est dans une autre surface ou que la carte est couverte par
 * un appel. Le hook garde ce qu'il fait bien : le focus initial, et sa
 * restitution au déclencheur. ⚠️ Cette restitution ne vaut que si le
 * déclencheur reste MONTÉ : un consommateur qui REMPLACE son écran par T1
 * (la conversation de la messagerie) démonte le bouton avant que le hook ne
 * photographie `document.activeElement` — c'est alors à lui de rendre le
 * focus (`MessagerieConversationView`). `skipInert`,
 * parce que la page reste vivante : inerter les frères de `<body>`
 * éteindrait l'appel en cours et la carte iCom elle-même.
 */
function ConferenceHintDialog({
	tone,
	copy,
	onPrimary,
	onSecondary,
	onDismiss,
}: ConferenceHintCardProps) {
	const { t } = useTranslation("iappel")
	const sectionRef = useRef<HTMLElement | null>(null)
	const primaryRef = useRef<HTMLButtonElement | null>(null)
	const titleId = useId()
	const bodyId = useId()

	// Sans action principale, le focus entre dans le dialogue lui-même
	// (`tabIndex={-1}`) : un dialogue bloquant qui laisse le focus derrière
	// lui se lit, au clavier, comme un écran qui n'a pas changé.
	const initialFocusRef = onPrimary ? primaryRef : sectionRef

	useModalA11y({
		containerRef: sectionRef,
		initialFocusRef,
		// Échap n'appartient pas au hook ici — voir ci-dessus. Le rappel reste
		// exigé par sa signature, il n'est jamais appelé en `trapFocus: false`.
		onClose: () => {},
		trapFocus: false,
		skipInert: true,
	})

	const screenRef = useRef<HTMLDivElement | null>(null)
	useEscapeLayer({
		id: "conference-hint-t1",
		priority: ESCAPE_PRIORITY.OVERLAY,
		enabled: typeof onDismiss === "function",
		onEscape: () => {
			if (!onDismiss) return false
			const section = sectionRef.current
			// ⚠️ La pile est GLOBALE et ne regarde pas le focus : sans ces deux
			// gardes, T1 (palier 80) répondait à une frappe destinée à une autre
			// surface. Rendre `false` CÈDE la frappe à la couche suivante.
			//  · Carte iCom couverte par un appel (`data-call="cover"`) : le
			//    dialogue est monté mais masqué, la frappe va à l'appel.
			if (section === null || section.closest('[data-call="cover"]') !== null) {
				return false
			}
			//  · Focus posé dans une AUTRE surface (scène d'un appel, panneau
			//    d'ajout) : ce n'est pas à T1 de répondre.
			const active = document.activeElement
			if (
				active !== null &&
				active !== document.body &&
				screenRef.current?.contains(active) !== true
			) {
				return false
			}
			onDismiss()
		},
	})

	const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
		if (event.key === "Escape") {
			if (!onDismiss || event.defaultPrevented) return
			event.preventDefault()
			onDismiss()
			return
		}
		if (event.key !== "Tab") return
		const section = sectionRef.current
		if (section === null) return
		const focusables = Array.from(
			section.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
		)
		if (focusables.length === 0) {
			event.preventDefault()
			return
		}
		const first = focusables[0]!
		const last = focusables[focusables.length - 1]!
		const active = document.activeElement
		if (event.shiftKey && (active === first || active === section)) {
			event.preventDefault()
			last.focus()
		} else if (!event.shiftKey && active === last) {
			event.preventDefault()
			first.focus()
		}
	}

	return (
		// `tabIndex={-1}` : un clic sur le fond assombri garde le focus DANS
		// l'écran T1, et la frappe Échap suivante lui revient.
		<div ref={screenRef} className="iappel-hint-screen" data-tone={tone} tabIndex={-1}>
			<section
				ref={sectionRef}
				className="iappel-hint"
				data-kind="T1"
				data-tone={tone}
				role="dialog"
				aria-modal="true"
				aria-labelledby={titleId}
				aria-describedby={bodyId}
				tabIndex={-1}
				onKeyDown={handleKeyDown}
			>
				<div className="iappel-hint-head">
					<p className="iappel-hint-eyebrow">{copy.eyebrow}</p>
					{onDismiss ? (
						<button
							type="button"
							className="iappel-hint-close"
							aria-label={t("conferenceHintCard.close")}
							onClick={onDismiss}
						>
							<X aria-hidden="true" size={18} />
						</button>
					) : null}
				</div>
				<h2 className="iappel-hint-title" id={titleId}>
					{copy.title}
				</h2>
				<p className="iappel-hint-body" id={bodyId}>
					{copy.body}
				</p>
				<HintActions
					copy={copy}
					onPrimary={onPrimary}
					onSecondary={onSecondary}
					primaryRef={primaryRef}
				/>
			</section>
		</div>
	)
}

/**
 * T2 — l'appel est complet, dans le sélecteur.
 *
 * Un STATUT, pas un dialogue : on est en train de cocher, et la carte ne vole
 * ni le focus ni la touche Échap — celle-ci continue de fermer le sélecteur
 * qui la porte. « Continuer l'appel » la range.
 */
function ConferenceHintStatus({
	tone,
	copy,
	onPrimary,
	onSecondary,
}: ConferenceHintCardProps) {
	return (
		<div
			className="iappel-hint"
			data-kind="T2"
			data-tone={tone}
			role="status"
			aria-live="polite"
		>
			<p className="iappel-hint-eyebrow">{copy.eyebrow}</p>
			<p className="iappel-hint-title">{copy.title}</p>
			<p className="iappel-hint-body">{copy.body}</p>
			<HintActions copy={copy} onPrimary={onPrimary} onSecondary={onSecondary} />
		</div>
	)
}

/**
 * T3 — la ligne d'information qui REMPLACE la barre « Ajouter ».
 *
 * Posée exactement où la barre se trouvait : l'œil qui cherchait « Ajouter »
 * trouve la raison de son absence, et la sortie. Pas de secondaire — l'appel
 * continue, il n'y a rien à « continuer ». Sans `onPrimary`, la ligne informe
 * sans proposer : un lien qui ne mènerait nulle part serait une commande morte.
 */
function ConferenceHintLine({ tone, copy, onPrimary }: ConferenceHintCardProps) {
	return (
		<div className="iappel-hint-line" data-tone={tone} role="status">
			<span className="iappel-hint-dot" aria-hidden="true" />
			{/* ⚠️ Le CORPS est masqué à l'écran (`sr-only`), pas retiré : la ligne
			    doit tenir dans la réserve de la barre « Ajouter » (54 px). Titre
			    et corps côte à côte passaient sur trois lignes à 390 px et sur
			    cinq à 312, et la ligne recouvrait les noms de la dernière rangée
			    ou la moitié de la bande. Le lien « Lancer une conférence » dit ce
			    que disait le corps ; un lecteur d'écran lit toujours la phrase. */}
			<p className="iappel-hint-line-text">
				<strong>{copy.title}</strong> <span className="sr-only">{copy.body}</span>
			</p>
			{onPrimary ? (
				<button type="button" className="iappel-hint-link" onClick={onPrimary}>
					{copy.primary}
				</button>
			) : null}
		</div>
	)
}

/** Principal plein, secondaire en lien — chacun rendu seulement s'il agit. */
function HintActions({
	copy,
	onPrimary,
	onSecondary,
	primaryRef,
}: {
	copy: ConferenceHintCopy
	onPrimary?: (() => void) | null
	onSecondary?: (() => void) | null
	primaryRef?: RefObject<HTMLButtonElement | null>
}) {
	const secondary = copy.secondary !== null && onSecondary ? copy.secondary : null
	if (!onPrimary && secondary === null) return null
	return (
		<div className="iappel-hint-actions">
			{onPrimary ? (
				<button
					ref={primaryRef}
					type="button"
					className="iappel-hint-primary"
					onClick={onPrimary}
				>
					{copy.primary}
				</button>
			) : null}
			{secondary !== null && onSecondary ? (
				<button type="button" className="iappel-hint-secondary" onClick={onSecondary}>
					{secondary}
				</button>
			) : null}
		</div>
	)
}
