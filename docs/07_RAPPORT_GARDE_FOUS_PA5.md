# PA5 — Modération, débit, données personnelles, notifications et fédération

Date : 16 octobre 2026. État : implémentation locale vérifiée (code 0). Aucune publication en production.

## Périmètre et portes

Le lot complète le moteur Convex existant et les contrats purs de `@antsia/social-domain`. Les applications consomment les mêmes sources ; aucun backend parallèle ni client Convex inter-produit n'est ajouté. Les outils complets de console restent PA7 et les projections métier de fédération restent PA9 / PD3 / PD5.

Les décisions passent par la session Better Auth vivante, l'adhésion et la compétence courante. Les personnes suspendues sont dirigées vers la page `/mes-donnees`, hors onboarding et coque membre ; la projection de la racine interprète aussi l’échéance avant son cron. Les droits personnels — export, effacement, préférences et recours — restent accessibles par des portes `personQuery` / `personMutation` sans rouvrir les contenus sociaux à une personne suspendue.

## Modération

`convex/modules/moderation` accepte neuf cibles typées : publication, commentaire, message de groupe, événement, page, personne, direct, story et album. Une annonce demeure une publication. Aucune cible « offre » n'est inventée : le dépôt ne possède pas de table autonome correspondante.

Les signalements lecteurs relisent l'audience réelle, refusent l'auto-signalement et se dédoublonnent. Leur masque est appliqué au lien direct, aux listes, recherches et projections raccordées. Les façades historiques `reportPost` / `reportComment` et `contentReports` restent reliées aux dossiers PA5 ; les rapports ne recopient pas le corps du contenu. Une page institutionnelle sans auteur personnel reste signalable et retirable, sans attribuer arbitrairement une faute à un administrateur.

Les équipes appartiennent à un réseau et peuvent être spécialisées par surface. Une habilitation retirée ferme la décision suivante ; le rôle global de modérateur ne contourne pas une équipe affectée. Les motifs sont bornés et les décisions écrivent dans le journal unique `engineAudit`.

Les sanctions sont distinctes : avertissement, retrait, sourdine, suspension et exclusion. Un avertissement ou une sourdine n'entraîne pas automatiquement un retrait. Les durées temporaires sont contrôlées ; l'exclusion est permanente jusqu'à un recours favorable. La suspension agit à la racine, vaut partout et conserve le statut antérieur. Les lectures interprètent son échéance avant le cron ; le passage d'expiration restaure l'état et l'annuaire sans annuler une autre sanction encore vivante. Les retraits rétablissables sont coordonnés avec les agrégats et les autres décisions visant la même cible. Une restauration ne redémarre jamais une salle ni une capture.

L'auteur peut consulter ses décisions et sanctions et déposer un recours même suspendu. La chaîne suit le niveau de décision : équipe, réseau, plateforme ; le réexamen exige un décideur distinct. Les avis de décision sont des avis système, sans acteur ni contenu, avec une admission personnelle étroite ; la cloche générale du réseau ne devient pas accessible aux suspendus.

La relecture est orthogonale aux états métier dans `moderationContentStates`. Créations et éditions des surfaces raccordées passent par les politiques du réseau, mots normalisés, plafond de liens et fréquence bornée. Le contenu `pending_review` reste fermé au public jusqu'au verdict ; les accès de relecture conservent les gardes d'audience. Une décision de prépublication produit un dossier personnel, un motif et un avis, sans faux déclarant ; un refus peut être contesté. L'auteur ne s'approuve pas lui-même.

Le rapport de transparence est agrégé par période de création des dossiers. Il ne contient ni nom ni texte. Sa projection exige au moins cinq dossiers et cinq auteurs distincts ; les petites sous-catégories sont supprimées. Le calcul inter-lots emploie une borne inférieure prudente du nombre d'auteurs, sans transmettre ni stocker leur liste.

Sources : [modération](../convex/modules/moderation/cases.ts), [garde commune](../convex/modules/moderation/policy.ts), [cibles](../convex/modules/moderation/targets.ts), [expiration et transparence](../convex/modules/moderation/maintenance.ts).

## Limites de débit

Les constructeurs des mutations sociales imposent une admission générale, complétée par les seaux de chaque geste. Les actions publiques avec effets passent par une mutation d'admission avant stockage, jeton ou appel externe. Les clés viennent de la session, jamais du client. Les URL de dépôt possèdent aussi leur quota ; les garde-fous de fichiers PA3 restent actifs.

