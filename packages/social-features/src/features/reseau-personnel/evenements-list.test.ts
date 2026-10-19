// Dupliqué de socle/packages/agent-features/src/features/reseau-personnel/evenements-list.test.ts @ ad2e7fdc2 — adaptations : fixture au DTO du moteur (`events.events.myAgenda` : identifiants typés, organisateur `counterpartLabel`, `announcePostId`) ; le fuseau et la langue sont des PARAMÈTRES — les cas du socle tournent sur le fuseau de Libreville passé EXPLICITEMENT (donnée de test, plus un défaut du module) et en français, et des cas ajoutés prouvent que le fuseau du lecteur décide (même instant, autre jour à Tokyo) et que la langue suit l'écran ; libellés lus dans l'i18n du moteur ; tous les cas du socle portés ; cas du formulaire de composition repris de `iagenda/personal-event-form.test.ts` (la composition vit désormais dans le volet), récapitulatif des invitations, réponses des invités, nom neutre et refus du moteur ajoutés.
/**
 * evenements-list — ce que le volet Évènements décide, vérifié :
 *
 *  1. les quatre sections sont EXCLUSIVES : un évènement n'apparaît jamais
 *     deux fois, et la somme des sections vaut toujours l'entrée ;
 *  2. la frontière du jour civil (minuit dans le fuseau du LECTEUR) classe
 *     correctement, y compris pile à la limite ;
 *  3. un évènement annulé ne propose plus de réponse ;
 *  4. la plage de dates s'affiche dans le fuseau et la langue donnés, dans
 *     les trois formes attendues (même jour, jours différents, sans fin) ;
 *  5. le récapitulatif d'une ANNONCE (R-16) sépare les invités des lecteurs.
 */
import type { Id } from "@antsia/api/engine"
import { PERSONAL_EVENT_TITLE_MAX_LENGTH, PERSONAL_EVENT_TITLE_MIN_LENGTH } from "@antsia/social-domain/events"
import { ConvexError } from "convex/values"
import { describe, expect, it } from "vitest"

import { createAppI18n } from "../../i18n"
import {
  END_BEFORE_START_KEY,
  EVENT_SECTIONS,
  EVENT_SECTION_TITLE_KEYS,
  EVENT_TITLE_MAX_LENGTH,
  EVENT_TITLE_MIN_LENGTH,
  type EvenementListItem,
  type PersonalEventParticipationStatus,
  announceAudienceLabel,
  announceSummary,
  canRespond,
  classifyEventInviteResult,
  emptyAgendaText,
  eventActionErrorText,
  eventInviteReportLabel,
  eventPersonName,
  eventsForRail,
  formatEventRange,
  groupEvents,
  isEndAfterStart,
  isPastEvent,
  localDateTimeMs,
  myResponseLabel,
  participantStatusLabel,
  sortEvents,
  tomorrowLocalDate,
  validateEventTitle,
  viewerTimeZone,
} from "./evenements-list"

const i18n = createAppI18n({ locale: "fr", appResources: { fr: {}, en: {} }, defaultNS: "reseau" })
const t = i18n.getFixedT("fr")
const tEn = i18n.getFixedT("en")

/**
 * Le fuseau des cas du socle, passé EXPLICITEMENT : une donnée de test, pas un
 * défaut du module (l'écran passe le fuseau du navigateur du lecteur).
 */
const LIBREVILLE = "Africa/Libreville"

/** 2026-08-19 09:00 à Libreville (UTC+1) = 08:00 UTC. */
const BASE_START = Date.UTC(2026, 7, 19, 8, 0, 0)

type MakeEventOverrides = Omit<Partial<EvenementListItem>, "eventId" | "myParticipation"> & {
  eventId: string
  myParticipation?: { participationId: string; status: PersonalEventParticipationStatus } | null
}

function makeEvent(overrides: MakeEventOverrides): EvenementListItem {
  const { eventId, myParticipation, ...rest } = overrides
  return {
    title: "Réunion",
    description: null,
    location: null,
    startAt: BASE_START,
    endAt: BASE_START + 3600_000,
    timeZone: LIBREVILLE,
    status: "scheduled",
    cancelledAt: null,
    isOrganizer: true,
    organizer: {
      personId: "persons_organisateur" as Id<"persons">,
      displayName: "Organisateur",
      handle: "organisateur",
      headline: null,
      avatarUrl: null,
      source: "published",
    },
    participantCount: 1,
    acceptedCount: 0,
    announcePostId: null,
    createdAt: BASE_START,
    ...rest,
    eventId: eventId as Id<"events">,
    myParticipation:
      myParticipation === undefined || myParticipation === null
        ? null
        : { participationId: myParticipation.participationId as Id<"eventParticipants">, status: myParticipation.status },
  }
}

