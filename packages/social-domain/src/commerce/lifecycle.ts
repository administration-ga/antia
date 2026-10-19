/**
 * Cycles de vie, capacités et cohérences du commerce ANTSIA × PRO.GA.
 *
 * FICHIER JUMEAU (voir `primitives.ts`). Les machines marquées « PRO.GA à
 * l'identique » recopient les enums de `packages/pro-domain` : un test PRO.GA
 * vérifie qu'elles ne divergent pas. Une machine décrit des CHANGEMENTS
 * d'état : une mise à jour sans changement d'état n'y figure pas.
 */
import type { CommerceRefKind } from "./primitives";
import type {
  CommerceMirrorState,
  CommerceSellerVerification,
  CommerceShopCapability,
} from "./projection";

export type CommerceTransitionMap<S extends string> = Readonly<Record<S, readonly S[]>>;

/** Liaison d'une page ANTSIA à une structure PRO.GA (double preuve, mandat vivant). */
export const COMMERCE_LINK_STATES = ["active", "expired", "pending", "refused", "revoked", "suspended"] as const;
export type CommerceLinkState = (typeof COMMERCE_LINK_STATES)[number];
export const COMMERCE_LINK_TRANSITIONS: CommerceTransitionMap<CommerceLinkState> = {
  pending: ["active", "expired", "refused"],
  active: ["revoked", "suspended"],
  suspended: ["active", "revoked"],
  expired: [],
  refused: [],
  revoked: [],
};

/** Publication d'un objet reflété (boutique, offre, emploi), vue du miroir ANTSIA. */
export const COMMERCE_PUBLICATION_STATES = ["absent", "closed", "published", "withdrawn"] as const;
export type CommercePublicationState = (typeof COMMERCE_PUBLICATION_STATES)[number];
export const COMMERCE_PUBLICATION_TRANSITIONS: CommerceTransitionMap<CommercePublicationState> = {
  absent: ["closed", "published", "withdrawn"],
  published: ["closed", "withdrawn"],
  withdrawn: ["closed", "published"],
  closed: [],
};

/** Demande commerciale (question, demande de devis, disponibilité) vue par l'acheteur. */
export const COMMERCE_INQUIRY_STATES = ["acknowledged", "closed", "declined", "quoted", "submitted", "withdrawn"] as const;
export type CommerceInquiryState = (typeof COMMERCE_INQUIRY_STATES)[number];
export const COMMERCE_INQUIRY_TRANSITIONS: CommerceTransitionMap<CommerceInquiryState> = {
  submitted: ["acknowledged", "closed", "declined", "withdrawn"],
  acknowledged: ["closed", "quoted", "withdrawn"],
  quoted: ["closed"],
  closed: [],
  declined: [],
  withdrawn: [],
};

/** Réservation de stock d'un panier : `STOCK_RESERVATION_TRANSITIONS` PRO.GA à l'identique. */
export const COMMERCE_CHECKOUT_STATES = ["consumed", "expired", "held", "released"] as const;
export type CommerceCheckoutState = (typeof COMMERCE_CHECKOUT_STATES)[number];
export const COMMERCE_CHECKOUT_TRANSITIONS: CommerceTransitionMap<CommerceCheckoutState> = {
  held: ["consumed", "released", "expired"],
  consumed: [],
  released: [],
  expired: [],
};

/** Rendez-vous : `APPOINTMENT_TRANSITIONS` PRO.GA à l'identique (expiration = `cancelled_by_pro`). */
export const COMMERCE_BOOKING_STATES = [
  "cancelled_by_client",
  "cancelled_by_pro",
  "confirmed",
  "honored",
  "no_show",
  "requested",
] as const;
export type CommerceBookingState = (typeof COMMERCE_BOOKING_STATES)[number];
export const COMMERCE_BOOKING_TRANSITIONS: CommerceTransitionMap<CommerceBookingState> = {
  requested: ["confirmed", "cancelled_by_client", "cancelled_by_pro"],
  confirmed: ["honored", "no_show", "cancelled_by_client", "cancelled_by_pro"],
  honored: [],
  no_show: [],
  cancelled_by_client: [],
  cancelled_by_pro: [],
};

