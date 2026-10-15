#!/usr/bin/env node
/**
 * `convex dev` avec un Node que le backend LOCAL accepte pour les actions
 * « use node » (analyse des fichiers, LiveKit…).
 *
 * Le backend local de Convex refuse TOUT le déploiement dès qu'une action
 * « use node » est présente et que le Node de la machine n'est pas une version
 * qu'il supporte (20, 22 ou 24) — constaté le 15/10/2026 avec Node 25 :
 * `DeploymentNotConfiguredForNodeActions`. Il hérite de l'environnement de
 * `convex dev` : ce lanceur met donc en tête du PATH le premier Node supporté
 * qu'il trouve (celui du PATH s'il convient, sinon Homebrew `node@24/22/20`,
 * sinon nvm), sans rien installer ni modifier sur la machine.
 *
 *   node scripts/convex-dev.mjs [arguments de convex dev]
 */
import { execFileSync, spawn } from "node:child_process"
import { existsSync, readdirSync } from "node:fs"
import { homedir } from "node:os"
import { delimiter, dirname, join, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

/** Versions majeures de Node acceptées par le backend local pour les actions « use node ». */
export const SUPPORTED_NODE_MAJORS = [24, 22, 20]

/** La version majeure d'une sortie `node --version` (`v22.22.3` → 22), ou `null`. */
export function nodeMajor(versionOutput) {
  const match = /^v?(\d+)\./.exec(String(versionOutput).trim())
  return match ? Number(match[1]) : null
}

/** Les dossiers `bin` candidats, dans l'ordre de préférence (Homebrew, puis nvm). */
export function candidateBinDirs(home = homedir(), exists = existsSync, list = readdirSync) {
  const dirs = []
  for (const prefix of ["/opt/homebrew/opt", "/usr/local/opt"]) {
    for (const major of SUPPORTED_NODE_MAJORS) dirs.push(join(prefix, `node@${major}`, "bin"))
  }
  const nvm = join(home, ".nvm", "versions", "node")
  if (exists(nvm)) {
    const versions = list(nvm)
      .filter((name) => SUPPORTED_NODE_MAJORS.includes(nodeMajor(name)))
      .sort((a, b) => (nodeMajor(b) ?? 0) - (nodeMajor(a) ?? 0))
    for (const version of versions) dirs.push(join(nvm, version, "bin"))
  }
  return dirs.filter((dir) => exists(join(dir, "node")))
}

function versionOf(nodePath) {
  try {
    return execFileSync(nodePath, ["--version"], { encoding: "utf8" })
  } catch {
    return null
  }
}

/**
 * Le dossier à mettre en tête du PATH, ou `null` si le Node du PATH convient
 * déjà (ou si aucun Node supporté n'est trouvé : le lanceur prévient alors).
 */
export function pickNodeBinDir({ currentVersion, candidates, versionAt }) {
  if (SUPPORTED_NODE_MAJORS.includes(nodeMajor(currentVersion))) return null
  for (const dir of candidates) {
    const major = nodeMajor(versionAt(join(dir, "node")))
    if (SUPPORTED_NODE_MAJORS.includes(major)) return dir
  }
  return null
}

function main() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
  const currentVersion = versionOf("node") ?? ""
  const binDir = pickNodeBinDir({ currentVersion, candidates: candidateBinDirs(), versionAt: versionOf })
  const env = { ...process.env }
  if (binDir) {
    env.PATH = [binDir, env.PATH ?? ""].join(delimiter)
    console.log(`[convex-dev] Node ${String(versionOf(join(binDir, "node"))).trim()} en tête du PATH pour le backend local (actions « use node »).`)
  } else if (!SUPPORTED_NODE_MAJORS.includes(nodeMajor(currentVersion))) {
    console.warn(
      `[convex-dev] Node ${currentVersion.trim() || "introuvable"} : le backend local refusera les actions « use node ». Installer Node ${SUPPORTED_NODE_MAJORS.join(", ")} (Homebrew node@22 ou nvm).`,
    )
  }
  const convexBin = join(root, "node_modules", ".bin", "convex")
  const child = spawn(convexBin, ["dev", ...process.argv.slice(2)], { cwd: root, env, stdio: "inherit" })
  for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal))
  child.on("exit", (code, signal) => {
    process.exitCode = code ?? (signal ? 1 : 0)
  })
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main()
}
