// Dupliqué de socle/packages/agent-features/src/features/messagerie/MessagerieDesktopPage.tsx @ ad2e7fdc2 — adaptations : routeur par `@antia/api/routing` ; page d'arrivée INJECTÉE (`useRoutes().home()`, passée à `icomDesktopEntryHref`) ; annonce « Ouverture d'iCom… » traduite (clé `messagerieDesktopPage.opening`).
"use client"

import { useRoutes } from "@antia/api/network"
import { useRouter, useSearchParams } from "@antia/api/routing"
import { Suspense, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { icomDesktopEntryHref } from "./icom-desktop-entry"
import type { ConversationKey } from "./messagerie-dock"

interface MessagerieDesktopPageProps {
	conversationKey: ConversationKey | null
	compose?: "personne" | "groupe"
}

/**
 * Passerelle des anciens liens Messages sur ordinateur.
 *
 * La grande messagerie à deux ou trois volets a été retirée au socle le 08/09.
 * L'adresse reste compatible pour les notifications, favoris et liens
 * partagés, mais elle ouvre désormais l'unique téléphone iCom de l'accueil,
 * dans la conversation ou le composeur demandé.
 */
export function MessagerieDesktopPage(props: MessagerieDesktopPageProps) {
	const { t } = useTranslation("messagerie")
	return (
		<Suspense fallback={<p role="status">{t("messagerieDesktopPage.opening")}</p>}>
			<OpenIcomDesktop {...props} />
		</Suspense>
	)
}

function OpenIcomDesktop(props: MessagerieDesktopPageProps) {
	const { t } = useTranslation("messagerie")
	const router = useRouter()
	const home = useRoutes().home()
	const search = useSearchParams().toString()
	const href = icomDesktopEntryHref({ ...props, home, search })

	useEffect(() => {
		router.replace(href, { scroll: false })
	}, [href, router])

	return <p role="status">{t("messagerieDesktopPage.opening")}</p>
}
