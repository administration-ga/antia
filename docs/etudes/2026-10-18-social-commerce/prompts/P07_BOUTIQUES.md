# P07 — Boutique progressive et page publique

**Dépendances :** P02, P06. **Spécifications :** [06](../06_BOUTIQUES_SERVICES_EMPLOI.md), [08](../08_ARCHITECTURE_INTEGRATION.md). **Ownership :** domaine boutique, routes/surfaces ANTSIA, projections et tests.

```text
Depuis la racine ANTSIA, lis et applique le préambule :
docs/etudes/2026-10-18-social-commerce/prompts/PROMPT_COMMUN.md. Implémente seulement P07.

Pars des pages/signataires existants dans convex/modules/pages et de leurs surfaces. Ajoute les
capacités de boutique définies en P06 et un brouillon accessible au membre déclaré actif. Ne retire
pas globalement la garde verifiee de createPage ; introduis une politique commerciale ciblée,
sans possibilité de créer une page institution/official ni de s'autoattribuer un badge.

Monte le parcours Mon activité, Ma présentation, Mes offres, Publier/Activer. Produits et services
ont les blocs du modèle choisi. Le brouillon peut précéder le lien PRO.GA ; les offres canoniques
attendent P09. Aucune création silencieuse de structure ou de catalogue parallèle.
Les permissions de publication déclarée doivent correspondre à la décision P00 ; sinon livre
le brouillon et qualifie la publication non activée, sans fermer arbitrairement l'étude entière.

Crée une projection publique commerciale dédiée : page active, consentement de diffusion publique,
audience/root explicites, réseau admis et modération relus ; média via garde. Les pages officielles
et les fonctions membre gardent leur règle actuelle. Le DTO ne contient aucun signataire, contact
privé ou état de client. Routes centralisées, métadonnées et noindex adaptés au retrait.

Tests : déclaré crée brouillon, autre personne refusée, institution protégée, rôle révoqué,
suspension, publication non consentie, réseau fermé, retrait et média interdit. Inclure les nouveaux
objets dans limites, modération, export/effacement. Recette déclaré/vérifié/anonyme en clair/sombre,
création puis édition et retrait réels sur données de test.

Livre page et éditeur branchés. Les actions de paiement restent absentes tant qu'elles ne sont
pas admises ; explique les étapes restantes avec une action utile, pas un bouton factice.
```

**Acceptation :** préparer une boutique est ouvert ; publicité de la vitrine, confiance et encaissement restent trois autorisations distinctes.