Des seaux renforcés limitent les membres déclarés sans badge de confiance, à partir des liens courants relus côté serveur. Changer de réseau ou de cible ne remet pas le budget personnel à zéro. Un refus porte `rateLimited` et `retryAfterMs`. Les gestes de sortie et les remèdes personnels ont leurs portes et budgets propres.

Le cliquet AST `rate-limited-writes` vérifie les constructeurs, imports et admissions des écritures publiques ; il ne se contente pas de rechercher un mot dans un commentaire. Les seuls cas de lecture sans effet et admissions HTTP de système sont explicitement classés.

Sources : [registre et consommation](../convex/lib/rateLimit.ts), [constructeurs](../convex/lib/functions.ts), [admission d'action](../convex/lib/actionAccess.ts), [cliquet](../tests/ratchets/rate-limited-writes.test.ts).

## Export et effacement

La demande d'effacement exige la confirmation littérale prévue par l'API et une grâce de trente jours. Elle est répétable sans créer de second travail et annulable seulement avant l'échéance. À l'échéance ou pendant le traitement, la garde d'identité ferme les écritures de l'ancien sujet.

L'inventaire des 99 tables est dérivé du schéma réel et chaque table doit être classée. La progression persistée découvre les documents propres et dépendances par lots, puis les efface ou anonymise les références partagées. Les blobs référencés et les agrégats sont traités avec les documents. Les copies transférées et leurs aperçus dénormalisés sont expurgés ; les références collectives utilisent une identité anonyme commune. Les citations d’originaux effacés sont marquées « compte supprimé », sans identifiant de l’original, ancien nom ni extrait.

Les vérifications Better Auth sont parcourues avant révocation des sessions pour corréler les transferts à usage unique sans stocker leur token dans le travail. Contacts et sujets IDN sont actualisés à la reprise. Sessions, comptes fournisseurs, deuxième facteur, jetons/consentements/applications OAuth, codes associés et clés de débit personnelles sont purgés. Les références temporaires du travail disparaissent avant un reçu interne minimal, sans personne ni contact.

L'export est personnel, paginé et temporaire ; son droit est relu à chaque page. Une référence ou une mention ne signifie pas propriété. Les rapports exposent son dépôt ou sa décision, sans identité du déclarant ni note étrangère ; les fils ne livrent aucun aperçu. Les documents propres et préférences passent par une projection contrôlée, avec retrait récursif des secrets. L’export des messages transférés se limite aux métadonnées : il ne rouvre pas un original retiré ou devenu inaccessible. Les configurations opérateur, contrats et documents étrangers ne sont pas ouverts par un rôle ancien.

Cette livraison ne déclenche aucun effacement de donnée réelle. Les tests utilisent exclusivement des enregistrements fictifs. Le reçu de fin est local au moteur ; aucun événement sortant V2 vers le socle n'est prétendu livré, puisque les contrats métier restent fermés.

Sources : [inventaire et projections](../convex/modules/people/dataInventory.ts), [classification](../convex/modules/people/dataPolicies.ts), [chaîne d'effacement](../convex/modules/people/erasure.ts), [garde de session](../convex/lib/session.ts).

## Notifications et transports

La cloche conserve son écrivain unique et ses clés de dédoublonnage. Les préférences couvrent social, messages, appels, réseau, modération et fichiers ; consentements, état de la personne, réseau, audience, blocage et session de l'appareil sont relus avant livraison. Les souscriptions sont personnelles, révocables, limitées et liées à une application autorisée. Leurs coordonnées de transport et secrets ne sortent pas dans la liste des appareils.

Le plafond hebdomadaire vaut trente-cinq réservations par défaut, réglable jusqu'à cent. La semaine est fixe en UTC. Une réservation borne le fanout vers les appareils ; baux, dédoublonnage, tentatives et reprises sont persistés. Une révocation ou perte de droit pendant l'attente annule le transport à son prochain contrôle. Une souscription invalide est désactivée.

La charge sortante est fermée : version, réseau, référence, compteur, langue et URL d'entrée de l'application. Les phrases ne contiennent qu'un nombre d'avis ; aucun corps de publication, message, identité d'appelant ou aperçu ne part vers le fournisseur. `notification-payload-content` et les validateurs de transport contrôlent cette règle.

Les adaptateurs Web Push/VAPID, Expo, FCM et APNs utilisent la configuration du propriétaire. Les adresses de fournisseur doivent être HTTPS ; les origines Web Push sont autorisées explicitement. Une absence de configuration produit un état indisponible, pas un faux succès. Un ticket Expo accepté est consulté comme reçu, sans nouvelle émission du même push. L'état `sent` est une admission technique au transport, pas une preuve de réception sur un appareil.

Le digest e-mail est opt-in par réseau, sans contenu social ; il relit une adresse actuellement vérifiée dans Better Auth et sa permission avant admission par Resend. Sa réservation est périodique et dédoublonnée. La rétention fonctionne activement : cent quatre-vingts jours après lecture, trois cent soixante-cinq jours depuis création pour les avis non lus, trente jours pour les travaux et reçus de livraison.

Sources : [contrat de livraison](../packages/social-domain/src/notificationDelivery.ts), [préférences et consentements](../convex/modules/notifications/policy.ts), [file](../convex/modules/notifications/deliveries.ts), [transports](../convex/modules/notifications/transports.ts), [digest](../convex/modules/notifications/digest.ts), [rétention](../convex/modules/notifications/retention.ts).

Protocoles de transport vérifiés contre les sources primaires : [Web Push](https://github.com/web-push-libs/web-push), [Expo](https://docs.expo.dev/push-notifications/sending-notifications/), [FCM HTTP v1](https://firebase.google.com/docs/cloud-messaging/send/v1-api), [APNs](https://developer.apple.com/documentation/usernotifications/establishing-a-token-based-connection-to-apns).

## Fédération entrante

`POST /federation/inbox` reçoit `FEDERATION-INBOX-V1`. Les en-têtes désignent émetteur, environnement, horodatage Unix en secondes et signature. Le corps UTF-8 exact, borné à 128 Kio, est authentifié par HMAC-SHA-256 sur `environnement + saut de ligne + horodatage + saut de ligne + corps`. La tolérance temporelle est de cinq minutes. La clé reste dans l'environnement ; la base ne garde que son nom autorisé, par émetteur/environnement.

L'admission vérifie le réseau, l'activation, les contrats autorisés et la révision courante de l'émetteur. La signature est rejugée dans la mutation après le passage HTTP pour fermer la course à la rotation ou désactivation. Le schéma de l'enveloppe et sa complexité sont bornés ; identifiants locaux et champs sensibles sont refusés.

Le reçu est idempotent par émetteur, environnement et identifiant d'événement. Un corps différent sous la même clé est un conflit. Les lettres mortes conservent uniquement les enveloppes authentifiées, avec accès opérateur. Le rejeu exige un administrateur de plateforme à identité forte vivante, un motif et la cohérence du reçu/digest ; il écrit sa trace et le journal du moteur.

Le registre des handlers métier est volontairement vide. Une enveloppe authentifiée et autorisée peut donc répondre 202 avec état `dead_letter` : cela prouve l'admission, pas l'application d'un reflet. Un rejeu reste `still_failing` tant que le contrat n'est pas branché. Aucune personne, adhésion, page ni projection distante n'est créée automatiquement ; la table de correspondance `mirrors` prépare les lots ultérieurs.

Sources : [protocole interne](../packages/social-domain/src/federationProtocol.ts), [HTTP](../convex/modules/federation/http.ts), [admission](../convex/modules/federation/inbox.ts), [rejeu](../convex/modules/federation/replay.ts).

## Passages planifiés

| Passage | Cadence | Effet |
|---|---|---|
| Expiration des sanctions | 5 minutes | Échéances et restauration bornées |
| Transparence | Quotidien, 04:10 UTC | Agrégation du jour UTC précédent |
| Livraison des avis | 30 secondes | Reprise des travaux et baux |
| Réservation des digests | Quotidien, 07:00 UTC | Choix réseau/personne et dédoublonnage |
| Rétention des notifications | Quotidien, 03:45 UTC | Purge active et continuation |
| Reprise des effacements | 15 minutes | Demandes échues et travaux interrompus |
| Expiration des reçus d'export | Quotidien, 04:30 UTC | Reçus expirés |

Le registre [crons](../convex/crons.ts) et `crons-contract` contrôlent branchement, identifiants ASCII uniques et cibles internes. Les dix cadences/arguments PA3 sont protégés ; les sept extensions PA5 sont décrites ci-dessus et leurs handlers sont testés.

## Vérification — preuves du 16/10/2026

`bun run verify` termine avec **code 0**, sur l’arbre partagé gelé : codegen sous Node 22.22.3, typages Convex/tests et dix espaces de travail, **6 223 tests réussis**, puis neuf lints sans erreur. Des avertissements lint restent présents (primitives/surfaces héritées et compatibilité du compilateur React avec RHF) ; le passage ne constitue pas une certification AA.

| Suite | Réussis |
|---|---:|
| Moteur Convex (92 fichiers) | 1 455 |
| Cliquets (22 fichiers) | 122 |
| Scripts | 24 |
| Domaine social / contrats / UI / API | 461 / 57 / 86 / 170 |
| Surfaces sociales | 2 987 |
| Applications ANTSIA / console | 23 / 10 |
| Domaine / surfaces / application DIASPORALE | 238 / 259 / 331 |
| **Total** | **6 223** |

- **R7** : cinq déclarants, masque du lien direct, retrait, sanction partout, avis neutre, recours et audit ; chaque sanction/échéance, équipe révoquée et relecture testées. La projection d’adhésion racine interprète l’expiration avant cron ; la porte suspendue conduit aux droits personnels.
- **R9** : demande/délai/annulation, export sans documents étrangers/secrets ni copie transférée d’un original ; fixture multi-tables et blobs, copies/aperçus, preuves IDN, vérifications OTP/OTT paginées, compte et sessions purgés. Les traces sans lien personnel d’autrui restent intactes. Les citations anonymes sont couvertes côté moteur, contrat et rendu.
- **R10** : admissions et dépassements, renforcement après échéance, mutation/action oubliée détectée par AST ; tous les cliquets verts.
- **Notifications** : consentement/catégorie/abonnement/session révoqués ou expirés avant émission, doublon/quota/bail/reçu/retry, transports indisponibles et rétention vérifiés avec doubles contrôlés. Les contrôles de formulaire sont rendus en tests, sans prompt navigateur automatique.
- **Fédération** : signature, environnement, temps, taille, clé, idempotence/conflit, DLQ et rejeu éprouvés dans le harnais HTTP. Sur le vrai backend local : `POST /federation/inbox` retourne **503 unavailable** quand la configuration est absente, sans effet métier.
- **Routes réellement servies** : Next 3030 rétabli (webpack, heap borné), `/mes-donnees` **HTTP 200**, `/notifications-worker` **HTTP 200**, `application/javascript`, `no-store`, `Service-Worker-Allowed: /`. Ce contrôle porte sur disponibilité/en-têtes, sans recette utilisateur authentifiée.
- **Recette navigateur** : l’outil refuse l’observation de l’onglet par sa politique d’accès. Aucun contournement ; aucune nouvelle preuve visuelle, de téléchargement réel ou de permission push n’est revendiquée.

Trace complète : `/tmp/antsia-pa5-verify-validated.log` ; serveur `/tmp/antsia-pa5-next.log`. Les tentatives antérieures ont exposé puis corrigé les fixtures de quota, sessions de push, projections d’export, contrats d’authentification, typage de pagination et attentes de phrases système ; elles ne remplacent pas le passage final.

Le contrôle commun comprend les compléments DIASPORALE gelés, dont sa graine et son bouton de désabonnement. Ils appartiennent à son chat et restent exclus du commit PA5. Sources PA5 enregistrées dans le commit local **`639d987`**, sur `codex/pa4-identite-session` ; aucun changement de branche pendant les écritures concurrentes.

Les tests de transport et d'effacement reposent sur le harnais local et des doubles contrôlés. Ils ne démontrent ni réception push sur un appareil, ni distribution e-mail, ni connexion à un système externe.

## Limites externes et suite

La purge traite les blobs rattachés aux documents et les fichiers admis attribués à la personne. Un dépôt brut abandonné avant admission ne possède pas d’attribution personnelle exploitable ; cette preuve ne prétend pas identifier de tels blobs.


- Les fournisseurs push, appareils et identifiants nécessaires ne sont pas configurés : recettes Web Push, Expo, FCM, APNs et boîte mail réelles restent ouvertes.
- La recette IDN sandbox de PA4 reste distincte ; les clients n'étaient pas créés/configurés lors de la confirmation du propriétaire.
- L'inbox n'applique aucun contrat métier. Reflets, retrait externe et notification de fin au socle demandent les lots suivants et une autorisation de livraison séparée.
- Aucune donnée réelle effacée ; aucun fichier d'environnement réel modifié ; aucun push, merge ou déploiement de production.

Décision : [ADR-0009](adr/0009-gardes-et-droits-personnels-pa5.md). Configuration documentée : [`.env.example`](../.env.example), noms seulement.
