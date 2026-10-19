---
title: "ANTSIA — Rapport de préparation au lancement (PA10)"
date: "2026-10-18"
statut: "Sources implémentées ; vérifications différées ; lancement non autorisé"
projet: "ANTSIA"
---

# Préparation au lancement — PA10

**Verdict : lancement ouvert, aucune publication effectuée.** Le propriétaire a demandé l'implémentation de PA10 en laissant les vérifications de côté. Ce rapport est la passation des sources et des preuves encore attendues. Aucun résultat de charge, d'audit, de restauration ou d'accessibilité n'a été fabriqué. Les nouvelles API n'ont pas été générées ni déployées pendant ce lot ; leur présence dans les sources ne prouve pas leur disponibilité sur un serveur déjà démarré.

## 1. Périmètre implémenté dans le code réel

| Partie | Sources et raccordement | Limite explicite |
|---|---|---|
| Fil personnel matérialisé | `posts/feedTables.ts`, `feedMaterialization.ts`, `feedRead.ts`, `feedPolicy.ts` ; `posts.myFeed`, préparation montée dans `FeedPages` | Références privées ; portée `pour_vous`. Récents, voies, murs, groupes et public anonyme gardent leurs lecteurs propres. |
| Distribution à l'écriture | `postWrite`, publication administrative fédérée, restauration de modération ; deux contextes origine/racine quand autorisés | Au plus deux réservations à la publication ; destinataires en lots de 20, gardes vivantes. Aucune transaction unique sur 5 000 personnes. |
| Rattrapage | Préparation par lecteur, follow personnel/page, connexion acceptée, habilitation de page, réactivation et versions d'accès vivantes | Une source puis ses posts paginés ; génération/étape persistées, reprise par cron. Rafraîchissement au retour après 24 h ; une clé privée opaque réveille une génération devenue obsolète. Coût et latence non mesurés. |
| Seuil, portée et pagination | Plus de 200 sources cumulées, plus de 50 pages ou ensemble tronqué ; bascule après état prêt ; curseur stratégie/génération/fenêtre et dates du post | Une chaîne legacy garde sa forme et sa stratégie ; une génération remplacée interrompt explicitement sa continuation. Fenêtre de 30 jours et distributions en attente signalées. |
| Retraits et confidentialité | `canSeePostDoc`, admission par paires exactes, masquages/sourdines exacts si ensembles tronqués ; retrait commun/root et purge bornée | Les autorisations ferment sans attendre le nettoyage des entrées. Une ligne de fil n'est jamais une preuve d'accès. |
| Export et effacement | Classification des trois tables de fil, export allowlisté du seul état propre ; pages indexées par lecteur et post dans `people/feedDataPage.ts` | Pas de copie exportable du contenu étranger ; les références de rattrapage à une personne effacée sont anonymisées. Les autres tables gardent le parcours PA5 existant. |
| Stockage | `files/orphans.ts`/`staging.ts`, réservation PA9 atomique, ancien avatar/couverture détaché dans `people/profile.ts` ; cron quotidien | Blobs non admis et non réservés de plus de 24 h seulement ; scans, réservations PA9 et assets catalogue protègent les copies. Les stages historiques sont protégés avant purge. Pas de nettoyage réel exécuté. |
| Compteurs | Huit fragments de réactions existants ; agrégats `engineCounters`/`followerCounts` conservés | Aucun nouveau nombre de fragments choisi sans mesure/migration. Débits, conflits et répartition restent à mesurer. |
| Mesure facultative UE | Cloud UE ou relais déclaré dans le transport et la CSP ; étapes réelles d'entrée après accord ; catalogue/Docker/config/example raccordés | Sans persistance d'identifiant, sans autocapture/replay, sans identité civile. Nouveaux inscrits sans accord non observés ; rétention multivisite non mesurée. Aucun projet PostHog configuré ici. |
| Santé opérationnelle | `platform/operationalHealth` + snapshot minimal + panneau Santé de la console ; cron de cinq minutes | Échantillon de 200 jobs/1 Mio, fenêtre d'une heure, couverture et date visibles. Alerte locale si échec. Ne remplace pas un log drain/alerte fournisseur pour toutes les erreurs Convex. |
| Restauration/charge | `scripts/pa10-evidence.mjs`, assertion interne locale `platform/recovery`, procédures `docs/20` | Outil de lecture de preuves uniquement ; aucun import, export, trafic de charge, sous-processus ni déploiement automatique. |