describe("isPastEvent — frontière du jour civil du lecteur", () => {
  // "now" = 2026-08-19 16:00 Libreville (15:00 UTC), en plein après-midi.
  const now = Date.UTC(2026, 7, 19, 15, 0, 0)

  it("un évènement fini hier (23:59:59 Libreville) est passé", () => {
    const event = makeEvent({ eventId: "hier", endAt: Date.UTC(2026, 7, 18, 22, 59, 59) })
    expect(isPastEvent(event, now, LIBREVILLE)).toBe(true)
  })

  it("un évènement fini pile à minuit AUJOURD'HUI (00:00:00 Libreville) n'est pas passé", () => {
    const event = makeEvent({ eventId: "minuit-pile", endAt: Date.UTC(2026, 7, 18, 23, 0, 0) })
    expect(isPastEvent(event, now, LIBREVILLE)).toBe(false)
  })

  it("un évènement qui finit ce soir (23:59:59 Libreville, encore aujourd'hui) n'est pas passé", () => {
    const event = makeEvent({ eventId: "ce-soir", endAt: Date.UTC(2026, 7, 19, 22, 59, 59) })
    expect(isPastEvent(event, now, LIBREVILLE)).toBe(false)
  })

  it("un évènement de demain n'est pas passé", () => {
    const event = makeEvent({ eventId: "demain", endAt: Date.UTC(2026, 7, 20, 8, 0, 0) })
    expect(isPastEvent(event, now, LIBREVILLE)).toBe(false)
  })

  it("le JOUR est celui du lecteur : le même instant tombe la veille à Libreville, le jour même à Tokyo", () => {
    // « Maintenant » = le 19 à 09:00 à Libreville, 17:00 à Tokyo. La fin =
    // le 18 à 23:30 à Libreville (la veille), le 19 à 07:30 à Tokyo (ce jour).
    const morning = Date.UTC(2026, 7, 19, 8, 0, 0)
    const event = makeEvent({ eventId: "fuseau", endAt: Date.UTC(2026, 7, 18, 22, 30, 0) })
    expect(isPastEvent(event, morning, LIBREVILLE)).toBe(true)
    expect(isPastEvent(event, morning, "Asia/Tokyo")).toBe(false)
  })
})

describe("canRespond — plus strict que le serveur, à l'écran seulement", () => {
  const now = Date.UTC(2026, 7, 19, 15, 0, 0)

  it("scheduled, avec une ligne de participation, pas encore passé : oui", () => {
    const event = makeEvent({ eventId: "ok", isOrganizer: false, myParticipation: { participationId: "p1", status: "pending" } })
    expect(canRespond(event, now, LIBREVILLE)).toBe(true)
  })

  it("annulé : jamais — même avec une ligne de participation active", () => {
    const event = makeEvent({
      eventId: "annule",
      status: "cancelled",
      isOrganizer: false,
      myParticipation: { participationId: "p1", status: "pending" },
    })
    expect(canRespond(event, now, LIBREVILLE)).toBe(false)
  })

  it("organisateur (pas de ligne de participation) : jamais", () => {
    const event = makeEvent({ eventId: "organisateur", isOrganizer: true, myParticipation: null })
    expect(canRespond(event, now, LIBREVILLE)).toBe(false)
  })

  it("passé : jamais, même scheduled avec une ligne de participation", () => {
    const event = makeEvent({
      eventId: "passe",
      isOrganizer: false,
      myParticipation: { participationId: "p1", status: "pending" },
      endAt: Date.UTC(2026, 7, 18, 22, 59, 59),
    })
    expect(canRespond(event, now, LIBREVILLE)).toBe(false)
  })
})

describe("sortEvents — chronologique ascendant, sans muter l'entrée", () => {
  it("trie du plus proche du passé au plus lointain", () => {
    const later = makeEvent({ eventId: "later", startAt: BASE_START + 3 * 86_400_000 })
    const earliest = makeEvent({ eventId: "earliest", startAt: BASE_START })
    const middle = makeEvent({ eventId: "middle", startAt: BASE_START + 86_400_000 })
    const input = [later, earliest, middle]

    const sorted = sortEvents(input)

    expect(sorted.map((e) => e.eventId)).toEqual(["earliest", "middle", "later"])
    // L'entrée n'est pas mutée : une fonction pure ne modifie pas ses arguments.
    expect(input.map((e) => e.eventId)).toEqual(["later", "earliest", "middle"])
  })
})

