// Dupliqué de socle/packages/agent-features/src/features/reseau-personnel/shared.test.ts @ ad2e7fdc2 — adaptations : libellés lus dans l'i18n du moteur (français, et l'anglais pour la date absolue dans la langue courante) ; les constantes portent des clés traduites par `t` ; genres de la cloche aux noms du moteur (`live_*`, `event_invite`) ; tous les cas du socle portés ; cas ajoutés pour les bornes lues dans le domaine, l'audience `followers` des pages et l'accord au singulier du dépassement.
/**
 * Ce que l'écran DÉCIDE — vérifié ici, hors de tout composant.
 */
import {
  AVATAR_MAX_BYTES as DOMAIN_AVATAR_MAX_BYTES,
  PERSONAL_POST_MAX_LENGTH,
} from "@antsia/social-domain/content"
import { describe, expect, it } from "vitest"

import { createAppI18n } from "../../i18n"
import {
  AUDIENCE_OPTIONS,
  AVATAR_ACCEPT,
  AVATAR_MAX_BYTES,
  DEFAULT_AUDIENCE,
  DEFAULT_PAGE_AUDIENCE,
  ENGAGEMENT_DISPLAY_CAP,
  NOTIFICATION_SENTENCE_KINDS,
  PAGE_AUDIENCE_OPTIONS,
  REACTION_OPTIONS,
  audienceLabel,
  emptyFeedText,
  evaluateComposer,
  feedReasonLabel,
  formatCount,
  formatRelativeDate,
  formatUnreadBadge,
  notificationSentence,
  avatarRejectionFor,
  searchStatusText,
  shareExcerpt,
  SHARE_EXCERPT_MAX,
  POST_MAX_LENGTH,
  reactionLabel,
  resolutionSentence,
  unreadBadgeLabel,
  validateHandle,
  type NotificationSentenceKind,
} from "./shared"

const i18n = createAppI18n({ locale: "fr", appResources: { fr: {}, en: {} }, defaultNS: "reseau" })
const t = i18n.getFixedT("fr")
const tEn = i18n.getFixedT("en")

describe("audience", () => {
  it("le défaut est le choix RESTREINT", () => {
    // Se tromper vers le restreint est sans conséquence ; se tromper vers le
    // public ne se rattrape pas.
    expect(DEFAULT_AUDIENCE).toBe("connections")
    expect(AUDIENCE_OPTIONS[0]!.value).toBe("connections")
  })

  it("chaque option dit ce qu'elle OUVRE", () => {
    for (const option of AUDIENCE_OPTIONS) {
      expect(t(option.hintKey).length).toBeGreaterThan(10)
      expect(t(option.labelKey)).toBe(audienceLabel(option.value, t))
    }
  })

  it("nomme les deux audiences", () => {
    expect(audienceLabel("public", t)).toBe("Tout le réseau")
    expect(audienceLabel("connections", t)).toBe("Mes connexions")
  })

  it("nomme la restriction d'une note de page sans nommer la page", () => {
    expect(audienceLabel("followers", t)).toBe("Réservé aux abonnés")
    expect(audienceLabel("group", t)).toBe("Groupe")
  })
})

describe("audience d'une page", () => {
  it("publie au réseau par défaut, et ne propose que le communiqué ou la note aux abonnés", () => {
    expect(DEFAULT_PAGE_AUDIENCE).toBe("public")
    expect(PAGE_AUDIENCE_OPTIONS.map((option) => option.value)).toEqual(["public", "followers"])
    for (const option of PAGE_AUDIENCE_OPTIONS) {
      expect(t(option.labelKey).length).toBeGreaterThan(0)
      expect(t(option.hintKey).length).toBeGreaterThan(10)
    }
  })
})

