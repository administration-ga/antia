# P03 — Publications inspirées d'Instagram

**Dépendance :** P02. **Spécifications :** [03](../03_DESIGN_SYSTEM.md), [04](../04_PARCOURS_FIL_ET_PUBLICATIONS.md). **Ownership :** PostCard/PostMedia, carte publique SSR et tests associés.

```text
Depuis la racine ANTSIA, lis et applique le préambule :
docs/etudes/2026-10-18-social-commerce/prompts/PROMPT_COMMUN.md. Implémente seulement P03 après relecture du partage récemment modifié.

Réutilise PostCard.tsx, PostMedia.tsx dans features/reseau-personnel et public-post-card.tsx dans
l'app. Applique auteur/média/actions/légende/offre facultative ; traite photo, quatre images,
vidéo, texte seul, partage, événement et direct. Conserve les capacités existantes et leur garde.
Remplace le 16:10 imposé par une présentation adaptée au ratio ; ne déforme pas le média ni ne
masque ses informations. Galerie horizontale avec index, flèches, clavier, alt et visionneuse.
Respecte les bornes actuelles de fichiers et leur admission ; ne relève pas les plafonds sans lot.

Préserve réagir/commenter/partager/copier le lien/enregistrer, avec auteur et origine fiables.
La carte publique garde un DTO allowlisté et un rendu SSR sans faux provider membre. Les actions
qui exigent une connexion conservent un retour vers l'objet après authentification autorisée.
Une offre liée utilise un slot typé facultatif, vide jusqu'à P09, sans donnée fictive.

Tests comportementaux : galerie, clavier, erreurs de médias, contenu retiré, partage privé/public,
absence de fuite de données dans SSR. Recette avec un post exact photo, galerie et vidéo après
recharge et chez un second lecteur autorisé. Vérifie tailles téléphone/bureau, clair/sombre,
contraste des légendes et longues chaînes. Les réactions multiples restent accessibles.

Livre les captures et références de recette, avec les limites audio/vidéo réellement observées.
N'active pas encore de lecture automatique ni de scroll immersif ; ils appartiennent à P04.
```

**Acceptation :** présentation cohérente sur fil, profil, page et public ; les contenus et droits existants sont conservés ; médias accessibles au lecteur réel.
