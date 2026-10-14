#!/usr/bin/env node
/**
 * Publication d'une application du moteur à partir du catalogue
 * (`deploy/catalog.json`).
 *
 *   node scripts/deploy-app.mjs --check          contrôle le catalogue (sans réseau)
 *   node scripts/deploy-app.mjs <application>    affiche le plan de publication
 *   node scripts/deploy-app.mjs <application> --execute
 *                                                 publie (Cloud Build), seulement si
 *                                                 ANTIA_GCP_PROJECT, ANTIA_GCP_REGION
 *                                                 et ANTIA_DEPLOY_AUTORISE=oui sont posés
 *
 * Par défaut, RIEN ne part : l'hébergement (arbitrage A5) n'est pas décidé, et
 * aucune publication ne se fait sans décision du propriétaire. Le plan affiché
 * est la commande exacte, construite en contexte ECOSYSTEMES avec la liste
 * blanche `deploy/gcloudignore`. Les valeurs des variables viennent de
 * l'environnement de la machine qui publie, jamais du dépôt.
 */
import { spawnSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")
export const ECOSYSTEMS = resolve(ROOT, "..")

export function readCatalog(root = ROOT) {
  return JSON.parse(readFileSync(join(root, "deploy", "catalog.json"), "utf8"))
}

/**
 * Contrôle d'un catalogue : chaque application déclare un paquet existant,
 * un Dockerfile présent, et chaque variable NEXT_PUBLIC_* est un ARG du
 * Dockerfile (sinon le bundle se construit avec une valeur vide, sans erreur).
 * @returns {string[]} les défauts trouvés (vide = sain)
 */
export function checkCatalog(catalog, root = ROOT) {
  const problems = []
  const ecosystems = resolve(root, "..")
  for (const [key, app] of Object.entries(catalog.applications ?? {})) {
    for (const field of ["package", "path", "service", "dockerfile", "site_url", "dev_port", "build_args"]) {
      if (app[field] === undefined) problems.push(`${key} : champ « ${field} » manquant`)
    }
    const manifestPath = join(root, app.path ?? "", "package.json")
    if (!existsSync(manifestPath)) {
      problems.push(`${key} : ${app.path}/package.json introuvable`)
    } else {
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8"))
      if (manifest.name !== app.package) problems.push(`${key} : le paquet s'appelle « ${manifest.name} », pas « ${app.package} »`)
      const devScript = manifest.scripts?.dev ?? ""
      if (!devScript.includes(`--port ${app.dev_port}`)) problems.push(`${key} : le script dev n'écoute pas sur ${app.dev_port}`)
    }
    const dockerfilePath = join(ecosystems, app.dockerfile ?? "")
    if (!existsSync(dockerfilePath)) {
      problems.push(`${key} : Dockerfile ${app.dockerfile} introuvable`)
    } else {
      const dockerfile = readFileSync(dockerfilePath, "utf8")
      for (const arg of app.build_args ?? []) {
        if (!new RegExp(`^ARG ${arg}\\b`, "m").test(dockerfile)) problems.push(`${key} : ARG ${arg} absent du Dockerfile`)
      }
      if (!existsSync(`${dockerfilePath}.dockerignore`)) problems.push(`${key} : ${app.dockerfile}.dockerignore absent (contexte ECOSYSTEMES sans liste blanche)`)
    }
    if (typeof app.site_url === "string" && !app.site_url.startsWith("https://")) problems.push(`${key} : site_url doit être en https`)
  }
  return problems
}

/** La commande de publication, sans l'exécuter. */
export function buildPlan(catalog, appKey, env = process.env) {
  const app = catalog.applications?.[appKey]
  if (!app) throw new Error(`Application inconnue du catalogue : ${appKey}`)
  const project = env.ANTIA_GCP_PROJECT ?? "<ANTIA_GCP_PROJECT>"
  const region = env.ANTIA_GCP_REGION ?? "<ANTIA_GCP_REGION>"
  const image = `${region}-docker.pkg.dev/${project}/antia/${app.service}:latest`
  const buildArgs = (app.build_args ?? []).flatMap((name) => ["--build-arg", `${name}=${env[name] ?? `<${name}>`}`])
  const substitutions = [
    `_DOCKERFILE=${app.dockerfile}`,
    `_IMAGE=${image}`,
    ...(app.build_args ?? []).map((name) => `_${name}=${env[name] ?? `<${name}>`}`),
  ].join(",")
  return {
    app,
    image,
    build: [
      "gcloud", "builds", "submit", ECOSYSTEMS,
      "--project", project,
      "--config", join(ROOT, "deploy", "cloudbuild.yaml"),
      "--ignore-file", "ANTIA/deploy/gcloudignore",
      "--substitutions", substitutions,
    ],
    run: ["gcloud", "run", "deploy", app.service, "--image", image, "--project", project, "--region", region],
    dockerLocal: ["docker", "build", "-f", app.dockerfile, ...buildArgs, "-t", app.service, "."],
  }
}

function main() {
  const args = process.argv.slice(2)
  const catalog = readCatalog()
  if (args.includes("--check")) {
    const problems = checkCatalog(catalog)
    if (problems.length > 0) {
      console.error(`✗ catalogue : ${problems.length} défaut(s)`)
      for (const problem of problems) console.error(`  - ${problem}`)
      process.exitCode = 1
      return
    }
    console.log(`✓ catalogue sain : ${Object.keys(catalog.applications).length} application(s)`)
    return
  }
  const appKey = args.find((arg) => !arg.startsWith("--"))
  if (!appKey) {
    console.error("Usage : node scripts/deploy-app.mjs --check | <application> [--execute]")
    process.exitCode = 1
    return
  }
  const plan = buildPlan(catalog, appKey)
  console.log(`Plan de publication de ${appKey} (service ${plan.app.service}, ${plan.app.site_url}) :`)
  console.log(`  construction locale (depuis ECOSYSTEMES) : ${plan.dockerLocal.join(" ")}`)
  console.log(`  Cloud Build : ${plan.build.join(" ")}`)
  console.log(`  mise en service : ${plan.run.join(" ")}`)
  if (!args.includes("--execute")) {
    console.log("\nRien n'a été publié (ajouter --execute, sur décision du propriétaire).")
    return
  }
  const missing = ["ANTIA_GCP_PROJECT", "ANTIA_GCP_REGION"].filter((name) => !process.env[name])
  if (missing.length > 0 || process.env.ANTIA_DEPLOY_AUTORISE !== "oui") {
    console.error(`✗ publication refusée : ${missing.length > 0 ? `variables manquantes (${missing.join(", ")})` : ""}${process.env.ANTIA_DEPLOY_AUTORISE !== "oui" ? " ANTIA_DEPLOY_AUTORISE≠oui (décision du propriétaire)" : ""}`)
    process.exitCode = 1
    return
  }
  const build = spawnSync(plan.build[0], plan.build.slice(1), { stdio: "inherit" })
  if (build.status !== 0) {
    process.exitCode = build.status ?? 1
    return
  }
  const run = spawnSync(plan.run[0], plan.run.slice(1), { stdio: "inherit" })
  process.exitCode = run.status ?? 1
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main()
}
