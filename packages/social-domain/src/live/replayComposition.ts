// Dupliqué de socle/convex/modules/direct/replayComposition.ts @ ad2e7fdc2 — adaptations : module PUR déplacé dans le domaine (`@antsia/social-domain/live/replayComposition`, importable par le front sans `convex/`), réexporté par `convex/modules/live/replayComposition.ts` ; MOTIFS de rediffusion → CODES d'un vocabulaire fermé (`DIRECT_REPLAY_FAILURE_REASONS`, stockés dans `replayFailureReason` et traduits par l'écran) : `directEgressStartGiveUpReason`, `directEgressEndedBeforeStartReason` et `directEgressFailureReason` rendent un code au lieu d'une phrase (le détail technique d'un échec ne quitte plus le journal du serveur : `lastError` et la borne `DIRECT_EGRESS_FAILURE_DETAIL_MAX` partent), motif d'un rapatriement raté dérivé de son code (`directReplayTransferFailureReason`) ; langues de piste → codes (`DIRECT_REPLAY_CAPTIONS_LANGS = ["fr", "en"]`), libellés de langue et de refus de piste → CLÉS de libellé (`captionsLang.<langue>`, `captionsRefusal.<refus>`, comme `directDelegationKindLabel`), listes `as const` des refus de piste et des motifs pour les validateurs du backend.
/**
 * La COMPOSITION d'une rediffusion, et ce que son état a le droit de DIRE.
 *
 * Module PUR (ADR-0024) : aucun enregistrement de fonction Convex, aucun import
 * de `_generated` — il se lit et se couvre entièrement en environnement `node`,
 * et l'action Node (`actions/livekitDirect.ts`), la mutation
 * (`modules/direct/replay.ts`), le DTO (`sessions.ts`) et le webhook
 * (`convex/http.ts`) partagent EXACTEMENT les mêmes décisions.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 1. LA COMPOSITION — pourquoi elle doit être DITE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `startRoomCompositeEgress` était appelée avec `{} as any` en troisième
 * argument : aucun `layout`, aucun `encodingOptions`. LiveKit retombait donc
 * sur son gabarit par défaut (grille 16:9), quel que soit le `stageFormat`
 * choisi par l'hôte à la création. Une conférence « Mobile (9:16) » produisait
 * un fichier panoramique aux bandes noires : la scène du direct et sa copie
 * durable divergeaient PAR CONSTRUCTION.
 *
 * Les trois formats sont ceux de la création (`directStageFormatValidator`,
 * `features/direct/direct-stage-format.ts`) — même vocabulaire des deux côtés,
 * jamais une seconde échelle :
 *
 *  · `television` → 16:9  → 1920 × 1080
 *  · `computer`   → 4:3   → 1440 × 1080
 *  · `mobile`     → 9:16  → 1080 × 1920
 *
 * ⚠️ DÉCISION ARBITRÉE — LE PARTAGE D'ÉCRAN EST UNE TUILE DE LA GRILLE.
 * Le `layout` d'un RoomComposite se fixe UNE fois, au démarrage de l'Egress,
 * c'est-à-dire à `goLive` : personne ne partage encore son écran, et le
 * gabarit ne peut plus changer ensuite sans redémarrer une capture (donc sans
 * couper le fichier en deux). Deux options s'offraient :
 *
 *  · `speaker` — le partage prend la scène… mais une conférence SANS partage
 *    (le cas nominal) enregistrerait alors un unique visage figé, et les sept
 *    autres intervenants dans un bandeau ;
 *  · `grid`    — les publications occupent des tuiles, partage d'écran
 *    COMPRIS.
 *
 * `grid` est retenu : il rend fidèlement une ANTENNE (jusqu'à huit
 * intervenants), qui est ce qu'un direct est le reste du temps. Conséquence
 * assumée et à dire en recette : la scène du LECTEUR fait DOMINER une
 * présentation partagée (D-05, `direct-scene.ts`), le fichier enregistré la
 * range dans une tuile. C'est une divergence CONNUE et bornée, pas un défaut —
 * l'aligner exigerait un gabarit d'Egress maison (`customBaseUrl`), qui n'est
 * pas de ce lot.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 2. L'ÉTAT — cinq nuances là où il n'y en avait qu'une
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `directReplayStatusValidator` (`validators.ts`) n'est PAS élargi, et ne doit
 * pas l'être : ses quatre littéraux sont recopiés côté client
 * (`direct-playback.ts`) et servent de FACETTE d'index
 * (`by_status_replayStatus_endedAt`, `listReplays`, `purgeExpiredReplays`).
 * L'état OPÉRATIONNEL vit donc dans un champ séparé (`replayEgressState`), et
 * la vue servie à l'écran est DÉRIVÉE des deux — jamais stockée deux fois.
 */

