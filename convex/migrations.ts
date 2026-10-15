/**
 * Migrations de données du moteur (cahier §11 : `@convex-dev/migrations`,
 * répétées sur un instantané avant toute production). Chaque migration est
 * idempotente : rejouée, elle ne réécrit rien.
 *
 *   bunx convex run migrations:run '{"fn": "migrations:setPostsOnRoot"}'
 */
import { Migrations } from "@convex-dev/migrations"

import { components } from "./_generated/api"
import type { DataModel } from "./_generated/dataModel"

export const migrations = new Migrations<DataModel>(components.migrations)

/** Le lanceur générique (CLI, tableau de bord). */
export const run = migrations.runner()

/**
 * PA3 lot 7 — `posts.onRoot` pour les publications d'avant le champ : lisible
 * depuis la racine si elle y est née, ou si sa visibilité est `root`.
 */
export const setPostsOnRoot = migrations.define({
  table: "posts",
  migrateOne: async (ctx, post) => {
    if (post.onRoot !== undefined) return
    const network = await ctx.db.get(post.networkId)
    return { onRoot: network?.kind === "root" || post.visibility === "root" }
  },
})
