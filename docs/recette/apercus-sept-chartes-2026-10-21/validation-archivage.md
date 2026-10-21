# Validation de l’archivage

Cette livraison ajoute uniquement les rapports et preuves des deux recettes, dans ce dossier. Elle est construite depuis `main` distant, sans reprendre les modifications du code de l’arbre partagé.

Contrôles réalisés avant commit :

- 168 combinaisons d’aperçu distinctes : 84 en production et 84 sur la démo.
- Sept chartes effectives par environnement ; modes, décodage, visibilité et dimensions conformes aux résultats des recettes.
- 184 JPEG lisibles : 168 captures d’aperçu, 14 planches et deux captures finales.
- Toutes les images copiées à l’identique ; empreintes SHA-256 vérifiées.
- JSON valides, liens Markdown locaux résolus et chemins de preuve relatifs.
- Aucun chemin personnel ni secret détecté dans les textes livrés ; captures relues lors des recettes.
- Contrôle Git limité à ce dossier ; branche et index de l’arbre partagé préservés.

La commande complète `bun run verify` a aussi été lancée sur l’arbre partagé existant, conformément aux consignes du projet. Génération et typages réussis. La suite Convex est restée sans résultat de test pendant plusieurs minutes et cette seule exécution a été interrompue ; **aucun succès global n’est revendiqué**. Les tests et lints applicatifs en aval n’ont pas été exécutés. Cette limite est distincte des 168 contrôles navigateur des recettes et des contrôles d’intégrité ci-dessus ; aucune correction métier n’est incluse dans ce commit documentaire.
