// Réécrit d'après socle/packages/agent-features/src/stores/index.ts @ ad2e7fdc2 — n'exporte que le store d'appel et le registre des salles d'appel ; magasins d'iAsted (contexte de page, questions) et d'iRéunion (réunion active) retirés, magasins du direct laissés au lot `live` ; ajoute `useAudioRoute`, le type `OutgoingCallWindowState` et le configurateur de stockage `configureCallStoreStorage` (préfixe du réseau, posé par la coque).
/**
 * Magasins de module partagés par les surfaces d'appel et la coque.
 *
 * Singletons de module : UNE copie par bundle. La coque pose le préfixe de
 * stockage du réseau courant (`configureCallStoreStorage(useNetwork().storagePrefix)`)
 * avant que la surface d'appel ne lise la sortie audio.
 */
export { callStore, configureCallStoreStorage, useAudioRoute, useCallStore } from "./call-store"
export type { CallSlot, CallSlotStatus, OutgoingCallWindowState } from "./call-store"

export { callRoomRegistry, useCallRoom } from "./call-room-registry"
