// Dupliqué de socle/packages/agent-features/src/features/direct/direct-antenna.ts @ ad2e7fdc2 — adaptations : tranche de transition des grants seule, autres commandes d’antenne différées.
export type AntennaCredentialRole = "viewer" | "speaker"
export type AntennaSessionRole = "host" | "viewer" | "speaker"
export type HandRequestStatus = "pending" | "accepted" | "declined" | "cancelled"

export function credentialTransition(
  credentialRole: AntennaCredentialRole,
  sessionRole: AntennaSessionRole,
): "none" | "rejoin-speaker" | "rejoin-viewer" {
  if (credentialRole === "viewer" && sessionRole === "speaker") return "rejoin-speaker"
  if (credentialRole === "speaker" && sessionRole === "viewer") return "rejoin-viewer"
  return "none"
}

