// Dupliqué de socle/packages/agent-features/src/features/reseau-personnel/groupes-thematiques.test.ts @ ad2e7fdc2 — adaptations : libellés lus dans l'i18n du moteur (français, et l'anglais pour l'accord) — les constantes portent des clés traduites par `t` ; bornes comparées à celles du domaine du moteur ; tous les cas du socle portés ; cas ajoutés pour le zéro de l'effectif, le nom neutre et la lecture des refus du moteur (règle, code parlant, phrase du geste).
/**
 * groupes-thematiques — ce que le volet Groupes décide, vérifié :
 *
 *  1. la page d'un groupe REMPLACE l'annuaire et expose un retour (l'invariant
 *     de `reseau-layout`, repris) ;
 *  2. les prédicats d'autorité restent ceux du DOMAINE — un bouton montré à un
 *     rôle que le serveur refuse est un échec assuré ;
 *  3. les libellés disent l'état, jamais l'inverse.
 */
import { THEMATIC_GROUP_NAME_MAX_LENGTH, THEMATIC_GROUP_NAME_MIN_LENGTH } from "@antsia/social-domain/thematicGroups"
import { ConvexError } from "convex/values"
import { describe, expect, it } from "vitest"

import { createAppI18n } from "../../i18n"
import {
  GROUP_NAME_MAX_LENGTH,
  GROUP_NAME_MIN_LENGTH,
  GROUPS_RETURN_LABEL_KEY,
  canInviteToGroup,
  canLeaveGroup,
  canManageGroupRoles,
  canModerateGroup,
  emptyGroupWallText,
  groupActionErrorText,
  groupInvitesBannerLabel,
  groupPersonName,
  groupRoleLabel,
  groupsViewNeedsReturn,
  initialGroupsViewFor,
  joinCtaLabel,
  memberCountLabel,
  validateGroupName,
  EMPTY_DISCOVER_TEXT_KEY,
  EMPTY_MY_GROUPS_TEXT_KEY,
  GROUPS_ERROR_TEXT_KEYS,
  GROUP_INVITE_EMPTY_TEXT_KEY,
  GROUP_INVITE_OPEN_LABEL_KEY,
  GROUP_INVITE_PICKER_LABEL_KEY,
  classifyInviteResult,
  groupInviteReportLabel,
} from "./groupes-thematiques"

const i18n = createAppI18n({ locale: "fr", appResources: { fr: {}, en: {} }, defaultNS: "reseau" })
const t = i18n.getFixedT("fr")
const tEn = i18n.getFixedT("en")

describe("la vue du volet Groupes", () => {
  it("ouvre l'annuaire sans graine, la page du groupe semé sinon", () => {
    expect(initialGroupsViewFor(null)).toEqual({ kind: "list" })
    expect(initialGroupsViewFor("abc")).toEqual({ kind: "group", groupId: "abc" })
  })

  it("toute vue ≠ annuaire expose un retour — l'invariant de reseau-layout", () => {
    expect(groupsViewNeedsReturn({ kind: "list" })).toBe(false)
    expect(groupsViewNeedsReturn({ kind: "group", groupId: "abc" })).toBe(true)
    expect(t(GROUPS_RETURN_LABEL_KEY)).toBe("Revenir aux groupes")
  })
})

describe("autorité — la règle du domaine", () => {
  it("owner et moderator modèrent ; le seul owner gère les rôles", () => {
    expect(canModerateGroup("owner")).toBe(true)
    expect(canModerateGroup("moderator")).toBe(true)
    expect(canModerateGroup("member")).toBe(false)
    expect(canModerateGroup(null)).toBe(false)
    expect(canManageGroupRoles("owner")).toBe(true)
    expect(canManageGroupRoles("moderator")).toBe(false)
    expect(canManageGroupRoles(null)).toBe(false)
  })

  it("« Quitter » ne s'offre jamais à l'owner — le serveur le refuserait", () => {
    expect(canLeaveGroup("owner")).toBe(false)
    expect(canLeaveGroup("moderator")).toBe(true)
    expect(canLeaveGroup("member")).toBe(true)
    expect(canLeaveGroup(null)).toBe(false)
  })

  it("inviter est un acte de membre, tout rôle vivant", () => {
    expect(canInviteToGroup("member")).toBe(true)
    expect(canInviteToGroup("owner")).toBe(true)
    expect(canInviteToGroup(null)).toBe(false)
  })
})

