/**
 * Animation des comptes fictifs DÉJÀ inscrits par le parcours OTP.
 * Aucun compte, profil, consentement d'accueil, identité ou droit n'est créé ici.
 * Les clés sont stables ; un rejeu ne republie pas ce que son auteur a retiré.
 */
import { normalizeFamilyName, normalizeGivenNames } from "@antsia/social-domain/civilName"
import { missingConsentsToJoin } from "@antsia/social-domain/consent"
import { canonicalPair } from "@antsia/social-domain/connectionState"
import { assertHeadline, assertPersonalCommentBody, assertPostContent } from "@antsia/social-domain/content"
import { assertPageHandle, assertPageName, normalizePageDescription, pageTrustRank } from "@antsia/social-domain/pages"
import type { ProvinceSlug } from "@antsia/social-domain/provinces"
import { assertStoryCaption, assertStoryMedia, storyExpiresAt, STORY_ACTIVE_PER_AUTHOR_MAX } from "@antsia/social-domain/stories"
import { normalizeSha256 } from "@antsia/social-domain/uploadPolicy"
import { v } from "convex/values"

import { components } from "../_generated/api"
import type { Doc, Id } from "../_generated/dataModel"
import { internalMutation, internalQuery, type MutationCtx, type QueryCtx } from "../_generated/server"
import { getMembership, getRootNetwork } from "../lib/access"
import { checked, fail } from "../lib/errors"
import { assertFreshUpload, registerGeneratedBlob } from "../modules/files/admission"
import { followerCounts } from "../modules/graph/follows"
import { findConnection, isBlockedBetween } from "../modules/graph/graph"
import type { StoredMedia } from "../modules/media/media"
import { assertSocialWriteAllowed, contentState, moderateContentWrite } from "../modules/moderation/policy"
import { assertPageHandleFree, pageSearchText } from "../modules/pages/access"
import { syncPersonDirectory } from "../modules/people/directory"
import { isDiscoverablePerson } from "../modules/people/miniProfile"
import { appendAudit } from "../modules/platform/audit"
import { applyReactionDelta, recordComment, recordPageFollower } from "../modules/posts/counters"
import { refreshReaderFeed } from "../modules/posts/feedMaterialization"
import { writePost } from "../modules/posts/postWrite"
import { SHOP_PUBLIC_LISTING_TEXT_VERSION } from "../modules/shops/rules"
import { assertDemoContentAllowed, DEMO_CONTENT_VERSION } from "./demoContentConfig"
import { DEMO_MEDIA_MANIFEST } from "./demoMediaManifest"

type ReadCtx = Pick<QueryCtx, "db" | "runQuery">
type Actor = "membre" | "verifie" | "presse" | "commercant" | "association" | "administration" | "moderateur"
type ActorSpec = { actor: Actor; handle: string; givenNames: string; familyName: string; originalHeadline: string; headline: string; asset: string; story: string }

/** L'identité est celle du catalogue OTP ; le huitième acteur, « nouveau », est exclu. */
export const DEMO_CONTENT_PERSONAS: readonly ActorSpec[] = [
  { actor: "membre", handle: "membre.demo", givenNames: "awa", familyName: "mba", originalHeadline: "Membre du réseau, à Libreville", headline: "Technicienne informatique à Libreville · Démo", asset: "service-informatique", story: "Démo · Une matinée à préparer un atelier informatique fictif." },
  { actor: "verifie", handle: "verifie.demo", givenNames: "jean-rémy", familyName: "ndong", originalHeadline: "Membre vérifié par IDN (démonstration)", headline: "Photographe et créateur à Libreville · Démo", asset: "service-photo", story: "Démo · Préparation d'une séance photo fictive au studio." },
  { actor: "presse", handle: "presse.demo", givenNames: "sylvie", familyName: "oyane", originalHeadline: "Journaliste à Gabon Actu Démo", headline: "Journaliste à Gabon Actu Démo · Actualités fictives", asset: "association-littoral", story: "Démo · Carnet de reportage fictif sur le littoral." },
  { actor: "commercant", handle: "commercant.demo", givenNames: "patrick", familyName: "moussavou", originalHeadline: "Commerçant à Owendo", headline: "Épicier à Owendo · Produits du quotidien · Démo", asset: "epicerie-produits", story: "Démo · Présentation fictive des produits de notre épicerie." },
  { actor: "association", handle: "association.demo", givenNames: "clarisse", familyName: "ella", originalHeadline: "Présidente d'une association de démonstration", headline: "Entraide et lecture à Lambaréné · Association Démo", asset: "association-lecture", story: "Démo · Des livres prêts pour notre rencontre fictive." },
  { actor: "administration", handle: "administration.demo", givenNames: "paul-henri", familyName: "nze", originalHeadline: "Agent de la Mairie Démo", headline: "Accueil et vie municipale · Mairie Démo fictive", asset: "association-littoral", story: "Démo · Un projet fictif de sensibilisation au cadre de vie." },
  { actor: "moderateur", handle: "moderation.demo", givenNames: "nadège", familyName: "koumba", originalHeadline: "Modératrice du réseau (démonstration)", headline: "Modératrice · Échanges respectueux et entraide · Démo", asset: "association-lecture", story: "Démo · Une pause lecture pour préparer un échange fictif." },
]

