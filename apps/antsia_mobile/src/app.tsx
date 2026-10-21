import { Component, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { ActivityIndicator, BackHandler, Linking, ScrollView, StatusBar, Text, useColorScheme, View } from "react-native"
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context"
import { ConvexProvider, ConvexProviderWithAuth, ConvexReactClient, useConvexAuth, useQuery } from "convex/react"
import { ConvexHttpClient } from "convex/browser"
import { api, type Id } from "@antsia/api/engine"
import { MEMBER_THEME_IDS, memberThemeOf } from "@antsia/social-contracts/appearance"
import { nativeEnvironment, type NativeEnvironment } from "@antsia/social-native/environment"
import { nativeRequest } from "@antsia/social-native/request"
import { NativeAppearanceProvider, useNativeAppearance } from "./appearance"
import { NativeEntry } from "./components/entry"
import { Action, Card, Label, Status as NativeStatusText } from "./components/ui"
import { NativeRuntimeProvider } from "./runtime"
import { nativeRouteFromUrl, nativeWebRoutes, type NativeRoute } from "./lib/routes"
import { useNativeSessionController, type NativeSessionController } from "./lib/session-controller"
import { FeedScreen } from "./screens/feed-screen"
import { PostScreen } from "./screens/post-screen"
import { MessagesScreen } from "./screens/messages-screen"
import { ConversationScreen } from "./screens/conversation-screen"
import { NativeCallProvider, useNativeCalls } from "./calls/native-call-provider"
import type { NativeCallAuthority } from "./calls/types"

type MemberCallContext = { networkId: Id<"networks">; personId: Id<"persons">; sessionId: string }

// Expo ne substitue que les accès EXPO_PUBLIC littéraux. Aucun secret ni déploiement par défaut.
const environment = nativeEnvironment({
  convexUrl: process.env.EXPO_PUBLIC_CONVEX_URL,
  authUrl: process.env.EXPO_PUBLIC_CONVEX_SITE_URL,
  webUrl: process.env.EXPO_PUBLIC_SITE_URL,
  scheme: process.env.EXPO_PUBLIC_NATIVE_SCHEME,
  development: __DEV__,
  allowLocalHttp: process.env.EXPO_PUBLIC_ALLOW_LOCAL_HTTP,
})

function Status({ message, action, onPress }: { message: string; action?: string; onPress?: () => void }) {
  const { tokens } = useNativeAppearance()
  const actionable = !!action && !!onPress
  return <ScrollView style={{ flex: 1, backgroundColor: tokens.background }} contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 24, gap: 16 }}>
    <NativeStatusText label={message} busy={!actionable} error={actionable} />
    {action && onPress ? <Action label={action} onPress={onPress} /> : <ActivityIndicator accessible={false} color={tokens.primary} />}
  </ScrollView>
}
class NativeBoundary extends Component<{ children: ReactNode; onFailure: () => void; fallback: ReactNode }, { failed: boolean }> {
  override state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  override componentDidCatch() { this.props.onFailure() }
  override render() { return this.state.failed ? this.props.fallback : this.props.children }
}

function AnonymousTransport({ controller, env }: { controller: NativeSessionController; env: NativeEnvironment }) {
  const [client] = useState(() => new ConvexReactClient(env.convexUrl, { unsavedChangesWarning: false }))
  useEffect(() => () => { void client.close() }, [client])
  return <ConvexProvider client={client}><ScrollView keyboardShouldPersistTaps="handled"><NativeEntry controller={controller} webUrl={env.webUrl} /></ScrollView></ConvexProvider>
}

