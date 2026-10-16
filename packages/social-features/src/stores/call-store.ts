// Dupliqué de socle/packages/agent-features/src/stores/call-store.ts @ ad2e7fdc2 — adaptations : identifiants du moteur (`Id<"calls">` pour les slots, `Id<"persons">` pour l'appelé ; noms de champs `meetingId` et `participantUserId` et noms des méthodes gardés, signatures stables pour les consommateurs) ; file du centre d'appels retirée (plus de slot `queue` supprimé au lieu d'être parqué) ; renvoi au secrétariat d'un poste (`routedFor`) retiré du slot et de la fenêtre sortante ; présence vocale d'iAsted retirée (`setVoiceCallSource` et son prédicat `isCallStoreLive`) ; clé de stockage de la sortie audio rangée sous le préfixe du réseau, posé par la coque (`configureCallStoreStorage`) — sans préfixe, rien n'est lu ni écrit ; commentaires recadrés sur la coque du moteur (AppShell, iRéunion, iAsted, poste et centre d'appels retirés).
import type { Id } from "@antsia/api/engine";
import { useSyncExternalStore } from "react";
import type {
  AudioRouteIntent,
  CallDirection,
  CallEndKind,
  CallGroupIdentity,
  CallKind,
  CallMediaIntent,
  CallPeerIdentity,
  CallScope,
  CallSlotKind,
} from "../features/iappel/call-types";

/**
 * iAppel — store multi-appels.
 *
 * Un seul store pour la surface d'appel montée dans la coque : chaque appel,
 * tête-à-tête ou de groupe, y occupe un SLOT, et l'appareil en tient plusieurs
 * à la fois (un actif, les autres en attente). Les slots portent encore `kind`
 * pour la stabilité des signatures ; dans le moteur, il vaut toujours `direct`
 * (la file du centre d'appels du socle n'est pas reprise).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * L'INTENTION MÉDIA EST MÉMORISÉE PAR APPEL
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `micMuted` et `cameraEnabled` décrivent le slot ACTIF. Jusqu'au 2026-08-22,
 * tout changement d'actif les remettait à `false` — « chaque appel démarre
 * sans vidéo ». Deux conséquences fâcheuses :
 *
 *  · un appel lancé EN VIDÉO démarrait caméra coupée, si bien que le bouton
 *    « Appel vidéo » n'ouvrait qu'un appel audio de plus ;
 *  · basculer vers un appel en attente puis revenir COUPAIT la caméra et
 *    RÉTABLISSAIT le micro qu'on avait volontairement mis en sourdine.
 *
 * Désormais : l'intention du slot que l'on quitte est SAUVEGARDÉE dans son
 * `mediaIntent`, celle du slot que l'on prend est RESTAURÉE — à défaut, elle
 * se déduit du média demandé (`mediaType: "video"` ⇒ caméra allumée).
 */

export type CallSlotStatus =
  | "incoming"
  | "connecting"
  | "active"
  | "held"
  | "ended";

export interface CallSlot {
  /** L'appel (`calls`) — nom de champ historique, gardé pour les consommateurs. */
  meetingId: Id<"calls">;
  status: CallSlotStatus;
  // Optionnel — hydraté après pickup réussi
  token?: string | null;
  wsUrl?: string | null;
  roomName?: string | null;
  joinedAt?: number | null;
  heldSince?: number | null;

  // ─── iAppel v2 — ce que la surface d'appel a besoin de savoir ───
  /** D'où vient le slot : toujours `direct` dans le moteur. Défaut : direct. */
  kind?: CallSlotKind;
  /** Qui a composé le numéro. */
  direction?: CallDirection;
  /** Au titre de quoi l'appel a lieu — toujours de personne à personne dans le moteur. */
  scope?: CallScope;
  /** Média DEMANDÉ à la création — décide de la caméra au démarrage. */
  mediaType?: "audio" | "video";
  /** L'autre bout du fil, pour nommer l'écran avant même la connexion. */
  peer?: CallPeerIdentity;
  /**
   * `direct` (tête-à-tête) ou `group` (appel iAppel à plusieurs).
   *
   * ⚠️ Ne pas confondre avec `kind`, qui dit d'où vient le slot (toujours
   * `direct` ici). Les deux coexistent : un appel de groupe est
   * `kind: "direct"` et `callKind: "group"`.
   */
  callKind?: CallKind;
  /** Titre et effectif du groupe — l'écran les annonce avant tout décrochage. */
  group?: CallGroupIdentity | null;
  ringingSince?: number | null;
  /** Décrochage constaté localement, quand le serveur n'a pas encore suivi. */
  answeredAt?: number | null;
  /** Échec de jeton (`requestToken`) — l'appel ne partira pas. */
  connectError?: string | null;
  /** Jeton correct mais salle injoignable (CSP, serveur éteint, réseau). */
  roomError?: string | null;
  /** Renseigné une fois l'appel terminé — pilote l'écran de fin. */
  endKind?: CallEndKind | null;
  /** Note du destinataire, ou phrase de refus à afficher sur l'écran de fin. */
  endNote?: string | null;
  /** Le destinataire accepte-t-il qu'on lui laisse un message vocal ? */
  voicemailOffered?: boolean;
  /**
   * L'appel a été REFUSÉ à l'admission — il n'a jamais sonné. Posé par
   * `openRefusedCall` seul : c'est ce qui déclenche la rafale « occupé »
   * (`useBusyTone`) sur l'écran de refus, quel que soit l'endKind.
   */
  refusedAtPlacement?: boolean;
  /** Intention média mémorisée pendant que ce slot n'est PAS actif. */
  mediaIntent?: CallMediaIntent;
}