describe("libellés", () => {
  it("nomme les rôles en clair", () => {
    expect(groupRoleLabel("owner", t)).toBe("Propriétaire")
    expect(groupRoleLabel("moderator", t)).toBe("Modérateur")
    expect(groupRoleLabel("member", t)).toBe("Membre")
    expect(groupRoleLabel(null, t)).toBeNull()
  })

  it("accorde l'effectif", () => {
    expect(memberCountLabel(1, t)).toBe("1 membre")
    expect(memberCountLabel(12, t)).toBe("12 membres")
  })

  it("zéro reste au pluriel, comme au socle — et l'anglais accorde aussi", () => {
    expect(memberCountLabel(0, t)).toBe("0 membres")
    expect(memberCountLabel(1, tEn)).toBe("1 member")
    expect(memberCountLabel(12, tEn)).toBe("12 members")
  })

  it("le bouton d'adhésion suit MON état — jamais deux fois membre", () => {
    expect(joinCtaLabel({ myRole: null, invited: false }, t)).toBe("Rejoindre")
    expect(joinCtaLabel({ myRole: null, invited: true }, t)).toBe("Accepter l'invitation")
    expect(joinCtaLabel({ myRole: "member", invited: false }, t)).toBeNull()
    expect(joinCtaLabel({ myRole: "owner", invited: false }, t)).toBeNull()
  })

  it("le bandeau d'invitations compte, ou se tait", () => {
    expect(groupInvitesBannerLabel(0, t)).toBeNull()
    expect(groupInvitesBannerLabel(1, t)).toBe("1 invitation de groupe en attente")
    expect(groupInvitesBannerLabel(3, t)).toBe("3 invitations de groupe en attente")
  })

  it("l'état vide du mur dépend de qui regarde", () => {
    expect(emptyGroupWallText(true, t)).toContain("Publiez")
    expect(emptyGroupWallText(false, t)).not.toContain("Publiez")
  })

  it("les états vides de l'annuaire gardent leur phrase", () => {
    expect(t(EMPTY_MY_GROUPS_TEXT_KEY)).toMatch(/créez le vôtre/)
    expect(t(EMPTY_DISCOVER_TEXT_KEY)).toMatch(/Créez le premier/)
  })

  it("une personne sans profil publié reçoit un nom NEUTRE, jamais un vide", () => {
    expect(groupPersonName("Awa Ndong", t)).toBe("Awa Ndong")
    expect(groupPersonName(null, t)).toBe("Personne du réseau")
    expect(groupPersonName("   ", t)).toBe("Personne du réseau")
  })
})

describe("validation du nom — miroir allégé du serveur", () => {
  it("borne sans remplacer la garde", () => {
    expect(validateGroupName("Marchés publics", t)).toBeNull()
    expect(validateGroupName("ab", t)).not.toBeNull()
    expect(validateGroupName("x".repeat(GROUP_NAME_MAX_LENGTH + 1), t)).not.toBeNull()
    expect(GROUP_NAME_MIN_LENGTH).toBe(3)
  })

  it("les bornes SONT celles du domaine du moteur, et la phrase les cite", () => {
    expect(GROUP_NAME_MIN_LENGTH).toBe(THEMATIC_GROUP_NAME_MIN_LENGTH)
    expect(GROUP_NAME_MAX_LENGTH).toBe(THEMATIC_GROUP_NAME_MAX_LENGTH)
    expect(validateGroupName("ab", t)).toBe("Un nom de groupe compte entre 3 et 80 caractères.")
  })
})

