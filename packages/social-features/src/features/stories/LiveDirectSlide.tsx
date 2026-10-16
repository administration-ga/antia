// Dupliqué de socle/packages/agent-features/src/features/stories/LiveDirectSlide.tsx @ ad2e7fdc2 — adaptations : libellés traduits (clés `stories:liveDirectSlide.*`, décompte des spectateurs admis au pluriel i18n) ; nom d'hôte nullable (contrat `counterpartLabel`) dit par le libellé neutre, pastille sans initiales dans ce cas.
"use client"

/**
 * LiveDirectSlide — la carte d'un direct EN COURS dans le pager plein écran.
 *
 * ⚠️ **Aucun flux ne joue ici, et c'est la règle qui tient tout l'écran.**
 * Entrer dans un direct est un GESTE EXPLICITE (doctrine en tête de
 * `features/direct/DirectPage.tsx`) : les navigateurs bloquent l'audio sans
 * interaction, et un jeton spectateur CONSOMME une place de la salle. Un pager
 * qui ouvrirait la salle en glissant brûlerait les places d'un direct au
 * rythme du pouce, et l'hôte verrait son compteur monter sans que personne ne
 * regarde. Cette carte annonce, elle ne connecte pas.
 *
 * ⚠️ Le compteur affiché est celui du serveur — « admis », et jamais
 * « présents ». `DirectDiscoveryCardDto` documente pourquoi : la présence
 * réelle vit dans le SFU et n'arrive ici par aucun canal. Le libellé dit donc
 * ce que le nombre EST, plutôt que ce qu'on aimerait qu'il soit.
 */

import { Button } from "@antsia/ui"
import { useTranslation } from "react-i18next"
import { Avatar } from "../reseau-personnel/Avatar"
import { storyAuthorName } from "./stories-tray"
import type { LiveDirectCard } from "./stories-viewer"

export interface LiveDirectSlideProps {
	direct: LiveDirectCard
	/** Ouvrir la page du direct — la garde du jeton s'exerce là-bas. */
	onJoin: (sessionId: string) => void
	/** Quitter le lecteur. */
	onClose: () => void
}

export function LiveDirectSlide({
	direct,
	onJoin,
	onClose,
}: LiveDirectSlideProps) {
	const { t } = useTranslation("stories")
	const hostName = direct.host.displayName
	return (
		<div className="st-stage esp-story-stage">
			<div className="st-live">
				<span className="st-live-pill esp-live-pill">
					<span className="st-live-dot" aria-hidden="true" />
					{t("liveDirectSlide.live")}
				</span>

				<Avatar
					displayName={hostName ?? ""}
					hasIdentity={hostName !== null}
					avatarUrl={direct.host.avatarUrl}
					size={72}
				/>

				<h2 className="st-live-title">{direct.title}</h2>
				<p className="st-live-host">{storyAuthorName(hostName, t)}</p>
				<p className="st-live-counter">
					{t("liveDirectSlide.admittedViewers", {
						count: direct.counters.viewerGrantCount,
					})}
				</p>

				{/* La cible fait 44 px de haut au minimum — c'est le plancher tactile
				    d'ui-v2 sous 1024 px, et le geste principal de cet écran. */}
				<Button
					icon="video"
					onClick={() => onJoin(direct.sessionId)}
					style={{ minHeight: 48, paddingInline: 24 }}
				>
					{direct.isHost
						? t("liveDirectSlide.resumeMine")
						: t("liveDirectSlide.join")}
				</Button>
			</div>

			{/* La sortie, à la même place que sur une story : au téléphone il n'y a
			    pas de touche Échap, et le geste « retour » du système quitterait la
			    page entière. */}
			<div className="st-overlay st-overlay-top">
				<span className="st-author" />
				<button
					type="button"
					className="st-chip esp-story-chip"
					onClick={onClose}
					aria-label={t("liveDirectSlide.close")}
				>
					<span aria-hidden="true">✕</span>
				</button>
			</div>
		</div>
	)
}
