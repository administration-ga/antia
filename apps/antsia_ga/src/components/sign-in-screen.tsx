"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { api } from "@convex/_generated/api"
import { useQuery } from "convex/react"
import { KeyRound, Mail } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { z } from "zod"

import { Button, Card, CenteredStatus, Field, TextInput } from "@/components/shared/controls"
import { useSessionState } from "@/components/use-session-state"
import { authClient } from "@/lib/auth-client"
import { routes } from "@/lib/routes"

type AuthError = { code?: string; status?: number } | null | undefined

/** Le texte d'un refus de Better Auth (codes du greffon emailOTP ou du moteur), traduit. */
function useAuthErrorMessage() {
  const { t } = useTranslation()
  return (error: AuthError): string => {
    switch (error?.code) {
      case "rateLimited":
        return t("errors:rateLimited")
      case "otpDeliveryUnavailable":
        return t("antsia:signIn.errors.deliveryUnavailable")
      case "INVALID_OTP":
        return t("antsia:signIn.errors.invalidCode")
      case "OTP_EXPIRED":
        return t("antsia:signIn.errors.expiredCode")
      case "TOO_MANY_ATTEMPTS":
        return t("antsia:signIn.errors.tooManyAttempts")
      default:
        return error?.status === 429 ? t("errors:rateLimited") : t("antsia:errors.generic")
    }
  }
}

/** Le code de développement local, lu seulement quand le moteur l'expose (jamais en production). */
function DevCodeHint({ email }: { email: string }) {
  const { t } = useTranslation("antsia")
  const latest = useQuery(api.modules.platform.devTools.latestOtp, { email })
  if (!latest) return null
  return (
    <div className="rounded-lg border border-dashed border-border bg-muted px-4 py-3 text-sm">
      <p className="font-mono text-base text-foreground">{t("signIn.devCode", { code: latest.code })}</p>
      <p className="text-xs text-muted-foreground">{t("signIn.devCodeHint")}</p>
    </div>
  )
}

export function SignInScreen() {
  const { t } = useTranslation("antsia")
  const router = useRouter()
  const session = useSessionState()
  const authErrorMessage = useAuthErrorMessage()
  const [email, setEmail] = useState<string | null>(null)

  const emailSchema = z.object({ email: z.string().trim().email(t("signIn.errors.invalidEmail")) })
  const codeSchema = z.object({ otp: z.string().trim().regex(/^\d{6}$/, t("signIn.errors.codeFormat")) })
  const emailForm = useForm<z.infer<typeof emailSchema>>({ resolver: zodResolver(emailSchema), defaultValues: { email: "" } })
  const codeForm = useForm<z.infer<typeof codeSchema>>({ resolver: zodResolver(codeSchema), defaultValues: { otp: "" } })

  useEffect(() => {
    if (session.status === "member") router.replace(routes.feed())
    else if (session.status === "welcome") router.replace(routes.welcome())
  }, [session.status, router])

  if (session.status === "loading" || session.status === "member" || session.status === "welcome") {
    return <CenteredStatus label={t("session.checking")} />
  }

  async function sendCode(address: string): Promise<boolean> {
    const result = await authClient.emailOtp.sendVerificationOtp({ email: address, type: "sign-in" })
    if (result.error) {
      toast.error(authErrorMessage(result.error))
      return false
    }
    return true
  }

  const onEmail = emailForm.handleSubmit(async ({ email: address }) => {
    const normalized = address.trim().toLowerCase()
    if (await sendCode(normalized)) setEmail(normalized)
  })

  const onCode = codeForm.handleSubmit(async ({ otp }) => {
    if (!email) return
    const result = await authClient.signIn.emailOtp({ email, otp: otp.trim() })
    if (result.error) {
      codeForm.setError("otp", { message: authErrorMessage(result.error) })
      return
    }
    // Rechargement complet : la session amorce proprement le jeton Convex de la personne qui arrive.
    window.location.assign(routes.welcome())
  })

  return (
    <main id="contenu" className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-5 py-12">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl">{email ? t("signIn.codeTitle") : t("signIn.title")}</h1>
        <p className="text-muted-foreground">{email ? t("signIn.codeLead", { email }) : t("signIn.lead")}</p>
      </header>

      <Card>
        {email ? (
          <form onSubmit={onCode} noValidate className="flex flex-col gap-4">
            <Field id="otp" label={t("signIn.codeLabel")} error={codeForm.formState.errors.otp?.message}>
              <TextInput
                id="otp"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                autoFocus
                aria-invalid={codeForm.formState.errors.otp ? true : undefined}
                aria-describedby={codeForm.formState.errors.otp ? "otp-error" : undefined}
                className="font-mono text-lg tracking-[0.4em]"
                {...codeForm.register("otp")}
              />
            </Field>
            <DevCodeHint email={email} />
            <Button type="submit" pending={codeForm.formState.isSubmitting}>
              <KeyRound aria-hidden="true" className="size-4" />
              {codeForm.formState.isSubmitting ? t("signIn.verifying") : t("signIn.verify")}
            </Button>
            <div className="flex flex-wrap justify-between gap-2">
              <Button type="button" variant="ghost" onClick={() => setEmail(null)}>
                {t("signIn.changeEmail")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={async () => {
                  if (await sendCode(email)) toast.success(t("signIn.resent"))
                }}
              >
                {t("signIn.resend")}
              </Button>
            </div>
          </form>
        ) : (
          <form onSubmit={onEmail} noValidate className="flex flex-col gap-4">
            <Field id="email" label={t("signIn.emailLabel")} error={emailForm.formState.errors.email?.message}>
              <TextInput
                id="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                placeholder={t("signIn.emailPlaceholder")}
                aria-invalid={emailForm.formState.errors.email ? true : undefined}
                aria-describedby={emailForm.formState.errors.email ? "email-error" : undefined}
                {...emailForm.register("email")}
              />
            </Field>
            <Button type="submit" pending={emailForm.formState.isSubmitting}>
              <Mail aria-hidden="true" className="size-4" />
              {emailForm.formState.isSubmitting ? t("signIn.sending") : t("signIn.sendCode")}
            </Button>
          </form>
        )}
      </Card>
    </main>
  )
}