describe("groupEvents — quatre sections exclusives", () => {
  // "now" = 2026-08-19 15:00 UTC (16:00 Libreville).
  const now = Date.UTC(2026, 7, 19, 15, 0, 0)
  const todayStart = Date.UTC(2026, 7, 19, 8, 0, 0) // 09:00 Libreville, aujourd'hui
  const tomorrowStart = Date.UTC(2026, 7, 20, 8, 0, 0)
  const yesterdayStart = Date.UTC(2026, 7, 18, 8, 0, 0)

  it("range chaque évènement dans SA section, sans perte ni doublon", () => {
    const organizedFuture = makeEvent({
      eventId: "organized-future",
      isOrganizer: true,
      startAt: tomorrowStart + 86_400_000,
      endAt: tomorrowStart + 86_400_000 + 3600_000,
    })
    const respondedToday = makeEvent({
      eventId: "responded-today",
      isOrganizer: false,
      startAt: todayStart,
      endAt: todayStart + 3600_000,
      myParticipation: { participationId: "p-today", status: "accepted" },
    })
    const pendingTomorrow = makeEvent({
      eventId: "pending-tomorrow",
      isOrganizer: false,
      startAt: tomorrowStart,
      endAt: tomorrowStart + 3600_000,
      myParticipation: { participationId: "p-tomorrow", status: "pending" },
    })
    const pendingButPast = makeEvent({
      eventId: "pending-but-past",
      isOrganizer: false,
      startAt: yesterdayStart,
      endAt: yesterdayStart + 3600_000,
      myParticipation: { participationId: "p-past", status: "pending" },
    })
    // Strictement avant `pendingButPast` (même jour civil, deux heures plus
    // tôt) : l'ordre chronologique attendu dans « Passés » ne dépend ainsi
    // pas de la stabilité du tri sur une égalité de `startAt`.
    const organizedPast = makeEvent({
      eventId: "organized-past",
      isOrganizer: true,
      startAt: yesterdayStart - 2 * 3600_000,
      endAt: yesterdayStart - 3600_000,
    })
    // Annulé, invitation jamais répondue, MAIS pour demain : ni « en attente »
    // (on ne répond plus à un évènement annulé), ni « passé » (c'est demain) —
    // il reste visible à sa date, dans « À venir ».
    const cancelledTomorrow = makeEvent({
      eventId: "cancelled-tomorrow",
      status: "cancelled",
      isOrganizer: false,
      startAt: tomorrowStart,
      endAt: tomorrowStart + 3600_000,
      myParticipation: { participationId: "p-cancelled", status: "pending" },
    })

    const input = [organizedFuture, respondedToday, pendingTomorrow, pendingButPast, organizedPast, cancelledTomorrow]
    const grouped = groupEvents(input, now, LIBREVILLE)

    expect(grouped.upcoming.map((e) => e.eventId)).toEqual(["cancelled-tomorrow", "organized-future"])
    expect(grouped.today.map((e) => e.eventId)).toEqual(["responded-today"])
    expect(grouped.pendingInvitations.map((e) => e.eventId)).toEqual(["pending-tomorrow"])
    expect(grouped.past.map((e) => e.eventId)).toEqual(["organized-past", "pending-but-past"])

    // Rien n'est perdu, rien n'est dupliqué.
    const total = grouped.upcoming.length + grouped.today.length + grouped.pendingInvitations.length + grouped.past.length
    expect(total).toBe(input.length)
  })

  it("trie chaque section chronologiquement, indépendamment de l'ordre d'entrée", () => {
    const a = makeEvent({ eventId: "a", startAt: tomorrowStart + 2 * 86_400_000 })
    const b = makeEvent({ eventId: "b", startAt: tomorrowStart })
    const grouped = groupEvents([a, b], now, LIBREVILLE)
    expect(grouped.upcoming.map((e) => e.eventId)).toEqual(["b", "a"])
  })

  it("un agenda vide rend quatre sections vides", () => {
    const grouped = groupEvents([], now, LIBREVILLE)
    expect(grouped.upcoming).toEqual([])
    expect(grouped.today).toEqual([])
    expect(grouped.pendingInvitations).toEqual([])
    expect(grouped.past).toEqual([])
  })
})

