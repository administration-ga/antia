# Audit du source ANTSIA — refonte sociale et commerce

Date : 18 octobre 2026. Étude uniquement ; aucune implémentation, aucun serveur, test ou navigateur lancé, aucun environnement lu ou modifié, aucune publication.

Périmètre : dépôt ANTSIA, arbre partagé sur `codex/pa4-identite-session`, HEAD local observé `71091b828ce2b9d5007caa6373ac2bffbad43164`. Des modifications préexistantes touchent notamment l’entrée, le pont de session et les thèmes ; les constats portent sur les fichiers présents, pas uniquement sur ce commit. Les numéros de ligne sont ceux lus pendant l’audit et devront être revalidés avant exécution.

Les références ont été consultées dans l’ordre du `CLAUDE.md` local : cahier ANTSIA, plan PA0–PA10 et état d’exécution, plan transverse du 14/10 et annexes A/B, cahier DIASPORALE, ADR du moteur. Aucun `AGENTS.md` local n’était présent ; les consignes globales fournies et `CLAUDE.md` s’appliquent. Les annexes du socle sont une carte historique de duplication ; les constats ci-dessous viennent du source ANTSIA actuel. Tous les chemins sont relatifs à ANTSIA.

## 1. Résultat déterminant

Le moteur possède déjà les publications, médias, réactions, commentaires, pages, messagerie, appels et thèmes. Une refonte visuelle peut réutiliser cette base. En revanche, le commerce relié à PRO.GA n’est pas une simple déclinaison du composant de page : il manque le domaine commercial et le contrat d’échange effectif. Trois règles actuelles contredisent directement une boutique accessible et joignable par tous :

1. Créer une page exige `verifiee`, puis crée une page de confiance `community` : `convex/modules/pages/pages.ts:128` et `:158`. Le refus d’un membre seulement déclaré est explicitement couvert dans le source du test `convex/modules/pages/pages.test.ts:149` ; ce test n’a pas été exécuté pendant l’audit.
2. La projection anonyme ne publie que les pages `official`, y compris pour admettre leurs publications : `convex/modules/public/access.ts:55` et `:67`. Une page `company/community` ou `company/verified` n’est donc pas une vitrine anonyme existante.
3. Un nouveau fil personnel exige une relation acceptée entre les deux personnes dans ce réseau ; appartenir au même groupe ne suffit pas : `convex/modules/messaging/inbox.ts:33`. Un bouton « Contacter le vendeur » ne peut pas simplement ouvrir un fil avec un inconnu en contournant cette garde.

## 2. Routes et composants branchés

| Surface | Source réelle | Conséquence pour la refonte |
|---|---|---|
| Entrée, profil, fil, messages, pages, découverte | `apps/antsia_ga/src/lib/routes.ts:12` ; adaptateur du moteur `:76` | Ajouter les futures adresses dans cette table, puis dans le contrat de routes si consommées par le paquet. Aucune route boutique/catalogue/produit/service/emploi n’est présente dans cette table. |
| Fil personnel | `apps/antsia_ga/src/components/feed/feed-screen.tsx:21` → `ReseauAgentPage` | Le fil principal et le fil National/province sont deux branches de présentation ; ne pas refondre uniquement la première. |
| National/province/tag | `apps/antsia_ga/src/components/discovery/member-feed.tsx` ; routes `apps/antsia_ga/src/lib/routes.ts:26` | Préserver les filtres et les liens profonds lors de l’ajout d’un mode immersif. |
| Cartes connectées | `packages/social-features/src/features/reseau-personnel/PostCard.tsx:412` | Texte riche, médias, direct/évènement, réactions, commentaires, partage, menus et badges existent. Préserver leurs droits et leurs états de retenue. |
| Cartes publiques SSR | `apps/antsia_ga/src/components/public/public-post-card.tsx:28` et `:42` | Autre implémentation : les médias sont empilés ; elle n’utilise pas le carrousel de `PostMedia`. La parité visuelle doit couvrir les deux surfaces sans monter une fausse session membre côté public. |
| Pages connectées | `/page/[handle]`, `packages/social-features/src/features/reseau-personnel/ProfilPagePage.tsx:318`, `packages/social-features/src/features/reseau-personnel/PagesPanel.tsx:492` | Identité, mur, suivi, création, revendication, signataires et direct de page réutilisables. `/pages/[handle]` est la porte publique officielle distincte. |
| Messages | `/messages/[[...chemin]]`, `packages/social-features/src/features/messagerie/MessagesRoute.tsx:47` | Pleines pages sur téléphone ; sur ordinateur, aiguillage vers le téléphone iCom détaché (`:78`), pas une messagerie à grande largeur. |
| Coque de communication | `apps/antsia_ga/src/components/network-shell.tsx:36`, `packages/social-features/src/shell/communication-shell.tsx:25` | `NetworkProvider`, présence, hôte d’appels et hôte de direct montés à une position stable. Une refonte de navigation ne doit pas les remonter à chaque route ou changement d’apparence. |