/**
 * Fenêtre d'appel SORTANT globalement visible.
 *
 * Posée par les boutons d'appel (conversation, relations, journal), consommée
 * par la surface montée dans la coque : tous les points de départ ouvrent
 * EXACTEMENT le même écran.
 */
export interface OutgoingCallWindowState {
  /** L'appel (`calls`) — nom de champ historique, gardé pour les consommateurs. */
  meetingId: Id<"calls">;
  /** La personne appelée (`persons`) — nom de champ historique, gardé pour les consommateurs. */
  participantUserId: Id<"persons">;
  mediaType: "audio" | "video";
  startedAt: number;
  /**
   * L'appelé, tel qu'on doit le nommer PENDANT la sonnerie.
   *
   * Sans lui, l'écran affichait « Appeler » et l'initiale « A » : la fenêtre
   * ne savait pas qui elle appelait, alors que l'appelant venait de le
   * choisir dans une liste.
   */
  callee?: CallPeerIdentity;
  scope?: CallScope;
}

interface CallStoreState {
  slots: Map<Id<"calls">, CallSlot>;
  activeSlotId: Id<"calls"> | null;
  /**
   * Intent utilisateur de mute manuel pour le slot actif.
   * Mémorisé par slot au changement d'actif (cf. doc en tête).
   */
  micMuted: boolean;
  /** Intent d'activation caméra pour le slot actif. */
  cameraEnabled: boolean;
  /**
   * LE MICRO NE DÉMARRE PAS (permission refusée, aucun micro, micro occupé) :
   * la phrase à dire, ou `null`. L'appel continue en écoute seule
   * (`describeMicBlockedInCall`). Global et non par slot : une permission
   * appartient à l'origine, pas à l'appel. Oublié quand la ligne se vide.
   */
  micBlocked: string | null;
  /** La surface d'appel est-elle réduite (pilule) ? */
  minimized: boolean;
  /**
   * L'INTENTION de sortie audio — écouteur, haut-parleur, ou un périphérique
   * nommé. Elle survit au changement d'appel actif et, par `localStorage`, au
   * rechargement de la page : c'est ce qui la distingue du `speakerDeviceId`
   * qu'elle remplace, écrit par personne et lu par personne.
   */
  audioRoute: AudioRouteIntent | null;
  /** Caméra souhaitée au téléphone. */
  cameraFacing: "user" | "environment";
  outgoingCallWindow: OutgoingCallWindowState | null;
}

const state: CallStoreState = {
  slots: new Map(),
  activeSlotId: null,
  micMuted: false,
  cameraEnabled: false,
  micBlocked: null,
  minimized: false,
  audioRoute: null,
  cameraFacing: "user",
  outgoingCallWindow: null,
};

const listeners = new Set<() => void>();

/** Un snapshot immuable est nécessaire pour useSyncExternalStore. */
let snapshot: {
  slots: ReadonlyArray<CallSlot>;
  activeSlotId: Id<"calls"> | null;
  activeMeetingId: Id<"calls"> | null; // alias rétrocompat
  micMuted: boolean;
  cameraEnabled: boolean;
  micBlocked: string | null;
  minimized: boolean;
  audioRoute: AudioRouteIntent | null;
  cameraFacing: "user" | "environment";
  outgoingCallWindow: OutgoingCallWindowState | null;
} = {
  slots: [],
  activeSlotId: null,
  activeMeetingId: null,
  micMuted: false,
  cameraEnabled: false,
  micBlocked: null,
  minimized: false,
  audioRoute: null,
  cameraFacing: "user",
  outgoingCallWindow: null,
};

function rebuildSnapshot() {
  snapshot = {
    slots: Array.from(state.slots.values()),
    activeSlotId: state.activeSlotId,
    activeMeetingId: state.activeSlotId,
    micMuted: state.micMuted,
    cameraEnabled: state.cameraEnabled,
    micBlocked: state.micBlocked,
    minimized: state.minimized,
    audioRoute: state.audioRoute,
    cameraFacing: state.cameraFacing,
    outgoingCallWindow: state.outgoingCallWindow,
  };
}

function emit() {
  rebuildSnapshot();
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return snapshot;
}