type PageSpec = { handle: string; actor: Actor; name: string; description: string; ownerKind: "media" | "company" | "association" | "institution"; trust: "verified" | "community" | "official"; asset: string; create?: true; model?: "products" | "quote_services" }
export const DEMO_CONTENT_PAGES: readonly PageSpec[] = [
  { handle: "gabon-actu-demo", actor: "presse", name: "Gabon Actu Démo", description: "Média fictif de démonstration : actualités locales et reportages.", ownerKind: "media", trust: "verified", asset: "association-littoral" },
  { handle: "epicerie-moussavou-demo", actor: "commercant", name: "Épicerie Moussavou Démo", description: "Boutique fictive de démonstration : produits du quotidien.", ownerKind: "company", trust: "community", asset: "epicerie-produits", model: "products" },
  { handle: "jeunes-lambarene-demo", actor: "association", name: "Jeunes de Lambaréné Démo", description: "Association fictive de démonstration : entraide et activités pour les jeunes.", ownerKind: "association", trust: "community", asset: "association-lecture" },
  { handle: "mairie-demo", actor: "administration", name: "Mairie Démo", description: "Institution fictive de démonstration : communiqués et services municipaux.", ownerKind: "institution", trust: "official", asset: "association-littoral" },
  { handle: "studio-objectif-demo", actor: "verifie", name: "Studio Objectif Démo", description: "Studio photo fictif de démonstration : portraits, produits et reportages à Libreville.", ownerKind: "company", trust: "community", asset: "service-photo", create: true, model: "quote_services" },
  { handle: "atelier-tech-demo", actor: "membre", name: "Atelier Tech Démo", description: "Atelier informatique fictif de démonstration : diagnostic, entretien et accompagnement à Libreville.", ownerKind: "company", trust: "community", asset: "service-informatique", create: true, model: "quote_services" },
]