Le code du moteur dans `packages/social-features` sert aussi DIASPORALE. Changer ses composants ou contrats a donc une portée inter-applications ; le thème ANTSIA reste dans son propre fichier. Le catalogue/workspaces confirme le partage (`package.json:11`).

## 3. Cartes, médias et défilement

### Base existante

- `packages/social-features/src/features/reseau-personnel/PostMedia.tsx:56` impose un cadre **16:10** pour un média seul ; la vidéo utilise `objectFit: contain`, commandes natives, `preload="metadata"`, et ne démarre pas automatiquement (`:110`). Cette décision héritée devra être explicitement remplacée ou rendue contextuelle pour du portrait immersif.
- À partir de deux images, `packages/social-features/src/features/reseau-personnel/PostMedia.tsx:140` monte un carrousel horizontal ; index actif, flèches, points, clavier et visionneuse sont dans `:169` et suivantes. Ce socle permet des cartes inspirées d’Instagram, mais le ratio et la hiérarchie actuels ne constituent pas cette refonte.
- Le domaine impose **2 000 caractères**, **4 images ou 1 vidéo seule**, images ≤ **20 Mio**, vidéo ≤ **100 Mio** : `packages/social-domain/src/content.ts:24`, `:87`, `:123`. Le contrat `PostMediaDto` expose URL, retenue, nature, dimensions, durée et texte alternatif, sans identifiant de stockage (`packages/social-contracts/src/media.ts:12`).
- Fraîcheur et admission du dépôt passent par `verifyDeclaredMedia` (`convex/modules/media/media.ts:113`) ; les URL passent par la garde fermée `servableUrl` (`convex/modules/files/storageGuard.ts:58`). Les fichiers retenus gardent une place et une raison visible. Un aperçu local ou un upload achevé ne prouve pas qu’un lecteur peut recevoir le média.

### Écart avec le défilement TikTok demandé

`packages/social-features/src/shell/mobile/VerticalPager.tsx` existe : geste vertical, clavier, réduction des animations et fenêtre de trois éléments au maximum (`:35`, `:147`, `:162`). Son montage trouvé est **le lecteur de stories**, `packages/social-features/src/features/stories/StoriesViewerPage.tsx:273`. Le fil de publications ne l’utilise pas.

Le fil mobile monte une chaîne de `FeedPage`, puis un bouton « Voir plus » (`packages/social-features/src/shell/mobile/ReseauMobileFeed.tsx:245`, `:276`). Le bureau fait de même (`packages/social-features/src/shell/ReseauAgentPage.tsx:865`) ; ses colonnes défilent séparément (`:138`), alors que le téléphone laisse défiler le document (`apps/antsia_ga/src/components/feed/feed-screen.tsx:12`). Il n’y a donc pas de fil vertical immersif de publications déjà branché.

L’adaptation doit traiter ensemble : hauteur disponible/safe areas, arbitrage geste horizontal du carrousel contre geste vertical, clavier et focus, contenu long, commentaires/menus, élément vidéo actif unique, pause hors écran et lors d’un appel, chargement borné des pages, retour au même post après navigation. Le pager ne fournit pas à lui seul ces règles ni le chargement infini.

### Limite d’échelle

