// Dupliqué de socle/packages/agent-features/src/features/messagerie/messagerie-floating-contract.test.ts @ ad2e7fdc2 — adaptations : format téléphone UNIQUE du moteur, 440 × 956, au lieu du gabarit 390 × 844 — largeur plafonnée à 440 px qui suit la hauteur disponible au rapport du téléphone, hauteur DÉDUITE de la largeur au même rapport ; feuille lue sur la constante exportée `MESSAGERIE_STYLES_CSS`, commentaires retirés, au lieu du texte source ; composants relus commentaires ôtés ; libellés de la barre iCom et de l'en-tête de brique lus par leurs clés i18n (`messagerieDock.*`, `icomBrickHeader.*`) et vérifiés dans la locale française (« iCom », « Rétracter iCom », « Déployer iCom », « Détacher iCom en fenêtre », « Rétracter/Déployer <brique> ») ; clé de la position flottante dérivée du préfixe de stockage du réseau (`icomFloatPlacementStorageKey(prefix)`), distincte de celle de l'état du dock, au lieu de la constante `espace:` ; surface flottante dans la coque (`shell/floating-surface/`) et relais d'iAppel vers `../../shell/floating-surface/` ; vérification de la fenêtre du poste (`icom-poste/IcomPosteWindow.tsx`) retirée — le moteur n'a qu'un espace, aucun poste ; cas ajouté : l'iCom détaché et la fenêtre d'appel flottante (`.iappel-float`, `communication.css` de `@antsia/ui`) ont une seule et même règle de format.
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { pathToFileURL } from "node:url"

import { describe, expect, it } from "vitest"

import { createAppI18n } from "../../i18n"
import {
	dockStorageKey,
	ICOM_FLOAT_PLACEMENT_STORAGE,
	icomFloatPlacementStorageKey,
} from "./dock-store"
import { MESSAGERIE_STYLES_CSS } from "./messagerie-styles"

const t = createAppI18n({
	locale: "fr",
	appResources: { fr: {}, en: {} },
	defaultNS: "messagerie",
}).getFixedT("fr")

/** Le téléphone du moteur, en pixels CSS : l'iPhone 17 Pro Max (440 × 956 pt). */
const PHONE = { width: 440, height: 956 } as const

/** Un préfixe de stockage de réseau, tel que `useNetwork()` le compose. */
const PREFIXE_RESEAU = "antsia:antsia:"

