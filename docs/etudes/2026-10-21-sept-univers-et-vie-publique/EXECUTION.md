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
| SU01d | En ligne, restes compris, depuis le 22/10 (backend de `f574c75`, front `880d1aa`) ; bureau de DIASPORALE livré en source (diasporale#26), à publier ; reste la console | voir [SU01d — signalements réglementés](#su01d--signalements-réglementés) |
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
- Recette navigateur du 22/10/2026, sur le backend local isolé d'un candidat tiré de `main` (variables posées avec l'accord du propriétaire), avec les comptes de démonstration :
  - Awa MBA signale trois publications fictives de Jean-Rémy NDONG : un hypertrucage, un harcèlement et une information trompeuse ; le dialogue propose les 12 motifs et annonce l'accusé et la décision ;
  - trois accusés de réception arrivent dans sa cloche dès la transmission, chacun menant à « Mes signalements », qui affiche les échéances : 22/10, 23:37 (art. 33) et 24/10, 23:37 (art. 24) ; aucune pour la désinformation ;
  - dans `/moderation`, Nadège KOUMBA voit « Délais légaux » en tête, l'hypertrucage avant le harcèlement, avec l'accusé affiché ; les chronomètres passent de 58 à 57 min sans rechargement ; la désinformation est seule dans « Autres signalements » ;
  - retrait de l'hypertrucage à 23:41, avant l'échéance, et classement de la désinformation : Awa reçoit deux avis « Une décision a été prise sur votre signalement. », et « Mes signalements » dit « Contenu retiré », « En cours d'examen » et « Aucun manquement retenu », sans sanction ni motif de modération ;
  - à 390 px : pas de défilement horizontal, l'ancre `#mes-signalements` reçoit le focus ; aucune erreur dans la console.
  - Limite : le navigateur intégré bloque les dialogues natifs ; la confirmation du retrait a donc été acceptée en remplaçant `window.confirm` dans l'onglet.

**Mise en ligne**
- Backend déployé le 22/10/2026 vers 1 h, démo puis production, avec l'accord écrit du propriétaire : `9927c9c` (3 index sur `reports`, `deadlineQueue` et `myReports`), puis `bca19af`.
- Fronts publiés depuis `main` : `26f3024`, puis `bca19af` (docs/35). La production répond `main-bca19af78116`, qui contient SU01d.
- Restes en ligne le 22/10/2026 vers 10 h 40 :
  - backend de `main` `f574c75`, identique sous `convex/` à `880d1aa`, sur la démo (vivid-hedgehog-655) puis la production (diligent-avocet-585), avec l'accord écrit du propriétaire ;
  - aperçus `--dry-run` sains : aucun index supprimé, schéma validé. Seule ligne affichée : « version Node des actions », un artefact `null`/`undefined` de la CLI, sans valeur de part et d'autre ;
  - la production portait déjà ce backend (1 034 fonctions, signatures identiques à la démo), déployé en même temps que le front `880d1aa`. Elle n'a pas été poussée une seconde fois ;
  - contrôles en lecture seule sur les deux : `transparencyDeadlines` répond (seuil 5, douze périodes, aucune encore publiée), `transparency` garde sa forme, `/transparence` dit les délais (front `main-880d1aadf525`).

**Restes livrés le 22/10/2026 (en ligne le jour même)**

*Délais tenus sur `/transparence`* (moteur et antsia.ga) :
- Le passage quotidien de transparence compte, pour chaque jour UTC, les échéances légales **tombées** ce jour-là. Il le fait dans un second passage, `aggregateNetworkDeadlines`.
  - Une échéance est **tenue** si le dossier est classé ou suivi d'effet à l'échéance ou avant.
  - Elle est **manquée** sinon : décidée après, ou encore ouverte ou en examen une fois l'échéance passée.
  - Le passage mesure la veille : toutes ses échéances sont passées et chaque issue est définitive.
  - Règle pure `reportDeadlineOutcome` ; nouvel index `reports.by_network_dueAt`, sans statut, pour que la borne des auteurs distincts couvre tous les statuts d'un même lot.
- Règle de publication (`legalDeadlineDisclosure`), celle des petites cohortes de la transparence et de l'ADR-0011 :
  - une période ne publie ses échéances que si elle était close au calcul et compte au moins 5 échéances sur 5 auteurs distincts ;
  - chaque nombre sous 5 se dit « moins de 5 », zéro compris ;
  - la base n'est jamais publiée, ce qui empêche toute inférence par différence.
- Une projection publique **à part**, `transparencyDeadlines`. Les écrans déjà publiés lisent `transparency` en schéma strict : sa forme ne change pas.
  - Sans cette projection (ancien backend), la page garde ses totaux et ne dit rien des délais.
  - L'ordre de déploiement est donc libre.