function MemberTransport({ controller, env, onMemberConfirmed }: { controller: NativeSessionController; env: NativeEnvironment; onMemberConfirmed: (member: MemberCallContext) => void }) {
  const [client] = useState(() => new ConvexReactClient(env.convexUrl, { unsavedChangesWarning: false }))
  const id = controller.session!.id, generation = controller.vault.generation
  const fetchAccessToken = useCallback(async () => {
    if (!controller.sessionIsCurrent(id, generation)) return null
    try {
      const response = await nativeRequest((signal) => controller.auth.convex.token({ fetchOptions: { signal, throw: false } }))
      if (!controller.sessionIsCurrent(id, generation)) return null
      if (response.error || !response.data?.token) { controller.blocked(); return null }
      return response.data.token
    } catch { if (controller.sessionIsCurrent(id, generation)) controller.blocked(); return null }
  }, [controller.auth, controller.blocked, controller.sessionIsCurrent, generation, id])
  const useAuth = useCallback(() => ({ isLoading: false, isAuthenticated: true, fetchAccessToken }), [fetchAccessToken])
  useEffect(() => () => { client.clearAuth(); void client.close() }, [client])
  return <ConvexProviderWithAuth client={client} useAuth={useAuth}><MemberGate controller={controller} client={client} env={env} onMemberConfirmed={onMemberConfirmed} /></ConvexProviderWithAuth>
}

function MemberGate({ controller, client, env, onMemberConfirmed }: { controller: NativeSessionController; client: ConvexReactClient; env: NativeEnvironment; onMemberConfirmed: (member: MemberCallContext) => void }) {
  const { isLoading, isAuthenticated } = useConvexAuth(), { t, setTheme, setLocale } = useNativeAppearance()
  const live = useQuery(api.modules.platform.authentication.mySession, !isLoading && isAuthenticated ? {} : "skip")
  const network = useQuery(api.modules.networks.networks.getBySlug, live === true ? { slug: "antsia" } : "skip")
  const person = useQuery(api.modules.people.persons.getMyPerson, live === true ? {} : "skip")
  const memberships = useQuery(api.modules.people.memberships.myMemberships, live === true && person ? {} : "skip")
  const [online, setOnline] = useState(client.connectionState().isWebSocketConnected)
  const [connectionReady, setConnectionReady] = useState(false)
  const membership = memberships?.find((item) => item.networkId === network?._id)
  useEffect(() => client.subscribeToConnectionState((state) => setOnline(state.isWebSocketConnected)), [client])
  useEffect(() => {
    // Le cache WebSocket ne prouve pas la fraîcheur après une coupure.
    // Ce contrôle fait partie du comportement de l'app ; aucune requête n'est exécutée pendant l'implémentation.
    setConnectionReady(false)
    if (!online || live !== true || !network || !person || !controller.session) return
    let cancelled = false
    const sessionId = controller.session.id, generation = controller.vault.generation
    const current = () => !cancelled && controller.sessionIsCurrent(sessionId, generation)
    void (async () => {
      const actual = await nativeRequest((signal) => controller.auth.getSession({ query: { disableCookieCache: true }, fetchOptions: { signal, throw: false } }))
      if (!current()) return
      if (actual.error) throw new Error("nativeSessionUnavailable")
      if (actual.data?.session.id !== sessionId) { controller.revoked(); return }
      const proof = await nativeRequest((signal) => controller.auth.convex.token({ fetchOptions: { signal, throw: false } }))
      if (!current()) return
      if (proof.error || !proof.data?.token) throw new Error("nativeSessionUnavailable")
      const fresh = new ConvexHttpClient(env.convexUrl)
      fresh.setAuth(proof.data.token)
      const rows = await nativeRequest(() => fresh.query(api.modules.people.memberships.myMemberships, {}))
      if (!current()) return
      const membership = rows.find((row) => row.networkId === network._id)
      if (!membership || membership.status === "suspendue") throw new Error("nativeMembershipUnavailable")
      setConnectionReady(true)
    })().catch(() => { if (current()) controller.blocked() })
    return () => { cancelled = true }
  }, [online, live, network?._id, person?._id, controller.session?.id, controller.auth, controller.blocked, controller.revoked, controller.sessionIsCurrent, controller.vault, env.convexUrl])
  useEffect(() => {
    if (live === false) controller.revoked()
  }, [live, controller.revoked])
  useEffect(() => {
    if (live === true && connectionReady && network && person && membership && membership.status !== "suspendue" && controller.session) {
      onMemberConfirmed({ networkId: network._id, personId: person._id, sessionId: controller.session.id })
    }
  }, [live, connectionReady, network?._id, person?._id, membership?.status, controller.session?.id, onMemberConfirmed])
  useEffect(() => {
    if (live === true && network !== undefined && person !== undefined && (!person || memberships !== undefined)) return
    const timer = setTimeout(controller.blocked, 12_000)
    return () => clearTimeout(timer)
  }, [controller.blocked, live, network, person, memberships])
  useEffect(() => {
    if (!person) return
    const theme = memberThemeOf(person.theme)
    if (theme) setTheme(theme)
    if (person.locale === "fr" || person.locale === "en") setLocale(person.locale)
  }, [person?.theme, person?.locale, setTheme, setLocale])
  if (live !== true || network === undefined || person === undefined || (person && memberships === undefined)) return <Status message={t("mobile.session.preparing")} />
  // Aucune personne, adhésion ni donnée civile créée depuis le client natif.
  if (!network || !person || !membership || membership.status === "suspendue") return <View style={{ flex: 1 }}><Status message={t("mobile.session.membershipRequired")} action={t("mobile.entry.webIdn")} onPress={() => { void Linking.openURL(nativeWebRoutes.enter(env.webUrl)).catch(controller.blocked) }} /><Action label={t("mobile.session.signOut")} onPress={() => { void controller.exit() }} /></View>
  return <ReadyMember key={`${person._id}:${controller.session!.id}`} networkId={network._id} personId={person._id} handle={person.handle} canWrite={membership.status !== "en_attente"} controller={controller} online={online} connectionReady={connectionReady} env={env} />
}