Tables nouvelles PA10 : `feedEntries`, `feedCursors`, `feedFanoutJobs`, `operationalSnapshots`, `fileStagingReservations`. Index ciblés d'effacement ajoutés ; pas de suppression d'index décidée ici. `schemaValidation: true` reste déclaré ; aucune validation du schéma n'a été exécutée dans ce lot. Les nouveaux noms de crons sont ASCII ; leurs cibles sont internes.

## 2. Parité et historique

| Domaine | Pièce de référence | État dans cette livraison |
|---|---|---|
| Backend dupliqué du socle | `docs/03_RAPPORT_PARITE_BACKEND.md` et owner map `docs/02` | Parité documentée par les lots PA3 ; preuves historiques, non rejouées sur les modifications PA9/PA10. |
| Front et communication | `docs/04_RAPPORT_PARITE_FRONT.md` | Tranches PA6 documentées, incluant les lots du direct ; aucune nouvelle recette navigateur dans PA10. |
| Identité, session, déconnexion | `docs/05_RAPPORT_IDENTITE_PA4.md`, ADR-0008 | Sources existantes conservées ; clients OIDC réels non créés/configurés selon la dernière confirmation du propriétaire. |
| Modération, données, notifications | `docs/07_RAPPORT_GARDE_FOUS_PA5.md` | Gardes conservées et nouveaux index ciblés pour les tables du fil ; nouveaux scénarios non exécutés. |
| Console | `docs/11_RAPPORT_CONSOLE_PA7.md` | Surfaces existantes conservées ; Santé technique ajoutée en sources. |
| Public ANTSIA | `docs/13_RAPPORT_RESEAU_PUBLIC_PA8.md` | Anciennes recettes API/HTML documentées ; ne prouvent pas le rendu actuel des modifications partagées. |
| Fédération administrative | `docs/15` à `docs/18`, contrat `RESEAU-PUBLIC-V1`, ADR-0013 à 0016 | PA9A/B/C/D en sources, non commis ; configuration, PR du socle et recette croisée toujours ouvertes. |
| Échelle/lancement | `docs/19`, `docs/20`, ADR-0020 | PA10 en sources ; aucune preuve de lancement acquise pendant cette intervention. |

Les travaux contemporains DIASPORALE (services, avis, pages, événements, rappels) et ANTSIA/PRO.GA (boutiques et catalogue) appartiennent à leurs chats. Leurs raccordements partagés sont préservés et coordonnés ; ce rapport ne les certifie pas. Les cinq fichiers réservés de transfert de session ne font pas partie du lot.

## 3. Contrôles et résultats

| Contrôle attendu | État PA10 | Preuve nécessaire avant clôture |
|---|---|---|
| Codegen, typages, tests, lint, build | **Non exécutés**, demande du propriétaire | Vérification complète sur un inventaire de sources figé ; API/schéma générés avec le lanceur Node supporté. Aucun commit avant cette porte. |
| Cliquets réseau, imports, couleurs, i18n, URLs, validateurs, provenance | **Non rejoués** | Résultats actuels des cliquets existants ; conserver leurs listes fermées et ne pas diminuer la couverture pour faire passer le lot. |
| Cliquets fichiers, débit, notifications, audit, crons, déconnexion | **Non rejoués** | Résultats actuels ; inscription PA10 et invariants d'admission/effacement à inclure. |
| Inventaire dérivé du schéma et effacement | Scénarios écrits, **non exécutés** | Propriétaire/parent de chaque table, effacement de références et blobs, aucune ligne recréée par un job ancien. |
| R8 : 5 000 abonnés / 10 000 réactions | **Non exécuté** | Workload réel, compteurs avant/après, conflits et reprises, p95 de lecture ; premier affichage 3G mesuré séparément. Aucun p95 annoncé ici. |
| Restauration Convex sur cible jetable | **Non exécutée** | Reçus source/cible, sauvegarde avec fichiers/composants, empreintes, assertions d'isolation et parité ; sessions et compteurs constatés. |
| `convex-authz` | **Différé** | Impersonation, propriété, multi-réseaux, refus indistinct, contenu retiré, opérateur et source fédérée. |
| `convex-launch-readiness` | **Différé** | Budget, indexes, transactions, tâches, garde des fichiers, exposition des fonctions, alertes et sauvegarde. |
| `web-design-guidelines`, accessibilité AA | **Différés** | Toutes les routes et états ; clavier, focus, contrastes, lecteur d'écran, zoom, mobile et sombre ; corriger puis constater les défauts. |
| Médias réels et transports | **Différés** | Téléversement, antivirus, stockage, lecture photo/vidéo, retrait, LiveKit/Egress, e-mail/SMS/push et reçus sur appareil. |
| Publication/révision servie | **Aucune publication** | Décision du propriétaire, SHA cible explicite, backend avant front, indexes préservés, révision et contenu servi constatés après publication. |

