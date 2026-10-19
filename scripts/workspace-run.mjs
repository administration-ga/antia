#!/usr/bin/env node
// Dupliqué de scripts/workspace-run.mjs @ ad2e7fdc2 — adaptations : provenance ; message d'erreur des tâches persistantes (« bun run dev:<application> » du moteur au lieu de « bun run --cwd socle dev:<domaine> »).
/**
 * Lanceur de tâches sur les espaces de travail bun — remplace turbo à la RACINE
 * du dépôt depuis CH-072 (ADR-0165).
 *
 * Pourquoi : les applications de l'État vivent hors du dépôt, dans
 * `DIGITAL_GOUV/ADMINISTRATIONS_ETAT`, et sont déclarées
 * `../../ADMINISTRATIONS_ETAT/<groupe>/<app>` dans `workspaces`. bun les installe
 * et les lie ; turbo 2.x, lui, refuse TOUTE la découverte dès qu'un espace de
 * travail sort de la racine (« Workspace package resolves outside repository
 * root »). Le socle garde turbo pour ses propres paquets (`socle/turbo.json`,
 * `workspaces: ["packages/*"]`) : ce lanceur ne vaut que pour le graphe COMPLET,
 * vu de la racine.
 *
 * Même contrat que turbo pour ce qui sert ici :
 * - `--filter=<paquet>` répétable, `*` accepté, `!paquet` exclut ;
 * - les tâches AMONT (build, lint, format, typecheck, test…) tirent aussi les
 *   dépendances d'espace de travail du paquet filtré, dépendances d'abord —
 *   c'était le `dependsOn: ["^tâche"]` de l'ancien turbo.json racine ;
 * - `--concurrency=N`, 1 par défaut : une machine à 16 Go ne tient pas deux
 *   typecheck d'agent-features ; une tâche persistante (dev) exige
 *   `--concurrency` ≥ nombre de paquets, comme turbo, plutôt que de lancer vingt
 *   serveurs Next ;
 * - arrêt au premier échec ; `-- <args>` est transmis au script.
 *
 * Un espace de travail déclaré mais ABSENT du disque — application de l'État non
 * clonée en CI, ou absente de l'archive de déploiement d'une autre application —
 * est ignoré et COMPTÉ, jamais passé sous silence.
 */
import { spawn } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// Tâches exécutées d'abord dans les dépendances (ancien turbo.json : `^tâche`).
export const UPSTREAM_TASKS = new Set(["build", "lint", "format", "typecheck", "typecheck:ts7", "test"]);
// Tâches qui ne se terminent pas : elles démarrent ensemble, jamais en file.
export const PERSISTENT_TASKS = new Set(["dev"]);

const USAGE = "Usage : node scripts/workspace-run.mjs <tâche> [--filter=<paquet>]… [--concurrency=N] [--sans-dependances] [--dry-run] [-- <args>]";

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function escapeRegExp(value) {
  return value.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
}

function globToRegExp(glob) {
  return new RegExp(`^${glob.split("*").map(escapeRegExp).join(".*")}$`);
}

/** Déplie un motif d'espace de travail : chemin explicite, ou segments `*` (pas de `**`). */
export function expandWorkspacePattern(root, pattern) {
  let candidates = [root];
  for (const segment of pattern.split("/")) {
    if (!segment.includes("*")) {
      candidates = candidates.map((base) => join(base, segment));
      continue;
    }
    const matcher = globToRegExp(segment);
    candidates = candidates.flatMap((base) => {
      if (!existsSync(base)) return [];
      return readdirSync(base, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && !entry.name.startsWith(".") && matcher.test(entry.name))
        .map((entry) => join(base, entry.name))
        .sort();
    });
  }
  return candidates;
}

/**
 * Lit `workspaces` de la racine et rend les paquets présents, avec leurs
 * dépendances INTERNES, et les chemins explicites absents du disque.
 */
export function discoverWorkspaces(root = ROOT) {
  const manifest = readJson(join(root, "package.json"));
  const patterns = Array.isArray(manifest.workspaces) ? manifest.workspaces : manifest.workspaces?.packages ?? [];
  const packages = new Map();
  const missing = [];
  for (const pattern of patterns) {
    const explicit = !pattern.includes("*");
    for (const directory of expandWorkspacePattern(root, pattern)) {
      const manifestPath = join(directory, "package.json");
      if (!existsSync(manifestPath)) {
        if (explicit) missing.push(pattern);
        continue;
      }
      const pkg = readJson(manifestPath);
      if (typeof pkg.name !== "string" || pkg.name === "") continue;
      if (packages.has(pkg.name)) {
        throw new Error(`Nom de paquet déclaré deux fois : ${pkg.name} (${packages.get(pkg.name).path} et ${relative(root, directory)})`);
      }
      packages.set(pkg.name, {
        name: pkg.name,
        dir: directory,
        path: relative(root, directory),
        scripts: pkg.scripts ?? {},
        dependencies: [
          ...Object.keys(pkg.dependencies ?? {}),
          ...Object.keys(pkg.devDependencies ?? {}),
          ...Object.keys(pkg.peerDependencies ?? {}),
          ...Object.keys(pkg.optionalDependencies ?? {}),
        ],
      });
    }
  }
  for (const pkg of packages.values()) {
    pkg.dependencies = [...new Set(pkg.dependencies)].filter((dependency) => dependency !== pkg.name && packages.has(dependency)).sort();
  }
  return { packages, missing };
}

