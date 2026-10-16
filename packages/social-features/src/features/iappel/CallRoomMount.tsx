// Dupliqué de socle/packages/agent-features/src/components/call-center/CallRoomMount.tsx @ ad2e7fdc2 — adaptations : pont iAsted retiré (`IAstedLiveKitBridge`, aucune commande vocale dans le moteur) ; import de la feuille `@livekit/components-styles` sorti du composant (l'application importe la feuille) ; appel `Id<"calls">` ; message d'échec de connexion traduit (i18n `iappel`), messages de périphériques composés par `media-errors` et `media-watchdog` avec `t` en dernier paramètre (plan de sortie audio aussi, `planSpeakerControl`) ; commentaires recadrés sur la couche d'appel du moteur (centre d'appels retiré).
"use client";

import {
  LiveKitRoom,
  RoomAudioRenderer,
  useConnectionState,
  useLocalParticipant,
  useRoomContext,
} from "@livekit/components-react";
import {
  ConnectionState,
  supportsAudioOutputSelection,
  type MediaDeviceFailure,
  type RoomOptions,
} from "livekit-client";
import type { TFunction } from "i18next";
import { useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { Id } from "@antsia/api/engine";
import { callRoomRegistry } from "../../stores/call-room-registry";
import {
  callStore,
  useAudioRoute,
  useCallStore,
  type CallSlot,
} from "../../stores/call-store";
import {
  describeCallMediaError,
  describeCameraError,
  describeCameraFailure,
  describeMicBlockedInCall,
} from "./media-errors";
import { shouldPublishMedia } from "./call-media-live";
import {
  detectAudioPlatform,
  planSpeakerControl,
} from "./audio-route";
import type { AudioRouteIntent } from "./call-types";
import {
  CAMERA_START_TIMEOUT_MS,
  cameraStartTimeoutMessage,
  raceMediaStart,
} from "./media-watchdog";

/**
 * Un identifiant de toast PAR PÉRIPHÉRIQUE : le rappel de la salle et le
 * contrôleur à chaud peuvent voir le même échec — l'usager ne doit le lire
 * qu'une fois (sonner remplace un toast de même identifiant).
 */
const MIC_BLOCKED_TOAST_ID = "iappel-micro-bloque";
const CAMERA_FAILURE_TOAST_ID = "iappel-camera-echec";

/**
 * Composant interne — capture la `Room` LiveKit créée par `<LiveKitRoom>` et
 * la publie dans `callRoomRegistry` pour qu'un consommateur hors du sous-arbre
 * du pool (la surface d'appel) puisse la réutiliser via
 * `<RoomContext.Provider>`.
 */
function RoomRegistrar({ meetingId }: { meetingId: Id<"calls"> }) {
  const room = useRoomContext();
  useEffect(() => {
    if (!room) return;
    callRoomRegistry.register(meetingId, room);
    return () => {
      callRoomRegistry.unregister(meetingId, room);
    };
  }, [meetingId, room]);
  return null;
}

/**
 * CallRoomMount — LiveKit invisible, une salle par slot de la couche d'appel.
 *
 * Le pool de rooms permet aux appels parqués de rester CONNECTÉS :
 *  - Si le correspondant raccroche pendant l'attente → `onDisconnected` remonte
 *  - Resume = ré-activation du média (pas de reconnexion WebRTC)
 *
 * ⚠️ Le média suit le STATUT du slot, pas seulement `activeSlotId`
 * (`shouldPublishMedia`). Un appel PARQUÉ reste l'actif quand il est le seul
 * de la ligne (`holdSlot`, `stores/call-store.ts`) : lire `isActive` seul
 * laissait le micro publié et l'audio distant rendu — la pause n'était qu'un
 * changement de libellé. La salle, elle, ne bouge pas : couper la publication
 * n'est pas couper la connexion, et reprendre doit être instantané.
 *
 * Invariant : exactement 1 slot `active` à la fois. `<MediaIntentController>`
 * applique l'intention à chaud, les props `audio`/`video` la rejouent à chaque
 * reconnexion, et `<RoomAudioRenderer muted>` coupe l'écoute sans détacher les
 * éléments `<audio>`.
 */
export function CallRoomMount({
  slot,
  isActive,
  options,
  onDisconnected,
  onConnected,
  onError,
}: {
  slot: CallSlot;
  isActive: boolean;
  /**
   * Options de la salle. OBLIGATOIRES, et ce doit être une CONSTANTE DE
   * MODULE : `useLiveKitRoom` recrée la `Room` dès que `JSON.stringify(options)`
   * change, si bien qu'un littéral écrit dans le JSX la reconstruirait à
   * chaque rendu. Ce pool était le SEUL `<LiveKitRoom>` du dépôt monté sans
   * options : ni `adaptiveStream`, ni `dynacast`, ni les défauts de capture ne
   * s'y appliquaient.
   */
  options: RoomOptions;
  onDisconnected: (meetingId: Id<"calls">) => void;
  onConnected?: (meetingId: Id<"calls">) => void;
  onError?: (meetingId: Id<"calls">, error: Error) => void;
}) {
  const { t } = useTranslation("iappel");
  // On ne propage `onDisconnected` (qui termine l'appel côté serveur) QUE si
  // la session LiveKit s'est d'abord réellement établie. Sans ce garde-fou,
  // une erreur de handshake WebSocket (CSP, réseau, token expiré) terminait
  // immédiatement l'appel que la personne venait juste de décrocher.
  const hasConnectedRef = useRef(false);
  const { micMuted, cameraEnabled } = useCallStore();

  // VIVANT = l'actif dont le statut n'est ni `held` ni `ended`. C'est la
  // seule question qui décide de publier et d'entendre.
  const live = shouldPublishMedia({ status: slot.status, isActive });
  const wantsAudio = live && !micMuted;
  const wantsVideo = live && cameraEnabled;

  /**
   * Rappels STABLES pour `<LiveKitRoom>`.
   *
   * ⚠️ `useLiveKitRoom` range `onError` dans les dépendances de son effet de
   * CONNEXION : une fonction fléchée écrite dans le JSX est nouvelle à chaque
   * rendu, et ce composant se rend à chaque battement du magasin (micro,
   * caméra, slots). Chaque rendu rappelait donc `room.connect()` — quinze
   * « already connected to room » sur un seul appel dans les journaux du
   * 2026-09-13. Les valeurs vivantes passent par une référence ; les rappels,
   * eux, ne changent jamais.
   */
  const latest = useRef({ onConnected, onError, onDisconnected, wantsVideo, isActive, meetingId: slot.meetingId, t });
  latest.current = { onConnected, onError, onDisconnected, wantsVideo, isActive, meetingId: slot.meetingId, t };
  const handleConnected = useCallback(() => {
    hasConnectedRef.current = true;
    latest.current.onConnected?.(latest.current.meetingId);
  }, []);
  const handleDisconnected = useCallback(() => {
    if (!hasConnectedRef.current) return;
    latest.current.onDisconnected(latest.current.meetingId);
  }, []);
  const handleError = useCallback((err: Error) => {
    // Deux pannes sans rapport arrivent par ce même canal : un refus de
    // périphérique, et un échec de connexion. Les confondre envoyait
    // l'usager chercher la panne là où elle n'est pas — « vérifiez votre
    // réseau » sur un micro que LUI venait de bloquer.
    const wantsVideo = latest.current.wantsVideo;
    const media = describeCallMediaError(err, { video: wantsVideo }, latest.current.t);
    if (media !== null) {
      // UN PÉRIPHÉRIQUE QUI NE DÉMARRE PAS NE FAIT PLUS TOMBER L'APPEL
      // (recette du 22/09). La salle est jointe ; seul le micro ou la caméra
      // manque. Remonter l'erreur en `roomError` titrait « Connexion
      // impossible », retirait toutes les commandes sauf Raccrocher, et
      // laissait le correspondant lire « En communication » face à un
      // silence. `handleMediaDeviceFailure` sait LEQUEL a échoué (cette
      // promesse ne le dit pas) : c'est lui qui parle et ajuste l'intention.
      // eslint-disable-next-line no-console
      console.warn("[CallSlot] périphérique refusé — appel maintenu", err);
      return;
    }
    // eslint-disable-next-line no-console
    console.error("[CallSlot] LiveKit error", err);
    latest.current.onError?.(latest.current.meetingId, err);
    if (!hasConnectedRef.current) {
      toast.error(latest.current.t("callRoomMount.connectionFailed"));
    }
  }, []);

  /**
   * LE PÉRIPHÉRIQUE QUI N'A PAS DÉMARRÉ — nommé, cette fois.
   *
   * `RoomEvent.MediaDevicesError` porte le GENRE (`audioinput` / `videoinput`)
   * que la promesse de `useLiveKitRoom` ne dit pas. Micro : l'appel continue
   * en écoute seule, la commande devient « Micro bloqué » et son tap
   * réessaie. Caméra : l'intention s'éteint, et le bouton cesse d'affirmer
   * une image que personne ne voit.
   *
   * ⚠️ Stable, comme `handleError` : `useLiveKitRoom` range ce rappel dans les
   * dépendances de son effet de connexion.
   */
  const handleMediaDeviceFailure = useCallback(
    (failure?: MediaDeviceFailure, kind?: MediaDeviceKind) => {
      // L'intention du magasin est celle de l'ACTIF : ne jamais la modifier
      // pour un slot parqué, qui ne publie d'ailleurs rien.
      if (!latest.current.isActive) return;
      if (kind === "audioinput") {
        const reason = describeMicBlockedInCall(failure, latest.current.t);
        callStore.setMicBlocked(reason);
        callStore.setMicMuted(true);
        toast.error(reason, { id: MIC_BLOCKED_TOAST_ID });
        return;
      }
      if (kind === "videoinput") {
        callStore.setCameraEnabled(false);
        toast.error(describeCameraFailure(failure, latest.current.t), { id: CAMERA_FAILURE_TOAST_ID });
      }
    },
    [],
  );

  if (!slot.token || !slot.wsUrl) return null;

  /**
   * ⚠️ `audio` et `video` sont des props VIVANTES, et c'est essentiel.
   *
   * `useLiveKitRoom` ré-applique `setMicrophoneEnabled(!!audio)` et
   * `setCameraEnabled(!!video)` à CHAQUE `RoomEvent.SignalConnected` — donc à
   * chaque reconnexion, fréquentes en mobilité (bascule 4G/Wi-Fi, mise en
   * arrière-plan). Avec les valeurs figées `false` d'origine, toute caméra
   * allumée à la main était éteinte à la première reconnexion, sans un mot.
   *
   * En les faisant suivre l'intention du store, une reconnexion RÉTABLIT
   * l'état voulu au lieu de le détruire. `MediaIntentController` reste
   * nécessaire pour l'appliquer à chaud entre deux reconnexions.
   */
  return (
    <LiveKitRoom
      token={slot.token}
      serverUrl={slot.wsUrl}
      connect={true}
      audio={wantsAudio}
      video={wantsVideo}
      options={options}
      onConnected={handleConnected}
      onError={handleError}
      onMediaDeviceFailure={handleMediaDeviceFailure}
      onDisconnected={handleDisconnected}
      // Toujours invisible — la `Room` est exposée via `callRoomRegistry`
      // pour que la surface d'appel la consomme via `<RoomContext.Provider>`
      // dans son propre sous-arbre.
      className="sr-only"
    >
      <RoomRegistrar meetingId={slot.meetingId} />
      <MediaIntentController live={live} />
      {/* La SORTIE audio est une intention du magasin, appliquée ici : chaque
          `Room` porte son propre `options.audioOutput`, et une reconnexion la
          rejoue. L'écran ne fait que la POSER. */}
      <AudioRouteController isActive={isActive} />
      {/* ⚠️ MONTÉ EN PERMANENCE, muté quand l'appel n'est pas vivant.
          `muted` descend jusqu'à `RemoteTrackPublication.setEnabled(false)` :
          le SFU cesse d'envoyer, mais l'élément `<audio>` reste attaché — la
          reprise n'a pas de nouveau `play()` à négocier avec la politique
          d'autoplay. Le démonter et le remonter rouvrait cette question à
          chaque reprise. */}
      <RoomAudioRenderer muted={!live} />
    </LiveKitRoom>
  );
}

/**
 * AudioRouteController — APPLIQUE l'intention de sortie audio à la salle.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * POURQUOI ICI, ET PAS DANS LES OPTIONS DE LA SALLE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `LIVEKIT_DIRECT_CALL_ROOM_OPTIONS` est une CONSTANTE DE MODULE, et doit le
 * rester : `useLiveKitRoom` recrée la `Room` dès que `JSON.stringify(options)`
 * change. Y glisser un `audioOutput` vivant reconstruirait la salle à chaque
 * changement de sortie — une renégociation WebRTC pour changer de casque.
 *
 * `Room.switchActiveDevice("audiooutput", id)` écrit `options.audioOutput`
 * sur l'instance et le ré-applique à tout participant distant qui arrive
 * ensuite : c'est le bon point d'application, et il vaut pour CETTE salle
 * seulement — d'où la ré-exécution sur `[connected, route, micPublished,
 * isActive]` (connexion, reconnexions, bascule de slot).
 *
 * ⚠️ AUCUN toast ici, ni en succès ni en échec : personne n'a fait de geste.
 * Une route rejouée en silence au décrochage ne doit pas parler. L'écran
 * (`useSpeakerOutput`), lui, parle — c'est là qu'on a cliqué.
 *
 * `useRoomContext` est autorisé dans CE fichier (le pool ne monte le
 * contrôleur qu'à l'intérieur de `<LiveKitRoom>`) ; il ne l'est pas dans les
 * surfaces d'appel, qui s'ouvrent AVANT la salle.
 */
function AudioRouteController({ isActive }: { isActive: boolean }) {
  const { t } = useTranslation("iappel");
  const room = useRoomContext();
  const connectionState = useConnectionState();
  const { microphoneTrack } = useLocalParticipant();
  const route = useAudioRoute();
  const connected = connectionState === ConnectionState.Connected;
  // Le micro publié marque le moment où la salle a ses éléments média : poser
  // la sortie avant ne porterait sur rien à rattacher.
  const micPublished = microphoneTrack !== undefined;

  useEffect(() => {
    if (!room || !connected || !isActive || route === null) return;
    let cancelled = false;
    void resolveAudioOutputId(route, t).then((deviceId) => {
      if (cancelled || deviceId === null) return;
      // eslint-disable-next-line no-console
      room.switchActiveDevice("audiooutput", deviceId).catch(console.warn);
    });
    return () => {
      cancelled = true;
    };
    // `micPublished` est une DÉPENDANCE volontaire : elle rejoue la route dès
    // que la publication arrive, sans quoi la première seconde d'appel sort
    // par le périphérique du système.
  }, [connected, route, micPublished, isActive, room, t]);

  return null;
}

/**
 * Traduit une INTENTION en identifiant de périphérique — ou `null` quand la
 * plateforme ne sait pas router (iPhone, Android à une seule sortie).
 *
 * La décision est celle du module pur `audio-route.ts` : l'écran et le pool
 * ne peuvent donc pas se faire deux idées différentes du haut-parleur.
 */
async function resolveAudioOutputId(
  route: AudioRouteIntent,
  t: TFunction,
): Promise<string | null> {
  // Un périphérique nommé se ré-applique tel quel : c'est un choix explicite.
  if (route.kind === "device") return route.deviceId;
  if (typeof navigator === "undefined" || !navigator.mediaDevices) return null;
  const all = await navigator.mediaDevices.enumerateDevices().catch(() => []);
  const toInfo = (d: MediaDeviceInfo) => ({ deviceId: d.deviceId, label: d.label });
  const plan = planSpeakerControl({
    platform: detectAudioPlatform({
      userAgent: navigator.userAgent,
      maxTouchPoints: navigator.maxTouchPoints ?? 0,
    }),
    canSelectOutput: supportsAudioOutputSelection(),
    outputs: all.filter((d) => d.kind === "audiooutput").map(toInfo),
    inputs: all.filter((d) => d.kind === "audioinput").map(toInfo),
    route,
    activeDeviceId: null,
    hasRoom: true,
  }, t);
  if (plan.kind !== "toggle" || plan.strategy !== "sink") return null;
  return route.kind === "speaker" ? plan.speakerId : plan.earpieceId;
}

/**
 * Applique l'intention média du store à la salle, À CHAUD.
 *
 * - live=false → mic OFF + caméra OFF : slot parqué OU mis en attente par moi ;
 *   la salle reste CONNECTÉE (reprise instantanée, aucune renégociation WebRTC)
 * - live=true  → mic suit `!micMuted`, caméra suit `cameraEnabled`
 *
 * Complémentaire des props `audio`/`video` du `<LiveKitRoom>` : celles-ci
 * couvrent la connexion et les reconnexions, celui-ci couvre les changements
 * en cours d'appel (l'usager appuie sur « Caméra », ou met l'appel en attente).
 *
 * ⚠️ Un refus de permission REVIENT sur l'intention. Sans ce retour en
 * arrière, le bouton resterait allumé alors que rien n'est publié : l'usager
 * se croirait vu.
 */
function MediaIntentController({ live }: { live: boolean }) {
  const { t } = useTranslation("iappel");
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const connectionState = useConnectionState();
  const { micMuted, cameraEnabled } = useCallStore();
  const micShouldBeOn = live && !micMuted;
  const cameraShouldBeOn = live && cameraEnabled;
  const isConnected = connectionState === ConnectionState.Connected;

  useEffect(() => {
    if (!room || !localParticipant || !isConnected) return;
    let cancelled = false;
    localParticipant
      .setMicrophoneEnabled(micShouldBeOn)
      .then(() => {
        // Le micro publie : s'il était bloqué, il ne l'est plus — l'usager a
        // rouvert la permission puis touché « Micro bloqué ». L'échec, lui,
        // passe par `MediaDevicesError` (`handleMediaDeviceFailure`).
        if (!cancelled && micShouldBeOn && localParticipant.isMicrophoneEnabled) {
          callStore.setMicBlocked(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          // eslint-disable-next-line no-console
          console.warn("[CallSlot] setMicrophoneEnabled failed:", err);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [micShouldBeOn, room, localParticipant, isConnected]);

  useEffect(() => {
    if (!room || !localParticipant || !isConnected) return;
    let cancelled = false;
    const attempt = localParticipant.setCameraEnabled(cameraShouldBeOn);
    if (cameraShouldBeOn) {
      // Chien de garde : `setCameraEnabled(true)` peut ne JAMAIS aboutir, sans
      // erreur — `getUserMedia` en attente d'une invite jamais tranchée, ou
      // d'une autorisation accordée après coup dans la barre d'adresse (Chrome
      // exige alors un rechargement). Les journaux du 2026-09-13 ne montraient
      // que « waiting for pending publication promise timed out » pendant que
      // le bouton restait allumé. Passé le délai, on le DIT et on éteint
      // l'intention : l'écran cesse d'affirmer une caméra que personne ne voit.
      void raceMediaStart(attempt, CAMERA_START_TIMEOUT_MS).then((outcome) => {
        if (cancelled || outcome !== "timeout") return;
        // eslint-disable-next-line no-console
        console.warn("[CallSlot] setCameraEnabled sans réponse après", CAMERA_START_TIMEOUT_MS, "ms");
        toast.error(cameraStartTimeoutMessage(t));
        callStore.setCameraEnabled(false);
      });
    }
    attempt
      .catch((err) => {
        if (cancelled) return;
        // eslint-disable-next-line no-console
        console.warn("[CallSlot] setCameraEnabled failed:", err);
        if (!cameraShouldBeOn) return;
        // La caméra n'a pas démarré : on le DIT, et on éteint le bouton —
        // QUEL QUE SOIT le motif. Le refus de permission n'est pas le seul :
        // périphérique occupé (`NotReadableError`, un autre onglet ou logiciel
        // tient la caméra), aucune caméra, contrainte impossible. Sur tous
        // ceux-là le bouton restait ALLUMÉ alors que rien n'était publié :
        // l'usager se croyait vu, sa vignette montrait son avatar, et l'écran
        // affirmait le faux (constat du 2026-09-13, appel de groupe).
        toast.error(describeCameraError(err, t), { id: CAMERA_FAILURE_TOAST_ID });
        callStore.setCameraEnabled(false);
      });
    return () => {
      cancelled = true;
    };
  }, [cameraShouldBeOn, room, localParticipant, isConnected, t]);

  return null;
}

/**
 * Pool — monte un CallRoomMount par slot ayant un token.
 *
 * MONTÉ AU NIVEAU GLOBAL (l'hôte unique de la couche d'appel, dans la coque)
 * pour que l'audio survive aux changements de route : une personne qui change
 * de page pendant un appel doit continuer à entendre son interlocuteur
 * jusqu'à ce qu'elle raccroche.
 *
 * Le pool est invisible (`sr-only`). Les `Room` LiveKit sont publiées dans
 * `callRoomRegistry` et consommées par la surface d'appel via
 * `<RoomContext.Provider>`.
 */
export function CallRoomPool({
  slots,
  activeSlotId,
  options,
  onDisconnected,
  onConnected,
  onError,
}: {
  slots: ReadonlyArray<CallSlot>;
  activeSlotId: Id<"calls"> | null;
  options: RoomOptions;
  onDisconnected: (meetingId: Id<"calls">) => void;
  onConnected?: (meetingId: Id<"calls">) => void;
  onError?: (meetingId: Id<"calls">, error: Error) => void;
}) {
  return (
    <div className="pointer-events-none fixed h-0 w-0 overflow-hidden">
      {slots.map((slot) => {
        if (!slot.token || !slot.wsUrl) return null;
        return (
          <CallRoomMount
            key={slot.meetingId as string}
            slot={slot}
            isActive={activeSlotId === slot.meetingId}
            options={options}
            onDisconnected={onDisconnected}
            onConnected={onConnected}
            onError={onError}
          />
        );
      })}
    </div>
  );
}
