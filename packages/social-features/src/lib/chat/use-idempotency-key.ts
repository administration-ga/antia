// Dupliqué de socle/packages/chat/src/use-idempotency-key.ts @ ad2e7fdc2 — adaptations : aucune dans le code (tel quel) ; le paquet `chat` du socle devient le dossier `lib/chat` du paquet des surfaces.
import { useCallback, useRef } from "react";

/**
 * useIdempotencyKey — fournit une clé d'idempotence stable pour le prochain
 * envoi de message, évite les doubles insertions côté backend quand le client
 * double-clic ou qu'un retry réseau refait la mutation.
 *
 * Pattern :
 *  1. `getKey()` retourne la clé courante (génère un UUID si pas encore créée).
 *  2. Le client passe cette clé dans la mutation `sendMessage`.
 *  3. Sur succès : `rotate()` pour que le prochain envoi ait une nouvelle clé.
 *  4. Sur échec : garder la même clé → retry déduplique si le premier avait en
 *     fait été commité côté serveur (cas de timeout client avec succès DB).
 *
 * Le hook utilise `crypto.randomUUID()` (Web Crypto API, dispo partout dans
 * les environnements ciblés : Chrome 92+, Firefox 95+, Safari 15.4+).
 */
export function useIdempotencyKey() {
	const keyRef = useRef<string | null>(null);

	const getKey = useCallback((): string => {
		if (!keyRef.current) {
			keyRef.current = crypto.randomUUID();
		}
		return keyRef.current;
	}, []);

	const rotate = useCallback(() => {
		keyRef.current = null;
	}, []);

	return { getKey, rotate };
}
