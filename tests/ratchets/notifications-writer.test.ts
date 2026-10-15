// Dupliqué de socle/convex/tests/notificationsWriterRatchet.test.ts @ ad2e7fdc2 — adaptations : porte du moteur (`convex/modules/notifications/notify.ts`) ; AUCUNE exemption (le moteur naît avec une seule porte) ; contrôle `type: "…" as any` retiré (typage strict et cliquet `no-any-validators`) ; lecture par les outils communs des cliquets ; test du détecteur sur une source fabriquée.
/**
 * notifications-writer — CE QU'IL INTERDIT : qu'un fichier du moteur écrive
 * dans la table `notifications` sans passer par la porte unique
 * (`notifyPerson`, ou `enqueueFanout` qui l'appelle). La porte refuse
 * soi-même, le non-membre et le blocage, et dédoublonne : un écrivain direct
 * sonnerait à travers un blocage.
 *
 * COMMENT IL LIT : par le code source, commentaires retirés — toute insertion
 * `db.insert("notifications", …)` hors de la porte échoue. Les tests posent
 * leurs fixtures directement ; ils ne sont pas balayés.
 */
import { describe, expect, it } from "vitest"

import { isTestFile, listFiles, readRepoFile } from "./lib/source-files"

/** L'UNIQUE écrivain de la table. */
const GATE = "convex/modules/notifications/notify.ts"
const DIRECT_INSERT = /\bdb\.insert\s*\(\s*["'`]notifications["'`]/g

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "")
}

function countNotificationInserts(text: string): number {
  return (stripComments(text).match(DIRECT_INSERT) ?? []).length
}

function writers(): Map<string, number> {
  return new Map(
    listFiles(["convex"], [".ts"])
      .filter((file) => !isTestFile(file))
      .map((file) => [file, countNotificationInserts(readRepoFile(file))] as const)
      .filter(([, inserts]) => inserts > 0),
  )
}

describe("notifications-writer — une seule porte d'écriture de la cloche", () => {
  it("le détecteur voit une insertion directe, pas un commentaire ni une table voisine", () => {
    const fabricated = [
      `await ctx.db.insert("notifications", { networkId })`,
      `await db.insert( 'notifications', row)`,
      `// ctx.db.insert("notifications", row) — commentaire`,
      `/* db.insert("notifications") */`,
      `await ctx.db.insert("notificationPreferences", row)`,
    ].join("\n")
    expect(countNotificationInserts(fabricated)).toBe(2)
  })

  it("la porte écrit elle-même dans la table — c'est sa raison d'être", () => {
    expect(writers().get(GATE) ?? 0).toBeGreaterThan(0)
  })

  it("aucun écrivain direct hors de la porte", () => {
    const offenders = [...writers().keys()].filter((file) => file !== GATE)
    expect(offenders, "Passer par `notifyPerson` (convex/modules/notifications/notify.ts) ou `enqueueFanout`.").toEqual([])
  })
})
