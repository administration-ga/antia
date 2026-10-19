# P18 — Accessibilité, performance et couverture du fil

**Dépendance :** version candidate stabilisée ; P16 pour version commerciale, P17 si natif annoncé. **Spécifications :** [04](../04_PARCOURS_FIL_ET_PUBLICATIONS.md), [10](../10_RECETTE_MESURES_ET_RISQUES.md).

```text
Depuis la racine ANTSIA, lis et applique le préambule :
docs/etudes/2026-10-18-social-commerce/prompts/PROMPT_COMMUN.md. Exécute seulement P18 sur une version précisément inventoriée.

Établis une matrice surfaces/acteurs/largeurs/thèmes. Mesure les tâches du protocole 10 sur
320/375/393/440/768/960/1280/1440 px, paysage, zoom 200 %, clavier et lecteur d'écran. Vérifie
ordre de focus, feuilles et restauration, libellés, erreurs, annonces de chargement, textes alternatifs,
sous-titres disponibles, réduction des mouvements, cible tactile et contraste de tous les états.
Corrige les blocages dans les composants réels, en conservant les primitives et consommateurs.

Sur appareil de référence et réseau contraint, relève premier contenu utile, longues tâches,
mémoire après 30 posts, nombre de médias actifs/téléchargés, consommation de données et reprise.
Mesure aussi lectures/écritures Convex, latence de projection, contention du stock et délais paiement.
Les cibles de 10 sont des objectifs, pas des résultats à inscrire avant mesure. Distingue backend,
client et temps du fournisseur. Ne lance pas une charge lourde sur la production ni la machine 16 Go.

Traite la limite constatée des 200 sources du fil : si la version vise un réseau dépassant cette
couverture, planifie puis implémente une sous-tranche PA10 de fil matérialisé, curseurs stables,
fan-out borné, retrait et rattrapage d'abonnement, plutôt que masquer l'avertissement. Vérifie
droits au moment de lire et retrait propagé. Tant que ce lot manque, qualifier la couverture et
borner le pilote ; ne pas appeler le fil exhaustif.

Tests fonctionnels de pagination lacunaire, changement de droits, dernier stock et reprise ;
mesures avant/après sur les mêmes fixtures. Corriger puis recontrôler seulement les zones affectées
et les dépendances justifiées. Rapporter tout défaut bloquant ouvert et son propriétaire.

Livre rapport accessible/performance avec appareils, réseau, source stable et résultats bruts
utiles. Une capture de bureau ne prouve pas le confort sur un téléphone ni un appel en arrière-plan.
Le build, s'il est nécessaire, respecte ressources/disque et n'entraîne aucune publication.
```

**Acceptation :** aucun blocage des parcours retenus ; budgets et couverture réellement mesurés ; limitations explicites avant pilote.
