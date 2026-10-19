// Dupliqué de socle/convex/modules/direct/grants.ts @ ad2e7fdc2 — adaptations : les trois plafonds de la salle (`DIRECT_MAX_SPEAKERS`, `DIRECT_DEFAULT_MAX_VIEWERS`, `DIRECT_MAX_VIEWERS_CAP`) sont posés dans le domaine (`@antsia/social-domain/live/domain`, qui en a besoin et n'importe rien du backend) et RÉEXPORTÉS ici sous les mêmes noms et avec les mêmes valeurs ; rien d'autre.
/**
 * Grants et identités LiveKit du DIRECT — module PUR.
 *
 * Mêmes arguments ⇒ même résultat, aucune I/O, aucun aléatoire : le nonce est
 * REÇU en paramètre (même règle que `lib/livekitIdentity.ts`, la fabrique des
 * autres identités du dépôt). Ce module ne dépend PAS de `livekit-server-sdk` :
 * il rend des objets plats que `convex/actions/livekitDirect.ts` (runtime
 * Node) traduit en `token.addGrant(...)` — c'est ce qui le rend testable en
 * edge-runtime et importable d'un client.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * DEUX RÔLES DE CONNEXION, DEUX GRANTS — ET RIEN ENTRE LES DEUX
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * · SPECTATEUR — ne peut RIEN émettre : `canPublish: false`,
 *   `canPublishData: false`, sources VIDES, `hidden: true` (il n'apparaît pas
 *   dans la liste des participants du SFU — mille spectateurs ne sont pas
 *   mille tuiles). Commentaires et réactions passent par Convex, JAMAIS par le
 *   DataChannel : un canal de données spectateur serait un mur de spam
 *   impossible à modérer et un vecteur d'amplification.
 * · INTERVENANT (hôte compris) — publie, visible, données autorisées.
 *
 * Le TTL spectateur est UNE HEURE : c'est aussi le FILET de la rétrogradation
 * (base durable d'abord, `updateParticipant` ensuite, expiration du jeton en
 * dernier recours si le SFU n'a pas pu être joint).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * IDENTITÉS — le sujet reste en PRÉFIXE, et c'est structurel
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  · spectateur  : `direct-v_{subject}::{nonce}`
 *  · intervenant : `direct-s_{subject}::{nonce}`
 *
 * Le nonce évite l'éjection mutuelle de deux connexions du même compte (deux
 * onglets, StrictMode — cf. `lib/livekitIdentity.ts`). Le sujet DOIT rester en
 * préfixe : la promotion/rétrogradation retrouve les connexions d'une personne
 * dans la room par `identity.startsWith(prefix)` (`RoomServiceClient
 * .listParticipants`), sans avoir à persister un nonce par onglet.
 *
 * ⚠️ Aucun préfixe ne doit entrer en collision avec
 * `CITIZEN_SUPERVISOR_FILTER` (`/^supervisor_.+_(whisper|listen)$/`,
 * `FilteredAudioRenderer`) : une identité de direct qui matcherait ce filtre
 * serait MUETTE côté citoyen. `grants.test.ts` le verrouille.
 */

/** Rôle de CONNEXION à la room — pas le rôle durable (host|speaker en base). */
export type DirectConnectionRole = "viewer" | "speaker"

/**
 * Plafonds de la salle — intervenants (hôte compris), spectateurs par défaut et
 * plafond absolu : définis dans le domaine, servis ici sous leurs noms.
 */
export {
  DIRECT_DEFAULT_MAX_VIEWERS,
  DIRECT_MAX_SPEAKERS,
  DIRECT_MAX_VIEWERS_CAP,
} from "@antsia/social-domain/live/domain"

/**
 * TTL des jetons (secondes). Une heure pour TOUS les rôles : côté spectateur
 * c'est la borne de sur-capacité (un jeton émis n'occupe pas une place à vie),
 * côté intervenant c'est le filet de la rétrogradation.
 */
export const DIRECT_TOKEN_TTL_SECONDS = 60 * 60