/* ══ LA SORTIE AUDIO EST UNE INTENTION, ET ELLE SE SOUVIENT ════════════════
   Le choix d'une sortie est un réglage d'APPAREIL, pas d'appel : celui qui
   branche un casque le veut sur tous ses appels, et sur ceux de demain. D'où
   la persistance — le `speakerDeviceId` remplacé ici ne survivait même pas au
   slot qui l'avait posé (et n'était, de fait, écrit par personne).

   ⚠️ Lecture PARESSEUSE, au premier `getAudioRoute()`, jamais à l'import : ce
   module est chargé par le rendu serveur des applications du moteur, où
   `localStorage` n'existe pas.

   UN ÉTAT PAR RÉSEAU : la clé vit sous le préfixe de stockage du réseau
   courant (`useNetwork().storagePrefix`). Le store est un singleton de module
   qui ne lit aucun contexte React : c'est la coque qui lui pose ce préfixe
   (`configureCallStoreStorage`). Tant qu'aucun préfixe n'est posé, le choix
   vaut pour la session seulement — rien n'est lu ni écrit sous une clé sans
   réseau, qu'aucune purge de déconnexion ne saurait retrouver. */

/** La clé de stockage, sous le préfixe du réseau — nommée ici et nulle part ailleurs. */
export const AUDIO_ROUTE_STORAGE_KEY = "iappel:audio-route";

/** Préfixe de stockage du réseau courant, posé par la coque ; `null` tant qu'il ne l'est pas. */
let storagePrefix: string | null = null;

let audioRouteHydrated = false;

/**
 * Pose le préfixe de stockage du réseau courant (`useNetwork().storagePrefix`).
 *
 * À appeler par la coque dès que le réseau est connu, avant que la surface
 * d'appel ne lise la sortie audio. Idempotent et SANS émission : la coque peut
 * l'appeler pendant son rendu. Un préfixe NOUVEAU relance la lecture
 * paresseuse : le choix enregistré pour ce réseau sera relu au prochain
 * `getAudioRoute()`. `null` (ou un préfixe vide) retire la persistance.
 */
export function configureCallStoreStorage(prefix: string | null): void {
  const next = prefix !== null && prefix.length > 0 ? prefix : null;
  if (storagePrefix === next) return;
  storagePrefix = next;
  audioRouteHydrated = false;
}

/** La clé complète du réseau courant, ou `null` tant qu'aucun préfixe n'est posé. */
function audioRouteStorageKey(): string | null {
  return storagePrefix === null ? null : `${storagePrefix}${AUDIO_ROUTE_STORAGE_KEY}`;
}

/**
 * Relit une intention de sortie écrite par une session antérieure.
 *
 * Fonction PURE et totale : elle ne lève jamais. Tout ce qui n'est pas une
 * intention reconnue — JSON invalide, forme d'une version future, `null` —
 * vaut « aucune préférence », et l'appel démarre sur la sortie du système.
 * Un réglage illisible ne doit pas couper le son.
 */
export function parseStoredAudioRoute(raw: string | null): AudioRouteIntent | null {
  if (raw === null || raw.length === 0) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const kind = (parsed as { kind?: unknown }).kind;
  if (kind === "earpiece" || kind === "speaker") return { kind };
  if (kind !== "device") return null;
  const deviceId = (parsed as { deviceId?: unknown }).deviceId;
  if (typeof deviceId !== "string" || deviceId.length === 0) return null;
  const label = (parsed as { label?: unknown }).label;
  return { kind: "device", deviceId, label: typeof label === "string" ? label : null };
}

/** Deux intentions décrivent-elles le même choix ? (évite un rendu pour rien) */
function sameAudioRoute(
  a: AudioRouteIntent | null,
  b: AudioRouteIntent | null,
): boolean {
  if (a === null || b === null) return a === b;
  if (a.kind !== b.kind) return false;
  if (a.kind !== "device" || b.kind !== "device") return true;
  return a.deviceId === b.deviceId && a.label === b.label;
}

/** Premier accès : on va chercher le choix de la session précédente. */
function hydrateAudioRoute(): void {
  if (audioRouteHydrated) return;
  audioRouteHydrated = true;
  const key = audioRouteStorageKey();
  if (key === null || typeof window === "undefined") return;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(key);
  } catch {
    // Safari en navigation privée refuse `localStorage` : le choix vaut alors
    // pour la session, ce qui reste très au-dessus de rien.
    return;
  }
  const stored = parseStoredAudioRoute(raw);
  if (stored === null) return;
  state.audioRoute = stored;
  emit();
}

function persistAudioRoute(route: AudioRouteIntent | null): void {
  const key = audioRouteStorageKey();
  if (key === null || typeof window === "undefined") return;
  try {
    if (route === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(route));
  } catch {
    // Quota plein ou stockage refusé : on n'empêche pas l'appel pour autant.
  }
}