/**
 * Paiement : `PAYMENT_INTENT_TRANSITIONS` PRO.GA à l'identique. `succeeded`
 * n'est écrit que par PRO.GA après preuve serveur (rappel authentifié ou
 * consultation du prestataire), jamais d'après un retour navigateur.
 */
export const COMMERCE_PAYMENT_STATES = [
  "cancelled",
  "failed",
  "pending",
  "processing",
  "requires_action",
  "succeeded",
] as const;
export type CommercePaymentState = (typeof COMMERCE_PAYMENT_STATES)[number];
export const COMMERCE_PAYMENT_TRANSITIONS: CommerceTransitionMap<CommercePaymentState> = {
  pending: ["requires_action", "processing", "succeeded", "failed", "cancelled"],
  requires_action: ["processing", "succeeded", "failed", "cancelled"],
  processing: ["succeeded", "failed", "cancelled"],
  succeeded: [],
  failed: [],
  cancelled: [],
};

/** Commande : `ORDER_TRANSITIONS` PRO.GA à l'identique. */
export const COMMERCE_ORDER_STATES = [
  "cancelled",
  "completed",
  "confirmed",
  "delivered",
  "disputed",
  "in_progress",
  "pending",
  "ready",
  "resolved",
  "shipped",
] as const;
export type CommerceOrderState = (typeof COMMERCE_ORDER_STATES)[number];
export const COMMERCE_ORDER_TRANSITIONS: CommerceTransitionMap<CommerceOrderState> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["in_progress", "cancelled"],
  in_progress: ["ready", "shipped", "cancelled"],
  ready: ["delivered"],
  shipped: ["delivered"],
  delivered: ["completed", "disputed"],
  disputed: ["resolved"],
  resolved: ["completed"],
  completed: [],
  cancelled: [],
};

/** Remboursement demandé : nouveau (PRO.GA ne constate aujourd'hui qu'un remboursement externe). */
export const COMMERCE_REFUND_STATES = ["failed", "processing", "rejected", "requested", "succeeded"] as const;
export type CommerceRefundState = (typeof COMMERCE_REFUND_STATES)[number];
export const COMMERCE_REFUND_TRANSITIONS: CommerceTransitionMap<CommerceRefundState> = {
  requested: ["processing", "rejected"],
  processing: ["succeeded", "failed"],
  succeeded: [],
  failed: [],
  rejected: [],
};

/** Devis vu par l'acheteur : `QUOTE_TRANSITIONS` PRO.GA à l'identique. */
export const COMMERCE_QUOTE_STATES = [
  "accepted",
  "draft",
  "expired",
  "negotiating",
  "rejected",
  "sent",
  "viewed",
  "withdrawn",
] as const;
export type CommerceQuoteState = (typeof COMMERCE_QUOTE_STATES)[number];
export const COMMERCE_QUOTE_TRANSITIONS: CommerceTransitionMap<CommerceQuoteState> = {
  draft: ["sent"],
  sent: ["viewed", "accepted", "rejected", "expired", "withdrawn"],
  viewed: ["negotiating", "accepted", "rejected", "expired", "withdrawn"],
  negotiating: ["accepted", "rejected", "expired", "withdrawn"],
  accepted: [],
  rejected: [],
  expired: [],
  withdrawn: [],
};

/** Candidature : `APPLICATION_TRANSITIONS` PRO.GA à l'identique. */
export const COMMERCE_APPLICATION_STATES = [
  "hired",
  "interview",
  "offer",
  "received",
  "rejected",
  "screening",
  "withdrawn",
] as const;
export type CommerceApplicationState = (typeof COMMERCE_APPLICATION_STATES)[number];
export const COMMERCE_APPLICATION_TRANSITIONS: CommerceTransitionMap<CommerceApplicationState> = {
  received: ["screening", "interview", "offer", "rejected", "withdrawn"],
  screening: ["interview", "offer", "rejected", "withdrawn"],
  interview: ["offer", "rejected", "withdrawn"],
  offer: ["hired", "rejected", "withdrawn"],
  hired: [],
  rejected: [],
  withdrawn: [],
};