function ReadyMember({ networkId, personId, handle, canWrite, controller, online, connectionReady, env }: {
  networkId: Id<"networks">; personId: Id<"persons">; handle?: string; canWrite: boolean
  controller: NativeSessionController; online: boolean; connectionReady: boolean; env: NativeEnvironment
}) {
  const { t, tokens } = useNativeAppearance()
  const [route, setRoute] = useState<NativeRoute>({ name: "feed" })
  const id = controller.session!.id, generation = controller.vault.generation, epoch = controller.lifecycle.epoch
  const active = useRef(true)
  const current = useCallback(() => active.current && controller.lifecycle.active && controller.lifecycle.epoch === epoch && controller.sessionIsCurrent(id, generation), [controller.lifecycle, controller.sessionIsCurrent, epoch, id, generation])
  const registerCleanup = useCallback((cleanup: () => void | Promise<void>) => controller.lifecycle.register(cleanup), [controller.lifecycle])
  useEffect(() => {
    active.current = true
    controller.lifecycle.activate()
    return () => { active.current = false; controller.lifecycle.invalidate(); void controller.lifecycle.stopResources() }
  }, [controller.lifecycle])
  useEffect(() => {
    // Aucun lien conservé entre deux sujets ; les écrans relisent toutes les gardes serveur.
    const listener = Linking.addEventListener("url", ({ url }) => {
      const next = nativeRouteFromUrl(url, env.scheme)
      if (next && current()) setRoute(next)
    })
    return () => listener.remove()
  }, [current, env.scheme])
  useEffect(() => {
    const listener = BackHandler.addEventListener("hardwareBackPress", () => {
      if (route.name === "feed") return false
      setRoute(route.name === "conversation" ? { name: "messages" } : { name: "feed" })
      return true
    })
    return () => listener.remove()
  }, [route.name])
  const runtime = useMemo(() => ({ networkId, personId, sessionId: id, epoch, foreground: true, online, ready: online && connectionReady, canWrite, isCurrent: current, registerCleanup }), [networkId, personId, id, epoch, online, connectionReady, canWrite, current, registerCleanup])
  const activeTab = route.name === "post" ? "feed" : route.name === "conversation" ? "messages" : route.name
  const navigate = (next: NativeRoute) => { if (current()) setRoute(next) }
  return <NativeRuntimeProvider value={runtime}><View style={{ flex: 1, backgroundColor: tokens.background }}>
    {route.name === "post" || route.name === "conversation" ? <Action label={t("mobile.common.back")} onPress={() => navigate({ name: route.name === "conversation" ? "messages" : "feed" })} /> : null}
    <View style={{ flex: 1 }}>
      {route.name === "feed" ? <FeedScreen onOpenPost={(postId) => navigate({ name: "post", id: postId })} /> : null}
      {route.name === "post" ? <PostScreen key={route.id} postId={route.id as Id<"posts">} /> : null}
      {route.name === "messages" ? <MessagesScreen onOpenThread={(threadId) => navigate({ name: "conversation", id: threadId })} /> : null}
      {route.name === "conversation" ? <ConversationScreen key={route.id} threadId={route.id as Id<"personalThreads">} /> : null}
      {route.name === "settings" ? <NativeSettings handle={handle} controller={controller} webUrl={env.webUrl} /> : null}
    </View>
    {!online ? <Label muted>{t("mobile.common.offline")}</Label> : null}
    <View accessibilityRole="tablist" style={{ flexDirection: "row", gap: 8, padding: 8, backgroundColor: tokens.card }}>
      {(["feed", "messages", "settings"] as const).map((name) => <View key={name} style={{ flex: 1, minWidth: 0 }}><Action accessibilityRole="tab" selected={activeTab === name} label={t(`mobile.nav.${name}`)} tone={activeTab === name ? "primary" : "neutral"} onPress={() => navigate({ name })} /></View>)}
    </View>
  </View></NativeRuntimeProvider>
}

