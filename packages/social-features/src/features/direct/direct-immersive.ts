// Dupliqué de socle/packages/agent-features/src/features/direct/direct-immersive.ts @ ad2e7fdc2 — adaptations : seul le ratio de source est porté ; le studio borne son conteneur.
import type { DirectStageFormat } from "./direct-stage-format"

export function emissionTileAspect(stageFormat: DirectStageFormat): number {
	switch (stageFormat) {
		case "mobile":
			return 9 / 16
		case "television":
			return 16 / 9
		case "computer":
			return 4 / 3
	}
}
