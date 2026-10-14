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
 *   personQuery / personMutation     la seule personne appelante (ses réglages,
 *                                    son adhésion, ses consentements) : à
 *                                    justifier par `@selfScoped` dans un module social.
 *   operatorQuery / operatorMutation console du moteur : opérateur de plateforme vivant.
 *
 * Le cliquet `network-scoped-functions` relit les modules sociaux et refuse
 * toute fonction publique qui n'emprunte pas un constructeur borné ou ne
 * porte pas sa justification.
 */
import type { ActiveMembershipStatus } from "@antia/social-domain/membership"
import { customMutation, customQuery } from "convex-helpers/server/customFunctions"
import { v } from "convex/values"

import type { Doc } from "../_generated/dataModel"
import { mutation, query, type QueryCtx } from "../_generated/server"
import { requireMembership, requirePerson } from "./access"
import { fail } from "./errors"

type NetworkExtra = { minStatus?: ActiveMembershipStatus }

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
