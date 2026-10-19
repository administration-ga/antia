// Dupliqué de scripts/workspace-run.test.mjs @ ad2e7fdc2 — adaptations : provenance ; le test du « dépôt réel » vise les scripts et paquets du moteur ANTSIA (typecheck et lint passent par le lanceur ; le typage d'antsia-ga tire @antsia/ui) ; message des tâches persistantes.
/**
 * Le lanceur d'espaces de travail qui remplace turbo à la racine (CH-072).
 *
 * Ce qui est verrouillé : la découverte des espaces de travail HORS du dépôt
 * (`../../ADMINISTRATIONS_ETAT/…`), le comptage de ceux qui manquent sur le
 * disque, le contrat de turbo qui servait ici (`--filter`, `!exclusion`,
 * dépendances d'abord pour les tâches amont, arrêt au premier échec) et le
 * refus de lancer vingt serveurs de développement d'un coup.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  discoverWorkspaces,
  orderSteps,
  parseArgs,
  planTask,
  runSteps,
  selectPackages,
} from "./workspace-run.mjs";

const scratch = [];
afterEach(() => {
  for (const directory of scratch.splice(0)) rmSync(directory, { recursive: true, force: true });
});

function writePackage(directory, manifest) {
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, "package.json"), JSON.stringify(manifest));
}

/*
 * Arbre DIGITAL_GOUV miniature : la plateforme deux niveaux sous la racine
 * commune, une application de l'État présente, une autre déclarée mais absente.
 */
function fixture() {
  const common = mkdtempSync(join(tmpdir(), "workspace-run-"));
  scratch.push(common);
  const root = join(common, "NTSAGUI_DIGITAL/ADMINISTRATION_GA");
  writePackage(root, {
    name: "racine",
    workspaces: [
      "plateforme/control_plane/admin_ga",
      "../../ADMINISTRATIONS_ETAT/ministeres/mef_ga",
      "../../ADMINISTRATIONS_ETAT/directions/absente_ga",
      "socle/packages/*",
    ],
  });
  writePackage(join(root, "socle/packages/ui"), { name: "@w/ui", scripts: { typecheck: "true", test: "true" } });
  writePackage(join(root, "socle/packages/sans-script"), { name: "@w/relais", dependencies: { "@w/ui": "workspace:*" } });
  writePackage(join(root, "socle/packages/features"), {
    name: "@w/features",
    scripts: { typecheck: "true" },
    dependencies: { "@w/relais": "workspace:*", react: "19" },
  });
  writePackage(join(root, "plateforme/control_plane/admin_ga"), {
    name: "admin-ga",
    scripts: { dev: "next dev", typecheck: "true" },
    dependencies: { "@w/ui": "workspace:*" },
  });
  writePackage(join(common, "ADMINISTRATIONS_ETAT/ministeres/mef_ga"), {
    name: "mef-ga",
    scripts: { dev: "next dev", typecheck: "true", lint: "true" },
    dependencies: { "@w/features": "workspace:*" },
  });
  return { common, root };
}

describe("découverte des espaces de travail", () => {
  test("trouve les espaces de travail hors du dépôt et compte les absents", () => {
    const { root } = fixture();
    const { packages, missing } = discoverWorkspaces(root);
    expect([...packages.keys()].sort()).toEqual(["@w/features", "@w/relais", "@w/ui", "admin-ga", "mef-ga"]);
    expect(packages.get("mef-ga").path).toBe(join("..", "..", "ADMINISTRATIONS_ETAT/ministeres/mef_ga"));
    expect(missing).toEqual(["../../ADMINISTRATIONS_ETAT/directions/absente_ga"]);
    // Seules les dépendances INTERNES comptent : react n'est pas un espace de travail.
    expect(packages.get("@w/features").dependencies).toEqual(["@w/relais"]);
  });

  test("refuse un nom de paquet déclaré deux fois", () => {
    const { root } = fixture();
    writePackage(join(root, "socle/packages/doublon"), { name: "@w/ui" });
    expect(() => discoverWorkspaces(root)).toThrow("déclaré deux fois");
  });
});

