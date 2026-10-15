"use client"

import { PERSONAL_POST_MAX_LENGTH, PERSONAL_REACH_AUDIENCES } from "@antia/social-domain/content"
import { zodResolver } from "@hookform/resolvers/zod"
import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"
import { useMutation } from "convex/react"
import { Send } from "lucide-react"
import { useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { z } from "zod"

import { Button, Card, Field, TextArea } from "@/components/shared/controls"
import { engineErrorMessage } from "@/lib/engine-errors"

/** Une clé d'idempotence par brouillon : un double clic ne publie qu'une fois. */
function newDraftKey(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`
}

export function Composer({ networkId }: { networkId: Id<"networks"> }) {
  const { t } = useTranslation()
  const publish = useMutation(api.modules.posts.posts.publish)
  const [draftKey, setDraftKey] = useState(newDraftKey)

  const schema = z.object({
    body: z.string().trim().min(1, t("rules:POST_EMPTY")).max(PERSONAL_POST_MAX_LENGTH, t("rules:POST_TOO_LONG", { max: PERSONAL_POST_MAX_LENGTH })),
    audience: z.enum(PERSONAL_REACH_AUDIENCES),
  })
  type Values = z.infer<typeof schema>
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { body: "", audience: "public" } })
  const body = useWatch({ control: form.control, name: "body" })
  const left = PERSONAL_POST_MAX_LENGTH - body.length

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await publish({ networkId, body: values.body, audience: values.audience, idempotencyKey: draftKey })
      form.reset({ body: "", audience: values.audience })
      setDraftKey(newDraftKey())
      toast.success(t("antia:feed.published"))
    } catch (error) {
      toast.error(engineErrorMessage(error, t))
    }
  })

  return (
    <Card>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
        <Field id="post-body" label={t("antia:feed.composerLabel")} error={form.formState.errors.body?.message}>
          <TextArea
            id="post-body"
            placeholder={t("antia:feed.composerPlaceholder")}
            maxLength={PERSONAL_POST_MAX_LENGTH}
            aria-invalid={form.formState.errors.body ? true : undefined}
            aria-describedby={form.formState.errors.body ? "post-body-error" : undefined}
            {...form.register("body")}
          />
        </Field>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">{t("antia:feed.audienceLabel")}</span>
            <select className="min-h-9 rounded-lg border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" {...form.register("audience")}>
              {PERSONAL_REACH_AUDIENCES.map((audience) => (
                <option key={audience} value={audience}>
                  {t(`antia:feed.audience.${audience}`)}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-center gap-3">
            <span className="text-xs tabular-nums text-muted-foreground" aria-live="polite">
              {t("antia:feed.charactersLeft", { count: left })}
            </span>
            <Button type="submit" pending={form.formState.isSubmitting}>
              <Send aria-hidden="true" className="size-4" />
              {form.formState.isSubmitting ? t("antia:feed.publishing") : t("antia:feed.publish")}
            </Button>
          </div>
        </div>
      </form>
    </Card>
  )
}
