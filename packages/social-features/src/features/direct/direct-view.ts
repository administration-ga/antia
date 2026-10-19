// Dupliqué de socle/packages/agent-features/src/features/direct/direct-view.ts @ ad2e7fdc2 — adaptations : vues seules ; choix local à la page sans stockage inter-réseau.
export type DirectSceneView = "auto" | "gallery" | "speaker" | "cinema"

export const DIRECT_SCENE_VIEWS: readonly DirectSceneView[] = ["auto", "gallery", "speaker", "cinema"]