describe("la vue est une PROJECTION de l'URL (R-13)", () => {
  it("se recalcule à chaque rendu — la même graine rend la même vue", () => {
    // Pas d'état interne : deux lectures successives de la même URL
    // donnent deux vues ÉGALES, et changer de graine change la vue.
    expect(initialGroupsViewFor("g1")).toEqual(initialGroupsViewFor("g1"))
    expect(initialGroupsViewFor("g1")).not.toEqual(initialGroupsViewFor("g2"))
    expect(initialGroupsViewFor(null)).toEqual({ kind: "list" })
  })
})

describe("invitation par le sélecteur — le récapitulatif (R-13)", () => {
  it("nomme l'ouverture du sélecteur et son vivier vide", () => {
    expect(t(GROUP_INVITE_OPEN_LABEL_KEY).length).toBeGreaterThan(0)
    expect(t(GROUP_INVITE_PICKER_LABEL_KEY)).toContain("groupe")
    expect(t(GROUP_INVITE_EMPTY_TEXT_KEY).length).toBeGreaterThan(0)
  })

  it("une panne du vivier se dit — jamais « aucune relation »", () => {
    expect(t(GROUPS_ERROR_TEXT_KEYS.candidates.title)).toBe("Relations indisponibles")
    expect(t(GROUPS_ERROR_TEXT_KEYS.candidates.message).length).toBeGreaterThan(0)
  })

  it("accorde le récapitulatif d'envoi, et distingue le rappel", () => {
    expect(groupInviteReportLabel({ invited: 0, alreadyMember: 0, alreadyInvited: 0, failed: 0 }, t)).toBe("Aucune invitation envoyée.")
    expect(groupInviteReportLabel({ invited: 1, alreadyMember: 0, alreadyInvited: 0, failed: 0 }, t)).toBe("1 invitation envoyée.")
    expect(groupInviteReportLabel({ invited: 2, alreadyMember: 0, alreadyInvited: 1, failed: 0 }, t)).toBe("2 invitations envoyées, 1 rappel.")
    expect(groupInviteReportLabel({ invited: 0, alreadyMember: 2, alreadyInvited: 0, failed: 1 }, t)).toBe("2 personnes déjà membres, 1 échec.")
  })

  it("classe chaque réponse du serveur dans EXACTEMENT une case", () => {
    expect(classifyInviteResult({ invited: true, alreadyInvited: false })).toBe("invited")
    expect(classifyInviteResult({ invited: true, alreadyInvited: true })).toBe("alreadyInvited")
    expect(classifyInviteResult({ invited: false, alreadyInvited: false })).toBe("alreadyMember")
    // Une réponse sans `alreadyInvited` : la première invitation reste une
    // invitation, jamais un rappel inventé.
    expect(classifyInviteResult({ invited: true })).toBe("invited")
  })
})

describe("un refus du moteur se dit par son code, jamais par sa trace", () => {
  const FALLBACK = "reseau:groupsPanel.toast.joinFailed"

  it("la règle du domaine enfreinte, avec ses bornes", () => {
    const error = new ConvexError({ code: "invalidArgument", rule: "GROUP_NAME_LENGTH", params: { min: 3, max: 80 } })
    expect(groupActionErrorText(error, FALLBACK, t)).toBe(t("rules:GROUP_NAME_LENGTH", { min: 3, max: 80 }))
  })

  it("un code parlant (débit, rôle) plutôt que la phrase du geste", () => {
    expect(groupActionErrorText(new ConvexError({ code: "rateLimited" }), FALLBACK, t)).toBe(t("errors:rateLimited"))
    expect(groupActionErrorText(new ConvexError({ code: "groupRoleRequired" }), FALLBACK, t)).toBe(t("errors:groupRoleRequired"))
  })

  it("le refus indistinct et l'inconnu gardent la phrase du geste", () => {
    expect(groupActionErrorText(new ConvexError({ code: "notFound" }), FALLBACK, t)).toBe(t(FALLBACK))
    expect(groupActionErrorText(new Error("[CONVEX M(x)] Server Error"), FALLBACK, t)).toBe(t(FALLBACK))
    expect(t(FALLBACK)).not.toContain("groupsPanel")
  })
})