- La page dit les délais de l'ordonnance, lus depuis la règle (72 h, 24 h, n° 0011/PR/2026), puis, par période publiée, « Échéances légales : N dans le délai · moins de 5 hors délai ». Aucun chiffre n'est écrit en dur dans les textes (cliquet `public-communication`).

*DIASPORALE* :
- Le menu de signalement suit le moteur : `REPORT_REASONS` vaut `CONTENT_REPORT_REASONS`, soit les douze motifs dans son ordre, dans les deux feuilles (publication, et contenus de la vague H).
- Servies par le moteur, les deux feuilles annoncent l'accusé de réception puis la décision. La démonstration ne promet rien.
- La cloche dit les deux avis par des phrases propres au lieu de « nouvelle activité » :
  - « Votre signalement a bien été reçu. La décision vous sera communiquée. » ;
  - « Une décision a été prise sur votre signalement. ».
  Chacun mène à « Mes signalements » ; jamais vers le contenu signalé.
- « Mes signalements » dans `/parametres#mes-signalements` (section « Mes données ») :
  - issue pour le contenu, motif, transmission, accusé de réception, fondement et échéance légale, date de décision ;
  - ni auteur, ni sanction, ni motif de modération ;
  - ouverte depuis la cloche, la rubrique se place et prend le focus une fois lue ;
  - lecture de `cases.myReports` par l'adaptateur du moteur. Le fournisseur de démonstration ne la sert pas : la rubrique n'y apparaît pas.

**Preuves des restes**
- Tests du domaine : issue d'une échéance (tenue, manquée, à venir) ; règle de publication (seuils, auteurs, période close, période antérieure).
- Test du moteur de bout en bout, horloge simulée, dans `reporterNotices.test.ts` :
  - six harcèlements visant six auteurs, cinq tranchés à temps, un laissé ouvert ;
  - un hypertrucage qui échoit un autre jour et une désinformation sans échéance ;
  - le passage mesure 5 tenues, 1 manquée, 5 auteurs ; la projection publie `{ met: 5, missed: null }` pour ce seul jour, sans aucun identifiant ni motif ;
  - six échéances d'un seul auteur, même tenues, ne se publient pas.
- Test de la projection : période antérieure à SU01d, période calculée avant sa fin ; la forme de `transparency` est inchangée.
- Test de la route `/transparence` (rendu serveur) : délais lus depuis la règle, lignes par période, projection indisponible, OTT.
- DIASPORALE :
  - la cloche dit les deux genres et mène à « Mes signalements » ; aucun lien sans route ;
  - l'adaptateur projette `myReports` et ferme une autre personne ou une session absente ;
  - la rubrique : rendu, état vide, refus, ancre et focus ;
  - les feuilles : douze motifs, suite annoncée hors démonstration ;
  - les motifs sont égaux à ceux du moteur.
- `bun run verify` vert sur le candidat composé depuis `main` :
  - 3 224 tests du moteur, 150 de cliquets, 1 767 d'antsia.ga, plus ceux de DIASPORALE ;
  - aucune erreur de lint.
- Recette navigateur du 22/10/2026 :
  - backend local isolé du candidat, avec les trois mêmes variables posées avec l'accord du propriétaire ;
  - comptes de démonstration ;
  - captures dans [`recette/`](recette/), et pour DIASPORALE dans `docs/recette/su01d-avis-et-motifs-2026-10-22/` de son dépôt.
  - `/transparence`, visiteur anonyme :
    - le vrai passage a mesuré deux jours passés, sans aucune échéance réelle ;
    - leurs accumulateurs ont ensuite été posés **à la main**, par un appel direct du second passage : 7 tenues, 0 manquée, 5 auteurs ; puis 3, 6, 5. Sans horloge simulée, aucune échéance réelle ne peut échoir dans la journée ;
    - la projection rend `{ met: 7, missed: null }` et `{ met: null, missed: 6 }` ;
    - la page dit les délais (n° 0011/PR/2026, 72 h, 24 h), puis « Échéances légales : 7 dans le délai · moins de 5 hors délai » et « … moins de 5 dans le délai · 6 hors délai », et rien pour les dix autres jours ;
    - à 390 px : aucun défilement horizontal (`scrollWidth` 390), la ligne passe sur deux lignes dans sa carte.
  - DIASPORALE, servi par le moteur :
    - Patrice MBOUMBA, membre vérifié, publie un texte fictif ;
    - Sandrine ONDO, membre parrainée, ouvre « Signaler » : douze motifs dans l'ordre du moteur, et la suite annoncée ;
    - elle signale un harcèlement. L'accusé arrive aussitôt dans sa cloche (« Votre signalement a bien été reçu. La décision vous sera communiquée. »), avec « Voir mes signalements » ;
    - ce lien ouvre la rubrique. Elle se place et prend le focus, puis dit : « En cours d'examen », l'accusé de 10:15, et « Art. 24 : décision notifiée sous 72 h — échéance : 25 oct. 2026, 09:15 ». L'heure d'hiver du 25/10 est comprise ;
    - Ruth ALLOGHO, modératrice, retire le contenu à 10:17 dans `/moderation`. Dans le moteur, la décision et l'avis au déclarant portent la même seconde ;
    - Sandrine lit « Une décision a été prise sur votre signalement. ». À 390 px, sans défilement horizontal, la rubrique dit « Contenu retiré » et « Décision le 22 oct. 2026, 10:17 » ;
    - en anglais : « My reports », « Content removed » ;
    - console : des 401 pendant les changements de compte, et le rechargement à chaud perdu en passant d'une application à l'autre sur le même port.

