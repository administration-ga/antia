/** P15 : porte SSR des offres d'emploi — DTO fermé (allowlist JOBS-V1), aucun repli anonyme d'une session refusée. */
import { COMMERCE_JOBS_LIMITS as L, COMMERCE_JOBS_SALARY_PERIODS } from "@antsia/social-domain/commerce-jobs"
import { COMMERCE_MAX_AMOUNT_XAF } from "@antsia/social-domain/commerce/primitives"
import { COMMERCE_JOB_CONTRACT_TYPES } from "@antsia/social-domain/commerce/projection"
import { api } from "@convex/_generated/api"
import type { JobDto } from "@convex/modules/shops/jobRead"
import { cache } from "react"
import { z } from "zod"

import { projected } from "./public-data"

const timestamp = z.number().int().nonnegative().max(8_640_000_000_000_000)
const civilDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/u)
const amount = z.number().int().nonnegative().max(COMMERCE_MAX_AMOUNT_XAF)

/** Objet fermé : ni candidat, ni contact, ni référence de liaison, ni structure, ni corps signé. */
export const publicJobSchema: z.ZodType<JobDto> = z.object({
  jobRef: z.string().regex(/^pro\.ga:job_opening:[0-9A-HJKMNP-TV-Z]{10,32}$/u), shopHandle: z.string().min(1).max(200), shopName: z.string().min(1).max(200),
  title: z.string().min(L.titleMin).max(L.titleMax), contractType: z.enum(COMMERCE_JOB_CONTRACT_TYPES), headcount: z.number().int().positive().max(L.headcountMax),
  description: z.string().max(L.descriptionMax), location: z.string().min(1).max(L.locationMax).nullable(),
  skills: z.array(z.string().min(L.skillMin).max(L.skillMax)).max(L.skillsMax), openedOn: civilDate, closesOn: civilDate.nullable(),
  salary: z.object({ currency: z.literal("XAF"), minAmount: amount.nullable(), maxAmount: amount.nullable(), period: z.enum(COMMERCE_JOBS_SALARY_PERIODS).nullable() }).strict().nullable(),
  status: z.enum(["open", "deadline_passed", "closed", "filled"]), revision: z.number().int().positive(), changedAt: timestamp,
  actions: z.object({ apply: z.boolean() }).strict(),
}).strict()

export const loadPublicJob = cache((handle: string, jobRef: string, handoff = false) =>
  projected(api.modules.public.jobs.job, { handle, jobRef }, publicJobSchema.nullable(), handoff),
)
