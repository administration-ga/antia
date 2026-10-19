/**
 * Banc de conformité des contrats commerciaux — FICHIER JUMEAU (voir
 * `primitives.ts`), volontairement absent de `index.ts`.
 *
 * Fonction pure : elle reçoit le contenu déjà lu des fixtures et une fonction
 * SHA-256 (fournie par le test de chaque dépôt) et rend la liste des écarts.
 * Les deux dépôts exécutent ainsi EXACTEMENT les mêmes vérifications sur les
 * MÊMES octets ; un écart nomme le fichier, le cas et la valeur obtenue.
 */
import {
  commerceBusinessRefFromRef,
  commerceCanonicalJson,
  commerceCapture,
  commerceCivilName,
  commerceNormalizeFamilyName,
  commerceNormalizeGivenNames,
  commerceRefFromBusinessRef,
  type CommerceEnvironment,
} from "./primitives";
import {
  commerceOfferPrimaryAction,
  commerceOfferPublicView,
  commerceOfferPurchasability,
  commercePublicEffect,
  commercePublicSigningText,
  decideCommercePublicRevision,
  parseCommercePublicBody,
  parseCommercePublicPayload,
  type CommerceAvailabilityEvent,
  type CommerceOfferEvent,
} from "./projection";
import {
  commerceCanStartNewPayment,
  commerceCommandSigningInput,
  decideCommerceCommandReplay,
  decideCommerceIdempotentWrite,
  decideCommerceRetryAfterTimeout,
  parseCommerceCommandRequest,
  parseCommerceCommandResponse,
  type CommerceCommandSigningComponents,
  type CommerceReceiverContext,
} from "./command";
import {
  commerceIsTerminalState,
  commerceLinkEvidenceAdmissible,
  commerceOrderPaymentCheck,
  commerceSettlementAction,
  commerceTransitionAllowed,
  deriveCommerceCapabilities,
  type CommerceCapabilityInput,
  type CommerceCheckoutState,
  type CommerceMachine,
  type CommerceOrderState,
  type CommercePaymentState,
} from "./lifecycle";

export const COMMERCE_FIXTURE_FILES = [
  "command-replay.json",
  "command-requests.json",
  "command-responses.json",
  "lifecycle.json",
  "names.json",
  "public-events.json",
  "public-revisions.json",
  "references.json",
  "signing.json",
  "views.json",
] as const;
export type CommerceFixtureFile = (typeof COMMERCE_FIXTURE_FILES)[number];

/** Sections attendues dans chaque fixture : aucune ne peut être vide. */
export const COMMERCE_FIXTURE_SECTIONS: Readonly<Record<CommerceFixtureFile, readonly string[]>> = {
  "command-replay.json": ["idempotentWrite", "newPayment", "replay", "timeout"],
  "command-requests.json": ["cases"],
  "command-responses.json": ["cases"],
  "lifecycle.json": ["capabilities", "linkEvidence", "orderPayment", "settlement", "terminal", "transitions"],
  "names.json": ["normalize", "validate"],
  "public-events.json": ["cases"],
  "public-revisions.json": ["cases"],
  "references.json": ["fromBusiness", "toBusiness"],
  "signing.json": ["command", "public"],
  "views.json": ["primaryAction", "publicView", "purchasability"],
};

export type CommerceConformanceFailure = {
  readonly detail: string;
  readonly file: string;
  readonly name: string;
};

type Row = Record<string, unknown>;

function rows(value: unknown, key: string): Row[] {
  const list = value !== null && typeof value === "object" ? (value as Row)[key] : undefined;
  return Array.isArray(list) ? (list as Row[]) : [];
}

function show(value: unknown): string {
  return commerceCanonicalJson(value) ?? String(value);
}

function same(left: unknown, right: unknown): boolean {
  const a = commerceCanonicalJson(left);
  return a !== null && a === commerceCanonicalJson(right);
}

function failureOf(result: { readonly ok: boolean; readonly reason?: string; readonly path?: string }): unknown {
  return result.ok ? { ok: true } : { ok: false, path: result.path, reason: result.reason };
}