describe("composeur", () => {
  it("un texte vide ne part pas, et sans reproche", () => {
    const state = evaluateComposer("   ", false, t)
    expect(state.canSubmit).toBe(false)
    // Pas de message d'erreur tant qu'on n'a rien écrit : on n'a rien fait de
    // mal.
    expect(state.blockedReason).toBeNull()
  })

  it("un dépassement dit de combien", () => {
    const state = evaluateComposer("a".repeat(POST_MAX_LENGTH + 5), false, t)
    expect(state.canSubmit).toBe(false)
    expect(state.remaining).toBe(-5)
    expect(state.blockedReason).toContain("5")
    expect(state.blockedReason).toBe("Votre publication dépasse de 5 caractères.")
  })

  it("accorde un dépassement d'un seul caractère", () => {
    expect(evaluateComposer("a".repeat(POST_MAX_LENGTH + 1), false, t).blockedReason).toBe(
      "Votre publication dépasse de 1 caractère.",
    )
  })

  it("pendant l'envoi, rien ne repart", () => {
    expect(evaluateComposer("Bonjour", true, t).canSubmit).toBe(false)
  })

  it("un texte valide part", () => {
    const state = evaluateComposer("  Bonjour  ", false, t)
    expect(state.canSubmit).toBe(true)
    expect(state.remaining).toBe(POST_MAX_LENGTH - "Bonjour".length)
  })

  it("borne comme le domaine, sans recopier sa valeur", () => {
    expect(POST_MAX_LENGTH).toBe(PERSONAL_POST_MAX_LENGTH)
    expect(AVATAR_MAX_BYTES).toBe(DOMAIN_AVATAR_MAX_BYTES)
  })
})

describe("dates relatives", () => {
  const now = Date.UTC(2026, 7, 4, 12, 0, 0)

  it("passe du relatif à l'absolu au-delà d'une semaine", () => {
    expect(formatRelativeDate(now - 30_000, now, t)).toBe("à l'instant")
    expect(formatRelativeDate(now - 5 * 60_000, now, t)).toBe("il y a 5 min")
    expect(formatRelativeDate(now - 3 * 3_600_000, now, t)).toBe("il y a 3 h")
    expect(formatRelativeDate(now - 3 * 86_400_000, now, t)).toBe("il y a 3 j")
    // « il y a 47 j » n'informe plus, il faut compter.
    expect(formatRelativeDate(now - 47 * 86_400_000, now, t)).toMatch(/20\d\d/)
  })

  it("ne rend jamais de durée négative", () => {
    expect(formatRelativeDate(now + 10_000, now, t)).toBe("à l'instant")
  })

  it("écrit la date absolue dans la langue du lecteur, jamais en français imposé", () => {
    const at = now - 47 * 86_400_000
    const expected = (locale: string) =>
      new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" }).format(new Date(at))
    expect(formatRelativeDate(at, now, t)).toBe(expected("fr"))
    expect(formatRelativeDate(at, now, tEn)).toBe(expected("en"))
    expect(formatRelativeDate(now - 5 * 60_000, now, tEn)).toBe("5 min ago")
  })
})

describe("décomptes", () => {
  it("un total qui atteint le plafond du serveur s'annonce comme un plancher", () => {
    expect(formatCount(12)).toBe("12")
    expect(formatCount(ENGAGEMENT_DISPLAY_CAP)).toBe("200+")
  })

  it("la cloche plafonne à 99+", () => {
    expect(formatUnreadBadge(undefined)).toBeNull()
    expect(formatUnreadBadge(0)).toBeNull()
    expect(formatUnreadBadge(3)).toBe("3")
    expect(formatUnreadBadge(150)).toBe("99+")
    expect(unreadBadgeLabel(1, t)).toBe("1 notification non lue")
    expect(unreadBadgeLabel(4, t)).toBe("4 notifications non lues")
    expect(unreadBadgeLabel(0, t)).toBeNull()
  })
})

describe("phrases de la cloche", () => {
  it("nomment l'acteur sans jamais recopier le contenu", () => {
    expect(notificationSentence("post_reaction", "Awa", t)).toBe("Awa a réagi à votre publication.")
    expect(notificationSentence("connection_request", "Awa", t)).toContain("se connecter")
    expect(notificationSentence("new_follower", "Awa", t)).toContain("vous suit")
  })
})

describe("fil vide", () => {
  it("dit le lien qui MANQUE plutôt qu'un vide sans cause", () => {
    const orphan = emptyFeedText({ hasConnections: false, hasFollows: false }, t)
    expect(orphan).toContain("ni connexion")
    const linked = emptyFeedText({ hasConnections: true, hasFollows: false }, t)
    expect(linked).not.toContain("ni connexion")
  })
})

