# PA7 — Console du moteur

Date : 2026-10-17. Base locale : 81b8730 ; le chantier reste dans le checkout partagé.

## Périmètre et contrats

1. Autorité : une session Better Auth vivante issue du callback IDN, preuve serveur
   loa ≥ 2 et rôle opérateur explicite encore vivant. Un ancien lien IDN ne transforme
   pas une connexion OTP en session de console. Accès au journal tracé par session.
2. Réseaux : création et réglages administrateur, facettes/pays/thème/politique,
   résolution publique sans déploiement. Archivage par demande motivée puis approbation
   d’un autre administrateur : expiration, session/rôle du demandeur relus, réglages
   inchangés et consommation transactionnelle. Aucune suppression de réseau.
3. Équipes : création et attribution à des membres actifs, projection limitée,
   opt-in des réseaux gouvernés respecté. Aucun octroi automatique d’adhésion.
4. Opérations : recours plateforme paginés, émetteurs par environnement et références
   de clés, reçus et lettres mortes sans corps signé, résultat de rejeu honnête,
   pages d’institution Officiel par décision motivée, incidents et journal.
5. Santé : instantanés matérialisés en tranches de 50 lignes, génération et curseur
   protégés. Horodatage et calcul en cours visibles ; aucune prétention de comptage
   atomique ni de supervision d’un fournisseur.
6. Export : douze périodes agrégées, seuil de cinq cas et cinq auteurs, suppression
   des sous-catégories et compléments inférieurs au seuil ; aucune identité ni texte.

## Répartition dans le code réel

- Coordinateur : garde et preuve de session IDN, demandes d’archivage, rôles serveur,
  intégration des tables/registre des données/audit/dépendances, tests transverses,
  codegen, verify, recette locale et rapport final.
- Exécution backend : platform/console.ts, consoleTables.ts et console.test.ts.
- Exécution accueil/réseaux : application admin, entrée IDN seule, garde UX,
  navigation, formulaires et ressources admin FR/EN.
- Exécution opérations : panneaux montés, pagination, actions motivées, retours
  utilisateur et ressources operations FR/EN.

Les chemins DIASPORALE, suggestions et ses travaux PD4 sont conservés. Aucun
changement de branche, déploiement, secret, environnement réel ou base externe.

## Vérification

- Codegen sous Node supporté avant typage et tests ; un seul job lourd.
- Tests des gardes : anonyme, OTP malgré ancien lien IDN, loa 1, révocation,
  double validation distincte, demande périmée/modifiée/consommée, rôle révoqué.
- Création de réseau générique, résolution par slug et adhésion d’une personne
  sans redéploiement ; audits transactionnels et refus sans effet.
- Tests des panneaux, réseau changé, pagination, données masquées, erreurs,
  doublons de soumission et export fermé.
- Verify complet, puis service console 3032/backend local. Observation navigateur
  et recette IDN réelle séparées : les clients sandbox restent non configurés.
- Documentation et Cortex actualisés avec preuves actuelles et limites.
