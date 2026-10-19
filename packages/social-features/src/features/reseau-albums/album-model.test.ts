// Dupliqué de socle/packages/agent-features/src/features/reseau-albums/album-model.test.ts @ ad2e7fdc2 — adaptations : phrases lues par l'i18n du moteur (`t` français ; mêmes textes ou fragments attendus, « réseau des agents » devenu « réseau ») ; tables de libellés devenues fonctions (`albumStepLabel`, `albumAudienceLabel`, `albumAudienceHint`, `albumWithdrawNotice`) ; adresses composées sur la base du profil SERVIE par l'application (échappement du handle à sa charge, celui de l'identifiant d'album ici) au lieu des chemins de l'espace agent ; lecture des paramètres d'onglet sans URL absolue ; plafond lu au domaine du moteur ; cas ajoutés : refus en anglais, refus du moteur par sa règle ou son code (`albumEngineErrorText`), lots d'ajout (`albumAddBatches`), libellés d'état.
/**
 * Le modèle du parcours d'album — module PUR, testé en `node`.
 *
 * Trois choses s'y prouvent, et elles ne se prouvent nulle part ailleurs :
 * la progression PAR FICHIER (donc la reprise après un envoi partiel), le
 * déplacement au clavier, et la décision de ré-encodage qui débarrasse une
 * photo de ses métadonnées avant qu'elle ne parte.
 */
import { ALBUM_ADD_BATCH_MAX, ALBUM_ITEMS_MAX, ALBUM_TITLE_MAX } from "@antsia/social-domain/albums"
import { ConvexError } from "convex/values"
import { describe, expect, it } from "vitest"

import { createAppI18n } from "../../i18n"
import {
  ALBUM_NEW_PARAM,
  ALBUM_STEPS,
  ALBUM_TAB_ID,
  ALBUM_TAB_PARAM,
  albumAddBatches,
  albumAudienceHint,
  albumAudienceLabel,
  albumBackHref,
  albumsTabHref,
  albumCountLabel,
  albumEngineErrorText,
  albumHref,
  albumReencodePlan,
  albumStatusLabel,
  albumStepBlocker,
  albumStepLabel,
  albumUploadProgress,
  albumWithdrawNotice,
  albumsEmptyText,
  moveAlbumItem,
  moveAnnouncement,
  nextAlbumStep,
  orderChanged,
  previousAlbumStep,
  reencodeFailureMessage,
  remainingSlots,
  type AlbumStep,
  type AlbumUploadState,
} from "./album-model"

const i18n = createAppI18n({ locale: "fr", appResources: { fr: {}, en: {} }, defaultNS: "albums" })
const t = i18n.getFixedT("fr")
const tEn = i18n.getFixedT("en")

/** La base du profil telle que l'application la sert (elle échappe le handle). */
const profil = (handle: string) => `/profil/${encodeURIComponent(handle)}`

const media = (status: AlbumUploadState) => ({ upload: { status } })

describe("les étapes du composeur", () => {
  it("va du titre à l'aperçu, dans cet ordre", () => {
    expect([...ALBUM_STEPS]).toEqual(["identite", "photos", "ordre", "apercu"])
  })

  it("l'APERÇU est la dernière étape — on voit avant de rendre visible", () => {
    expect(ALBUM_STEPS[ALBUM_STEPS.length - 1]).toBe("apercu")
    expect(nextAlbumStep("apercu")).toBe("apercu")
    expect(previousAlbumStep("identite")).toBe("identite")
  })

  it("avance et recule d'un cran, sans jamais sortir de la liste", () => {
    expect(nextAlbumStep("identite")).toBe("photos")
    expect(nextAlbumStep("photos")).toBe("ordre")
    expect(previousAlbumStep("ordre")).toBe("photos")
  })

  it("chaque étape porte un libellé", () => {
    for (const step of ALBUM_STEPS) {
      expect(albumStepLabel(step, t).length).toBeGreaterThan(0)
      // Jamais la clé brute : la locale existe pour chaque étape.
      expect(albumStepLabel(step, t)).not.toContain("albumModel")
      expect(albumStepLabel(step, tEn)).not.toContain("albumModel")
    }
    expect(albumStepLabel("ordre", t)).toBe("Ordre et couverture")
  })
})

