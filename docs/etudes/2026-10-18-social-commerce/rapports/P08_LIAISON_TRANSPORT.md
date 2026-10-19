# P08 — Liaison volontaire et transport ANTSIA × PRO.GA

18 octobre 2026. Demande : « Continue le lot liaison et transport (P08) entre ANTSIA et
PRO.GA, sans relancer les vérifications. »
Références : [prompt P08](../prompts/P08_LIAISON_TRANSPORT.md),
[architecture](../08_ARCHITECTURE_INTEGRATION.md),
[contrat de liaison](../../../contrats/PRO-COMMERCE-LINK-V1.md),
[COMMAND](../../../contrats/PRO-COMMERCE-COMMAND-V1.md),
[PUBLIC](../../../contrats/PRO-COMMERCE-PUBLIC-V1.md).

**Verdict : sources raccordées dans les deux produits ; vérification et recette P08 ouvertes.**
Tests écrits/étendus **sans exécution**. Aucun résultat historique de P06 n'est une preuve
de validation de P08. Configuration, génération et recette interproduits restent ouvertes.

## 1. Double preuve et parcours

La reprise traite d'abord la liaison, puis le transport. ANTSIA et PRO.GA conservent leurs
sessions indépendantes. Aucun SSO n'est supposé, aucun mot de passe n'est ajouté à ANTSIA,
aucun contact ni badge n'est utilisé pour fusionner les comptes.

- Dans **Mes boutiques → Mes offres**, ANTSIA montre la disponibilité réelle de sa
  configuration, les permissions à demander et un accord initialement décoché.
- La liaison nécessite une boutique portée par une page native active, avec administrateur
  vivant. La préparation d'un brouillon P07 reste disponible sans lui donner ce mandat.
- La préparation signée LINK lie réseau, personne, boutique, session et incarnation à un
  défi PKCE S256 de cinq minutes. Le vérificateur reste sur le serveur ANTSIA.
- PRO.GA demande sa connexion réelle et un choix explicite de structure. Sa liste est
  filtrée sur les droits effectifs ; une liste candidate tronquée est annoncée.
- L'accord PRO.GA donne un code opaque à usage unique. La confirmation COMMAND relit la
  session PRO.GA, son sujet, sa validité, le tenant, la structure et les tâches consenties.
- ANTSIA relit sa session, sa page, son mandat et son incarnation avant/après l'échange.
  Une réponse tardive ne peut pas ressusciter une tentative annulée ou une autre session.
- Les octets de confirmation sont persistés avant envoi. La reprise garde corps et
  identifiant, avec un nonce et une signature frais. PRO.GA persiste la réponse exacte.

Le retour de connexion PRO.GA n'accepte que la nouvelle destination commerce fermée,
en plus du retour de site historique. Le callback ANTSIA refuse les paramètres répétés
ou hors grammaire, ne suit aucun retour libre, retire les preuves de la barre d'adresse
et est non indexable avec `no-referrer`.

Les surfaces reprennent la charte de chaque produit. ANTSIA conserve fond blanc/cartes
beige et le sombre existant. Le parcours commerce PRO.GA porte ses textes FR/EN sans
migration globale de son authentification ni de son interface.

## 2. Révocation, droits et données personnelles

Le lien local ne remplace ni le mandat PRO.GA ni les permissions de page ANTSIA. Ses
lectures recroisent le consentant vivant, sa page, son administration et la configuration.
Les opérations sensibles futures doivent à nouveau relire le mandat à destination.

La désactivation locale annule aussi une tentative sans lien actif et invalide ses retours
tardifs. Elle ne prétend pas appeler `link.revoke`, réservé par P06. Retirer une boutique
révoque son lien ; une demande d'effacement révoque les liaisons par tranches bornées,
avant suppression des preuves. L'annulation de l'effacement ne réactive pas les accords.

Cinq tables ANTSIA sont raccordées au schéma et à l'inventaire : sujets opaques par
personne/réseau, référence stable de boutique, liens, défis et commandes de liaison.
Leurs exportations utilisent des projections fermées : consentement, permissions et état
pour leur auteur ; aucun code, PKCE, corps privé, identifiant/empreinte de session, URL
d'autorisation ou jeton d'incarnation. Les corps privés sont expurgés à la résolution,
à la révocation ou à l'expiration du défi.

PRO.GA ajoute métadonnées de source par environnement, défis, liaisons, reçus de commandes
et nonces. Ses clés restent désignées par référence d'environnement serveur, sans valeur
secrète en table. Les sessions fortes du parcours commerce sont relues explicitement ;
la règle globale de connexion PRO.GA n'est pas affaiblie.

