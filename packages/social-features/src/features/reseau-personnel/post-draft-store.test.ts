// Dupliqué de socle/packages/agent-features/src/features/reseau-personnel/post-draft-store.test.ts @ ad2e7fdc2 — adaptations : le magasin est configuré avec un préfixe de réseau de test (`configurePostDraftStorage`) et la clé lue est celle du réseau ET de l'auteur (`postDraftStorageKey(prefix, scope)`) ; une « nouvelle session » oublie l'auteur et le réseau, puis les repose ; texte de brouillon sans « note de service » ; tous les cas du socle portés ; cas ajoutés pour le préfixe par réseau — rien n'est écrit avant configuration, un geste antérieur est conservé, deux réseaux ne partagent rien, la configuration est idempotente, `null` suspend la persistance.
/**
 * post-draft-store — la PERSISTANCE des brouillons (R-12).
 *
 * Ce qu'on vérifie ici, et qu'aucun test de composant ne dirait aussi
 * clairement : la clé de `sessionStorage` est SCOPÉE PAR RÉSEAU ET PAR AUTEUR
 * (aucun brouillon relu — donc publié — sous une autre identité ni dans un
 * autre réseau), le registre des fichiers reste HORS de ce qu'on écrit, et une
 * frappe antérieure à la connaissance de l'auteur n'est pas écrasée par un
 * brouillon plus ancien.
 *
 * `window.sessionStorage` est simulé.
 */
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest"
import { parseDrafts, postDraftKey } from "./post-draft"
import {
  POST_DRAFT_STORAGE_SEGMENT,
  configurePostDraftStorage,
  hasRuntimeMedia,
  postDraftStore,
  postDraftStorageKey,
  runtimeMediaFile,
  runtimeMediaPreview,
} from "./post-draft-store"

const values = new Map<string, string>()

Object.defineProperty(globalThis, "window", {
  configurable: true,
  value: {
    sessionStorage: {
      getItem(key: string) {
        return values.get(key) ?? null
      },
      setItem(key: string, value: string) {
        values.set(key, value)
      },
    },
  },
})

// `URL.revokeObjectURL` n'existe pas en environnement `node` : le magasin le
// protège par un try/catch, on le fournit tout de même pour ne rien masquer.
const revoked: string[] = []
Object.defineProperty(globalThis, "URL", {
  configurable: true,
  value: {
    revokeObjectURL(url: string) {
      revoked.push(url)
    },
  },
})

afterAll(() => {
  Reflect.deleteProperty(globalThis, "window")
  Reflect.deleteProperty(globalThis, "URL")
})

const FEED = postDraftKey({ kind: "feed" })

/** Le préfixe d'un réseau de test (`useNetwork().storagePrefix`). */
const PREFIXE = "antia:test:"

/** La clé de l'auteur dans le réseau de test. */
const cle = (auteur: string) => postDraftStorageKey(PREFIXE, auteur)

/** Nouvelle session : mémoire vidée (auteur et réseau oubliés), stockage conservé, réseau reposé par la coque. */
function nouvelleSession(): void {
  postDraftStore.resetForTests()
  configurePostDraftStorage(PREFIXE)
}

function fichier(name: string): File {
  return { name, size: 10, type: "image/png" } as File
}

function meta(localId: string) {
  return {
    localId,
    kind: "image" as const,
    altText: "",
    fileName: `${localId}.png`,
    mimeType: "image/png",
    sizeBytes: 10,
    upload: { status: "pending" as const },
  }
}

beforeEach(() => {
  values.clear()
  revoked.length = 0
  nouvelleSession()
})

afterEach(() => {
  postDraftStore.resetForTests()
})