describe("albumStepBlocker — un refus se LIT, il ne se devine pas", () => {
  it("sans titre, on n'entre pas dans les photos", () => {
    expect(
      albumStepBlocker({ step: "identite", title: "   ", photoCount: 0 }, t),
    ).toMatch(/titre/)
    expect(
      albumStepBlocker({ step: "identite", title: "Mission", photoCount: 0 }, t),
    ).toBeNull()
  })

  it("un titre trop long est nommé, pas seulement tronqué", () => {
    expect(ALBUM_TITLE_MAX).toBe(120)
    expect(
      albumStepBlocker(
        {
          step: "identite",
          title: "x".repeat(121),
          photoCount: 0,
        },
        t,
      ),
    ).toMatch(/120/)
  })

  it("sans photo, ni ordre ni aperçu ni publication", () => {
    for (const step of ["photos", "ordre", "apercu"] as AlbumStep[]) {
      expect(
        albumStepBlocker({ step, title: "Mission", photoCount: 0 }, t),
      ).toMatch(/au moins une photo/)
      expect(
        albumStepBlocker({ step, title: "Mission", photoCount: 1 }, t),
      ).toBeNull()
    }
  })

  it("le refus se dit dans la langue courante", () => {
    expect(albumStepBlocker({ step: "photos", title: "Mission", photoCount: 0 }, tEn)).toBe(
      "Add at least one photo.",
    )
  })
})

describe("albumUploadProgress — la progression PAR FICHIER", () => {
  it("compte chaque fichier, pas le lot", () => {
    const p = albumUploadProgress(
      [
        media("uploaded"),
        media("uploaded"),
        media("pending"),
        media("pending"),
      ],
      t,
    )
    expect(p).toMatchObject({ total: 4, uploaded: 2, pending: 2, failed: 0 })
    expect(p.percent).toBe(50)
    expect(p.label).toBe("Envoi en cours : 2 sur 4.")
  })

  it("un ÉCHEC ne remet pas le compteur à zéro, et le dit", () => {
    const p = albumUploadProgress(
      [
        media("uploaded"),
        media("uploaded"),
        media("failed"),
      ],
      t,
    )
    expect(p).toMatchObject({ uploaded: 2, failed: 1, pending: 0 })
    expect(p.hasWork).toBe(true)
    // La phrase promet exactement ce que `upload()` fait : il saute ce qui est
    // déjà `uploaded`.
    expect(p.label).toMatch(/déjà envoyées ne repartiront pas/)
  })

  it("tout envoyé : plus de travail, et l'accord suit le nombre", () => {
    expect(albumUploadProgress([media("uploaded")], t).label).toBe(
      "1 photo envoyée.",
    )
    expect(
      albumUploadProgress([media("uploaded"), media("uploaded")], t).label,
    ).toBe("2 photos envoyées.")
    expect(albumUploadProgress([media("uploaded")], t).hasWork).toBe(false)
  })

  it("un lot vide ne divise pas par zéro", () => {
    const p = albumUploadProgress([], t)
    expect(p.percent).toBe(0)
    expect(p.hasWork).toBe(false)
    expect(p.label).toMatch(/Aucune photo/)
  })
})

describe("moveAlbumItem — le clavier déplace autant que le doigt", () => {
  const ordre = ["a", "b", "c"]

  it("monte et descend d'un cran", () => {
    expect(moveAlbumItem(ordre, "b", "up")).toEqual(["b", "a", "c"])
    expect(moveAlbumItem(ordre, "b", "down")).toEqual(["a", "c", "b"])
  })

  it("aux extrémités, rend la MÊME liste — jamais `null` à traiter", () => {
    expect(moveAlbumItem(ordre, "a", "up")).toEqual(ordre)
    expect(moveAlbumItem(ordre, "c", "down")).toEqual(ordre)
  })

  it("un identifiant inconnu ne casse rien", () => {
    expect(moveAlbumItem(ordre, "z", "up")).toEqual(ordre)
  })

  it("rend une liste NEUVE — l'appelant ne peut pas muter l'état en place", () => {
    const rendu = moveAlbumItem(ordre, "b", "up")
    rendu.pop()
    expect(ordre).toEqual(["a", "b", "c"])
  })

  it("orderChanged ne déclenche le serveur que si l'ordre a bougé", () => {
    expect(orderChanged(ordre, ["a", "b", "c"])).toBe(false)
    expect(orderChanged(ordre, ["b", "a", "c"])).toBe(true)
    expect(orderChanged(ordre, ["a", "b"])).toBe(true)
  })

  it("le déplacement s'ANNONCE — sinon le clavier bouge une carte en silence", () => {
    expect(
      moveAnnouncement({ position: 2, total: 5, caption: " Remise des clés " }, t),
    ).toBe("« Remise des clés » est en position 2 sur 5.")
    expect(moveAnnouncement({ position: 1, total: 3 }, t)).toBe(
      "La photo est en position 1 sur 3.",
    )
  })
})

