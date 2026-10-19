# P09 — Catalogue canonique PRO.GA et projections ANTSIA

18 octobre 2026. Demande du propriétaire : « Continue le lot catalogue (P09) entre ANTSIA
et PRO.GA, sans relancer les vérifications. »

Références : [prompt P09](../prompts/P09_CATALOGUE.md), [P08](P08_LIAISON_TRANSPORT.md),
[contrat PUBLIC](../../../contrats/PRO-COMMERCE-PUBLIC-V1.md),
[lecture privée P09](../../../contrats/PRO-COMMERCE-CATALOG-READ-V1.md).

**État : sources raccordées dans les deux produits ; vérification et recette P09 ouvertes.**
Les scénarios sont écrits sans exécution. Aucun résultat historique de P06/P08 ne valide
P09 ; aucun événement réellement appliqué entre les produits n'est revendiqué.

## 1. Autorité et publication

PRO.GA conserve le catalogue canonique, les montants entiers XAF, les modes fixe,
intervalle, unité et devis, les variantes, le stock interne et les commandes historiques.
La publication ANTSIA est volontaire et distincte de la simple possession d'un lien.
Les variantes ont une référence métier stable, avec lecture compatible des anciennes
lignes et backfill borné et idempotent. Le snapshot commercial complet et ses variantes
partagent une révision ; il ne mélange pas un ancien prix publié avec une variante live.

Une édition explicite d'une offre publiée, d'une variante, photo ou collection crée une
révision commerciale complète ; cette séquence est distincte de la version historique
du site PRO.GA. La disponibilité a sa propre séquence et ne transporte aucun stock précis.
Les producteurs passent par la même émission transactionnelle et l'outbox P08, avec
octets/digests persistés et reçus corrélés. Les anciennes commandes ne sont pas réécrites
par le retrait d'une offre. Détails et liste des écrivains :
[passation PRO.GA P09](../../../../../PRO_GA/docs/20_CATALOGUE_ANTSIA.md).

Une destination fermée ne bloque pas l'édition métier : les derniers snapshots et leurs
indicateurs d'enfilement en attente sont conservés. La reprise indexée est sérialisée par
un état durable (curseur, bail et prochain passage), limitée à trois configurations et
deux snapshots candidats par destination ; elle ne balaie pas en boucle un catalogue
entier parce qu'une configuration est fermée. Aucune reprise n'est exécutée ici.

## 2. Réception et visibilité ANTSIA

Le handler `federation/commerceCatalog.applyCommerceCatalog` branche réellement PUBLIC
au dispatcher commun de réception/rejeu. Corps canonique avant reçu, émetteur/environnement
et mapping réseau/boutique explicites ; aucune page ni boutique créée depuis une charge.
La liaison P08, la permission `publish_catalog`, la politique réseau et le mandat local
sont relus. Les politiques nouvelles restent fermées par défaut.

Les têtes indexées gardent séquences catalogue/disponibilité, digest, révision et tombe.
Les événements anciens ne réécrivent pas un état plus récent ; un conflit de même révision
part en lettre morte. Le retrait d'un parent ferme ses enfants et leur ancienne incarnation.
Les emplois restent P15, refusés par cette tranche ; les autres contrats PA9 sont préservés.

Chaque lecture rejuge la boutique, sa page, le réseau d'origine, le lien vivant, le
consentement, la modération et la génération du mapping. Une offre n'acquiert aucun droit
d'achat par sa présence dans le catalogue. Une réception ou un rattrapage enfilé ne vaut
pas un état `applied`.

**Choix conservateur explicite :** ce premier catalogue PUBLIC exige une vitrine consentie
à la lecture publique, y compris pour son lecteur membre. Une vitrine P07 réservée au réseau
reste utilisable mais n'acquiert pas un catalogue public d'office. Un futur catalogue réservé
au réseau nécessitera une chaîne de délivrance média authentifiée distincte.

## 3. Parcours et publications

Catalogue membre et SSR public : filtre produits/services, collection et recherche,
pagination sur la fenêtre brute bornée, fiches d'offre et variantes actuellement effectives.
Les fenêtres filtrées ne prétendent pas être exhaustives. Les prix restent qualifiés,
le devis ne devient jamais un montant exact ; disponibilité indicative datée et périmée
distinctes. Aucune action d'achat, de devis ou de contact fictive.

La fraîcheur de disponibilité vient du `changedAt` du fait métier signé, jamais du seul
moment de réception ou d'une signature de transport renouvelée. Rattraper un ancien fait
inchangé le laisse périmé ; seule une observation métier actuelle peut le rendre récent.
Le seuil d'affichage est de quinze minutes, sans promesse de mesure de synchronisation.

Les vraies routes `/boutique/[handle]/catalogue`, `/boutiques/[handle]/catalogue` et les
fiches `/offres/[offerRef]` sont centralisées. Les blocs P07 rendent le catalogue réel.
L'éditeur permet de demander un rattrapage par pages et d'associer ou retirer une offre
sur une publication native de **sa** page. L'association ne conserve que `{shopId,offerRef}`.
Les slots connectés et SSR relisent l'offre ; aucun snapshot de prix n'est copié dans le post.
La présentation est injectée par ANTSIA dans le moteur partagé ; DIASPORALE ne l'active pas.
Le fond blanc et les cartes beige, les clés FR/EN et les refus de session restent conservés.

## 4. Médias, modération et données