describe("scope par AUTEUR", () => {
  it("n'écrit RIEN tant que l'auteur est inconnu", () => {
    postDraftStore.setBody(FEED, "Avant le profil")
    expect(values.size).toBe(0)
    expect(postDraftStore.scope()).toBeNull()
  })

  it("écrit sous une clé qui porte le réseau et l'auteur", () => {
    postDraftStore.setScope("awa")
    postDraftStore.setBody(FEED, "Compte rendu de la réunion")
    expect(values.has(cle("awa"))).toBe(true)
    expect(cle("awa")).toBe(`${PREFIXE}${POST_DRAFT_STORAGE_SEGMENT}awa`)
  })

  it("deux auteurs = deux brouillons, jamais mêlés", () => {
    postDraftStore.setScope("awa")
    postDraftStore.setBody(FEED, "Brouillon d'Awa")
    nouvelleSession()

    postDraftStore.setScope("bilal")
    // Rien à relire pour Bilal : l'état part vide, pas sur le texte d'Awa.
    postDraftStore.setBody(FEED, "Brouillon de Bilal")

    const awa = parseDrafts(values.get(cle("awa")))
    const bilal = parseDrafts(values.get(cle("bilal")))
    expect(awa.drafts[FEED]?.body).toBe("Brouillon d'Awa")
    expect(bilal.drafts[FEED]?.body).toBe("Brouillon de Bilal")
  })

  it("relit le brouillon de l'auteur quand rien n'a été écrit depuis", () => {
    postDraftStore.setScope("awa")
    postDraftStore.setBody(FEED, "Repris au rechargement")
    const cleAwa = parseDrafts(values.get(cle("awa")))
    expect(cleAwa.drafts[FEED]?.body).toBe("Repris au rechargement")

    // Nouvelle session (mémoire vidée, stockage conservé).
    nouvelleSession()
    postDraftStore.setScope("awa")
    expect(postDraftStore.scope()).toBe("awa")
    const relu = parseDrafts(values.get(cle("awa")))
    expect(relu.drafts[FEED]?.body).toBe("Repris au rechargement")
  })

  it("n'ÉCRASE PAS une frappe antérieure à la connaissance de l'auteur", () => {
    // Le stockage porte un brouillon plus ancien…
    postDraftStore.setScope("awa")
    postDraftStore.setBody(FEED, "Ancien")
    nouvelleSession()

    // …et l'usager a commencé à écrire avant que son identité ne soit posée.
    postDraftStore.setBody(FEED, "En cours de frappe")
    postDraftStore.setScope("awa")

    const stocke = parseDrafts(values.get(cle("awa")))
    expect(stocke.drafts[FEED]?.body).toBe("En cours de frappe")
  })
})

describe("l'ouverture de la feuille survit à la bascule d'arbre", () => {
  it("est un état de MODULE, pas d'arbre", () => {
    postDraftStore.setScope("awa")
    postDraftStore.setComposerOpen(true)
    // Le remplacement d'arbre (959→960) ne touche pas au magasin : c'est tout
    // l'objet du lot. On le constate sur la persistance.
    expect(parseDrafts(values.get(cle("awa"))).composerOpen).toBe(true)
    postDraftStore.setComposerOpen(false)
    expect(parseDrafts(values.get(cle("awa"))).composerOpen).toBe(false)
  })

  it("garde une feuille ouverte à la main quand l'auteur arrive", () => {
    postDraftStore.setComposerOpen(true)
    postDraftStore.setScope("awa")
    expect(parseDrafts(values.get(cle("awa"))).composerOpen).toBe(true)
  })
})

describe("le registre RUNTIME reste hors du stockage", () => {
  it("garde le fichier et l'aperçu en mémoire, jamais en session", () => {
    postDraftStore.setScope("awa")
    postDraftStore.addMedia(FEED, [
      { meta: meta("m1"), file: fichier("plan.png"), previewUrl: "blob:m1" },
    ])

    expect(runtimeMediaFile("m1")?.name).toBe("plan.png")
    expect(runtimeMediaPreview("m1")).toBe("blob:m1")

    const brut = values.get(cle("awa")) ?? ""
    expect(brut).not.toContain("blob:m1")
    expect(brut).toContain("m1.png") // le NOM déclaré, seul, survit
    expect(parseDrafts(brut).drafts[FEED]?.media[0]?.localId).toBe("m1")
  })

  it("révoque l'aperçu au retrait, au vidage et à l'abandon", () => {
    postDraftStore.setScope("awa")
    postDraftStore.addMedia(FEED, [
      { meta: meta("m1"), file: fichier("a.png"), previewUrl: "blob:m1" },
      { meta: meta("m2"), file: fichier("b.png"), previewUrl: "blob:m2" },
    ])
    postDraftStore.removeMedia(FEED, "m1")
    expect(hasRuntimeMedia("m1")).toBe(false)
    expect(revoked).toContain("blob:m1")

    postDraftStore.clear(FEED)
    expect(hasRuntimeMedia("m2")).toBe(false)
    expect(revoked).toContain("blob:m2")
  })

  it("mémorise le téléversement réussi — la reprise ne re-téléverse pas", () => {
    postDraftStore.setScope("awa")
    postDraftStore.addMedia(FEED, [
      { meta: meta("m1"), file: fichier("a.png"), previewUrl: "blob:m1" },
    ])
    postDraftStore.markUploaded(FEED, "m1", "storage-1")
    const stocke = parseDrafts(values.get(cle("awa")))
    expect(stocke.drafts[FEED]?.media[0]?.upload).toMatchObject({
      status: "uploaded",
      storageId: "storage-1",
    })
  })
})