describe("albumAddBatches — le moteur refuse un ajout de plus de douze photos", () => {
  it("découpe la sélection en lots bornés, dans l'ordre", () => {
    const photos = Array.from({ length: ALBUM_ITEMS_MAX }, (_, index) => index)
    const lots = albumAddBatches(photos)
    expect(ALBUM_ADD_BATCH_MAX).toBe(12)
    expect(lots).toHaveLength(5)
    expect(lots.every((lot) => lot.length <= ALBUM_ADD_BATCH_MAX)).toBe(true)
    expect(lots.flat()).toEqual(photos)
  })

  it("un lot qui tient d'un bloc part d'un bloc — et une sélection vide n'en fait aucun", () => {
    expect(albumAddBatches(["a", "b"])).toEqual([["a", "b"]])
    expect(albumAddBatches(Array.from({ length: 13 }, (_, index) => index)).map((lot) => lot.length)).toEqual([12, 1])
    expect(albumAddBatches([])).toEqual([])
  })

  it("le même brouillon donne toujours les mêmes lots — la reprise renvoie exactement", () => {
    const photos = Array.from({ length: 30 }, (_, index) => `photo-${index}`)
    expect(albumAddBatches(photos)).toEqual(albumAddBatches([...photos]))
  })
})

describe("albumReencodePlan — les métadonnées ne partent pas avec la photo", () => {
  it("ré-encode TOUTE image acceptée : il n'y a pas de cas « on laisse passer »", () => {
    for (const type of ["image/jpeg", "image/webp", "image/png"]) {
      expect(albumReencodePlan(type, t).action).toBe("reencode")
    }
  })

  it("PNG reste PNG (transparence), le reste sort en JPEG", () => {
    expect(albumReencodePlan("image/png", t)).toEqual({
      action: "reencode",
      targetType: "image/png",
    })
    expect(albumReencodePlan("image/webp", t)).toEqual({
      action: "reencode",
      targetType: "image/jpeg",
    })
  })

  it("REFUSE le GIF, en disant pourquoi — jamais une animation perdue en silence", () => {
    const plan = albumReencodePlan("image/gif", t)
    expect(plan.action).toBe("refuse")
    if (plan.action === "refuse") {
      expect(plan.reason).toMatch(/première image/)
    }
  })

  it("l'échec de préparation dit que la photo N'A PAS été envoyée (fail-closed)", () => {
    expect(reencodeFailureMessage("photo.jpg", t)).toMatch(/n'a pas été envoyée/)
    expect(reencodeFailureMessage("photo.jpg", t)).toContain("« photo.jpg »")
  })

  it("le refus se dit dans la langue courante", () => {
    const plan = albumReencodePlan("image/gif", tEn)
    expect(plan.action === "refuse" ? plan.reason : "").toMatch(/first frame/)
    expect(reencodeFailureMessage("photo.jpg", tEn)).toMatch(/was not sent/)
  })
})

describe("albumEngineErrorText — un refus du moteur se traduit, il ne s'invente pas", () => {
  it("la règle du domaine enfreinte, avec ses bornes", () => {
    const error = new ConvexError({ code: "invalidArgument", rule: "ALBUM_FULL", params: { max: 60 } })
    expect(albumEngineErrorText(error, "albums:albumComposer.uploadFailed", t)).toBe(
      "Un album porte au plus 60 photos.",
    )
  })

  it("à défaut de règle, le code du moteur", () => {
    const error = new ConvexError({ code: "notFound" })
    expect(albumEngineErrorText(error, "albums:albumComposer.uploadFailed", t)).toBe(
      "Cette ressource est introuvable ou n'est pas accessible.",
    )
  })

  it("sans code lisible, la phrase de l'écran — jamais le texte brut du serveur", () => {
    const text = albumEngineErrorText(new Error("Server Error"), "albums:albumComposer.uploadFailed", t)
    expect(text).toBe("L'envoi a échoué. Les photos déjà envoyées sont conservées.")
    expect(text).not.toContain("Server Error")
  })
})

describe("libellés et adresses", () => {
  it("« Tout le réseau » n'est pas « Internet », et l'indice le dit", () => {
    expect(albumAudienceLabel("public", t)).toBe("Tout le réseau")
    expect(albumAudienceHint("public", t)).toMatch(/ne sort pas de la plateforme/)
    expect(albumAudienceHint("connections", t)).toMatch(/connecté/)
    // Le réseau du moteur n'est pas « le réseau des agents ».
    expect(albumAudienceHint("public", t)).not.toMatch(/agents/)
  })

  it("chaque état porte son libellé", () => {
    expect(albumStatusLabel("draft", t)).toBe("Brouillon")
    expect(albumStatusLabel("published", t)).toBe("Publié")
    expect(albumStatusLabel("withdrawn", t)).toBe("Retiré")
  })

  it("la phrase de retrait ne promet AUCUNE révocation", () => {
    expect(albumWithdrawNotice(t)).toMatch(/copie déjà téléchargée/)
    expect(albumWithdrawNotice(t)).not.toMatch(/supprim/i)
    expect(albumWithdrawNotice(tEn)).not.toMatch(/delet/i)
  })

  it("l'adresse d'un album se compose sous le profil servi, l'identifiant échappé", () => {
    expect(albumHref(profil("m.ndong"), "abc123")).toBe(
      "/profil/m.ndong/albums/abc123",
    )
    expect(albumHref(profil("a b"), "x/y")).toBe("/profil/a%20b/albums/x%2Fy")
    expect(albumBackHref(profil("m.ndong"))).toBe("/profil/m.ndong")
  })

  it("l'absence d'album ne se dit pas pareil pour soi et pour autrui", () => {
    expect(albumsEmptyText(true, t)).not.toBe(albumsEmptyText(false, t))
    expect(albumsEmptyText(false, t)).toMatch(/ouvert/)
  })

  it("le décompte s'accorde", () => {
    expect(albumCountLabel(0, t)).toBe("Aucune photo")
    expect(albumCountLabel(1, t)).toBe("1 photo")
    expect(albumCountLabel(12, t)).toBe("12 photos")
    expect(albumCountLabel(0, tEn)).toBe("No photos")
    expect(albumCountLabel(1, tEn)).toBe("1 photo")
  })

  it("la place restante ne descend jamais sous zéro", () => {
    expect(remainingSlots(0)).toBe(60)
    expect(remainingSlots(60)).toBe(0)
    expect(remainingSlots(80)).toBe(0)
  })
})

describe("albumsTabHref — la porte de l'onglet Albums", () => {
  it("mène à l'ONGLET du profil, pas à une page à part", () => {
    expect(albumsTabHref(profil("m.ndong"))).toBe("/profil/m.ndong?onglet=albums")
  })

  it("porte l'INTENTION de création quand on la demande", () => {
    expect(albumsTabHref(profil("m.ndong"), { create: true })).toBe(
      "/profil/m.ndong?onglet=albums&nouveau=1",
    )
    // `create: false` n'est PAS `create: true` : l'intention est explicite.
    expect(albumsTabHref(profil("m.ndong"), { create: false })).toBe(
      albumsTabHref(profil("m.ndong")),
    )
  })

  it("garde le handle tel que le profil servi l'a échappé, comme les deux autres adresses", () => {
    expect(albumsTabHref(profil("a b"))).toBe("/profil/a%20b?onglet=albums")
  })

  it("les trois littéraux sont le contrat lu par le profil", () => {
    // Le composeur s'ouvre parce que `ProfilPersonnePage` relit EXACTEMENT ces
    // noms : les changer ici sans les changer là-bas ouvrirait une porte sur
    // une serrure muette.
    expect(ALBUM_TAB_PARAM).toBe("onglet")
    expect(ALBUM_TAB_ID).toBe("albums")
    expect(ALBUM_NEW_PARAM).toBe("nouveau")
    const href = albumsTabHref(profil("m.ndong"), { create: true })
    const params = new URLSearchParams(href.slice(href.indexOf("?") + 1))
    expect(params.get(ALBUM_TAB_PARAM)).toBe(ALBUM_TAB_ID)
    expect(params.get(ALBUM_NEW_PARAM)).toBe("1")
  })
})