/** Offre enregistrée par `catalog.draft.save` : `OFFER_TRANSITIONS` PRO.GA à l'identique. */
export const COMMERCE_OFFER_STATES = ["archived", "draft", "paused", "pending_review", "published", "rejected"] as const;
export type CommerceOfferState = (typeof COMMERCE_OFFER_STATES)[number];
export const COMMERCE_OFFER_TRANSITIONS: CommerceTransitionMap<CommerceOfferState> = {
  draft: ["pending_review", "published", "archived"],
  pending_review: ["published", "rejected"],
  rejected: ["draft"],
  published: ["paused", "archived"],
  paused: ["published", "archived"],
  archived: [],
};

export const COMMERCE_MACHINES = {
  application: COMMERCE_APPLICATION_TRANSITIONS,
  booking: COMMERCE_BOOKING_TRANSITIONS,
  checkout: COMMERCE_CHECKOUT_TRANSITIONS,
  inquiry: COMMERCE_INQUIRY_TRANSITIONS,
  link: COMMERCE_LINK_TRANSITIONS,
  offer: COMMERCE_OFFER_TRANSITIONS,
  order: COMMERCE_ORDER_TRANSITIONS,
  payment: COMMERCE_PAYMENT_TRANSITIONS,
  publication: COMMERCE_PUBLICATION_TRANSITIONS,
  quote: COMMERCE_QUOTE_TRANSITIONS,
  refund: COMMERCE_REFUND_TRANSITIONS,
} as const;
export type CommerceMachine = keyof typeof COMMERCE_MACHINES;

function machineMap(machine: CommerceMachine): Readonly<Record<string, readonly string[]>> {
  return COMMERCE_MACHINES[machine] as Readonly<Record<string, readonly string[]>>;
}

export function commerceMachineStates(machine: CommerceMachine): readonly string[] {
  return Object.keys(machineMap(machine)).sort();
}

/** Transition autorisée ; un état inconnu n'autorise rien (fail-closed). */
export function commerceTransitionAllowed(machine: CommerceMachine, from: string, to: string): boolean {
  const map = machineMap(machine);
  if (!Object.prototype.hasOwnProperty.call(map, from) || !Object.prototype.hasOwnProperty.call(map, to)) return false;
  return (map[from] ?? []).includes(to);
}

export function commerceIsTerminalState(machine: CommerceMachine, state: string): boolean {
  const map = machineMap(machine);
  return Object.prototype.hasOwnProperty.call(map, state) && (map[state] ?? []).length === 0;
}

/** Objets privés dont PRO.GA rend l'état à leur seul sujet (`request.status`). */
export const COMMERCE_PRIVATE_OBJECT_MACHINES = {
  appointment: "booking",
  checkout: "checkout",
  commerce_link: "link",
  inquiry: "inquiry",
  job_application: "application",
  offer: "offer",
  order: "order",
  payment_intent: "payment",
  quote: "quote",
  refund: "refund",
} as const satisfies Partial<Record<CommerceRefKind, CommerceMachine>>;
export type CommercePrivateObjectKind = keyof typeof COMMERCE_PRIVATE_OBJECT_MACHINES;
export const COMMERCE_PRIVATE_OBJECT_KINDS = Object.keys(COMMERCE_PRIVATE_OBJECT_MACHINES).sort() as readonly CommercePrivateObjectKind[];

// ─── Capacités ───────────────────────────────────────────────────────────────

export type CommerceMemberStatus = "active" | "none" | "suspended";

/**
 * Entrées des capacités d'une boutique. AUCUN badge ni niveau d'identité :
 * « Vérifié », « Officiel » ou une vérification IDN n'ouvrent aucun droit
 * vendeur, et un mandat PRO.GA ne se déduit ni d'un e-mail ni d'un handle.
 */
export type CommerceCapabilityInput = {
  readonly contactEnabled: boolean;
  readonly link: CommerceLinkState | null;
  readonly memberStatus: CommerceMemberStatus;
  readonly networkCommerceEnabled: boolean;
  readonly proShop: {
    readonly capabilities: readonly CommerceShopCapability[];
    readonly sellerVerification: CommerceSellerVerification;
    readonly state: CommerceMirrorState;
  } | null;
  readonly shopRemoved: boolean;
  readonly storefrontAdmitted: boolean;
};

