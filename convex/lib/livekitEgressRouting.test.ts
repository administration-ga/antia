// Dupliqué de socle/convex/lib/egressRouting.test.ts @ ad2e7fdc2 — adaptations : branche du direct seule — le premier cas ne route plus que `directs/`, et les préfixes des traitements du socle absents du moteur (`recordings/`, `voicemails/`, `meetings/`) rejoignent le cas `unknown` ; trois cas, comme au socle.
/**
 * Routage des fichiers d'Egress — le contrat filepath ⇄ traitement.
 *
 * La branche INCONNUE est un résultat à part entière (`unknown`), jamais un
 * repli sur une branche existante : c'était le défaut de l'ancien else
 * attrape-tout du webhook, qui aurait avalé `directs/` en silence.
 */
import { describe, expect, it } from "vitest"

import { buildDirectEgressFilepath, routeEgressFilepath } from "./livekitEgressRouting"

describe("routeEgressFilepath", () => {
  it("route le préfixe du direct", () => {
    expect(routeEgressFilepath("directs/dir789.mp4")).toBe("direct")
  })

  it("tout le reste est unknown — jamais un repli silencieux, y compris les traitements du socle absents du moteur", () => {
    expect(routeEgressFilepath("")).toBe("unknown")
    expect(routeEgressFilepath("autre/fichier.mp4")).toBe("unknown")
    expect(routeEgressFilepath("recordings/rec123.mp4")).toBe("unknown")
    expect(routeEgressFilepath("voicemails/vm456.ogg")).toBe("unknown")
    expect(routeEgressFilepath("meetings/trk.ogg")).toBe("unknown")
    expect(routeEgressFilepath("directs")).toBe("unknown")
    expect(routeEgressFilepath("direct/dir789.mp4")).toBe("unknown")
    expect(routeEgressFilepath("xdirects/dir789.mp4")).toBe("unknown")
  })

  it("le filepath construit pour un direct PARVIENT au traitement direct", () => {
    // Les deux moitiés du contrat, l'une contre l'autre : si un renommage
    // touche un côté sans l'autre, ce test tombe.
    expect(routeEgressFilepath(buildDirectEgressFilepath("k57abc"))).toBe("direct")
    expect(buildDirectEgressFilepath("k57abc")).toBe("directs/k57abc.mp4")
  })
})