function NativeSettings({ handle, controller, webUrl }: { handle?: string; controller: NativeSessionController; webUrl: string }) {
  const { t, theme, setTheme, mode, setMode, locale, setLocale } = useNativeAppearance()
  const calls = useNativeCalls()
  return <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}><Card>
    <Label strong>{t("mobile.settings.title")}</Label>
    {handle ? <Action label={t("mobile.settings.profile")} onPress={() => { void Linking.openURL(nativeWebRoutes.profile(webUrl, handle)).catch(controller.blocked) }} /> : null}
    <Label>{t("mobile.settings.deviceAppearance")}</Label>
    <Label strong>{t("mobile.settings.mode")}</Label>
    <View style={{ gap: 8 }}>
      {(["system", "light", "dark"] as const).map((value) => <Action key={value} accessibilityRole="radio" checked={mode === value} tone={mode === value ? "primary" : "neutral"} label={t(`mobile.settings.${value}`)} onPress={() => setMode(value)} />)}
    </View>
    <Label strong>{t("mobile.settings.theme")}</Label>
    <View style={{ gap: 8 }}>
      {MEMBER_THEME_IDS.map((value) => <Action key={value} accessibilityRole="radio" checked={theme === value} label={t(`mobile.theme.${value}`)} tone={theme === value ? "primary" : "neutral"} onPress={() => setTheme(value)} />)}
    </View>
    <Action label={t(locale === "fr" ? "mobile.settings.english" : "mobile.settings.french")} onPress={() => setLocale(locale === "fr" ? "en" : "fr")} />
    <Label muted>{t("mobile.settings.nativeCallsPending")}</Label>
    <Action label={t(calls.systemEnabled ? "mobile.calls.systemEnabled" : "mobile.calls.enableSystem")} disabled={!calls.available || calls.busy || calls.systemEnabled} onPress={() => { void calls.enableSystemCalls() }} />
    <Label muted>{t("mobile.settings.commerceClosed")}</Label>
    <Action label={t("mobile.session.signOut")} tone="danger" onPress={() => { void controller.exit() }} />
  </Card></ScrollView>
}

