# 05 — Activation progressive et retour arrière, par capacité

19 octobre 2026, lot P19. **Aucune capacité n'est ouverte et aucune ne doit l'être sur la foi de ce
document.** Toutes les politiques commerciales sont fermées par défaut dans le code. Chaque
ouverture suppose : un `verify` vert, la recette de la capacité jouée (verdict « observé en
recette »), les décisions dont elle dépend tranchées ([06](06_REGISTRE_DES_DECISIONS.md)), la
configuration posée par le propriétaire, puis **une demande explicite du propriétaire**.

## 1. Principes (09 §4, 08 §8, ADR-0018 §5)

- Une capacité s'ouvre par une **porte serveur** (politique du réseau, habilitation, configuration).
  Un drapeau dans le navigateur ne donne aucun droit.
- Fermer une capacité ferme les **nouvelles** entrées. Lecture, suivi, libération, annulation,
  retrait et remboursement des engagements existants continuent par leurs voies privées.
- Aucun retour arrière par purge : ni commande, ni session, ni preuve financière, ni candidature
  supprimées pour « revenir ». Aucun fichier généré édité, aucun cliquet désactivé.
- Le pilote se restreint par des admissions une à une (vitrines `review`, consentements par offre et
  par poste, politique vendeur PRO.GA), jamais par un drapeau client.

## 2. Rôles

| Rôle | Décide | Exécute |
|---|---|---|
| Propriétaire | toute ouverture, tout retour à l'état ouvert, toute publication | — |
| Coordinateur technique | préparation technique, gel, vérification, retour arrière d'urgence (fermeture) | publication autorisée, fermetures |
| Opérateur plateforme ANTSIA (habilité, console) | — | politiques réseau avec motif et audit, admissions, rejeux |
| Administrateur du réseau | politiques de modération (`moderation/cases.setPolicy`, audit `moderation.policy_set`) | idem |
| Administrateur plateforme PRO.GA (`super_admin` ou `system_admin`) | remboursements, registre et politique marketplace | idem, sous session vivante et audit |
| Vendeur ou recruteur (structure PRO.GA) | politique vendeur, consentements par offre et par poste, auto-confirmation des prestations | dans PRO.GA |

## 3. Portes par capacité