`FeedPage` s’abonne à `posts.posts.myFeed` et annonce les fenêtres lacunaires (`packages/social-features/src/features/reseau-personnel/FeedPages.tsx:85`, `:144`). Le backend compose les sources à la lecture (`convex/modules/posts/posts.ts:860`) ; le domaine borne les auteurs à **200**, explicitement non exhaustifs au-delà (`packages/social-domain/src/feedScale.ts:19`). Le fil matérialisé est encore un lot PA10 dans le plan ; aucun module de ce nom n’est agrégé dans le schéma inspecté (`convex/schema.ts:44`). Un défilement plus automatique exige des budgets de lecture et de mémoire, pas seulement la suppression du bouton.

## 4. Clair/sombre et design partagé

Le choix **système / clair / sombre** existe : `packages/social-features/src/shell/appearance/provider.tsx:6`, stockage préfixé (`:42`), synchronisation du système et bascule `.dark`/`color-scheme` (`:77`). Il est réellement monté dans `apps/antsia_ga/src/components/providers.tsx:67`.

Le contrat commun est `packages/ui/src/styles/charte.css` : surfaces (`:264`), rayons (`:381`), polices (`:432`), sombre (`:571`). `packages/ui/src/themes/antsia.css:11` définit actuellement **fond blanc, cartes beige/parchemin**, primaire bleu et polices Inter/Familjen. Cette préférence est aussi documentée dans la recette locale du 18/10. Les couleurs restent confinées aux styles/thèmes, les nouveaux jetons doivent être déclarés dans le contrat avant surcharge, et le sombre des portails doit être conservé.

Les cartes du réseau portent aussi des règles locales : rayon de surface 18 px et cadence 16 px (`packages/social-features/src/shell/ReseauAgentPage.tsx:126`). Une simple modification de palette ne change donc ni la grille héritée ni la densité. Prévoir une passe coordonnée sur cartes, navigation et médias ; conserver les primitives du paquet UI et les clés i18n français/anglais.

## 5. iCom, appels, push et natif

| Capacité constatée dans le source | Sources / limites |
|---|---|
| Messagerie personnelle, groupes, pièces, vocaux, réactions, citation, transfert, épingle, lecture et saisie | `convex/modules/messaging/{inbox,messages,reactions,forward,pins,typing}.ts`, `packages/social-features/src/features/messagerie/{MessagerieConversationView,MessageComposer,VoiceRecorderButton}.tsx`. Gardes du fil et du blocage : `convex/modules/messaging/participation.ts:33`. |
| Bornes actuelles | **256 membres** par groupe, **11 participants** par appel (`packages/social-contracts/src/groupCapacity.ts:21`, `:34`) ; 5 pièces × 25 Mio et plafond contractuel vocal 5 min (`packages/social-contracts/src/attachments.ts:19`, `:28`, `packages/social-domain/src/uploadPolicy.ts:72`) ; texte 4 000 caractères, édition/retrait 15 min (`packages/social-contracts/src/messaging.ts:12`). Les anciens chiffres 1 000 membres et vocal 2 min des annexes du socle ne décrivent pas ce contrat moteur. |
| Appel audio/vidéo entre membres | `convex/modules/calls/direct.ts:25` : refus de soi-même, blocages, admission selon disponibilité/préférences. Le verrou ancien réservé aux agents n’est plus présent dans cette porte. |
| Jeton LiveKit autorisé côté serveur | `convex/modules/calls/token.ts:16` : adhésion déclarée, appel actif, participant vivant ; `convex/modules/calls/livekitActions.ts:29` : autorisation puis configuration/réveil, jeton 2 h, identité à nonce et attribut `personId`. |
| Salle persistante et rendu audio | `packages/social-features/src/features/iappel/CallRoomMount.tsx:225`, `:253` ; connexion via `packages/social-features/src/features/iappel/use-call-slot-connector.ts:40` ; pool monté par `packages/social-features/src/shell/communication/global-call-surface-host.tsx:484`. |
| Notifications Web, Expo, FCM, APNs | Adaptateurs dans `convex/modules/notifications/transports.ts:24`, `:37`, `:61`, `:81`. Sans configuration, retour `unavailable`. `accepted`/`sent` sont des résultats techniques, aucune preuve de réception physique. |
| Push d’appel | `convex/modules/calls/push.ts:17` enfile après préférence ; ne prouve pas la sonnerie. APNs envoie actuellement `apns-push-type: alert`, pas un flux VoIP (`convex/modules/notifications/transports.ts:93`). |
| Client Web | Consentement et inscription navigateur dans `apps/antsia_ga/src/components/notification-controls.tsx:49`, `:125`. Le worker affiche un message neutre et navigue toujours vers `/mes-donnees` (`apps/antsia_ga/src/app/notifications-worker/route.ts:7`), sans commande accepter/refuser ni aiguillage vers l’appel ciblé. |
| Client natif ANTSIA | L’inventaire de `apps/` contient `antsia_ga` et `admin_antsia_ga` ; aucun projet natif ANTSIA ni intégration CallKit/PushKit trouvés dans le périmètre inspecté. Les transports serveur mobiles ne constituent pas une application mobile. |

