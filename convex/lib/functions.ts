/**
 * Constructeurs de fonctions du moteur — la garde vit dans le CONSTRUCTEUR,
 * pas dans chaque fonction (patron du socle, `lib/customFunctions.ts`) : on ne
 * peut pas déclarer une fonction sociale qui oublie sa borne de réseau.
 *
 *   networkQuery / networkMutation   `networkId` CONSOMMÉ par le constructeur,
 *                                    `requireMembership` au statut `minStatus`
 *                                    (défaut : `en_attente` en lecture,
 *                                    `declaree` en écriture) ; le handler lit
 *                                    `ctx.network`, `ctx.membership`, `ctx.person`.
 *   networkAction                    la même garde pour une ACTION (qui n'a pas
 *                                    de base) : `requireMembership` court dans une
 *                                    query interne, avec l'identité de l'action ;
 *                                    le handler lit `ctx.personId`, `ctx.networkId`.
 *   personQuery / personMutation     la seule personne appelante (ses réglages,
 *                                    son adhésion, ses consentements) : à
 *                                    justifier par `@selfScoped` dans un module social.
 *   operatorQuery / operatorMutation console du moteur : opérateur de plateforme vivant.
 *
 * Le cliquet `network-scoped-functions` relit les modules sociaux et refuse
 * toute fonction publique qui n'emprunte pas un constructeur borné ou ne
 * porte pas sa justification.
 */
import type { ActiveMembershipStatus } from "@antsia/social-domain/membership"
import { customAction, customMutation, customQuery } from "convex-helpers/server/customFunctions"
import { makeFunctionReference } from "convex/server"
import { v } from "convex/values"

import type { Doc, Id } from "../_generated/dataModel"
import { action, mutation, query, type QueryCtx } from "../_generated/server"
import { requireMembership, requirePerson } from "./access"
import { fail } from "./errors"

type NetworkExtra = { minStatus?: ActiveMembershipStatus }

/**
 * La garde de réseau d'une action, posée par `lib/actionAccess.ts`. Référence
 * par CHEMIN et non par `internal.…` : ce fichier est importé par tous les
 * modules, et l'API générée qui les décrit tous ne doit pas en dépendre en retour.
 */
const membershipForAction = makeFunctionReference<
  "query",
  { networkId: Id<"networks">; minStatus: ActiveMembershipStatus },
  { personId: Id<"persons">; networkId: Id<"networks"> }
>("lib/actionAccess:membershipForAction")

export const networkQuery = customQuery(query, {
  args: { networkId: v.id("networks") },
  input: async (ctx, { networkId }, extra: NetworkExtra) => {
    const access = await requireMembership(ctx, networkId, extra.minStatus ?? "en_attente")
    return { ctx: { ...access, networkId: access.network._id }, args: {} }
  },
})

export const networkMutation = customMutation(mutation, {
  args: { networkId: v.id("networks") },
  input: async (ctx, { networkId }, extra: NetworkExtra) => {
    const access = await requireMembership(ctx, networkId, extra.minStatus ?? "declaree")
    return { ctx: { ...access, networkId: access.network._id }, args: {} }
  },
})

export const networkAction = customAction(action, {
  args: { networkId: v.id("networks") },
  input: async (ctx, { networkId }, extra: NetworkExtra) => {
    const access = await ctx.runQuery(membershipForAction, { networkId, minStatus: extra.minStatus ?? "declaree" })
    return { ctx: access, args: {} }
  },
})

export const personQuery = customQuery(query, {
  args: {},
  input: async (ctx) => ({ ctx: { person: await requirePerson(ctx) }, args: {} }),
})

export const personMutation = customMutation(mutation, {
  args: {},
  input: async (ctx) => ({ ctx: { person: await requirePerson(ctx) }, args: {} }),
})

/** L'opérateur de plateforme vivant lié à la session ; `operatorRequired` sinon. */
export async function requireOperator(ctx: QueryCtx): Promise<{ person: Doc<"persons">; operator: Doc<"operators"> }> {
  const person = await requirePerson(ctx)
  const operator = await ctx.db
    .query("operators")
    .withIndex("by_person", (q) => q.eq("personId", person._id))
    .unique()
  if (!operator || operator.revokedAt !== undefined) return fail("operatorRequired")
  return { person, operator }
}

export const operatorQuery = customQuery(query, {
  args: {},
  input: async (ctx) => ({ ctx: await requireOperator(ctx), args: {} }),
})

export const operatorMutation = customMutation(mutation, {
  args: {},
  input: async (ctx) => ({ ctx: await requireOperator(ctx), args: {} }),
})
