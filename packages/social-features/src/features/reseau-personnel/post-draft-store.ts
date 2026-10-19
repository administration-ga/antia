// Dupliqué de socle/packages/agent-features/src/features/reseau-personnel/post-draft-store.ts @ ad2e7fdc2 — adaptations : clé de `sessionStorage` PRÉFIXÉE PAR LE RÉSEAU (`useNetwork().storagePrefix`) au lieu du préfixe de l'espace agent — configurateur `configurePostDraftStorage(prefix)` (appelé par le composeur à son montage, idempotent ; la coque peut l'appeler d'abord), `postDraftStorageKey(prefix, scope)` et le segment `POST_DRAFT_STORAGE_SEGMENT` remplacent `postDraftStorageKey(scope)` et `POST_DRAFT_STORAGE_PREFIX` ; rien n'est lu ni écrit tant que le réseau OU l'auteur manque ; changer de réseau laisse le brouillon dans le sien et relit celui du nouveau réseau ; l'auteur est la personne du moteur (`personId`) ; `resetForTests` oublie aussi le réseau.
"use client"

/**
 * post-draft-store — le singleton d'état des brouillons de publication,
 * branché à React par `useSyncExternalStore`.
 *
 * Même patron que `features/messagerie/dock-store.ts`, et la même raison : ce
 * qui décide vit dans le module PUR voisin (`post-draft.ts`), ce fichier ne
 * fait qu'appliquer et notifier. Un SINGLETON de module, et non un contexte :
 * le composeur est monté par TROIS arbres qui ne descendent pas l'un de
 * l'autre (bureau, téléphone, montage en ligne d'un mur de groupe), et la
 * bascule 959→960 remplace l'arbre entier — un provider hissé au-dessus ne
 * survivrait pas mieux qu'un `useState`.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * DEUX MAGASINS, ET C'EST VOULU
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * 1. L'état SÉRIALISABLE (texte, audience, clé d'idempotence, métadonnées des
 *    médias et leurs téléversements réussis) va en `sessionStorage`, sous une
 *    clé SCOPÉE PAR RÉSEAU ET PAR AUTEUR — « jusqu'à la prochaine session »,
 *    comme le dock.
 * 2. Le registre RUNTIME (`File` + URL `blob:`) reste en mémoire : ces deux
 *    objets n'ont de sens que dans l'onglet qui les a créés. Les persister
 *    est impossible ; prétendre le contraire produirait un aperçu mort et un
 *    envoi vide.
 *
 * ⚠️ **Rien n'est écrit tant que l'auteur n'est pas connu** (`setScope`) : un
 * brouillon ne doit jamais être relu — ni publié — sous une autre identité
 * (PLAN §5 lot 04, réception). Avant que l'auteur ne soit posé, l'état vit en
 * mémoire seulement.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * UN ÉTAT PAR RÉSEAU — `configurePostDraftStorage`
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Une personne peut être membre de plusieurs réseaux servis par le même
 * navigateur : un brouillon écrit dans l'un n'a rien à faire dans le composeur
 * de l'autre. La clé porte donc le préfixe du réseau courant, que le magasin —
 * un singleton de MODULE, hors de tout arbre React — ne peut pas lire seul :
 *
 *     configurePostDraftStorage(useNetwork().storagePrefix)
 *
 * Le composeur l'appelle à son montage (idempotent) ; la coque peut l'appeler
 * plus tôt. Même règle que pour l'auteur : tant que le réseau n'est pas posé,
 * rien n'est lu ni écrit, et un geste déjà fait est adopté à la configuration.
 */

import { useSyncExternalStore } from "react"
import {
  clearDraft,
  draftAddMedia,
  draftFor,
  draftMarkUploadFailed,
  draftMarkUploaded,
  draftRemoveMedia,
  draftRotateKey,
  draftSetAltText,
  draftSetAudience,
  draftSetBody,
  draftSetPageAudience,
  draftSetPublication,
  dropDraft,
  initialPostDrafts,
  isPristine,
  newIdempotencyKey,
  parseDrafts,
  serializeDrafts,
  setComposerOpen,
  updateDraft,
  type PostDraftMedia,
  type PostDraftState,
  type PostDraftsState,
} from "./post-draft"
import type { PageAudience, ReachAudience } from "./shared"
import type { ProvinceSlug } from "@antsia/social-domain/provinces"

/**
 * Le segment propre aux brouillons, entre le préfixe du RÉSEAU et l'AUTEUR.
 *
 * ⚠️ Sa version suit `POST_DRAFT_SERIAL_VERSION` (`post-draft.ts`) : les deux
 * bougent ENSEMBLE. Le préfixe est celui du réseau (un état par réseau), le
 * segment final est l'AUTEUR — deux comptes sur le même navigateur ne
 * partagent jamais un brouillon.
 */
