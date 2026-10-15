// Dupliqué de socle/packages/agent-features/src/features/reseau-personnel/useReseauFeedState.ts @ ad2e7fdc2 — adaptations : lectures du moteur avec le réseau courant (`useNetwork().networkId`) — recherche `posts.posts.search`, publication ouverte `posts.posts.getPost` (`Id<"posts">`), suivis par la PREMIÈRE PAGE de `graph.follows.paginateMyFollows` (lue sans lever, `follows.data` reste la liste) au lieu de `listMyFollows`, profil `people.persons.getMyPerson` (sans réseau) au lieu de `getMyProfile` ; adresses composées sur la base INJECTÉE de la page réseau (`useRoutes().home()` passée à `reseauAgentGroupeHref`, `reseauAgentHref`, `searchNavigationFor`) et mention vers le profil injecté (`personHref(handle, useRoutes().profile)`) au lieu des chemins écrits en dur de l'espace agent ; titres de vue et alerte de profil par l'i18n (`viewHeading(view, t)`, `profileOnboardingCopy(step, t)`) ; commentaires rapportés au réseau (plus d'« iRéseau » ni de chemin de l'espace agent) ; forme de l'objet rendu inchangée ; le setter de la chaîne de pages est rendu sous un emballage stable (`setPages` garde son nom et sa signature) — rendu tel quel, il empêchait le compilateur de React de préserver la mémoïsation des rappels (`react-hooks/preserve-manual-memoization`, trois erreurs héritées du socle).
"use client"

/**
 * useReseauFeedState — TOUT l'état de la page réseau, hors de son écran.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * POURQUOI CET ÉTAT A QUITTÉ `ReseauAgentPage`
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Depuis la coquille mobile (lot M0), la page réseau monte DEUX arbres
 * différents selon la largeur : `ReseauAgentPageInner` au bureau,
 * `ReseauMobilePage` au téléphone. Les deux ouvrent les mêmes volets, la même
 * portée, la même chaîne de pages, les mêmes six abonnements Convex.
 *
 * Laisser cet état dans l'un des deux écrans obligeait à le recopier dans
 * l'autre — et deux copies d'une machine à pagination qui se rebase en temps
 * réel divergent au premier correctif — la barre mobile avait déjà vécu ce
 * défaut.
 *
 * ⚠️ Ce hook est une EXTRACTION, pas une réécriture : le comportement est
 * strictement celui que `ReseauAgentPage` portait avant le 2026-08-18 — mêmes
 * hooks, même ordre, mêmes dépendances. Toute évolution de la pagination, des
 * volets ou de la portée se fait désormais ici, une seule fois.
 *
 * ⚠️ UN SEUL appel par arbre monté. Deux appels ouvriraient deux jeux
 * d'abonnements sur les mêmes queries — d'où le choix de brancher la bascule
 * mobile/bureau AU-DESSUS de ce hook, jamais à l'intérieur.
 */