export type CommerceCapabilities = {
  readonly booking: boolean;
  readonly catalog: boolean;
  readonly contact: boolean;
  readonly draft: boolean;
  readonly jobs: boolean;
  readonly purchase: boolean;
  readonly quote: boolean;
  readonly storefront: boolean;
};

/**
 * Brouillon → vitrine → contact → achat, chacune exigeant la précédente.
 * L'achat exige en plus une liaison active, une boutique publiée par PRO.GA
 * avec la capacité `checkout` d'une structure vérifiée, et l'interrupteur
 * commercial du réseau. Indicatif pour l'interface : chaque commande est
 * rejugée par PRO.GA.
 */
export function deriveCommerceCapabilities(input: CommerceCapabilityInput): CommerceCapabilities {
  const draft = input.memberStatus === "active" && !input.shopRemoved;
  const storefront = draft && input.storefrontAdmitted;
  const contact = storefront && input.contactEnabled;
  const shop = input.proShop;
  const linked = storefront && input.networkCommerceEnabled && input.link === "active" && shop !== null && shop.state === "active";
  const admits = (capability: CommerceShopCapability): boolean => linked && shop !== null && shop.capabilities.includes(capability);
  return {
    booking: admits("booking"),
    catalog: admits("catalog"),
    contact,
    draft,
    jobs: admits("jobs"),
    purchase: admits("checkout") && shop !== null && shop.sellerVerification === "verified",
    quote: admits("quote"),
    storefront,
  };
}

/** Seule preuve de liaison admise : la double preuve (session ANTSIA + authentification PRO.GA + PKCE). */
export const COMMERCE_LINK_EVIDENCE = ["double_proof_pkce"] as const;
/** Bases de rapprochement REFUSÉES : jamais de fusion de comptes ni de mandat déduit. */
export const COMMERCE_REFUSED_LINK_BASES = ["badge", "email_match", "handle_match", "name_match", "phone_match"] as const;

export function commerceLinkEvidenceAdmissible(kind: string): boolean {
  return (COMMERCE_LINK_EVIDENCE as readonly string[]).includes(kind);
}

// ─── Cohérences entre machines indépendantes ─────────────────────────────────

const PAID_ORDER_STATES: readonly CommerceOrderState[] = [
  "completed",
  "confirmed",
  "delivered",
  "disputed",
  "in_progress",
  "ready",
  "resolved",
  "shipped",
];
const OPEN_PAYMENT_STATES: readonly CommercePaymentState[] = ["pending", "processing", "requires_action"];

export type CommerceOrderPaymentCheck = "coherent" | "incoherent" | "refund_required";

/**
 * Commande prépayée (panier) et paiement : trois machines indépendantes
 * (commande, paiement, remise) mais jamais une commande avancée sans paiement
 * `succeeded`, ni un paiement ouvert sur une commande annulée.
 */
export function commerceOrderPaymentCheck(
  order: CommerceOrderState,
  payment: CommercePaymentState | null,
): CommerceOrderPaymentCheck {
  if (PAID_ORDER_STATES.includes(order)) return payment === "succeeded" ? "coherent" : "incoherent";
  if (order === "pending") return payment === "succeeded" ? "incoherent" : "coherent";
  if (payment === "succeeded") return "refund_required";
  return payment !== null && OPEN_PAYMENT_STATES.includes(payment) ? "incoherent" : "coherent";
}

export type CommerceSettlementAction = "consume_reservation" | "none" | "reacquire_or_refund";

/**
 * Paiement confirmé face à la réservation du panier. Confirmé après
 * expiration ou libération : réacquérir le stock si possible, sinon
 * rembourser par procédure explicite — jamais livrer un article inexistant
 * ni ignorer un paiement reçu.
 */
export function commerceSettlementAction(
  checkout: CommerceCheckoutState,
  payment: CommercePaymentState,
): CommerceSettlementAction {
  if (payment !== "succeeded") return "none";
  if (checkout === "held") return "consume_reservation";
  return checkout === "consumed" ? "none" : "reacquire_or_refund";
}
