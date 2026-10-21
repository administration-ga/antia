"use client"
import { useViewerTimeZone } from "@antsia/api/viewer-preferences"

import { DISPLAY_NAME_MAX_LENGTH, HANDLE_MAX_LENGTH, HANDLE_MIN_LENGTH } from "@antsia/social-domain/content"
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
import { useOnboardingUsage } from "./analytics-permission"
import { engineErrorMessage } from "@/lib/engine-errors"
import { parseShopContactContinuation, type ShopContactContinuation } from "@/lib/shop-contact-continuation"
import { parsePublicPostContinuation } from "@/lib/public-post-continuation"
import { parseNotificationReference } from "@/lib/notification-open"
import { parseSpecializedDestination, type SpecializedDestination } from "@/lib/specialized-navigation"
import { routes, specializedDestinationPath } from "@/lib/routes"
import { signOutAndRedirect } from "@/lib/sign-out"

/** La valeur, une fois que la saisie s'est calmée (évite une requête par frappe). */
function useSettled<T>(value: T, delayMs = 350): T {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])
  return settled
}

export function WelcomeScreen({ publicPostId, notificationReference, shopContact, specializedDestination }: { publicPostId?: string; notificationReference?: string; shopContact?: ShopContactContinuation; specializedDestination?: SpecializedDestination } = {}) {
  const { t, i18n } = useTranslation()
  const router = useRouter()
  const [signingOut, setSigningOut] = useState(false)
  const session = useSessionState()
  const usagePerson = session.status === "welcome" || session.status === "member" ? session.person : null
  const usageConsented = usagePerson?.consentsInForce.includes("usage_analytics") === true
  const captureStep = useOnboardingUsage(usageConsented, session.status === "welcome" || session.status === "member" ? session.root.slug : "", i18n.resolvedLanguage === "en" ? "en" : "fr")
  const canCaptureEntry = session.status === "welcome" && session.person !== null && usageConsented
  useEffect(() => { if (canCaptureEntry) captureStep("entry_started") }, [canCaptureEntry, captureStep])
  const continuationPostId = parsePublicPostContinuation(publicPostId)
  const notification = continuationPostId ? undefined : parseNotificationReference(notificationReference)
  const contact = continuationPostId || notification ? undefined : parseShopContactContinuation(shopContact)
  const space = continuationPostId || notification || contact ? undefined : parseSpecializedDestination(specializedDestination)
  const destination = continuationPostId ? routes.memberPost(continuationPostId) : notification ? routes.openNotification(notification) : contact ? routes.shopContact(contact.handle, contact.offerRef) : specializedDestinationPath(space) ?? routes.feed()
  const signInPath = routes.signIn(undefined, continuationPostId, notification, contact, space)
  const recordConsent = useMutation(api.modules.people.consents.recordConsent)
  const publishMyProfile = useMutation(api.modules.people.profile.publishMyProfile)
  const joinNetwork = useMutation(api.modules.people.memberships.joinNetwork)
  const setPreferences = useMutation(api.modules.people.preferences.setMyPreferences)

  const schema = z.object({
    displayName: z.string().trim().min(1, t("rules:DISPLAY_NAME_LENGTH", { min: 1, max: DISPLAY_NAME_MAX_LENGTH })).max(DISPLAY_NAME_MAX_LENGTH, t("rules:DISPLAY_NAME_LENGTH", { min: 1, max: DISPLAY_NAME_MAX_LENGTH })),
    handle: z
      .string()
      .trim()
      .toLowerCase()
      .min(HANDLE_MIN_LENGTH, t("rules:HANDLE_LENGTH", { min: HANDLE_MIN_LENGTH, max: HANDLE_MAX_LENGTH }))
      .max(HANDLE_MAX_LENGTH, t("rules:HANDLE_LENGTH", { min: HANDLE_MIN_LENGTH, max: HANDLE_MAX_LENGTH }))
      .regex(/^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/, t("rules:HANDLE_CHARSET")),
    consent: z.boolean().refine((value) => value, t("antsia:welcome.consentRequired")),
    locale: z.enum(["fr", "en"]),
    timeZone: z.string().trim().min(1, t("antsia:welcome.invalidTimeZone")).refine((value) => {
      try { new Intl.DateTimeFormat("en", { timeZone: value }).format(); return true } catch { return false }
    }, t("antsia:welcome.invalidTimeZone")),
  })
  type Values = z.infer<typeof schema>
  const viewerTimeZone = useViewerTimeZone()
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { displayName: "", handle: "", consent: false, locale: "fr", timeZone: "UTC" } })

  const person = session.status === "welcome" ? session.person : null
  const consentInForce = person?.consentsInForce.includes("social_profile") ?? false
  useEffect(() => {
    if (person?.displayName && !form.getValues("displayName")) form.setValue("displayName", person.displayName)
    if (person?.handle && !form.getValues("handle")) form.setValue("handle", person.handle)
    if (person?.locale && !form.getFieldState("locale").isDirty) form.setValue("locale", person.locale)
    if (!form.getFieldState("timeZone").isDirty) form.setValue("timeZone", person?.timeZone ?? viewerTimeZone)
    // Un consentement déjà en vigueur ne se redemande pas : la case n'est pas affichée.
    if (consentInForce) form.setValue("consent", true)
  }, [person?.displayName, person?.handle, person?.locale, person?.timeZone, consentInForce, viewerTimeZone, form])

  useEffect(() => {
    if (session.status === "restricted") router.replace(routes.personalControls())
    else if (session.status === "signedOut") router.replace(signInPath)
    else if (session.status === "member") router.replace(destination)
  }, [session.status, destination, signInPath, router])

  const draftDisplayName = useWatch({ control: form.control, name: "displayName" })
  const draftHandle = useWatch({ control: form.control, name: "handle" })
  const displayName = useSettled(draftDisplayName)
  const suggestions = useQuery(
    api.modules.people.profile.suggestHandles,
    session.status === "welcome" && session.person && displayName.trim().length >= 2 ? { displayName } : "skip",
  )

  if (session.status === "rootMissing") return <CenteredStatus label={t("antsia:session.backendMissing")} />
  if (session.status !== "welcome" || !session.person) return <CenteredStatus label={t("antsia:session.checking")} />
  const { root } = session
  const consentGiven = session.person.consentsInForce.includes("social_profile")

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      if (!consentGiven) await recordConsent({ purpose: "social_profile", origin: "onboarding" })
      await setPreferences({ locale: values.locale, timeZone: values.timeZone })
      await publishMyProfile({ handle: values.handle, displayName: values.displayName })
      captureStep("profile_completed")
      await joinNetwork({ networkId: root._id })
      captureStep("membership_joined")
      captureStep("entry_completed")
      toast.success(t("antsia:welcome.done", { name: values.displayName.trim() }))
      router.replace(destination)
    } catch (error) {
      toast.error(engineErrorMessage(error, t))
    }
  })

  const errors = form.formState.errors
  return (
    <main id="contenu" className="mp-page mp-copy mx-auto min-h-dvh w-full max-w-5xl content-center px-4 py-8 sm:px-6 sm:py-12">
      <header className="mp-page-header max-w-2xl">
        <h1 className="mp-title">{t("antsia:welcome.title")}</h1>
        <p className="text-muted-foreground">{t("antsia:welcome.lead")}</p>
        <Button variant="ghost" className="self-start" pending={signingOut} onClick={async () => { setSigningOut(true); await signOutAndRedirect() }}>{t("antsia:nav.signOut")}</Button>
      </header>
      <div className="grid min-w-0 items-start gap-6 min-[960px]:grid-cols-[minmax(0,1fr)_312px]">
        <Card>
          <form onSubmit={onSubmit} noValidate className="mp-form-grid">
            <Field id="displayName" label={t("antsia:welcome.displayNameLabel")} hint={t("antsia:welcome.displayNameHint")} error={errors.displayName?.message}>
              <TextInput
                id="displayName"
                autoComplete="name"
                maxLength={DISPLAY_NAME_MAX_LENGTH}
                aria-invalid={errors.displayName ? true : undefined}
                aria-describedby={errors.displayName ? "displayName-error" : "displayName-hint"}
                {...form.register("displayName")}
              />
            </Field>

            <Field id="handle" label={t("antsia:welcome.handleLabel")} hint={t("antsia:welcome.handleHint")} error={errors.handle?.message}>
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
                <span className="text-muted-foreground">{t("antsia:welcome.suggestions")}</span>
                {suggestions.map((suggestion) =>
                  suggestion.available ? (
                    <button
                      key={suggestion.handle}
                      type="button"
                      onClick={() => form.setValue("handle", suggestion.handle, { shouldValidate: true })}
                      className="min-h-11 rounded-[var(--esp-chip-radius)] border border-transparent bg-muted px-3 py-1 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      @{suggestion.handle}
                    </button>
                  ) : (
                    <span key={suggestion.handle} className="rounded-[var(--esp-chip-radius)] px-3 py-1 text-muted-foreground line-through">
                      {t("antsia:welcome.taken", { handle: `@${suggestion.handle}` })}
                    </span>
                  ),
                )}
              </div>
            ) : null}

            <div className="grid min-w-0 gap-4 sm:grid-cols-2">
              <Field id="locale" label={t("antsia:welcome.localeLabel")}>
                <select id="locale" className="min-h-11 w-full rounded-[var(--esp-field-radius)] border border-input bg-muted px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" {...form.register("locale")}>
                  <option value="fr">{t("antsia:welcome.french")}</option>
                  <option value="en">{t("antsia:welcome.english")}</option>
                </select>
              </Field>
              <Field id="timeZone" label={t("antsia:welcome.timeZoneLabel")} hint={t("antsia:welcome.timeZoneHint")} error={errors.timeZone?.message}>
                <TextInput id="timeZone" aria-invalid={errors.timeZone ? true : undefined} aria-describedby={errors.timeZone ? "timeZone-error" : "timeZone-hint"} {...form.register("timeZone")} />
              </Field>
            </div>
            {consentGiven ? null : (
              <div className="flex flex-col gap-1.5">
                <label className="flex items-start gap-3 text-sm">
                  <input
                    type="checkbox"
                    className="mt-0.5 size-5 shrink-0 accent-primary"
                    aria-invalid={errors.consent ? true : undefined}
                    {...form.register("consent")}
                  />
                  <span>{t("antsia:welcome.consentLabel")}</span>
                </label>
                {errors.consent ? (
                  <p role="alert" className="text-sm text-destructive">
                    {errors.consent.message}
                  </p>
                ) : null}
              </div>
            )}

            <Button type="submit" pending={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? t("antsia:welcome.submitting") : t("antsia:welcome.submit")}
            </Button>
          </form>
        </Card>
        <aside aria-labelledby="welcome-preview-title" className="mp-panel mp-page min-w-0 min-[960px]:sticky min-[960px]:top-6">
          <header className="mp-page-header"><h2 id="welcome-preview-title" className="mp-subtitle">{t("antsia:welcome.previewTitle")}</h2><p className="text-sm text-muted-foreground">{t("antsia:welcome.previewLead")}</p></header>
          <div className="flex min-w-0 items-center gap-3 rounded-[var(--esp-media-radius)] bg-muted p-4">
            <span aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded-full bg-card font-display text-xl font-bold">{draftDisplayName.trim().slice(0, 1) || <AtSign className="size-5" />}</span>
            <div className="min-w-0"><p className="break-words font-semibold">{draftDisplayName.trim() || t("antsia:welcome.displayNameLabel")}</p><p className="break-all text-sm text-muted-foreground">{draftHandle.trim() ? `@${draftHandle.trim()}` : t("antsia:welcome.handleLabel")}</p></div>
          </div>
        </aside>
      </div>
    </main>
  )
}