| Capacité | Porte serveur, fermée par défaut | Ouverture possible aujourd'hui | Décisions et prérequis |
|---|---|---|---|
| **UI seule** (version A) | déclarations `navigation="destinations"`, `postPresentation="media"`, `feedPresentation="immersive"` dans `apps/antsia_ga/src/components/network-shell.tsx`, montage de `MediaPlaybackProvider` | déjà déclarées dans le code : une publication les servirait | DP-01, DP-02, DP-21, DP-38 ; PR-02 |
| **Vitrines** | `shopNetworkPolicies` (`closed`, `review`, `auto_verified`) par `shops/operator.setStorefrontPolicy` ; file `storefrontQueue`, décision `decideStorefront`, suspension `setStorefrontSuspension` | fonctions opérateur **sans écran de console** (K-19) | DP-04, DP-05 |
| **Catalogue** | `shopCatalogPolicies` par `shops/catalogControl.setPolicy` ; mapping par `configureMapping` ; émetteur par `federation/emitters.configure` avec `PRO-COMMERCE-PUBLIC-V1` ; modération `commerceOffer` ; consentements PRO.GA (entreprise, puis offre) | politique et mapping **sans écran** ; émetteur dans la console Fédération ; consentements dans la fiche d'offre PRO.GA | DP-04 ; PR-01 |
| **Contact commercial** | `commercialMessaging/operator.setPolicy` ; accueil et mandats de la boutique | console, section Pages (`CommercialContactPolicy`) | PR-01 pour le transfert CRM ; PR-03 pour les appels |
| **Achats admis : préparation** | `shops/checkoutPolicy.setPolicy` (réseau) ; politique vendeur PRO.GA `commerceCheckoutPolicy.configurePolicy` | réseau **sans écran** ; vendeur dans PRO.GA (Commandes) | PR-01 ; DP-15, DP-16 |
| **Achats admis : paiement** | `shops/paymentPolicy.setPolicy` ; côté PRO.GA : adaptateur enregistré, configuration fournisseur commerce, registre plateforme, politique marketplace (sauvegardée désactivée, puis activée à part), acceptation vendeur | écran de console présent (`PaymentPolicy`), **inopérant** : `PAYMENT_ADAPTERS = []`, et ANTSIA refuse tout environnement autre que `sandbox` (`paymentAccess.ts:32`) | DP-10 à DP-14, DP-17 |
| **Services** | `shops/servicePolicy.setPolicy` (réseau de lecture et réseau de la boutique) ; PRO.GA : scopes de la source, permissions `receive_bookings`, `receive_inquiries`, `receive_orders`, prestations rattachées et publiées | console Pages (`ServicePolicy`) | PR-01 ; DP-17 |
| **Emploi** | `shops/jobs.setPolicy` ; émetteur avec `PRO-COMMERCE-JOBS-V1` ; modération `commerceJob` ; PRO.GA : scope `commerce.application.submit`, destination `job.*`, liaisons `publish_jobs` et `receive_applications`, consentement par poste | console Pages (`JobPolicy`) | PR-01 ; DP-17 (conservation des candidatures) |
| **Conversation contextuelle** | `contextualPolicies` par réseau et par nature, `contextualMessaging/operator.setPolicy` (motif d'au moins dix caractères, audit `contextual.policy_set`) | **sans écran** (prévu en CC-2b) ; aucune nature dans le réseau racine | sous-lots CC-3 à CC-6 ; DP-17, DP-20 |
| **Natif** | aucune (aucun client) | — | DP-26 à DP-33 ; PR-06 |

**« UI seule » n'est pas séparable aujourd'hui.** Publier la version A depuis l'arbre actuel sert
aussi des surfaces que rien ne ferme : sept entrées commerciales de Profil
(`app/(membre)/moi/me-model.ts`), l'onglet Boutiques de Découvrir
(`components/discovery/discover-model.ts`) et la création d'un brouillon de boutique (P07, sans
politique). Elles n'ouvrent ni achat ni publication, mais elles annoncent un commerce que le pilote
A ne propose pas. Options (DP-38) : les accepter, visibles et vides ; ou un lot qui ajoute une
capacité d'application `commerce` pour les entrées et onglets, **et** une porte serveur pour les
brouillons, faute de quoi le masquage resterait cosmétique (un drapeau client ne donne ni ne
retire aucun droit).

Quatre portes n'ont pas d'écran : vitrines, catalogue, préparation et conversation contextuelle.
Deux voies sont possibles, à choisir par le propriétaire : un lot d'écrans de console (même modèle
que `console-payment-policy.tsx` : motif, audit, révision) ou une procédure opérateur écrite,
appelée sur le déploiement autorisé, motif et audit compris. La seconde voie est une commande vers
un déploiement : elle exige elle aussi une demande explicite.

**Configuration, noms seulement** (aucune valeur dans un document ni dans le source) :

- ANTSIA : `ANTSIA_COMMERCE_ENVIRONMENT`, `ANTSIA_COMMERCE_SOURCE`, `ANTSIA_COMMERCE_PRO_HTTP_ORIGIN`,
  `ANTSIA_COMMERCE_PRO_APP_ORIGIN`, `ANTSIA_COMMERCE_ORIGIN`, `ANTSIA_COMMERCE_KEY_ID`,
  `ANTSIA_COMMERCE_SIGNING_KEY`, en production seulement `ANTSIA_COMMERCE_PRODUCTION_ENABLED` ;
  pour la recette `FEDERATION_ENVIRONMENT=sandbox` et `ANTSIA_COMMERCE_TRANSPORT_TEST_ENABLED=true` ;
  médias du catalogue `ANTSIA_CATALOG_MEDIA_ORIGIN` (à défaut `CONVEX_SITE_URL`) ; clés
  d'émetteur par référence `ANTSIA_FEDERATION_[A-Z0-9_]+_KEY`.
- PRO.GA : `PRO_COMMERCE_ENVIRONMENT` (`sandbox` ou `production`, explicite) ; source privée par
  `commerceConfig:configure` et clé `PRO_COMMERCE_[A-Z0-9_]+_KEY` ; transport sortant par
  `commerceTransportConfig:configure`, origine `PRO_COMMERCE_PUBLIC_[A-Z0-9_]+_ORIGIN` et clé
  `PRO_COMMERCE_PUBLIC_[A-Z0-9_]+_KEY`, distinctes des clés privées ; recette
  `PRO_COMMERCE_TRANSPORT_RECIPE_ENABLED`. Détail : [PRO.GA docs/19](../../../../../PRO_GA/docs/19_LIAISON_TRANSPORT_ANTSIA.md) §2.