« Inspiré de WhatsApp » peut désigner l’ergonomie de ces écrans ; cela ne prouve pas la parité des appels hors onglet, appareil verrouillé, processus arrêté, Bluetooth ou changements de réseau. Ces scénarios nécessitent un lot natif et une recette par appareil si retenus. Aucun mécanisme de chiffrement de bout en bout des messages n’a été identifié : le schéma contient corps et aperçu textuels (`convex/modules/messaging/tables.ts:46`, `:70`) lus par le serveur. Ne pas présenter une garantie de confidentialité équivalente sur la seule base du design.

## 6. Commerce et fédération PRO.GA

### Réutilisable sans reconstruire le réseau

Les pages portent une identité propre, `ownerKind`, confiance, réseau, pays, médias, règle de visibilité, signataires et revendications (`convex/modules/pages/tables.ts:20`). Leurs publications sont des `posts` ordinaires avec `pageId`, donc elles héritent des réactions, commentaires et signalements (`convex/modules/pages/pages.ts:6`). L’autorité des signataires est relue à chaque geste (`convex/modules/pages/access.ts:113`). Ces briques conviennent à la présence sociale d’une boutique.

### Manquant dans ANTSIA

Le schéma agrège les tranches sociales, sans domaine boutique/catalogue/commande/paiement (`convex/schema.ts:44`). La tranche DIASPORALE contient hubs, parrainages, attestations, imports et confidentialité (`convex/modules/diaspora/tables.ts:54`) ; elle ne fournit pas actuellement les tables emploi/annonces promises pour sa V2. Une page `company` ne possède ni catalogue structuré, prix/devise, disponibilité, prestation, offre d’emploi, candidature, ni lien métier PRO.GA dans son schéma actuel.

L’inbox HTTP est une base utile : taille bornée, signature des octets exacts, environnement, émetteur vivant, nouvelle vérification transactionnelle, contrat autorisé, digest et idempotence (`convex/modules/federation/http.ts:36`, `convex/modules/federation/inbox.ts:14`). Mais **tout nouveau message admis finit en `dead_letter / unsupported_contract`** (`convex/modules/federation/inbox.ts:38`). Le registre métier est fermé. La table `mirrors` ne cible que `pages`, `posts`, `persons` (`convex/modules/federation/tables.ts:39`). `docs/contrats/` contient `FEDERATION-INBOX-V1.md` ; aucun contrat PRO.GA exécutable n’est branché dans ce module.

Le plan de commerce devra spécifier, avant le code, les responsabilités de chaque plateforme : propriétaire de la fiche commerciale, identité du vendeur, preuve de gestion de sa structure PRO.GA, objets reflétés, références publiques stables, consentement, médias admis, changements de prix/disponibilité, retrait, expiration, rejeu, version et suppression. Les appels croisés directs aux bases ou `_generated` externes restent incompatibles avec `CLAUDE.md` et ADR-0003. Le code PRO.GA lui-même relève de l’autre audit ; ce rapport ne lui attribue aucune capacité non vérifiée.

## 7. Matrice réutiliser / étendre / créer