/** Le format de scène choisi à la création — même vocabulaire que le client. */
export type DirectStageFormat = "television" | "computer" | "mobile"

/** Le gabarit LiveKit : un seul, et il est DIT (cf. l'arbitrage ci-dessus). */
export const DIRECT_EGRESS_LAYOUT = "grid"

/** 30 images/s : le compromis lisibilité / poids d'un plateau qui parle. */
export const DIRECT_EGRESS_FRAMERATE = 30

/**
 * Profondeur de couleur explicite. `0` laisserait le service Egress appliquer
 * son propre défaut — une valeur qu'aucun test ne peut alors affirmer.
 */
export const DIRECT_EGRESS_COLOR_DEPTH = 24

/** Ce qu'on PERSISTE de la décision, pour que la recette compare fichier ↔ choix. */
export type DirectEgressComposition = {
  layout: string
  width: number
  height: number
}

/** Ce qu'on PASSE à `startRoomCompositeEgress` (3ᵉ argument, `RoomCompositeOptions`). */
export type DirectEgressCompositeOptions = {
  layout: string
  encodingOptions: {
    width: number
    height: number
    depth: number
    framerate: number
    videoBitrate: number
  }
}

/**
 * Débits vidéo (kbps) proportionnés à la surface encodée. Ce ne sont pas des
 * réglages « au mieux » : un plateau qui parle bouge peu, et un débit trop haut
 * ne fait que grossir un fichier conservé 90 jours.
 */
const DIRECT_EGRESS_PROFILES: Record<
  DirectStageFormat,
  { width: number; height: number; videoBitrate: number }
> = {
  television: { width: 1920, height: 1080, videoBitrate: 4500 },
  computer: { width: 1440, height: 1080, videoBitrate: 3500 },
  mobile: { width: 1080, height: 1920, videoBitrate: 3500 },
}

/**
 * Une session ANTÉRIEURE au format de scène, ou une valeur inconnue venue du
 * réseau, retombe sur `computer` — le même repli que le DTO et le client. On
 * n'enregistre jamais « rien » faute de format.
 */
export function normalizeDirectStageFormat(value: unknown): DirectStageFormat {
  return value === "television" || value === "mobile" || value === "computer"
    ? value
    : "computer"
}

/** Les options d'Egress d'un format — l'unique définition. */
export function directEgressCompositeOptions(
  stageFormat: unknown,
): DirectEgressCompositeOptions {
  const profile = DIRECT_EGRESS_PROFILES[normalizeDirectStageFormat(stageFormat)]
  return {
    layout: DIRECT_EGRESS_LAYOUT,
    encodingOptions: {
      width: profile.width,
      height: profile.height,
      depth: DIRECT_EGRESS_COLOR_DEPTH,
      framerate: DIRECT_EGRESS_FRAMERATE,
      videoBitrate: profile.videoBitrate,
    },
  }
}

