# ADR-0009 : Gardes et droits personnels PA5

- **Statut** : Accepté
- **Date** : 2026-10-16
- **Portée** : PA5 ; complète ADR-0002, ADR-0003 et ADR-0008. La validation commune de l'implémentation est documentée séparément.

## Contexte

La garde d'adhésion et la révocation des sessions ne suffisent pas à modérer toutes les surfaces, limiter les écritures, respecter une demande d'effacement ou borner les livraisons externes. Une personne suspendue doit pouvoir contester une décision et exercer ses droits personnels. Une mention ou un rôle passé ne donne pas accès au document d'un tiers. Une admission chez un fournisseur ou dans une inbox ne prouve pas une livraison métier.

## Décision

1. La modération applique des références typées et un état orthogonal aux états métier. Les équipes sont bornées par réseau/surface et leur compétence est relue au moment de l'acte. Les façades historiques restent reliées aux nouveaux dossiers ; aucun corps de contenu n'est copié dans le rapport.
2. Les sanctions sont distinctes et temporisées. La suspension racine vaut partout, conserve le statut antérieur et se juge sur les sanctions encore vivantes. Un recours ne rétablit pas un contenu encore retiré par une autre décision. Toute décision motivée conserve son audit transactionnel unique.
3. Les recours, décisions personnelles et droits sur les données utilisent des portes self-scoped. Ils restent accessibles au suspendu sans élargir la cloche ou l'audience sociale. Une prépublication rejetée produit un dossier contestable sans inventer de déclarant.
4. L'admission de débit appartient aux constructeurs et aux mutations d'admission des actions ; les surfaces ajoutent leur propre seau. Les budgets sont personnels, et renforcés pour les membres déclarés sans badge de confiance. Les URL de dépôt restent soumises à cette admission et aux gardes de fichiers.
5. L'inventaire des données dérive du schéma et impose une classification explicite. L'effacement suit une progression persistée, révocable pendant la grâce et fermée aux écritures de l'ancien sujet après échéance. Données propres, dépendances, blobs, copies, aperçus, preuves et composant d'authentification sont traités avant le reçu minimal de fin. Les références collectives restantes utilisent une identité anonyme commune.
6. L'export distingue propriété et référence. Relations, rapports et fils ont des projections dédiées ; une mention ou une habilitation administrative ne révèle aucun corps étranger. Les secrets sont retirés récursivement et chaque page relit sa permission.
7. La notification sortante contient seulement référence, compteur, langue et URL d'entrée. Consentements, audience, blocage, session d'appareil et plafond hebdomadaire sont relus avant le transport. Files, baux, tentatives et rétention sont actifs. L'admission technique du fournisseur demeure distincte de la réception réelle.
8. La fédération authentifie les octets exacts et leur environnement avant effet, puis rejoue le contrôle avec l'émetteur courant dans la transaction. Reçus, digest, lettres mortes et rejeu audité sont en place ; le registre métier reste fermé jusqu'aux contrats autorisés des lots suivants. Aucune identité ni adhésion n'est provisionnée depuis une enveloppe.
9. Les rapports publics agrègent sans identité ni texte et suppriment les effectifs réidentifiables. Les preuves locales et externes restent séparées ; la publication et les configurations sensibles restent au propriétaire.

## Conséquences

Les lectures et décisions ajoutent des contrôles réactifs ; les tâches volumineuses utilisent des lots et reprises plutôt qu'un balayage dans une transaction. Les tests contrôlent couverture du schéma, limites, échéances, propriété, signatures, idempotence et absence de contenu dans les transports.

La console opérationnelle complète et les contrats métier de fédération restent des lots distincts. Le statut `dead_letter` est une issue attendue avec registre fermé. L'effacement externe et l'événement de fin au socle ne sont pas revendiqués par un reçu local. La réception sur appareils et chez les fournisseurs doit être éprouvée avec leur configuration réelle.

## Références

- [Rapport PA5](../07_RAPPORT_GARDE_FOUS_PA5.md).
- [Cahier, M-A9 à M-A14 et R7/R9/R10](../00_CAHIER_DES_CHARGES_ANTSIA.md).
- [ADR-0008](0008-preuves-serveur-et-revocation-immediate-des-sessions.md).
- [Registre des données](../../convex/modules/people/dataPolicies.ts), [protocole de fédération](../../packages/social-domain/src/federationProtocol.ts), [contrat de livraison](../../packages/social-domain/src/notificationDelivery.ts).