Les cinq types de références et les dix scopes machine P06 sont enregistrés. Le nouveau
module pur LINK vit hors du dossier jumelé P06 : son manifeste et ses fixtures restent
inchangés. Aucun client Convex croisé ni import de base externe n'est ajouté.

## 3. Transport et réception

La fondation d'intégration PRO.GA est réutilisée pour les états, baux, reprises, backoff,
lettres mortes et reçus. Le profil ANTSIA conserve ses propres octets et sa propre signature ;
l'enveloppe fédérée historique PRO.GA n'est pas envoyée brute à l'inbox ANTSIA.

Le raccord est explicite : `emitCommerceTransportEvent` utilise `emitProEvent` avec son
option serveur `commerceTransport`. L'événement métier et `commerceOutbox.enqueue` sont
engagés dans la même transaction, reliés par `businessOutboxId`. Le profil, les octets
canoniques, le digest, l'environnement et l'émetteur sont figés. Les anciens producteurs
sans charge contractuelle restent historiques : aucune seconde émission ni copie brute
de leurs données n'est ajoutée.

`commerceDispatch.dispatchDestination` traite une seule livraison par action, sous un bail
tenant/destination/profil. La prise de bail et l'échec rejouable programment leur réveil
dans la même transaction : une interruption avant ou après le reçu doit permettre la
reprise avec les mêmes octets. L'ACK recontrôle révision de configuration, incarnation,
événement et empreinte. Un reçu rejeté mène en lettre morte, sans faux statut appliqué.
Le balayage de récupération utilise des pages de 25 destinations, sans bail global.

Deux défauts historiques signalés par P06 sont corrigés dans ce raccord : le `businessId`
de l'enveloppe utilise sa forme canonique minuscule ; archiver une offre jamais publiée
ne produit pas un événement externe de version zéro et n'invente pas une révision un.

L'adaptateur HTTP signe **les octets persistés** selon FEDERATION-INBOX-V1, sans composant
tenant ni profil HMAC machine PRO.GA. Origine configurée, environnement, délai, taille de
réponse et absence de redirection sont contrôlés. Un HTTP 200/202 ne suffit pas : événement,
digest et état d'application doivent être corrélés.

| Preuve reçue | Signification |
|---|---|
| `received` | Réception technique, application non prouvée |
| `applied` | Le handler déclaré a appliqué cet événement |
| `rejected` | Lettre morte ou refus métier ; aucune application revendiquée |

Les champs historiques `outcome` et `status` restent présents dans la réponse d'ANTSIA.
P08 ajoute `eventId`, `bodySha256`, `applicationStatus`. Les statuts `dead_letter` et
`discarded` ne deviennent jamais `applied`.

PUBLIC réel passe son parseur canonique **avant un nouveau reçu**. Son handler catalogue
reste P09 : un événement PUBLIC valide reçu peut donc finir `unsupported_contract`.
Les anciens producteurs à charge plate ne constituent pas des producteurs PUBLIC P09.

Le contrat de recette est séparé : `PRO-COMMERCE-TRANSPORT-TEST-V1`, charge fermée
`transport.probe`, aucune donnée personnelle ni catalogue. ANTSIA l'applique seulement en
sandbox, avec flag exact et émetteur autorisé ; il écrit une preuve dans
`federationCommerceProbes`. Il est refusé en production même avec le flag activé.
La branche PA9C d'expurgation des événements personnels reste intacte.

## 4. Configuration et activation

Aucune configuration ni clé réelle n'est créée pendant cette reprise. Les fonctions de
configuration sont des points internes pour le propriétaire, pas des auto-attributions.

ANTSIA attend les variables serveur suivantes, sans modification de fichier `.env` :

- `ANTSIA_COMMERCE_ENVIRONMENT`, `ANTSIA_COMMERCE_SOURCE` ;
- `ANTSIA_COMMERCE_PRO_HTTP_ORIGIN` et `ANTSIA_COMMERCE_PRO_APP_ORIGIN`, distinctes ;
- `ANTSIA_COMMERCE_ORIGIN`, `ANTSIA_COMMERCE_KEY_ID`, `ANTSIA_COMMERCE_SIGNING_KEY` ;
- en production, une activation explicite supplémentaire `ANTSIA_COMMERCE_PRODUCTION_ENABLED` ;
- pour la seule recette entrante : `FEDERATION_ENVIRONMENT=sandbox` et
  `ANTSIA_COMMERCE_TRANSPORT_TEST_ENABLED=true`, plus le registre d'émetteur autorisé.