describe("réactions et raisons", () => {
  it("chaque réaction a un mot, pas seulement un symbole", () => {
    for (const option of REACTION_OPTIONS) {
      expect(t(option.labelKey).trim().length).toBeGreaterThan(0)
    }
    expect(reactionLabel("bravo", t)).toBe("Bravo")
  })

  it("l'écran dit pourquoi une ligne est là", () => {
    expect(feedReasonLabel("own", t)).toBe("Votre publication")
    expect(feedReasonLabel("connection", t)).toContain("connexions")
    expect(feedReasonLabel("follow", t)).toContain("suivie")
    expect(feedReasonLabel("page", t)).toBe("Page suivie")
  })
})

describe("handle", () => {
  it("accepte une adresse, refuse ce qui n'en est pas une", () => {
    expect(validateHandle("a.ndong", t)).toBeNull()
    expect(validateHandle("A_Ndong-1", t)).toBeNull()
    expect(validateHandle("", t)).toContain("Choisissez")
    expect(validateHandle("ab", t)).toContain("caractères")
    expect(validateHandle("a ndong", t)).toContain("Lettres")
    expect(validateHandle(".ndong", t)).toContain("Lettres")
  })
})

describe("phrases de la cloche — les nouveaux genres", () => {
  it("distingue « vous a cité » de « a commenté »", () => {
    // Si les deux disaient la même chose, le genre `mention` ne servirait à
    // rien : c'est toute sa raison d'exister.
    expect(notificationSentence("mention", "Awa", t)).not.toBe(notificationSentence("post_comment", "Awa", t))
    expect(notificationSentence("mention", "Awa", t)).toContain("cité")
    expect(notificationSentence("post_share", "Awa", t)).toContain("partagé")
  })

  it("parle des GROUPES sans jamais recopier un message", () => {
    expect(notificationSentence("group_added", "Awa", t)).toContain("ajouté à une conversation de groupe")
    const message = notificationSentence("group_message", "Awa", t)
    expect(message).toContain("conversation de groupe")
    // Deux genres, deux phrases : être ajouté n'est pas recevoir un mot.
    expect(message).not.toBe(notificationSentence("group_added", "Awa", t))
  })

  it("invite à une conférence sans recopier son titre", () => {
    const sentence = notificationSentence("live_invite", "Awa", t)
    expect(sentence).toBe("Awa vous invite à une conférence en direct.")
    // Deux genres, deux phrases : être invité à regarder n'est pas être
    // invité à prendre la parole, ni être prévenu d'un démarrage.
    expect(sentence).not.toBe(notificationSentence("live_antenna_invite", "Awa", t))
    expect(sentence).not.toBe(notificationSentence("live_started", "Awa", t))
  })

  it("invite à prendre la parole sans recopier la conférence", () => {
    const sentence = notificationSentence("live_antenna_invite", "Awa", t)
    expect(sentence).toContain("prendre la parole")
    expect(sentence).toContain("conférence")
    expect(sentence).not.toContain("Antenne citoyenne")
  })

  it("annonce l'enregistrement publié sans recopier la conférence", () => {
    const sentence = notificationSentence("live_replay_published", "Awa", t)
    expect(sentence).toBe("Awa a publié l'enregistrement d'une conférence.")
    // Deux genres, deux phrases : un replay publié n'est pas un direct lancé.
    expect(sentence).not.toBe(notificationSentence("live_started", "Awa", t))
  })
})

