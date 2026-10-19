# P18a — Audit statique d'accessibilité et de performance, protocole de mesure P18b

18–19 octobre 2026, agent « qualité » sous coordination. Première tranche documentaire de
[P18](../prompts/P18_PERFORMANCE_ACCESSIBILITE.md). Références : [préambule](../prompts/PROMPT_COMMUN.md),
[03](../03_DESIGN_SYSTEM.md), [04](../04_PARCOURS_FIL_ET_PUBLICATIONS.md), [05](../05_MESSAGES_ET_APPELS.md),
[09](../09_FEUILLE_DE_ROUTE.md), [10](../10_RECETTE_MESURES_ET_RISQUES.md) §1, §2, §4,
[EXECUTION](../EXECUTION.md), rapports P01–P05, P07, P09–P13, P15,
[docs/19](../../../19_PLAN_EXECUTION_PA10.md) et [docs/20](../../../20_EXPLOITATION_ECHELLE_ET_RESTAURATION_PA10.md).

**Verdict : audit statique documentaire ; aucune mesure, aucun test, aucune recette.**
Verdicts séparés (10 §7) : documenté — oui ; présent dans le code — sans objet (aucun fichier de
code modifié) ; testé automatiquement — non ; observé en recette — non ; publié — non.

## 0. Cadre, source et méthode

**Décision du propriétaire (18/10/2026)** : « Continuer sans vérifier ». Aucune commande de
vérification, de mesure ni de build n'a été lancée : ni codegen, test, typage, lint, build, serveur,
navigateur, Lighthouse, Playwright ou profilage. Seules opérations : lecture de fichiers, recherches
textuelles, et trois lectures git (`log -1`, `branch --show-current`, `status --porcelain | wc -l`)
pour l'inventaire. Seul fichier écrit : ce rapport.

**Source lue** : ANTSIA, branche `codex/pa4-identite-session`, `HEAD` `9eaff40` (18/10/2026 13:06),
arbre partagé de **564 entrées** modifiées ou non suivies (sources P01–P15, PA9/PA10, DIASPORALE),
lu tel quel les 18 et 19/10. Ces sources n'ont jamais été compilées ni exécutées depuis P03 (rapports
P03–P15) : un constat de lecture peut viser du code qui ne compile pas encore. PRO.GA n'a été lu que
pour les commandes du protocole (§4).

**Périmètre audité** : coque et navigation (P02), fil liste et immersif (P04, PA10), carte de
publication connectée et carte publique SSR (P03), Messages, appels et notifications (P05), boutique
(P07), catalogue, fiche et slot d'offre (P09), contact commercial (P10), panier, préparation, paiement
et achats (P11–P13, interface), emploi (P15). **Exclus et à auditer après P14** : voir annexe B.

**Méthode** : lecture intégrale des composants de chaque surface, puis recherche de motifs dans
`apps/antsia_ga/src`, `packages/social-features/src`, `packages/ui/src` et les modules Convex
appelés (`aria-*`, `role=`, régions vivantes, dialogues, `useQuery`/`useAuthenticatedConvexQuery`,
`setInterval`, `addEventListener`, `.collect()`, `<style>`, `next/image`, imports statiques).
Chaque constat cite le code lu. Quand l'effet dépend du rendu ou du navigateur, il est marqué
« à confirmer » ou « à mesurer » : la conséquence est alors une déduction, pas une observation.

**Gravité** :
- **bloquant** : empêche une tâche essentielle (10 §1) au clavier ou au lecteur d'écran ;
- **majeur** : barrière significative sur un parcours (non-conformité WCAG 2.2 A/AA probable) ou risque
  fort de manquer un budget de 10 §4 ;
- **mineur** : écart de faible impact, confort ANTSIA (cible tactile de 44 px, 03 §3), bonne pratique,
  ou non-conformité dont l'effet reste limité.

## 1. Matrice de recette

### 1.1 Surfaces branchées, routes réelles et acteurs

Routes lues dans `apps/antsia_ga/src/lib/routes.ts` et `apps/antsia_ga/src/app/**`.

| Id | Surface | Routes réelles (paramètres) | Acteurs à recetter | Lots |
|---|---|---|---|---|
| S1 | Coque : barre basse à cinq destinations, rail ≥ 960 px, barre du haut, « Créer », cloche | `/fil`, `/explorer`, `/moi`, `/messages`, `/mon-fil`, `/moderation`, `/profil/[handle]`, `/page/[handle]`, `/actus/[[...chemin]]`, `/groupes`, `/evenements` ; sans barre ni rail : `/direct/[id]`, `/conference/[id]` ; hors coque : `/mes-donnees`, `/parametres`, `/decouvrir` | membre (adhésion déclarée, vérifiée), membre restreint (renvoyé vers `/mes-donnees`), visiteur sans session (renvoyé vers `/entrer`), accueil (`/bienvenue`) | P02, P01 |
| S2 | Fil liste et immersif | `/fil` (téléphone : immersif par défaut ; bureau : liste avec bascule) ; `/fil?portee=national`, `/fil?portee=province&province=<slug>`, `/fil?portee=national&tag=<mot>`, `&curseur=` ; `/fil?post=<id>` | membre, réseau à couverture lacunaire ou en préparation (PA10), préférence de réduction des mouvements, économie de données | P04, PA10 |
| S3 | Carte de publication connectée : galerie, vidéo, visionneuse, réactions, commentaires, partage, menu « ⋯ », signalement | dans S2, `/profil/[handle]`, `/page/[handle]` | auteur, lecteur autorisé, média retenu ou retiré, publication devenue inaccessible | P03 |
| S4 | Carte publique SSR | `/publications/[id]`, `/@[handle]`, `/pages/[handle]`, `/tags/[tag]`, `/provinces/[slug]`, `/decouvrir` ; continuation `/entrer?publication=<id>` | visiteur anonyme, membre authentifié (`viewer="authenticated"`), session refusée, transfert de session | P03 |
| S5 | Messages : trois vues, conversation, composeurs, canal commercial | `/messages`, `/messages?brique=iappel`, `/messages?brique=icontact`, `/messages/chat/<id>`, `/messages/groupe/<id>`, `/messages/a/<handle>`, `/messages/nouveau`, `/messages/nouveau-groupe`, `/messages/commerce/<threadId>` ; carte iCom ≥ 1108 px sur `/fil` | membre, correspondant, groupe (jusqu'à 11), demandeur et répondant commercial | P05, P10 |
| S6 | Appels | bannière d'appel entrant (bureau), carte plein écran (téléphone), fenêtre flottante, pilule réduite, écran de fin | appelant, appelé, groupe, refus, occupé, permission refusée | P05 |
| S7 | Notifications | cloche (carte flottante), `/fil?notifications=1`, `/notifications/ouvrir?notification=<ref>`, worker `/notifications-worker` | destinataire, session à rétablir, référence expirée | P05 |
| S8 | Boutique : gestion | `/mes-boutiques`, `/mes-boutiques/[id]` (quatre étapes), `/mes-boutiques/liaison/retour` | membre déclaré, gérant de page, mandataire, ancien préparateur, politique fermée | P07, P08 |
| S9 | Boutique : vitrines et annuaire | `/explorer#boutiques`, `/boutique/[handle]`, `/boutiques/[handle]` (SSR) | membre, visiteur anonyme, gérant | P07 |
| S10 | Catalogue, fiche, slot d'offre | `/boutique/[handle]/catalogue`, `/boutiques/[handle]/catalogue` (`type`, `collection`, `recherche`, `curseur`), `/boutique/[handle]/offres/[offerRef]`, `/boutiques/[handle]/offres/[offerRef]` ; slot dans S3 et S4 | membre, visiteur anonyme, gérant (association à une publication) | P09 |
| S11 | Contact commercial | `/boutique/[handle]/contacter?offre=<ref>`, `/messages/commerce/<threadId>`, équipe et boîte dans `/mes-boutiques/[id]` | demandeur, répondant mandaté, gérant, répondant désaffilié, inconnu bloqué | P10 |
| S12 | Panier, préparation, paiement, achats | `/panier`, `/boutique/[handle]/preparer/[offerRef]`, `/mes-commandes`, `/mes-commandes/[attemptId]`, `/mes-paiements`, `/mes-paiements/[paymentAttemptId]`, `/mes-paiements/[paymentAttemptId]/retour`, `/mes-achats`, `/mes-achats/[purchaseId]` | acheteur en ligne et hors ligne, réserve expirée, session remplacée, deux acheteurs du dernier article | P11, P12, P13 |
| S13 | Emploi | `/explorer#emplois`, `/boutique/[handle]/emplois`, `/boutique/[handle]/emplois/[jobRef]`, `/boutiques/[handle]/emplois/[jobRef]` (SSR), `/mes-candidatures` ; console : politique des emplois | candidat, visiteur anonyme, offre close, opérateur (console) | P15 |

### 1.2 Conditions communes et bascules à observer

| Condition | Valeurs | Ce que le code fait basculer (lu) |
|---|---|---|
| Largeurs | 320, 375, 393, 440, 768, 960, 1280, 1440 px | coque téléphone ≤ 959 px, rail ≥ 960 px (`member-chrome.tsx:154`) ; carte iCom ≥ 1108 px ; grilles `sm` (640 px) des cartes et formulaires ; feuille de commentaires ≥ 768 px |
| Paysage | 812×375, 852×393 | sous 480 px de hauteur, l'immersion cède la place à la liste (rapport P04) |
| Zoom 200 % | 1280×800 → 640×400 px CSS | coque téléphone, immersion → liste, barres fixes sur 400 px de hauteur |
| Thèmes | système, clair, sombre | `.dark` posé après hydratation (A36) ; scène d'appel et vidéo toujours sombres |
| Clavier | Tab, Maj+Tab, Entrée, Espace, Échap, flèches, Début/Fin, Page préc./suiv. | lecteur immersif, galerie, palette des réactions, menu « ⋯ », cartes flottantes |
| Lecteur d'écran | VoiceOver iOS et macOS, TalkBack, NVDA (Windows) | régions vivantes, noms accessibles, ordre de lecture |

### 1.3 Matrice surface × condition

`O` : passage obligatoire ; `E` : échantillon (un passage, une humeur de thème). Les constats du §2
à recontrôler sont rappelés en dernière colonne.

| | 320 | 375 | 393 | 440 | 768 | 960 | 1280 | 1440 | Pays. | Zoom | Clair | Sombre | Clavier | LE | Constats |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| S1 | O | O | O | E | O | O | O | E | O | O | O | O | O | O | A13, A31, A32, A44 |
| S2 | O | O | O | O | O | O | O | E | O | O | O | O | O | O | A12, A23, A24, A42 |
| S3 | O | E | O | E | E | E | O | E | O | O | O | O | O | O | A01, A03, A06, A07, A09–A11, A22, A25, A35, A43 |
| S4 | O | E | E | E | E | E | O | E | E | O | O | O | O | O | A09 |
| S5 | O | O | E | E | O | O | O | E | O | O | O | O | O | O | A02, A04, A15, A25–A29, A33 |
| S6 | E | O | O | E | E | E | O | E | O | E | O | O | O | O | A05, A25, A26 |
| S7 | E | O | E | E | E | E | O | E | E | E | O | O | O | O | A26 |
| S8 | O | O | E | E | E | E | O | E | E | O | O | O | O | O | A14, A21, A34 |
| S9 | O | E | O | E | E | E | O | E | E | O | O | O | O | O | A22 |
| S10 | O | E | O | E | O | E | O | E | E | O | O | O | O | O | A21, A38, A45 |
| S11 | O | O | E | E | E | E | O | E | E | O | O | O | O | O | A15 |
| S12 | O | O | E | E | E | E | O | E | E | O | O | O | O | O | A16–A18, A21, A39 |
| S13 | O | O | E | E | E | E | O | E | E | O | O | O | O | O | A18, A19, A39–A41 |

## 2. Audit statique d'accessibilité

### 2.1 Synthèse

45 constats : **2 bloquants, 17 majeurs, 26 mineurs**. Répartition par lot au §5.2.

### 2.2 Bloquants

| Id | Surface · fichier:ligne | Constat lu | WCAG 2.2 | Correction proposée | Lot |
|---|---|---|---|---|---|
| A01 | S3 · `packages/social-features/src/features/reseau-personnel/PostOverflowMenu.tsx:143-172`, `:318-367` | Le menu « ⋯ » (`role="menu"`) est portalisé en fin de `<body>` (`createPortal`, l. 331-367). À l'ouverture, le focus reste sur le déclencheur : aucun `focus()` vers une entrée, aucune flèche. Tout défilement, capturé sur `window`, le referme (l. 164, 167) ; or atteindre la fin du document au clavier ou au lecteur d'écran fait défiler. C'est la seule porte vers Signaler, Masquer, Ne plus voir, Modifier, Supprimer, Épingler et Me notifier. | 2.1.1 (A), 2.4.3 (A), 4.1.2 (A) | À l'ouverture, focaliser la première entrée ; flèches, Début et Fin avec tabindex itinérant ; Tab et Échap ferment et rendent le focus ; ne fermer au défilement que si le focus est hors du menu. À défaut, un `DropdownMenu` Radix (paquet `radix-ui` déjà employé par `packages/ui/src/sheet/sheet.tsx`) enveloppé dans `packages/ui`. Test : ouvrir au clavier, atteindre « Signaler », Échap rend le focus. | P03 |
| A02 | S5 · `features/messagerie/MessageBubble.tsx:225-305` ; `MessageAttachment.tsx:104-167` ; `ReplyPreview.tsx:78-86` | Chaque bulle est un `<button class="msg-bubble-btn">` dont le nom est « Actions sur le message : » suivi des **60 premiers caractères** (l. 236-241). Le reste du texte, la citation, « transféré », « modifié » et les pièces ne sont pas exposés. Le bouton contient des contrôles interactifs : lien d'image `<a href>`, `<video controls>`, `<audio controls>` des messages vocaux, bouton « Aller au message cité ». Ce contenu interactif est interdit dans `<button>`, dont les enfants sont présentés comme décoratifs. | 1.3.1 (A), 4.1.2 (A), 2.1.1 (A) | Rendre la bulle non interactive (`li` d'une liste, texte intégral lisible) avec un bouton distinct « Actions sur le message de {auteur} », en conservant appui long et menu contextuel. Sortir pièces, vocaux et citation de ce bouton. Voir aussi A29. | P05 |