/** Le CODE d'un fichier (chemin relatif à ce test), commentaires ôtés : on vérifie du code, pas de la prose. */
function code(relativePath: string): string {
	return readFileSync(new URL(relativePath, import.meta.url), "utf8")
		.replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
		.replace(/\/\*[\s\S]*?\*\//g, "")
		.replace(/^\s*\/\/[^\n]*$/gm, "")
}

/** Le CSS d'une feuille, et RIEN d'autre : les commentaires sont retirés. */
function cssOf(sheet: string): string {
	return sheet.replace(/\/\*[\s\S]*?\*\//g, "")
}

/** La feuille de la messagerie, telle que la carte et la page la montent. */
const CSS = cssOf(MESSAGERIE_STYLES_CSS)

function cssBlock(css: string, selector: string): string {
	const start = css.indexOf(selector)
	expect(start, `${selector} introuvable`).toBeGreaterThan(-1)
	return css.slice(start, css.indexOf("}", start))
}

/** La valeur d'une déclaration d'un bloc (`width`, `height`…), sur une ligne, espaces normalisés. */
function declaration(block: string, property: string): string {
	const match = new RegExp(`^\\s*${property}:\\s*([^;]+);`, "m").exec(block)
	return (match?.[1] ?? "")
		.replace(/\s+/g, " ")
		.replace(/\(\s+/g, "(")
		.replace(/\s+\)/g, ")")
		.trim()
}

/** Une seule écriture des décimales : `0.46` et `.46` sont le même nombre. */
function sameDecimals(value: string): string {
	return value.replace(/\b0\.(\d)/g, ".$1")
}

describe("iCom ancré ou flottant — contrat de pose", () => {
	it("la pose flottante est portalisée sans talon dans le rail", () => {
		const body = code("./MessagerieDock.tsx")
		expect(body).toContain("return createPortal(")
		expect(body).toContain("document.body")
		expect(body).not.toContain("icom-stub")
	})

	it("la barre est la poignée, séparée de la commande de ré-ancrage", () => {
		const body = code("./MessagerieDock.tsx")
		expect(body).toContain(
			'<div className="icom-float-handle" {...drag.handleProps}>',
		)
		const handle = body.slice(
			body.indexOf('className="icom-float-handle"'),
			body.indexOf("</div>", body.indexOf('className="icom-float-handle"')),
		)
		expect(handle).not.toContain("dockStore.reattach")
	})

	it("le repli conserve l'en-tête et les quatre briques, avec iChat comme racine", () => {
		const body = code("./MessagerieDock.tsx")
		expect(body).toContain('data-root={icomTabsVisible(dock.view.kind)')
		expect(body).toContain("{icomTabsVisible(dock.view.kind) ? (")
		expect(body).not.toContain("icomTabsVisible(dock.view.kind) && dock.open")
		expect(body).toContain("dockStore.setOpen(true)")
		expect(body).toContain(
			"const activeTab = dock.open ? tab : ICOM_DOCK_TAB_DEFAULT",
		)

		expect(CSS).not.toContain(
			'.msg-panel[data-open="false"][data-root="true"] .msg-head-row',
		)
		const dock = cssBlock(CSS, ".msg-dock {")
		expect(dock).toContain("--icom-anchored-height: min(52vh, 420px)")
		expect(dock).not.toContain("min-height: var(--icom-anchored-height)")
		expect(dock).toContain("z-index: 2")
		expect(dock).toContain("isolation: isolate")
	})

	it("l'en-tête sépare l'identité, les actions et les commandes globales", () => {
		const header = code("./IcomBrickHeader.tsx")
		expect(header).toContain('className="msg-head-identity"')
		expect(header).toContain('className="msg-head-actions"')
		expect(header).toContain('className="msg-icon-btn msg-collapse-btn"')
		// Le chevron nomme la BRIQUE qu'il replie ou déplie — par sa clé, et la
		// phrase française est celle du socle.
		expect(header).toContain('t("icomBrickHeader.collapse", { title })')
		expect(header).toContain('t("icomBrickHeader.expand", { title })')
		expect(t("messagerie:icomBrickHeader.collapse", { title: "iChat" })).toBe(
			"Rétracter iChat",
		)
		expect(t("messagerie:icomBrickHeader.expand", { title: "iChat" })).toBe(
			"Déployer iChat",
		)
	})

	it("l'ancré sépare la barre iCom de l'en-tête de la brique active", () => {
		const body = code("./MessagerieDock.tsx")
		const barre = body.indexOf('className="icom-surface-bar"')
		const contenu = body.indexOf("icomDockBody(activeTab")
		expect(barre).toBeGreaterThan(-1)
		expect(barre).toBeLessThan(contenu)
		expect(body).toContain(
			'<span className="icom-surface-title">{t("messagerieDock.title")}</span>',
		)
		expect(body).toMatch(
			/aria-label=\{\s*dock\.open \? t\("messagerieDock\.collapse"\) : t\("messagerieDock\.expand"\)\s*\}/,
		)
		expect(body).toContain('aria-label={t("messagerieDock.detach")}')
		expect(t("messagerie:messagerieDock.title")).toBe("iCom")
		expect(t("messagerie:messagerieDock.collapse")).toBe("Rétracter iCom")
		expect(t("messagerie:messagerieDock.expand")).toBe("Déployer iCom")
		expect(t("messagerie:messagerieDock.detach")).toBe(
			"Détacher iCom en fenêtre",
		)
		// Les commandes géométriques n'apparaissent pas une seconde fois dans
		// les en-têtes iChat, Statuts, iAppel et Relations.
		expect(body.match(/showDockControls={false}/g)).toHaveLength(4)

		const surface = cssBlock(CSS, ".icom-surface-bar {")
		expect(surface).toContain("min-height: 56px")
		expect(surface).toContain("border-bottom")
	})

	it("l'ancré remplit son rail et le flottant prend le format téléphone UNIQUE 440 × 956", () => {
		const dock = cssBlock(CSS, ".msg-dock {")
		expect(dock).toContain("position: sticky")
		expect(dock).toContain("top: 0")
		expect(dock).toContain("align-self: stretch")
		expect(dock).toContain("width: 100%")
		expect(dock).toContain("min-width: 0")
		expect(dock).toContain("max-width: 100%")

		const floating = cssBlock(CSS, ".icom-float {")
		const largeur = declaration(floating, "width")
		const hauteur = declaration(floating, "height")
		// La largeur plafonne à celle du téléphone…
		expect(largeur).toContain(`min(${PHONE.width}px,`)
		expect(largeur.endsWith(`, ${PHONE.width}px)`)).toBe(true)
		// …et suit la hauteur disponible au rapport du téléphone : la fenêtre
		// garde ses proportions à toute taille d'écran.
		const rapport = /\(100dvh - 64px\) \* (\d*\.\d+)\)/.exec(largeur)?.[1] ?? ""
		expect(Number(rapport)).toBeCloseTo(PHONE.width / PHONE.height, 3)
		// La hauteur se DÉDUIT de la largeur, au même rapport : au plus large,
		// c'est celle du téléphone, au pixel près.
		expect(hauteur).toContain(`calc(${largeur} / ${rapport})`)
		expect(Math.trunc(PHONE.width / Number(rapport))).toBe(PHONE.height)
		// La position est écrite par la primitive de déplacement, jamais par CSS.
		expect(floating).not.toMatch(/^\s*(right|bottom):/m)
		expect(CSS).toContain("@media (prefers-reduced-motion: reduce)")
	})

	it("le téléphone iCom et la fenêtre d'appel flottante n'ont qu'UN format", () => {
		// Ce qui se détache au bureau est UN téléphone : l'iCom flottant, et
		// l'appel quand aucune carte ne l'héberge (`.iappel-float`, couche de
		// communication de `@antsia/ui`). Deux règles qui divergeraient d'un
		// pixel poseraient deux téléphones différents côte à côte.
		const entree = createRequire(import.meta.url).resolve("@antsia/ui/styles.css")
		const appel = cssOf(
			readFileSync(
				new URL("./styles/communication.css", pathToFileURL(entree)),
				"utf8",
			),
		)
		const call = cssBlock(appel, ".iappel-float {")
		const callWidth = declaration(call, "--iappel-float-w")
		expect(callWidth).toContain(`min(${PHONE.width}px,`)
		expect(declaration(call, "width")).toBe("var(--iappel-float-w)")
		const callHeight = declaration(call, "height").replace(
			"var(--iappel-float-w)",
			callWidth,
		)

		const floating = cssBlock(CSS, ".icom-float {")
		expect(sameDecimals(callWidth)).toBe(
			sameDecimals(declaration(floating, "width")),
		)
		expect(sameDecimals(callHeight)).toBe(
			sameDecimals(declaration(floating, "height")),
		)
	})

	it("le bureau ne propose plus de grande messagerie et conserve le téléphone détachable", () => {
		const body = code("./MessagerieDock.tsx")
		expect(body).not.toContain("dockOpenHref")
		expect(body).not.toContain("MSG_OPEN_LABEL")
		expect(body).not.toContain("router.push(")
		// La barre ancrée garde une seule commande d'ouverture en fenêtre.
		expect(body).toContain('aria-label={t("messagerieDock.detach")}')
		expect(body).toContain("<Maximize2")
		expect(body).not.toContain("<PictureInPicture2")
		const desktop = code("./MessagerieDesktopPage.tsx")
		expect(desktop).toContain("icomDesktopEntryHref")
		expect(desktop).toContain("router.replace(href")
		expect(desktop).not.toContain("msg-two-pane")
	})

	it("la fenêtre détachée rend exactement la variante mobile des vues", () => {
		const body = code("./MessagerieDock.tsx")
		expect(body).toContain(
			'const surfaceVariant: MessagerieVariant = floating ? "page" : "dock"',
		)
		expect(body).toContain("data-variant={surfaceVariant}")
		expect(body).toContain('data-fill={floating ? "screen" : undefined}')
		expect(body).toContain("variant={surfaceVariant}")
	})

	it("un appel personnel reste DANS la carte, sous la barre iCom, dans ses trois formes (IC-01/IC-02/IC-06)", () => {
		const body = code("./MessagerieDock.tsx")
		// La carte se déclare pour le réseau PERSONNEL, sous une identité stable.
		expect(body).toContain('export const ICOM_AGENT_CALL_HOST_ID = "icom-agent"')
		expect(body).toContain('Object.freeze(["personnel"])')
		// Sa forme suit le dock : téléphone détaché, carte moyenne, rétractée.
		expect(body).toContain(
			'const hostPose: CallHostPose = dock.floating\n\t\t? "phone"\n\t\t: dock.open\n\t\t\t? "medium"\n\t\t\t: "compact"',
		)
		// L'hôte est un enfant DIRECT du panneau, juste sous la barre iCom :
		// c'est ce que la feuille de style cache ou dévoile.
		const barre = body.indexOf('className="icom-surface-bar"')
		const hote = body.indexOf('className="icom-call-host"')
		const contenu = body.indexOf("icomDockBody(activeTab")
		expect(barre).toBeLessThan(hote)
		expect(hote).toBeLessThan(contenu)
		expect(body).toContain('data-call={callMode === "none" ? undefined : callMode}')

		// Vide, l'hôte n'existe pas ; couvert, tout sauf la barre disparaît
		// (display:none — hors de l'ordre de tabulation, pas seulement invisible).
		expect(CSS).toContain(".icom-call-host { display: none; }")
		expect(CSS).toContain(
			'.msg-panel[data-call="cover"] > :not(.icom-call-host):not(.icom-surface-bar) {',
		)
		const cover = cssBlock(CSS, '.msg-panel[data-call="cover"] > .icom-call-host {')
		expect(cover).toContain("flex: 1 1 auto")
		expect(cover).toContain("min-height: 0")
		const strip = cssBlock(CSS, '.msg-panel[data-call="strip"] > .icom-call-host {')
		expect(strip).toContain("flex: 0 0 auto")
	})

	it("la position vit en session sans changer l'état persisté du dock", () => {
		expect(ICOM_FLOAT_PLACEMENT_STORAGE).toBe("session")
		// La clé suit le réseau (son préfixe de stockage) et reste HORS de
		// l'état du dock : ajouter des pixels à cet état invaliderait
		// conversations et brouillons.
		expect(icomFloatPlacementStorageKey(PREFIXE_RESEAU)).toBe(
			`${PREFIXE_RESEAU}icom-floating-placement:v1`,
		)
		expect(icomFloatPlacementStorageKey(PREFIXE_RESEAU)).not.toBe(
			dockStorageKey(PREFIXE_RESEAU),
		)
		const body = code("./MessagerieDock.tsx")
		expect(body).toContain('placementMode: "free"')
		expect(body).toContain("storageKey: icomFloatPlacementStorageKey(storagePrefix)")
		expect(body).toContain("storage: ICOM_FLOAT_PLACEMENT_STORAGE")
		const hook = code("../../shell/floating-surface/use-surface-drag.ts")
		expect(hook).toContain("window.sessionStorage")
		expect(hook).toContain('storage = "local"')
	})

	it("iAppel conserve ses imports historiques par réexport", () => {
		for (const name of [
			"surface-drag",
			"use-surface-drag",
			"use-surface-insets",
		]) {
			expect(code(`../iappel/${name}.ts`)).toContain(
				`export * from "../../shell/floating-surface/${name}"`,
			)
		}
	})
})
