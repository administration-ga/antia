# PA10 — Échelle et préparation au lancement

Date : 18 octobre 2026. Demande : implémenter PA10 dans les sources réelles, **sans exécuter les vérifications**.

## Périmètre et méthode

1. Réutiliser les compteurs, la garde des médias, les tableaux opérateurs et la mesure consentie existants ; ne pas recréer ces modules.
2. Ajouter un fil matérialisé indexé par réseau, lecteur et portée : références de publications seulement, distribution paginée, reprise et rattrapage des sources, seuil explicite de sélection. Les droits vivants restent appliqués à chaque lecture ; les retraits ne dépendent jamais de la fin d'un travail asynchrone.
3. Compléter les traitements bornés des fichiers orphelins, la rétention et les points d'observation opérationnels. Aucune suppression de données n'est exécutée pendant cette intervention.
4. Compléter la mesure d'entrée et par réseau avec accord préalable, configuration UE fermée et projection sans contenu ni identité civile. Une rétention entre plusieurs visites ne peut être annoncée sans décision explicite sur une identité de mesure persistante.
5. Préparer un exercice de sauvegarde/restauration sur cible jetable et une campagne R8 (5 000 abonnés, 10 000 réactions). Les outils restent inertes sans invocation explicite ; aucune cible distante n'est utilisée ici.
6. Écrire `docs/06_RAPPORT_LANCEMENT.md` : matrice de parité, audits, accessibilité, charge, configuration du propriétaire, risques et passation. Séparer sources présentes, preuves historiques et contrôles PA10 non exécutés.

## Répartition

La préparation et les raccordements partagés sont pilotés dans ce chat. Les exécutions indépendantes sont confiées aux agents executor : fil ; fichiers/compteurs ; observabilité. Leurs responsabilités de fichiers sont fixées après lecture des modules existants. Chaque agent conserve les modifications des autres sessions.

## Contraintes de cette livraison

- Aucun codegen, test, typecheck, lint, build, serveur, audit automatique ni recette navigateur.
- Aucun commit (la vérification obligatoire avant commit est différée), changement de branche, installation, publication, modification de secret ou de `.env` réel.
- Aucun travail dans les modules DIASPORALE, les fichiers de transfert de session réservés ou le producteur du socle.
- Les nouvelles fonctions restent raccordées aux modules et aux routes actuels. Les scénarios de test peuvent être écrits, sans exécution.
- Un rapport complet ne vaut pas autorisation de lancement : performances, restauration, AA, identité réelle et livraison des médias restent à constater ultérieurement.

## État des sources et passation

Les ajouts sont raccordés au schéma, aux publications natives/fédérées, aux retraits et
restaurations, aux relations/adhésions/habilitations et au fil existant. Le panneau Santé,
la mesure d'entrée après accord, les accès indexés de données et le passage de protection
des copies temporaires font partie du lot. Les réservations de médias ont été coordonnées
avec le catalogue P09 du chat voisin, sans modifier ses producteurs.

Les scénarios de test sont écrits mais non exécutés. Le rapport de référence est
`docs/06_RAPPORT_LANCEMENT.md` ; les procédures différées sont dans `docs/20`.
Le cahier, le plan principal, README, CLAUDE et la mémoire Obsidian distinguent les
sources PA10 des preuves historiques. L'ADR-0020 demeure proposé.
