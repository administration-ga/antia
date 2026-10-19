// Dupliqué de socle/packages/livekit/src/use-livekit-disconnect-guard.ts @ ad2e7fdc2 — adaptations : aucune dans le code (tel quel) ; le paquet `livekit` du socle devient le dossier `lib/livekit` du paquet des surfaces.
import { useCallback, useRef } from "react";

/**
 * useLiveKitDisconnectGuard — encapsule le pattern anti-fermeture-prématurée
 * pour un `<LiveKitRoom>`.
 *
 * Problème : `onDisconnected` est émis par @livekit/components-react dans des
 * cas qui ne devraient PAS fermer l'appel :
 *  - React 19 StrictMode (double mount en dev)
 *  - Token refresh / ICE restart / renégociation SDP
 *  - Petits glitches réseau pendant le handshake initial
 * Si on câble directement `onDisconnected={handleHangUp}`, l'appel se termine
 * avant même d'être établi → le récepteur voit "en attente de connexion" en
 * boucle, l'appelant reste seul dans la room.
 *
 * Solution : un ref `hasConnectedRef` est flippé à true par `onConnected`.
 * Tout `onDisconnected` antérieur à la première connexion est ignoré. Un ref
 * `userHangUpRef` permet de distinguer une sortie volontaire (on propage la
 * cleanup) d'une coupure distante/réseau (on laisse le hook de Convex détecter
 * la fin via `meeting.status === "ended"`).
 *
 * Usage typique :
 * ```tsx
 * const { onConnected, onDisconnected, markUserHangUp, reset } =
 *   useLiveKitDisconnectGuard(() => cleanupCallState());
 *
 * const handleHangUp = () => {
 *   markUserHangUp();
 *   void leaveMutation(meetingId);
 *   cleanupCallState();
 * };
 *
 * <LiveKitRoom onConnected={onConnected} onDisconnected={onDisconnected} ...>
 * ```
 */
export function useLiveKitDisconnectGuard(onUserHangUp: () => void) {
	const hasConnectedRef = useRef(false);
	const userHangUpRef = useRef(false);

	const onConnected = useCallback(() => {
		hasConnectedRef.current = true;
	}, []);

	const onDisconnected = useCallback(() => {
		// Disconnect avant tout onConnected = artefact de setup WebRTC. On ignore.
		if (!hasConnectedRef.current) return;
		// Disconnect après setup mais sans intention utilisateur = raccrochage
		// distant ou coupure réseau définitive. La source de vérité reste la
		// query Convex sur `meeting.status`, qui déclenchera la cleanup via
		// `useEffect` côté composant. On ne refait PAS la cleanup ici pour
		// éviter les doubles dispatchs.
		if (!userHangUpRef.current) return;
		onUserHangUp();
	}, [onUserHangUp]);

	const markUserHangUp = useCallback(() => {
		userHangUpRef.current = true;
	}, []);

	const reset = useCallback(() => {
		hasConnectedRef.current = false;
		userHangUpRef.current = false;
	}, []);

	return { onConnected, onDisconnected, markUserHangUp, reset };
}