/** L'intention par défaut d'un slot : muet non, caméra selon le média demandé. */
function defaultIntentFor(slot: CallSlot | undefined): CallMediaIntent {
  return { micMuted: false, cameraEnabled: slot?.mediaType === "video" };
}

/**
 * Met en attente le slot qui OCCUPE la ligne, quand on en prend un autre.
 *
 * ⚠️ « Occuper la ligne » inclut `connecting` : un appel qui SONNE encore
 * occupe l'appareil tout autant qu'un appel décroché. Ne parquer que les
 * `active` laissait un appel sortant en cours de sonnerie dans un état
 * bâtard — ni actif, ni en attente, invisible de la surface et impossible à
 * reprendre.
 */
function parkBusySlot(exceptId: Id<"calls"> | null) {
  const currentId = state.activeSlotId;
  if (currentId === null || currentId === exceptId) return;
  const current = state.slots.get(currentId);
  if (!current) return;
  if (current.status !== "active" && current.status !== "connecting") return;

  state.slots.set(currentId, {
    ...current,
    status: "held",
    heldSince: Date.now(),
    mediaIntent: {
      micMuted: state.micMuted,
      cameraEnabled: state.cameraEnabled,
    },
  });
}

/**
 * Change le slot actif en préservant les intentions média.
 *
 * Sauvegarde l'intention courante sur le slot que l'on quitte, restaure celle
 * du slot que l'on prend. Sans effet quand l'actif ne change pas — sinon un
 * simple `upsertSlot` d'hydratation (arrivée du jeton) réinitialiserait la
 * caméra en plein appel.
 */
function switchActive(nextId: Id<"calls"> | null) {
  if (state.activeSlotId === nextId) return;

  if (state.activeSlotId !== null) {
    const previous = state.slots.get(state.activeSlotId);
    if (previous) {
      state.slots.set(state.activeSlotId, {
        ...previous,
        mediaIntent: {
          micMuted: state.micMuted,
          cameraEnabled: state.cameraEnabled,
        },
      });
    }
  }

  state.activeSlotId = nextId;

  if (nextId === null) {
    state.micMuted = false;
    state.cameraEnabled = false;
    return;
  }
  const next = state.slots.get(nextId);
  const intent = next?.mediaIntent ?? defaultIntentFor(next);
  state.micMuted = intent.micMuted;
  state.cameraEnabled = intent.cameraEnabled;
}

/**
 * Le slot qui doit prendre la ligne quand celui de tête s'en va.
 *
 * ⚠️ Il PROMEUT le survivant, quitte à le dé-parquer. Les trois appelants
 * (`removeSlot`, `markSlotEnded`, `closeOutgoingCall`) élisaient bien un
 * survivant, mais le laissaient en `held` : `activeSlotId` pointait alors sur
 * un slot parqué, et `planCallSurface` — qui écarte un actif parqué — rendait
 * `front: null`, donc une pilule inerte dont le bouton « Raccrocher » ne
 * raccrochait rien.
 *
 * Le réconciliateur de ligne enverra le `resume` correspondant ; ici on ne
 * s'occupe que de ce que l'usager voit.
 */
function promoteSurvivor(exceptId: Id<"calls"> | null) {
  const vivants = Array.from(state.slots.values()).filter(
    (s) => s.status !== "ended" && s.meetingId !== exceptId,
  );
  // Un appel qui n'est pas parqué passe devant : il est déjà audible.
  const survivor = vivants.find((s) => s.status !== "held") ?? vivants[0];
  if (!survivor) return;
  if (survivor.status === "held") {
    state.slots.set(survivor.meetingId, {
      ...survivor,
      status: "active",
      heldSince: null,
    });
  }
  switchActive(survivor.meetingId);
}