function ConfiguredApp({ env }: { env: NativeEnvironment }) {
  const controller = useNativeSessionController(env.authUrl), { t } = useNativeAppearance()
  const [member, setMember] = useState<MemberCallContext | null>(null)
  const onMemberConfirmed = useCallback((next: MemberCallContext) => {
    if (!controller.callSessionIsCurrent(next.sessionId)) return
    setMember((previous) => previous?.networkId === next.networkId && previous.personId === next.personId && previous.sessionId === next.sessionId ? previous : next)
  }, [controller.callSessionIsCurrent])
  useEffect(() => { if (!controller.callSession) setMember(null) }, [controller.callSession])
  const id = controller.callSession?.id
  const authority = useMemo<NativeCallAuthority | null>(() => member && id && member.sessionId === id && controller.callSession ? {
    networkId: member.networkId, personId: member.personId, sessionId: id,
    expiresAt: controller.callSession.expiresAt, foreground: controller.foreground,
    auth: controller.auth, isCurrent: () => controller.callSessionIsCurrent(id),
  } : null, [member, id, controller.callSession?.expiresAt, controller.foreground, controller.auth, controller.callSessionIsCurrent])
  const retry = () => { void controller.resume() }
  let content: ReactNode
  if (controller.phase === "ready" && controller.session) content = <NativeBoundary key={controller.transportKey} onFailure={controller.blocked} fallback={<Status message={t("mobile.session.unavailable")} action={t("mobile.common.retry")} onPress={retry} />}><MemberTransport controller={controller} env={env} onMemberConfirmed={onMemberConfirmed} /></NativeBoundary>
  else if (controller.phase === "anonymous") content = <NativeBoundary onFailure={controller.blocked} fallback={<Status message={t("mobile.session.unavailable")} action={t("mobile.common.retry")} onPress={retry} />}><View style={{ flex: 1 }}>
    {controller.exitResult && (!controller.exitResult.serverRevoked || !controller.exitResult.localCleared) ? <Label>{t("mobile.session.exitIncomplete")}</Label> : null}
    <AnonymousTransport controller={controller} env={env} />
  </View></NativeBoundary>
  else if (controller.phase === "purgeFailed") content = <Status message={t("mobile.session.purgeFailed")} action={t("mobile.session.retryPurge")} onPress={() => { void controller.exit() }} />
  else if (controller.phase === "failure") content = <View style={{ flex: 1 }}><Status message={t("mobile.session.unavailable")} action={t("mobile.common.retry")} onPress={retry} /><Action label={t("mobile.session.signOut")} onPress={() => { void controller.exit() }} /></View>
  else content = <Status message={t(controller.phase === "exiting" ? "mobile.session.exiting" : controller.phase === "background" ? "mobile.common.background" : "mobile.session.preparing")} />
  // Aucune clé liée à une route, un thème ou à l'époque privée de l'écran.
  return <NativeCallProvider authority={authority} registerSessionCleanup={controller.registerSessionCleanup} env={env}>{content}</NativeCallProvider>
}
function RootContent() {
  const { t, tokens, mode, locale } = useNativeAppearance(), system = useColorScheme()
  const dark = (mode === "system" ? system : mode) === "dark"
  return <SafeAreaView accessibilityLanguage={locale === "fr" ? "fr-FR" : "en-GB"} style={{ flex: 1, backgroundColor: tokens.background }}><StatusBar barStyle={dark ? "light-content" : "dark-content"} />{environment ? <ConfiguredApp env={environment} /> : <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24, justifyContent: "center" }}><Text accessibilityRole="alert" style={{ color: tokens.foreground }}>{t("mobile.configuration.missing")}</Text></ScrollView>}</SafeAreaView>
}
export default function App() {
  return <SafeAreaProvider><NativeAppearanceProvider><RootContent /></NativeAppearanceProvider></SafeAreaProvider>
}
