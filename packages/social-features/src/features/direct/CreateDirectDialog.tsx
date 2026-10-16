// Dupliqué de socle/packages/agent-features/src/features/direct/CreateDirectDialog.tsx @ ad2e7fdc2 — adaptations : première tranche personnelle réécrite sur le moteur (réseau, personnes, routes injectées, RHF/Zod, i18n) ; page et sélection nominative libre différées ; invités proposés par iCom conservés et rejugés par le serveur.
"use client"

import { api, type Id } from "@antia/api/engine"
import { useNetwork, useRoutes } from "@antia/api/network"
import { useRouter } from "@antia/api/routing"
import { DIRECT_TITLE_MAX_LENGTH, DIRECT_DEFAULT_MAX_VIEWERS, DIRECT_MAX_VIEWERS_CAP } from "@antia/social-domain/live/domain"
import { Button } from "@antia/ui"
import { EspaceDialog } from "@antia/ui/espace-kit"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation } from "convex/react"
import { useId, useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { z } from "zod"

import { postEngineErrorText } from "../reseau-personnel/post-overflow"

const schema = z.object({
  title: z.string().trim().min(1).max(DIRECT_TITLE_MAX_LENGTH),
  audience: z.enum(["public", "connections", "invitees"]),
  maxViewers: z.number().int().min(1).max(DIRECT_MAX_VIEWERS_CAP),
  replay: z.boolean(),
  announce: z.boolean(),
})
type Draft = z.infer<typeof schema>
export type ConferencePrefill = {
  title?: string | null
  userIds: readonly string[]
  sourceThreadId?: string | null
}

export function CreateDirectDialog({ onClose, prefill }: { onClose: () => void; prefill?: ConferencePrefill }) {
  const { t } = useTranslation("direct")
  const { networkId, charte } = useNetwork()
  const routes = useRoutes()
  const router = useRouter()
  const create = useMutation(api.modules.live.sessions.create)
  const id = useId()
  const [idempotencyKey] = useState(() => crypto.randomUUID())
  const [error, setError] = useState<string | null>(null)
  const { register, handleSubmit, control, formState: { errors, isSubmitting } } = useForm<Draft>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: prefill?.title ?? "",
      audience: prefill && prefill.userIds.length > 0 ? "invitees" : "connections",
      maxViewers: DIRECT_DEFAULT_MAX_VIEWERS,
      replay: false,
      announce: false,
    },
  })
  const audience = useWatch({ control, name: "audience" })
  const submit = handleSubmit(async (draft) => {
    setError(null)
    try {
      const people = [...new Set(prefill?.userIds ?? [])]
      const result = await create({
        networkId,
        title: draft.title,
        audience: draft.audience,
        chatMode: "open",
        stageFormat: "computer",
        maxViewers: draft.maxViewers,
        replay: draft.replay,
        announce: draft.audience !== "invitees" && draft.announce,
        idempotencyKey,
        ...(people.length ? { invitees: people.map((personId) => ({ personId: personId as Id<"persons">, stageRole: people.length === 1 ? "speaker" as const : "viewer" as const })) } : {}),
        ...(prefill?.sourceThreadId ? { sourceThreadId: prefill.sourceThreadId as Id<"groupThreads"> } : {}),
      })
      onClose()
      router.push(routes.conference(result.sessionId))
    } catch (failure) {
      setError(postEngineErrorText(failure, "direct:failed", t))
    }
  })
  return (
    <EspaceDialog title={t("create.title")} description={t("create.description")} closeLabel={t("close")} onClose={isSubmitting ? () => undefined : onClose}>
      <form data-charte={charte} onSubmit={submit} className="flex flex-col gap-4">
        <label htmlFor={`${id}-title`} className="flex flex-col gap-2 text-sm">
          {t("create.name")}
          <input id={`${id}-title`} {...register("title")} maxLength={DIRECT_TITLE_MAX_LENGTH} aria-invalid={!!errors.title} className="min-h-11 rounded-lg border border-input bg-background px-3" />
          {errors.title ? <span role="alert">{t("create.invalidTitle", { max: DIRECT_TITLE_MAX_LENGTH })}</span> : null}
        </label>
        <label htmlFor={`${id}-audience`} className="flex flex-col gap-2 text-sm">
          {t("create.audience")}
          <select id={`${id}-audience`} {...register("audience")} className="min-h-11 rounded-lg border border-input bg-background px-3">
            <option value="connections">{t("audience.connections")}</option>
            <option value="public">{t("audience.public")}</option>
            {prefill && prefill.userIds.length > 0 ? <option value="invitees">{t("audience.invitees")}</option> : null}
          </select>
        </label>
        <p className="text-sm text-muted-foreground">{t("create.networkOnly")}</p>
        <label htmlFor={`${id}-capacity`} className="flex flex-col gap-2 text-sm">
          {t("create.capacity")}
          <input id={`${id}-capacity`} type="number" min={1} max={DIRECT_MAX_VIEWERS_CAP} {...register("maxViewers", { valueAsNumber: true })} aria-invalid={!!errors.maxViewers} className="min-h-11 rounded-lg border border-input bg-background px-3" />
          {errors.maxViewers ? <span role="alert">{t("create.invalidCapacity", { max: DIRECT_MAX_VIEWERS_CAP })}</span> : null}
        </label>
        <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" {...register("replay")} />{t("create.record")}</label>
        <p className="text-sm text-muted-foreground">{t("create.recordDescription")}</p>
        {audience !== "invitees" ? <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" {...register("announce")} />{t("create.announce")}</label> : null}
        {prefill && prefill.userIds.length > 0 ? <p className="text-sm">{t("create.invited", { count: new Set(prefill.userIds).size })}</p> : null}
        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
        <Button type="submit" disabled={isSubmitting}>{isSubmitting ? t("pending") : t("create.submit")}</Button>
      </form>
    </EspaceDialog>
  )
}