type PostSpec = { key: string; actor: Actor; body: string; province: ProvinceSlug; page?: string; asset?: string }
/** 14 publications personnelles et 7 publications de pages, explicitement fictives. */
export const DEMO_CONTENT_POSTS: readonly PostSpec[] = [
  { key: "membre-atelier", actor: "membre", province: "estuaire", body: "Démo — À Libreville, je prépare un petit atelier fictif pour apprendre à entretenir son ordinateur : sauvegardes, rangement et mises à jour. Quel geste aimeriez-vous revoir ensemble ? #Estuaire #Informatique #Entraide" },
  { key: "membre-decouverte", actor: "membre", province: "haut-ogooue", body: "Démo — Dans notre carnet de voyage fictif, étape à Franceville : prendre le temps d'échanger avec les artisans et de découvrir leurs savoir-faire. Vos idées enrichissent cette conversation de démonstration. #HautOgooue #Decouverte" },
  { key: "verifie-creation", actor: "verifie", province: "estuaire", asset: "sac-wax", body: "Démo — Exercice photo fictif au studio : faire ressortir les couleurs d'un sac en wax, avec une lumière douce et un fond simple. L'image sert à illustrer notre réseau de démonstration. #Estuaire #Creation #Photo" },
  { key: "verifie-promenade", actor: "verifie", province: "ogooue-lolo", body: "Démo — Je compose un reportage imaginaire autour d'une promenade à Koulamoutou, entre paysage, rencontres et vie quotidienne. Ce récit fictif ouvre la discussion sur les regards que l'on porte sur nos provinces. #OgooueLolo #Photographie" },
  { key: "presse-carnet", actor: "presse", province: "ogooue-maritime", body: "Démo — Carnet de rédaction fictif : raconter une action citoyenne sur le littoral sans oublier celles et ceux qui y participent. Vérifier les faits et demander l'accord avant une photo restent de bonnes habitudes. #OgooueMaritime #VieLocale" },
  { key: "presse-lecture", actor: "presse", province: "woleu-ntem", body: "Démo — Notre sujet fictif du jour : les lieux de lecture et de rencontre à Oyem. Une bibliothèque, un club ou une initiative de quartier peuvent donner envie d'apprendre ensemble. #WoleuNtem #Lecture #Culture" },
  { key: "commercant-savon", actor: "commercant", province: "estuaire", asset: "savon-artisanal", body: "Démo — À l'épicerie fictive d'Owendo, nous préparons une présentation de savons artisanaux. Cette publication montre le quotidien d'une petite activité ; elle ne déclenche aucune commande ni aucun paiement. #Estuaire #Artisanat #CommerceLocal" },
  { key: "commercant-voisins", actor: "commercant", province: "nyanga", body: "Démo — Une idée pour notre boutique fictive : un carnet de recettes du quotidien, inspiré des échanges avec nos voisins de Tchibanga. Quelle recette familiale aimeriez-vous raconter ? #Nyanga #Cuisine #Partage" },
  { key: "association-littoral", actor: "association", province: "ogooue-maritime", asset: "association-littoral", body: "Démo — Notre association fictive imagine une sortie collective sur le littoral : observer, ramasser les déchets et discuter du cadre de vie. Il s'agit d'un scénario de démonstration, sans appel à une inscription réelle. #OgooueMaritime #Entraide #Environnement" },
  { key: "association-carnet", actor: "association", province: "moyen-ogooue", body: "Démo — À Lambaréné, nous préparons une rencontre de lecture fictive : chacun apporte un livre et raconte ce qu'il lui a donné envie de découvrir. Les petits groupes permettent à toutes les voix de trouver leur place. #MoyenOgooue #Lecture #Association" },
  { key: "administration-accueil", actor: "administration", province: "ngounie", body: "Démo — À la Mairie Démo, notre exercice fictif porte sur un accueil plus clair : expliquer les étapes, écouter la demande et orienter vers le bon interlocuteur. Ce compte ne représente aucune administration réelle. #Ngounie #Accueil #VieLocale" },
  { key: "administration-idees", actor: "administration", province: "estuaire", body: "Démo — Un espace vert bien entretenu peut devenir un lieu de rencontre. Pour ce scénario municipal fictif, nous échangeons sur l'ombre, les bancs et la propreté des chemins. Quelle idée choisiriez-vous en premier ? #Estuaire #CadreDeVie" },
  { key: "moderateur-bienvenue", actor: "moderateur", province: "ogooue-ivindo", body: "Démo — Bienvenue dans cet espace d'échanges fictifs. Pour aider quelqu'un, commençons par une question claire et une réponse respectueuse ; les désaccords peuvent rester courtois. #OgooueIvindo #Entraide #VieDuReseau" },
  { key: "moderateur-prudence", actor: "moderateur", province: "estuaire", body: "Démo — Petit rappel pour notre communauté de démonstration : demander l'accord avant de publier la photo d'une personne, garder ses coordonnées privées et signaler un contenu qui pose problème. #Estuaire #Respect #VieDuReseau" },
  { key: "page-presse", actor: "presse", page: "gabon-actu-demo", province: "ogooue-maritime", body: "Gabon Actu Démo — Dans ce reportage fictif, des habitants prennent soin du littoral et partagent leurs idées pour le préserver. Ce média de démonstration publie ici un exemple de récit local, sans actualité réelle annoncée. #OgooueMaritime #Environnement #VieLocale" },
  { key: "page-epicerie", actor: "commercant", page: "epicerie-moussavou-demo", province: "estuaire", asset: "epicerie-produits", body: "Épicerie Moussavou Démo — Présentation fictive de nos boissons au bissap et au gingembre, accompagnées d'une confiture d'ananas. Des images pour découvrir une vitrine de démonstration, sans vente réelle. #Estuaire #ProduitsLocaux #Epicerie" },
  { key: "page-association", actor: "association", page: "jeunes-lambarene-demo", province: "moyen-ogooue", asset: "association-lecture", body: "Jeunes de Lambaréné Démo — Notre cercle de lecture fictif réunit des jeunes autour de livres et d'histoires à partager. Cet exemple présente la vie d'une association de démonstration ; aucune rencontre réelle n'est programmée. #MoyenOgooue #Lecture #Jeunesse" },
  { key: "page-mairie", actor: "administration", page: "mairie-demo", province: "estuaire", body: "Mairie Démo — Exemple de communiqué fictif : prenons soin des espaces communs en prévoyant des points de collecte et des moments de sensibilisation. Cette page de démonstration ne diffuse aucune décision administrative réelle. #Estuaire #CadreDeVie #Commune" },
  { key: "page-studio", actor: "verifie", page: "studio-objectif-demo", province: "estuaire", asset: "service-photo", body: "Studio Objectif Démo — Portraits, photos de produits et petits reportages : notre studio fictif présente ici ses prestations sur devis. Les demandes servent uniquement à découvrir le parcours de démonstration, sans réservation ni facturation réelle. #Estuaire #Photographie #Services" },
  { key: "page-atelier", actor: "membre", page: "atelier-tech-demo", province: "estuaire", asset: "service-informatique", body: "Atelier Tech Démo — Diagnostic, entretien et accompagnement informatique : une activité fictive pour découvrir les prestations du réseau. Nous présentons un scénario de devis de démonstration, sans intervention ni paiement réel. #Estuaire #Informatique #Services" },
  { key: "page-panier", actor: "commercant", page: "epicerie-moussavou-demo", province: "estuaire", asset: "panier-raphia", body: "Épicerie Moussavou Démo — Un panier en raphia accompagne notre sélection fictive de produits du quotidien. Cette vitrine de démonstration met en valeur les matières et les savoir-faire ; aucun achat réel n'est proposé. #Estuaire #Raphia #Artisanat" },
]

