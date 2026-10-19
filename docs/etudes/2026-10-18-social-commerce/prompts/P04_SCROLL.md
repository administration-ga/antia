# P04 — Fil immersif et contrôle des médias

**Dépendance :** P03. **Spécification :** [04](../04_PARCOURS_FIL_ET_PUBLICATIONS.md). **Ownership :** fil, pager et coordinateur média, sans modification des droits des posts.

```text
Depuis la racine ANTSIA, lis et applique le préambule :
docs/etudes/2026-10-18-social-commerce/prompts/PROMPT_COMMUN.md. Implémente seulement P04.

Étudie VerticalPager.tsx et son usage StoriesViewerPage ; réutilise les primitives pertinentes
sans transformer les stories ni ajouter un second fil de données. Monte le mode immersif sur le
vrai fil mobile, y compris les portées National/province/tag, avec mode Liste persistant par réseau.
Le bureau garde Liste par défaut et propose Immersion. Garde curseurs, fenêtre lacunaire et
commande accessible de chargement ; ne masque pas la limite actuelle des sources du backend.

Un post principal par hauteur disponible, galerie horizontale indépendante, texte long en détail
normal, safe areas et clavier traités. Pas de snap forcé sur contenu plus haut que l'écran.
Préserve focus, navigation clavier, réduction des mouvements et mode lecteur d'écran.

Crée une coordination de lecture : une vidéo active au maximum, autoplay muet seulement si admis,
contrôle du son, pause hors écran/onglet masqué/appel entrant. Préchargement de la voisine borné,
économie de données sans vidéo anticipée. Retour d'offre/commentaires/profil restaure post/index/offset.
Une insertion de nouveaux posts ne déplace pas la lecture en cours. Les états personnels suivent
la purge de déconnexion existante.

Teste gestes croisés, pause et interruption, réponses de pagination tardives, retrait d'un post,
fin vide avec curseur, restauration après retour, session remplacée. Recette 30 médias mixtes,
faible débit, mobile paysage, zoom et clavier. Mesure mémoire, téléchargements et longues tâches.

Livre la preuve de lecture unique et les budgets observés. Si la primitive ne respecte pas
l'accessibilité d'un scénario, revenir à Liste pour ce scénario plutôt que tronquer le contenu.
```

**Acceptation :** défilement fluide, contrôlable et borné, sans perte de position ni son concurrent. **Limite :** ce lot ne réalise pas à lui seul le fil matérialisé PA10.
