import type { ExpoConfig } from "expo/config"

// Identifiants fournis par le propriétaire, jamais empruntés à une autre application.
// Une absence reste une absence ; une valeur fournie invalide bloque la configuration.
function identifier(name: string, pattern: RegExp): string | undefined {
  const value = process.env[name]
  if (value === undefined) return undefined
  if (value.length > 255 || !pattern.test(value)) throw new Error(`Invalid native configuration: ${name}`)
  return value
}

const scheme = identifier("EXPO_PUBLIC_NATIVE_SCHEME", /^[a-z][a-z0-9+.-]*$/)
if (scheme && new Set(["http", "https", "file", "data", "javascript", "exp", "exps"]).has(scheme)) {
  throw new Error("Invalid native configuration: EXPO_PUBLIC_NATIVE_SCHEME")
}
const bundleIdentifier = identifier("NATIVE_IOS_BUNDLE_ID", /^[A-Za-z][A-Za-z0-9-]*(?:\.[A-Za-z0-9-]+)+$/)
const androidPackage = identifier("NATIVE_ANDROID_PACKAGE", /^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)+$/)
const callsSetting = process.env.NATIVE_CALLS_ENABLED
if (callsSetting !== undefined && callsSetting !== "true" && callsSetting !== "false") throw new Error("Invalid native configuration: NATIVE_CALLS_ENABLED")
const nativeCallsEnabled = callsSetting === "true"
if (nativeCallsEnabled && (!scheme || !bundleIdentifier || !androidPackage)) throw new Error("Native calls require explicit native identities")

// Auth et origines Convex restent dans le contrat runtime, aucun secret dans cette configuration.
const config: ExpoConfig = {
  name: "ANTSIA",
  slug: "antsia-mobile",
  version: "0.1.0",
  platforms: ["ios", "android"],
  userInterfaceStyle: "automatic",
  // Expo SDK 57 impose déjà la New Architecture ; aucune option legacy ici.
  ...(scheme ? { scheme } : {}),
  ios: { ...(bundleIdentifier ? { bundleIdentifier } : {}) },
  android: {
    ...(androidPackage ? { package: androidPackage } : {}),
    permissions: [],
    blockedPermissions: ["android.permission.CAMERA", "android.permission.RECORD_AUDIO", "android.permission.POST_NOTIFICATIONS"],
  },
  plugins: [
    ["expo-secure-store", { configureAndroidBackup: true, faceIDPermission: false }],
    ["expo-video", { supportsBackgroundPlayback: false, supportsPictureInPicture: false }],
    ...(nativeCallsEnabled ? ["@livekit/react-native-expo-plugin", "@config-plugins/react-native-webrtc"] : []),
    ["./plugins/with-native-calls.cjs", {
      enabled: nativeCallsEnabled,
      apnsEnvironment: process.env.APNS_ENVIRONMENT,
      firebaseConfigPath: process.env.NATIVE_FIREBASE_CONFIG_PATH,
    }],
  ],
  updates: { enabled: false },
}

export default config