/** Préfixes d'identité — v = viewer (spectateur), s = speaker (intervenant). */
const VIEWER_IDENTITY_PREFIX = "direct-v_"
const SPEAKER_IDENTITY_PREFIX = "direct-s_"

/**
 * L'identité LiveKit d'une connexion au direct.
 *
 * N'accepte QUE des identifiants et un nonce — jamais une donnée métier : la
 * chaîne traverse le serveur LiveKit et est visible des autres intervenants.
 */
export function buildDirectIdentity(input: {
  role: DirectConnectionRole
  subject: string
  nonce: string
}): string {
  const prefix =
    input.role === "viewer" ? VIEWER_IDENTITY_PREFIX : SPEAKER_IDENTITY_PREFIX
  return `${prefix}${input.subject}::${input.nonce}`
}

/**
 * Le préfixe qui retrouve TOUTES les connexions d'une personne dans la room,
 * quel que soit le nonce de chaque onglet. `::` clôt le sujet : sans lui,
 * `subject = "abc"` matcherait aussi les connexions de `"abcd"`.
 */
export function directIdentityPrefix(input: {
  role: DirectConnectionRole
  subject: string
}): string {
  const prefix =
    input.role === "viewer" ? VIEWER_IDENTITY_PREFIX : SPEAKER_IDENTITY_PREFIX
  return `${prefix}${input.subject}::`
}

/**
 * Une identité de direct appartient-elle à ce sujet ? (les deux rôles)
 * Sert à la promotion/rétrogradation pour cibler les connexions à mettre à
 * jour dans le SFU.
 */
export function identityBelongsToSubject(
  identity: string,
  subject: string,
): boolean {
  return (
    identity.startsWith(directIdentityPrefix({ role: "viewer", subject })) ||
    identity.startsWith(directIdentityPrefix({ role: "speaker", subject }))
  )
}

/**
 * Forme PLATE d'un grant LiveKit — traduite en `token.addGrant(...)` et en
 * `updateParticipant(..., permission)` par l'action Node. `canPublishSources`
 * reste en NOMS de sources (protocole LiveKit) pour ne pas importer l'enum du
 * SDK dans un module pur.
 */
export type DirectGrantShape = {
  roomJoin: true
  room: string
  canPublish: boolean
  canSubscribe: true
  canPublishData: boolean
  /** VIDE pour un spectateur = aucune source publiable, même si un bug
   * flippait `canPublish` : deux verrous valent mieux qu'un. Absent pour un
   * intervenant = toutes les sources (micro, caméra, écran). */
  canPublishSources?: []
  hidden: boolean
}

/** Le grant d'un SPECTATEUR : tout est fermé, et il est invisible. */
export function viewerGrant(roomName: string): DirectGrantShape {
  return {
    roomJoin: true,
    room: roomName,
    canPublish: false,
    canSubscribe: true,
    canPublishData: false,
    canPublishSources: [],
    hidden: true,
  }
}

/** Le grant d'un INTERVENANT (hôte compris) : publication ouverte, visible. */
export function speakerGrant(roomName: string): DirectGrantShape {
  return {
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
    hidden: false,
  }
}

/**
 * La permission SFU correspondant à un rôle de connexion — ce que
 * `RoomServiceClient.updateParticipant` applique à une connexion DÉJÀ établie
 * (promotion/rétrogradation à chaud). Même source de vérité que les grants :
 * une divergence entre jeton et update ferait deux règles pour un même rôle.
 */
export function sfuPermissionFor(role: DirectConnectionRole): {
  canPublish: boolean
  canSubscribe: boolean
  canPublishData: boolean
  hidden: boolean
} {
  const grant = role === "viewer" ? viewerGrant("-") : speakerGrant("-")
  return {
    canPublish: grant.canPublish,
    canSubscribe: grant.canSubscribe,
    canPublishData: grant.canPublishData,
    hidden: grant.hidden,
  }
}

/** Nommage de la room — préfixe dédié, reconnaissable dans LiveKit. */
export function buildDirectRoomName(nowMs: number, entropy: string): string {
  return `direct-${nowMs.toString(36)}-${entropy}`
}
