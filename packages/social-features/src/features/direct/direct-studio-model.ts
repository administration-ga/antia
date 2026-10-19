// Dupliqué de socle/packages/agent-features/src/features/direct/DirectScene.tsx @ ad2e7fdc2 — adaptations : appariement pur par personId du jeton et roster serveur, aucun nom utilisé comme identité ; pistes de spectateurs et de personnes retirées écartées.
import type { DirectSession } from "./DirectPage"

export function directParticipantPersonId(participant: {
  attributes?: Record<string, string>
  metadata?: string
}): string | null {
  if (participant.attributes?.personId) return participant.attributes.personId
  try {
    const metadata: unknown = JSON.parse(participant.metadata ?? "")
    if (typeof metadata === "object" && metadata !== null && "personId" in metadata && typeof metadata.personId === "string") return metadata.personId
  } catch { /* Un participant sans contrat d'identité ne remplit aucune place. */ }
  return null
}

type StageTrack = { participant: { identity: string; attributes?: Record<string, string>; metadata?: string } }
export function directRosterTracks<T extends StageTrack>(tracks: readonly T[], speakers: DirectSession["speakers"]) {
  const byPerson = new Map<string, T>()
  for (const track of tracks) {
    if (!track.participant.identity.startsWith("direct-s_")) continue
    const personId = directParticipantPersonId(track.participant)
    if (personId && speakers.some((speaker) => speaker.personId === personId) && !byPerson.has(personId)) byPerson.set(personId, track)
  }
  return speakers.map((speaker) => ({
    ...speaker,
    key: String(speaker.personId),
    kind: byPerson.has(speaker.personId) ? "track" as const : "roster" as const,
    isHost: speaker.role === "host",
    displayName: speaker.displayName ?? "",
    track: byPerson.get(speaker.personId) ?? null,
  }))
}
