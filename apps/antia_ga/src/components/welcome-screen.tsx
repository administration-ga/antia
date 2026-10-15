"use client"

import { DISPLAY_NAME_MAX_LENGTH, HANDLE_MAX_LENGTH, HANDLE_MIN_LENGTH } from "@antia/social-domain/content"
import { zodResolver } from "@hookform/resolvers/zod"
import { api } from "@convex/_generated/api"
import { useMutation, useQuery } from "convex/react"
import { AtSign } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { z } from "zod"

import { Button, Card, CenteredStatus, Field, TextInput } from "@/components/shared/controls"
import { useSessionState } from "@/components/use-session-state"
import { engineErrorMessage } from "@/lib/engine-errors"
import { routes } from "@/lib/routes"

/** La valeur, une fois que la saisie s'est calmée (évite une requête par frappe). */
function useSettled<T>(value: T, delayMs = 350): T {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])
  return settled
}

export function WelcomeScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const session = useSessionState()
  const recordConsent = useMutation(api.modules.people.consents.recordConsent)
  const publishMyProfile = useMutation(api.modules.people.profile.publishMyProfile)
  const joinNetwork = useMutation(api.modules.people.memberships.joinNetwork)

  const schema = z.object({
    displayName: z.string().trim().min(1, t("rules:DISPLAY_NAME_LENGTH", { min: 1, max: DISPLAY_NAME_MAX_LENGTH })).max(DISPLAY_NAME_MAX_LENGTH, t("rules:DISPLAY_NAME_LENGTH", { min: 1, max: DISPLAY_NAME_MAX_LENGTH })),
    handle: z
      .string()
      .trim()
      .toLowerCase()
      .min(HANDLE_MIN_LENGTH, t("rules:HANDLE_LENGTH", { min: HANDLE_MIN_LENGTH, max: HANDLE_MAX_LENGTH }))
      .max(HANDLE_MAX_LENGTH, t("rules:HANDLE_LENGTH", { min: HANDLE_MIN_LENGTH, max: HANDLE_MAX_LENGTH }))
      .regex(/^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/, t("rules:HANDLE_CHARSET")),
    consent: z.boolean().refine((value) => value, t("antia:welcome.consentRequired")),
  })
  type Values = z.infer<typeof schema>
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { displayName: "", handle: "", consent: false } })

  const person = session.status === "welcome" ? session.person : null
  const consentInForce = person?.consentsInForce.includes("social_profile") ?? false
  useEffect(() => {
    if (person?.displayName && !form.getValues("displayName")) form.setValue("displayName", person.displayName)
    if (person?.handle && !form.getValues("handle")) form.setValue("handle", person.handle)
    // Un consentement déjà en vigueur ne se redemande pas : la case n'est pas affichée.
    if (consentInForce) form.setValue("consent", true)
  }, [person?.displayName, person?.handle, consentInForce, form])

  useEffect(() => {
    if (session.status === "signedOut") router.replace(routes.signIn())
    else if (session.status === "member") router.replace(routes.feed())
  }, [session.status, router])

  const displayName = useSettled(useWatch({ control: form.control, name: "displayName" }))
  const suggestions = useQuery(
    api.modules.people.profile.suggestHandles,
    session.status === "welcome" && session.person && displayName.trim().length >= 2 ? { displayName } : "skip",
  )

  if (session.status === "rootMissing") return <CenteredStatus label={t("antia:session.backendMissing")} />
  if (session.status !== "welcome" || !session.person) return <CenteredStatus label={t("antia:session.checking")} />
  const { root } = session
  const consentGiven = session.person.consentsInForce.includes("social_profile")

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      if (!consentGiven) await recordConsent({ purpose: "social_profile", origin: "onboarding" })
      await publishMyProfile({ handle: values.handle, displayName: values.displayName })
      await joinNetwork({ networkId: root._id })
      toast.success(t("antia:welcome.done", { name: values.displayName.trim() }))
      router.replace(routes.feed())
    } catch (error) {
      toast.error(engineErrorMessage(error, t))
    }
  })

  const errors = form.formState.errors
  return (
    <main id="contenu" className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center gap-6 px-5 py-12">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl">{t("antia:welcome.title")}</h1>
        <p className="text-muted-foreground">{t("antia:welcome.lead")}</p>
      </header>
      <Card>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
          <Field id="displayName" label={t("antia:welcome.displayNameLabel")} hint={t("antia:welcome.displayNameHint")} error={errors.displayName?.message}>
            <TextInput
              id="displayName"
              autoComplete="name"
              maxLength={DISPLAY_NAME_MAX_LENGTH}
              aria-invalid={errors.displayName ? true : undefined}
              aria-describedby={errors.displayName ? "displayName-error" : "displayName-hint"}
              {...form.register("displayName")}
            />
          </Field>

          <Field id="handle" label={t("antia:welcome.handleLabel")} hint={t("antia:welcome.handleHint")} error={errors.handle?.message}>
            <div className="relative">
              <AtSign aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <TextInput
                id="handle"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                maxLength={HANDLE_MAX_LENGTH}
                className="pl-9"
                aria-invalid={errors.handle ? true : undefined}
                aria-describedby={errors.handle ? "handle-error" : "handle-hint"}
                {...form.register("handle")}
              />
            </div>
          </Field>

          {suggestions && suggestions.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">{t("antia:welcome.suggestions")}</span>
              {suggestions.map((suggestion) =>
                suggestion.available ? (
                  <button
                    key={suggestion.handle}
                    type="button"
                    onClick={() => form.setValue("handle", suggestion.handle, { shouldValidate: true })}
                    className="rounded-full border border-border bg-background px-3 py-1 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    @{suggestion.handle}
                  </button>
                ) : (
                  <span key={suggestion.handle} className="rounded-full px-3 py-1 text-muted-foreground line-through">
                    {t("antia:welcome.taken", { handle: `@${suggestion.handle}` })}
                  </span>
                ),
              )}
            </div>
          ) : null}

          {consentGiven ? null : (
            <div className="flex flex-col gap-1.5">
              <label className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5 size-5 shrink-0 accent-primary"
                  aria-invalid={errors.consent ? true : undefined}
                  {...form.register("consent")}
                />
                <span>{t("antia:welcome.consentLabel")}</span>
              </label>
              {errors.consent ? (
                <p role="alert" className="text-sm text-destructive">
                  {errors.consent.message}
                </p>
              ) : null}
            </div>
          )}

          <Button type="submit" pending={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? t("antia:welcome.submitting") : t("antia:welcome.submit")}
          </Button>
        </form>
      </Card>
    </main>
  )
}