describe("résultat d'une invitation — resolutionSentence", () => {
  const RESOLUTIONS = ["accepted", "declined", "maybe", "cancelled", "expired"] as const
  type Resolution = (typeof RESOLUTIONS)[number]

  // TOUS les genres phrasés par la cloche : un genre absent de la table
  // attendue doit se taire, quelle que soit la résolution.
  const KINDS: NotificationSentenceKind[] = [
    "post_reaction",
    "post_comment",
    "post_share",
    "mention",
    "connection_request",
    "connection_accepted",
    "new_follower",
    "group_message",
    "group_added",
    "live_started",
    "live_invite",
    "live_antenna_invite",
    "thematic_group_invite",
    "event_invite",
    "live_replay_published",
  ]

  const JOIN_INVITE: Partial<Record<Resolution, string>> = {
    accepted: "Invitation acceptée.",
    declined: "Invitation déclinée.",
    maybe: "Vous avez répondu « peut-être ».",
    cancelled: "Invitation annulée.",
  }
  const CONFERENCE_INVITE: Partial<Record<Resolution, string>> = {
    accepted: "Invitation acceptée.",
    declined: "Invitation déclinée.",
    cancelled: "Invitation retirée.",
    expired: "Cette conférence est terminée.",
  }
  const EXPECTED: Partial<Record<NotificationSentenceKind, Partial<Record<Resolution, string>>>> = {
    connection_request: {
      accepted: "Vous avez accepté cette invitation.",
      declined: "Invitation déclinée.",
      cancelled: "Invitation annulée.",
    },
    group_added: JOIN_INVITE,
    thematic_group_invite: JOIN_INVITE,
    event_invite: JOIN_INVITE,
    live_invite: CONFERENCE_INVITE,
    live_antenna_invite: CONFERENCE_INVITE,
  }

  it("dit le résultat de chaque invitation, et de rien d'autre (matrice complète)", () => {
    // La matrice couvre TOUS les genres phrasés par la cloche.
    expect([...KINDS].sort()).toEqual([...NOTIFICATION_SENTENCE_KINDS].sort())
    for (const kind of KINDS) {
      for (const resolution of RESOLUTIONS) {
        expect(resolutionSentence(kind, resolution, t), `${kind} × ${resolution}`).toBe(EXPECTED[kind]?.[resolution] ?? null)
      }
    }
  })

  it("se tait sur une valeur ou un genre inconnus, sans rien trouver d'hérité", () => {
    expect(resolutionSentence("connection_request", "", t)).toBeNull()
    expect(resolutionSentence("connection_request", "requested", t)).toBeNull()
    expect(resolutionSentence("connection_request", "toString", t)).toBeNull()
    expect(resolutionSentence("live_invite", "constructor", t)).toBeNull()
    expect(resolutionSentence("toString", "accepted", t)).toBeNull()
    expect(resolutionSentence("genre_a_venir", "accepted", t)).toBeNull()
  })
})

describe("extrait de partage", () => {
  it("dit qu'il n'y a pas de texte plutôt que de rendre du vide", () => {
    // Un cadre blanc laisserait croire à un défaut de chargement.
    expect(shareExcerpt("   ", t)).toBe("Publication sans texte.")
  })

  it("tronque proprement au-delà de la borne", () => {
    const long = "a".repeat(SHARE_EXCERPT_MAX + 50)
    const excerpt = shareExcerpt(long, t)
    expect(excerpt.endsWith("…")).toBe(true)
    expect(excerpt.length).toBeLessThanOrEqual(SHARE_EXCERPT_MAX + 1)
    expect(shareExcerpt("court", t)).toBe("court")
  })
})

describe("barre d'état de la recherche", () => {
  it("n'annonce JAMAIS « 0 résultat » pendant le chargement", () => {
    // « 0 résultat » se retient, même corrigé une seconde plus tard.
    expect(searchStatusText("budget", 0, true, t)).toContain("Recherche")
    expect(searchStatusText("budget", 0, true, t)).not.toContain("Aucun")
  })

  it("accorde le décompte", () => {
    expect(searchStatusText("budget", 0, false, t)).toContain("Aucun résultat")
    expect(searchStatusText("budget", 1, false, t)).toContain("1 résultat pour")
    expect(searchStatusText("budget", 4, false, t)).toContain("4 résultats")
  })
})

describe("photo de profil — refus côté client", () => {
  const file = (type: string, size: number) => ({ type, size, name: "photo" }) as File

  it("accepte JPEG, PNG et WebP sous 5 Mo", () => {
    expect(AVATAR_ACCEPT).toBe("image/jpeg,image/png,image/webp")
    expect(avatarRejectionFor(file("image/png", 1000), t)).toBeNull()
    expect(avatarRejectionFor(file("image/gif", 1000), t)).toContain("Formats")
    expect(avatarRejectionFor(file("image/png", 6 * 1024 * 1024), t)).toContain("5 Mo")
  })
})
