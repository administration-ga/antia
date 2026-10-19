# P02 — Navigation téléphone et bureau

**Dépendance :** P01. **Spécification :** [04](../04_PARCOURS_FIL_ET_PUBLICATIONS.md). **Ownership :** app ANTSIA, coque et contrats de routes sous réservation.

```text
Depuis la racine ANTSIA, lis et applique le préambule :
docs/etudes/2026-10-18-social-commerce/prompts/PROMPT_COMMUN.md. Implémente seulement P02.

Pars de apps/antsia_ga/src/lib/routes.ts, components/network-shell.tsx et des coques réelles
de packages/social-features/src/shell. Conserve les hôtes communication/direct persistants.
Ajoute la navigation mobile Fil, Découvrir, Créer, Messages, Profil et son rail bureau. Créer
ouvre un choix utile, sans route morte. Garde cloche, recherche, retour accueil et déconnexion.
Préserve tous les liens actuels vers groupes, événements, relations, National/province/tag,
modération et paramètres en les replaçant explicitement dans les menus et écrans.

Définis une capacité de présentation ANTSIA injectée par l'app ; n'impose pas la nouvelle coque
à DIASPORALE. Déclare les routes nécessaires et les clés FR/EN. Les destinations commerciales
futures ne montrent pas de faux catalogue : réserver leur extension, puis les afficher avec P07/P09.
Respecte bascule 960 px, safe areas, clavier, focus et retour navigateur. La navigation ne doit
ni perdre la session corrigée ni recréer un appel.

Vérifie navigation clavier, libellés, liens profonds, recharge sur une sous-route et portée
du réseau ; tests de routage adaptés. Recette 320/393/768/1280 px, clair/sombre et zoom 200 %.
Ouvre un brouillon puis navigue, et vérifie sa conservation selon le mécanisme existant.

Livre un plan avant/après des destinations, la liste des routes conservées/ajoutées, captures
et bilan de non-régression des consommateurs. Pas de refonte du lecteur média dans ce lot.
```

**Acceptation :** aucune fonctionnalité existante devenue introuvable ; mêmes destinations compréhensibles sur les deux formats ; aucune double coque d'appel.
