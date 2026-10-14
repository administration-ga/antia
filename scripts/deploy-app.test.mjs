import { describe, expect, test } from "bun:test"
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { buildPlan, checkCatalog, readCatalog } from "./deploy-app.mjs"

describe("catalogue réel du moteur", () => {
  test("est sain : paquets, ports, Dockerfiles, ARG NEXT_PUBLIC_* et listes blanches", () => {
    expect(checkCatalog(readCatalog())).toEqual([])
  })

  test("le plan n'invente aucune valeur : les absentes restent des marqueurs", () => {
    const plan = buildPlan(readCatalog(), "antia_ga", {})
    expect(plan.build).toContain("--substitutions")
    expect(plan.build.join(" ")).toContain("_NEXT_PUBLIC_CONVEX_URL=<NEXT_PUBLIC_CONVEX_URL>")
    expect(plan.image).toContain("<ANTIA_GCP_PROJECT>")
  })

  test("refuse une application inconnue", () => {
    expect(() => buildPlan(readCatalog(), "inconnue", {})).toThrow("inconnue")
  })
})

describe("contrôle d'un catalogue", () => {
  test("détecte un ARG manquant, un port faux et une liste blanche absente", () => {
    const ecosystems = mkdtempSync(join(tmpdir(), "catalogue-"))
    const root = join(ecosystems, "ANTIA")
    mkdirSync(join(root, "apps/demo"), { recursive: true })
    writeFileSync(join(root, "apps/demo/package.json"), JSON.stringify({ name: "demo", scripts: { dev: "next dev --port 3999" } }))
    writeFileSync(join(root, "apps/demo/Dockerfile"), "FROM scratch\nARG NEXT_PUBLIC_CONVEX_URL\n")
    const catalog = {
      applications: {
        demo: {
          package: "demo",
          path: "apps/demo",
          service: "demo",
          dockerfile: "ANTIA/apps/demo/Dockerfile",
          site_url: "https://demo.example",
          dev_port: 3030,
          build_args: ["NEXT_PUBLIC_CONVEX_URL", "NEXT_PUBLIC_SITE_URL"],
        },
      },
    }
    const problems = checkCatalog(catalog, root)
    expect(problems.some((p) => p.includes("ARG NEXT_PUBLIC_SITE_URL"))).toBe(true)
    expect(problems.some((p) => p.includes("3030"))).toBe(true)
    expect(problems.some((p) => p.includes("dockerignore"))).toBe(true)
  })
})
