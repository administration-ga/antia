# Exécution SU00–SU16

Autorisation : le propriétaire a validé les décisions D01 à D08 le 21 octobre 2026 et demandé l'ADR (SU00) et l'analyse de conformité (SU01). D09 à D12 restent proposées : aucun lot ne les présume. Chaque lot s'exécute seul, réservé dans la mémoire partagée, branché dans l'application réelle et vérifié selon les instructions du dépôt ; ses preuves sont consignées ici.

## Référence

- Étude : [ETUDE_SEPT_UNIVERS_ANTSIA.md](ETUDE_SEPT_UNIVERS_ANTSIA.md) et son PDF, version 1.1.
- Décision : [ADR-0035](../../adr/0035-sept-univers-et-vie-publique.md).
- Conformité : [SU01_CONFORMITE_ORDONNANCE_0011.md](SU01_CONFORMITE_ORDONNANCE_0011.md).
- Base de code lue : arbre partagé `codex/pa4-identite-session` (HEAD `c4d36f3`) et `origin/main` `7ffab29` (marketplace MP00–MP14 fusionnée le 21/10, backend non déployé).

## Lots

| Lot | État | Preuves et suite |
|---|---|---|
| SU00 | Terminé — documentaire | ADR-0035 (D01–D08 acceptées, D09–D12 proposées) ; index des ADR mis à jour ; étude passée en version 1.1 |
| SU01 | Analyse livrée ; mise en œuvre par sous-lots | exigences article par article, état du code, écarts, arbitrages juridiques, sous-lots SU01a à SU01j et calendrier ; à faire valider par un juriste avant toute mise en œuvre de l'identification et de l'âge |
| SU01d | En source dans `main` (21/10) ; backend à déployer | voir [SU01d — signalements réglementés](#su01d--signalements-réglementés) |
| SU02 | À faire | Découvrir par piliers ; dépend de SU00 et MP01 |
| SU03 | À faire | types d'offre bien immobilier et véhicule ; dépend de MP03 |
| SU04 à SU16 | À faire | voir l'étude, § 15 |

## SU01d — signalements réglementés

Ordonnance n° 0011/PR/2026, art. 24, 32 et 33.

**Livré en source**
- **Six motifs** : contenu préjudiciable impliquant un mineur, hypertrucage qui me représente sans mon accord, contenu d'IA interdit, imitation d'une institution de l'État, usurpation d'identité, atteinte à la vie privée ou à l'honneur. Le harcèlement est renommé « harcèlement, cyberharcèlement ou intimidation ».
- **Délai légal posé à la transmission** (`legalBasis`, `dueAt`) :
  - 72 h pour la décision (art. 24), pour tout harcèlement, mineur ou non, et pour un contenu préjudiciable impliquant un mineur ;
  - 24 h pour l'hypertrucage d'une personne qui le signale (art. 33) ;
  - 24 h, par prudence, pour les contenus d'IA interdits (art. 32).
- **Accusé de réception** (`report_received`) : émis au déclarant dans la transaction de la transmission ; sa date est inscrite au dossier.
- **Avis de décision** (`report_decided`) : envoyé au déclarant dès qu'un dossier est classé ou suivi d'effet. Il ne dit que l'effet sur le contenu ; ni la sanction ni le motif de modération ne sont communiqués. L'avis arrive dans la cloche du réseau où la personne a signalé.
- **File prioritaire dans `/moderation`** : les délais légaux passent avant la file ordinaire, l'échéance la plus proche d'abord, dans la limite des 50 plus proches. Chaque dossier montre :
  - son fondement ;
  - son chronomètre (reste ou retard, rafraîchi toutes les 30 s) ;
  - son échéance ;
  - l'état de son accusé de réception.
- **« Mes signalements »** dans `/mes-donnees` : motif, échéance, accusé de réception, issue et date de décision ; c'est aussi la destination des deux avis. L'export de données du déclarant comprend ces champs.

**Preuves**
- Tests du moteur `convex/modules/moderation/reporterNotices.test.ts` (11), menés sur des comptes fictifs avec l'horloge simulée :
  - transmission, accusé, décision à 71 h et avis au déclarant, de bout en bout ;
  - file prioritaire et compétence des équipes ;
  - cloche, réseau du déclarant et chemin historique des publications.
- Tests du domaine (motifs, fondements, échéances, issue) et de l'interface (chronomètre, file prioritaire, cloche).

**Reste**
- Déploiement du backend, avec celui de la marketplace : `scripts/convex-deploy-demo-production.sh`, lancé par le propriétaire.
- Recette dans le navigateur, connecté en modérateur : non faite, car le backend local isolé exige deux variables d'authentification.
- Indicateurs publiés (délais tenus) sur `/transparence`.
- Côté DIASPORALE : phrases propres aux deux avis (elles s'affichent aujourd'hui comme « nouvelle activité ») et libellés des nouveaux motifs dans son bureau de modération.

## Conditions externes

- Statut de la suspension des réseaux sociaux par la HAC au 21/10/2026 : non confirmé.
- Inscription au registre de la HAC, représentant légal, identité de l'éditeur, dossier APDPVP : relèvent du propriétaire (SU01, § 5).
- Paiements (MP08), preuve de majorité (MP10), conventions de vérification d'État (D09) : inchangés.