const COMMENTS = [
  "Démo — Un atelier en petit groupe permettrait de poser ses questions tranquillement.",
  "Démo — Prendre le temps d'écouter les artisans donnerait une belle place à leurs récits.",
  "Démo — La lumière douce fait bien ressortir les détails de cette création fictive.",
  "Démo — J'aimerais découvrir les paysages à travers ce carnet imaginaire.",
  "Démo — Expliquer comment un reportage se prépare rend la démarche plus claire.",
  "Démo — Un club de lecture donnerait envie de partager nos découvertes.",
  "Démo — Cette présentation fictive aide à imaginer la vie d'une petite boutique.",
  "Démo — Les recettes transmises en famille racontent aussi notre quotidien.",
  "Démo — Prévoir le tri dès le départ rendrait cette sortie fictive plus utile.",
  "Démo — Chacun pourrait proposer un livre et expliquer son choix.",
  "Démo — Des étapes expliquées simplement faciliteraient cet accueil fictif.",
  "Démo — L'ombre et des chemins propres seraient un bon début pour ce scénario.",
] as const

function postKey(spec: PostSpec): string { return `${DEMO_CONTENT_VERSION}:post:${spec.key}` }
function storyKey(actor: Actor, now: number): string { return `${DEMO_CONTENT_VERSION}:story:${actor}:${new Date(now).toISOString().slice(0, 10)}` }

function expectedName(spec: ActorSpec): string {
  return `${normalizeGivenNames(spec.givenNames)} ${normalizeFamilyName(spec.familyName)}`
}

async function publishedState(ctx: Pick<QueryCtx, "db">, kind: "person" | "page" | "post" | "story", id: string): Promise<boolean> {
  const state = await contentState(ctx, kind, id)
  return state === null || state.status === "published"
}

/** Toutes les préconditions sont relues AVANT la première écriture. */
async function demoContext(ctx: ReadCtx, confirmation: string) {
  assertDemoContentAllowed(confirmation)
  const root = await getRootNetwork(ctx)
  if (!root || root.slug !== "antsia" || root.kind !== "root" || root.status !== "active" || root.managedBy !== undefined) return fail("policyRefused")
  const people = new Map<Actor, Doc<"persons">>()
  for (const spec of DEMO_CONTENT_PERSONAS) {
    const person = await ctx.db.query("persons").withIndex("by_handle", q => q.eq("handle", spec.handle)).unique()
    if (!person || !isDiscoverablePerson(person) || person.displayName !== expectedName(spec)) return fail("policyRefused")
    const user = await ctx.runQuery(components.betterAuth.adapter.findOne, {
      model: "user", where: [{ field: "_id", value: person.authUserId }], select: ["_id", "email", "emailVerified"],
    }) as { _id: string; email: string; emailVerified?: boolean } | null
    if (!user || user._id !== person.authUserId || user.emailVerified !== true || user.email !== `${spec.actor}@demo.antsia.test`) return fail("policyRefused")
    const membership = await getMembership(ctx, root._id, person._id)
    if (!membership || (membership.status !== "declaree" && membership.status !== "verifiee") || membership.leftAt !== undefined) return fail("policyRefused")
    const consents = await ctx.db.query("consents").withIndex("by_person_and_purpose", q => q.eq("personId", person._id)).take(101)
    if (consents.length > 100 || missingConsentsToJoin(consents).length > 0 || !await publishedState(ctx, "person", person._id)) return fail("policyRefused")
    await assertSocialWriteAllowed(ctx, root._id, person._id)
    people.set(spec.actor, person)
  }
  return { root, people }
}

function actorPerson(people: Map<Actor, Doc<"persons">>, actor: Actor): Doc<"persons"> {
  const person = people.get(actor)
  if (!person) throw new Error("Acteur de démonstration absent.")
  return person
}

/** Une page éditée, retirée ou dont l'administration a été révoquée n'est pas reprise. */
async function availablePage(ctx: Pick<QueryCtx, "db">, root: Doc<"networks">, person: Doc<"persons">, spec: PageSpec): Promise<Doc<"pages"> | null> {
  const page = await ctx.db.query("pages").withIndex("by_handle", q => q.eq("handle", spec.handle)).unique()
  if (!page) return null
  if (page.networkId !== root._id || page.createdByPersonId !== person._id) return fail("conflict")
  if (page.status !== "active" || page.deactivatedAt !== undefined || page.name !== spec.name || page.description !== spec.description || page.ownerKind !== spec.ownerKind || !await publishedState(ctx, "page", page._id)) return null
  const signatory = await ctx.db.query("pageSignatories").withIndex("by_page_person", q => q.eq("pageId", page._id).eq("personId", person._id)).unique()
  return signatory?.role === "admin" && signatory.acceptedAt !== undefined ? page : null
}

