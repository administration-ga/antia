import { useEffect, useId, useMemo, useRef, useState } from "react"
import { Linking, Pressable, Text, TextInput, View } from "react-native"
import { useQuery } from "convex/react"
import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { api } from "@antsia/api/engine"
import { nativeRequest } from "@antsia/social-native/request"
import { BRAND_NAME } from "@antsia/social-contracts/brand"
import { useNativeAppearance } from "../appearance"
import { nativeFieldLabel } from "../lib/accessibility"
import { nativeWebRoutes } from "../lib/routes"
import type { NativeSessionController } from "../lib/session-controller"

const codeSchema = z.object({ code: z.string().regex(/^\d{6}$/) })
export function NativeEntry({ controller, webUrl, scheme }: { controller: NativeSessionController; webUrl: string; scheme: string | null }) {
  const { t, tokens } = useNativeAppearance()
  const available = useQuery(api.modules.platform.authentication.configuration, {})
  const [channel, setChannel] = useState<"email" | "phone">("email")
  const [destination, setDestination] = useState<string | null>(null)
  const [otpBusy, setBusy] = useState(false)
  const busy = otpBusy || controller.idnBusy
  const [error, setError] = useState(false)
  const entryId = useId()
  const alive = useRef(true)
  const pending = useRef(false)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  const schema = useMemo(() => z.object({ identifier: channel === "email" ? z.string().trim().email().max(254) : z.string().trim().regex(/^\+[1-9]\d{7,14}$/) }), [channel])
  const contact = useForm<{ identifier: string }>({ resolver: zodResolver(schema), defaultValues: { identifier: "" } })
  const code = useForm<z.infer<typeof codeSchema>>({ resolver: zodResolver(codeSchema), defaultValues: { code: "" } })
  const send = contact.handleSubmit(async ({ identifier }) => {
    if (controller.idnBusy || pending.current || !available || !(channel === "email" ? available.emailOtp : available.smsOtp)) return
    pending.current = true; setBusy(true); setError(false)
    try {
      const response = channel === "email"
        ? await nativeRequest((signal) => controller.auth.emailOtp.sendVerificationOtp({ email: identifier, type: "sign-in", fetchOptions: { signal, headers: { "Accept-Language": t("mobile.locale") }, throw: false } }))
        : await nativeRequest((signal) => controller.auth.phoneNumber.sendOtp({ phoneNumber: identifier, fetchOptions: { signal, headers: { "Accept-Language": t("mobile.locale") }, throw: false } }))
      if (!alive.current) return
      if (response.error) { setError(true); return }
      setDestination(identifier)
    } catch { if (alive.current) setError(true) }
    finally { pending.current = false; if (alive.current) setBusy(false) }
  })
  const verify = code.handleSubmit(async ({ code: otp }) => {
    if (controller.idnBusy || pending.current || !destination) return
    pending.current = true; setBusy(true); setError(false)
    const generation = controller.vault.beginLogin()
    try {
      const response = channel === "email"
        ? await nativeRequest((signal) => controller.auth.signIn.emailOtp({ email: destination, otp, fetchOptions: { signal, throw: false } }))
        : await nativeRequest((signal) => controller.auth.phoneNumber.verify({ phoneNumber: destination, code: otp, fetchOptions: { signal, throw: false } }))
      if (!alive.current) return
      if (controller.vault.generation !== generation) { if (!controller.vault.hasCredential) setError(true); return }
      if (response.error || !controller.vault.hasCredential) { controller.vault.fence(); setError(true); return }
      code.reset()
      await controller.resume()
    } catch { if (alive.current) { if (controller.vault.generation === generation) controller.vault.fence(); setError(true) } }
    finally { pending.current = false; if (alive.current) setBusy(false) }
  })
  const contactError = contact.formState.errors.identifier ? t("mobile.entry.invalidContact") : undefined
  const codeError = code.formState.errors.code ? t("mobile.entry.invalidCode") : undefined
  const channelReady = available && (channel === "email" ? available.emailOtp : available.smsOtp)
  const button = { backgroundColor: tokens.primary, borderRadius: tokens.radiusField, padding: 14, minHeight: 48, alignItems: "center" as const }
  return <View style={{ gap: 18, padding: 20, backgroundColor: tokens.background }}>
    <Text accessibilityRole="header" style={{ color: tokens.foreground, fontSize: 30, fontWeight: "700" }}>{BRAND_NAME}</Text>
    <Text style={{ color: tokens.foreground }}>{t("mobile.entry.welcome")}</Text>
    <Text style={{ color: tokens.mutedForeground }}>{t("mobile.entry.idnPending")}</Text>
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy || !available?.idn || !scheme, busy: controller.idnBusy }} disabled={busy || !available?.idn || !scheme} style={button} onPress={() => {
      if (pending.current || !scheme) return
      pending.current = true
      void controller.signInIdn({ scheme, webUrl }).finally(() => { pending.current = false })
    }}>
      <Text style={{ color: tokens.primaryOn }}>{t("mobile.entry.webIdn")}</Text>
    </Pressable>
    <Text style={{ color: tokens.mutedForeground }}>{t("mobile.entry.webSeparate")}</Text>
    <Pressable accessibilityRole="link" disabled={busy} onPress={() => { void Linking.openURL(nativeWebRoutes.enter(webUrl)).catch(() => { if (alive.current) setError(true) }) }} style={{ minHeight: 48, padding: 12 }}><Text style={{ color: tokens.primary }}>{t("mobile.entry.webRegistration")}</Text></Pressable>
    {destination === null ? <>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
        {(["email", "phone"] as const).map((value) => <Pressable accessibilityRole="radio" accessibilityState={{ checked: channel === value, disabled: busy }} disabled={busy} key={value} onPress={() => { setChannel(value); contact.reset(); setError(false) }} style={{ minHeight: 48, minWidth: 48, padding: 12 }}><Text style={{ color: tokens.primary }}>{t(`mobile.entry.${value}`)}</Text></Pressable>)}
      </View>
      <Text nativeID={entryId + "-contact-label"} style={{ color: tokens.foreground }}>{t(`mobile.entry.${channel}`)}</Text>
      <Controller control={contact.control} name="identifier" render={({ field }) => <TextInput ref={field.ref} nativeID={entryId + "-contact"} accessibilityLabel={nativeFieldLabel(t(`mobile.entry.${channel}`), contactError)} accessibilityLabelledBy={contactError ? [entryId + "-contact-label", entryId + "-contact-error"] : entryId + "-contact-label"} accessibilityState={{ disabled: busy }} value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} editable={!busy} autoCorrect={false} autoCapitalize="none" keyboardType={channel === "email" ? "email-address" : "phone-pad"} textContentType={channel === "email" ? "emailAddress" : "telephoneNumber"} style={{ color: tokens.foreground, borderColor: tokens.input, borderWidth: 1, borderRadius: tokens.radiusField, padding: 14, minHeight: 48 }} />} />
      {contactError ? <Text nativeID={entryId + "-contact-error"} accessibilityRole="alert" style={{ color: tokens.danger }}>{t("mobile.entry.invalidContact")}</Text> : null}
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy || !channelReady, busy }} disabled={busy || !channelReady} style={button} onPress={() => { void send() }}><Text style={{ color: tokens.primaryOn }}>{t("mobile.entry.sendCode")}</Text></Pressable>
      {available && !(channel === "email" ? available.emailOtp : available.smsOtp) ? <Text style={{ color: tokens.mutedForeground }}>{t("mobile.entry.channelUnavailable")}</Text> : null}
    </> : <>
      <Text style={{ color: tokens.foreground }}>{t("mobile.entry.codeSent")}</Text>
      <Text nativeID={entryId + "-code-label"} style={{ color: tokens.foreground }}>{t("mobile.entry.code")}</Text>
      <Controller control={code.control} name="code" render={({ field }) => <TextInput ref={field.ref} nativeID={entryId + "-code"} accessibilityLabel={nativeFieldLabel(t("mobile.entry.code"), codeError)} accessibilityLabelledBy={codeError ? [entryId + "-code-label", entryId + "-code-error"] : entryId + "-code-label"} accessibilityState={{ disabled: busy }} value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} editable={!busy} autoCorrect={false} keyboardType="number-pad" textContentType="oneTimeCode" maxLength={6} style={{ color: tokens.foreground, borderColor: tokens.input, borderWidth: 1, borderRadius: tokens.radiusField, padding: 14, minHeight: 48 }} />} />
      {codeError ? <Text nativeID={entryId + "-code-error"} accessibilityRole="alert" style={{ color: tokens.danger }}>{t("mobile.entry.invalidCode")}</Text> : null}
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy, busy }} disabled={busy} style={button} onPress={() => { void verify() }}><Text style={{ color: tokens.primaryOn }}>{t("mobile.entry.verify")}</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy }} disabled={busy} onPress={() => { controller.vault.fence(); setDestination(null); code.reset(); setError(false) }} style={{ minHeight: 48, minWidth: 48, padding: 12 }}><Text style={{ color: tokens.primary }}>{t("mobile.entry.changeContact")}</Text></Pressable>
    </>}
    {error || controller.idnError ? <Text accessibilityRole="alert" style={{ color: tokens.danger }}>{t("mobile.entry.failed")}</Text> : null}
  </View>
}
