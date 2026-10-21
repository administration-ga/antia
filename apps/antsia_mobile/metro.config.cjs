// Expo SDK 57 configure automatiquement les workspaces et le linker isolé.
// Référence : https://docs.expo.dev/guides/monorepos/ ; aucun résolveur ou dossier frère ajouté.
const { getDefaultConfig } = require("expo/metro-config")

module.exports = getDefaultConfig(__dirname)
