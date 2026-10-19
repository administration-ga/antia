# PRO-COMMERCE-LINK-V1 — préparation volontaire de la liaison

18 octobre 2026, lot P08. Contrat de préparation **distinct** de COMMAND et de PUBLIC.
Il complète [PRO-COMMERCE-COMMAND-V1](PRO-COMMERCE-COMMAND-V1.md) sans réécrire les
jumeaux ni le manifeste P06. Implémentations jumelles :
`packages/social-domain/src/commerce-link.ts` et
`PRO_GA/packages/pro-domain/src/commerce-link.ts`.

## Séquence et autorités

1. Un membre ANTSIA, dans sa session vivante, administre une page native active qui porte
   sa boutique. Il choisit les permissions et accepte le texte versionné. Un brouillon
   sans page reste préparable ; il ne suffit pas à lier une activité commerciale.
2. ANTSIA crée un état opaque et un vérificateur PKCE S256, associés à cette session,
   personne, boutique, réseau et incarnation. Les références machine sont aléatoires ;
   aucune égalité de contact ni aucun badge ne lie les comptes.
3. Le serveur transmet la préparation signée à PRO.GA. Le navigateur ne reçoit que
   l'adresse d'autorisation corrélée et son expiration.
4. Dans sa session PRO.GA réellement vivante, la personne sélectionne explicitement une
   structure admissible et consent. PRO.GA relit ses tâches et produit un code à usage
   unique, lié au défi, à sa session et à cette structure.
5. Le retour ANTSIA échange ce code et le vérificateur via `link.confirm`. PRO.GA relit
   la session et le mandat au moment de cet échange ; ANTSIA relit sa propre session,
   la page, le mandat, la configuration et l'incarnation avant d'enregistrer le lien.

Le délai maximal est de cinq minutes. Une ancienne incarnation, une session remplacée,
un autre réseau ou un mandat retiré ne peut pas activer la liaison. Le navigateur ne
possède jamais le vérificateur ni les clés de signature. Les corps privés sont expurgés
à la résolution, à la révocation ou à l'expiration selon leur usage idempotent.

## Préparation HTTP

`POST /commerce/v1/link-challenges`, origine HTTP PRO.GA explicitement configurée.
Objet JSON canonique fermé, au plus 8 Kio :

| Champ | Règle |
|---|---|
| `contract`, `version` | `PRO-COMMERCE-LINK-V1`, `1` |
| `source`, `environment` | Identité machine et environnement issus de la configuration |
| `requestId` | Intention opaque stable, 8–200 caractères selon P06 |
| `state` | 32–128 caractères base64url, lié à la session ANTSIA |
| `codeChallenge`, `codeChallengeMethod` | S256 base64url de 43 caractères, `S256` |
| `subjectRef` | `antsia:sub:…`, sujet vendeur stable par personne/réseau |
| `antsiaShopRef` | `antsia:shop:…`, référence stable par boutique |
| `requestedPermissions` | Ensemble P06 trié, non vide, sans doublon |
| `redirectUri` | URI complète autorisée par PRO.GA, chemin de retour fixé ci-dessous |
| `issuedAt`, `expiresAt` | Instants millisecondes ; durée positive ≤ 300 000 ms |
| `consentTextVersion` | `2026-10-18` pour cette version |

La préparation reprend `commerceCommandSigningInput` avec l'opération `link.confirm`,
son scope et une clé propre source/environnement. Le label de corps LINK empêche de la
confondre avec une demande COMMAND. Aucun composant tenant n'est signé ou cru depuis
le navigateur ; PRO.GA résout le tenant à partir du choix de structure autorisé.

La réponse canonique est exactement : `contract`, `version`, `requestId`, `state`,
`authorizationUrl`, `expiresAt`. Identifiant, état et expiration doivent être ceux de
la préparation. L'adresse est sur l'origine applicative PRO.GA configurée, chemin
`/commerce/autoriser`, avec le seul paramètre `defi=requestId`.

Les deux origines PRO.GA sont distinctes : l'origine HTTP Convex reçoit les échanges
serveur ; l'origine applicative reçoit la personne. Aucun suivi de redirection HTTP
n'est autorisé pendant les échanges signés. HTTPS est requis, sauf HTTP de boucle
locale en sandbox. Identifiants d'URL, fragment et origine arbitraire sont refusés.

## Retour et confirmation

L'URI de retour fixe est `/mes-boutiques/liaison/retour` sur l'origine ANTSIA autorisée,
sans requête ni fragment dans la configuration. PRO.GA y ajoute seulement `etat` et
`code`. Les paramètres répétés ou hors grammaire sont refusés ; ANTSIA retire les
preuves de la barre d'adresse après leur lecture. La page est non indexable et utilise
`no-referrer`. Aucune URL de retour libre n'est conservée par la connexion PRO.GA.

La confirmation reste la commande P06 `link.confirm`, envoyée à
`POST /commerce/v1/commands`. ANTSIA persiste ses octets exacts et son identifiant avant
l'appel. Un réessai garde ces octets et reçoit une signature/nonce frais. PRO.GA conserve
la réponse exacte avec son empreinte : même clé et même corps donnent le même résultat,
un autre corps donne un conflit. `request.status` reste limité à la même source et au
même sujet. Les autres commandes de vente ne sont pas implémentées par P08.

## Mandats, révocation et configuration

La base de mandat PRO.GA est `site.publish`, complétée par les tâches effectives de
chaque permission demandée : `offers.edit`, `offers.publish`,
`recruiting.openings.manage`, `recruiting.applications.manage`,
`agenda.appointments.manage`, `crm.leads.manage`, `quotes.send`. Un rôle affiché,
une affiliation candidate ou la seule signature d'une machine ne suffit pas.

La désactivation dans ANTSIA coupe le lien local et invalide les tentatives en cours.
Elle ne prétend pas exécuter `link.revoke`, réservé par P06. Les actions sensibles futures
devront relire le mandat à destination ; un état local `active` ne confère aucun droit.
L'effacement du consentant révoque puis supprime les preuves personnelles, sans exporter
PKCE, codes, empreintes de session, corps privés ou jetons d'incarnation.

Le propriétaire fournit les clés et les métadonnées serveur selon les procédures du
produit. Aucun secret n'est placé dans les documents ou le navigateur ; aucune valeur
de clé n'est stockée en clair dans une table. Le namespace de clés `PRO_COMMERCE_PUBLIC_`
est réservé au transport sortant ; les clés privées LINK/COMMAND le refusent et les
configurations des deux profils refusent les collisions de références. Sans configuration complète, l'interface
annonce l'indisponibilité. P08 ne modifie ni les environnements, ni les politiques de
publication, ni un compte, une structure, un catalogue ou un paiement.

**Preuves :** sources et tests dédiés écrits. Aucune génération, vérification, recette
locale/sandbox ou publication exécutée pendant cette reprise, à la demande du propriétaire.
