# ADR-0020 — Fil matérialisé et preuves de lancement

Date : 2026-10-18. Statut : **proposé**, implémenté dans les sources, vérifications différées par le propriétaire.

## Contexte

Le fil personnel compose des fenêtres par auteur et page. Ses bornes protégeaient le moteur mais excluaient des sources au-delà du plafond. PA10 demande une distribution à la publication, le rattrapage des nouveaux liens, une observabilité et une passation exploitable. La demande actuelle reporte les vérifications ; elle n'autorise aucune publication.

## Décision proposée et implémentée en sources

1. Matérialiser uniquement des références privées par réseau de lecture, lecteur et portée `pour_vous`. Les dates du post, jamais celles du rattrapage, règlent l'ordre. Les autres portées gardent leurs lecteurs indexés.
2. Distribuer et rattraper par tâches persistées, générations et curseurs ; basculer au seuil explicite de sources seulement après préparation. Borne d'historique et rétention : 30 jours, frontière signalée. Les candidats restent soumis aux liens exacts et aux gardes actuelles, même au-delà des ensembles historiques.
3. L'autorité reste sur la publication et ses parents vivants. Aucun retrait n'attend la purge des entrées. L'effacement classe les nouvelles tables ; l'export ne transforme pas les références en contenu personnel exportable.
4. Purger les seuls téléversements anciens non admis et non réservés après une grâce de 24 heures ; protéger les stages historiques avant le premier passage. Les fichiers admis gardent leur cycle métier. Les compteurs fragmentés existants sont conservés tant qu'aucune mesure ne justifie de les changer.
5. Observer les échecs planifiés avec un agrégat minimal, date et couverture explicites. Les erreurs synchrones demandent un raccordement fournisseur distinct. Aucune erreur brute n'est transportée.
6. Fermer PostHog sur le cloud UE ou un relais explicitement déclaré ; conserver consentement et identité de mesure en mémoire. Aucune rétention multivisite n'est annoncée ni ajoutée silencieusement.
7. Préparer des assertions de charge/restauration séparées de leur exécution. Les outils de lecture de preuves ne publient, ne restaurent ni ne lancent de charge. Le rapport de lancement porte un verdict ouvert jusqu'aux preuves actuelles.

## Conséquences

Les écritures de fil se répartissent entre lecteurs ; une source très suivie produit plusieurs lots plutôt qu'une transaction géante. Le coût de fan-out et de rétention, la couverture après incident, les conflits, le p95 et les cadences restent à mesurer. La limite de 30 jours ne remplace pas l'historique du mur d'un auteur. Les nouveaux schémas/API devront être générés et vérifiés avant commit ou déploiement.

Références : `docs/19_PLAN_EXECUTION_PA10.md`, `docs/20_EXPLOITATION_ECHELLE_ET_RESTAURATION_PA10.md`, `docs/06_RAPPORT_LANCEMENT.md`.
