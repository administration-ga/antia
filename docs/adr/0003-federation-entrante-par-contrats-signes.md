# ADR-0003 : Fédération entrante par contrats signés ; aucune lecture de base externe

- **Statut** : Proposé
- **Date** : 2026-10-14

## Contexte

ANTIA doit montrer les pages des administrations vérifiées et leurs publications déclarées
publiques (socle), et DIASPORALE doit recevoir une attestation consulaire et des objets publics
(consulat.ga). La doctrine d'interopérabilité du programme est l'étanchéité : dépôts, déploiements
et secrets distincts ; un lien se construit en HTTP contractuel, jamais en lecture de base à base
ni en client Convex croisé.

## Décision

Nous allons recevoir tout ce qui vient d'ailleurs par une **passerelle de fédération** du moteur
(`convex/modules/federation`) : inbox HTTP signée (clé par émetteur et par environnement), reçus
idempotents, lettres mortes, rejeu audité, table `mirrors` (objet distant → objet local), sur le
patron des tables `federationInboxReceipts` du socle. Chaque flux est un contrat versionné dans
`docs/contrats/` (`RESEAU-PUBLIC-V1` socle → moteur ; `DIASPORA-ATTESTATION-V1` et
`DIASPORA-COMMUNAUTE-V1` avec consulat.ga), qui ne transporte que des références métier
publiques — jamais un identifiant interne, une note de service, un e-mail ou une donnée
consulaire. Le moteur n'importe aucun `_generated`, schéma ni paquet d'un autre dépôt (cliquet
`no-cross-product-imports`).

## Conséquences

### Positives

- Le socle et consulat.ga gardent leur production et leur gouvernance ; un reflet se retire par
  un évènement, sans toucher leur base.
- Les reflets sont en lecture seule et traçables (reçus, rejeu audité).

### Négatives

- Chaque flux exige un travail des deux côtés (outbox et ADR côté socle, PR côté gabon-diplomatie).
- Rien ne remonte vers le socle en V1 : les échanges faits dans ANTIA sur un reflet y restent.

### Neutres

- La publication du socle en production reste une décision du propriétaire (PA9).

## Alternatives considérées

### Option A — client Convex croisé ou lecture de base

Contraire à la doctrine, couple les déploiements et expose des données sans contrat : écartée.

### Option B — migration de l'iRéseau du socle sur le moteur

Décision de la famille V5 (autonomie des plateformes), hors de ce plan.

## Références

- Cahier §13, EXF-AN-36 à 38 ; plan §3.4 ; `CONTRATS/` (EventEnvelope, Outbox/Inbox, BusinessRef).
- Socle : `modules/reseau/federationTables.ts`, `federation.ts` (patrons).
