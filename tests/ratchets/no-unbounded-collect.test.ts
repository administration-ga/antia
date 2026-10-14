import { describe, expect, it } from "vitest"

import { detectUnboundedCollect } from "./lib/detectors"
import { type Finding, formatFindings, isTestFile, listFiles, readRepoFile } from "./lib/source-files"

describe("no-unbounded-collect — aucune lecture non bornée", () => {
  it("chaque `.collect()` du backend est justifié par `// borné : <raison>`", () => {
    const findings: Finding[] = []
    for (const file of listFiles(["convex"], [".ts"])) {
      if (isTestFile(file) || file.endsWith(".setup.ts")) continue
      findings.push(...detectUnboundedCollect(file, readRepoFile(file)))
    }
    expect(findings, formatFindings(findings)).toEqual([])
  })

  it("test du test : sans marqueur refusé, avec marqueur justifié accepté", () => {
    const source = [
      "export async function f(ctx) {",
      "  const all = await ctx.db.query(\"posts\").collect()",
      "  // borné : au plus quatre réactions par personne et par publication",
      "  const mine = await ctx.db.query(\"postReactions\").withIndex(\"by_post_and_reactor\").collect()",
      "  // borné : ok",
      "  const short = await ctx.db.query(\"x\").collect()",
      "  return [all, mine, short]",
      "}",
    ].join("\n")
    expect(detectUnboundedCollect("convex/x.ts", source).map((finding) => finding.line)).toEqual([2, 6])
  })
})
