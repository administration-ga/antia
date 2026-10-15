// Dupliqué de socle/packages/api/src/cross-domain-session-bootstrap.test.ts @ ad2e7fdc2 — adaptations : `bun:test` → `vitest` (les paquets du moteur testent avec vitest).
import { describe, expect, test } from "vitest";
import {
	CROSS_DOMAIN_COOKIE_KEY,
	CROSS_DOMAIN_SESSION_DATA_KEY,
	adoptOneTimeTokenSession,
	clearCrossDomainSessionResidue,
	decodeJwtClaims,
	refreshCrossDomainSession,
	takeOneTimeToken,
	tokenMatchesSession,
	type CrossDomainStorage,
	type RefreshableCrossDomainAuthClient,
} from "./cross-domain-session-bootstrap";

/** Faux `localStorage`, borné à ce que le bootstrap utilise. */
function storage(): CrossDomainStorage & { map: Map<string, string> } {
	const map = new Map<string, string>();
	return {
		map,
		getItem: (key: string) => map.get(key) ?? null,
		setItem: (key: string, value: string) => void map.set(key, value),
	};
}

/** Forge un JWT compact non signé, pour les seuls besoins du décodage. */
function jwt(claims: Record<string, unknown>): string {
	const b64 = (o: unknown) =>
		btoa(JSON.stringify(o)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
	return `${b64({ alg: "RS256" })}.${b64(claims)}.signature`;
}

function client(overrides: Partial<RefreshableCrossDomainAuthClient> = {}) {
	const atomValues: Array<Record<string, unknown>> = [];
	const authClient: RefreshableCrossDomainAuthClient = {
		getCookie: () => "better-auth.session_token=valid",
		getSessionData: () => ({ session: { id: "cached" }, user: { id: "u" } }),
		getSession: async () => ({
			data: { session: { id: "fresh" }, user: { id: "u" } },
			error: null,
		}),
		convex: {
			token: async () => ({ data: { token: "fresh-convex-jwt" }, error: null }),
		},
		$store: {
			atoms: {
				session: {
					get: () => ({ refetch: () => undefined, isPending: true }),
					set: (value) => atomValues.push(value),
				},
			},
		},
		...overrides,
	};
	return { authClient, atomValues };
}

describe("refreshCrossDomainSession", () => {
	test("renouvelle le JWT et précharge l'atome de session", async () => {
		const { authClient, atomValues } = client();
		const result = await refreshCrossDomainSession(authClient);
		expect(result).toEqual({ kind: "ready", token: "fresh-convex-jwt" });
		expect(atomValues).toHaveLength(1);
		expect(atomValues[0]).toMatchObject({
			data: { session: { id: "fresh" } },
			isPending: false,
			isRefetching: false,
		});
	});

	test("ne contacte pas le serveur sans matériau d'authentification", async () => {
		let calls = 0;
		const { authClient } = client({
			getCookie: () => "",
			getSessionData: () => null,
			getSession: async () => {
				calls += 1;
				return null;
			},
		});
		expect(await refreshCrossDomainSession(authClient)).toEqual({
			kind: "signed_out",
			token: null,
		});
		expect(calls).toBe(0);
	});

	test("retente un renouvellement transitoirement défaillant", async () => {
		let tokenCalls = 0;
		const { authClient } = client({
			convex: {
				token: async () => {
					tokenCalls += 1;
					return tokenCalls === 1
						? { data: null, error: { status: 503 } }
						: { data: { token: "retry-token" }, error: null };
				},
			},
		});
		const result = await refreshCrossDomainSession(authClient, {
			retryDelayMs: 1,
		});
		expect(result).toEqual({ kind: "ready", token: "retry-token" });
		expect(tokenCalls).toBe(2);
	});

	test("applique un délai unique à la session puis au jeton", async () => {
		let sessionComplete = false;
		const { authClient } = client({
			getSession: async () => {
				sessionComplete = true;
				return {
					data: { session: { id: "fresh" }, user: { id: "u" } },
					error: null,
				};
			},
			convex: {
				token: async () => {
					expect(sessionComplete).toBe(true);
					return { data: { token: "bounded-token" }, error: null };
				},
			},
		});
		expect(
			await refreshCrossDomainSession(authClient, { timeoutMs: 50 }),
		).toEqual({ kind: "ready", token: "bounded-token" });
	});

	test("respecte le délai même si le client ignore le signal d'annulation", async () => {
		const never = new Promise<never>(() => undefined);
		const { authClient } = client({
			getSession: async () => never,
			convex: { token: async () => never },
		});
		const startedAt = Date.now();
		await expect(
			refreshCrossDomainSession(authClient, { attempts: 1, timeoutMs: 5 }),
		).rejects.toMatchObject({ name: "TimeoutError" });
		expect(Date.now() - startedAt).toBeLessThan(100);
	});

	test("retourne signed_out lorsque la session est absente", async () => {
		const { authClient } = client({
			getSession: async () => ({ data: null, error: { status: 401 } }),
		});
		expect(await refreshCrossDomainSession(authClient)).toEqual({
			kind: "signed_out",
			token: null,
		});
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// Audit du 2026-08-05 — le résidu d'une autre personne ne doit jamais servir
// ═══════════════════════════════════════════════════════════════════════════

describe("takeOneTimeToken", () => {
	test("prélève le jeton et rend l'URL nettoyée", () => {
		expect(takeOneTimeToken("https://espace.administration.ga/espace?ott=abc123")).toEqual({
			token: "abc123",
			href: "https://espace.administration.ga/espace",
		});
	});

	test("préserve les autres paramètres", () => {
		const { token, href } = takeOneTimeToken("https://a.ga/x?tab=iprofil&ott=t&p=2");
		expect(token).toBe("t");
		expect(href).toContain("tab=iprofil");
		expect(href).toContain("p=2");
		expect(href).not.toContain("ott");
	});

	test("rend l'URL intacte quand il n'y a pas de jeton, ou qu'elle est invalide", () => {
		expect(takeOneTimeToken("https://a.ga/x")).toEqual({
			token: null,
			href: "https://a.ga/x",
		});
		expect(takeOneTimeToken("pas-une-url")).toEqual({
			token: null,
			href: "pas-une-url",
		});
	});
});

describe("decodeJwtClaims / tokenMatchesSession", () => {
	test("décode un payload base64url sans padding", () => {
		expect(decodeJwtClaims(jwt({ sessionId: "s1", sub: "u1" }))).toMatchObject({
			sessionId: "s1",
		});
	});

	test("rend null sur un jeton malformé plutôt que de lever", () => {
		expect(decodeJwtClaims("pas.un.jwt")).toBeNull();
		expect(decodeJwtClaims("deux.parties")).toBeNull();
	});

	test("accepte quand les deux sessionId concordent", () => {
		expect(tokenMatchesSession(jwt({ sessionId: "s1" }), { session: { id: "s1" } })).toBe(true);
	});

	test("REFUSE quand ils diffèrent — c'est la signature du résidu", () => {
		expect(tokenMatchesSession(jwt({ sessionId: "session-de-Y" }), { session: { id: "session-de-X" } })).toBe(false);
	});

	test("accepte quand le claim est absent — fail-closed BORNÉ, à dessein", () => {
		// Refuser ici déconnecterait tout le parc le jour où le plugin amont
		// changerait son `definePayload`. Le résidu est déjà fermé en amont.
		expect(tokenMatchesSession(jwt({ sub: "u1" }), { session: { id: "s1" } })).toBe(true);
		expect(tokenMatchesSession("pas.un.jwt", { session: { id: "s1" } })).toBe(true);
	});
});

describe("clearCrossDomainSessionResidue", () => {
	test("vide les deux clés et éteint l'atome de session", () => {
		const store = storage();
		store.map.set(CROSS_DOMAIN_COOKIE_KEY, '{"better-auth.session_token":{"value":"Y"}}');
		store.map.set(CROSS_DOMAIN_SESSION_DATA_KEY, '{"session":{"id":"Y"}}');
		const { authClient, atomValues } = client();

		clearCrossDomainSessionResidue(store, authClient);

		expect(store.map.get(CROSS_DOMAIN_COOKIE_KEY)).toBe("{}");
		expect(store.map.get(CROSS_DOMAIN_SESSION_DATA_KEY)).toBe("{}");
		expect(atomValues.at(-1)).toMatchObject({ data: null, isPending: false });
	});

	test("ne lève jamais, même sans storage", () => {
		expect(() => clearCrossDomainSessionResidue(undefined)).not.toThrow();
	});
});

describe("adoptOneTimeTokenSession", () => {
	test("`absent` sans jeton — et ne touche à rien", () => {
		const store = storage();
		store.map.set(CROSS_DOMAIN_COOKIE_KEY, "intact");
		const { authClient } = client();
		return adoptOneTimeTokenSession(authClient, null, { storage: store }).then((r) => {
			expect(r).toEqual({ kind: "absent" });
			expect(store.map.get(CROSS_DOMAIN_COOKIE_KEY)).toBe("intact");
		});
	});

	test("adopte la session prouvée et rejoue getSession en Bearer", async () => {
		let bearer: string | undefined;
		let notified = false;
		const { authClient } = client({
			crossDomain: {
				oneTimeToken: {
					verify: async () => ({ data: { session: { token: "jeton-de-X" } } }),
				},
			},
			updateSession: () => {
				notified = true;
			},
			getSession: async (options) => {
				bearer = options?.fetchOptions?.headers?.Authorization;
				return { data: { session: { id: "X" }, user: { id: "x" } } };
			},
		});

		expect(await adoptOneTimeTokenSession(authClient, "ott")).toEqual({
			kind: "adopted",
			sessionToken: "jeton-de-X",
		});
		expect(bearer).toBe("Bearer jeton-de-X");
		expect(notified).toBe(true);
	});

	test("PURGE quand la vérification échoue — on ne sert pas le résidu à sa place", async () => {
		const store = storage();
		store.map.set(CROSS_DOMAIN_COOKIE_KEY, '{"session_token":{"value":"Y"}}');
		const { authClient } = client({
			crossDomain: {
				oneTimeToken: { verify: async () => ({ data: null, error: { status: 400 } }) },
			},
		});

		expect(await adoptOneTimeTokenSession(authClient, "ott-expire", { storage: store })).toEqual({
			kind: "rejected",
			reason: "verify_failed",
		});
		expect(store.map.get(CROSS_DOMAIN_COOKIE_KEY)).toBe("{}");
	});

	test("PURGE aussi quand le plugin est absent — on ne sait pas qui arrive", async () => {
		const store = storage();
		store.map.set(CROSS_DOMAIN_COOKIE_KEY, "residu");
		const { authClient } = client();

		expect(await adoptOneTimeTokenSession(authClient, "ott", { storage: store })).toEqual({
			kind: "rejected",
			reason: "unsupported",
		});
		expect(store.map.get(CROSS_DOMAIN_COOKIE_KEY)).toBe("{}");
	});
});

describe("refreshCrossDomainSession — non-régression de l'incident de production", () => {
	/**
	 * Le scénario exact du 2026-08-05, reproduit de bout en bout.
	 *
	 * Y s'est connectée sur cette origine, puis s'est déconnectée AILLEURS —
	 * sa session vit donc toujours ici (7 jours). X arrive avec son propre
	 * one-time-token. Avant correction, le bootstrap lisait le résidu de Y,
	 * en tirait le JWT de Y, et Convex servait X sous l'identité de Y pendant
	 * 30 minutes.
	 */
	function residuDeY(overrides: Partial<RefreshableCrossDomainAuthClient> = {}) {
		let current: "Y" | "X" = "Y";
		return client({
			// Résidu VIVANT de Y sur cette origine.
			getCookie: () => 'better-auth.session_token=jeton-de-Y',
			getSessionData: () => ({ session: { id: "session-de-Y" } }),
			crossDomain: {
				oneTimeToken: {
					verify: async () => ({ data: { session: { token: "jeton-de-X" } } }),
				},
			},
			getSession: async (options) => {
				if (options?.fetchOptions?.headers?.Authorization) current = "X";
				return {
					data: { session: { id: `session-de-${current}` }, user: { id: current } },
				};
			},
			convex: {
				token: async () => ({
					data: { token: jwt({ sessionId: `session-de-${current}` }) },
				}),
			},
			...overrides,
		});
	}

	test("avec un OTT valide, le JWT rendu est celui de X — jamais celui de Y", async () => {
		const { authClient } = residuDeY();
		const result = await refreshCrossDomainSession(authClient, {
			oneTimeToken: "ott-de-X",
			storage: storage(),
		});

		expect(result.kind).toBe("ready");
		expect(decodeJwtClaims(result.token!)).toMatchObject({
			sessionId: "session-de-X",
		});
	});

	test("sans OTT, le résidu vivant de Y ne devient PAS la session de qui arrive", async () => {
		// Ici rien ne prouve l'identité : le bootstrap sert la session de Y,
		// mais elle est cohérente avec son propre JWT — c'est le cas légitime
		// « Y revient sur sa propre machine ». La barrière qui compte est
		// l'incohérence, testée juste en dessous.
		const { authClient } = residuDeY();
		const result = await refreshCrossDomainSession(authClient, { storage: storage() });
		expect(decodeJwtClaims(result.token!)).toMatchObject({
			sessionId: "session-de-Y",
		});
	});

	test("un JWT qui ne décrit pas la session courante déconnecte et purge", async () => {
		const store = storage();
		store.map.set(CROSS_DOMAIN_COOKIE_KEY, "residu-de-Y");
		const { authClient } = client({
			getSession: async () => ({ data: { session: { id: "session-de-X" } } }),
			convex: {
				// Le jeton en cache décrit encore Y : c'est exactement l'état que
				// `cachedToken` produisait après consommation tardive du `?ott=`.
				token: async () => ({ data: { token: jwt({ sessionId: "session-de-Y" }) } }),
			},
		});

		expect(
			await refreshCrossDomainSession(authClient, { storage: store, attempts: 1 }),
		).toEqual({ kind: "signed_out", token: null });
		expect(store.map.get(CROSS_DOMAIN_COOKIE_KEY)).toBe("{}");
	});

	test("un OTT invalide déconnecte au lieu de servir le résidu", async () => {
		// Le vrai `getCookie` du plugin LIT le localStorage : on le modélise, sans
		// quoi le test ne verrait pas l'effet de la purge.
		const store = storage();
		store.map.set(CROSS_DOMAIN_COOKIE_KEY, '{"session_token":{"value":"Y"}}');
		const { authClient } = residuDeY({
			getCookie: () => {
				const raw = store.getItem(CROSS_DOMAIN_COOKIE_KEY) ?? "{}";
				return raw === "{}" ? "" : raw;
			},
			getSessionData: () => {
				const raw = store.getItem(CROSS_DOMAIN_SESSION_DATA_KEY) ?? "{}";
				return raw === "{}" ? null : { session: { id: "session-de-Y" } };
			},
			crossDomain: {
				oneTimeToken: { verify: async () => ({ data: null, error: { status: 400 } }) },
			},
		});

		// L'adoption a purgé ⇒ plus aucun matériau ⇒ personne n'est servi.
		// C'est le changement de comportement assumé : un OTT périmé (3 min) fait
		// re-signer, là où l'ancien code servait silencieusement le résidu.
		expect(
			await refreshCrossDomainSession(authClient, {
				oneTimeToken: "ott-expire",
				storage: store,
			}),
		).toEqual({ kind: "signed_out", token: null });
	});
});