describe("filtres et plan", () => {
  test("filtre par nom, par motif, et exclut par « ! »", () => {
    const { root } = fixture();
    const { packages } = discoverWorkspaces(root);
    expect(selectPackages(packages, ["mef-ga"]).selected).toEqual(["mef-ga"]);
    expect(selectPackages(packages, ["@w/*"]).selected).toEqual(["@w/features", "@w/relais", "@w/ui"]);
    expect(selectPackages(packages, ["!admin-ga"]).selected).not.toContain("admin-ga");
    expect(selectPackages(packages, ["inconnu"]).unknown).toEqual(["inconnu"]);
  });

  test("une tâche amont tire les dépendances, dépendances d'abord, même à travers un paquet sans le script", () => {
    const { root } = fixture();
    const { packages } = discoverWorkspaces(root);
    const plan = planTask(packages, "typecheck", { filters: ["mef-ga"] });
    const ordered = orderSteps(plan.steps).map((step) => step.name);
    expect(ordered).toEqual(["@w/ui", "@w/features", "mef-ga"]);
    // @w/relais n'a pas le script : il ne s'exécute pas, mais transmet l'ordre.
    const mef = plan.steps.find((step) => step.name === "mef-ga");
    expect(mef.blockers).toEqual(["@w/features", "@w/ui"]);
  });

  test("--sans-dependances et les tâches non amont ne tirent rien", () => {
    const { root } = fixture();
    const { packages } = discoverWorkspaces(root);
    expect(planTask(packages, "typecheck", { filters: ["mef-ga"], withDependencies: false }).steps.map((s) => s.name)).toEqual(["mef-ga"]);
    expect(planTask(packages, "dev", { filters: ["mef-ga"] }).steps.map((s) => s.name)).toEqual(["mef-ga"]);
  });

  test("une tâche persistante est déclarée comme telle", () => {
    const { root } = fixture();
    const { packages } = discoverWorkspaces(root);
    const plan = planTask(packages, "dev");
    expect(plan.persistent).toBe(true);
    expect(plan.steps.map((step) => step.name)).toEqual(["admin-ga", "mef-ga"]);
  });

  test("lit les options comme turbo les écrivait", () => {
    expect(parseArgs(["dev", "--filter=a", "-F", "b", "--concurrency=2", "--", "-p", "3021"])).toMatchObject({
      task: "dev",
      filters: ["a", "b"],
      concurrency: 2,
      extraArgs: ["-p", "3021"],
    });
    expect(() => parseArgs([])).toThrow("Usage");
    expect(() => parseArgs(["build", "--concurrency=0"])).toThrow("--concurrency");
    expect(() => parseArgs(["build", "--turbo"])).toThrow("Argument inconnu");
  });
});

describe("exécution", () => {
  test("exécute dans l'ordre et s'arrête au premier échec", async () => {
    const { common } = fixture();
    const log = join(common, "trace.txt");
    const make = (name, script) => {
      const directory = join(common, "exec", name);
      writePackage(directory, { name, scripts: { build: script } });
      return { name, dir: directory, path: name, blockers: [] };
    };
    const a = make("a", `echo a >> ${JSON.stringify(log)}`);
    const b = { ...make("b", "exit 3"), blockers: ["a"] };
    const c = { ...make("c", `echo c >> ${JSON.stringify(log)}`), blockers: ["b"] };
    const failure = await runSteps([a, b, c], { task: "build", concurrency: 1 });
    expect(failure).toMatchObject({ name: "b", code: 3 });
    expect(readFileSync(log, "utf8")).toBe("a\n");
  });

  test("refuse vingt serveurs de dev d'un coup, et dit quoi faire", () => {
    const result = spawnSync(process.execPath, [join(import.meta.dir, "workspace-run.mjs"), "dev", "--concurrency=1", "--dry-run"], {
      encoding: "utf8",
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("tâches persistantes");
    expect(result.stderr).toContain("dev:<application>");
  });

  test("le dépôt réel : le typage d'une application tire les paquets du moteur, et aucun turbo à la racine", () => {
    const root = join(import.meta.dir, "..");
    const scripts = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).scripts;
    for (const name of ["typecheck", "lint", "dev:antsia", "dev:admin", "build:antsia", "build:admin"]) {
      expect(scripts[name]).toContain("scripts/workspace-run.mjs");
      expect(scripts[name]).not.toMatch(/(^|&& )turbo /);
    }
    expect(scripts.verify).not.toMatch(/(^|&& )turbo /);
    const { packages } = discoverWorkspaces(root);
    const antsia = planTask(packages, "typecheck", { filters: ["antsia-ga"] });
    expect(antsia.unknown).toEqual([]);
    expect(antsia.steps.map((step) => step.name)).toContain("@antsia/ui");
    expect(antsia.steps.map((step) => step.name)).toContain("@antsia/social-features");
  });
});