async function ensurePages(ctx: MutationCtx, root: Doc<"networks">, people: Map<Actor, Doc<"persons">>): Promise<Map<string, Doc<"pages">>> {
  const pages = new Map<string, Doc<"pages">>()
  for (const spec of DEMO_CONTENT_PAGES) {
    const person = actorPerson(people, spec.actor)
    const existing = await ctx.db.query("pages").withIndex("by_handle", q => q.eq("handle", spec.handle)).unique()
    if (!existing && spec.create) {
      const handle = checked(() => assertPageHandle(spec.handle))
      await assertPageHandleFree(ctx, handle)
      const name = checked(() => assertPageName(spec.name))
      const description = checked(() => normalizePageDescription(spec.description))
      const now = Date.now()
      const pageId = await ctx.db.insert("pages", { networkId: root._id, handle, name, description, ownerKind: spec.ownerKind, trust: spec.trust, trustRank: pageTrustRank(spec.trust), country: "GA", city: "Libreville", visibility: "root", onRoot: true, status: "active", createdByPersonId: person._id, searchText: pageSearchText({ name, handle }), createdAt: now, updatedAt: now })
      await ctx.db.insert("pageSignatories", { networkId: root._id, pageId, personId: person._id, role: "admin", acceptedAt: now, createdAt: now, updatedAt: now })
      await moderateContentWrite(ctx, { networkId: root._id, ownerPersonId: person._id, kind: "page", id: pageId, text: `${name} ${description ?? ""}` })
    }
    const page = await availablePage(ctx, root, person, spec)
    if (page) pages.set(spec.handle, page)
  }
  return pages
}

/** Le propriétaire a explicitement demandé l'animation publique de ces boutiques fictives. */
async function ensureShops(ctx: MutationCtx, root: Doc<"networks">, people: Map<Actor, Doc<"persons">>, pages: Map<string, Doc<"pages">>): Promise<void> {
  for (const spec of DEMO_CONTENT_PAGES) {
    const page = pages.get(spec.handle)
    if (!page || !spec.model) continue
    const person = actorPerson(people, spec.actor)
    const existing = await ctx.db.query("shops").withIndex("by_page", q => q.eq("pageId", page._id)).unique()
    if (existing) {
      if (existing.networkId !== root._id || existing.model !== spec.model || (existing.preparedByPersonId !== person._id && existing.ownerPersonId !== person._id)) return fail("conflict")
      // Un retrait de vitrine ou de consentement n'est jamais annulé par le rejeu.
      if (existing.storefront !== "published" || existing.publicConsentRevokedAt !== undefined || existing.publicConsentAt !== undefined) continue
      await ctx.db.patch(existing._id, { publicConsentAt: Date.now(), publicConsentTextVersion: SHOP_PUBLIC_LISTING_TEXT_VERSION, publicConsentByPersonId: person._id, updatedAt: Date.now() })
      continue
    }
    // Seules les deux NOUVELLES pages de services reçoivent une nouvelle boutique.
    if (!spec.create) continue
    const now = Date.now()
    const shopId = await ctx.db.insert("shops", { networkId: root._id, preparedByPersonId: person._id, pageId: page._id, model: spec.model, storefront: "published", requestedAt: now, decidedAt: now, publishedAt: now, visibility: "root", publicConsentAt: now, publicConsentTextVersion: SHOP_PUBLIC_LISTING_TEXT_VERSION, publicConsentByPersonId: person._id, createdAt: now, updatedAt: now })
    await appendAudit(ctx, { action: "shop.storefront_decide", capacity: "system", networkId: root._id, subject: { table: "shops", id: shopId }, details: { reason: "Animation explicitement demandée des seules activités fictives de démonstration.", decision: "published", version: DEMO_CONTENT_VERSION } })
  }
}

