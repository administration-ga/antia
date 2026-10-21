# Aperçus photo et vidéo — sept chartes, ANTSIA et démo

Recettes du 21 octobre 2026 : **168/168 aperçus conformes**, sans publication.

| Environnement | Compte utilisé | Rapport | Mesures | Empreintes |
|---|---|---|---|---|
| ANTSIA en production | Session IDN existante du propriétaire | [84 contrôles](antsia/rapport.md) | [JSON](antsia/resultats.json) | [SHA-256](antsia/SHA256SUMS) |
| antsia-demo | Compte de démonstration déjà connecté | [84 contrôles](antsia-demo/rapport.md) | [JSON](antsia-demo/resultats.json) | [SHA-256](antsia-demo/SHA256SUMS) |

Pour chaque environnement : photo PNG et vidéo MP4 × Gaboma, Soleil, Forêt, Corail, Lagon, Électrique, Sable × clair/sombre × mobile 390×844, tablette 820×1180, bureau 1440×1000.

Chaque rapport donne accès aux sept planches récapitulatives. Les dossiers `captures/` contiennent aussi les 84 captures originales par environnement et une capture après nettoyage. Les images sont conservées à l’identique ; seuls les chemins des fichiers de preuve dans les JSON et les liens des rapports sont rendus relatifs au dépôt. Les fichiers de progression redondants et les caches de navigateur sont exclus.

Contrôles : charte et mode réellement rendus, aperçu visible et décodé, absence de débordement horizontal, zéro erreur ou avertissement console. Aucun clic sur Publier ; médias retirés, composeur sans brouillon et publication désactivée. Après rechargement : compte connecté et préférences initiales Clair/Gaboma rétablies. La taille normale de fenêtre est restaurée après la recette.

Limites : **fenêtres émulées dans Chrome**, sans appareils physiques ; aperçu du composeur uniquement. Aucun transfert serveur, scan antivirus, publication ou audit général des autres pages n’est validé par ces recettes. Les captures ne contiennent aucun écran de saisie de PIN ou de consentement IDN. Aucun secret, cookie ou jeton d’authentification n’est joint.

Pour vérifier les empreintes, depuis chaque sous-dossier : `shasum -a 256 -c SHA256SUMS`.

[Manifeste des deux recettes](manifest.json).

[Validation et limites de l’archivage](validation-archivage.md).