/** Exécute toutes les fixtures ; une liste vide signifie conformité. */
export function runCommerceConformance(
  fixtures: Readonly<Partial<Record<CommerceFixtureFile, unknown>>>,
  sha256Hex: (text: string) => string,
): readonly CommerceConformanceFailure[] {
  const failures: CommerceConformanceFailure[] = [];
  const fail = (file: string, name: string, detail: string): void => {
    failures.push({ detail, file, name });
  };
  for (const file of COMMERCE_FIXTURE_FILES) {
    if (fixtures[file] === undefined) fail(file, "*", "fixture absente");
  }
  // Une section vide rendrait le banc muet : elle est un écart en soi.
  for (const [file, sections] of Object.entries(COMMERCE_FIXTURE_SECTIONS)) {
    for (const section of sections) {
      if (rows(fixtures[file as CommerceFixtureFile], section).length === 0) fail(file, section, "section vide ou absente");
    }
  }

  // ─── Projection publique ───────────────────────────────────────────────
  for (const entry of rows(fixtures["public-events.json"], "cases")) {
    const name = String(entry.name);
    const raw = typeof entry.rawBody === "string" ? entry.rawBody : commerceCanonicalJson(entry.body);
    if (raw === null) {
      fail("public-events.json", name, "corps non sérialisable");
      continue;
    }
    if (typeof entry.bodySha256 === "string" && sha256Hex(raw) !== entry.bodySha256) {
      fail("public-events.json", name, "empreinte du corps canonique différente");
    }
    const expect = entry.expect as Row;
    const result = parseCommercePublicBody(raw, entry.nowMs as number);
    if (expect.ok === true) {
      if (!result.ok) {
        fail("public-events.json", name, `refus inattendu ${show(failureOf(result))}`);
        continue;
      }
      const payload = (JSON.parse(raw) as Row).payload;
      if (result.value.payload.type !== expect.type || result.value.objectRef !== expect.objectRef) {
        fail("public-events.json", name, `type/objet ${result.value.payload.type} ${result.value.objectRef}`);
      }
      if (!same(commercePublicEffect(result.value.payload), expect.effect)) {
        fail("public-events.json", name, `effet ${show(commercePublicEffect(result.value.payload))}`);
      }
      // Le validateur ne perd ni n'ajoute rien : sa sortie est la charge reçue.
      if (!same(result.value.payload, payload)) fail("public-events.json", name, "charge normalisée différente de la charge reçue");
    } else if (!same(failureOf(result), expect)) {
      fail("public-events.json", name, `obtenu ${show(failureOf(result))}`);
    }
  }

  for (const entry of rows(fixtures["public-revisions.json"], "cases")) {
    const decision = decideCommercePublicRevision(
      entry.head as Parameters<typeof decideCommercePublicRevision>[0],
      entry.incoming as Parameters<typeof decideCommercePublicRevision>[1],
    );
    if (!same(decision, entry.expect)) fail("public-revisions.json", String(entry.name), `obtenu ${show(decision)}`);
  }

  // ─── Demandes et réponses ──────────────────────────────────────────────
  const requests = new Map<string, { raw: string; context: CommerceReceiverContext }>();
  for (const entry of rows(fixtures["command-requests.json"], "cases")) {
    const name = String(entry.name);
    const raw = typeof entry.rawBody === "string" ? entry.rawBody : commerceCanonicalJson(entry.body);
    const context = entry.context as CommerceReceiverContext;
    if (raw === null) {
      fail("command-requests.json", name, "corps non sérialisable");
      continue;
    }
    if (typeof entry.bodySha256 === "string" && sha256Hex(raw) !== entry.bodySha256) {
      fail("command-requests.json", name, "empreinte du corps canonique différente");
    }
    const expect = entry.expect as Row;
    const result = parseCommerceCommandRequest(raw, context);
    if (expect.ok === true) {
      if (!result.ok) {
        fail("command-requests.json", name, `refus inattendu ${show(failureOf(result))}`);
        continue;
      }
      const value = result.value;
      if (value.command !== expect.command || value.requestId !== expect.requestId || value.scope !== expect.scope) {
        fail("command-requests.json", name, `identité ${value.command} ${value.requestId} ${value.scope}`);
      }
      if (commerceCanonicalJson(value) !== raw) fail("command-requests.json", name, "demande normalisée différente des octets reçus");
      requests.set(name, { context, raw });
    } else if (!same(failureOf(result), expect)) {
      fail("command-requests.json", name, `obtenu ${show(failureOf(result))}`);
    }
  }

  for (const entry of rows(fixtures["command-responses.json"], "cases")) {
    const name = String(entry.name);
    const request = requests.get(String(entry.requestCase));
    if (request === undefined) {
      fail("command-responses.json", name, `demande ${String(entry.requestCase)} introuvable`);
      continue;
    }
    const requestSha256 = sha256Hex(request.raw);
    if (requestSha256 !== entry.requestSha256) fail("command-responses.json", name, "empreinte de la demande différente");
    const parsedRequest = parseCommerceCommandRequest(request.raw, request.context);
    if (!parsedRequest.ok) {
      fail("command-responses.json", name, "demande de référence refusée");
      continue;
    }
    const raw = typeof entry.rawResponse === "string" ? entry.rawResponse : commerceCanonicalJson(entry.response);
    if (raw === null) {
      fail("command-responses.json", name, "réponse non sérialisable");
      continue;
    }
    const expect = entry.expect as Row;
    const result = parseCommerceCommandResponse(raw, { request: parsedRequest.value, requestSha256 }, entry.nowMs as number);
    if (expect.ok === true) {
      if (!result.ok) {
        fail("command-responses.json", name, `refus inattendu ${show(failureOf(result))}`);
        continue;
      }
      if (result.value.outcome !== expect.outcome) fail("command-responses.json", name, `issue ${result.value.outcome}`);
      if (commerceCanonicalJson(result.value) !== raw) fail("command-responses.json", name, "réponse normalisée différente des octets reçus");
    } else if (!same(failureOf(result), expect)) {
      fail("command-responses.json", name, `obtenu ${show(failureOf(result))}`);
    }
  }

  const replay = fixtures["command-replay.json"];
  for (const entry of rows(replay, "replay")) {
    const decision = decideCommerceCommandReplay(
      entry.existing as Parameters<typeof decideCommerceCommandReplay>[0],
      entry.incoming as Parameters<typeof decideCommerceCommandReplay>[1],
      entry.nowMs as number,
    );
    if (!same(decision, entry.expect)) fail("command-replay.json", String(entry.name), `obtenu ${show(decision)}`);
  }
  for (const entry of rows(replay, "timeout")) {
    const guidance = decideCommerceRetryAfterTimeout(
      entry.status as Parameters<typeof decideCommerceRetryAfterTimeout>[0],
      entry.targetExpiresAt as number,
      entry.nowMs as number,
    );
    if (guidance !== entry.expect) fail("command-replay.json", String(entry.name), `obtenu ${guidance}`);
  }
  for (const entry of rows(replay, "newPayment")) {
    const allowed = commerceCanStartNewPayment(entry.previous as Parameters<typeof commerceCanStartNewPayment>[0]);
    if (allowed !== entry.expect) fail("command-replay.json", String(entry.name), `obtenu ${String(allowed)}`);
  }
  for (const entry of rows(replay, "idempotentWrite")) {
    const decision = decideCommerceIdempotentWrite(entry.existing as string | null, entry.incoming as string);
    if (decision !== entry.expect) fail("command-replay.json", String(entry.name), `obtenu ${decision}`);
  }

  // ─── Cycles de vie et capacités ────────────────────────────────────────
  const lifecycle = fixtures["lifecycle.json"];
  for (const entry of rows(lifecycle, "transitions")) {
    const allowed = commerceTransitionAllowed(entry.machine as CommerceMachine, String(entry.from), String(entry.to));
    if (allowed !== entry.allowed) fail("lifecycle.json", `${String(entry.machine)} ${String(entry.from)}→${String(entry.to)}`, `obtenu ${String(allowed)}`);
  }
  for (const entry of rows(lifecycle, "terminal")) {
    const terminal = commerceIsTerminalState(entry.machine as CommerceMachine, String(entry.state));
    if (terminal !== entry.expect) fail("lifecycle.json", `terminal ${String(entry.machine)} ${String(entry.state)}`, `obtenu ${String(terminal)}`);
  }
  for (const entry of rows(lifecycle, "capabilities")) {
    const capabilities = deriveCommerceCapabilities(entry.input as CommerceCapabilityInput);
    if (!same(capabilities, entry.expect)) fail("lifecycle.json", String(entry.name), `obtenu ${show(capabilities)}`);
  }
  for (const entry of rows(lifecycle, "linkEvidence")) {
    if (commerceLinkEvidenceAdmissible(String(entry.kind)) !== entry.expect) fail("lifecycle.json", `preuve ${String(entry.kind)}`, "décision inverse");
  }
  for (const entry of rows(lifecycle, "orderPayment")) {
    const check = commerceOrderPaymentCheck(entry.order as CommerceOrderState, entry.payment as CommercePaymentState | null);
    if (check !== entry.expect) fail("lifecycle.json", `commande ${String(entry.order)} / paiement ${String(entry.payment)}`, `obtenu ${check}`);
  }
  for (const entry of rows(lifecycle, "settlement")) {
    const action = commerceSettlementAction(entry.checkout as CommerceCheckoutState, entry.payment as CommercePaymentState);
    if (action !== entry.expect) fail("lifecycle.json", `règlement ${String(entry.checkout)} / ${String(entry.payment)}`, `obtenu ${action}`);
  }

  // ─── Achat, action principale, projection anonyme ──────────────────────
  const views = fixtures["views.json"] as Row | undefined;
  const offers = new Map<string, CommerceOfferEvent>();
  const sourceOffers = (views?.offers ?? {}) as Row;
  for (const [key, payload] of Object.entries(sourceOffers)) {
    const offerRef = (payload as Row).offerRef;
    const parsed = parseCommercePublicPayload(payload, String(offerRef), (payload as Row).changedAt as number);
    if (!parsed.ok || (parsed.value.type !== "offer.published" && parsed.value.type !== "offer.updated")) {
      fail("views.json", key, "offre de référence refusée");
      continue;
    }
    offers.set(key, parsed.value);
  }
  let availability: CommerceAvailabilityEvent | null = null;
  if (views?.availability !== undefined) {
    const source = views.availability as Row;
    const parsed = parseCommercePublicPayload(source, String(source.offerRef), source.changedAt as number);
    if (parsed.ok && parsed.value.type === "offer.availabilityChanged") availability = parsed.value;
    else fail("views.json", "availability", "disponibilité de référence refusée");
  }
  for (const entry of rows(views, "purchasability")) {
    const offer = offers.get(String(entry.offer));
    if (offer === undefined) continue;
    const verdict = commerceOfferPurchasability(offer, typeof entry.variantRef === "string" ? entry.variantRef : undefined, entry.nowMs as number);
    if (!same(verdict, entry.expect)) fail("views.json", `achat ${String(entry.offer)} ${String(entry.variantRef)}`, `obtenu ${show(verdict)}`);
  }
  for (const entry of rows(views, "primaryAction")) {
    const offer = offers.get(String(entry.offer));
    if (offer === undefined) continue;
    const nowMs = typeof entry.nowMs === "number" ? entry.nowMs : offer.changedAt;
    const action = commerceOfferPrimaryAction(offer, { nowMs, purchase: entry.purchase === true, quote: entry.quote === true });
    if (action !== entry.expect) fail("views.json", `action ${String(entry.offer)}`, `obtenu ${action}`);
  }
  for (const entry of rows(views, "publicView")) {
    const offer = offers.get(String(entry.offer));
    if (offer === undefined) continue;
    const view = commerceOfferPublicView(offer, entry.withAvailability === true ? availability : null, {
      nowMs: entry.nowMs as number,
      purchase: entry.purchase === true,
      quote: entry.quote === true,
    });
    const observed = {
      availability: view.availability,
      primaryAction: view.primaryAction,
      variants: view.variants.map((variant) => [variant.variantRef, variant.availability]),
    };
    if (!same(observed, entry.expect)) fail("views.json", `vue ${String(entry.offer)}`, `obtenu ${show(observed)}`);
    if (Object.prototype.hasOwnProperty.call(view, "linkRef")) fail("views.json", `vue ${String(entry.offer)}`, "référence de liaison exposée");
  }

  // ─── Références, signatures, noms ──────────────────────────────────────
  const references = fixtures["references.json"];
  for (const entry of rows(references, "fromBusiness")) {
    const value = commerceRefFromBusinessRef(String(entry.input));
    if (value !== entry.expect) fail("references.json", String(entry.input), `obtenu ${String(value)}`);
  }
  for (const entry of rows(references, "toBusiness")) {
    const value = commerceBusinessRefFromRef(String(entry.input));
    if (value !== entry.expect) fail("references.json", String(entry.input), `obtenu ${String(value)}`);
  }

  const signing = fixtures["signing.json"];
  for (const entry of rows(signing, "public")) {
    const text = commercePublicSigningText(entry.environment as CommerceEnvironment, String(entry.timestampSeconds), String(entry.rawBody));
    if (text !== entry.expect) fail("signing.json", "public", "texte signé différent");
  }
  for (const entry of rows(signing, "command")) {
    const input = commerceCommandSigningInput(entry.input as CommerceCommandSigningComponents);
    if (input !== entry.expect) fail("signing.json", String(entry.name), `obtenu ${String(input)}`);
  }

  const names = fixtures["names.json"];
  for (const entry of rows(names, "normalize")) {
    const observed = {
      firstName: commerceNormalizeGivenNames(String(entry.firstName)),
      lastName: commerceNormalizeFamilyName(String(entry.lastName)),
    };
    if (!same(observed, entry.expect)) fail("names.json", String(entry.firstName), `obtenu ${show(observed)}`);
  }
  for (const entry of rows(names, "validate")) {
    const result = commerceCapture(() => commerceCivilName(entry.civilName, "$"));
    if (!same(failureOf(result), entry.expect)) fail("names.json", show(entry.civilName), `obtenu ${show(failureOf(result))}`);
  }
  return failures;
}