## 4. Retour arrière par capacité, et ce qui reste servi

| Capacité | Geste de retour arrière | Ce qui continue | Ce qu'il ne faut pas faire |
|---|---|---|---|
| UI seule | retirer la déclaration concernée dans `network-shell.tsx` : coque historique, fil en liste, carte classique ; ou rester en liste (choix mémorisé par réseau) | contenus, sessions, appels ; l'état local `antsia:<slug>:feed-mode:v1` est purgé à la déconnexion | toucher aux données ou aux sessions |
| Vitrines | politique `closed`, ou suspension d'une vitrine | pages et obligations ; préparations libérables ; support des commandes par la voie privée P13 ; demandes de service et candidatures lisibles. Les conversations P10 se ferment quand la vitrine n'est plus servable (P16 §4) | effacer une page ou une boutique pour la retirer |
| Catalogue | fermer politique, mapping ou destination ; retrait des consentements dans PRO.GA (tombes) | têtes et tombes, reçus de transport, commandes historiques ; anciennes URL de médias fermées | supprimer des têtes ou des tombes |
| Contact commercial | politique réseau ou réglage de boutique fermés | retrait de l'accord CRM depuis Mes données, sans adhésion requise ; support des commandes par P13. Fermer masque les conversations commerciales existantes (comportement P10 relevé par le contrat CC, D10) | supprimer les intentions de blocage |
| Préparation | politique réseau fermée ; politique vendeur fermée | statut et libération d'une préparation (même vendeur suspendu) ; expiration automatique à quinze minutes | consommer ou libérer à la main une réservation sociale (les anciennes portes la refusent) |
| Paiement | politique fermée ; registre ou politique marketplace désactivés | consultation (`lookup`), remboursements sous le binding historique, décisions de l'administrateur plateforme, rapprochement, revue des anomalies | purger le journal financier ou les anti-rejeux ; relancer un débit sans preuve d'absence |
| Services | politique fermée ; retirer les permissions ou les scopes côté PRO.GA | lecture et annulation des rendez-vous, devis et commandes existants | annuler d'office des rendez-vous |
| Emploi | politique fermée ; retirer `PRO-COMMERCE-JOBS-V1` de l'émetteur ; retirer les consentements par poste (tombes `withdrawn`) | candidatures existantes, suivi, retrait par le candidat toujours possible | supprimer une candidature ou une preuve d'accord |
| Conversation contextuelle | politique fermée par réseau et par nature | historique en lecture seule pour les parties (D10) | supprimer des fils |
| Natif | sans objet | — | — |

## 5. Ordre d'activation proposé

Chaque étape exige la précédente, ses verdicts, et une demande explicite du propriétaire.

| Étape | Contenu | Conditions d'entrée | Déclencheurs de retour arrière |
|---|---|---|---|
| 0 | Gel, `verify` vert dans les deux dépôts, recette A | DP-01 ; [02](02_GEL_ET_VERIFICATION.md) ; parcours A-1 à A-6, A-10, A-11 | — |
| 1 | Publication de la version A sur le réseau racine | DP-02, DP-21 et DP-38 tranchées ; PR-02 ; parcours rejoués sur la révision servie | invariant du §6 franchi ; bloquant d'accessibilité constaté |
| 2 | Vitrines en `review` et contact commercial, pour quelques boutiques de recette admises une à une | DP-04, DP-05 ; B-1, B-5 joués ; porte des vitrines utilisable (K-19) | fuite d'une donnée privée ; usurpation non traitée ; harcèlement |
| 3 | Catalogue pour ces boutiques | PR-01 ; B-2 à B-4 et B-6 joués | résurrection d'une offre ; ancienne URL servie ; propagation hors seuil |
| 4 | Services et emploi, sans paiement | C-8 à C-11, C-13 joués ; DP-17 au moins pour les candidatures | double réservation ; CV accessible à un tiers |
| 5 | Préparation (réservation et libération), paiement fermé et annoncé comme indisponible | C-1, C-2, C-7, C-12, C-14 joués ; DP-15, DP-16 | réservation en double ; réduction silencieuse |
| 6 | Paiement en sandbox, recette seulement | DP-10 à DP-14 ; adaptateur réel vérifié ; C-3 à C-6 joués | tout débit ou commande en double |
| 7 | Encaissement réel | **hors de ce pilote** : DP-10 à DP-14, DP-17, DP-18, changement de code de la porte `sandbox`, contrats signés, demande explicite | — |
| 8 | Natif | **hors de ce pilote** : P17b à P17d prouvées sur appareils | — |