/** Applique les filtres façon turbo : inclusions (sinon tout), puis exclusions `!`. */
export function selectPackages(packages, filters = []) {
  const includes = filters.filter((filter) => !filter.startsWith("!"));
  const excludes = filters.filter((filter) => filter.startsWith("!")).map((filter) => filter.slice(1));
  const names = [...packages.keys()].sort();
  const matches = (name, pattern) => globToRegExp(pattern).test(name);
  const unknown = includes.filter((pattern) => !names.some((name) => matches(name, pattern)));
  const selected = (includes.length > 0 ? names.filter((name) => includes.some((pattern) => matches(name, pattern))) : names)
    .filter((name) => !excludes.some((pattern) => matches(name, pattern)));
  return { selected, excludes, unknown };
}

function transitiveDependencies(packages, name) {
  const seen = new Set();
  const stack = [...packages.get(name).dependencies];
  while (stack.length > 0) {
    const current = stack.pop();
    if (seen.has(current)) continue;
    seen.add(current);
    stack.push(...packages.get(current).dependencies);
  }
  return seen;
}

/**
 * Plan d'exécution : paquets retenus (et leurs dépendances pour une tâche amont)
 * qui déclarent le script, chacun avec les paquets du plan qui doivent finir
 * avant lui — transitivement, un paquet sans le script transmettant l'ordre.
 */
export function planTask(packages, task, { filters = [], withDependencies = true } = {}) {
  const { selected, excludes, unknown } = selectPackages(packages, filters);
  const upstream = UPSTREAM_TASKS.has(task) && withDependencies;
  const names = new Set(selected);
  if (upstream) for (const name of selected) for (const dependency of transitiveDependencies(packages, name)) names.add(dependency);
  const isExcluded = (name) => excludes.some((pattern) => globToRegExp(pattern).test(name));
  const runnable = [...names].filter((name) => !isExcluded(name) && typeof packages.get(name).scripts[task] === "string").sort();
  const runnableSet = new Set(runnable);
  const steps = runnable.map((name) => {
    const pkg = packages.get(name);
    const blockers = upstream ? [...transitiveDependencies(packages, name)].filter((dependency) => runnableSet.has(dependency)).sort() : [];
    return { name, dir: pkg.dir, path: pkg.path, blockers };
  });
  return { task, steps, unknown, persistent: PERSISTENT_TASKS.has(task) };
}

/** Ordre séquentiel stable (dépendances d'abord) ; lève sur un cycle. */
export function orderSteps(steps) {
  const done = new Set();
  const pending = [...steps];
  const ordered = [];
  while (pending.length > 0) {
    const index = pending.findIndex((step) => step.blockers.every((blocker) => done.has(blocker)));
    if (index === -1) throw new Error(`Cycle de dépendances entre : ${pending.map((step) => step.name).join(", ")}`);
    const [step] = pending.splice(index, 1);
    done.add(step.name);
    ordered.push(step);
  }
  return ordered;
}

export function parseArgs(argv) {
  const options = { task: undefined, filters: [], concurrency: 1, withDependencies: true, dryRun: false, extraArgs: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--") {
      options.extraArgs = argv.slice(index + 1);
      break;
    }
    if (argument.startsWith("--filter=")) options.filters.push(argument.slice("--filter=".length));
    else if (argument === "--filter" || argument === "-F") options.filters.push(argv[++index]);
    else if (argument.startsWith("--concurrency=")) options.concurrency = Number(argument.slice("--concurrency=".length));
    else if (argument === "--concurrency") options.concurrency = Number(argv[++index]);
    else if (argument === "--sans-dependances") options.withDependencies = false;
    else if (argument === "--dry-run") options.dryRun = true;
    else if (!argument.startsWith("-") && options.task === undefined) options.task = argument;
    else throw new Error(`Argument inconnu : ${argument}\n${USAGE}`);
  }
  if (!options.task) throw new Error(USAGE);
  if (options.filters.some((filter) => typeof filter !== "string" || filter === "")) throw new Error(`--filter sans valeur.\n${USAGE}`);
  if (!Number.isInteger(options.concurrency) || options.concurrency < 1) throw new Error(`--concurrency doit être un entier ≥ 1.\n${USAGE}`);
  return options;
}

