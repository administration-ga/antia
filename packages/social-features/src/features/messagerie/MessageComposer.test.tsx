// Dupliqué de socle/packages/agent-features/src/features/messagerie/MessageComposer.test.tsx @ ad2e7fdc2 — adaptations : monté dans l'enveloppe du moteur (`renderWithEngine` : i18n française — libellés attendus : texte exact du socle) ; l'URL de dépôt factice n'est plus une URL absolue et le texte d'invite passe par une constante (cliquets des URL et des chaînes) ; aucun cas iDocument à retirer.
// @vitest-environment jsdom
/**
 * MessageComposer — le MODE ÉDITION et le brouillon de pièces.
 *
 * Le reste du composeur (quels fichiers sont admis, quand le bouton s'allume)
 * se vérifie sans DOM dans `messagerie-composer.test.ts`. Ici, les trois
 * choses qui n'existent qu'à l'écran : le bandeau de correction, le clavier
 * (`Entrée` enregistre, `Échap` annule SANS quitter le fil), et la pièce
 * annoncée « à resélectionner » après un rechargement.
 */
import { cleanup, fireEvent, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { renderWithEngine } from "../../tests/engine-wrapper"
import { MessageComposer, type ComposerMediaDraft } from "./MessageComposer"
import { newMediaItem } from "./messagerie-media-draft"

/** Le texte d'invite, fourni par la surface — une donnée du test. */
const PLACEHOLDER = "Écrire un message…"

// Le micro touche `MediaRecorder`, absent de jsdom — et il n'est pas le sujet.
vi.mock("./VoiceRecorderButton", () => ({
	VoiceRecorderButton: () => null,
}))

function poser(
	props: Partial<Parameters<typeof MessageComposer>[0]> = {},
): {
	onChange: ReturnType<typeof vi.fn>
	onSend: ReturnType<typeof vi.fn>
	onSubmitEdit: ReturnType<typeof vi.fn>
	onCancelEdit: ReturnType<typeof vi.fn>
	onEscape: ReturnType<typeof vi.fn>
	onError: ReturnType<typeof vi.fn>
} {
	const espions = {
		onChange: vi.fn(),
		onSend: vi.fn(async () => undefined),
		onSubmitEdit: vi.fn(async () => undefined),
		onCancelEdit: vi.fn(),
		onEscape: vi.fn(),
		onError: vi.fn(),
	}
	renderWithEngine(
		<MessageComposer
			value=""
			onChange={espions.onChange}
			placeholder={PLACEHOLDER}
			ariaLabel="Message à Nadia"
			onSend={espions.onSend}
			generateUploadUrl={async () => "adresse-de-depot-factice"}
			allowVoice={false}
			onEscape={espions.onEscape}
			onError={espions.onError}
			onSubmitEdit={espions.onSubmitEdit}
			onCancelEdit={espions.onCancelEdit}
			{...props}
		/>,
	)
	return espions
}

const EN_EDITION = {
	editing: { messageId: "m1", initialText: "texte à corriger" },
}

afterEach(() => {
	cleanup()
})

describe("MessageComposer — mode ÉDITION", () => {
	it("affiche le bandeau de modification et sème le champ", () => {
		poser(EN_EDITION)
		expect(screen.getByText("Modification du message")).toBeDefined()
		const champ = screen.getByLabelText("Modifier le message")
		expect((champ as HTMLTextAreaElement).value).toBe("texte à corriger")
	})

	it("n'affiche PAS le bandeau hors édition", () => {
		poser()
		expect(screen.queryByText("Modification du message")).toBeNull()
		expect(screen.getByLabelText("Message à Nadia")).toBeDefined()
	})

	it("enregistre à `Entrée` — le texte corrigé, TRIMÉ", async () => {
		const espions = poser(EN_EDITION)
		const champ = screen.getByLabelText("Modifier le message")
		fireEvent.change(champ, { target: { value: "  texte corrigé  " } })
		fireEvent.keyDown(champ, { key: "Enter" })
		await vi.waitFor(() => {
			expect(espions.onSubmitEdit).toHaveBeenCalledWith("texte corrigé")
		})
		// Le succès referme la correction : laisser le bandeau ouvert ferait
		// croire que rien n'a été enregistré.
		await vi.waitFor(() => {
			expect(espions.onCancelEdit).toHaveBeenCalled()
		})
		// Et surtout : `onSend` n'a PAS été appelé — modifier n'est pas envoyer.
		expect(espions.onSend).not.toHaveBeenCalled()
	})

	it("`Échap` annule la correction et NE quitte PAS le fil", () => {
		// Priorité IC-12 : un `Échap` ne ferme que la surface supérieure. Fermer
		// la conversation ferait perdre le fil à qui renonçait à une retouche.
		const espions = poser(EN_EDITION)
		fireEvent.keyDown(screen.getByLabelText("Modifier le message"), {
			key: "Escape",
		})
		expect(espions.onCancelEdit).toHaveBeenCalledTimes(1)
		expect(espions.onEscape).not.toHaveBeenCalled()
	})

	it("hors édition, `Échap` garde son contrat : il revient en arrière", () => {
		const espions = poser()
		fireEvent.keyDown(screen.getByLabelText("Message à Nadia"), {
			key: "Escape",
		})
		expect(espions.onEscape).toHaveBeenCalledTimes(1)
	})

	it("ne touche PAS au brouillon en cours de frappe", () => {
		// Le texte de la correction est local : `value`/`onChange` appartiennent
		// au message qu'on était en train d'écrire, et il doit survivre.
		const espions = poser({ ...EN_EDITION, value: "brouillon intact" })
		fireEvent.change(screen.getByLabelText("Modifier le message"), {
			target: { value: "autre chose" },
		})
		expect(espions.onChange).not.toHaveBeenCalled()
	})

	it("refuse d'enregistrer un texte VIDE", () => {
		const espions = poser({
			editing: { messageId: "m1", initialText: "à vider" },
		})
		const champ = screen.getByLabelText("Modifier le message")
		fireEvent.change(champ, { target: { value: "   " } })
		fireEvent.keyDown(champ, { key: "Enter" })
		expect(espions.onSubmitEdit).not.toHaveBeenCalled()
		expect(
			(screen.getByLabelText("Enregistrer la modification") as HTMLButtonElement)
				.disabled,
		).toBe(true)
	})

	it("ferme le trombone : modifier un message n'en change pas les pièces", () => {
		poser(EN_EDITION)
		expect(
			(screen.getByLabelText("Joindre un fichier") as HTMLButtonElement)
				.disabled,
		).toBe(true)
	})
})

describe("MessageComposer — le brouillon de PIÈCES", () => {
	function brouillon(
		items: ComposerMediaDraft["items"],
		fileOf: ComposerMediaDraft["fileOf"] = () => null,
	): ComposerMediaDraft {
		return {
			items,
			fileOf,
			add: vi.fn(),
			remove: vi.fn(),
			markUploaded: vi.fn(),
			markFailed: vi.fn(),
			clear: vi.fn(),
		}
	}

	const piece = newMediaItem({
		file: { name: "photo.png", size: 2048, type: "image/png" } as File,
	})

	it("montre les pièces du STORE, sans état local", () => {
		poser({ mediaDraft: brouillon([piece], () => new File([], "photo.png")) })
		expect(screen.getByText("photo.png")).toBeDefined()
	})

	it("ANNONCE une pièce à resélectionner et éteint l'envoi", () => {
		// Après un rechargement, les octets ont disparu : prétendre l'envoyer
		// échouerait sans que rien ne l'ait dit.
		poser({ value: "un mot", mediaDraft: brouillon([piece]) })
		expect(screen.getByText("à resélectionner")).toBeDefined()
		expect(
			(screen.getByLabelText("Envoyer") as HTMLButtonElement).disabled,
		).toBe(true)
	})

	it("retire une pièce par le magasin, pas par un état local", () => {
		const draft = brouillon([piece], () => new File([], "photo.png"))
		poser({ mediaDraft: draft })
		fireEvent.click(screen.getByLabelText("Retirer photo.png"))
		expect(draft.remove).toHaveBeenCalledWith(piece.localId)
	})

	it("sans la prop, le chemin d'origine (état local) reste intact", () => {
		poser({ value: "bonjour" })
		expect(
			(screen.getByLabelText("Envoyer") as HTMLButtonElement).disabled,
		).toBe(false)
	})
})