## 6. Indicateurs, responsables et seuils d'alerte

Les seuils viennent des mesures ou des invariants du dossier ; aucun volume commercial n'est
inventé. Là où aucune mesure n'existe encore, toute occurrence est examinée jusqu'à ce que P18b
fixe un seuil mesuré.

**Invariants : seuil 0, retour arrière immédiat de la capacité**

| Indicateur | Source | Responsable |
|---|---|---|
| Débit ou commande en double ; deux réservations pour une unité | journal financier et stock PRO.GA | administrateur plateforme PRO.GA, coordinateur |
| Paiement affiché réussi sans preuve serveur corrélée | revue des états, recette | coordinateur |
| Deux vidéos en lecture simultanée | recette du fil | coordinateur |
| Offre ressuscitée après une tombe ; ancienne URL de média encore servie | têtes de catalogue, proxy média | coordinateur |
| Contenu privé dans un journal, un avis, une analytique ou l'export d'un tiers | audits, cliquets, signalements | coordinateur |
| Lecture par un tiers d'une préparation, d'un achat, d'une candidature ou d'une conversation | recette, signalement | coordinateur |

**Exploitation : seuil à fixer à la mesure, examen de chaque occurrence d'ici là**

| Indicateur | Source | Objectif connu | Responsable |
|---|---|---|---|
| Lettres mortes de l'inbox ANTSIA | console Fédération | — | opérateur |
| Lettres mortes de l'outbox PRO.GA | administration des intégrations PRO.GA | — | administrateur plateforme PRO.GA |
| Propagation du catalogue (`receivedAt − changedAt`) | têtes de catalogue | p95 < 60 s en fonctionnement normal (10 §4) | coordinateur |
| Disponibilités périmées (plus de quinze minutes) | têtes de catalogue | — | coordinateur |
| Opérations de paiement en consultation ou en rapprochement humain (après dix tentatives) ; paiements en revue | PRO.GA | — | administrateur plateforme PRO.GA |
| Réservations expirées sans libération | PRO.GA | — | coordinateur, vendeur |
| Transferts CRM en attente de retrait distant | ANTSIA | — | opérateur |
| Retraits de candidature clos `remoteUnconfirmed` | ANTSIA | — | opérateur, recruteur |
| Jobs planifiés en échec (stock borné ; les erreurs synchrones ne sont pas couvertes) | console Santé | — | coordinateur |
| Premier contenu utile, longues tâches, mémoire | mesures P18b | ≤ 3 s p75 et ≤ 5 s p95 ; aucune tâche > 200 ms au changement de publication (10 §4) | coordinateur |

**Indicateurs produit** (10 §5), définis sans cible : activation vendeur, demande utile, achat
abouti, exécution, service, fiabilité, utilisabilité. Ils se lisent sur des agrégats serveur et sur
le pilote utilisateur, jamais sur le texte des conversations ni sur l'analytique facultative.

## 7. Prérequis réels à fournir avant les étapes commerciales

| Domaine | Prérequis | Référence |
|---|---|---|
| Fournisseur de paiement | connecteur concret, contrat marchand, sandbox, preuves de callback et de consultation, remboursement | DP-10 |
| Bénéficiaire et redistribution | juridiction, dispositif marketplace, capacité de reversement | DP-11, DP-12 |
| Conditions | frais, commission, conditions de vente, remboursement, litige, pays servis | DP-13, DP-14 |
| Conservation | durées des preuves financières, suivis privés, candidatures, preuves d'acceptation | DP-17 |
| Configuration | sources, destinations, clés et origines par environnement | PR-01 |
| Hébergement | projet Convex `antsia`, déploiements, domaines | PR-02 |
| Appels et notifications | LiveKit ; VAPID, FCM, APNs | PR-03, PR-04 |
| Appareils | iPhone, Android physique avec services Google, lecteurs d'écran | PR-06 |
| Machine | espace disque, Node 22 | PR-07 |