Scénarios source PA10 : domaine/curseurs, matérialisation/autorité, dépôt orphelin, images de profil, pages d'effacement du fil, projection opérationnelle, mesure UE/funnel, CSP, lecture locale de preuves. Leur présence n'est pas un résultat vert.

## 4. Risques et décisions ouvertes

- La distribution est asynchrone : backlog, temps de préparation, disponibilité des tâches et coût national restent à mesurer. Le signal de backlog est conservateur à l'échelle du réseau ; sa réactivité sous charge fait partie de R8. La fenêtre de 30 jours est une limite volontaire, pas la totalité de l'historique.
- Le palier legacy demeure borné et signale ses lacunes pendant la préparation ; ses grandes fenêtres restent coûteuses jusqu'à la bascule. Les compteurs à huit fragments peuvent encore subir des conflits : rien ne permet ici d'annoncer le contraire.
- Une comparaison locale de deux exports ne prouve pas leur origine. La procédure exige les reçus Convex et une assertion sur la vraie cible jetable ; l'assertion livrée ferme les cibles non locales.
- La purge orpheline échoue fermée si sa protection historique est interrompue ou rencontre un manifeste hors contrat. Une réservation n'expire pas par ancienneté : son admission ou son nettoyage métier doit la libérer. Les dépôts clients ne peuvent pas adopter ces copies temporaires.
- Le suivi des jobs planifiés ne voit pas toutes les erreurs synchrones. Pas d'astreinte externe configurée ni de notification envoyée. Le traitement UE d'un relais et du projet PostHog demeure à confirmer par le propriétaire.
- Une mesure en mémoire ne calcule pas une rétention J+1/J+7. Aucun identifiant persistant ajouté ; ce point reste une décision et un complément ultérieurs.
- PA9, les médias réels, IDN sandbox, AA, les décisions juridiques et l'hébergement restent ouverts. Les preuves anciennes de PA3 à PA8 ne couvrent pas les nouvelles sources.

## 5. Comptes, clés et décisions du propriétaire

| Sujet | À fournir ou décider |
|---|---|
| Convex | Équipe/projet ANTSIA, séparation dev/prod, accès, budget, sauvegardes, cible jetable, alertes et astreinte. |
| IDN | Clients OIDC ANTSIA/DIASPORALE sandbox puis production, redirections et secrets saisis hors du chat. |
| Hébergement et domaine | Arbitrage A5, comptes, domaines, certificats, cible et décision de publication. |
| Transports | Resend/e-mail, SMS, VAPID, LiveKit/Egress, antivirus ; configuration par environnement et recette. |
| Fédération PA9 | Émetteur, clés distinctes par environnement, origines/contrat, PR du socle, recette conjointe. Aucune publication du socle sans décision séparée. |
| Mesure | Projet PostHog UE et jeton public, origine de capture, justification du relais éventuel, finalité et textes. |
| Gouvernance | Équipes de modération, recours, permanence et traitement des incidents, règles de publication, transparence. |
| Droit | Dossier APDPVP, analyse d'impact, textes validés et licence ; aucune validation juridique déclarée par ce rapport. |

## 6. Passation

1. Décider la reprise des vérifications ; réserver un état de sources sans écritures parallèles. Conserver les travaux des autres chats.
2. Générer puis vérifier localement, sous le Node supporté sélectionné par les scripts existants. Réparer les défauts sur ce même état et rejouer les contrôles concernés.
3. Exécuter les campagnes `docs/20` : fil/compteurs/retraits sous charge, stockage et restauration, audits de droits et AA, IDN/médias/transport réels.
4. Actualiser ce rapport avec dates, cibles, SHA, résultats et limites réellement observés. Faire accepter l'ADR proposé seulement après décision explicite ; ne pas réécrire les ADR acceptés.
5. Après validation et autorisation du propriétaire, préparer commit/PR puis publication. Constater la révision et les parcours servis après celle-ci. PA10 ne vaut pas une autorisation de mise en ligne.

Cette livraison ne lance aucun contrôle ni service et ne modifie aucun environnement réel. La mémoire Obsidian reçoit un état factuel des sources et des étapes restantes ; aucun résultat historique n'y devient une preuve PA10.