/** Graphe initial seulement : le rejeu respecte ensuite désabonnements et ruptures. */
async function seedGraph(ctx: MutationCtx, root: Doc<"networks">, people: Map<Actor, Doc<"persons">>, pages: Map<string, Doc<"pages">>): Promise<void> {
  for (let index = 0; index < DEMO_CONTENT_PERSONAS.length; index += 1) {
    const source = DEMO_CONTENT_PERSONAS[index]
    const next = DEMO_CONTENT_PERSONAS[(index + 1) % DEMO_CONTENT_PERSONAS.length]
    const second = DEMO_CONTENT_PERSONAS[(index + 2) % DEMO_CONTENT_PERSONAS.length]
    if (!source || !next || !second) continue
    const person = actorPerson(people, source.actor)
    const target = actorPerson(people, next.actor)
    if (!await isBlockedBetween(ctx, person._id, target._id) && !await findConnection(ctx, root._id, person._id, target._id)) {
      const pair = canonicalPair(person._id, target._id)
      const now = Date.now()
      await ctx.db.insert("connections", { networkId: root._id, personIdLow: pair.low, personIdHigh: pair.high, requestedByPersonId: person._id, recipientPersonId: target._id, status: "accepted", requestedAt: now, respondedAt: now, updatedAt: now })
    }
    for (const targetSpec of [next, second]) {
      const followed = actorPerson(people, targetSpec.actor)
      if (await isBlockedBetween(ctx, person._id, followed._id)) continue
      const existing = await ctx.db.query("follows").withIndex("by_network_follower_target", q => q.eq("networkId", root._id).eq("followerPersonId", person._id).eq("targetPersonId", followed._id)).unique()
      if (existing) continue
      const id = await ctx.db.insert("follows", { networkId: root._id, followerPersonId: person._id, targetPersonId: followed._id, createdAt: Date.now() })
      const row = await ctx.db.get(id)
      if (row) await followerCounts.insert(ctx, row)
    }
    for (const page of pages.values()) {
      const existing = await ctx.db.query("pageFollows").withIndex("by_page_person", q => q.eq("pageId", page._id).eq("personId", person._id)).unique()
      if (existing || (page.createdByPersonId && await isBlockedBetween(ctx, person._id, page.createdByPersonId))) continue
      const createdAt = Date.now()
      const id = await ctx.db.insert("pageFollows", { networkId: root._id, pageId: page._id, personId: person._id, createdAt })
      await recordPageFollower(ctx, { _id: id, pageId: page._id, createdAt })
    }
  }
}

async function engageNewPost(ctx: MutationCtx, root: Doc<"networks">, people: Map<Actor, Doc<"persons">>, spec: PostSpec, postId: Id<"posts">, slot: number): Promise<{ comments: number; reactions: number }> {
  if (!await publishedState(ctx, "post", postId)) return { comments: 0, reactions: 0 }
  const ownerIndex = DEMO_CONTENT_PERSONAS.findIndex(person => person.actor === spec.actor)
  let reactions = 0
  for (let offset = 1; offset <= 2; offset += 1) {
    const actor = DEMO_CONTENT_PERSONAS[(ownerIndex + offset) % DEMO_CONTENT_PERSONAS.length]
    if (!actor) continue
    const person = actorPerson(people, actor.actor)
    const owner = actorPerson(people, spec.actor)
    if (await isBlockedBetween(ctx, person._id, owner._id)) continue
    const existing = await ctx.db.query("postReactions").withIndex("by_post_and_person", q => q.eq("postId", postId).eq("personId", person._id)).unique()
    if (existing) continue
    const kind = offset === 1 ? "like" as const : "bravo" as const
    await ctx.db.insert("postReactions", { networkId: root._id, postId, personId: person._id, kind, createdAt: Date.now() })
    await applyReactionDelta(ctx, postId, person._id, kind, 1)
    reactions += 1
  }
  const text = COMMENTS[slot]
  const commenter = DEMO_CONTENT_PERSONAS[(ownerIndex + 1) % DEMO_CONTENT_PERSONAS.length]
  if (!text || !commenter) return { comments: 0, reactions }
  const person = actorPerson(people, commenter.actor)
  if (await isBlockedBetween(ctx, person._id, actorPerson(people, spec.actor)._id)) return { comments: 0, reactions }
  const body = checked(() => assertPersonalCommentBody(text))
  const now = Date.now()
  const commentId = await ctx.db.insert("postComments", { networkId: root._id, postId, authorPersonId: person._id, body, status: "published", createdAt: now, updatedAt: now })
  const admitted = await moderateContentWrite(ctx, { networkId: root._id, ownerPersonId: person._id, kind: "comment", id: commentId, text: body })
  if (admitted) await recordComment(ctx, { _id: commentId, postId, createdAt: now })
  return { comments: 1, reactions }
}

