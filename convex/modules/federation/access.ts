import type { Doc } from "../../_generated/dataModel"
import type { QueryCtx } from "../../_generated/server"
import { notFound } from "../../lib/errors"
import { hasStrongIdentityFor } from "../people/persons"

/** Configurer ou rejouer : administrateur explicite et IDN ≥ 2 vivant. */
export async function requireFederationAdmin(ctx: Pick<QueryCtx, "db">, actor: { person: Doc<"persons">; operator: Doc<"operators"> }): Promise<void> {
  if (actor.operator.role !== "platform_admin" || !await hasStrongIdentityFor(ctx, actor.person._id)) return notFound()
}
