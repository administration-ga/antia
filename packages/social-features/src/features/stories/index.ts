// Dupliqué de socle/packages/agent-features/src/features/stories/index.ts @ ad2e7fdc2 — adaptations : exports inchangés ; commentaire rapporté aux écrans et aux routes du réseau (plus de chemin de l'espace du socle).
// STORIES & DIRECTS EN PLEIN ÉCRAN VERTICAL (lot M3 du réseau du socle).
//
// Deux surfaces, une seule tranche :
//   · la BARRE horizontale en tête du fil (`StoriesTray`), montée aux DEUX
//     paliers — fil du téléphone et fil du bureau — et dans les Actus d'iCom ;
//   · le LECTEUR plein écran vertical (`StoriesViewerPage`, à la route des
//     actus de l'application — `useRoutes().stories()`), où les conférences
//     EN COURS passent devant les actus de 24 h.
//
// Les modules PURS d'abord : ce sont eux qui décident, et ce sont eux qu'un
// écran extérieur (ou un test) a besoin de lire — tout ce qui se décide vit
// dans un `.ts` testé, jamais dans le corps d'un composant.
export * from "./stories-tray"
export * from "./stories-progress"
export * from "./stories-viewer"
export * from "./story-create"

export { StoriesTray } from "./StoriesTray"
export type { StoriesTrayProps } from "./StoriesTray"
export { StoryRing } from "./StoryRing"
export { StoriesViewerPage, STORIES_AUTHOR_PARAM } from "./StoriesViewerPage"
export { StoryViewer } from "./StoryViewer"
export { StoryProgressBar } from "./StoryProgressBar"
export { StoryOverlay } from "./StoryOverlay"
export { StoryViewersSheet } from "./StoryViewersSheet"
export { StoryCreateSheet } from "./StoryCreateSheet"
export { LiveDirectSlide } from "./LiveDirectSlide"
export { StoriesStyles } from "./stories-styles"
