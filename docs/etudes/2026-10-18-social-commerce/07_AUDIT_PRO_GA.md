# Audit factuel de PRO.GA pour une intégration commerciale avec ANTSIA

Date : 18 octobre 2026. Périmètre : lecture des sources et documents locaux, sans test, build, serveur, secret, environnement ni appel de production. Seul ce document est créé.

## 1. Références et niveau de preuve

Le propriétaire a confirmé dans cette conversation que le projet appelé oralement « Pro.gram » désigne **PRO.GA**. L'audit avait commencé sous cette hypothèse ; cette confirmation fixe maintenant le périmètre. Cette note conserve son rôle d'inventaire factuel ; la stratégie est synthétisée dans les documents 00 et 08 du dossier.

Racines utilisées dans les références `chemin:ligne` :

- **P/** = `ECOSYSTEMES/PRO_GA/`, voisin réel d'ANTSIA, confirmé par `git rev-parse --show-toplevel`.
- **A/** = `ECOSYSTEMES/ANTSIA/`.
- Commit local **PRO_GA : `9497f22eab8663e103729c441c5ad39000376ff9`**. Arbre propre aux deux lectures de statut de l'audit.
- Commit local **ANTSIA : `71091b828ce2b9d5007caa6373ac2bffbad43164`** au démarrage. Des modifications de sessions voisines existent ; elles sont préservées. Les références ANTSIA désignent les fichiers lus sur disque, sans assertion sur leur publication.

Attention documentaire : `P/CLAUDE.md:3` décrit encore un emplacement `PLATEFORMES_PUBLIQUES/pro.ga`. Le checkout effectivement audité se trouve bien dans `ECOSYSTEMES/PRO_GA`. Le dernier commit local concerne le chemin du socle ; sa présence ne prouve aucune livraison des fonctions métier.

Trois niveaux sont distingués : **plan** = intention documentaire ; **code** = schéma, producteur ou lecteur effectivement présent ; **validation** = preuve d'exécution. Cet audit établit le deuxième niveau par lecture et relève les limites du premier. Il n'ajoute aucune validation fonctionnelle ou de production. Les fichiers de tests présents constituent un inventaire de vérifications à relancer, pas des tests réputés verts.

Le cahier PRO.GA décrit une identité professionnelle, des structures, une vitrine, un réseau, un CRM et la gestion d'activité (`P/docs/00_CAHIER_DES_CHARGES_PRO_GA.md:13`). Sa passation donne une ancienne vérification du 1er août (`P/docs/15_ETAT_ET_PASSATION_2026-08-01.md:115`) et précise l'absence de paiement réel (`:516`). Les sources actuelles priment sur cette passation pour les fonctions présentes.

## 2. Inventaire métier constaté

| Objet | Ce qui existe en code | Limite pour le parcours demandé | Sources |
|---|---|---|---|
| Personne, entreprise, droits | Compte local ; profil professionnel ; tenant ; structure avec propriétaire ; affiliations et rôles locaux. La création de structure attribue `owner` et `structure_admin` au créateur. | Un profil ANTSIA n'est ni un tenant ni un gérant PRO.GA. Pas de lien de vendeur interproduits trouvé. | `P/convex/modules/tenancy/tables.ts:75`, `:283`, `:446` ; `P/convex/modules/tenancy/structures.ts:70`, `:142`, `:162` |
| Catalogue | `proOffers` produit ou service ; descriptions, tags, collections, images, zone, délai, états de publication et versions. | Une offre appartient à une structure/tenant, pas directement à une personne sociale. | `P/convex/modules/catalog/tables.ts:20`, `:72`, `:115` |
| Prix | `fixed`, `range`, `unit`, `quote` ; prix minimum/maximum, unité et XAF. | Le modèle n'est **pas monoprix** ; conserver les modes dans tout contrat et toute carte. La monnaie du catalogue est XAF seulement. | `P/convex/modules/catalog/tables.ts:29` |
| Variantes | Producteur `setOfferVariant`, grille jusqu'à deux axes et 150 variantes ; label, options, SKU, prix, fenêtre d'effet, retrait/réactivation. | Identité par offre + libellé normalisé, sans référence métier propre ; les variantes ne sont pas incluses dans `proOfferVersions.snapshot`. | `P/convex/modules/catalog/variants.ts:18`, `:43`, `:46`, `:205` ; `P/convex/modules/catalog/tables.ts:132` |
| Vitrine | Site publié et offre publiée exigés. Fiche publique avec photos, collections, variantes actives dans leur fenêtre d'effet, prix et disponibilité. | La version d'offre retournée ne versionne pas les variantes vivantes, ni les stocks. Un même numéro de version peut donc rendre des prix de variante différents. | `P/convex/modules/publicSite/projections.ts:519`, `:548`, `:563`, `:582` |
| Stock | Articles, niveaux par établissement, mouvements, réservations, expiration ; lien article ↔ offre/variante ; synchronisation depuis une offre. | Les API sont des opérations de structure. Aucun checkout ANTSIA n'est raccordé aux réservations. | `P/convex/modules/inventory/tables.ts:21`, `:58`, `:81`, `:127` ; `P/convex/modules/inventory/items.ts:525`, `:834` ; `P/convex/modules/inventory/reservations.ts:67`, `:206`, `:306` |
| CRM | Prospects, clients, opportunités, activités ; attribution et conversion ; formulaire public avec offre, contact, consentements, quotas et déduplication. | Le formulaire attend e-mail ou téléphone ; il n'est pas une messagerie ANTSIA. Pas de corrélation native avec une personne ou un fil ANTSIA. | `P/convex/modules/crm/leads.ts:53`, `:93`, `:157` ; `P/convex/modules/publicSite/publicLead.ts:30`, `:72`, `:96` |
| Devis | Création, mise à jour, versions, envoi idempotent et décision. | L'acceptation est enregistrée par un utilisateur de la structure disposant de `quotes.send` ; ce n'est pas une acceptation authentifiée du client ANTSIA. | `P/convex/modules/quotes/quotes.ts:143`, `:277`, `:330`, `:393` |
| Commandes | Création depuis un devis accepté, lignes figées, états de préparation/livraison/annulation et historique attribué. | Pas de création directe depuis un panier public. Les lignes sont label/quantité/prix/total ; elles ne portent ni offre ni variante ni article. Un second appel crée un conflit, pas un retour idempotent de la commande existante. | `P/convex/modules/orders/tables.ts:15`, `:30` ; `P/convex/modules/orders/orders.ts:77`, `:97`, `:154` |
| Factures | Brouillon, émission, annulation, avoirs ; clés d'idempotence et événements. | Pas de chaîne d'achat social démontrée. Les documents émis restent sous l'autorité métier PRO.GA. | `P/convex/modules/invoices/invoices.ts:336`, `:542`, `:659`, `:733` |
| Paiements | Intentions, constat de règlement externe, remboursement externe constaté, rapprochement, reçu, grand livre et traitement interne de callback vérifié. | **Aucun adaptateur fournisseur enregistré** ; aucun paiement réel dans ANTSIA n'est établi. Une observation d'espèces/mobile money n'est pas une initiation de paiement. | `P/convex/modules/payments/payments.ts:600`, `:704`, `:851`, `:1029`, `:1202`, `:1330`, `:1471` ; `P/convex/modules/payments/adapters.ts:27` |
| Caisse | Vente avec lignes, prix, article de stock optionnel et mouvement de sortie ; annulation avec mouvement inverse. | Parcours opérateur de caisse, distinct d'une commande e-commerce du membre social. | `P/convex/modules/pos/sales.ts:135`, `:222`, `:314`, `:378` |
| Services et RDV | Prestation réservable liée facultativement à une offre ; durée, marges, ressources, préavis, fenêtre ; créneaux publics et demande publique. | Pas de réservation depuis une identité ANTSIA. Contacts requis. La confirmation humaine est la valeur par défaut ; l'autoconfirmation est configurable. | `P/convex/modules/agenda/services.ts:56`, `:85`, `:116` ; `P/convex/modules/agenda/publicBooking.ts:38`, `:92`, `:175`, `:321` |
| Emploi | `proJobOpenings`, `proJobApplications`, `proInterviews` ; contrats, rémunération déclarée, effectif, statut ; pipeline, entretien, décision humaine et lien vers un salarié existant. | `published` est un état métier interne. Les producteurs/lecteurs trouvés sont `structureQuery`/`structureMutation`. Aucun annuaire public d'offres d'emploi ni dépôt authentifié de candidature ANTSIA constaté. | `P/convex/modules/recruiting/tables.ts:12`, `:54`, `:94` ; `P/convex/modules/recruiting/openings.ts:90`, `:141`, `:235` ; `P/convex/modules/recruiting/applications.ts:128`, `:204`, `:263` |

Les surfaces ne sont pas seulement prévues : le registre déclare catalogue, recrutement, CRM, devis, commandes, paiements, stock et agenda (`P/packages/pro-domain/src/surfaces.ts:550`, `:592`, `:662`, `:704`, `:718`, `:760`, `:818`). Les routes correspondantes existent sous `P/apps/pro_ga/src/app/structure/[structureRef]/`. Exemple vérifié : la route paiements monte `PaymentsBoard` (`paiements/page.tsx:1`). La route publique `/offres/[offerRef]` monte `PublicOfferView` (`P/apps/pro_ga/src/app/(public)/offres/[offerRef]/page.tsx:1`), qui lit `usePublicOffer` et importe `LeadRequestForm` (`P/packages/pro-features/src/features/public-directory/PublicOfferView.tsx:7`). Aucun rendu navigateur n'a été observé pendant cet audit.

### Prix et disponibilité : distinctions indispensables

Le catalogue public sert les champs de l'offre depuis sa version publiée et les variantes depuis la table vivante. Le SKU reste interne ; la fiche renvoie label/options/prix/unité/disponibilité (`P/convex/modules/publicSite/projections.ts:563`). Le stock public renvoie seulement `in_stock`, `out_of_stock` ou `null`, sous opt-in `showAvailability` ; il additionne `onHand - reserved` sur les établissements (`:123`, `:198`, `:209`).

Conséquences factuelles pour un futur miroir : un booléen de disponibilité n'est pas une réservation ; une carte ne suffit pas à garantir prix et quantité au paiement ; la version publiée d'offre seule ne garantit pas le prix d'une variante. Une autorité de confirmation doit relire ces données au moment de l'engagement.

## 3. Authentification et permissions

### PRO.GA

`structureQuery` et `structureMutation` consomment `structureBusinessRef` et résolvent le contexte côté serveur (`P/convex/lib/pro/customFunctions.ts:63`). La résolution exige structure vivante, affiliation unique active du compte, correspondance du tenant, modules et tâches effectifs (`P/convex/lib/pro/resolveContext.ts:143`). Le module `commerce` est retiré des droits effectifs quand la structure n'est pas vérifiée (`:187`). Chaque opération conserve ensuite sa garde de tâche.

Le code Better Auth inspecté configure e-mail/mot de passe vérifié, OTP e-mail, second facteur et `crossDomain` (`P/convex/betterAuth/auth.ts:163`, `:201`). **Aucun fournisseur IDN/OIDC ni passage ANTSIA → PRO.GA n'a été trouvé dans cette configuration.** La route de découverte OpenID redirige vers le mécanisme Convex (`P/convex/http.ts:68`) ; cela ne prouve pas un SSO d'identité civile. `crossDomain` ne constitue pas à lui seul un partage d'identité entre deux backends.

### Contraintes ANTSIA applicables

Une personne/handle dans le moteur, adhésions explicites, `networkId` sur le social, visibilité de réseau par défaut, droits et badges calculés, aucune lecture de base externe ni import `_generated` voisin (`A/docs/00_CAHIER_DES_CHARGES_ANTSIA.md:165`, section 5 ; `A/docs/adr/0003-federation-entrante-par-contrats-signes.md:14`).

L'intégration doit donc démontrer séparément : identité du membre ANTSIA, contrôle du compte PRO.GA, mandat actif pour la structure vendant l'objet, consentement de liaison et consentement de publication vers un réseau déterminé. Ni l'égalité d'un e-mail, ni un handle, ni un badge ANTSIA ne confèrent un rôle de gérant PRO.GA. Aucun de ces liens interproduits ne doit créer d'office personne ou adhésion sociale.

## 4. Contrats et fédération : code présent, raccord absent

### 4.1 Deux outboxes PRO.GA distinctes

1. **Outbox métier existante `proOutboxEvents`.** `emitProEvent` crée une enveloppe `federation.okatech.ga/v1`, un sujet en référence métier, un `eventId`, une destination par défaut `ntsagui-fabric` et une clé `eventId#destination` (`P/convex/lib/pro/outbox.ts:24`). Le code de cron documente explicitement l'absence de consommateur de cette table (`P/convex/crons.ts:44`). Il planifie une rétention, pas une livraison.
2. **Fondation `proIntegrationOutbox`.** Configuration par tenant/destination, audiences, scopes machine, empreinte canonique, déduplication et conflits, leasing, reprise, lettres mortes et reçus sont implémentés (`P/convex/modules/integrations/outbox.ts:106`, `:139`, `:186` ; `P/packages/pro-domain/src/integrations.ts:59`).
3. **Transport abstrait seulement.** `dispatchWithTransport` prend un transport et un résolveur de clé injectés ; l'implémentation concrète présente est `TestIntegrationTransport`, sans I/O (`P/convex/modules/integrations/transport.ts:156`, `:217`). L'OpenAPI le dit explicitement : ni route réseau, ni transport, ni gestionnaire de clés enregistré (`P/docs/api/openapi.yaml:8`, `:40`). Le routeur réel `P/convex/http.ts` ne monte que l'authentification et les routes de développement inspectées, pas les endpoints de fédération décrits dans l'OpenAPI.

La recherche des appels à `enqueueFederationEvent` trouve sa définition et les tests d'intégration ; aucun raccord des producteurs `emitProEvent` vers cette seconde outbox n'a été trouvé. **Disposer des deux tables n'établit pas une livraison.**

### 4.2 Événements déclarés contre événements produits

Le registre déclare notamment `offer.published`, `offer.archived`, `crm.lead.*`, `agenda.appointment.*`, `quote.sent`, `quote.accepted`, `order.created`, `order.completed`, `invoice.issued`, `payment.updated`, `stock.*` (`P/packages/pro-domain/src/federation.ts:53`). Un nom dans ce registre ne garantit pas un producteur.

- La publication/republication d'offre émet `offer.published` avec **seulement `{ version }`** en payload (`P/convex/modules/catalog/offers.ts:569`). Il faut encore un DTO exportable ou une API contractuelle de lecture pour reconstituer l'offre à distance.
- L'archivage émet `offer.archived` ; la pause enlève la projection de recherche mais n'émet pas d'événement dans ce chemin (`:603`). Il manque donc un signal de retrait pour ce cas si l'on construit un miroir événementiel.
- Les mutations de variantes/collections inspectées ne produisent pas d'événement de catalogue. Or les prix et intitulés concernés sont lus en direct par la vitrine.
- `createOrderFromQuote` et `advanceOrder` écrivent la commande et l'audit, sans appel à `emitProEvent` dans ces fonctions (`P/convex/modules/orders/orders.ts:110`, `:185`). Les noms `order.created/completed` du registre ne suffisent pas.
- `payment.updated` possède un producteur effectif vers l'outbox métier ; son payload rappelle `fundsHeldByProGa: false` (`P/convex/modules/payments/events.ts:23`).
- Aucun événement de recrutement n'apparaît dans le registre inspecté (`P/packages/pro-domain/src/federation.ts:53`). Le passage `published → closed/filled` d'un poste n'a donc pas de contrat de reflet ANTSIA identifié.

### 4.3 Incompatibilité avec l'inbox ANTSIA actuelle

| Point | PRO.GA | ANTSIA | Travail nécessaire si fédération retenue |
|---|---|---|---|
| Enveloppe | `apiVersion`, `kind`, `eventId`, `eventType`, `producer`, `subject`, `objectRefs`, payload. | Exactement `eventId`, `contract`, `version`, `objectRef`, `payload`. | Adaptateur explicite et schéma commercial fermé ; pas de transfert brut. |
| Signature | HMAC-SHA256 base64url ; entrée canonique à champs préfixés par longueur, clé/nonce/tenant/audience/scope et digest. | HMAC hexadécimal de `environment + newline + timestamp + newline + rawBody`. | Implémenter le profil de chaque extrémité, avec clés par émetteur/environnement ; les signatures ne sont pas interchangeables. |
| Identité objet | `pro.ga/offer/<id>` et références métier analogues. | `objectRef` autorise ASCII alphanumérique, `. _ : -`, **pas `/`**. | Définir une référence de transport compatible et une correspondance stable, sans transformer des IDs Convex en identités publiques. |
| Routage | `tenantBusinessRef`, destination, audience et scopes machine. | Réseau résolu exclusivement depuis l'émetteur enregistré ; `networkId` interdit dans le payload. | Correspondance autorisée structure/tenant/réseau, jamais une assimilation de `tenantId` à `networkId`. |
| Effet métier | Fondation inbox/outbox interne, transport de test. | Route `/federation/inbox` présente ; aucun handler métier. Tout contrat autorisé est placé en `dead_letter/unsupported_contract`. | Écrire le handler et les projections commerciales ; un HTTP 202 ne vaut pas application. |
| Données privées | CRM et RDV transportent localement des contacts. | E-mail/téléphone, identifiants internes, secrets et clés associées sont refusés même imbriqués. | Prévoir des commandes privées dédiées et minimisées ; l'inbox publique de reflets ne convient pas à l'envoi brut d'un prospect ou d'une candidature. |

Sources : `P/docs/api/openapi.yaml:69`, `:123` ; `P/convex/lib/pro/outbox.ts:40` ; `A/docs/contrats/FEDERATION-INBOX-V1.md:13`, `:51`, `:70`, `:85` ; contrôle réel des lettres mortes dans `A/convex/modules/federation/inbox.ts:26` et `:38`.

Les deux côtés possèdent des mécanismes d'idempotence, mais leur granularité diffère : PRO.GA canonise l'enveloppe ; ANTSIA déduplique `(emitter, environment, eventId)` sur le digest du corps **exact**. Un adaptateur doit persister le corps exact de chaque événement pour ses reprises. Les évolutions commerciales doivent porter une version métier distincte du `version: 1` de transport ANTSIA et gérer événement retardé, retrait et rejeu.

## 5. Sources de vérité proposées, sans décision d'architecture

Ce tableau donne l'option cohérente avec le code constaté et la demande « gestion de l'entreprise dans PRO.GA ». Il ne crée aucun nouveau contrat et n'ordonne aucune migration.

| Entité | Autorité proposée | Projection/liaison ANTSIA possible | Écart à couvrir |
|---|---|---|---|
| Personne sociale, handle, adhésion et graphe | ANTSIA | Profil et relations existants | Liaison volontaire d'un compte PRO.GA ; identité civile IDN si retenue, sans fusion automatique par contact |
| Structure vendeuse, établissements, mandats d'équipe | PRO.GA | Carte de vendeur ou boutique liée à une page/personne | Preuve de mandat, révocation et mapping serveur ; un vendeur individuel reste à modéliser explicitement comme exploitant/structure |
| Présentation sociale de la boutique | ANTSIA pour le contexte social ; PRO.GA pour les faits commerciaux publiés | Habillage, abonnés, posts, questions ; projection du nom et de la vérification commerciale | Règles de modification sans deux maîtres pour le même champ |
| Produit/service, collections, prix, variantes | PRO.GA | Catalogue public limité et versionné | Référence stable de variante, version commerciale cohérente, retrait immédiat, photos et disponibilité |
| Stock, réservation et établissement d'exécution | PRO.GA | Disponibilité indicative ; résultat de réservation | API transactionnelle d'engagement, expiration et libération sur échec ; ne jamais déduire le stock du miroir |
| Question et conversation sociale | ANTSIA | Fil iCom rattaché à une offre/boutique | Mandat du répondant, objet commercial minimal, visibilité et consentement de transfert vers CRM |
| Prospect, client, opportunité | PRO.GA | Référence opaque et état minimal de la demande initiée dans ANTSIA | Nouvelle provenance ANTSIA, déduplication par demande et structure, consentement sans copier le graphe ou toute la conversation |
| Devis accepté, commande, facture, avoir | PRO.GA | Vue personnelle de l'acheteur et actions autorisées | Sujet acheteur, acceptation authentifiée, lignes référencées, commande directe ou parcours devis explicitement choisi |
| Intentions et rapprochement de paiement | PRO.GA pour le registre ; fournisseur pour l'état effectif des fonds | Écran de paiement et suivi dans ANTSIA via contrat | Adaptateur fournisseur réel, preuve callback, corrélation commande/montant/devise/acheteur, reçus et remboursement |
| Prestation réservable, ressource, créneau, RDV | PRO.GA | Recherche et demande de créneau | Identité du demandeur, confirmation/annulation, consentement, éventuel acompte |
| Poste, candidature, entretien, décision RH | PRO.GA | Offre publiée ; dépôt et suivi privé de la candidature | DTO public d'emploi, contrat de candidature, pièces jointes gardées, retrait/expiration et identité du candidat |
| Reçu de fédération, miroir et modération du réseau | ANTSIA | Preuve locale de réception/application et retrait social | Handler commercial, état appliqué démontré, distinction retrait métier/retrait de modération |

## 6. Écarts concrets à spécifier avant implémentation

1. **Boutique personnelle.** Aujourd'hui, l'offre appartient à une structure et un tenant. Deux options à étudier : rattacher volontairement une structure existante ; proposer une création explicite d'activité individuelle dans PRO.GA. Ne pas créer une entreprise, une personne ou une adhésion en arrière-plan à la simple ouverture du profil ANTSIA.
2. **Liaison de comptes et mandat.** IDN/SSO PRO.GA reste à implémenter/configurer si choisi. Un passage sécurisé pourrait éviter une seconde saisie d'identité, mais ne doit jamais conférer une affiliation. Prévoir consentements séparés de liaison, publication, contact commercial et candidature ; révocation des mandats et de la liaison.
3. **Variantes.** La source n'est pas monoprix. Options : conserver le couple offre/libellé avec règles d'immuabilité et migration, ou introduire une référence stable dans PRO.GA avec adaptation des résolveurs existants. Ce choix est un changement de contrat, car les commentaires et le code actuels prennent le libellé pour identité (`P/convex/modules/catalog/variants.ts:25`).
4. **Commande et stock.** Le passage devis accepté → commande n'est pas un checkout. Ajouter soit une commande commerciale directe, soit une adaptation explicite via devis ; dans les deux cas, lier les lignes à l'offre/variante/version, au vendeur et à l'établissement. Orchestrer réservation, confirmation du prix, paiement, consommation/libération du stock et annulation. Le code caisse donne un exemple de liaison au stock, sans couvrir ce parcours acheteur.
5. **Paiement.** Le registre d'adaptateurs est vide. Le choix et la recette d'un fournisseur, l'initiation, le callback signé, les reprises, remboursements et éventuels versements aux vendeurs restent ouverts. Les champs `mobile_money` ou `succeeded` et la présence d'un écran ne prouvent pas l'encaissement.
6. **Interactions commerciales.** `submitPublicLead` impose un contact et écrit un consentement ; il ne doit pas aspirer automatiquement les messages du réseau. Définir les questions qui restent dans ANTSIA et l'acte explicite qui crée une demande CRM. La déduplication actuelle est à l'échelle tenant/contact ; une même personne discutant de deux boutiques d'un tenant nécessite une règle explicite.
7. **Frontière structure dans un tenant.** `submitPublicLead` vérifie l'offre par tenant et statut mais pas par structure (`P/convex/modules/publicSite/publicLead.ts:117`). `createOrderFromQuote` utilise `assertObjectTenant` puis attribue la nouvelle commande à la structure courante (`P/convex/modules/orders/orders.ts:88`, `:114`) ; cette garde ne compare effectivement que le tenant (`P/convex/lib/pro/guards.ts:66`). Avant réutilisation interproduits, exiger les deux bornes tenant **et** structure dans le contrat. Ce sont des points statiques à vérifier/corriger, sans test d'exploitation réalisé ici.
8. **Emploi.** Publier une offre RH sur ANTSIA exige une projection publique propre, sans notes d'entretien, contacts ou dossier salarié. `source: public_site` dans le schéma de candidature n'est pas une API de candidature : le producteur actuel est une mutation de structure (`P/convex/modules/recruiting/applications.ts:128`).
9. **Fédération.** Relier ou remplacer explicitement les deux outboxes, créer transport et ordonnanceur, exporter les projections et écrire les handlers ANTSIA. Couvrir pause/retrait, variantes/prix, changement de vérification, fermeture d'emploi, stock et états de commande ; ne pas se limiter aux types déclarés dans le registre.
10. **Confidentialité et médias.** Ne pas pousser de contacts ou dossiers RH dans l'inbox de reflets publics. Prévoir autorisation de lecture de pièce et politique de retrait ; les URL publiques de photos PRO.GA ne constituent pas d'elles-mêmes la garde de délivrance ANTSIA.
11. **Identité des personnes.** Des points d'entrée existants utilisent encore `name.trim()` ou `contactName.trim()` (`P/convex/modules/publicSite/publicLead.ts:91`, `P/convex/modules/agenda/publicBooking.ts:195`, `P/convex/modules/crm/leads.ts:168`) et les candidatures ont `fullName` (`P/convex/modules/recruiting/tables.ts:59`). L'intégration doit appliquer le normaliseur partagé NOM(S) en majuscules/Prénoms capitalisés à la saisie, aux imports, au stockage et à l'affichage ; un champ unique ne permet pas de deviner sûrement quelle partie est le nom. Conserver les organisations et les documents déjà signés hors de cette normalisation.

## 7. Options d'intégration à comparer

| Option | Réemploi établi | Fonctions encore nécessaires | Rapport à la demande |
|---|---|---|---|
| Lien de boutique ANTSIA vers vitrine PRO.GA | Site, fiche produit, formulaire de contact, prise de RDV existants | Liaison volontaire du vendeur, URL vérifiée, habillage et règles de publication | Réduit le raccord technique initial ; ne satisfait pas à lui seul « paiement et questions dans ANTSIA ». |
| Miroir de catalogue dans ANTSIA, commandes/CRM dans PRO.GA | Catalogue, stock, gestion, fondations de fédération | Export cohérent, transport, handler, commandes privées, liaison d'identité et paiement | Compatible avec la répartition demandée, mais chaîne entière à implémenter et valider. |
| Catalogue et transactions recréés dans ANTSIA avec synchronisation ERP | Principalement conventions et patrons du code PRO.GA | Deux modèles commerciaux et règles de résolution de conflits | Crée un double maître potentiel des prix/stocks/commandes ; nécessite un arbitrage distinct. |

Aucune option n'est exécutée ou validée par cette note.

## 8. Vérifications disponibles et limites de cet audit

Suites présentes : `P/convex/modules/catalog/{catalog,variants,collections,media}.test.ts`, `inventory/sync-from-offer.test.ts`, `orders/orders.test.ts`, `quotes/quotes.test.ts`, `payments/{payments,payments-projections}.test.ts`, `agenda/{agenda,bookingPolicy}.test.ts`, `crm/crm.test.ts`, `integrations/integrations.test.ts`, et `A/convex/modules/federation/federation.test.ts`. Leurs résultats n'ont pas été relevés ou réutilisés comme preuve actuelle.

Les absences indiquées sont bornées aux sources inspectées et aux recherches dans les modules, le routeur, les registres et les appels. Aucune assertion n'est faite sur un autre checkout, un travail en cours non présent sur disque, une configuration de fournisseur ou des fonctions déjà publiées différentes du code local. Aucune donnée métier réelle n'a été consultée. La note a été relue et ses chemins cités contrôlés statiquement ; aucun test/build n'a été lancé conformément au périmètre demandé.