describe("eventsForRail — aperçu utile et borné", () => {
  const now = Date.UTC(2026, 7, 19, 15, 0, 0)

  it("priorise les invitations, puis aujourd'hui et les prochaines dates", () => {
    const pending = makeEvent({
      eventId: "pending",
      isOrganizer: false,
      startAt: BASE_START + 2 * 86_400_000,
      endAt: BASE_START + 2 * 86_400_000 + 3600_000,
      myParticipation: { participationId: "p1", status: "pending" },
    })
    const today = makeEvent({ eventId: "today" })
    const upcoming = makeEvent({
      eventId: "upcoming",
      startAt: BASE_START + 3 * 86_400_000,
      endAt: BASE_START + 3 * 86_400_000 + 3600_000,
    })

    expect(eventsForRail([upcoming, today, pending], now, LIBREVILLE)).toEqual([pending, today, upcoming])
  })

  it("écarte passé et annulé, puis respecte la limite", () => {
    const past = makeEvent({
      eventId: "past",
      startAt: BASE_START - 2 * 86_400_000,
      endAt: BASE_START - 2 * 86_400_000 + 3600_000,
    })
    const cancelled = makeEvent({
      eventId: "cancelled",
      status: "cancelled",
      startAt: BASE_START + 86_400_000,
      endAt: BASE_START + 86_400_000 + 3600_000,
    })
    const first = makeEvent({ eventId: "first" })
    const second = makeEvent({
      eventId: "second",
      startAt: BASE_START + 86_400_000,
      endAt: BASE_START + 86_400_000 + 3600_000,
    })

    expect(eventsForRail([past, cancelled, second, first], now, LIBREVILLE, 1)).toEqual([first])
    expect(eventsForRail([first], now, LIBREVILLE, 0)).toEqual([])
  })
})

describe("les sections — ordre d'affichage et titres", () => {
  it("liste les quatre clés dans l'ordre d'écran", () => {
    expect(EVENT_SECTIONS).toEqual(["upcoming", "today", "pendingInvitations", "past"])
  })

  it("nomme chaque section en clair", () => {
    expect(t(EVENT_SECTION_TITLE_KEYS.upcoming)).toBe("À venir")
    expect(t(EVENT_SECTION_TITLE_KEYS.today)).toBe("Aujourd'hui")
    expect(t(EVENT_SECTION_TITLE_KEYS.pendingInvitations)).toBe("Invitations en attente")
    expect(t(EVENT_SECTION_TITLE_KEYS.past)).toBe("Passés")
  })
})

describe("myResponseLabel", () => {
  it("nomme les quatre statuts, et l'absence de ligne (organisateur)", () => {
    expect(myResponseLabel("accepted", t)).toBe("Je participe")
    expect(myResponseLabel("declined", t)).toBe("Je décline")
    expect(myResponseLabel("maybe", t)).toBe("Peut-être")
    expect(myResponseLabel("pending", t)).toBe("Sans réponse")
    expect(myResponseLabel(null, t)).toBeNull()
  })
})

describe("participantStatusLabel — la réponse d'un invité, à la troisième personne", () => {
  it("nomme les quatre statuts sans dire « je »", () => {
    expect(participantStatusLabel("accepted", t)).toBe("Participe")
    expect(participantStatusLabel("declined", t)).toBe("Décline")
    expect(participantStatusLabel("maybe", t)).toBe("Peut-être")
    expect(participantStatusLabel("pending", t)).toBe("Sans réponse")
  })
})

describe("emptyAgendaText", () => {
  it("explique comment peupler l'agenda", () => {
    expect(emptyAgendaText(t).length).toBeGreaterThan(0)
    expect(emptyAgendaText(t)).toContain("Créez un évènement")
  })
})

describe("eventPersonName — un nom neutre, jamais un vide", () => {
  it("garde le nom publié, nomme sobrement l'absence", () => {
    expect(eventPersonName("Awa Ndong", t)).toBe("Awa Ndong")
    expect(eventPersonName(null, t)).toBe("Personne du réseau")
  })
})