export const callStore = {
  /**
   * Ajoute ou met à jour un slot.
   * Si `status: "active"`, il devient le slot actif (les intentions média du
   * précédent sont mémorisées, cf. `switchActive`).
   */
  upsertSlot(slot: CallSlot) {
    const existing = state.slots.get(slot.meetingId);
    state.slots.set(slot.meetingId, { ...existing, ...slot });

    if (slot.status === "active") {
      parkBusySlot(slot.meetingId);
      switchActive(slot.meetingId);
    }
    emit();
  },

  /**
   * Pose les champs de SALLE sur un slot existant — et rien d'autre.
   *
   * ⚠️ Ne touche ni `status` ni `activeSlotId`, contrairement à `upsertSlot`.
   * Le connecteur reconstruisait le statut à partir d'une valeur lue dans sa
   * closure, plusieurs secondes avant que le jeton n'arrive : basculer d'appel
   * pendant la négociation faisait revenir un statut périmé et défaisait la
   * bascule, sans qu'aucune erreur ne le signale.
   */
  hydrateSlot(
    meetingId: Id<"calls">,
    room: {
      token: string;
      wsUrl: string;
      roomName?: string | null;
      joinedAt?: number | null;
      mediaType?: "audio" | "video";
    },
  ) {
    const slot = state.slots.get(meetingId);
    if (!slot) return;
    state.slots.set(meetingId, {
      ...slot,
      token: room.token,
      wsUrl: room.wsUrl,
      roomName: room.roomName ?? slot.roomName,
      joinedAt: room.joinedAt ?? slot.joinedAt,
      mediaType: room.mediaType ?? slot.mediaType,
      // Un slot qui SONNAIT encore devient « en cours d'établissement » :
      // c'est le seul avancement que l'arrivée d'une salle autorise.
      status: slot.status === "incoming" ? "connecting" : slot.status,
    });
    emit();
  },

  /**
   * Reprend de l'APPEL canonique (`calls.lifecycle.getCall`) ce que le slot a
   * photographié de travers (IC-02) : le genre de l'appel et l'identité du
   * groupe.
   *
   * Patron `hydrateSlot` — ne touche ni `status`, ni `activeSlotId`, ni les
   * intentions média, et surtout n'ÉMET RIEN quand rien ne change : l'hôte
   * l'appelle à chaque snapshot de l'appel, et une émission par tick
   * relancerait le rendu de la surface entière.
   *
   *  · un slot « direct » devient « group » quand l'appel l'est — c'est
   *    ainsi que B, qui n'a rien muté, voit la grille que A a ouverte ;
   *  · un slot « group » ne rétrograde JAMAIS ;
   *  · une promotion SANS identité (`promoted` de l'ajout, avant que le titre
   *    serveur n'arrive) garde l'identité déjà connue.
   */
  reconcileSlotFromMeeting(
    meetingId: Id<"calls">,
    patch: { callKind: CallKind; group: CallGroupIdentity | null },
  ) {
    const slot = state.slots.get(meetingId);
    if (!slot) return;
    const callKind: CallKind =
      slot.callKind === "group" ? "group" : patch.callKind;
    const group = patch.group ?? slot.group ?? null;
    const unchanged =
      callKind === (slot.callKind ?? "direct") &&
      (group === null
        ? (slot.group ?? null) === null
        : slot.group?.title === group.title &&
          slot.group?.memberCount === group.memberCount);
    if (unchanged) return;
    state.slots.set(meetingId, { ...slot, callKind, group });
    emit();
  },

  /** Supprime un slot (appel terminé, refusé ou annulé). */
  removeSlot(meetingId: Id<"calls">) {
    state.slots.delete(meetingId);
    if (state.activeSlotId === meetingId) {
      state.activeSlotId = null;
      state.micMuted = false;
      state.cameraEnabled = false;
      // Un appel raccroché pendant qu'un autre attend : la surface se reporte
      // sur celui qui reste plutôt que de disparaître avec lui — et elle le
      // rend AUDIBLE, au lieu de le laisser parqué et hors de portée.
      promoteSurvivor(meetingId);
    }
    if (state.slots.size === 0) {
      state.minimized = false;
      // La ligne est vide : le prochain appel redemande le micro.
      state.micBlocked = null;
    }
    emit();
  },

  /** Définit explicitement le slot actif (bascule entre deux appels). */
  setActiveSlot(meetingId: Id<"calls"> | null) {
    if (meetingId === null) {
      switchActive(null);
      emit();
      return;
    }
    if (!state.slots.has(meetingId)) return;
    switchActive(meetingId);
    emit();
  },

  /** Intent de mute manuel sur le slot actif. */
  setMicMuted(muted: boolean) {
    if (state.micMuted === muted) return;
    state.micMuted = muted;
    emit();
  },

  /** Etat courant du mute manuel. */
  getMicMuted(): boolean {
    return state.micMuted;
  },

  /** Le micro ne démarre pas — ou redémarre (`null`). Cf. `micBlocked`. */
  setMicBlocked(reason: string | null) {
    if (state.micBlocked === reason) return;
    state.micBlocked = reason;
    emit();
  },

  getMicBlocked(): string | null {
    return state.micBlocked;
  },

  /** Intent d'activation caméra sur le slot actif. */
  setCameraEnabled(enabled: boolean) {
    if (state.cameraEnabled === enabled) return;
    state.cameraEnabled = enabled;
    emit();
  },

  /** Etat courant d'activation caméra. */
  getCameraEnabled(): boolean {
    return state.cameraEnabled;
  },

  /** Accès read-only aux slots courants. */
  getSlots(): ReadonlyArray<CallSlot> {
    return snapshot.slots;
  },

  /** Slot actif (audio live). */
  getActiveSlotId(): Id<"calls"> | null {
    return state.activeSlotId;
  },

  // ─── iAppel v2 — pose de la surface et périphériques ──────────
  /** Réduit ou déploie la surface d'appel. */
  setMinimized(minimized: boolean) {
    if (state.minimized === minimized) return;
    state.minimized = minimized;
    emit();
  },

  toggleMinimized() {
    state.minimized = !state.minimized;
    emit();
  },

  /** La surface est-elle réduite ? (symétrique de `getMicMuted`) */
  getMinimized(): boolean {
    return state.minimized;
  },

  /**
   * Pose l'INTENTION de sortie audio — et l'écrit sur le disque, sous le
   * préfixe du réseau (cf. `configureCallStoreStorage`).
   *
   * ⚠️ Appelée APRÈS la résolution de `switchActiveDevice`, jamais avant : le
   * magasin ne doit pas mémoriser une sortie que la salle vient de refuser
   * (casque débranché entre l'énumération et le clic). C'est le hook
   * `useSpeakerOutput` qui tient cet ordre.
   */
  setAudioRoute(route: AudioRouteIntent | null) {
    // Un choix explicite prime sur le disque : plus rien à hydrater.
    audioRouteHydrated = true;
    // L'écriture précède la comparaison : poser la même valeur que celle
    // déjà en mémoire doit tout de même la faire atterrir sur le disque.
    persistAudioRoute(route);
    if (sameAudioRoute(state.audioRoute, route)) return;
    state.audioRoute = route;
    emit();
  },

  /** L'intention courante — hydratée depuis le disque au premier appel. */
  getAudioRoute(): AudioRouteIntent | null {
    hydrateAudioRoute();
    return state.audioRoute;
  },

  setCameraFacing(facing: "user" | "environment") {
    if (state.cameraFacing === facing) return;
    state.cameraFacing = facing;
    emit();
  },

  /** Consigne un échec sur un slot — l'écran de fin le lit. */
  setSlotError(
    meetingId: Id<"calls">,
    error: { connectError?: string | null; roomError?: string | null },
  ) {
    const slot = state.slots.get(meetingId);
    if (!slot) return;
    state.slots.set(meetingId, { ...slot, ...error });
    emit();
  },

  /**
   * Marque un slot terminé SANS le retirer : l'écran de fin doit rester
   * affiché (« Pas de réponse », « Ne pas déranger ») avec ses actions. C'est
   * la fermeture explicite de l'écran qui appelle `removeSlot`.
   */
  markSlotEnded(
    meetingId: Id<"calls">,
    endKind: CallEndKind,
    endNote?: string | null,
  ) {
    const slot = state.slots.get(meetingId);
    if (!slot) return;
    state.slots.set(meetingId, {
      ...slot,
      status: "ended",
      endKind,
      endNote: endNote ?? null,
    });
    if (state.activeSlotId === meetingId) promoteSurvivor(meetingId);
    emit();
  },

  /** Décrochage d'un appel ENTRANT — le slot naît avec son identité. */
  acceptIncoming(input: {
    meetingId: Id<"calls">;
    mediaType: "audio" | "video";
    peer?: CallPeerIdentity;
    scope?: CallScope;
    /** `group` quand on décroche un appel à plusieurs. Défaut : tête-à-tête. */
    callKind?: CallKind;
    group?: CallGroupIdentity | null;
  }) {
    const existing = state.slots.get(input.meetingId);
    state.slots.set(input.meetingId, {
      ...existing,
      meetingId: input.meetingId,
      status: "connecting",
      kind: "direct",
      callKind: input.callKind ?? existing?.callKind ?? "direct",
      group: input.group ?? existing?.group ?? null,
      direction: "incoming",
      scope: input.scope ?? existing?.scope,
      mediaType: input.mediaType,
      peer: input.peer ?? existing?.peer,
      answeredAt: Date.now(),
    });
    // Accepter un second appel ne raccroche PAS le premier : il passe en
    // attente, et l'on bascule de l'un à l'autre (décision produit).
    parkBusySlot(input.meetingId);
    switchActive(input.meetingId);
    state.minimized = false;
    emit();
  },

  /**
   * Met un slot en attente. Le serveur l'apprend par `useCallLineSync`.
   *
   * ⚠️ Il ne BLANCHIT PLUS l'actif. `switchActive(null)` faisait tomber
   * `frontSlot` à `null` dans l'hôte, et le court-circuit qui suit faisait
   * disparaître la surface d'appel ENTIÈRE — alors que la conversation vivait
   * toujours dans le pool. Mettre le seul appel en attente doit rester
   * pilotable : c'est à ça que sert le bouton « Reprendre ».
   */
  holdSlot(meetingId: Id<"calls">, at: number = Date.now()) {
    const slot = state.slots.get(meetingId);
    if (!slot) return;
    state.slots.set(meetingId, { ...slot, status: "held", heldSince: at });
    if (state.activeSlotId === meetingId) {
      // Un autre appel vivant prend la ligne s'il y en a un ; sinon l'actif
      // RESTE sur ce slot parqué, qui garde ainsi sa surface et ses commandes.
      const autre = Array.from(state.slots.values()).find(
        (s) => s.meetingId !== meetingId && s.status !== "ended" && s.status !== "held",
      );
      if (autre) switchActive(autre.meetingId);
    }
    emit();
  },

  /** Reprend un slot parqué — l'actif courant bascule en attente. */
  resumeSlot(meetingId: Id<"calls">) {
    const slot = state.slots.get(meetingId);
    if (!slot) return;
    parkBusySlot(meetingId);
    state.slots.set(meetingId, { ...slot, status: "active", heldSince: null });
    switchActive(meetingId);
    emit();
  },

  // ─── Rétrocompatibilité — API scalaire historique ──────────────
  // Gardée telle quelle : les signatures exportées du store restent stables.
  setGlobalMeetingId(id: Id<"calls"> | null) {
    if (id === null) {
      if (state.activeSlotId) {
        state.slots.delete(state.activeSlotId);
      }
      state.activeSlotId = null;
      state.micMuted = false;
      state.cameraEnabled = false;
      if (state.slots.size === 0) state.micBlocked = null;
      emit();
      return;
    }
    const existing = state.slots.get(id);
    state.slots.set(id, {
      ...existing,
      meetingId: id,
      status: existing?.status ?? "active",
    });
    switchActive(id);
    emit();
  },
  getGlobalMeetingId(): Id<"calls"> | null {
    return state.activeSlotId;
  },

  // ─── Fenêtre d'appel sortant ────────────────────────────────
  /**
   * Ouvre la fenêtre d'appel sortant. À appeler par tous les points de départ
   * (boutons d'appel, onglet iAppel, en-tête de conversation) : la surface
   * montée dans la coque réagit et rend l'écran.
   *
   * ⚠️ Un appel VIDÉO démarre caméra allumée. Le contraire — l'ancien
   * comportement — faisait qu'un bouton « Appel vidéo » ouvrait un appel
   * audio, et il fallait rallumer la caméra à la main sans jamais savoir
   * pourquoi elle était éteinte.
   */
  openOutgoingCall(window: OutgoingCallWindowState) {
    state.outgoingCallWindow = window;
    const existing = state.slots.get(window.meetingId);
    state.slots.set(window.meetingId, {
      ...existing,
      meetingId: window.meetingId,
      status: existing?.status ?? "connecting",
      kind: "direct",
      direction: "outgoing",
      scope: window.scope ?? existing?.scope,
      mediaType: window.mediaType,
      peer: window.callee ?? existing?.peer,
      ringingSince: window.startedAt,
    });
    switchActive(window.meetingId);
    state.minimized = false;
    emit();
  },

  /**
   * Ouvre un appel de GROUPE dans la surface d'appel.
   *
   * Un appel à plusieurs est un APPEL, pas une réunion : il s'ouvre dans la
   * même surface que le tête-à-tête, avec le vocabulaire de l'appel
   * (« Sonnerie… », « Appel en cours »), jamais celui d'une réunion qu'on
   * rejoint.
   *
   * Le slot naît SANS jeton, comme tout appel : l'écran s'ouvre au doigt levé
   * et `useCallSlotConnector` négocie la salle derrière.
   */
  openGroupCall(input: {
    meetingId: Id<"calls">;
    mediaType: "audio" | "video";
    group: CallGroupIdentity;
    scope?: CallScope;
    /** Déjà en cours : on le REJOINT, on ne le (re)lance pas. */
    alreadyActive?: boolean;
  }) {
    const existing = state.slots.get(input.meetingId);
    state.slots.set(input.meetingId, {
      ...existing,
      meetingId: input.meetingId,
      status: existing?.status ?? "connecting",
      kind: "direct",
      callKind: "group",
      group: input.group,
      // Rejoindre un appel déjà en cours n'est pas le lancer : le vocabulaire
      // de l'écran (« Appel en cours » plutôt que « Sonnerie… ») en dépend.
      direction: input.alreadyActive === true ? "incoming" : "outgoing",
      scope: input.scope ?? existing?.scope ?? "personnel",
      mediaType: input.mediaType,
      ringingSince: Date.now(),
      ...(input.alreadyActive === true ? { answeredAt: Date.now() } : {}),
    });
    parkBusySlot(input.meetingId);
    switchActive(input.meetingId);
    state.minimized = false;
    emit();
  },

  /**
   * Ouvre l'écran de fin d'un appel REFUSÉ AVANT D'AVOIR SONNÉ.
   *
   * Le serveur écarte l'appel (hors relations, ne pas déranger, réunion,
   * ligne occupée, hors ligne) et rend sa raison. Un simple toast ne suffit
   * pas : il disparaît, il ne dit pas quand rappeler, et surtout il ne laisse
   * aucune place au seul geste utile qui reste — déposer un message vocal.
   *
   * On pose donc un slot DÉJÀ TERMINÉ : la surface s'ouvre sur son écran de
   * fin, avec la phrase de refus et les actions que la raison autorise
   * (« Rappeler » n'apparaît pas sous un « ne pas déranger »).
   */
  openRefusedCall(input: {
    meetingId: Id<"calls">;
    callee?: CallPeerIdentity;
    scope?: CallScope;
    mediaType: "audio" | "video";
    endKind: CallEndKind;
    message?: string | null;
    voicemailOffered?: boolean;
  }) {
    state.slots.set(input.meetingId, {
      meetingId: input.meetingId,
      status: "ended",
      kind: "direct",
      direction: "outgoing",
      scope: input.scope,
      mediaType: input.mediaType,
      peer: input.callee,
      endKind: input.endKind,
      endNote: input.message ?? null,
      voicemailOffered: input.voicemailOffered === true,
      // Posé ICI et nulle part ailleurs : cette méthode n'est appelée que sur
      // `admitted: false` — aucun site d'appel n'a rien à faire de plus pour
      // que l'écran de refus soit SONORE (rafale « occupé »).
      refusedAtPlacement: true,
    });
    switchActive(input.meetingId);
    state.minimized = false;
    emit();
  },

  /** Ferme la fenêtre d'appel sortant globale (+ nettoie le slot). */
  closeOutgoingCall() {
    if (state.outgoingCallWindow === null) return;
    const meetingId = state.outgoingCallWindow.meetingId;
    state.outgoingCallWindow = null;
    state.slots.delete(meetingId);
    if (state.activeSlotId === meetingId) {
      state.activeSlotId = null;
      state.micMuted = false;
      state.cameraEnabled = false;
      promoteSurvivor(meetingId);
    }
    if (state.slots.size === 0) {
      state.minimized = false;
      // La ligne est vide : le prochain appel redemande le micro.
      state.micBlocked = null;
    }
    emit();
  },

  /** Accès read-only à la fenêtre courante. */
  getOutgoingCallWindow(): OutgoingCallWindowState | null {
    return state.outgoingCallWindow;
  },

  /**
   * Remise à zéro — RÉSERVÉE AUX TESTS. Le store est un singleton de module :
   * sans elle, chaque cas hériterait des slots du précédent.
   */
  __resetForTests() {
    state.slots.clear();
    state.activeSlotId = null;
    state.micMuted = false;
    state.cameraEnabled = false;
    state.micBlocked = null;
    state.minimized = false;
    state.audioRoute = null;
    // Le disque n'est pas relu entre deux cas : chacun part d'une page vierge,
    // sans réseau posé.
    audioRouteHydrated = false;
    storagePrefix = null;
    state.cameraFacing = "user";
    state.outgoingCallWindow = null;
    emit();
  },
};

