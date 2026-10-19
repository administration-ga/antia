# ADR-0016 — Producteur administratif et transfert privé du consentement

Date : 18 octobre 2026.
Statut : proposé ; code local PA9D, vérifications différées.

## Contexte

Le consommateur PA9A/B/C ne doit lire aucune base administrative. L'audience
publique historique du socle désigne ses membres connectés ; elle ne constitue
pas un geste de diffusion vers ANTSIA. Le profil administratif historiquement
créé d'office ne prouve pas davantage un choix de nom ou de présence externe.

## Décision

Le socle possède un producteur vertical et une outbox transactionnelle. Les
pages actives d'administrations vérifiées sont projetées ; une publication
exige un booléen de diffusion explicite, faux pour l'historique et les notes
internes. Des références opaques par environnement et des révisions monotones
ordonnent les événements. Le retrait commun s'applique aussi à la modération.

Le transport utilise les clés/configurations du propriétaire et des baux CAS,
une file bornée à 150, un délai HTTP de 15 secondes et dix tentatives. Il lit
l'accusé métier : seul applied vaut application, et les enfants attendent le
reçu appliqué de leur page. Un ancien travailleur ne conclut pas un nouveau bail.

Le consentement ANTSIA est transféré par un code opaque à usage unique, valable
dix minutes, dans un fragment de navigateur. Le serveur administratif résout le
code avec son sujet IDN proprement corrélé. La réponse HMAC est liée à la requête
exacte et séparée du protocole d'événements. L'écriture finale rejuge session,
identité, poste et configuration ; elle ne reçoit aucun sujet ou nonce du client.

Le sujet et le nonce restent dans la table personnelle, jamais en payload de job
ni en DLQ. Les reprises reconstruisent le corps transitoire. Le retrait appliqué
expurge les champs privés ; l'indisponibilité distante ne les conserve pas plus
de sept jours, et l'effacement effectif du compte les purge sans délai additionnel.

## Conséquences

Deux contrats sont déclarés côté socle. La copie pure est un sous-chemin autonome
pour éviter les imports Node du barrel fédération historique. Aucun secret ni
base externe n'est partagé. Les identités et adhésions ANTSIA restent préexistantes.

Le producteur et les interfaces sont ajoutés aux sources, sans contrôles exécutés.
Configuration, génération Convex, PR, rapprochement des branches distantes et
recette croisée restent distincts. Un retrait non confirmé avant purge n'est
jamais déclaré livré ; les délais du réexamen borné des fonctions dépendent du volume.

Rapport : [PA9D](../18_PRODUCTEUR_ET_OUTBOX_ADMINISTRATION_PA9D.md).