function pipeWithPrefix(stream, prefix, target) {
  let buffer = "";
  stream.setEncoding("utf8");
  stream.on("data", (chunk) => {
    buffer += chunk;
    const lines = buffer.split("\n");
    buffer = lines.pop();
    for (const line of lines) target.write(`${prefix}${line}\n`);
  });
  stream.on("end", () => {
    if (buffer) target.write(`${prefix}${buffer}\n`);
  });
}

/** Exécute le plan ; rend `null` si tout a réussi, sinon l'échec. */
export function runSteps(steps, { task, concurrency, extraArgs = [], persistent = false }) {
  const pending = [...steps];
  const done = new Set();
  const running = new Map();
  const limit = persistent ? steps.length : concurrency;
  const prefixed = limit > 1 && steps.length > 1;
  let failure = null;

  const stopAll = (signal) => {
    for (const child of running.values()) child.kill(signal);
  };
  process.once("SIGINT", () => stopAll("SIGINT"));
  process.once("SIGTERM", () => stopAll("SIGTERM"));

  return new Promise((resolvePromise) => {
    const settle = () => {
      if (running.size === 0 && (failure || pending.length === 0)) resolvePromise(failure);
    };
    const start = (step) => {
      if (!prefixed) process.stdout.write(`\n• ${step.name} › ${task}  (${step.path})\n`);
      const child = spawn("bun", ["run", task, ...extraArgs], {
        cwd: step.dir,
        env: process.env,
        stdio: prefixed ? ["inherit", "pipe", "pipe"] : "inherit",
      });
      if (prefixed) {
        pipeWithPrefix(child.stdout, `${step.name}:${task}: `, process.stdout);
        pipeWithPrefix(child.stderr, `${step.name}:${task}: `, process.stderr);
      }
      running.set(step.name, child);
      child.on("error", (error) => {
        running.delete(step.name);
        failure ??= { name: step.name, code: 1, message: error.message };
        settle();
      });
      child.on("close", (code, signal) => {
        if (!running.has(step.name)) return;
        running.delete(step.name);
        if (code === 0) done.add(step.name);
        else failure ??= { name: step.name, code: code ?? 1, message: signal ? `signal ${signal}` : `code ${code}` };
        launch();
      });
    };
    const launch = () => {
      if (!failure) {
        for (let index = 0; index < pending.length && running.size < limit; ) {
          const step = pending[index];
          if (step.blockers.every((blocker) => done.has(blocker))) {
            pending.splice(index, 1);
            start(step);
          } else index += 1;
        }
        if (running.size === 0 && pending.length > 0) {
          failure = { name: pending[0].name, code: 1, message: "dépendances jamais satisfaites (cycle ?)" };
        }
      }
      settle();
    };
    launch();
  });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const { packages, missing } = discoverWorkspaces(ROOT);
  const plan = planTask(packages, options.task, options);
  const absentNote = missing.length > 0
    ? `${missing.length} espace(s) de travail déclaré(s) absent(s) du disque — ignoré(s) : ${missing.join(", ")}`
    : "";

  if (plan.unknown.length > 0) {
    throw new Error(`Aucun paquet ne correspond à : ${plan.unknown.join(", ")}.${absentNote ? `\n${absentNote}` : ""}`);
  }
  if (plan.persistent && plan.steps.length > options.concurrency) {
    throw new Error(
      `${plan.steps.length} tâches persistantes « ${options.task} » pour --concurrency=${options.concurrency} : ` +
      "lancer une application à la fois (bun run dev:<application>, par exemple dev:antsia) ou filtrer (--filter=<paquet>)."
    );
  }
  const ordered = orderSteps(plan.steps);
  if (options.dryRun) {
    for (const step of ordered) process.stdout.write(`${step.name}\t${step.path}\t${step.blockers.join(",")}\n`);
    if (absentNote) process.stderr.write(`${absentNote}\n`);
    return;
  }
  if (ordered.length === 0) process.stdout.write(`Aucun paquet ne déclare la tâche « ${options.task} ».\n`);
  const failure = await runSteps(ordered, { ...options, persistent: plan.persistent });
  if (absentNote) process.stderr.write(`\n${absentNote}\n`);
  if (failure) {
    process.stderr.write(`\n✗ ${failure.name} › ${options.task} : échec (${failure.message}).\n`);
    process.exitCode = failure.code || 1;
    return;
  }
  process.stdout.write(`\n✓ ${options.task} : ${ordered.length} paquet(s).\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    process.stderr.write(`workspace-run : ${error.message}\n`);
    process.exitCode = 1;
  });
}
