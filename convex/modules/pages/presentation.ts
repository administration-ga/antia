/**
 * Présentation allowlistée d'une page, ajoutée aux fiches et aux annuaires.
 * La carte minimale des en-têtes sociaux demeure distincte. Les champs du DTO
 * sont facultatifs pour les anciens fournisseurs ; la projection native les
 * rend toujours, à `null` lorsqu'ils ne sont pas renseignés ou applicables.
 */
import { v } from "convex/values"

import type { Doc } from "../../_generated/dataModel"
import { pageAssociationTypeValidator, pageSectorValidator } from "./validators"

export const pagePresentationFields = {
  city: v.optional(v.union(v.string(), v.null())),
  associationType: v.optional(v.union(pageAssociationTypeValidator, v.null())),
  sector: v.optional(v.union(pageSectorValidator, v.null())),
}

export function pagePresentationOf(page: Pick<Doc<"pages">, "ownerKind" | "city" | "associationType" | "sector">) {
  return {
    city: page.city ?? null,
    associationType: page.ownerKind === "association" ? (page.associationType ?? null) : null,
    sector: page.ownerKind === "company" ? (page.sector ?? null) : null,
  }
}