| Besoin | Réutiliser | Étendre | Créer dans le futur lot |
|---|---|---|---|
| Cartes Instagram | `PostCard`, `PostMedia`, badges, texte riche, commentaires, menus | Hiérarchie visuelle, ratio portrait, interactions et déclinaison SSR publique | Spécification visuelle et recette responsive/AA des cartes |
| Fil TikTok | `VerticalPager`, gestes, curseurs, droits des posts | Branchement au vrai fil, chargement borné, reprise de position, arbitrage carrousel/vertical | Coordination des vidéos actives, préchargement mesuré et mode économie de données |
| Clair/sombre | Provider et contrat de jetons existants | Jetons de la nouvelle direction, portails, contrôles et cartes publiques | Aucune seconde infrastructure de thème |
| Messages/appels | Source de messagerie, composer, vocaux, hôte/pool LiveKit | Présentation WhatsApp, navigation bureau, accessibilité et traitement des erreurs | Lot natif/appels en arrière-plan uniquement si inclus au produit |
| Boutique créée par tout membre | Pages et signataires | Politique actuelle `verifiee`, quotas, statuts, preuve commerciale distincte du badge personnel | Modèle boutique et parcours d’ouverture déclaré, sans attribuer automatiquement « Vérifié » |
| Boutique visible sans compte | Projection allowlistée et SSR | Garde actuelle réservée aux pages officielles | Projection publique commerciale dédiée et tests de confidentialité |
| Produits, services, emploi | Posts, médias, recherche, modération, contrats purs | DTO de cartes et cibles de modération/export/effacement | Entités commerciales, filtres, cycles de vie et commandes métier définis avec PRO.GA |
| Premier contact acheteur–vendeur | Messagerie et blocage | Politique d’ouverture actuelle réservée aux relations | Demande de contact liée à une offre, autorité du destinataire et prévention du spam |
| Synchronisation PRO.GA | Inbox signée, reçus, DLQ, rejeu et audit | Registre métier, mapping des reflets, retrait/idempotence | Contrat versionné et producteurs/consommateurs dans leurs dépôts respectifs |

## 8. Preuves et critères à conserver dans les prompts

**Preuve obtenue dans cet audit :** lecture du source, de son câblage, de ses tests existants et des documents ; aucune validation d’exécution nouvelle. Le document `docs/01_PLAN_IMPLEMENTATION_PROMPTS_ANTSIA.md:18` situe PA0–PA8 et laisse PA9/PA10 ouverts ; l’historique Git local comporte les commits PA8 et les recettes, sans établir un déploiement servi.

**Preuves historiques documentées, non rejouées ici :** `docs/recette/fil-mobile-2026-10-18/README.md:5` rapporte un fil ANTSIA local clair à 393×852 et 375×667 en émulation Chrome ; le document exclut publication, médias, réactions, appels et appareil physique (`:14`). `docs/14_COMPLEMENT_IDENTITE_DIASPORALE_PD4.md:500` rapporte la lecture/pause/visionneuse d’une vidéo précise de DIASPORALE ; audio, appareil physique et variantes sombre/mobile de cette vidéo restent hors preuve (`:535`), et la galerie à deux photos reste ouverte (`:538`). Cette recette DIASPORALE ne valide pas le lecteur de publications ANTSIA.

**Aucune preuve de production fournie par cet audit.** La présence de code LiveKit/push, un test existant, une recette locale, un badge ou un accusé technique ne valent pas livraison sur appareil ni échange métier PRO.GA appliqué.

Les prompts de refonte doivent exiger des résultats séparés : (1) code branché et vérifications adaptées après `bun run codegen`, (2) recette ANTSIA anonyme/membre/déclaré/vérifié/signataire/suspendu, (3) médias exacts après rechargement chez un second lecteur, (4) appel audio/vidéo et push sur appareils ciblés, (5) événement commercial appliqué puis retiré dans les deux systèmes, (6) preuve de publication seulement après autorisation explicite. Pour le commerce, étendre ensemble gardes, modération, limitation de débit, projections, inventaire d’export/effacement et rétention. Conserver l’i18n, les jetons et les restrictions inter-réseaux ; toute donnée nominative nouvelle doit suivre le normaliseur partagé prévu par les consignes globales.

Seul ce document est créé par cet audit. Les changements préexistants de l’arbre partagé sont préservés ; aucun commit n’est créé.