Les médias voisins ne sont pas exposés par URL de stockage. Une lecture privée signée
livre les octets attendus ; ANTSIA contrôle taille/type/signature binaire/empreinte,
stage les copies sous bail, puis les admet sous scan complet. Les DTO livrent une URL
proxy locale après les gardes. L'ancienne URL est fermée au retrait, même avant purge physique.
Voir le [contrat de lecture](../../../contrats/PRO-COMMERCE-CATALOG-READ-V1.md).

La surface `commerceOffer` intègre les équipes, signalements, prélecture et retrait de
modération. L'absence de politique explicite place la copie en prélecture ; une mise à jour
source ne restaure pas une offre retirée localement. La restauration rejuge encore le parent.
L'extrait de revue ne révèle que titre et description publics de la cible assignée.

L'activation reste une décision propriétaire : politique vitrine P07, politique catalogue
P09, mapping émetteur/boutique, consentements et politique de modération `commerceOffer`
doivent être admissibles. Les origines/clés P08 restent requises. Le proxy média prend
l'origine HTTP serveur `ANTSIA_CATALOG_MEDIA_ORIGIN`, ou à défaut `CONVEX_SITE_URL`, selon la
configuration existante ; aucune origine reçue d'un utilisateur n'est utilisée.

Les quatre tables `shopCatalogPolicies`, `commerceCatalogMappings`, `commerceCatalogHeads`
et `commerceCatalogMediaAssets` sont classées dans l'inventaire. Les deux premières sont
collectives ; les têtes dépendent de la boutique, les assets de la tête et portent leurs
blobs. Une trace de signataire ne donne pas le catalogue dans son export personnel.
L'effacement du consentant ferme le lien P08 ; le catalogue collectif n'est pas réattribué
à sa personne. Les hooks PA9/PA10 et les tables DIASPORALE sont conservés.

## 5. Rattrapage, limites et preuves

L'action `shops/catalogActions.reconcile` revalide session/gérant/configuration avant et
après HTTP. Un clic demande au plus vingt snapshots par la vraie outbox PRO.GA ; le curseur
permet de poursuivre sans boucle globale ni modification du budget inbox (300/min).
Ce choix étale les gros rattrapages ; il ne prétend pas tenir un objectif de délai mesuré.
Les trous sont signalés et le rejeu DLQ conserve reçu, corps et identité d'événement.

**Aucune vérification exécutée :** ni codegen, tests, typage, lint, build, recette navigateur,
appareil, relance de service ou commande Convex. Aucun `.env`, clé réelle, configuration,
publication, commit, push ni déploiement manipulé. Les nouvelles API attendent leur génération
normale ; aucun fichier généré n'est édité à la main.

La recette d'acceptation reste à faire sur un créneau autorisé : liaison/consentement,
publication d'une offre, application constatée, modification prix/variante/photo, pause,
retrait de site/lien/consentement, fermeture du catalogue, du post et d'anciennes URLs,
réconciliation, doublons, hors ordre, reprise de bail et DLQ. Les scénarios écrits ne
constituent pas cette preuve. Le lot ne passe donc pas à « recette acceptée ».

Scénarios source ajoutés : parseurs de lecture/signature/corrélation, client média borné et
empreinte, versions/variantes/prix, héritage parent et tombstones, consentement/politiques/
mandat/modération, proxy de média sous FullAV, association d'une offre à sa page, prix relu
par le slot, filtres et pagination, métadonnées fermées et réponses tardives de session.
**Ils ne sont pas exécutés.** Les garde-fous et le manifeste P06 ne sont pas régénérés ici.

## 6. Sources principales pour la reprise

| Responsabilité | Sources |
|---|---|
| Contrat de lecture pure | `packages/social-domain/src/commerce-catalogue.ts` et jumeau PRO.GA hors manifeste P06 |
| Réception et états | `federation/commerceCatalog.ts`, `shops/catalog{Access,Control,Read,Tables,Validators}.ts`, dispatcher et registre commun |
| Lectures | `shops/catalog.ts`, `public/catalog.ts`, raccords `shops.ts`/`public/shops.ts` |
| Médias | `federation/commerceCatalog{Client,Media,MediaActions,MediaHttp}.ts`, route HTTP, garde des fichiers existante |
| Rattrapage manuel | `shops/catalogActions.ts`, `catalogReconciliation.ts`, `catalogControl.syncStatus` (échantillon vingt, pas un inventaire exhaustif) |
| Association post | `shops/catalogPosts.ts`, référence optionnelle dans `posts/tables.ts`, marqueur de DTO PA10, rendu injecté dans le contexte moteur et la carte |
| Parcours ANTSIA | composants `shops/catalog-*`, `offer-*`, `public-offer-post-slot`, routes, loader SSR et locales FR/EN |
| PRO.GA | producteurs `integrations/commerceCatalogue*`, hooks catalogue/stock/site/structures, snapshots/consentements, parcours réel de consentement et [passation](../../../../../PRO_GA/docs/20_CATALOGUE_ANTSIA.md) |

Les réservations/stages PA9/PA10 restent protégés. L'index `commerceCatalogMediaAssets.by_storage`
et l'écriture atomique asset + `mediaStaged` permettent à la purge d'orphelins PA10 de respecter
les imports en cours ; les blobs déjà admis restent protégés par `fileScans`.

Retour arrière : fermer les politiques/mappings/destinations pour les nouvelles lectures
et émissions ; préserver têtes/tombes, commandes historiques et reçus de transport.
Les copies retenues restent retenues. Aucune suppression de données n'est exécutée ici.