/** La même décision, réduite à ce qui vaut la peine d'être conservé en base. */
export function directEgressComposition(
  stageFormat: unknown,
): DirectEgressComposition {
  const options = directEgressCompositeOptions(stageFormat)
  return {
    layout: options.layout,
    width: options.encodingOptions.width,
    height: options.encodingOptions.height,
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ÉTAT OPÉRATIONNEL
// ═══════════════════════════════════════════════════════════════════════════

/** Ce que la BASE stocke — le cycle de vie de la capture, pas du fichier. */
export type DirectReplayEgressState =
  | "requested"
  | "active"
  | "stopping"
  | "stopped"

/** Ce que l'ÉCRAN reçoit — la production du fichier, du début à la purge. */
export type DirectReplayEgressView =
  | "requested"
  | "active"
  | "processing"
  | "ready"
  | "failed"
  | "expired"

/**
 * La vue servie au DTO. `pending` ne disait rien à personne : l'hôte ne
 * pouvait pas distinguer « LiveKit enregistre » de « la demande n'a jamais
 * abouti », et pas davantage « capture finie, fichier en route » de « rien ne
 * viendra ». Une seule fonction, deux appelants (`sessions.get`, les listes).
 */
export function directReplayEgressView(input: {
  replayStatus: "pending" | "ready" | "failed" | "expired"
  replayEgressState?: DirectReplayEgressState
}): DirectReplayEgressView {
  if (input.replayStatus === "ready") return "ready"
  if (input.replayStatus === "failed") return "failed"
  if (input.replayStatus === "expired") return "expired"
  switch (input.replayEgressState) {
    case "active":
      return "active"
    case "stopping":
    case "stopped":
      return "processing"
    default:
      // `requested`, et l'ABSENCE de champ (session antérieure au lot 10) :
      // demandé est tout ce qu'on peut affirmer sans mentir.
      return "requested"
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// LES MOTIFS — des CODES, jamais des phrases
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POURQUOI aucune rediffusion ne sera produite — le vocabulaire FERMÉ de
 * `liveSessions.replayFailureReason`, servi à l'hôte seul et traduit par
 * l'écran (`replayFailure.<motif>`). Le domaine ne parle pas : le détail
 * technique d'un échec (message du SDK, statut HTTP) reste au journal du
 * serveur, il ne devient jamais un texte d'écran.
 *
 *  · démarrage de la capture —
 *    `recording_unavailable` (aucune configuration LiveKit sur ce déploiement),
 *    `ended_before_start` (terminée avant toute capture, sans échec côté LiveKit),
 *    `media_server_unresponsive` (le serveur vidéo — réveil, salles — n'a pas répondu),
 *    `recorder_unresponsive` (le service d'enregistrement n'a pas répondu),
 *    `room_never_opened` (la salle n'a jamais été ouverte auprès du serveur vidéo),
 *    `start_refused` (salle ouverte, démarrage de la capture refusé jusqu'à la borne) ;
 *  · fin de capture déclarée par LiveKit — `egress_failed`, `egress_aborted`,
 *    `egress_limit_reached`, et `no_file_delivered` (terminée sans fichier) ;
 *  · réconciliation — `never_started` (aucune capture corrélée), `never_delivered`
 *    (corrélée, jamais livrée en 24 h), `egress_not_found` (introuvable chez
 *    LiveKit), `file_not_retrieved` (terminée sans emplacement de fichier) ;
 *  · rapatriement — `transfer_<code>` (`DIRECT_REPLAY_TRANSFER_FAILURES`) ;
 *  · politique de dépôt — `upload_refused` (le fichier rapatrié n'est pas un
 *    enregistrement exploitable : type ou taille refusés, il a été supprimé).
 */
export const DIRECT_REPLAY_FAILURE_REASONS = [
  "recording_unavailable",
  "ended_before_start",
  "media_server_unresponsive",
  "recorder_unresponsive",
  "room_never_opened",
  "start_refused",
  "egress_failed",
  "egress_aborted",
  "egress_limit_reached",
  "no_file_delivered",
  "never_started",
  "never_delivered",
  "egress_not_found",
  "file_not_retrieved",
  "transfer_invalid_location",
  "transfer_download_failed",
  "transfer_empty",
  "transfer_too_large",
  "transfer_length_mismatch",
  "transfer_timeout",
  "transfer_upload_failed",
  "upload_refused",
] as const
export type DirectReplayFailureReason = (typeof DIRECT_REPLAY_FAILURE_REASONS)[number]

/**
 * Les échecs NOMMÉS du rapatriement en flux (`convex/lib/livekitEgressFileTransfer.ts`,
 * qui garde ses phrases pour le journal) : adresse invalide, téléchargement
 * refusé, fichier vide, trop volumineux, arrivé incomplet, délai dépassé,
 * dépôt refusé par le stockage.
 */
export const DIRECT_REPLAY_TRANSFER_FAILURES = [
  "invalid_location",
  "download_failed",
  "empty",
  "too_large",
  "length_mismatch",
  "timeout",
  "upload_failed",
] as const
export type DirectReplayTransferFailure = (typeof DIRECT_REPLAY_TRANSFER_FAILURES)[number]

/** Le motif d'un rapatriement raté — dérivé de son code, une seule définition. */
export function directReplayTransferFailureReason(code: DirectReplayTransferFailure): DirectReplayFailureReason {
  return `transfer_${code}`
}

/** La clé de libellé d'un motif — celle que l'écran traduit (`replayFailure.<motif>`). */
export function directReplayFailureReasonLabel(reason: DirectReplayFailureReason): `replayFailure.${DirectReplayFailureReason}` {
  return `replayFailure.${reason}`
}

// ═══════════════════════════════════════════════════════════════════════════
// DÉMARRAGE DE L'EGRESS — la salle n'existe pas encore, LiveKit dort
// ═══════════════════════════════════════════════════════════════════════════

/**
 * `startDirectEgress` est planifié par `goLive`, c'est-à-dire AVANT que l'hôte
 * n'ait ouvert sa salle (le jeton se demande après) et sans que personne n'ait
 * réveillé LiveKit (c'est le jeton qui le fait). Le 2026-09-16, chaque
 * conférence de recette finissait « Egress refusé au démarrage : fetch
 * failed » : la première tentative parlait à une machine suspendue, et il n'y
 * avait pas de seconde tentative. Un `RoomCompositeEgress` exige de plus une
 * salle EXISTANTE — LiveKit ne crée la salle qu'à la première connexion.
 *
 * D'où une politique de RÉESSAI, pure et bornée : on attend la salle et le
 * serveur, quelques secondes entre deux tentatives, DOUZE tentatives au plus
 * (chacune peut elle-même attendre la réponse du serveur — mesuré en dev le
 * 2026-09-16 : ~35 s par tentative quand l'egress ne répond pas, soit sept
 * minutes avant de renoncer). Au-delà, on renonce et on le DIT
 * (`attachEgress({ failed })`) — un hôte qui n'a jamais rejoint sa salle n'a
 * rien à enregistrer.
 */
export const DIRECT_EGRESS_START_MAX_ATTEMPTS = 12
/** Premier délai, puis croissance linéaire — 5 s, 6 s, 7 s… plafonnée. */
export const DIRECT_EGRESS_START_BASE_DELAY_MS = 5_000
export const DIRECT_EGRESS_START_MAX_DELAY_MS = 12_000

export type DirectEgressStartVerdict =
  | { kind: "retry"; attempt: number; delayMs: number }
  | { kind: "give_up" }

/**
 * Après une tentative `attempt` (0 = la première) qui n'a pas pu démarrer la
 * capture pour une raison TRANSITOIRE (salle absente, serveur injoignable) :
 * réessayer, ou renoncer.
 */
export function directEgressStartVerdict(attempt: number): DirectEgressStartVerdict {
  const done = Math.max(0, Math.floor(attempt)) + 1
  if (done >= DIRECT_EGRESS_START_MAX_ATTEMPTS) return { kind: "give_up" }
  const delayMs = Math.min(
    DIRECT_EGRESS_START_BASE_DELAY_MS + done * 1_000,
    DIRECT_EGRESS_START_MAX_DELAY_MS,
  )
  return { kind: "retry", attempt: done, delayMs }
}

/**
 * Le MOTIF servi à l'hôte quand on a renoncé — dit ce qu'on a attendu.
 *
 * `lastFailureStage` (correctif du 2026-09-17) : une salle jamais VUE parce
 * que le SERVEUR n'a jamais répondu n'est pas une salle jamais ouverte — le
 * dire accuserait l'hôte d'une panne d'infrastructure.
 */
export function directEgressStartGiveUpReason(input: {
  roomSeen: boolean
  lastFailureStage?: DirectEgressStartFailureStage
}): DirectReplayFailureReason {
  if (!input.roomSeen && input.lastFailureStage === "server") {
    return directEgressEndedBeforeStartReason({ stage: "server", detail: "" })
  }
  if (!input.roomSeen) return "room_never_opened"
  return "start_refused"
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LA CAUSE RÉELLE VOYAGE D'UNE TENTATIVE À LA SUIVANTE (correctif du 2026-09-17)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Défaut constaté : chaque tentative oubliait l'erreur de la précédente. Quand
 * la conférence se terminait pendant la boucle de réessai, le motif écrit était
 * TOUJOURS « La conférence s'est terminée avant que l'enregistrement démarre »
 * — y compris quand la salle avait été vue et que LiveKit avait refusé, à
 * chaque tentative, de démarrer la capture (« no response from servers » au
 * bout de 22-25 s : aucun worker Egress branché). Le motif masquait la panne
 * d'infrastructure derrière une phrase qui accusait l'hôte.
 *
 * Deux étages, parce qu'ils n'appellent pas la même réparation :
 *  · `server` — le serveur vidéo lui-même (réveil, `listRooms`) ;
 *  · `egress` — le service d'enregistrement (`startRoomCompositeEgress`).
 */
export type DirectEgressStartFailureStage = "server" | "egress"

/**
 * `detail` est le message TECHNIQUE de la tentative (SDK, réseau) : il voyage
 * d'une tentative à la suivante pour le journal du serveur, jamais vers l'écran.
 */
export type DirectEgressStartFailure = {
  stage: DirectEgressStartFailureStage
  detail: string
}

/**
 * La cause qui PART avec la tentative suivante.
 *
 *  · un échec de CETTE tentative remplace l'ancien : le plus récent est le
 *    plus vrai ;
 *  · un serveur qui a RÉPONDU efface un échec `server` antérieur (il s'est
 *    réveillé entre-temps), mais pas un échec `egress` — qu'un `listRooms`
 *    réussi ne prouve en rien ;
 *  · sinon l'ancien est conservé : une salle « pas encore ouverte » n'est pas
 *    un échec, elle ne doit ni créer ni effacer de cause.
 */
export function nextDirectEgressStartFailure(input: {
  previous?: DirectEgressStartFailure
  attempt?: DirectEgressStartFailure
  serverAnswered: boolean
}): DirectEgressStartFailure | undefined {
  if (input.attempt !== undefined) return input.attempt
  if (input.previous === undefined) return undefined
  if (input.serverAnswered && input.previous.stage === "server") return undefined
  return input.previous
}

/**
 * Le MOTIF écrit quand la conférence s'est terminée PENDANT la boucle de
 * réessai. « Terminée avant que l'enregistrement démarre » n'est vrai que si
 * aucune tentative n'a échoué côté LiveKit — l'hôte n'a simplement jamais
 * ouvert sa salle, ou l'a fermée trop tôt.
 */
export function directEgressEndedBeforeStartReason(
  lastFailure?: DirectEgressStartFailure,
): DirectReplayFailureReason {
  if (lastFailure === undefined) return "ended_before_start"
  return lastFailure.stage === "egress" ? "recorder_unresponsive" : "media_server_unresponsive"
}

// ═══════════════════════════════════════════════════════════════════════════
// RÉCONCILIATION — un webhook perdu, en retard ou inversé
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Délai avant d'aller demander à LiveKit ce qu'il est advenu. Un Egress qui
 * finit d'écrire son fichier prend quelques minutes après la fin de la salle :
 * réconcilier trop tôt arrêterait une capture encore utile.
 */
export const DIRECT_REPLAY_RECONCILE_AFTER_MS = 15 * 60_000

/**
 * Au-delà, on ARRÊTE d'espérer. Une ligne `pending` éternelle est pire qu'un
 * échec : l'hôte attend un fichier que plus personne ne produira, et la ligne
 * traverse chaque passage du cron pour rien.
 */
export const DIRECT_REPLAY_PENDING_GIVE_UP_MS = 24 * 60 * 60_000

export type DirectReplayReconcileVerdict = "wait" | "reconcile" | "give_up"

/**
 * Que faire d'une session TERMINÉE dont le replay est resté `pending` ?
 *
 * ⚠️ `egressId` absent n'est pas un « pas encore » : `attachEgress` s'exécute
 * dans la foulée de `goLive`. Passé le délai, aucune corrélation n'arrivera
 * plus — et sans elle, `completeEgress` (qui résout par `by_egressId`) ne peut
 * PLUS rien rattacher. C'est exactement le cas d'inversion : un `egress_ended`
 * reçu AVANT `attachEgress` est absorbé, et la ligne restait `pending` pour
 * toujours.
 */
export function directReplayReconcileVerdict(input: {
  endedAt: number
  now: number
  egressId?: string
}): DirectReplayReconcileVerdict {
  const age = input.now - input.endedAt
  if (age < DIRECT_REPLAY_RECONCILE_AFTER_MS) return "wait"
  if (age >= DIRECT_REPLAY_PENDING_GIVE_UP_MS) return "give_up"
  return input.egressId === undefined ? "give_up" : "reconcile"
}

/**
 * Ce que LiveKit répond, traduit en décision.
 *
 * ⚠️ `status` arrive sous DEUX formes selon le chemin : le webhook HTTP le
 * reçoit en JSON brut, donc sous son NOM protobuf (`"EGRESS_COMPLETE"`),
 * tandis que `EgressClient.listEgress` rend un message protobuf-es, donc
 * l'entier de l'énumération (`EgressStatus.EGRESS_COMPLETE === 3`). Les deux
 * sont acceptées ici — se tromper de forme ferait tomber TOUT statut en
 * « on attend », et la réconciliation ne conclurait jamais.
 */
export type DirectEgressOutcome =
  | { kind: "complete" }
  | { kind: "failed"; reason: DirectReplayFailureReason }
  | { kind: "active" }
  | { kind: "wait" }

const EGRESS_STATUS_NAMES: Record<number, string> = {
  0: "EGRESS_STARTING",
  1: "EGRESS_ACTIVE",
  2: "EGRESS_ENDING",
  3: "EGRESS_COMPLETE",
  4: "EGRESS_FAILED",
  5: "EGRESS_ABORTED",
  6: "EGRESS_LIMIT_REACHED",
}

/** Le NOM protobuf d'un statut, quelle que soit la forme reçue. */
export function directEgressStatusName(
  status: string | number | undefined,
): string | undefined {
  if (typeof status === "number") return EGRESS_STATUS_NAMES[status]
  if (typeof status === "string" && status.length > 0) return status
  return undefined
}

/**
 * Le MOTIF d'échec (un code), ou `undefined` si ce statut n'est pas un échec.
 *
 * ⚠️ `EGRESS_FAILED` gardait déjà son motif (`convex/http.ts`) ; `ABORTED` et
 * `LIMIT_REACHED` tombaient en revanche dans « fichier absent », un motif
 * qui ne dit pas à l'hôte que sa conférence a dépassé une limite de service.
 */
export function directEgressFailureReason(
  status: string | number | undefined,
): DirectReplayFailureReason | undefined {
  switch (directEgressStatusName(status)) {
    case "EGRESS_FAILED":
      return "egress_failed"
    case "EGRESS_ABORTED":
      return "egress_aborted"
    case "EGRESS_LIMIT_REACHED":
      return "egress_limit_reached"
    default:
      return undefined
  }
}

export function directEgressOutcomeFromStatus(
  status: string | number | undefined,
): DirectEgressOutcome {
  const reason = directEgressFailureReason(status)
  if (reason !== undefined) return { kind: "failed", reason }
  switch (directEgressStatusName(status)) {
    case "EGRESS_COMPLETE":
      return { kind: "complete" }
    case "EGRESS_ACTIVE":
      return { kind: "active" }
    default:
      // `EGRESS_STARTING`, `EGRESS_ENDING`, statut inconnu ou absent : on
      // n'écrit RIEN. Le passage suivant du cron tranchera, et la borne
      // d'abandon empêche l'attente d'être infinie.
      return { kind: "wait" }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. LA PIÈCE DE SOUS-TITRES — une IMPORTATION, jamais une production
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ⚠️ `replay.attachCaptions` existait depuis toujours SANS AUCUN PRODUCTEUR :
 * son seul appelant était un test. Ce lot lui donne une porte — l'hôte
 * téléverse une piste WebVTT — et rien d'autre. Aucun sous-titrage
 * automatique n'existe dans ce dépôt, et l'écran n'en promet aucun.
 *
 * Les bornes vivent ici parce que l'écran et le serveur doivent refuser LA
 * MÊME chose : un plafond côté client seul est une politesse, un plafond côté
 * serveur seul est un refus qu'on ne comprend qu'après avoir téléversé.
 */
export const DIRECT_REPLAY_CAPTIONS_MAX_BYTES = 2 * 1024 * 1024

/**
 * Types acceptés à l'ENTRÉE. Volontairement large : un `.vtt` arrive selon les
 * systèmes en `text/vtt`, en `text/plain`, en `application/octet-stream`, ou
 * sans type du tout. Ce filtre n'est PAS la barrière — il écarte l'erreur
 * grossière (une vidéo, une image) ; la vraie garde est la lecture de
 * l'en-tête `WEBVTT`, qui n'est possible que dans une action.
 */
export const DIRECT_REPLAY_CAPTIONS_MIME_TYPES: readonly string[] = [
  "text/vtt",
  "text/plain",
  "application/octet-stream",
]

export function isDirectReplayCaptionsMime(mime: string | undefined | null): boolean {
  if (mime === undefined || mime === null || mime.trim() === "") return true
  const base = mime.split(";")[0]!.trim().toLowerCase()
  return DIRECT_REPLAY_CAPTIONS_MIME_TYPES.includes(base)
}

/**
 * Vocabulaire FERMÉ des langues de piste. `<track srcLang>` recevait `"fr"` en
 * dur : une piste anglaise s'annonçait française. Une chaîne LIBRE venue du
 * client aurait fait l'inverse — un attribut d'accessibilité rempli par
 * n'importe quoi. Des CODES : le libellé (« Français », « Anglais ») est
 * l'affaire de l'écran.
 */
export const DIRECT_REPLAY_CAPTIONS_LANGS = ["fr", "en"] as const
export type DirectReplayCaptionsLang = (typeof DIRECT_REPLAY_CAPTIONS_LANGS)[number]

export function normalizeDirectReplayCaptionsLang(value: unknown): DirectReplayCaptionsLang {
  return DIRECT_REPLAY_CAPTIONS_LANGS.find((lang) => lang === value) ?? "fr"
}

/**
 * La clé de libellé d'une langue de piste — celle que l'écran traduit pour
 * `<track label>` (`captionsLang.fr` | `captionsLang.en`). Le domaine ne parle pas.
 */
export function directReplayCaptionsLangLabel(value: unknown): `captionsLang.${DirectReplayCaptionsLang}` {
  return `captionsLang.${normalizeDirectReplayCaptionsLang(value)}`
}

/**
 * Pourquoi un dépôt de piste est refusé.
 *
 * ⚠️ C'est une VALEUR DE RETOUR, pas une exception, et c'est une contrainte du
 * moteur autant qu'un choix : une mutation Convex qui LÈVE annule TOUTE sa
 * transaction — y compris le `ctx.storage.delete` du blob refusé, qui
 * resterait alors stocké pour toujours, jamais servi, invisible de tout le
 * monde. Refuser en rendant une valeur laisse la suppression COMMITTÉE et dit
 * quand même non.
 */
export const DIRECT_REPLAY_CAPTIONS_REFUSALS = ["ok", "missing", "too_large", "wrong_type"] as const
export type DirectReplayCaptionsRefusal = (typeof DIRECT_REPLAY_CAPTIONS_REFUSALS)[number]

/**
 * Le refus, en CLÉ de libellé — une seule source, serveur et écran la
 * partagent (`captionsRefusal.<refus>`, traduite par l'écran) ; le succès n'en
 * a aucune.
 */
export function directReplayCaptionsRefusalLabel(
  reason: DirectReplayCaptionsRefusal,
): `captionsRefusal.${Exclude<DirectReplayCaptionsRefusal, "ok">}` | null {
  return reason === "ok" ? null : `captionsRefusal.${reason}`
}