### 2.3 Majeurs

| Id | Surface · fichier:ligne | Constat lu | WCAG 2.2 | Correction proposée | Lot |
|---|---|---|---|---|---|
| A03 | S3 · `reseau-personnel/ReportContentDialog.tsx:29-45` | `role="dialog" aria-modal="true"` posés à la main, sans `useModalA11y` : ni focus initial, ni piège, ni Échap, ni inertage, ni restitution. Le menu « ⋯ » a déjà rendu le focus à son déclencheur (`PostOverflowMenu.tsx:178-181`), qui reste derrière le voile. | 2.4.3 (A), 2.1.1 (A), 4.1.2 (A) | `EspaceDialog` ou `ImmersiveOverlay`, comme `SharePostDialog`. Focus sur le motif, Échap ferme, retour au déclencheur ; formulaire RHF + Zod selon la convention. | P03 |
| A04 | S5 · `messagerie/MessagerieConversationView.tsx:1609-1633` ; `NewMessagesPill.tsx:38-43` | Les messages reçus ne sont pas annoncés. `div.msg-body` n'a pas de rôle ; son `aria-labelledby` vise un élément générique et n'est donc pas exposé. La pastille « N nouveaux messages » n'est pas une région vivante. | 4.1.3 (AA) | `role="log"` avec annonce polie limitée aux arrivées en bas, ou région `sr-only` « Nouveau message de X ». Ne pas annoncer l'historique chargé ; garder la saisie en cours `aria-hidden`. | P05 |
| A05 | S6 · `iappel/IncomingCallBanner.tsx:76-84` (en-tête l. 11-14) ; `shell/communication/global-call-surface-host.tsx:646-705` | La bannière d'appel entrant du bureau est un `role="group"`, sans région vivante, alors que son en-tête en promet une. Au téléphone, la carte plein écran est un simple `<div className="iappel-layer fixed inset-0">` (l. 703-704) : ni dialogue, ni focus, ni inertage. Un focus clavier peut donc rester caché dessous. | 4.1.3 (AA), 2.4.11 (AA), 2.4.3 (A) | Région persistante dans l'hôte d'appel : « Appel entrant de X ». Au téléphone, monter la carte par `ImmersiveOverlay` (dialogue, focus sur « Répondre ») comme `CallSurface.tsx:154-167` ; Échap ne doit pas refuser l'appel. | P05 |
| A06 | S3 · `reseau-personnel/CommentsSurface.tsx:295-305` | `aria-live="polite"` est posé sur le conteneur défilant de toute la liste. Chaque commentaire reçu en temps réel, page chargée, modification ou suppression fait relire de larges blocs. | 4.1.3 (AA) | Retirer `aria-live` du conteneur ; ajouter une région `sr-only` dédiée : publié, N nouveaux, chargement. | P03 |
| A07 | S3, S1 · `packages/ui/src/hooks/use-modal-a11y.ts:98-113` ; `apps/antsia_ga/src/components/providers.tsx:37-40` | Le hook rend inertes tous les enfants de `<body>` hors du dialogue, dont la région polie des toasts (sonner 2.0.7, rendue sur place, sans portail). Or des erreurs et confirmations partent en toast pendant les modales : `CommentsSurface.tsx:184,203,210`, `SharePostDialog.tsx:66,83,86`, `PostComposer.tsx:334,341`, `StoryCreateSheet.tsx:346,352`. Ces retours ne sont ni annoncés ni atteignables. | 3.3.1 (A), 4.1.3 (AA) | Exempter la région des toasts de l'inertage (attribut lu par le hook), ou doubler chaque erreur d'une alerte dans le dialogue, comme `CommentsSurface.tsx:379-386`. | transverse (P01, P03) |
| A08 | S3, S4 · `packages/social-contracts/src/media.ts:12-21` ; `PostMediaPresentation.tsx:392-405` | Le contrat média n'a ni piste de sous-titres ni affiche ; `<video>` n'a pas de `<track>`. Le composeur ne permet de déposer aucun sous-titre. | 1.2.2 (A) pour toute vidéo préenregistrée avec audio | Champ additif `captions?: { url, lang, label }[]` (WebVTT, usage d'upload dédié sous la garde FullAV) et `<track kind="captions">`. D'ici là, déclarer la limite avant le pilote (P19). | P03 |
| A09 | S4 · `apps/antsia_ga/src/components/public/public-post-card.tsx:28` ; `packages/ui/src/styles/theme.css:138-144` | Mots-dièse et mentions des cartes publiques : `text-primary hover:underline`, donc aucun soulignement au repos. La base pose `a { text-decoration: none }`. Rapport lien/texte : 2,13:1 en clair, 1,68:1 en sombre (P01 D5). Le fil connecté lit déjà `--esp-inline-link-decoration` (`RichText.tsx:46-62`). | 1.4.1 (A) | Souligner ces liens dans `PublicBody`, ou lire le même jeton que `RichText`. | P03 |
| A10 | S3 · `reseau-personnel/PostReactionControl.tsx:318-333` | Réagi ou non, « J'aime » garde l'icône `ThumbsUp` et le libellé « J'aime ». Seuls changent le fond `--primary-50` (1,11:1 sur la carte, P01 §11) et la teinte. | 1.4.1 (A), 1.4.11 (AA) | Icône pleine ou coche, état écrit (« Vous aimez »), graisse ; fond d'état d'au moins 3:1. | P03 |
| A11 | S3 · `PostReactionControl.tsx:259-262`, `:278-280`, `:292-296`, `:393-470` | La palette s'ouvre au survol (l. 259) et au focus clavier (l. 292-296). Placée au-dessus du bouton (l. 402), elle masque du contenu ; Échap n'agit que si le focus y est. Ses quatre `menuitemradio` restent tous dans l'ordre de tabulation, soit quatre arrêts de plus par carte. Le déclencheur cumule `aria-pressed` et `aria-haspopup="menu"`. | 1.4.13 (AA), 2.4.3 (A), 4.1.2 (A) | Ouvrir la palette seulement par le bouton « Plus de réactions », déjà présent. Échap global tant qu'elle est ouverte, tabindex itinérant (un seul arrêt), déclencheur réduit à une bascule. | P03 |
| A12 | S2 · `apps/antsia_ga/src/components/discovery/member-feed.tsx:92-97` | Le `<select>` des provinces navigue à chaque `change` (`router.push`). Sous Windows, une flèche au clavier change donc de page dès la première option. | 3.2.2 (A) | Formulaire GET avec bouton « Afficher » (RHF + Zod). | P04 (fil national, P02) |
| A13 | S1 · `apps/antsia_ga/src/components/member-chrome.tsx:55-58` ; `shell/mobile/ReseauMobileTabBar.tsx:132-140` | En-tête `sticky top-0` et barre basse `fixed` (12 px de gouttière, encoche comprise). Aucune `scroll-padding` dans `globals.css` ni `theme.css` ; seule occurrence : `mobile-styles.tsx:235`, horizontale. Un élément focalisé peut passer sous les barres. | 2.4.11 (AA), à confirmer en recette clavier | Dans `apps/antsia_ga/src/app/globals.css` : `scroll-padding-top` et, sous 960 px, `scroll-padding-bottom` (hauteur de barre, gouttière, `env(safe-area-inset-bottom)`). | P02 |
| A14 | S8 · `apps/antsia_ga/src/components/shops/shop-editor-screen.tsx:45-46`, `:69`, `:75` ; `shop-publication-form.tsx:56-57` | Les étapes sont des panneaux `hidden`. Les boutons qui passent à une autre étape sont DANS le panneau qui se masque : le focus tombe sur `<body>`. Le changement d'étape n'est pas annoncé. | 2.4.3 (A) | Focaliser le titre du panneau ouvert (`tabIndex={-1}`) et annoncer « Étape 2 sur 4 » ; `EspaceWizardProgress` existe déjà (`EspaceFloatingCard.tsx:268-307`). | P07 |
| A15 | S11 · `packages/social-features/src/features/messagerie/CommercialConversationView.tsx:93-137` | 13 usages de la classe `.msg-tool-btn`, définie nulle part dans le dépôt (recherche sur `.ts`, `.tsx`, `.css`, `.mjs`). Les gestes du canal commercial (Accepter, Refuser, Bloquer, Fermer, Signaler, Supprimer, appels audio et vidéo, pages) sont donc des boutons natifs du navigateur : hauteur d'une ligne de texte, ni jetons clair/sombre, ni anneau de la charte. | 2.5.8 (AA) à mesurer (l'exception d'espacement s'applique probablement), cible ANTSIA 44 px, 1.4.11 à mesurer | Définir `.msg-tool-btn` dans `messagerie-styles.tsx` (44 px minimum, jetons), ou utiliser le `Button` partagé. | P10 |
| A16 | S12 · `apps/antsia_ga/src/components/checkout/checkout-form.tsx:90` | `autoComplete="off"` sur localité, ligne 1 et ligne 2 de l'adresse ; pays sans jeton. | 1.3.5 (AA) | `shipping address-level2`, `shipping address-line1`, `shipping address-line2`, `shipping country` ; `off` reste admis pour les instructions. Ces jetons n'envoient rien au serveur et ne relisent pas le profil social (rapport P11). | P11 (P13) |
| A17 | S12 · `checkout/checkout-screen.tsx:74-80` ; `checkout-summary.tsx:30` ; `payment/payment-checkout-panel.tsx:97-115` ; `checkout/use-checkout-clock.ts:6-18` | La réserve (quinze minutes, P11) et l'autorisation de paiement expirent à une heure affichée. L'écran bascule en « expiré » sans avertissement préalable et sans prolongation. | 2.2.1 (A), à arbitrer | Annonce à l'approche de l'échéance (au moins vingt secondes avant, par exemple à deux minutes) et « Prolonger » si PRO.GA l'admet. Sinon, motiver l'exception « essentielle » dans les rapports P11 et P12. | P11, P12 |
| A18 | S12, S13 · `payment/payment-status-card.tsx:28-39` ; `purchases/purchase-card.tsx:17-23` ; `jobs/my-applications-screen.tsx:52-55` | Les titres et listes d'état (paiement, commande, candidature) suivent l'abonnement sans aucune annonce. Le passage de « en cours » à « réussi » est silencieux. | 4.1.3 (AA) | Région polie persistante qui annonce les changements d'état, hors premier rendu. | P12 (P13, P15) |
| A19 | S13 · `apps/antsia_ga/src/components/jobs/job-application-form.tsx:57-61`, `:102`, `:115` | Le `<form>` de dépôt de pièce (`JobFilesManager`) est rendu À L'INTÉRIEUR du `<form>` de candidature. Ni le formulaire interne ni RHF n'arrêtent la propagation de `submit` : un simple dépôt déclenche aussi la validation de la candidature (alertes d'erreur), voire son envoi si elle est valide. | 3.2.2 (A), 3.3.4 (AA) ; défaut fonctionnel à confirmer par test | Sortir `JobFilesManager` du formulaire parent ; ajouter le test « un dépôt n'appelle pas `apply` ». | P15 |

### 2.4 Mineurs

| Id | Surface · fichier:ligne | Constat lu | WCAG 2.2 | Correction proposée | Lot |
|---|---|---|---|---|---|
| A20 | toutes · `shop-editor-screen.tsx:47`, `shop-publication-form.tsx:58,65`, `catalog-member-screen.tsx:32`, `checkout-screen.tsx:39,70`, `CoordinatedVideoControls.tsx:129-133`, `ImmersiveFeedReader.tsx:847-856`, `:885-895` | Des régions `role="status"` sont montées en même temps que leur texte : l'annonce n'est pas garantie. L'état lacunaire du fil est dupliqué entre la barre et la fin du lecteur. | 4.1.3 | Un annonceur persistant par écran (hook partagé) ; une seule annonce de lacune. | transverse |
| A21 | formulaires · `apps/antsia_ga/src/components/shared/controls.tsx:51-70` ; `my-shops-screen.tsx:55,58` ; `shop-commerce-link.tsx:53-59` ; `catalog-post-linker.tsx:47` ; `checkout-form.tsx:85-91` ; `offer-cart-actions.tsx:33-34` ; `cart-screen.tsx:109` ; `purchases-screen.tsx:125-126` ; `payment-screen.tsx:107-108` ; `job-application-form.tsx:117-118` ; `CommentsSurface.tsx:363-386` ; `shop-presentation-form.tsx:93,101` | `Field` affiche l'erreur (`role="alert"`, `id="<id>-error"`) sans la relier au champ. Ces écrans posent `aria-invalid` sans `aria-describedby`, ou ni l'un ni l'autre. | 1.3.1, 3.3.1 | Faire relier le champ par `Field` lui-même (contexte ou clonage), sur le modèle de `contact-request-screen.tsx:49`. | transverse |
| A22 | S3, S9 · `PostCard.tsx:678-685` ; `member-storefront-screen.tsx:37` | Enregistrer et Suivre : `aria-pressed` combiné à un libellé qui change. L'état est lu deux fois. | 4.1.2 | Libellé fixe, état porté par `aria-pressed` seul. | P03, P07 |
| A23 | S2 · `feed-immersion/ImmersiveFeedReader.tsx:283-293` ; `PostCard.tsx:633-634` | Le créneau `role="article"` contient l'`<article>` de la carte. | 1.3.1 | Un seul niveau d'article en immersion. | P04 |
| A24 | S2 · `shell/mobile/ReseauMobileFeed.tsx:348-356` ; `shell/ReseauAgentPage.tsx:929-938` ; `FeedPages.tsx:224-231` | En liste, « Voir plus » annonce toujours « 20 publications » avant la réponse, quel que soit le résultat. Le premier chargement n'a ni `aria-busy` ni phrase. | 4.1.3 | Annoncer après la réponse, comme le lecteur (`ImmersiveFeedReader.tsx:773-784`) ; phrase `sr-only` pendant le chargement. | P04 |
| A25 | S3, S5, S6 · `messagerie-styles.tsx:888-900` (puces de réaction : 11 px × 1,6 + 2 + 2 ≈ 21,6 px de haut) ; `MessageComposer.tsx:725-733` (retrait de pièce, 22 px) ; `messagerie-styles.tsx:1104-1116` (envoi hors page, 30 px) ; `CallStage.tsx:609-616` (Réduire, 36 px) ; `CommentsSurface.tsx:351-358` (annuler la réponse, 32 px) ; `PostOverflowMenu.tsx:291-303` (« ⋯ », 34 px) ; `PostMediaPresentation.tsx:196-206` (points, 24 px) ; `PostComposer.tsx:518-537` (retrait de média, 28 px) | Cibles sous les 44 px de 03 §3 ; deux d'entre elles sous 24 px. | 2.5.8, à mesurer (24 px ou espacement) | Viser 44 px, ou au moins 24 px avec l'espacement ; mesurer en recette. | P05, P03 |
| A26 | S6, S7 · `iappel/CallStage.tsx:600-606` ; `notifications/NotificationsList.tsx:147` | `aria-label` posé sur un `span` générique : il n'est pas exposé (durée d'appel, pastille). | 4.1.2 | Texte `sr-only` (« Durée : ») ou rôle approprié. | P05 |
| A27 | S5 · `MessagerieConversationView.tsx:1721-1725` | L'erreur d'envoi est rendue en `role="status"`. | 4.1.3 | Passer en `role="alert"`. | P05 |
| A28 | S5 · `messagerie/IcomMessagesPage.tsx:89-90` | `<aside>` et `<nav>` portent le même nom (« Navigation »). | 1.3.1, 2.4.1 | Noms distincts : « Liste des conversations », « Vues de Messages ». | P05 |
| A29 | S5 · `messagerie/MessageAttachment.tsx:108-111` | L'image jointe a pour texte alternatif le nom de fichier. | 1.1.1 (F30) | Alternative saisie, ou neutre (« Image envoyée par X »). | P05 |
| A30 | S3 · `ReportContentDialog.tsx:102-109` | Libellé visible « Précision facultative », nom accessible « Précision du signalement ». | 2.5.3 (A), faible impact | Faire commencer le nom par le libellé visible. | P03 |
| A31 | S1 · `ReseauMobileTabBar.tsx:140`, `:158`, `:163` | Barre de hauteur fixe (`h-16`), libellés de 10 px tronqués (`truncate`), pastille de 9 px. Le libellé disparaît quand le texte est agrandi ou espacé. | 1.4.4, 1.4.12 | Hauteur minimale au lieu d'une hauteur fixe, retour à la ligne permis. | P02 |
| A32 | S1 · `shell/floating-card/EspaceFloatingCard.tsx:94-103` | Titre des cartes flottantes en `white-space: nowrap` avec points de suspension. | 1.4.4, 1.4.10 | Retour à la ligne permis. | P02 |
| A33 | S5 · `apps/antsia_ga/src/components/messages/messages-screen.tsx:14` | Page en `h-dvh overflow-hidden`. À 640×400 px CSS, la barre du haut, l'en-tête et le composeur réduisent la zone des messages. | 1.4.10, à mesurer | Au-dessous d'une hauteur seuil, défilement du document. | P05 |
| A34 | S8 · `shop-editor-screen.tsx:45` | Étapes de l'éditeur en défilement horizontal (`overflow-x-auto`, `w-max`) : à 320 px, les étapes 3 et 4 peuvent sortir du champ. | 1.4.10 | Liste verticale ou repliée sous 640 px. | P07 |
| A35 | S3 · `PostComposer.tsx:541-551` ; `PostMediaPresentation.tsx:342-344` | Texte alternatif facultatif, sans libellé visible (seulement un placeholder) et en 13 px : iOS agrandit la page sur les champs de moins de 16 px, et 03 §3 demande 16 px. Une image sans texte devient décorative. | 1.1.1 (contenu des membres), 3.3.2 | Libellé visible en 16 px et invitation non bloquante avant publication. | P03 |
| A36 | S1 · `shell/appearance/provider.tsx:40-79` ; `apps/antsia_ga/src/app/layout.tsx:32` | Bref flash clair au rechargement en préférence sombre (P01 D12, laissé à P18). | confort (ce n'est pas un flash au sens de 2.3.1) | Script de démarrage et modification du provider décrits en P01 §P4. | P01 |
| A37 | tiroirs · `packages/ui/src/sheet/sheet-button.tsx:11` | Anneau `ring-ring/50`, environ 2,47:1 en clair selon P01, avec une bordure pleine de 1 px. | 1.4.11, 2.4.7, à mesurer | Anneau plein via le jeton de contrat, sans réécrire la primitive en place. | P01 |
| A38 | S10 · `apps/antsia_ga/src/components/shops/offer-card.tsx:20-29` | Trois liens vers la même fiche (image, titre, « Voir l'offre ») : trois arrêts de tabulation par carte. | confort clavier | Image en `tabIndex={-1}` et `aria-hidden`. | P09 |
| A39 | S12, S13 · `jobs/member-shop-jobs-screen.tsx:80` ; `payment/payment-checkout-panel.tsx:86` | Le déclencheur est remplacé par son contenu (Candidater par le formulaire, intention de paiement) : le focus est perdu. | 2.4.3 | Focaliser le titre du contenu affiché. | P15, P12 |
| A40 | S13 · `my-applications-screen.tsx:39` ; `member-shop-jobs-screen.tsx:36` ; `member-job-directory.tsx:42` | « Voir plus » REMPLACE la page (curseur suivant) sans « Précédent ». | 2.4.3, 3.2.4 | Ajouter « Précédent » et nommer « Page suivante », ou ajouter la page à la suite. | P15 |
| A41 | S13 · `job-application-form.tsx:109` | L'aperçu du nom transmis, en `aria-live`, est annoncé à chaque frappe. | 4.1.3 (bavardage) | Annoncer à la perte du focus, ou ne rien annoncer. | P15 |
| A42 | S2 · `media-playback/media-playback-policy.ts:144-151` | La lecture automatique muette ignore `prefers-reduced-motion` quand l'immersion a été choisie. | 2.2.2 respecté (commandes natives) ; confort | Mettre la décision sur « Lire » (manuel) si la réduction des mouvements est demandée. | P04 |
| A43 | S3 · `PostOverflowMenu.tsx:211-237` ; `providers.tsx:39` | « Annuler » (après Masquer ou Ne plus voir l'auteur) n'existe que dans un toast, à la durée par défaut de sonner 2.0.7 (4 000 ms). | 2.2.1, alternative persistante à confirmer | Toast d'action sans expiration, ou lien vers la liste des masqués. | P03 |
| A44 | S1 · `shell/ReseauMenuRail.tsx:223`, `:320` ; `(membre)/moderation/page.tsx`, `groupes/page.tsx`, `evenements/page.tsx` | Les `h2` du rail précèdent le `h1` de la page. Ces trois pages n'ont pas de métadonnées : titre générique de l'application. | 1.3.1, 2.4.6, 2.4.2 (A) | Titres de page propres ; titres du rail en `p` nommés ou repère sans titre. | P02 |
| A45 | S10 · `apps/antsia_ga/src/components/shops/catalog-model.ts:37-39` | Dates du catalogue au fuseau fixe `Africa/Libreville`, alors que les autres surfaces lisent `useViewerTimeZone`. | i18n, cohérence | Fuseau de la personne. | P09 |

### 2.5 Points lus sans impact établi (à vérifier, non comptés)

- `use-modal-a11y.ts:118-123` : Échap est écouté sur `document` sans pile ni `stopImmediatePropagation`.
  Deux modales empilées se fermeraient ensemble ; aucun empilement n'a été trouvé dans les parcours
  lus (la feuille de commentaires se ferme avant le signalement, `CommentsSurface.tsx:190-195`).
- Tiroirs Radix (`MessageActionsSheet`, `ForwardMessageSheet`) : ils masquent probablement leurs frères
  pour les aides techniques, comme A07. Vérifier en recette si un toast est émis pendant un tiroir.
- Les lignes de conversation sont des `<button>` qui naviguent (`MessagerieListView.tsx:445`, `:500`) :
  pas d'ouverture dans un onglet. Choix d'ergonomie à confirmer.

## 3. Audit statique de performance

### 3.1 Chaîne critique d'une page membre (lecture)

1. HTML sans contenu : `NetworkShell` rend `CenteredStatus` tant que la session n'est pas « member »
   (`network-shell.tsx:79`).
2. JS de la coque, dont la couche d'appel et LiveKit, importée statiquement (F02).
3. Authentification, puis trois requêtes de session : réseau racine, personne, adhésions
   (`use-session-state.ts:27-42`).
4. Requête `myFeed` de la première page (`FeedPages.tsx:94-106`) et préparation PA10.
5. Images d'origine (F04), puis vidéos selon le rôle du créneau.

Cette cascade est le premier facteur de risque du budget « premier contenu utile ≤ 3 s p75 »
(10 §4). Aucun segment n'a été mesuré.

### 3.2 Constats

14 constats : **6 majeurs, 8 mineurs**. Aucun n'est classé bloquant sans mesure.

| Id | Grav. | Fichier:ligne | Constat lu | Correction proposée | Lot |
|---|---|---|---|---|---|
| F01 | majeur, à mesurer | `network-shell.tsx:61-90` ; `use-session-state.ts:27-42` ; `FeedPages.tsx:94-106` | Cascade du §3.1 entièrement côté client, chaque étape attendant la précédente. | Mesurer chaque segment ; lancer la requête du fil dès l'authentification. Étudier un préchargement serveur de la première page sur le modèle des projections SSR déjà présentes ; voir F02 et F04. | transverse (P04, PA10, P02) |
| F02 | majeur, à mesurer | `network-shell.tsx:5`, `:86` ; `shell/communication-shell.tsx:21-22` ; `shell/communication/global-call-surface-host.tsx:41-68` | `CallRoomPool`, `CallStage`, `CallSurface` et `DirectSessionHost` sont importés statiquement, donc `livekit-client` 2.22.3 et `@livekit/components-react` 2.9.24 chargent sur toutes les pages membres, avant tout appel. Aucun `next/dynamic` ni `React.lazy` dans `apps/antsia_ga/src` ni dans `packages/{ui,api,social-features}/src`. | Charger les modules de salle en différé, à la première sonnerie ou au premier appel ; l'hôte léger reste persistant. | P05 |
| F03 | majeur, à mesurer au build | `apps/antsia_ga/src/components/public/public-post-media.tsx:4` ; `packages/social-features/src/features/reseau-personnel/index.ts:10-159` ; `packages/social-features/package.json` ; `packages/api/next-config.mjs:65-77` | L'îlot client de la carte publique importe `PostMedia` depuis le barillet `reseau-personnel`, qui exporte la page réseau, les profils, les groupes, les personnes et le composeur. Pas de `sideEffects` dans le paquet, pas d'`optimizePackageImports` : une large part du moteur peut entrer dans le JS des pages publiques SSR. | Point d'entrée dédié (`./post-media`) et `sideEffects` déclaré ; mesurer le JS de `/publications/[id]` avant et après. | P03 |
| F04 | majeur | `packages/social-domain/src/content.ts:87-88` ; `useMediaDraft.ts:150-155` ; `PostMediaPresentation.tsx:338-352` ; `offer-card.tsx:13` ; `public-storefront-card.tsx:21`, `:26` | Photos de publication jusqu'à 20 Mio, déposées sans ré-encodage, alors qu'`AlbumComposer.tsx:106-115` en possède un. `<img src>` sans `srcset` ni `sizes` ; l'anticipation des images dépend du seuil `loading="lazy"` du navigateur et n'est pas bornée à la voisine. `next/image unoptimized` pour le catalogue et la vitrine ; bannière publique au-dessus de la ligne de flottaison en `lazy`. | Ré-encoder les photos de publication en réutilisant le plan d'album ; dérivés serveur à décider ; `eager`/`fetchpriority="high"` pour la première image et la bannière ; images pilotées par le rôle du créneau. | P03 (P04, P07, P09) |
| F05 | majeur, à mesurer | `FeedPages.tsx:94-106` ; `reseau-feed-pages.ts:96-107` ; `convex/modules/posts/posts.ts:828-873` ; `immersive-reader-model.ts:155` | Une souscription `myFeed` vivante par page montée, sans plafond de pages. Chaque exécution relit graphe du lecteur, pages suivies, masqués, sourdines et marques, puis jusqu'à 200 candidats ; une invalidation relance toutes les pages. L'immersion ajoute jusqu'à trois pages d'elle-même. | Garder vivantes les dernières pages seulement (les plus anciennes figées), ou une requête paginée unique ; mesurer lectures et exécutions par minute. | P04, PA10 |
| F06 | majeur, à mesurer | `ImmersiveFeedReader.tsx:40-41` ; `immersive-styles.tsx:102-115` ; `FeedPages.tsx:244-279` | Aucune fenêtre DOM : le lecteur conserve tous les créneaux (`content-visibility: auto` borne seulement le rendu) et la liste toutes les cartes. 04 §4 proposait une fenêtre. | Mesurer mémoire et nœuds à 30 puis 100 publications ; en cas de dérive, remplacer le contenu lourd des créneaux lointains par un espace de même hauteur, sans toucher au créneau focalisé. | P04 |
| F07 | mineur | `media-playback-policy.ts:110-121` ; `PostMediaPresentation.tsx:397` | En mode Liste (rôle `unmanaged`), toutes les vidéos montées préchargent leurs métadonnées, même lointaines. | En liste, `none` hors de l'écran et de la voisine. | P04 |
| F08 | mineur, à mesurer | `iappel/presence-dot.tsx:118-160` ; `convex/modules/calls/presence.ts:94-108` | `now` change chaque minute, d'où un nouvel abonnement qui relit jusqu'à 100 relations (préférences et appels vivants), plus une requête ponctuelle toutes les 75 s, pour chaque surface qui monte le hook. | Mutualiser dans la coque ; pas de temps plus large. | P05 |
| F09 | mineur | `shops/offer-post-slot.tsx:12-17` ; `PostCard.tsx:718` | Une souscription `catalog.postOffer` par publication commerciale montée, jamais démontée. | Aperçu d'offre dans le DTO du fil, ou chargement à l'approche. | P09 |
| F10 | mineur | `PostReactionControl.tsx:471` | `<style>` sans `href` ni `precedence` : un nœud identique par carte, chacun recalculant les styles. | `href` et `precedence`, comme `PostOverflowMenu`. | P03 |
| F11 | mineur | `shop-editor-screen.tsx:46-48` | Les quatre panneaux et leurs abonnements (liaison, catalogue, publications éligibles, équipe, réglages, boîte) sont montés dès l'ouverture. | Monter le seul panneau actif. | P07 |
| F12 | mineur | `contact-team-panel.tsx:50` ; `contact-inbox.tsx:30`, `:37` ; `commercial-messaging-source.ts:24-26` | Recherche sans anti-rebond : un remontage et une souscription par frappe. | `useDebouncedValue` (`packages/ui/src/hooks/use-debounced-value.ts`). | P10 |
| F13 | mineur | `checkout-screen.tsx:158-162` ; `use-checkout-clock.ts:6-18` | Une minuterie et deux écouteurs par ligne de « Mes préparations », bornés à la page. | Une horloge partagée par la liste. | P11 |
| F14 | mineur | `apps/antsia_ga/src/app/layout.tsx:8-11` | La feuille `@livekit/components-styles` est importée dans le gabarit racine, donc servie aussi aux pages publiques. | Couche CSS dédiée, ou import dans le gabarit membre en gardant l'ordre de surcharge. | P01, P05 |

### 3.3 Points solides constatés (lecture)

- **Lecteur immersif** : région nommée avec consigne clavier, `aria-posinset`, annonces persistantes,
  focus sur la première publication ajoutée, bascule nommée `aria-pressed`, liste sous 480 px de
  hauteur, aucun défilement animé en réduction des mouvements (`ImmersiveFeedReader.tsx:842-920`,
  `FeedModeToggle.tsx:34-58`, `immersive-styles.tsx:192-195`).
- **Galerie et visionneuse** : flèches sur tous les écrans, position annoncée, diapositives inactives
  `aria-hidden`, visionneuse modale avec restitution du focus (`PostMediaPresentation.tsx:445-666`).
- **Coordinateur de lecture** : une vidéo à la fois, suspension pendant un appel ou un onglet masqué,
  voisine en métadonnées seulement, économie de données respectée (`media-playback-policy.ts`).
- **Modales du kit** : focus, piège, Échap, inertage et restitution via `ImmersiveOverlay`,
  `EspaceDialog` et `EspaceFloatingCard`. Barre des destinations : `aria-current`, pastille phrasée,
  cinq places égales d'au moins 44 px.
- **Formulaires bien reliés** : P10 (`contact-request-screen.tsx:49`, `contact-crm.tsx:56-59`) et nom
  civil P15 (`job-application-form.tsx:105-106`, `given-name` et `family-name`).
- **Backend commerce borné** : aucun `.collect()` dans `shops/*`, `commercialMessaging/*`,
  `public/{shops,catalog,jobs}.ts` ni `federation/commerce*.ts` ; pagination avec `maximumRowsRead`
  (`catalogRead.ts:85-86`) ; fil national borné (`member-feed.tsx:66-71`).
- **Nettoyage** des minuteries et écouteurs dans les hooks lus. Réduction des mouvements couverte dans
  la couche d'appel. Pages publiques en composants serveur avec des îlots clients minimes ; aucun
  `use client` évitable significatif (F03 vise l'import, pas l'îlot).

## 4. Protocole de mesure P18b (prêt à exécuter plus tard)

### 4.1 Préalables et décisions du propriétaire

1. P14 terminé et audité (annexe B) ; P16 terminé pour une version commerciale ; source gelée
   (SHA et empreinte de l'inventaire avant et après), un seul serveur de dev.
2. Levée explicite du gel « continuer sans vérifier » pour codegen, tests, verify, build et serveurs.
3. Outils absents du catalogue (`package.json` : ni Playwright, ni Lighthouse, ni axe). Leur ajout est
   une décision du propriétaire, mise en œuvre par la session ANTSIA seule (fichiers partagés).
   Proposition : `@playwright/test`, `@axe-core/playwright`, `lighthouse`, en dépendances de
   développement de `apps/antsia_ga`.
4. Liaisons réelles en local : PRO.GA local (`:3220`) lié par P08 et catalogue appliqué par P09 pour
   la latence de projection et le stock. Adaptateur de paiement sandbox (P12) : sans lui, les délais de
   paiement restent **non mesurables**.
5. Appareils physiques et lecteurs d'écran (§4.2). `df -h /System/Volumes/Data` avant tout build ou
   backend local ; Node 22 via `scripts/convex-dev.mjs`.

### 4.2 Appareils, navigateurs et réseau

| Rôle | Référence (à désigner par le propriétaire) | Usage |
|---|---|---|
| Android de référence | téléphone d'entrée de gamme, Chrome stable, profil distant `chrome://inspect` | budgets 10 §4, mémoire, TalkBack |
| iPhone | Safari, VoiceOver | gestes, accrochage, `scroll-snap-stop`, lecture automatique |
| Poste | 1280×800, Chrome et Firefox (NVDA), macOS Safari (VoiceOver) | clavier, zoom 200 %, contrastes rendus |
| Réseau contraint | 1,6 Mbit/s descendant, RTT 150 ms (10 §4) | correspond au profil mobile par défaut de Lighthouse : 1 638,4 kbit/s descendant, 750 kbit/s montant, 150 ms, processeur ralenti ×4 en simulation |
| Réseau de contrôle | Wi-Fi non bridé ; un passage avec `Save-Data` | séparer le réseau de l'appareil |

Chaque mesure sépare quatre parts : **backend** (exécution Convex, lectures), **réseau** (octets,
attentes), **client** (thread principal, rendu, mémoire), **fournisseur** (PRO.GA, prestataire de
paiement, LiveKit).

### 4.3 Fixtures nécessaires (non production)

Aucune graine n'existe aujourd'hui pour ces données : seules `seeds/foundations:run` et
`seeds/devSocial:demoPerson` sont présentes. À écrire en P18b, sous `ANTSIA_SEEDS_HORS_PRODUCTION`,
avec des médias de référence sans donnée personnelle et de poids connus (par exemple 1,5, 4 et
12 Mo) :

- deux personnes de démonstration reliées, plus une troisième pour l'appel de groupe ;
- **30 publications mixtes** : 10 photos (4:5 et 1:1), 6 galeries de 2 à 4 images, 6 vidéos
  (portrait et paysage, dont 2 avec audio), 4 textes longs, 2 partages avec vidéo citée, 2 publications
  de page avec offre liée ;
- une boutique publiée liée à PRO.GA local : 12 offres dont une à **une seule unité en stock** ;
- un fil commercial accepté, avec répondant mandaté ; trois offres d'emploi, dont une close ;
- pour PA10 : la campagne R8 de [docs/20](../../../20_EXPLOITATION_ECHELLE_ET_RESTAURATION_PA10.md)
  (5 000 abonnés, 10 000 réactions) sur une cible **jetable**.

### 4.4 Tâches du protocole 10 §1 et surfaces

| Tâche 10 §1 | Surfaces | Mesures principales | État |
|---|---|---|---|
| 1. Comprendre un post, changer de photo, enregistrer, retrouver | S3, S1 (`/moi`) | clavier et lecteur d'écran, galerie, enregistrement | mesurable |
| 2. Défiler, ouvrir une boutique, revenir | S2, S9 | premier contenu utile, longues tâches, mémoire, médias actifs, retour à la même publication | mesurable |
| 3. Préparer sa vitrine | S8 | durée médiane (cible ≤ 5 min) | mesurable (A14 à corriger d'abord) |
| 4. Demander prix et disponibilité, appel consenti | S10, S11, S6 | latence de projection, annonces, appel dans les deux sens | partiel (liaison P08/P09 réelle requise) |
| 5. Commander avec variante et frais, expliquer le paiement | S12 | contention du dernier stock, délais de paiement sandbox | stock : mesurable ; paiement : **bloqué** sans adaptateur |
| 6. Réserver ou demander un devis | P14 | — | **après P14** |
| 7. Publier une offre d'emploi, candidater | S13 | parcours clavier et lecteur d'écran, dépôt de pièce (A19) | mesurable |
| 8. Trouver annulation, blocage, signalement | S3, S11, S12 | atteignabilité clavier | **bloqué par A01** jusqu'à sa correction |

### 4.5 Mesures, définitions et objectifs

Les cibles de 10 §4 sont des **objectifs à mesurer**, pas des résultats. Là où 10 §4 n'en donne pas,
le relevé est brut et le seuil se fixe avec le propriétaire.

| Mesure | Définition opérationnelle | Outil | Objectif (10 §4) | Part |
|---|---|---|---|---|
| Premier contenu utile | De la navigation à la première carte affichée (`[data-feed-anchor]` ou `[data-fil-slot="post"]`) avec auteur et texte, ou image décodée ; au moins 20 ouvertures à froid par couple appareil/réseau ; LCP relevé à part | Playwright + CDP (`Network.emulateNetworkConditions`, `Emulation.setCPUThrottlingRate` 4), `PerformanceObserver` ; Lighthouse sur les pages publiques | ≤ 3 s p75, ≤ 5 s p95 | client, réseau ; segments du §3.1 séparés |
| Temps serveur du fil | Durée d'exécution de `myFeed` (froid et chaud) | journaux de fonctions du déploiement jetable ; `scripts/pa10-evidence.mjs load` pour R8 | p95 < 1 500 ms (R8, docs/20) | backend |
| Longues tâches | Tâches de plus de 50 ms et de plus de 200 ms pendant 30 changements de publication | `PerformanceObserver('longtask')` + trace DevTools sur l'appareil | aucune > 200 ms liée au changement ; 60 i/s visé | client |
| Mémoire | Tas JS (`Performance.getMetrics` : `JSHeapUsedSize`) et nombre de nœuds, après ramasse-miettes, à 30 puis 100 publications, en liste et en immersion | CDP `HeapProfiler.collectGarbage` + `Performance.getMetrics` | pas de cible chiffrée : relever, comparer avant/après F05 et F06 | client |
| Médias actifs et téléchargés | Échantillon toutes les 250 ms du nombre de `<video>` en lecture ; octets par publication (active, voisine, lointaine) | `page.evaluate`, `page.on('requestfinished')` + `request.sizes()` | 0 son simultané ; voisine en métadonnées seulement ; lointaine 0 octet vidéo | client, réseau |
| Données consommées | Octets transférés pour « ouvrir le fil et parcourir 30 publications », avec et sans `Save-Data` | CDP `Network.loadingFinished.encodedDataLength` | pas de cible chiffrée : relever, comparer avant/après F04 | réseau |
| Lectures et écritures Convex | Par fonction (`myFeed`, `catalog.list`, `catalog.postOffer`, `presence.forMyConnections`) : exécutions par minute à l'arrêt, documents et octets lus par exécution, si la version les expose | journaux et usage du tableau de bord du déploiement jetable ; à défaut, compteur temporaire de dev | pas de cible chiffrée | backend |
| Latence de projection | `commerceCatalogHeads.receivedAt − changedAt` (fait métier → réception ANTSIA) et `federationCommerceProbes.receivedAt − sentAt` (transport seul) | requêtes de lecture sur la cible jetable | p95 < 60 s en fonctionnement normal ; panne mesurée à part | fournisseur (PRO.GA), transport, backend |
| Contention du dernier stock | Deux acheteurs, une unité, `checkoutActions.prepare` simultanés, 20 répétitions | deux contextes Playwright + journaux PRO.GA | 0 commande ou débit supplémentaire ; un seul hold | backend (ANTSIA), fournisseur (PRO.GA) |
| Délais de paiement sandbox | `shopPaymentAttempts` : `createdAt` → `issuedAt` → `dispatchedAt` → redirection prestataire (horodatage client) → retour → observation `succeeded` (`observedAt`) | tableau de bord prestataire sandbox + cible jetable | pas de cible : relever ; 0 débit dupliqué | fournisseur, backend, client |
| Accessibilité | axe par route et par état, clavier, VoiceOver, TalkBack, NVDA, contrastes rendus (DevTools), zoom 200 %, 320 px | `@axe-core/playwright` (si ajouté), recette manuelle | WCAG 2.2 AA ; aucun blocage des parcours essentiels | — |
| Couverture du fil (200 sources) | Campagne R8, nouveaux abonnements, retrait pendant le fan-out ; affichage « Fil incomplet » ou « Fil en préparation » tant que la couverture n'est pas prouvée | docs/20 §R8, `scripts/pa10-evidence.mjs load` | critères R8 ; ne jamais présenter le fil comme exhaustif | backend |

### 4.6 Commandes exactes (à lancer plus tard, après levée du gel)

Depuis la racine ANTSIA, sauf mention :

```bash
# 0. Inventaire et ressources (lecture)
git rev-parse HEAD; git status --porcelain | shasum -a 256
df -h /System/Volumes/Data

# 1. Génération (lanceur officiel, Node supporté)
bun run codegen

# 2. Tests ciblés du moteur (P14 exclu : modules/shops/services.test.ts)
bunx vitest run --config convex/vitest.config.ts modules/posts modules/calls modules/notifications modules/messaging modules/commercialMessaging
bunx vitest run --config convex/vitest.config.ts modules/shops/shops modules/shops/catalog modules/shops/checkout modules/shops/checkoutClient modules/shops/paymentClient modules/shops/paymentFlow modules/shops/paymentPolicy modules/shops/purchase modules/shops/jobs modules/shops/jobApplications modules/shops/commerceLinks

# 3. Tests ciblés des paquets et de l'application
(cd packages/social-features && bunx vitest run src/features/feed-immersion src/features/media-playback src/features/reseau-personnel src/features/messagerie src/features/iappel src/features/notifications src/shell)
(cd packages/ui && bunx vitest run)
(cd apps/antsia_ga && bunx vitest run src)

# 4. Cliquets
bunx vitest run --config tests/vitest.config.ts tests/ratchets

# 5. Vérification commune, puis build sans publication
bun run verify
bun run build:antsia

# 6. PRO.GA (ses propres scripts)
(cd ../PRO_GA && bun run verify)
(cd ../PRO_GA && bunx vitest run --config convex/vitest.config.ts modules/integrations/commerceCheckout modules/inventory)

# 7. Serveurs (un seul de chaque), puis mesures
bun run dev:convex    # backend local jetable
bun run dev:antsia    # http://localhost:3030 (ou build puis start pour les budgets)

# 8. Mesures, si les outils sont ajoutés (§4.1, point 3)
(cd apps/antsia_ga && bunx playwright test e2e/p18b-a11y.spec.ts e2e/p18b-perf.spec.ts)
bunx lighthouse http://localhost:3030/publications/<id> --only-categories=performance,accessibility --form-factor=mobile --throttling-method=simulate --output=json --output-path="$TMPDIR/antsia-p18b/lh-publication.json"
node scripts/pa10-evidence.mjs load <releve-r8.json>
```

Les deux suites Playwright (`p18b-a11y`, `p18b-perf`) sont **à écrire** en P18b. Comptes et données de
test viennent des graines locales (§4.3) ; aucune donnée réelle, aucune sortie hors du dossier
temporaire. Les budgets se mesurent sur un build (`start`), jamais sur `next dev`.

### 4.7 Résultats et acceptation

- Relevé brut par mesure : appareil, navigateur, réseau, SHA, empreinte d'inventaire, fixture, nombre
  d'échantillons, p50, p75, p95, extrêmes. Mesures avant et après chaque correction, sur les mêmes
  fixtures.
- Acceptation P18 (prompt) : aucun blocage des parcours retenus ; budgets et couverture réellement
  mesurés ; limitations explicites avant pilote. Un écart à 10 §4 est rapporté tel quel, avec son
  propriétaire, jamais arrondi.

## 5. Verdict et corrections prioritaires

### 5.1 Verdict

**Audit statique documentaire ; aucune mesure, aucun test, aucune recette.** Aucun résultat de
performance ou d'accessibilité n'est affirmé. Les constats décrivent le code lu le 18–19/10 sur une
source non compilée depuis P03. Ils ne valident ni n'invalident les lots P01–P15, dont la recette reste
ouverte. Deux bloquants empêchent, en l'état du code, de prétendre qu'aucun parcours essentiel n'est
bloqué au clavier ou au lecteur d'écran.

### 5.2 Répartition par lot

| Lot | Bloquants | Majeurs | Mineurs |
|---|---|---|---|
| Transverse (P18b) | 0 | 2 (A07, F01) | 2 (A20, A21) |
| P01 | 0 | 0 | 3 (A36, A37, F14) |
| P02 | 0 | 1 (A13) | 3 (A31, A32, A44) |
| P03 | 1 (A01) | 8 (A03, A06, A08, A09, A10, A11, F03, F04) | 5 (A22, A30, A35, A43, F10) |
| P04 | 0 | 3 (A12, F05, F06) | 4 (A23, A24, A42, F07) |
| P05 | 1 (A02) | 3 (A04, A05, F02) | 7 (A25–A29, A33, F08) |
| P07 | 0 | 1 (A14) | 2 (A34, F11) |
| P09 | 0 | 0 | 3 (A38, A45, F09) |
| P10 | 0 | 1 (A15) | 1 (F12) |
| P11 | 0 | 2 (A16, A17) | 1 (F13) |
| P12 | 0 | 1 (A18) | 0 |
| P15 | 0 | 1 (A19) | 3 (A39, A40, A41) |
| **Total** | **2** | **23** | **34** |

Un constat partagé est compté une fois, sous son premier lot.

### 5.3 Corrections prioritaires (lot P18b, après P14 et P16)

1. **A01** : menu « ⋯ » atteignable au clavier, focus géré (P03). Bloquant.
2. **A02** : bulle de message lisible, pièces et vocaux hors du bouton (P05). Bloquant.
3. **A03, A07** : dialogue de signalement modal ; retours en toast audibles pendant les modales (P03,
   transverse).
4. **A04, A05** : messages et appels entrants annoncés ; carte d'appel modale au téléphone (P05).
5. **A19** : formulaire de pièce sorti de la candidature, avec test (P15). Défaut fonctionnel.
6. **A16, A17** : jetons d'adresse ; avertissement ou prolongation des échéances de réserve et de
   paiement (P11, P12).
7. **A09, A10, A11** : liens publics soulignés, état « J'aime » non chromatique, palette au seul geste
   explicite (P03).
8. **A12, A13, A14, A15** : province par formulaire, `scroll-padding`, focus d'étape de l'éditeur,
   style `.msg-tool-btn` (P02, P04, P07, P10).
9. **A06, A18, A08** : commentaires non vivants, états de paiement annoncés, décision de contrat des
   sous-titres (P03, P12).
10. **F02, F03, F04, F05** : LiveKit différé, point d'entrée de l'îlot public, ré-encodage des images,
    pages vivantes plafonnées, chacun mesuré avant et après sur les fixtures du §4.3 (P05, P03, P04).

### 5.4 Prérequis de mesure

P14 audité, P16 pour la version commerciale, source gelée ; levée du gel par le propriétaire ; outils
de mesure décidés au catalogue ; fixtures du §4.3 écrites ; appareils physiques et lecteurs d'écran ;
liaison PRO.GA locale active (P08, P09) ; adaptateur de paiement sandbox (P12), sans lequel les délais
de paiement restent hors mesure.

## Annexe A — Fichiers lus

- Application : `apps/antsia_ga/src/lib/routes.ts`, `app/layout.tsx`, `app/globals.css`,
  `app/(membre)/layout.tsx` et inventaire de `app/**`, `components/{network-shell,providers,member-chrome,use-session-state}.tsx`,
  `components/shared/controls.tsx`, `components/feed/feed-screen.tsx`,
  `components/discovery/{discover-screen,member-feed}.tsx`, `components/messages/messages-screen.tsx`,
  `components/notification-open-screen.tsx`, `components/public/{public-post-card,public-post-media,public-shell,public-feed,public-status,public-actions}.tsx`,
  `components/shops/*` (hors tests), `components/checkout/*`, `components/payment/{payment-checkout-panel,payment-status-card,payment-screen}.tsx`,
  `components/cart/{cart-screen,offer-cart-actions,use-cart-draft}.tsx`,
  `components/purchases/{purchases-screen,purchase-card}.tsx`, `components/jobs/*` (hors tests).
- Moteur front : `shell/mobile/{ReseauMobileTabBar,ReseauMobileCreateButton}.tsx`,
  `shell/reseau-menu-destinations-ui.tsx`, `shell/floating-card/EspaceFloatingCard.tsx`,
  `shell/appearance/provider.tsx`, `shell/communication-shell.tsx` et `communication/global-call-surface-host.tsx`
  (imports, appel entrant), `features/feed-immersion/{ImmersiveFeedReader,immersive-styles,FeedModeToggle}.tsx`,
  `features/media-playback/{CoordinatedVideoControls,use-coordinated-video,MediaPlaybackProvider}.tsx`,
  `media-playback-policy.ts`, `features/reseau-personnel/{FeedPages,PostCard (l. 280-740),PostCardCaption,PostMediaPresentation,PostReactionControl,PostOverflowMenu,CommentsSurface (l. 128-400),ReportContentDialog,RichText}.tsx`,
  `reseau-feed-pages.ts`, `features/messagerie/{MessagesRoute,IcomMessagesPage,CommercialConversationView,NewMessagesPill}.tsx`,
  extraits de `MessagerieConversationView.tsx`, `MessageBubble.tsx`, `MessageComposer.tsx`,
  `messagerie-styles.tsx`, `features/iappel/{IncomingCallBanner,CallSurface,CallControlButton,presence-dot}.tsx`,
  extraits de `CallStage.tsx`, `features/notifications/{NotificationBell,NotificationsList}.tsx`.
- `packages/ui` : `hooks/use-modal-a11y.ts`, `overlay/{ImmersiveOverlay,useIsReseauMobile}.tsx`,
  `sheet/{sheet,sheet-button}.tsx`, `components/skeleton.tsx`, `styles/theme.css` (l. 90-150),
  jetons d'immersion de `styles/communication.css`.
- Moteur Convex : `posts/posts.ts` (`myFeed`, limites), `calls/presence.ts`, `shops/catalog.ts`,
  `shops/catalogRead.ts` (pagination), tables des catalogues, paiements et préparations.
- Configuration : `package.json` (scripts, catalogue), `packages/social-features/package.json`,
  `packages/api/next-config.mjs`, `apps/admin_antsia_ga/src/components/console-job-policy.tsx`,
  `scripts/pa10-evidence.mjs` (en-tête), `PRO_GA/package.json` (scripts).

## Annexe B — À auditer après P14 (non lus pour ce lot)

L'agent P14 écrit encore dans ces fichiers :

- ANTSIA : `convex/modules/shops/service*.ts`, `shops/services.ts`, `shops/serviceTables.ts`,
  `shops/services.test.ts` ; `apps/antsia_ga/src/components/services/*` ; pages
  `app/(membre)/boutique/[handle]/{devis,rendez-vous,prestation}/[offerRef]/page.tsx`,
  `app/(membre)/mes-demandes/**` ; locales `services.json` ; raccords
  `catalog-member-screen.tsx:17,57` (actions de service) et `discover-screen.tsx:13,105-108,163`
  (rubrique Services de Découvrir).
- PRO.GA : `convex/modules/integrations/commerceService*.ts`, adaptations `quotes`, `agenda` et
  `orders`.
- Tâche 6 de 10 §1 (réserver, demander un devis) et cas « Service » de 10 §2.

## Correctifs P18b

19 octobre 2026, agent « corrections » sous coordination, sur la source lue au §0 (même branche,
`HEAD` `9eaff40`, arbre partagé). **Décision du propriétaire (18/10/2026) : « Continuer sans
vérifier ».** Corrections faites dans les sources servies ; **tests écrits, non exécutés** partout.
Aucun codegen, test, typage, lint, build, serveur, navigateur, commande Convex ni installation.
Opérations lancées : lectures (`git status`/`diff`, `stat`, `grep`), éditions ancrées, un
remplacement mécanique dans deux fichiers (trois espaces insécables brutes devenues la constante
`REPEAT_MARK`) et une lecture `json.load` des 14 fichiers de locale touchés (forme et parité FR/EN
des clés ajoutées).
Verdicts séparés (10 §7) : documenté — oui ; présent dans le code — oui ; testé automatiquement —
non (tests écrits seulement) ; observé en recette — non ; publié — non.

Périmètre tenu : fichiers d'interface seulement (`packages/social-features/**`,
`apps/antsia_ga/src/**`, un jeton ajouté dans `packages/ui/src/{styles,themes}`). Aucun fichier
`convex/**`, `_generated`, `.env*`, `package.json`, `bun.lock`, primitive `packages/ui/src/components/**`
ou `sheet/**`, hook `packages/ui/src/hooks/**`, ni fichier du pont de session. Aucun fichier touché
n'avait été modifié par P16 dans l'heure (P16 écrit dans `convex/**` et la console). Écart à la
consigne : `apps/antsia_ga/src/components/checkout/use-checkout-clock.ts` (19 lignes, inchangé depuis
18/10 19:05) a été réécrit en entier au lieu d'une édition ancrée ; contenu d'origine conservé à
l'identique, plus l'ajout décrit ci-dessous.

**Parité DIASPORALE.** Les changements visibles passent par les capacités existantes de
`packages/api/src/network.tsx` : `postPresentation === "media"` (ANTSIA) pour le menu « ⋯ » qui suit
son bouton et l'icône pleine des réactions ; le bouton explicite `choiceButton`, que seule la
présentation « media » pose, pour la palette explicite. Ne changent pour tous les consommateurs que des
comportements sans pixel au repos : focus, noms et rôles, régions `sr-only`, Échap, et deux défauts
corrigés (un clic sur un lecteur, un lien ou une citation n'ouvre plus la feuille d'actions d'une
bulle ; au téléphone, la carte d'appel entrant n'est plus inerte sous une modale ni cachée sous
l'écran de fin).

### Fichier par fichier

| Constat | Fichier | Correction | Test écrit (non exécuté) | Reste ouvert |
|---|---|---|---|---|
| A01 | `packages/social-features/src/features/reseau-personnel/PostOverflowMenu.tsx` | Focus porté dans le menu à l'ouverture (première entrée ; dernière par Flèche haut sur le bouton) ; tabindex itinérant, flèches, Début, Fin ; Échap (propagation arrêtée) et Tab ferment en rendant le focus au bouton, Tab repartant de lui ; `aria-controls` ; défilement du menu lui-même ignoré ; en « media », le menu se replace contre son bouton tant qu'il est visible (repositionnement aussi au redimensionnement) et ne se ferme qu'une fois le bouton sorti de la fenêtre ; ailleurs, fermeture au défilement comme avant, focus rendu au bouton sans défilement inverse. | `PostOverflowMenu.test.tsx` : ouverture et parcours, Flèche haut → « Signaler », Tab, Échap sans propagation, défilement en « classic » et en « media ». | Recette clavier, VoiceOver, NVDA, TalkBack ; cible de 34 px (A25). |
| A02 | `features/messagerie/MessageBubble.tsx`, `messagerie-styles.tsx`, `MessageActionsSheet.tsx` (commentaire) | La bulle n'est plus un `<button>` : bloc lisible précédé de son auteur en `sr-only` (« Message de X : » / « Votre message : »), corps intégral ; citation, image, vidéo, vocal et fichier restent leurs propres contrôles ; bouton d'actions distinct (`.msg-actions-btn`, « Actions sur le message de X »), invisible au repos et révélé au focus clavier à côté de la bulle ; clic, appui long et menu contextuel conservés sur la bulle, sauf sur ses contrôles ; nom d'expéditeur visible des groupes `aria-hidden` (dit par chaque bulle). Locales `messageBubble.{actionsFrom,actionsMine,speaker,speakerMine}`. | `MessageBubble.test.tsx` : aucun contrôle dans un bouton, corps entier, contrôles atteignables sans ouvrir la feuille, bouton d'actions nommé, message à soi, groupe. | Texte alternatif des images (A29) ; cibles (A25) ; recette lecteurs d'écran et clavier ; débordement du bouton révélé à 320 px à vérifier. |
| A03, A30 | `features/reseau-personnel/ReportContentDialog.tsx` | `useModalA11y` (focus initial sur le motif, piège, inertage, restitution au déclencheur ; Échap ignoré pendant la transmission) ; dialogue nommé et décrit par `aria-labelledby`/`aria-describedby` ; double envoi verrouillé ; refus redit dans une région `role="alert"` persistante `sr-only` ; précision nommée par son libellé visible (A30). Rendu inchangé. | `ReportContentDialog.test.tsx` : focus, inertage, Échap, restitution, A30, refus redit, Échap et double envoi pendant la transmission, succès. | Formulaire en RHF + Zod (convention) non fait : comportement conservé ; recette. |
| A07 | `apps/antsia_ga/src/components/toast-region.tsx` (nouveau), `providers.tsx` | La région de sonner vit dans son propre hôte, enfant direct de `<body>`, exempté de l'inertage : un `inert` posé par une modale est aussitôt levé (`MutationObserver`). Le reste de la page reste inerte. | `toast-region.test.tsx` : hôte enfant de `<body>`, modale réelle (`useModalA11y`) qui rend la page inerte mais pas la région, retrait de l'hôte. | DIASPORALE (fournisseur hors périmètre) garde l'ancien comportement ; solution partagée possible dans `use-modal-a11y.ts` (périmètre `packages/ui/src/hooks`, à arbitrer). À confirmer en recette : certains lecteurs d'écran ignorent une région hors d'un dialogue `aria-modal` — d'où les alertes redites dans le signalement et les commentaires. |
| A04 | `features/messagerie/conversation-arrivals.ts` (nouveau), `MessagerieConversationView.tsx`, locales `messagerieConversationView.arrival*` | Région polie persistante des arrivées : « Nouveau message de X : … » (corps borné à 280 caractères) quand le fil suit le bas, sinon le décompte de la pastille ; jamais l'ouverture, l'historique chargé, mes messages, les lignes système ou les retraits ; fil exposé en `role="region"` nommé par le titre. | `conversation-arrivals.test.ts` : huit cas (ouverture, arrivée FR/EN, historique, exclusions, lecture plus haut, arrivées multiples et pièce, fil vide, masqué et coupe). | Annonces de la pastille seule (A04 2ᵉ partie) couvertes par le décompte ; recette NVDA/VoiceOver ; erreur d'envoi encore en `role="status"` (A27). |
| A05 | `features/iappel/use-call-announcer.ts`, `IncomingCallLayer.tsx` (nouveaux), `shell/communication/global-call-surface-host.tsx`, locales `globalCallSurfaceHost.announceIncoming*` | Région polie persistante, exemptée de l'inertage, qui dit qui appelle (et le groupe), vidée à la fin de la sonnerie ; au téléphone, la carte devient une modale portalisée (`role="dialog"` nommé, focus sur « Répondre », piège, Échap sans effet, restitution du focus), y compris au-dessus de l'écran de fin. Bureau : la bannière ne vole toujours pas le focus. | `global-call-surface-host.incoming.test.tsx` : modale, focus, Échap sans refus ni rejet, annonce puis vidage, bureau sans dialogue, retrait de la région. | Recette téléphone réel (VoiceOver, TalkBack), appel pendant une modale ouverte, sonnerie et autoplay. |
| A19 | `apps/antsia_ga/src/components/jobs/job-application-form.tsx` | Le `<form>` de candidature se ferme avant `JobFilesManager` ; accord et bouton d'envoi, qui suivent visuellement, lui restent rattachés par l'attribut `form` ; la section nommée porte le titre. Plus aucun formulaire imbriqué. | `job-application-form.test.tsx` : deux formulaires distincts ; un dépôt n'appelle pas `apply` même candidature valide ; un dépôt ne déclenche pas la validation ; le bouton hors du `<form>` soumet la candidature. | A39–A41 ; recette clavier. |
| A16 | `apps/antsia_ga/src/components/checkout/checkout-form.tsx` | `CHECKOUT_ADDRESS_AUTOCOMPLETE` : `shipping country`, `shipping address-level2`, `shipping address-line1`, `shipping address-line2` ; `off` pour les instructions. Rien n'est relu du profil social. | `checkout-form.test.tsx` (cas ajouté) : jetons posés, adresse vide au départ. | Recette du remplissage navigateur. |
| A17 | `checkout/checkout-model.ts`, `use-checkout-clock.ts`, `checkout-screen.tsx`, `payment/payment-checkout-panel.tsx`, locales `checkout.expiringSoon`, `payment.expiringSoon{,Reserve}` | Avertissement deux minutes avant l'échéance (`CHECKOUT_EXPIRY_WARNING_MS`, ≥ 20 s exigées par 2.2.1) : texte visible et région polie `sr-only` ; l'horloge se réveille aussi à l'échéance moins l'avertissement. Le moteur n'offre aucune prolongation de réserve : l'écran le dit. Pour le paiement, quand l'accord expire avant la réserve, le geste existant « Recharger les conditions de paiement » est offert ; sinon, avertissement seul. | `checkout-model.test.ts`, `checkout-screen.test.tsx`, `payment-checkout-panel.test.tsx` (cas ajoutés) : bornes, annonce à deux minutes, aucune prolongation, rechargement offert ou non. | Motiver l'exception « essentielle » de la réserve dans P11/P12 ou ajouter une prolongation côté PRO.GA ; recette. |
| A09 | `apps/antsia_ga/src/components/public/public-post-card.tsx` | Mots-dièse et mentions lisent `--esp-inline-link-decoration` (souligné en ANTSIA, comme `RichText`) au lieu de `hover:underline` (`PUBLIC_INLINE_LINK_CLASS`). | `public-post-card.test.tsx` (cas ajouté). | Contraste rendu à mesurer. |
| A10, A11 | `features/reseau-personnel/PostReactionControl.tsx`, locales `postReactionControl.toggle*` | « media » : icône pleine quand réagi, `aria-pressed` conservé ; avec le bouton explicite, la palette ne s'ouvre plus au survol ni au focus ni aux flèches du déclencheur, qui n'est plus qu'une bascule (sans `aria-haspopup`, libellé sans consigne). Partout : Échap ferme la palette où que soit le focus (capturé avant les surfaces sous-jacentes), un seul arrêt de tabulation pour les quatre choix. Présentation historique inchangée. | `PostReactionControl.p18b.test.tsx` : palette explicite, tabindex itinérant, Échap sans propagation, icône pleine, survol historique. Suites P03 existantes relues : compatibles. | DIASPORALE garde l'ouverture au survol (1.4.13) faute de bouton explicite chez elle ; fond d'état 3:1 non traité ; recette. |
| A12 | `apps/antsia_ga/src/components/discovery/member-feed.tsx`, locale `discovery.provinceApply` | `ProvinceFilterForm` (RHF + Zod) : la page change à la validation « Afficher », plus à chaque `change` ; le choix suit l'adresse. | `member-feed.province.test.tsx`. | Recette clavier Windows. |
| A13 | `packages/ui/src/styles/charte.css`, `themes/antsia.css`, `apps/antsia_ga/src/app/globals.css` | Jeton de contrat `--esp-sticky-header-inset` (0 dans la base, 4 rem dans ANTSIA, hauteur du décalage du rail) ; `scroll-padding-top` par ce jeton, et sous 960 px `scroll-padding-bottom` par `--esp-reseau-tabbar-inset` + zone sûre. | `apps/antsia_ga/src/app/scroll-padding.test.ts`. | En-tête replié sur deux lignes (téléphone, texte agrandi) plus haut que 4 rem ; recette 2.4.11. |
| A14 | `apps/antsia_ga/src/components/shops/shop-editor-screen.tsx`, locale `editor.stepPosition` | Changer d'étape depuis un panneau porte le focus sur le titre du panneau ouvert ; tout changement s'annonce « Étape n sur 4 : … » par une région polie persistante ; la navigation par étapes garde son focus. | `shop-editor-steps.test.tsx`. | A34 (étapes à 320 px), F11 ; recette. |
| A15 | `features/messagerie/messagerie-styles.tsx` | `.msg-tool-btn` défini : 44 px minimum, contour `--input`, `--card`/`--card-foreground`, survol `--muted`, anneau `--ring`, désactivé lisible. | `messagerie-tool-button.test.ts`. | Contrastes rendus à mesurer. |
| A06, A07 | `features/reseau-personnel/CommentsSurface.tsx`, locale `commentsSurface.published` | `aria-live` retiré de la liste ; régions persistantes : « Commentaire publié. » (statut) et échecs de publication, retrait ou modification (alerte), redits hors du toast. | `CommentsSurface.p18b.test.tsx`. | Annonce « N nouveaux commentaires » des autres non faite ; recette. |
| A18 | `apps/antsia_ga/src/components/payment/payment-status-card.tsx`, locale `payment.stateChanged` | Région polie persistante qui annonce le nouvel état du paiement, jamais au premier rendu ; liste compacte muette. | `payment-status-card.announce.test.tsx`. | **Ouvert** pour `purchases/purchase-card.tsx` (P13) et `jobs/my-applications-screen.tsx` (P15). |
| A08 | — | Non codé, aucune piste inventée : `PostMediaDto` (`packages/social-contracts/src/media.ts`) n'a ni sous-titres ni affiche. | — | **Décision au propriétaire avant P19** : (a) champ additif `captions?: { url, lang, label }[]` (WebVTT), usage d'upload dédié sous la garde FullAV, `<track kind="captions">` dans `PostMediaPresentation`, dépôt dans le composeur, modération, export et effacement — un lot P03/backend ; ou (b) limite déclarée avant le pilote (vidéos préenregistrées avec son sans sous-titres, 1.2.2 non satisfait). |
| F03 | `features/reseau-personnel/post-media-entry.ts` (nouveau), `apps/antsia_ga/src/components/public/public-post-media.tsx` | L'îlot client importe `PostMedia` par un point d'entrée étroit (`@antsia/social-features/features/reseau-personnel/post-media-entry`, relais `.ts` permis par `"./*": "./src/*.ts"`), plus le barillet `reseau-personnel`. | `public-post-media.entry.test.ts` (garde d'import). | Gain à mesurer au build (JS de `/publications/[id]`) ; `sideEffects` non déclaré (`package.json` interdit). |
| F02 | — | Documenté seulement : `CallRoomPool` est monté en permanence par l'hôte unique et `room-options` porte les réglages LiveKit ; le différer impose de ne monter le pool qu'en présence de slots, sous `Suspense`, ce qui touche les invariants P05 (hôte monté une fois, purge au démontage, StrictMode). | — | Plan : `next/dynamic`/`React.lazy` des modules de salle à la première sonnerie ou au premier appel, hôte léger inchangé ; mesurer le JS des pages membres avant/après ; recette d'appel complète. |
| F04 | — | Documenté seulement (pipeline média). | — | Ré-encodage des photos de publication sur le plan d'`AlbumComposer`, `srcset`/`sizes`, `eager` + `fetchpriority="high"` pour la première image et la bannière, dérivés serveur à décider (P03, P07, P09 et backend). |
| F05 | — | Documenté seulement : la chaîne de pages de `FeedPages.tsx` (`onTail`, `onBoundaryShift`) suppose un `nextCursor` vivant par page ; figer les anciennes pages change les invariants P04/PA10 (curseurs stables, rattrapage, frontières). | — | Plan à concevoir avec P04/PA10 : garder vivantes les K dernières pages (K = 3, la profondeur de l'immersion), figer les plus anciennes sur un instantané (`skip`) sans recalcul de frontière, ou une requête paginée unique ; mesurer exécutions et lectures `myFeed` par minute. |

### Tests écrits (aucun exécuté)

Nouveaux : `PostOverflowMenu.test.tsx`, `MessageBubble.test.tsx`, `ReportContentDialog.test.tsx`,
`PostReactionControl.p18b.test.tsx`, `CommentsSurface.p18b.test.tsx`, `conversation-arrivals.test.ts`,
`messagerie-tool-button.test.ts`, `global-call-surface-host.incoming.test.tsx` (paquet
`social-features`) ; `toast-region.test.tsx`, `job-application-form.test.tsx`,
`member-feed.province.test.tsx`, `shop-editor-steps.test.tsx`, `payment-status-card.announce.test.tsx`,
`public-post-media.entry.test.ts`, `app/scroll-padding.test.ts` (application). Cas ajoutés :
`checkout-form.test.tsx`, `checkout-model.test.ts`, `checkout-screen.test.tsx`,
`payment-checkout-panel.test.tsx`, `public-post-card.test.tsx`. Les tests de l'application montent
par `react-dom/client` (`@testing-library/react` n'est pas déclaré par `apps/antsia_ga`).

### Restent ouverts après P18b

Toute la recette et toutes les mesures du §4 ; les constats non listés au lot (A20–A45 hors A30,
F01, F06–F14) ; A18 pour les achats et candidatures ; A08 (décision) ; F02, F04, F05 (plans
ci-dessus) ; côté DIASPORALE, la région des toasts sous modale (A07) et la palette au survol (A11),
dont la correction visible relève de sa session ; contrôle rendu des contrastes et des cibles.
Le bloquant A01 et le bloquant A02 sont corrigés dans le code, **non prouvés** tant que les tests et
la recette clavier/lecteur d'écran n'ont pas tourné.
