# P19 — Pilote, preuve commune et activation maîtrisée (version documentaire)

19 octobre 2026, agent « pilote » sous coordination. Prompt [P19](../prompts/P19_PILOTE.md),
[préambule](../prompts/PROMPT_COMMUN.md), [10](../10_RECETTE_MESURES_ET_RISQUES.md),
[EXECUTION.md](../EXECUTION.md).

**Verdict : dossier de décision documenté ; partie exécution de P19 ouverte.** Décision du
propriétaire du 18/10/2026 (vers 22 h) : « Continuer sans vérifier ». La vérification officielle par
dépôt, les parcours de recette, le pilote utilisateur et toute mesure restent à faire ; ils sont
décrits pour être exécutés sur demande. Verdicts séparés (10 §7) : documenté — oui ; présent dans le
code — sans objet (aucun code écrit) ; testé automatiquement — non ; observé en recette — non ;
publié — non.

## Bilan standard

| Champ | Contenu |
|---|---|
| Résultat | Dossier [`pilote/`](../pilote/README.md) : versions candidates A à D avec les cinq verdicts par lot et les preuves exactes du 18/10 ; procédure de gel et de vérification ANTSIA puis PRO.GA, coordination DIASPORALE, vingt et un défauts connus, critères de sortie ; trente-quatre parcours de recette ; protocole de pilote utilisateur non conduit ; activation et retour arrière par capacité, indicateurs et seuils ; registre de 39 décisions non closes et 7 prérequis ; dossier de décision avec inventaires et empreintes des contrats ; guides vendeur, acheteur, candidat et employeur ; procédures de support |
| Source | ANTSIA `codex/pa4-identite-session` @ `9eaff40` : 602 entrées `git status` à 01 h 37 (244 modifiées, 358 non suivies), 618 à 02 h 12 ; PRO.GA `feat/antsia-social-commerce` @ `9497f22`, 187 entrées ; relevés du 19/10 en lecture seule. Fichiers écrits : `docs/etudes/2026-10-18-social-commerce/pilote/**` (douze fichiers) et ce rapport. Aucun autre fichier touché |
| Tests | Aucun lancé (décision du propriétaire). Contrôle documentaire seulement : liens relatifs et références croisées (fin de rapport) |
| Recette | Aucune. Parcours décrits, tous « non joués » ([03](../pilote/03_PARCOURS_DE_RECETTE.md)) |
| Dépendances | DP-01 (levée de la décision) ; fin d'écriture déclarée des sessions CC, DIASPORALE, P14B et du travail de thèmes au choix ; défauts K-04 et K-07 ; espace disque ; puis les décisions et prérequis du [registre](../pilote/06_REGISTRE_DES_DECISIONS.md) |
| Retour arrière | Sans objet : documents seulement ; aucune donnée, configuration ni source applicative modifiée |
| Limites | Aucune preuve nouvelle d'exécution. Les relevés (dates de fichiers, empreintes, nombre d'entrées) décrivent un arbre que d'autres sessions modifiaient pendant la lecture |

## Ce que P19 n'a pas pu faire, et pourquoi

| Exigence du prompt | État | Raison |
|---|---|---|
| Geler les sources avec les sessions actives, inventaires avant et après | non fait | vérification interdite ; des sessions écrivaient encore jusqu'à 02 h 11 au moins |
| Vérification officielle par dépôt | non faite | décision du propriétaire ; procédure prête ([02](../pilote/02_GEL_ET_VERIFICATION.md)) |
| Jouer les parcours de 10, dont boutique → offre → question → commande → paiement sandbox → exécution | non fait | aucune vérification ; aucun fournisseur de paiement : C-3 à C-6 bloqués même après vérification |
| Pilote utilisateur | non conduit | aucun participant recruté (PR-05) |
| Natif sur appareils physiques | non fait | P17b à P17d non lancées |
| Publication | exclue | aucune demande explicite |

## Constats nouveaux de ce lot (lectures)

1. **Preuves du 18/10 en partie périmées.** Les fichiers prouvés par P01 et P01b (`antsia.css`,
   `charte.css`, `globals.css`, modifiés le 19/10 à 01 h 15, puis `globals.css` à 02 h 10) et par P02
   (`routes.ts`, `network.tsx`, `network-shell.tsx`) ont changé depuis. Ceux de P06 sont inchangés ;
   les deux manifestes P06 ont la même empreinte `0ad170ac…d755f0`.
2. **Huit modules jumeaux identiques** dans les deux dépôts (empreintes en
   [07 §7](../pilote/07_DOSSIER_DE_DECISION.md)) ; les empreintes documentées de
   `commerce-services.ts` et `commerce-jobs.ts` sont conformes. Inventaire, pas preuve de parité.
3. **`compatibility.test.ts` est hors manifeste P06** : sa mise à jour (K-07) n'exige aucune révision
   jumelle.