describe("le vidage n'a lieu qu'au succès", () => {
  it("rend un brouillon neuf ET une clé neuve", () => {
    postDraftStore.setScope("awa")
    postDraftStore.setBody(FEED, "Publiée")
    const avant = parseDrafts(values.get(cle("awa"))).drafts[FEED]
      ?.idempotencyKey
    postDraftStore.clear(FEED)
    const apres = parseDrafts(values.get(cle("awa"))).drafts[FEED]
    expect(apres?.body).toBe("")
    expect(apres?.idempotencyKey).not.toBe(avant)
  })

  it("garde la clé quand le téléversement échoue", () => {
    postDraftStore.setScope("awa")
    postDraftStore.setBody(FEED, "Essai")
    postDraftStore.addMedia(FEED, [
      { meta: meta("m1"), file: fichier("a.png"), previewUrl: "blob:m1" },
    ])
    const avant = parseDrafts(values.get(cle("awa"))).drafts[FEED]
      ?.idempotencyKey
    postDraftStore.markUploadFailed(FEED, "m1")
    const apres = parseDrafts(values.get(cle("awa"))).drafts[FEED]
    expect(apres?.idempotencyKey).toBe(avant)
    expect(apres?.body).toBe("Essai")
  })

  it("efface tout à l'abandon explicite", () => {
    postDraftStore.setScope("awa")
    postDraftStore.setBody(FEED, "À jeter")
    postDraftStore.discard(FEED)
    expect(parseDrafts(values.get(cle("awa"))).drafts[FEED]).toBeUndefined()
  })
})

describe("un état PAR RÉSEAU (configurePostDraftStorage)", () => {
  it("n'écrit RIEN tant que le réseau est inconnu, même l'auteur connu", () => {
    postDraftStore.resetForTests()
    postDraftStore.setScope("awa")
    postDraftStore.setBody(FEED, "Avant la coque")
    expect(values.size).toBe(0)
    expect(postDraftStore.storagePrefix()).toBeNull()
  })

  it("adopte, à la configuration, un geste fait avant elle", () => {
    postDraftStore.resetForTests()
    postDraftStore.setScope("awa")
    postDraftStore.setBody(FEED, "Tapé avant la configuration")
    configurePostDraftStorage(PREFIXE)
    expect(parseDrafts(values.get(cle("awa"))).drafts[FEED]?.body).toBe("Tapé avant la configuration")
  })

  it("deux réseaux = deux brouillons, jamais mêlés", () => {
    postDraftStore.setScope("awa")
    postDraftStore.setBody(FEED, "Pour le réseau A")
    configurePostDraftStorage("antia:autre:")
    // L'état repart de celui de l'autre réseau, vide : le texte n'a pas suivi.
    expect(postDraftStore.storagePrefix()).toBe("antia:autre:")
    postDraftStore.setBody(FEED, "Pour le réseau B")
    expect(parseDrafts(values.get(cle("awa"))).drafts[FEED]?.body).toBe("Pour le réseau A")
    expect(parseDrafts(values.get(postDraftStorageKey("antia:autre:", "awa"))).drafts[FEED]?.body).toBe("Pour le réseau B")
    // Le retour relit le brouillon du premier réseau.
    configurePostDraftStorage(PREFIXE)
    postDraftStore.setComposerOpen(true)
    expect(parseDrafts(values.get(cle("awa"))).drafts[FEED]?.body).toBe("Pour le réseau A")
  })

  it("est idempotente : la rappeler ne relit ni n'écrase rien", () => {
    postDraftStore.setScope("awa")
    postDraftStore.setBody(FEED, "En cours")
    values.set(cle("awa"), "{pas du json")
    configurePostDraftStorage(PREFIXE)
    // Aucune relecture : le stockage abîmé n'a pas été lu à la place de l'état.
    postDraftStore.setBody(FEED, "En cours, suite")
    expect(parseDrafts(values.get(cle("awa"))).drafts[FEED]?.body).toBe("En cours, suite")
  })

  it("`null` suspend la persistance sans perdre l'état en mémoire", () => {
    postDraftStore.setScope("awa")
    postDraftStore.setBody(FEED, "Avant")
    configurePostDraftStorage(null)
    postDraftStore.setBody(FEED, "Pendant la suspension")
    expect(parseDrafts(values.get(cle("awa"))).drafts[FEED]?.body).toBe("Avant")
    configurePostDraftStorage(PREFIXE)
    expect(parseDrafts(values.get(cle("awa"))).drafts[FEED]?.body).toBe("Pendant la suspension")
  })
})