describe("formatEventRange — dans le fuseau et la langue donnés", () => {
  const startsAt = Date.UTC(2026, 7, 19, 8, 0, 0) // mercredi 19 août 2026, 09:00 Libreville

  it("même jour civil : une seule date, une plage d'heures", () => {
    const endsAt = Date.UTC(2026, 7, 19, 10, 0, 0) // 11:00 Libreville, même jour
    expect(formatEventRange(startsAt, endsAt, "fr", LIBREVILLE)).toBe("mercredi 19 août 2026, 09:00 → 11:00")
  })

  it("jours différents : date et heure des deux bornes", () => {
    const endsAt = Date.UTC(2026, 7, 20, 10, 0, 0) // jeudi 20 août 2026, 11:00 Libreville
    expect(formatEventRange(startsAt, endsAt, "fr", LIBREVILLE)).toBe("mercredi 19 août 2026, 09:00 → jeudi 20 août 2026, 11:00")
  })

  it("sans date de fin : seule la date de début, sans flèche", () => {
    expect(formatEventRange(startsAt, null, "fr", LIBREVILLE)).toBe("mercredi 19 août 2026, 09:00")
  })

  it("le fuseau du LECTEUR décide de l'heure ET du jour affichés", () => {
    // 09:00 à Libreville = 17:00 à Tokyo ; 23:30 à Libreville = 07:30 le lendemain à Tokyo.
    const lateEnd = Date.UTC(2026, 7, 19, 22, 30, 0)
    expect(formatEventRange(startsAt, lateEnd, "fr", LIBREVILLE)).toBe("mercredi 19 août 2026, 09:00 → 23:30")
    expect(formatEventRange(startsAt, lateEnd, "fr", "Asia/Tokyo")).toBe("mercredi 19 août 2026, 17:00 → jeudi 20 août 2026, 07:30")
  })

  it("la langue est celle de l'écran, jamais le français imposé", () => {
    const text = formatEventRange(startsAt, null, "en", LIBREVILLE)
    expect(text).toContain("Wednesday")
    expect(text).toContain("August")
    expect(text).not.toContain("mercredi")
  })

  it("le fuseau du lecteur est celui du navigateur, et c'est un fuseau valide", () => {
    const zone = viewerTimeZone()
    expect(zone.length).toBeGreaterThan(0)
    expect(() => new Intl.DateTimeFormat(undefined, { timeZone: zone })).not.toThrow()
  })
})

describe("announceSummary — deux publics, jamais confondus (R-16)", () => {
  it("dit qu'aucun invité n'est encore là", () => {
    expect(announceSummary({ participantCount: 0 }, "connections", t)).toBe("Aucun invité pour l'instant ; l'annonce sera visible par vos connexions.")
  })

  it("accorde le singulier et le pluriel", () => {
    expect(announceSummary({ participantCount: 1 }, "connections", t)).toContain("1 personne est invitée")
    expect(announceSummary({ participantCount: 4 }, "connections", t)).toContain("4 personnes sont invitées")
  })

  it("suit l'audience CHOISIE — c'était `connections` codé en dur", () => {
    expect(announceSummary({ participantCount: 2 }, "public", t)).toContain("tout le réseau")
    expect(announceSummary({ participantCount: 2 }, "connections", t)).toContain("vos connexions")
  })

  it("ne présente jamais le compte d'invités comme une portée de diffusion", () => {
    const phrase = announceSummary({ participantCount: 3 }, "public", t)
    // Les deux moitiés sont là, et séparées.
    expect(phrase).toContain("3 personnes sont invitées")
    expect(phrase).toContain("l'annonce sera visible par")
  })

  it("nomme l'audience avec le vocabulaire du composeur", () => {
    expect(announceAudienceLabel("public", t)).toBe("tout le réseau")
    expect(announceAudienceLabel("connections", t)).toBe("vos connexions")
  })

  it("se traduit sans perdre ses deux moitiés", () => {
    expect(announceSummary({ participantCount: 0 }, "public", tEn)).toBe("No guests yet; the announcement will be visible to the whole network.")
    expect(announceSummary({ participantCount: 1 }, "connections", tEn)).toBe("1 person is invited; the announcement will be visible to your connections.")
  })
})

// ═══════════════════════════════════════════════════════════════
// Le formulaire de composition (repris d'iagenda/personal-event-form)
// ═══════════════════════════════════════════════════════════════

describe("tomorrowLocalDate", () => {
  it("propose le lendemain, au format du champ date", () => {
    const now = new Date(2026, 8, 6, 10, 0, 0).getTime()
    expect(tomorrowLocalDate(now)).toBe("2026-09-07")
  })

  it("passe le mois et l'année sans se tromper de zéro", () => {
    expect(tomorrowLocalDate(new Date(2026, 8, 30, 12, 0, 0).getTime())).toBe("2026-10-01")
    expect(tomorrowLocalDate(new Date(2026, 11, 31, 12, 0, 0).getTime())).toBe("2027-01-01")
    expect(tomorrowLocalDate(new Date(2026, 0, 8, 12, 0, 0).getTime())).toBe("2026-01-09")
  })
})