import { api } from "@antia/api/engine"
import type { Id } from "@antia/api/engine"
import { useAuthenticatedConvexQuery } from "@antia/api/hooks"
import { useNetwork, useRoutes } from "@antia/api/network"
import {
  usePathname,
  useRouter,
  useSearchParams,
  useTabQueryState,
} from "@antia/api/routing"
import { type SetStateAction, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { openNotificationCenter } from "../notifications/notification-center-store"
import { personHref } from "./author-link"
import {
  chipsVisibleFor,
  FEED_SCOPE_DEFAULT,
  FEED_SCOPE_PARAM,
  parseFeedScope,
  type FeedScope,
} from "./feed-scopes"
import {
  RESEAU_AGENT_GROUPE_PARAM,
  RESEAU_AGENT_NOTIFICATIONS_PARAM,
  RESEAU_AGENT_QUERY_PARAM,
  RESEAU_AGENT_TAB_DEFAULT,
  RESEAU_AGENT_TAB_PARAM,
  RESEAU_AGENT_TAG_PARAM,
  initialViewFor,
  legacyNotificationsRequested,
  mainPanelFor,
  notificationsRequested,
  parseReseauAgentGroupe,
  parseReseauAgentQuery,
  parseReseauAgentTab,
  parseReseauAgentTag,
  railPanelsFor,
  reseauAgentGroupeHref,
  reseauAgentHref,
  reseauAgentTabById,
  searchNavigationFor,
  type ReseauAgentTabId,
  RESEAU_AGENT_POST_PARAM,
  parseReseauAgentPost,
} from "../../shell/reseau-agent-nav"
import {
  feedCursorKey,
  initialFeedPages,
  rebasePagesAfter,
  recordTail,
  type FeedCursor,
  type FeedPagesState,
} from "./reseau-feed-pages"
import {
  profileOnboardingCopy,
  profileOnboardingIsUrgent,
  profileOnboardingStep,
} from "./profile-onboarding"
import { useProfileOnboardingAccount } from "./use-profile-onboarding"
import {
  usePersonalConnections,
  usePersonalPendingConnections,
} from "./use-dual-connection-pagination"
import { viewHeading, type FeedView } from "../../shell/reseau-layout"

/** Le curseur rendu par Convex garde le brand de l'identifiant de table. */
export type ReseauFeedCursor = FeedCursor<Id<"posts">>

/**
 * Les suivis lus pour décider du texte d'un fil vide — la PREMIÈRE page suffit
 * à savoir s'il y en a ; la liste complète vit dans le volet Relations.
 */
const FOLLOWS_FIRST_PAGE = 20

/**
 * Un curseur de queue n'est valable que pour la page qui l'a rendu. Une page
 * aval remplacée par le rebase temps réel ne doit jamais laisser son ancien
 * bouton « Voir plus » agir sur la nouvelle chaîne.
 */
export interface FeedTail {
  pageKey: string
  cursor: ReseauFeedCursor | null
}

export function useReseauFeedState() {
  const { t } = useTranslation("reseau")
  const { networkId } = useNetwork()
  const routes = useRoutes()
  /** La base de la page réseau — toutes les adresses de vue s'y composent. */
  const home = routes.home()
  /**
   * Un instant FIGÉ pour tout le rendu — et il le devient DAVANTAGE avec la
   * pagination : les pages 2, 3… doivent lire le même instant que la première,
   * sinon deux publications du même horodatage affichent deux âges.
   */
  const now = useMemo(() => Date.now(), [])
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  /**
   * Pas de `validValues` : le hook rendrait le volet par défaut sur un ALIAS,
   * et les anciennes adresses (`?tab=reseau`, celle que portaient tous les
   * liens vers l'ancienne page « Mon réseau ») mourraient en silence. On laisse
   * donc passer la valeur brute et c'est `parseReseauAgentTab` — testé — qui
   * tranche.
   */
  const [rawTab, setRawTab] = useTabQueryState(
    RESEAU_AGENT_TAB_PARAM,
    RESEAU_AGENT_TAB_DEFAULT
  )
  const tab = parseReseauAgentTab(rawTab)
  const rails = railPanelsFor(tab)
  const main = mainPanelFor(tab)

  /**
   * Les états TRANSITOIRES du fil (mot-clic, recherche, publication ouverte).
   *
   * Ils restent locaux : ce sont des gestes en cours, pas des lieux. DEUX
   * d'entre eux sont semés depuis l'URL, parce que seuls ceux-là arrivent de
   * l'extérieur — le mot-clic (`ProfilPersonnePage` renvoie ici quand on
   * clique un `#hashtag`) et, depuis le 2026-09-06, la RECHERCHE : une
   * recherche lancée depuis un autre volet pousse `?q=…`, et un lien de
   * résultats se partage (R-06).
   *
   * ⚠️ La graine est lue UNE fois, dans un `useState` : relire `searchParams`
   * à chaque rendu ré-écraserait la vue courante à la première navigation.
   */
  const [seededView] = useState<FeedView>(() =>
    initialViewFor(
      parseReseauAgentTab(searchParams.get(RESEAU_AGENT_TAB_PARAM)),
      parseReseauAgentTag(searchParams.get(RESEAU_AGENT_TAG_PARAM)),
      parseReseauAgentQuery(searchParams.get(RESEAU_AGENT_QUERY_PARAM)),
      // `?post=<id>` : la cible « publication » du centre de notifications.
      parseReseauAgentPost(searchParams.get(RESEAU_AGENT_POST_PARAM))
    )
  )
  const [view, setView] = useState<FeedView>(seededView)
  /* Le champ repart de ce que l'URL demande : arriver sur la page réseau avec
     `?q=Test` et une boîte de recherche VIDE au-dessus des résultats de
     « Test » laisserait croire que le filtre n'est plus actif. */
  const [searchDraft, setSearchDraft] = useState(
    seededView.kind === "search" ? seededView.query : ""
  )
  /**
   * Le GROUPE que le volet Groupes ouvre (T5) — LU DANS L'URL À CHAQUE RENDU.
   *
   * ⚠️ C'était un `useState` semé une fois (R-13, corrigé le 2026-09-06), et
   * la navigation interne du volet vivait dans son propre état : la page d'un
   * groupe ne s'écrivait donc JAMAIS dans l'adresse. Trois conséquences, toutes
   * constatées : le lien n'était pas partageable, « Retour » du navigateur
   * quittait le réseau au lieu de refermer la page, et une seconde notification
   * vers le MÊME groupe ne rouvrait rien.
   *
   * La valeur sert aussi de `key` au panneau : changer de groupe REMONTE le
   * volet sur sa page. Un `replace` du MÊME identifiant laisse la clé
   * inchangée — la pagination du mur survit, c'est voulu.
   */
  const groupSeed = parseReseauAgentGroupe(
    searchParams.get(RESEAU_AGENT_GROUPE_PARAM)
  )
  /**
   * La portée du fil vit dans l'URL comme le volet : une chip se partage, et
   * revenir en arrière doit ramener le fil qu'on regardait. Un `useState` seul
   * l'aurait perdue au premier lien suivi.
   */
  const [rawScope, setRawScope] = useTabQueryState(
    FEED_SCOPE_PARAM,
    FEED_SCOPE_DEFAULT
  )
  const scope = parseFeedScope(rawScope)
  /* La recherche vit dans l'URL comme la portée — mais son défaut est la
     chaîne VIDE, ce qui suffit à `useTabQueryState` pour retirer le paramètre
     quand on revient au fil. */
  const [rawQuery, setRawQuery] = useTabQueryState(
    RESEAU_AGENT_QUERY_PARAM,
    ""
  )
  /* La demande d'ouverture de la CLOCHE, consommée UNE fois (voir plus bas).
     Lecture seule : son effacement retire DEUX paramètres à la fois, ce qu'un
     setter de `useTabQueryState` ne sait pas faire — d'où `replaceParams`. */
  const [rawNotifications] = useTabQueryState(
    RESEAU_AGENT_NOTIFICATIONS_PARAM,
    ""
  )
  const [pages, setPages] = useState(() =>
    initialFeedPages<ReseauFeedCursor>()
  )
  const [tail, setTail] = useState<FeedTail | null>(null)
  /**
   * Le setter de la chaîne de pages, tel que les écrans le reçoivent — un
   * emballage STABLE plutôt que le setter lui-même : rendu tel quel dans
   * l'objet du hook, le setter s'échappe dans un objet modifiable, et le
   * compilateur de React ne peut plus garantir la mémoïsation des rappels
   * qui l'appellent (`react-hooks/preserve-manual-memoization`). Même
   * signature pour les appelants.
   */
  const setFeedPages = useCallback(
    (update: SetStateAction<FeedPagesState<ReseauFeedCursor>>) => setPages(update),
    []
  )
  const [announcement, setAnnouncement] = useState("")

  const resetFeedPages = useCallback(() => {
    setPages(initialFeedPages<ReseauFeedCursor>())
    setTail(null)
  }, [])

  /**
   * Réécrire PLUSIEURS paramètres d'un coup, sans entrée d'historique.
   *
   * ⚠️ Deux appels successifs aux setters de `useTabQueryState` partiraient
   * du MÊME instantané de `searchParams` : le second remettrait ce que le
   * premier vient de retirer. Tout geste qui touche à deux paramètres passe
   * donc par ici.
   */
  const replaceParams = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString())
      mutate(params)
      const qs = params.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [router, pathname, searchParams]
  )

  const reportTail = useCallback(
    (pageKey: string, cursor: ReseauFeedCursor | null) => {
      setTail((current) =>
        current?.pageKey === pageKey &&
        feedCursorKey(current.cursor) === feedCursorKey(cursor)
          ? current
          : { pageKey, cursor }
      )
      setPages((state) => {
        const currentLast = state.cursors[state.cursors.length - 1] ?? null
        // Une ancienne dernière page peut publier son effet pendant qu'un
        // rebase la démonte. Son curseur n'a plus autorité sur la chaîne.
        if (feedCursorKey(currentLast) !== pageKey) return state
        return recordTail(state, cursor)
      })
    },
    []
  )

  const rebaseAfterPage = useCallback(
    (pageIndex: number, cursor: ReseauFeedCursor | null) => {
      setPages((state) => rebasePagesAfter(state, pageIndex, cursor))
    },
    []
  )

  const search = useAuthenticatedConvexQuery(
    api.modules.posts.posts.search,
    view.kind === "search" ? { networkId, query: view.query } : "skip"
  )
  const focused = useAuthenticatedConvexQuery(
    api.modules.posts.posts.getPost,
    view.kind === "post"
      ? // Venu de l'URL (`?post=`) : le serveur refuse un identifiant inventé.
        { networkId, postId: view.postId as Id<"posts"> }
      : "skip"
  )
  const connectionPages = usePersonalConnections({ autoLoad: true })
  const connections = useMemo(
    () => ({
      data: connectionPages.items,
      isLoading: connectionPages.isLoading || connectionPages.isLoadingMore,
      isError: connectionPages.isError,
      refetch: connectionPages.retry,
    }),
    [connectionPages]
  )
  /*
   * Les suivis : la PREMIÈRE page, lue comme une requête simple — une erreur
   * se dit (`isError`) au lieu de lever et d'emporter la page entière. `data`
   * reste la LISTE, comme au socle : les écrans n'en lisent que la longueur.
   */
  const followsPage = useAuthenticatedConvexQuery(
    api.modules.graph.follows.paginateMyFollows,
    { networkId, paginationOpts: { numItems: FOLLOWS_FIRST_PAGE, cursor: null } }
  )
  const follows = useMemo(
    () => ({
      data: followsPage.data?.page,
      isLoading: followsPage.isLoading,
      isError: followsPage.isError,
      refetch: followsPage.refetch,
    }),
    [followsPage.data, followsPage.isLoading, followsPage.isError, followsPage.refetch]
  )
  const pendingPages = usePersonalPendingConnections({ autoLoad: true })
  const pending = useMemo(
    () => ({
      data: pendingPages.items,
      isLoading: pendingPages.isLoading || pendingPages.isLoadingMore,
      isError: pendingPages.isError,
      refetch: pendingPages.retry,
    }),
    [pendingPages]
  )
  /*
   * ⚠️ Le décompte des non-lus a QUITTÉ ce hook le 2026-09-06 (R-03). Il
   * n'alimentait que deux pastilles — l'onglet « Activité » et son entrée de
   * rail-menu —, toutes deux disparues avec le volet. Le seul lecteur du
   * chiffre est désormais la CLOCHE (`features/notifications/NotificationBell`),
   * qui pose son propre abonnement : le garder ici aurait laissé une
   * souscription Convex sans lecteur sur un hook qui en ouvre déjà six.
   */
  /* La personne de la session, telle que le moteur la rend (sans réseau) :
     identifiant, nom, photo, publication et mode privé du profil. */
  const myProfile = useAuthenticatedConvexQuery(
    api.modules.people.persons.getMyPerson,
    {}
  )
  // Rien n'est publié d'office : ce hook crée la PERSONNE absente à la
  // première session, et dit si cette création court. Il ne juge pas le RÔLE
  // du compte : une personne a une existence sociale quel que soit le sien.
  const onboardingAccount = useProfileOnboardingAccount()

  /**
   * Changer de volet lève tout filtre en cours : une recherche de publications
   * n'a pas de sens dans les relations, et la retrouver en revenant au fil
   * ferait réapparaître un état qu'on croyait quitté.
   */
  const goToTab = (id: ReseauAgentTabId) => {
    setSearchDraft("")
    resetFeedPages()
    setView({ kind: "feed" })
    /* Le volet ET la recherche, en une seule réécriture : laisser `?q=` sur
       l'adresse d'un fil redevenu nu ferait MENTIR l'URL — un rechargement
       rouvrirait des résultats que l'écran venait de quitter. */
    replaceParams((params) => {
      if (id === RESEAU_AGENT_TAB_DEFAULT) params.delete(RESEAU_AGENT_TAB_PARAM)
      else params.set(RESEAU_AGENT_TAB_PARAM, id)
      params.delete(RESEAU_AGENT_QUERY_PARAM)
    })
  }
  /**
   * Changer de portée REMET la pagination à zéro : les pages déjà montées
   * appartiennent à l'autre composition, et les garder mélangerait deux fils.
   * Le curseur de queue aussi — il désigne une position dans l'ancienne suite.
   */
  const goToScope = (next: FeedScope) => {
    resetFeedPages()
    setRawScope(next)
  }
  const openTag = (tag: string) => {
    setSearchDraft("")
    resetFeedPages()
    setView({ kind: "tag", tag })
  }
  /** Un mot-clic depuis un MUR DE GROUPE ramène au fil, filtré — le volet
   *  Groupes n'a pas de vue « tag », et le fil est le lieu des mots-clics. */
  const openTagFromGroups = (tag: string) => {
    setRawTab("fil")
    openTag(tag)
  }
  /**
   * Ouvrir LA page d'un groupe, d'où qu'on vienne (cloche, invitation, carte
   * de l'annuaire) — par l'ADRESSE, en `push` : la page d'un groupe est un
   * LIEU, « Retour » doit y ramener, et le lien se partage.
   */
  const openGroup = (groupId: string) => {
    router.push(reseauAgentGroupeHref(groupId, home))
  }
  /**
   * Refermer la page d'un groupe : `replace`, et non `push`. Ouvrir puis
   * refermer ne doit pas empiler deux entrées d'historique — « Retour »
   * rouvrirait la page qu'on vient de quitter, indéfiniment.
   */
  const closeGroup = () => {
    router.replace(reseauAgentHref("groupes", home))
  }
  /** Une mention mène au profil de la personne citée — l'adresse injectée. */
  const openMention = (mentioned: string) => {
    router.push(personHref(mentioned, routes.profile))
  }
  /**
   * Chercher des PUBLICATIONS, d'où qu'on parte (R-06).
   *
   * Le défaut réparé : la loupe mobile changeait `view` sans changer le volet,
   * alors que les résultats ne sont rendus QUE par le fil et que le volet
   * affiché vient de l'URL. Depuis les Relations, l'écran calculait donc une
   * réponse que rien ne montrait, et l'adresse continuait d'annoncer
   * `?tab=relations`.
   *
   * La décision — faut-il basculer, et vers quelle adresse — vit dans
   * `searchNavigationFor`, module pur et testé. Ici, l'exécution seule.
   *
   * ⚠️ `push` et non `replace` : « Retour » doit ramener au volet d'où la
   * recherche est partie.
   */
  const openSearch = (query: string) => {
    const plan = searchNavigationFor(tab, query, home)
    setSearchDraft(query)
    resetFeedPages()
    setView(plan.view)
    if (plan.href !== null) {
      router.push(plan.href)
      return
    }
    /* Déjà sur le fil : l'adresse suit quand même — un résultat se partage et
       survit à un rechargement — mais par REMPLACEMENT. Chercher depuis le
       fil ne quitte aucun volet : y ajouter une entrée d'historique ferait de
       « Retour » un effaceur de recherche plutôt qu'un retour en arrière. */
    const cleaned = plan.view.kind === "search" ? plan.view.query : ""
    if (cleaned !== rawQuery) setRawQuery(cleaned)
  }
  const backToFeed = () => {
    setSearchDraft("")
    resetFeedPages()
    setView({ kind: "feed" })
    // Revenir au fil ENTIER retire la recherche de l'adresse : la laisser
    // ferait réapparaître les résultats au premier rechargement.
    if (rawQuery.length > 0) setRawQuery("")
  }

  /**
   * La CLOCHE demandée par l'URL — consommée UNE fois, puis effacée.
   *
   * Deux portes mènent ici : le paramètre `?notifications=1` (le contrat
   * d'aujourd'hui) et les trois anciennes graphies du volet retiré
   * (`?tab=activite|activity|notifications`), que d'anciens liens portent
   * encore. Paramètre consommé UNE fois : le laisser en place rouvrirait la
   * carte à chaque retour arrière.
   */
  const notificationsConsumed = useRef(false)
  const legacyTabRequest = legacyNotificationsRequested(rawTab)
  const paramRequest = notificationsRequested(rawNotifications)
  useEffect(() => {
    if (notificationsConsumed.current) return
    if (!paramRequest && !legacyTabRequest) return
    notificationsConsumed.current = true
    openNotificationCenter()
    replaceParams((params) => {
      params.delete(RESEAU_AGENT_NOTIFICATIONS_PARAM)
      if (legacyNotificationsRequested(params.get(RESEAU_AGENT_TAB_PARAM))) {
        params.delete(RESEAU_AGENT_TAB_PARAM)
      }
    })
  }, [paramRequest, legacyTabRequest, replaceParams])

  /** Seule la réponse de la DERNIÈRE page actuellement montée fait foi. */
  const lastPageCursor = pages.cursors[pages.cursors.length - 1] ?? null
  const lastPageKey = feedCursorKey(lastPageCursor)
  const tailCursor = tail?.pageKey === lastPageKey ? tail.cursor : null

  const pendingCount =
    pending.isLoading || pending.isError ? undefined : pending.data.length
  // Ce que la personne doit régler à propos de son profil — le publier, ou
  // savoir qu'elle est hors connexion. `null` tant que le serveur n'a pas
  // répondu — on n'annonce pas un manque qu'on n'a pas constaté.
  const onboardingStep =
    myProfile.data === undefined
      ? null
      : profileOnboardingStep(myProfile.data, onboardingAccount)
  const onboardingCopy = onboardingStep
    ? profileOnboardingCopy(onboardingStep, t)
    : null
  // « Hors connexion » est un état CHOISI : il s'affiche, il ne presse pas.
  const onboardingUrgent = onboardingStep
    ? profileOnboardingIsUrgent(onboardingStep)
    : false
  const heading = viewHeading(view, t)
  const currentTab = reseauAgentTabById(tab)
  /* Les chips et la note qui les explique s'affichent ensemble ou pas du tout :
     une note de portée sans sa rangée décrirait un filtre invisible. */
  const showChips = chipsVisibleFor(tab, view)

  return {
    now,
    router,
    tab,
    rails,
    main,
    view,
    setView,
    searchDraft,
    setSearchDraft,
    groupSeed,
    scope,
    pages,
    setPages: setFeedPages,
    announcement,
    setAnnouncement,
    resetFeedPages,
    reportTail,
    rebaseAfterPage,
    search,
    focused,
    connections,
    follows,
    pending,
    myProfile,
    goToTab,
    goToScope,
    openTag,
    openTagFromGroups,
    openGroup,
    closeGroup,
    openMention,
    openSearch,
    backToFeed,
    tailCursor,
    pendingCount,
    onboardingCopy,
    onboardingUrgent,
    heading,
    currentTab,
    showChips,
  }
}

export type ReseauFeedState = ReturnType<typeof useReseauFeedState>
