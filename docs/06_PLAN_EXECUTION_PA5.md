# PA5 — Plan d’exécution et critères de vérification

Date : 16 octobre 2026. Sources réelles du dépôt, état initial `8d4754d`.

## Découpage

1. Modération : conserver les façades post/commentaire existantes ; signalements polymorphes, équipes par réseau/périmètre, décisions motivées, sanctions graduées et échéances, recours personnel même suspendu, relecture et termes/spam, audit et transparence agrégée. Les gardes de lecture doivent couvrir le lien direct ; une suspension racine vaut partout.
2. Débit : quota commun obligatoire dans les constructeurs d’écriture, quotas spécifiques conservés, renforcement des comptes légers, actions admises par une mutation interne. Cliquet AST couvrant aussi les helpers et les nouveaux exports. Les lectures seules sont explicitement distinguées.
3. Données : manifeste dérivé du schéma et dispositions explicites contrôlées ; export borné de ses données, demande confirmée/délai/annulation, effacement par étapes reprises, blobs et références/snapshots anonymisés, sessions révoquées avant purge sociale, compte retiré après ses dépendances. Aucun effacement réel de comptes existants pour la recette.
4. Notifications : conserver l’écrivain unique ; catégories/préférences/consentements, abonnements non réattribuables, livraisons idempotentes bornées/reprises, plafond hebdomadaire, rétention active 180/365 jours et digest réseau. Payloads génériques sans contenu social. Web VAPID et adaptateurs Expo/FCM/APNs : configuration externe, disponibilité explicite, tests de transport simulés.
5. Fédération : émetteurs et clés par environnement, HTTP borné/HMAC temporel, reçus idempotents et empreinte, lettres mortes/rejeu audité, registre de contrats fermé et miroirs ; aucun contrat métier ni import de personnes branché avant PA9/PD3/PD5.
6. Intégration : schéma, tâches, HTTP, contrats/types/i18n et surfaces personnelles utiles ; `codegen`, tests ciblés puis `verify`, recette sur le backend de développement lorsque possible, rapport et mémoire.

## Contraintes communes

- Une personne/un handle, réseau explicite, refus indistinct, suspension racine globale.
- Aucun accès à une base externe ni import de son schéma/API générée.
- Pas de modification d’environnement réel, de production ni de suppression de données réelles.
- Arbre partagé : les sous-tâches ont des fichiers attribués ; aucune branche changée ni commit global pendant une écriture concurrente.
- Un seul Next, tests sérialisés et concurrence bornée sur le Mac 16 Go ; pas de build ni téléchargement lourd sous la pression disque actuelle.

## Preuves de sortie

- R7 : cinq déclarants, masque y compris accès direct, décision/retrait, sanction globale, avis personnel, recours et audit.
- R9 : fixture multi-tables/blobs effacée, références conservées anonymes et aucune donnée personnelle restante ; nouvelle table non classée refusée par test.
- R10 : nouvelle écriture non gardée/non limitée détectée par les cliquets ; dépassement de quota refusé.
- Notifications : frontières de rétention, consentement révoqué avant envoi, doublons, plafond, transport indisponible ou défaillant, payload sans contenu.
- Fédération : mauvaise signature/clé/environnement/horodatage, corps trop grand, conflit de même ID, doublon, lettre morte et rejeu traçable.
- Les tests locaux n’affirment aucune livraison à un appareil réel ni échange avec une production distante.