export const POST_DRAFT_STORAGE_SEGMENT = "post-drafts:v1:"

export function postDraftStorageKey(prefix: string, scope: string): string {
  return `${prefix}${POST_DRAFT_STORAGE_SEGMENT}${scope}`
}

let state: PostDraftsState = initialPostDrafts()
/** L'auteur courant — `null` tant qu'il n'est pas posé. */
let scope: string | null = null
/** Le préfixe du réseau courant — `null` tant que personne ne l'a posé. */
let storagePrefix: string | null = null
const listeners = new Set<() => void>()

/** `File` et `blob:` — hors sérialisation, par nature. */
interface RuntimeMedia {
  file: File
  previewUrl: string
}
const runtime = new Map<string, RuntimeMedia>()

/** La clé de persistance — `null` tant que le réseau OU l'auteur manque. */
function currentStorageKey(): string | null {
  return storagePrefix === null || scope === null ? null : postDraftStorageKey(storagePrefix, scope)
}

function persist(): void {
  const key = currentStorageKey()
  if (key === null) return
  try {
    window.sessionStorage.setItem(key, serializeDrafts(state))
  } catch {
    // Stockage refusé (navigation privée, quota) : le brouillon reste
    // utilisable, il ne survivra simplement pas au rechargement. Jamais une
    // erreur à l'écran pour ça.
  }
}

function notify(): void {
  for (const listener of listeners) listener()
}

function emit(next: PostDraftsState): void {
  if (next === state) return
  state = next
  persist()
  notify()
}

/**
 * La clé de persistance vient d'être CONNUE (auteur ou réseau posé).
 *
 * Deux règles : (1) tant que la clé est inconnue, on n'écrit ni ne relit
 * rien ; (2) on n'adopte le brouillon STOCKÉ que si rien n'a été écrit depuis
 * le montage — sinon on écraserait un texte en cours de frappe par un
 * brouillon plus ancien.
 */
function adoptStoredDrafts(): void {
  const key = currentStorageKey()
  if (key === null) return
  if (!isPristine(state)) {
    // Du travail en mémoire : il devient celui de cet auteur, et c'est lui
    // qu'on persiste. (Cas réel : l'usager tape avant que la session ne soit
    // connue.)
    persist()
    return
  }
  let stored = initialPostDrafts()
  try {
    stored = parseDrafts(window.sessionStorage.getItem(key))
  } catch {
    stored = initialPostDrafts()
  }
  emit({
    ...stored,
    // Une feuille ouverte à la main le reste : l'hydratation ne la referme
    // pas dans le dos de l'usager.
    composerOpen: stored.composerOpen || state.composerOpen,
  })
}

/**
 * Poser le préfixe du RÉSEAU courant (`useNetwork().storagePrefix`) — la clé
 * de persistance en dépend. Idempotent : le composeur le rappelle à chaque
 * montage.
 *
 * ⚠️ Passer d'un réseau à un AUTRE ne transporte pas le brouillon : il est
 * déjà persisté sous la clé de son réseau (chaque geste l'écrit), et l'état
 * repart de celui du nouveau réseau. `null` suspend la persistance.
 */