export const run = internalMutation({
  args: { confirmNonProduction: v.string() },
  returns: v.object({ profiles: v.number(), pages: v.number(), postsCreated: v.number(), postsExisting: v.number(), commentsCreated: v.number(), reactionsCreated: v.number() }),
  handler: async (ctx, args) => {
    const { root, people } = await demoContext(ctx, args.confirmNonProduction)
    let profiles = 0
    for (const spec of DEMO_CONTENT_PERSONAS) {
      const person = actorPerson(people, spec.actor)
      if (person.headline === spec.originalHeadline) {
        const headline = checked(() => assertHeadline(spec.headline))
        await ctx.db.patch(person._id, { headline, updatedAt: Date.now() })
        await moderateContentWrite(ctx, { networkId: root._id, ownerPersonId: person._id, kind: "person", id: person._id, text: `${person.displayName ?? ""} ${headline ?? ""}` })
        await syncPersonDirectory(ctx, person._id)
        profiles += 1
      }
    }
    const pages = await ensurePages(ctx, root, people)
    await ensureShops(ctx, root, people, pages)
    let postsCreated = 0
    let postsExisting = 0
    let commentsCreated = 0
    let reactionsCreated = 0
    for (let slot = 0; slot < DEMO_CONTENT_POSTS.length; slot += 1) {
      const spec = DEMO_CONTENT_POSTS[slot]
      if (!spec) continue
      const person = actorPerson(people, spec.actor)
      const existing = await ctx.db.query("posts").withIndex("by_author_and_idempotencyKey", q => q.eq("authorPersonId", person._id).eq("idempotencyKey", postKey(spec))).unique()
      if (existing) {
        if (existing.networkId !== root._id) return fail("conflict")
        postsExisting += 1
        continue
      }
      const page = spec.page ? pages.get(spec.page) : undefined
      if (spec.page && !page) continue
      const body = checked(() => assertPostContent({ body: spec.body, mediaCount: 0, isShare: false }))
      // Geste PUBLIC explicite, limité par l'adresse fictive vérifiée et la garde de déploiement.
      const { postId } = await writePost(ctx, { network: root, authorPersonId: person._id, body, audience: "public", visibility: "root", province: spec.province, idempotencyKey: postKey(spec), ...(page ? { pageId: page._id } : {}) })
      postsCreated += 1
      const engagement = await engageNewPost(ctx, root, people, spec, postId, slot)
      commentsCreated += engagement.comments
      reactionsCreated += engagement.reactions
    }
    if (postsExisting === 0 && postsCreated > 0) await seedGraph(ctx, root, people, pages)
    if (postsCreated > 0) for (const person of people.values()) await refreshReaderFeed(ctx, root._id, person._id)
    return { profiles, pages: pages.size, postsCreated, postsExisting, commentsCreated, reactionsCreated }
  },
})

export type DemoMediaTarget = { key: string; kind: "post" | "story" | "page_banner" | "person_cover"; ownerHandle: string; asset: string; targetId: string | null; caption: string | null; attached: boolean }
const mediaTargetValidator = v.object({ key: v.string(), kind: v.union(v.literal("post"), v.literal("story"), v.literal("page_banner"), v.literal("person_cover")), ownerHandle: v.string(), asset: v.string(), targetId: v.union(v.string(), v.null()), caption: v.union(v.string(), v.null()), attached: v.boolean() })

/** La purge enlève la story mais garde son état de modération : le retrait reste acquis. */
async function purgedStoryToday(ctx: Pick<QueryCtx, "db">, root: Doc<"networks">, person: Doc<"persons">, now: number): Promise<boolean> {
  const dayStart = Date.parse(`${new Date(now).toISOString().slice(0, 10)}T00:00:00.000Z`)
  const states = await ctx.db.query("moderationContentStates").withIndex("by_network_owner_updatedAt", q => q.eq("networkId", root._id).eq("ownerPersonId", person._id).gte("updatedAt", dayStart)).take(101)
  if (states.length > 100) return true
  for (const state of states) {
    if (state.targetKind !== "story" || state.createdAt < dayStart) continue
    const id = ctx.db.normalizeId("stories", state.targetId)
    if (id && !await ctx.db.get(id)) return true
  }
  return false
}

async function plannedMedia(ctx: ReadCtx, confirmation: string): Promise<DemoMediaTarget[]> {
  const { root, people } = await demoContext(ctx, confirmation)
  const targets: DemoMediaTarget[] = []
  for (const spec of DEMO_CONTENT_POSTS) {
    if (!spec.asset) continue
    const person = actorPerson(people, spec.actor)
    const post = await ctx.db.query("posts").withIndex("by_author_and_idempotencyKey", q => q.eq("authorPersonId", person._id).eq("idempotencyKey", postKey(spec))).unique()
    if (!post || post.networkId !== root._id || post.status !== "published" || post.removedAt !== undefined || post.editedAt !== undefined || post.body !== spec.body || !await publishedState(ctx, "post", post._id)) continue
    if (spec.page) {
      const pageSpec = DEMO_CONTENT_PAGES.find(page => page.handle === spec.page)
      if (!pageSpec || !await availablePage(ctx, root, person, pageSpec)) continue
    }
    targets.push({ key: `${postKey(spec)}:image`, kind: "post", ownerHandle: person.handle ?? "", asset: spec.asset, targetId: post._id, caption: null, attached: (post.media?.length ?? 0) > 0 })
  }
  for (const spec of DEMO_CONTENT_PAGES) {
    const person = actorPerson(people, spec.actor)
    const page = await availablePage(ctx, root, person, spec)
    if (page) targets.push({ key: `${DEMO_CONTENT_VERSION}:banner:${spec.handle}`, kind: "page_banner", ownerHandle: person.handle ?? "", asset: spec.asset, targetId: page._id, caption: null, attached: page.bannerStorageId !== undefined })
  }
  const now = Date.now()
  for (const spec of DEMO_CONTENT_PERSONAS) {
    const person = actorPerson(people, spec.actor)
    if (["membre", "verifie", "commercant", "association"].includes(spec.actor)) targets.push({ key: `${DEMO_CONTENT_VERSION}:cover:${spec.actor}`, kind: "person_cover", ownerHandle: spec.handle, asset: spec.asset, targetId: person._id, caption: null, attached: person.coverStorageId !== undefined })
    const key = storyKey(spec.actor, now)
    const story = await ctx.db.query("stories").withIndex("by_author_idempotency", q => q.eq("authorPersonId", person._id).eq("idempotencyKey", key)).unique()
    if (story && story.networkId !== root._id) return fail("conflict")
    const live = await ctx.db.query("stories").withIndex("by_network_author_expiresAt", q => q.eq("networkId", root._id).eq("authorPersonId", person._id).gt("expiresAt", now)).take(STORY_ACTIVE_PER_AUTHOR_MAX)
    const consumed = story !== null || live.length >= STORY_ACTIVE_PER_AUTHOR_MAX || await purgedStoryToday(ctx, root, person, now)
    targets.push({ key, kind: "story", ownerHandle: spec.handle, asset: spec.asset, targetId: story?._id ?? null, caption: spec.story, attached: consumed })
  }
  return targets
}