4. **Quatre politiques sans écran de console** : vitrines (`shops/operator`), catalogue
   (`shops/catalogControl`), préparation (`shops/checkoutPolicy`), conversation contextuelle
   (`contextualMessaging/operator`). Contact, paiement, services et emploi ont leur écran (K-19,
   DP-37).
5. **« UI seule » non séparable** : sept entrées commerciales de Profil (`me-model.ts`), l'onglet
   Boutiques (`discover-model.ts`) et le brouillon de boutique ne dépendent d'aucune capacité ni
   politique (DP-38).
6. **Paiement de production fermé par le code** : `paymentAuthority` exige l'environnement `sandbox`
   (`convex/modules/shops/paymentAccess.ts:32`) ; `PAYMENT_ADAPTERS` et
   `PAYMENT_CALLBACK_BINDINGS` sont vides (`PRO_GA/convex/modules/payments/adapters.ts:67`, `:69`).
7. **Aucune porte de relance d'une lettre morte de l'outbox PRO.GA** relevée ; l'inbox ANTSIA, elle,
   se rejoue depuis la console Fédération (K-20).
8. **Machine** : 4,3 Gio libres (98 % occupés) ; Node par défaut v25.9.0. Le `codegen` de PRO.GA
   n'a pas de lanceur et le dépôt compte sept fichiers `"use node"` : Node 22 à placer en tête du
   PATH, comme la configuration `pro-ga-convex-local`.
9. **Conversation contextuelle en cours** : module moteur et quatre tables agrégées ; aucun test à
   01 h 35, puis `contextualMessaging.test.ts` présent à 02 h 15 dans le moteur et le domaine (K-18,
   levé, non exécuté) ; tranche CC-3a commencée côté DIASPORALE ; aucune nature dans le réseau
   racine en V1.
10. **Index des ADR** : `docs/adr/README.md` ne liste ni 0017, ni 0018, ni 0019, ni 0024 (K-21).
11. **P14B livré pendant ce lot** (rapport de 01 h 44) : treize genres d'avis commerce, ouverture
    ciblée, fiche de candidature, renvoi de Mes achats vers Mes demandes. Les avis destinés au client
    d'un service restent des traces déjà lues, sans transport : décision DP-39, prise avec PRO.GA.
12. **Travail non inscrit** : à 02 h 10–02 h 11, sept thèmes au choix du membre
    (`packages/ui/src/themes/antsia-<thème>.css`, `antsia-themes.ts` et son test) sont apparus et
    sont importés par `apps/antsia_ga/src/app/globals.css`. Ce travail ne figure pas dans
    EXECUTION.md à 02 h 12 ; il touche les fichiers prouvés par P01 et entre dans la version A s'il
    est retenu.

## Demandes au coordinateur

1. Mettre à jour la ligne P19 d'EXECUTION.md : « documenté ; partie exécution ouverte ; dossier
   `pilote/` » (ce lot n'y écrit pas), et le README de l'étude si un lien vers `pilote/` est voulu.
2. Inscrire dans EXECUTION.md le travail de thèmes au choix (responsable, fichiers, état) et
   l'inclure dans le gel commun.
3. Soumettre le [registre](../pilote/06_REGISTRE_DES_DECISIONS.md) au propriétaire, en commençant par
   DP-01, DP-02, DP-21, DP-38 et PR-07 ([07 §9](../pilote/07_DOSSIER_DE_DECISION.md)).
4. Faire traiter K-04 et K-07 par leurs propriétaires avant le gel ; annoncer le gel quinze minutes
   avant, une fois toutes les sessions à l'arrêt.
5. Arbitrer AC-01 à AC-09 ([06 §10](../pilote/06_REGISTRE_DES_DECISIONS.md)).

## Contrôle documentaire

Script Python jetable (répertoire temporaire de session, hors dépôt), relancé après la dernière
modification sur les treize fichiers de ce lot : **91 liens relatifs, 0 cassé** ; toutes les
références croisées définies (39 DP, 7 PR, 21 K, 9 AC) ; 34 parcours à l'index de 03 ; aucun bloc de
code non fermé. Contrôle de cohérence documentaire, pas une vérification applicative.

## Fichiers

- Créés : `pilote/README.md`, `pilote/01_VERSIONS_CANDIDATES.md`, `pilote/02_GEL_ET_VERIFICATION.md`,
  `pilote/03_PARCOURS_DE_RECETTE.md`, `pilote/04_PILOTE_UTILISATEUR.md`,
  `pilote/05_ACTIVATION_ET_RETOUR_ARRIERE.md`, `pilote/06_REGISTRE_DES_DECISIONS.md`,
  `pilote/07_DOSSIER_DE_DECISION.md`, `pilote/guides/GUIDE_VENDEUR.md`,
  `pilote/guides/GUIDE_ACHETEUR.md`, `pilote/guides/GUIDE_CANDIDAT_EMPLOYEUR.md`,
  `pilote/guides/PROCEDURES_SUPPORT.md`, ce rapport.
- Non touchés : EXECUTION.md, README de l'étude, autres rapports, code, `.env*`, git.
