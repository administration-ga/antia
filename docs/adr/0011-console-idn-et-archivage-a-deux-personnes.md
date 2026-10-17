# ADR-0011 : Console IDN et archivage à deux personnes

- **Statut** : Accepté
- **Date** : 2026-10-17
- **Portée** : PA7 ; complète ADR-0008 et ADR-0009.

## Contexte

Le squelette de console et les mutations opérateur existaient avant PA7. Un rôle
vivant seul ne prouve pas une connexion IDN de garantie suffisante. L'archivage
d'un réseau avait une seule validation. La console doit réutiliser les décisions
du moteur, avec des projections et retours adaptés aux opérateurs.

## Décision

1. Le callback IDN scelle sa nouvelle session Better Auth après lecture du profil
   validé. La preuve est corrélée au compte, au sujet IDN et à la session vivante.
   Les gardes relisent rôle, lien, garantie et expiration ; un OTP avec un ancien
   lien IDN demeure insuffisant. Aucun profil ni adhésion n'est créé par ce callback.
2. La projection d'autorité est self-scoped. Un accès idempotent par session doit
   être inscrit avant toute autre lecture ou écriture opérateur. Un identifiant
   d'admission opaque permet de remonter cette porte lors d'un changement de session.
3. Les administrateurs configurent réseaux, pages institutionnelles et fédération.
   Les opérateurs interviennent dans les équipes, recours et incidents et disposent
   des lectures. Ces règles sont appliquées côté serveur, en plus des contrôles UI.
4. L'archivage exige une demande motivée de quinze minutes et l'approbation d'un
   autre administrateur. La transaction relit les deux autorités, le réseau, son
   historique et l'état de la demande, puis la consomme. La racine ne s'archive pas.
   Le dédoublonnage appartient à la session courante ; une reconnexion peut déposer
   une nouvelle demande. L'identifiant du demandeur reste une référence personnelle
   typée dans le dossier, sans copie de chaîne dans les détails de l'audit d'autrui.
5. Incidents et décisions réutilisent engineAudit. Les lettres mortes sont projetées
   sans corps signé ni empreinte de contenu. Les clés sont des références
   d'environnement : aucune valeur ne transite par la console.
6. Les comptages techniques sont matérialisés par génération, en tranches de cinquante
   lignes. Ils affichent leur date et leur calcul en cours, sans prétendre constituer
   une photographie transactionnelle de toutes les tables.
7. L'export contient douze périodes agrégées. Cohortes et sous-catégories, ainsi que
   leurs compléments, restent masqués sous le seuil de cinq. Aucun texte ni identité.
8. La rétention des preuves de session suit un cron quotidien, cent lignes par
   mutation. La garde refuse leur expiration immédiatement, indépendamment du cron.
   Les références personnelles des dossiers collectifs sont anonymisées par PA5.

## Conséquences

La console reste fermée sans session IDN forte et habilitation explicite. Les
clients sandbox et la première attribution de rôles réels restent au propriétaire.
Les tests de callbacks invoqués directement sont distincts d'une recette OIDC HTTP
et des critères visuels réels.

Les requêtes sont bornées et les écritures motivées. La limite d'une réponse
d'équipes est de cinq cents références de membres projetées ; au-delà, le refus
est explicite et une évolution vers la pagination devra être décidée.

## Références

- [PA7](../10_PLAN_EXECUTION_PA7.md).
- [Rapport PA7](../11_RAPPORT_CONSOLE_PA7.md).
- [Cahier, M-A14](../00_CAHIER_DES_CHARGES_ANTSIA.md).
- [ADR-0008](0008-preuves-serveur-et-revocation-immediate-des-sessions.md).