export function configurePostDraftStorage(prefix: string | null): void {
  if (prefix === storagePrefix) return
  const switchingNetwork = storagePrefix !== null && prefix !== null
  storagePrefix = prefix
  if (switchingNetwork) {
    state = initialPostDrafts()
    notify()
  }
  adoptStoredDrafts()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot(): PostDraftsState {
  return state
}

/**
 * ⚠️ Instantané SERVEUR figé, et une seule instance : `useSyncExternalStore`
 * exige une référence stable, sans quoi il boucle.
 */
const SERVER_SNAPSHOT = initialPostDrafts()
function getServerSnapshot(): PostDraftsState {
  return SERVER_SNAPSHOT
}

export function usePostDrafts(): PostDraftsState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

/** La feuille de composition est-elle ouverte ? (survit à 959→960→959) */
export function usePostComposerOpen(): boolean {
  return usePostDrafts().composerOpen
}

/**
 * Le brouillon d'une cible.
 *
 * ⚠️ La valeur de repli est CRÉÉE à chaque appel quand la cible n'a pas encore
 * de ligne : ce n'est pas l'instantané du magasin, c'est une lecture. Les
 * transitions, elles, passent par `postDraftStore`.
 */
export function usePostDraft(key: string, seedKey: string): PostDraftState {
  return draftFor(usePostDrafts(), key, seedKey)
}

function write(
  key: string,
  transition: (draft: PostDraftState) => PostDraftState,
): void {
  emit(updateDraft(state, key, newIdempotencyKey(), transition))
}

export const postDraftStore = {
  /**
   * Déclarer l'AUTEUR courant (la personne du moteur) — la clé de
   * persistance en dépend, avec le réseau (`configurePostDraftStorage`).
   * Mêmes deux règles que pour le réseau (`adoptStoredDrafts`).
   */
  setScope(next: string | null): void {
    if (next === scope) return
    if (scope !== null) {
      // Une identité remplacée ne transporte ni texte ni opt-in vers la suivante.
      for (const localId of runtime.keys()) releaseRuntimeMedia(localId)
      state = initialPostDrafts()
      notify()
    }
    scope = next
    adoptStoredDrafts()
  },

  /** Le préfixe du réseau courant, ou `null` — utile aux tests et au diagnostic. */
  storagePrefix(): string | null {
    return storagePrefix
  },

  /** L'auteur courant, ou `null` — utile aux tests et au diagnostic. */
  scope(): string | null {
    return scope
  },

  setComposerOpen(open: boolean): void {
    emit(setComposerOpen(state, open))
  },

  setBody(key: string, body: string): void {
    write(key, (draft) => draftSetBody(draft, body))
  },

  setAudience(key: string, audience: ReachAudience): void {
    write(key, (draft) => draftSetAudience(draft, audience))
  },

  setPageAudience(key: string, pageAudience: PageAudience): void {
    write(key, (draft) => draftSetPageAudience(draft, pageAudience))
  },

  setPublication(key: string, choice: { alsoOnRoot: boolean; province?: ProvinceSlug }): void {
    write(key, (draft) => draftSetPublication(draft, key, choice))
  },

  /**
   * Ajouter des médias. Le `File` et son aperçu vont au registre RUNTIME
   * AVANT la notification : le rendu qui suit doit déjà les trouver.
   */
  addMedia(
    key: string,
    items: readonly { meta: PostDraftMedia; file: File; previewUrl: string }[],
  ): void {
    for (const item of items) {
      runtime.set(item.meta.localId, {
        file: item.file,
        previewUrl: item.previewUrl,
      })
    }
    write(key, (draft) =>
      draftAddMedia(
        draft,
        items.map((item) => item.meta),
      ),
    )
  },

  removeMedia(key: string, localId: string): void {
    releaseRuntimeMedia(localId)
    write(key, (draft) => draftRemoveMedia(draft, localId))
  },

  setAltText(key: string, localId: string, altText: string): void {
    write(key, (draft) => draftSetAltText(draft, localId, altText))
  },

  markUploaded(key: string, localId: string, storageId: string): void {
    write(key, (draft) =>
      draftMarkUploaded(draft, localId, storageId, Date.now()),
    )
  },

  markUploadFailed(key: string, localId: string): void {
    write(key, (draft) => draftMarkUploadFailed(draft, localId))
  },

  /**
   * Publication réussie : brouillon neuf, clé neuve, aperçus révoqués.
   *
   * ⚠️ C'est le SEUL chemin nominal de rotation de la clé d'idempotence — un
   * échec la conserve, c'est ce qui rend le renvoi sûr.
   */
  clear(key: string): void {
    releaseDraftRuntime(key)
    emit(clearDraft(state, key, newIdempotencyKey()))
  },

  /** Abandon EXPLICITE : la ligne disparaît, aperçus révoqués. */
  discard(key: string): void {
    releaseDraftRuntime(key)
    emit(dropDraft(state, key))
  },

  /** Renouveler la clé — réservé au succès (cf. `post-draft.ts`). */
  rotateKey(key: string): void {
    write(key, (draft) => draftRotateKey(draft, newIdempotencyKey()))
  },

  /** Remise à zéro complète (auteur ET réseau oubliés) — tests seulement. */
  resetForTests(): void {
    for (const localId of [...runtime.keys()]) releaseRuntimeMedia(localId)
    scope = null
    storagePrefix = null
    state = initialPostDrafts()
    notify()
  },
}

// ═══════════════════════════════════════════════════════════════
// Le registre RUNTIME — `File` et `blob:`, jamais persistés
// ═══════════════════════════════════════════════════════════════

export function runtimeMediaFile(localId: string): File | null {
  return runtime.get(localId)?.file ?? null
}

export function runtimeMediaPreview(localId: string): string | null {
  return runtime.get(localId)?.previewUrl ?? null
}

export function hasRuntimeMedia(localId: string): boolean {
  return runtime.has(localId)
}

function releaseRuntimeMedia(localId: string): void {
  const entry = runtime.get(localId)
  if (entry === undefined) return
  runtime.delete(localId)
  try {
    URL.revokeObjectURL(entry.previewUrl)
  } catch {
    // `URL.revokeObjectURL` absent (rendu serveur, environnement de test) :
    // rien à libérer, rien à signaler.
  }
}

function releaseDraftRuntime(key: string): void {
  const draft = state.drafts[key]
  if (draft === undefined) return
  for (const item of draft.media) releaseRuntimeMedia(item.localId)
}