describe("localDateTimeMs", () => {
  it("rend l'instant LOCAL du couple (date, heure)", () => {
    expect(localDateTimeMs("2026-09-07", "10:00")).toBe(new Date(2026, 8, 7, 10, 0, 0).getTime())
  })

  it("rend NaN sur une saisie incomplète — l'appelant le DIT", () => {
    expect(Number.isFinite(localDateTimeMs("", "10:00"))).toBe(false)
    expect(Number.isFinite(localDateTimeMs("2026-09-07", ""))).toBe(false)
    expect(Number.isFinite(localDateTimeMs("pas-une-date", "10:00"))).toBe(false)
  })
})

describe("isEndAfterStart — la règle de saisie", () => {
  it("accepte une fin strictement postérieure au début", () => {
    expect(isEndAfterStart(1_000, 2_000)).toBe(true)
  })

  it("refuse une fin égale ou antérieure, et toute borne non finie", () => {
    expect(isEndAfterStart(2_000, 2_000)).toBe(false)
    expect(isEndAfterStart(3_000, 2_000)).toBe(false)
    expect(isEndAfterStart(Number.NaN, 2_000)).toBe(false)
    expect(isEndAfterStart(1_000, Number.NaN)).toBe(false)
  })

  it("porte le message attendu", () => {
    expect(t(END_BEFORE_START_KEY)).toBe("La fin doit être postérieure au début")
  })
})

describe("validateEventTitle — miroir allégé du serveur", () => {
  it("borne avec les bornes du domaine, sans remplacer la garde", () => {
    expect(EVENT_TITLE_MIN_LENGTH).toBe(PERSONAL_EVENT_TITLE_MIN_LENGTH)
    expect(EVENT_TITLE_MAX_LENGTH).toBe(PERSONAL_EVENT_TITLE_MAX_LENGTH)
    expect(validateEventTitle("Pot de départ", t)).toBeNull()
    expect(validateEventTitle("  ab  ", t)).toBe("Un titre d'évènement compte entre 3 et 120 caractères.")
    expect(validateEventTitle("x".repeat(EVENT_TITLE_MAX_LENGTH + 1), t)).not.toBeNull()
  })
})

describe("inviter des relations — le récapitulatif", () => {
  it("classe chaque réponse du serveur dans EXACTEMENT une case", () => {
    expect(classifyEventInviteResult({ invited: true })).toBe("invited")
    expect(classifyEventInviteResult({ invited: false })).toBe("alreadyResponded")
  })

  it("dit ce que l'envoi a produit, sans mensonge poli", () => {
    expect(eventInviteReportLabel({ invited: 0, alreadyResponded: 0, failed: 0 }, t)).toBe("Aucune invitation envoyée.")
    expect(eventInviteReportLabel({ invited: 1, alreadyResponded: 0, failed: 0 }, t)).toBe("1 invitation envoyée.")
    expect(eventInviteReportLabel({ invited: 2, alreadyResponded: 1, failed: 1 }, t)).toBe("2 invitations envoyées, 1 personne a déjà répondu, 1 échec.")
  })
})

describe("un refus du moteur se dit par son code, jamais par sa trace", () => {
  const FALLBACK = "reseau:evenementsPanel.toast.respondFailed"

  it("la règle du domaine enfreinte (évènement annulé)", () => {
    expect(eventActionErrorText(new ConvexError({ code: "invalidArgument", rule: "EVENT_CANCELLED" }), FALLBACK, t)).toBe("Cet évènement est annulé.")
  })

  it("un code parlant plutôt que la phrase du geste", () => {
    expect(eventActionErrorText(new ConvexError({ code: "eventOrganizerRequired" }), FALLBACK, t)).toBe(t("errors:eventOrganizerRequired"))
  })

  it("le refus indistinct et l'inconnu gardent la phrase du geste", () => {
    expect(eventActionErrorText(new ConvexError({ code: "notFound" }), FALLBACK, t)).toBe("Impossible d'enregistrer votre réponse.")
    expect(eventActionErrorText(new Error("Server Error"), FALLBACK, t)).toBe("Impossible d'enregistrer votre réponse.")
  })
})