/** Plan serveur seulement : aucun upload, aucune URL ni donnée étrangère au catalogue. */
export const mediaTargets = internalQuery({
  args: { confirmNonProduction: v.string() },
  returns: v.array(mediaTargetValidator),
  handler: async (ctx, args) => await plannedMedia(ctx, args.confirmNonProduction),
})

/** Le serveur a déjà stocké les octets générés : leur empreinte immuable reste obligatoire ici. */
export const attachMedia = internalMutation({
  args: { confirmNonProduction: v.string(), key: v.string(), storageId: v.id("_storage"), asset: v.string() },
  returns: v.object({ attached: v.boolean() }),
  handler: async (ctx, args) => {
    const targets = await plannedMedia(ctx, args.confirmNonProduction)
    const target = targets.find(item => item.key === args.key)
    if (!target || target.asset !== args.asset) return fail("policyRefused")
    if (target.attached) return { attached: false }
    const manifest = DEMO_MEDIA_MANIFEST[args.asset]
    const stored = await ctx.db.system.get("_storage", args.storageId)
    if (!manifest || !stored || normalizeSha256(stored.sha256) !== manifest.sha256 || stored.size !== manifest.bytes || stored.contentType !== manifest.mimeType) return fail("policyRefused")
    const person = await ctx.db.query("persons").withIndex("by_handle", q => q.eq("handle", target.ownerHandle)).unique()
    const root = await getRootNetwork(ctx)
    if (!person || !root) return fail("policyRefused")
    // Une analyse, une réservation ou un asset catalogue préexistant refuse la reprise du blob.
    await assertFreshUpload(ctx, person._id, args.storageId)
    const media: StoredMedia = { storageId: args.storageId, kind: "image", mimeType: manifest.mimeType, sizeBytes: stored.size, width: manifest.width, height: manifest.height, altText: manifest.altText }
    if (target.kind === "story") checked(() => assertStoryMedia(media))
    await registerGeneratedBlob(ctx, args.storageId, { mimeType: manifest.mimeType, filename: manifest.filename, networkId: root._id, uploadedByPersonId: person._id })
    if (target.kind === "post") {
      const id = target.targetId ? ctx.db.normalizeId("posts", target.targetId) : null
      if (!id) return fail("notFound")
      await ctx.db.patch(id, { media: [media] })
    } else if (target.kind === "page_banner") {
      const id = target.targetId ? ctx.db.normalizeId("pages", target.targetId) : null
      if (!id) return fail("notFound")
      await ctx.db.patch(id, { bannerStorageId: args.storageId, updatedAt: Date.now() })
    } else if (target.kind === "person_cover") {
      if (target.targetId !== person._id) return fail("notFound")
      await ctx.db.patch(person._id, { coverStorageId: args.storageId, updatedAt: Date.now() })
      await syncPersonDirectory(ctx, person._id)
    } else {
      const caption = checked(() => assertStoryCaption(target.caption ?? undefined))
      const now = Date.now()
      const storyId = await ctx.db.insert("stories", { networkId: root._id, authorPersonId: person._id, media, caption, audience: "public", publishedAt: now, expiresAt: storyExpiresAt(now), idempotencyKey: target.key })
      await moderateContentWrite(ctx, { networkId: root._id, ownerPersonId: person._id, kind: "story", id: storyId, text: caption ?? "" })
    }
    return { attached: true }
  },
})