PRO.GA doit déclarer explicitement son environnement commerce et les métadonnées de source,
retours autorisés, origine applicative, scopes et références de clés. PUBLIC et COMMAND
utilisent des clés distinctes : le namespace `PRO_COMMERCE_PUBLIC_` est réservé au transport
sortant et refusé par la configuration et la lecture des clés privées LINK/COMMAND. Les
collisions de références sont refusées dans les deux sens. Les noms/configurations du transport sortant sont précisés
dans la [passation PRO.GA](../../../../../PRO_GA/docs/19_LIAISON_TRANSPORT_ANTSIA.md) :
`PRO_COMMERCE_ENVIRONMENT`, références `PRO_COMMERCE_PUBLIC_*_ORIGIN` et
`PRO_COMMERCE_PUBLIC_*_KEY`, configurations internes source/destination. L'absence
d'environnement explicite ou sa divergence ferme la destination ; il n'est pas inféré
du corps entrant. Aucun exemple ne contient de secret.

La mutation de recette `commerceRecipe.probe` exige sandbox, le flag
`PRO_COMMERCE_TRANSPORT_RECIPE_ENABLED` et une confirmation hors production. Elle emprunte
la même émission transactionnelle et le même worker, sans appeler directement l'adaptateur.
Elle n'est pas exécutée. Le nettoyage borné `commerceRetention.purgeExpiredArtifacts` traite
les défis/reçus expirés et les nonces, sans supprimer lien, journal ou outbox. Les cadences
de récupération et de rétention sont écrites dans les crons PRO.GA ; leur exécution par
un déploiement n'est pas constatée ici.

Sans configuration complète, les opérations sont indisponibles et ne fabriquent aucun
succès. La politique des vitrines P07 reste fermée par défaut ; ni publication, ni catalogue,
ni achat, ni paiement n'est activé par une liaison réussie.

## 5. Sources principales

| Produit / responsabilité | Sources |
|---|---|
| Contrat LINK pur | `packages/social-domain/src/commerce-link.ts` et copie PRO.GA `packages/pro-domain/src/commerce-link.ts` ; sous-export PRO et tests dédiés |
| Liaison ANTSIA | `convex/modules/shops/commerceLink*`, schéma, quotas, politiques/export/effacement et indications de l'éditeur P07 |
| Parcours ANTSIA | `components/shops/shop-commerce-link.tsx`, `shop-link-callback-screen.tsx`, route membre de retour, routes centralisées et textes FR/EN |
| Réception ANTSIA | `federation/commerceTransport{,Tables}.ts`, raccords ciblés inbox/HTTP/dispatcher/replay et registre de protocole |
| Liaison PRO.GA | `integrations/commerce{Commands,Links,Session,Config,Crypto,Validators}.ts`, tables, frontière `_deps` et deux routes HTTP |
| Transport PRO.GA | `integrations/commerce{Outbox,Dispatch,TransportConfig,PublicTransport,Recipe,Retention}.ts`, fondation d'outbox, `lib/pro/outbox.ts`, crons et correction ciblée d'archivage |
| Parcours PRO.GA | page et écran `commerce/autoriser`, dictionnaires FR/EN, routes/continuation, verrou d'autorisation ; registres références/scopes |

Les cinq fichiers du pont de session, les surfaces DIASPORALE et les autres lots restent
dans leur périmètre. Les raccords PA9C, dont l'expurgation des événements personnels,
sont conservés. Aucun worktree ni changement de branche n'est réalisé.

## 6. Tests, limites et suite

Tests écrits uniquement : parseurs LINK et registres, double preuve et relecture des sessions,
choix/mandat/consentement, expiration et rejeu, idempotence, retours malveillants, réponse
tardive, export/effacement, réception canonique, recette fermée en production et états de reçu.
Les tests d'adaptateur et de worker accompagnent le raccord sortant : corruption du corps
avant bail, reprise de bail, corrélation du reçu et de la révision de configuration,
rejet distant vers la file d'échec, séparation des clés/environnements et rétention bornée.
Ces cas sont écrits, sans résultat d'exécution.

**Commandes de vérification exécutées : aucune.** Aucun codegen, test, typage, lint, build,
navigateur, appareil, relance de serveur ou commande Convex. Aucun commit, push ou déploiement.
Les nouvelles références API attendent la génération normale ; les fichiers générés ne
sont pas édités à la main.

La preuve d'acceptation P08 reste ouverte : génération et contrôles coordonnés sur source
stable, configuration propriétaire locale/sandbox, connexion réelle aux deux produits,
choix de structure et accord, révocation, événement de recette émis par le chemin réel,
corps/reçu corrélés et reprise après interruption. Ces essais sont volontairement différés
par la demande humaine. Aucun transport réel ou parcours réussi n'est revendiqué.

Retour arrière : fermer les configurations et arrêter les nouvelles liaisons/envois ;
conserver reçus et corps d'intentions encore indécises pour la reprise idempotente.
Ne pas supprimer une obligation commerciale pour annuler l'interface. P09 et les commandes
de vente restent hors de ce lot et ne sont pas enchaînés.