/** Hook principal — expose l'état complet du store et les actions usuelles. */
export function useCallStore() {
  const current = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return {
    slots: current.slots,
    activeSlotId: current.activeSlotId,
    // Rétrocompat : certains composants historiques consomment ce nom.
    globalActiveMeetingId: current.activeMeetingId,
    micMuted: current.micMuted,
    cameraEnabled: current.cameraEnabled,
    micBlocked: current.micBlocked,
    minimized: current.minimized,
    audioRoute: current.audioRoute,
    cameraFacing: current.cameraFacing,
    outgoingCallWindow: current.outgoingCallWindow,
    setGlobalMeetingId: callStore.setGlobalMeetingId,
    upsertSlot: callStore.upsertSlot,
    removeSlot: callStore.removeSlot,
    setActiveSlot: callStore.setActiveSlot,
    setMicMuted: callStore.setMicMuted,
    setMicBlocked: callStore.setMicBlocked,
    setCameraEnabled: callStore.setCameraEnabled,
    setMinimized: callStore.setMinimized,
    toggleMinimized: callStore.toggleMinimized,
    setAudioRoute: callStore.setAudioRoute,
    setCameraFacing: callStore.setCameraFacing,
    setSlotError: callStore.setSlotError,
    markSlotEnded: callStore.markSlotEnded,
    reconcileSlotFromMeeting: callStore.reconcileSlotFromMeeting,
    acceptIncoming: callStore.acceptIncoming,
    holdSlot: callStore.holdSlot,
    resumeSlot: callStore.resumeSlot,
    openOutgoingCall: callStore.openOutgoingCall,
    openGroupCall: callStore.openGroupCall,
    openRefusedCall: callStore.openRefusedCall,
    closeOutgoingCall: callStore.closeOutgoingCall,
  };
}

/**
 * L'intention de sortie audio SEULE — pour les consommateurs qui n'ont que
 * faire des slots.
 *
 * `useCallStore()` se re-rend à chaque battement du magasin (micro, caméra,
 * slot, pilule) : le pool média, qui ne réagit qu'à la route, en paierait le
 * prix à chaque frappe sur « Muet ». Ici, `useSyncExternalStore` compare la
 * valeur elle-même — l'objet d'intention garde son identité tant qu'il n'a
 * pas changé.
 */
export function useAudioRoute(): AudioRouteIntent | null {
  return useSyncExternalStore(
    subscribe,
    () => getSnapshot().audioRoute,
    () => null,
  );
}