**Bureau de modération de DIASPORALE (livré en source le 22/10/2026 : diasporale#26, `d18dd20` ; non publié)**
- `/moderation` d'`apps/diasporale_com` ouvre l'onglet « File » sur une voie « Délais légaux », lue dans `cases.deadlineQueue`. Cette requête est en ligne depuis `9927c9c` et `cases.ts` n'a pas changé depuis.
  - L'échéance la plus proche d'abord, 50 au plus.
  - Pour chaque dossier : fondement (heures lues par `personalReportDelayHours`), chronomètre (reste ou retard, rafraîchi toutes les 30 s sans relire la base), échéance, accusé de réception.
  - Ni le pays ni la nature ne la filtrent ; elle suit l'équipe choisie, dont le sélecteur passe en tête de l'onglet. Comme la file, elle liste sans rien compter.
  - La feuille d'un dossier ouvert depuis la voie rappelle son délai ; le message d'issue revient dans la voie.
- File ordinaire à part : `lane: "ordinary"` dans le port, comme la file du moteur.
  - La tranche `diaspora/moderationDesk` ne range pas ses fenêtres par échéance : l'adaptateur écarte donc les dossiers de la voie, lue avec la même compétence (même abonnement).
  - Il attend la voie et ne cache rien si elle est illisible. Au-delà des 50, un dossier à délai légal reste dans la file ordinaire.
- Démonstration : la règle du moteur (`reportLegalBasis`, `reportDecisionDueAt`) pose les délais des dossiers fictifs ; un hypertrucage fictif (art. 33, 24 h) rejoint le jeu.
- Aucune modification du moteur : aucun backend à publier avant le front.

**Preuves du bureau DIASPORALE**
- Tests de l'adaptateur (projection, refus, file ordinaire qui attend la voie ou la laisse entière), de la démonstration (règle du moteur, ordre, équipe, décision), des règles pures (chronomètre, file ordinaire) et de l'écran (voie en tête, retard, chronomètre qui avance, feuille, voie vide ou illisible).
- `bun run verify` vert sur le candidat composé depuis `main` (`880d1aa`, docs seules depuis) : 3 224 tests du moteur, 150 de cliquets, 885 de `@diasporale/features`, 1 415 de `diasporale-com`, 1 767 d'antsia.ga ; lint sans erreur.
- Recette navigateur du 22/10/2026, backend local isolé du candidat avec les trois mêmes variables (aucune nouvelle), comptes de démonstration :
  - Patrice MBOUMBA publie deux textes fictifs ; Sandrine ONDO signale le premier pour harcèlement, le second pour « Autre motif » ;
  - Ruth ALLOGHO voit le harcèlement dans « Délais légaux » : « Art. 24 : décision notifiée sous 72 h », « Reste 71 h 58 min », échéance le 25/10 à 10:07 (heure d'hiver comprise), accusé de réception ; l'autre dossier est seul dans la file ordinaire ;
  - elle retire le contenu depuis la voie : le message d'issue prend le focus dans la voie, qui se vide ;
  - un contenu d'IA interdit signalé par Hervé MOUBAMBA entre dans la voie avec « retrait sous 24 h » ; le chronomètre passe de 23 h 59 à 23 h 58 sans rechargement ;
  - à 390 px, aucun défilement horizontal ; la démonstration montre l'hypertrucage fictif avant les trois harcèlements fictifs ;
  - captures dans `docs/recette/su01d-bureau-delais-2026-10-22/` du dépôt DIASPORALE.

**Ce qui reste de SU01d**
- La console d'exploitation n'expose pas encore les délais légaux : ni l'export de transparence des opérateurs (`platform/console`), ni une alerte de retard. Session lancée le 22/10.
- Publier le front DIASPORALE du bureau (diasporale#26) : aucun backend nouveau. C'est au propriétaire.
- Premiers chiffres : le passage quotidien de 04 h 10 UTC mesure la veille. Une journée ne se publie qu'à partir de 5 échéances sur 5 auteurs.

## Conditions externes

- Statut de la suspension des réseaux sociaux par la HAC au 21/10/2026 : non confirmé.
- Inscription au registre de la HAC, représentant légal, identité de l'éditeur, dossier APDPVP : relèvent du propriétaire (SU01, § 5).
- Paiements (MP08), preuve de majorité (MP10), conventions de vérification d'État (D09) : inchangés.
