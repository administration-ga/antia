# P09 — Catalogue PRO.GA dans les boutiques et publications ANTSIA

**Dépendances :** P07, P08. **Spécifications :** [06](../06_BOUTIQUES_SERVICES_EMPLOI.md), [07](../07_AUDIT_PRO_GA.md), [08](../08_ARCHITECTURE_INTEGRATION.md). **Ownership :** un responsable de chaque dépôt ; schéma partagé réservé.

```text
Depuis la racine ANTSIA, lis et applique le préambule :
docs/etudes/2026-10-18-social-commerce/prompts/PROMPT_COMMUN.md. Implémente seulement P09, producteurs PRO.GA puis consommateur ANTSIA.

Côté PRO.GA, conserve les modes de prix et XAF. Ajoute une référence métier stable aux variantes
et une révision publiée cohérente offre/variantes. Les anciens objets continuent à être lus ;
backfill borné et idempotent. Crée les DTO publics et producteurs pour publication, modification,
pause, retrait, variante, collection et disponibilité. Un registre d'événements sans producteur
ne compte pas. Site/vendeur/offre retirés ferment la projection. Publication ANTSIA consentie.

Côté ANTSIA, branche le vrai handler PRO-COMMERCE-PUBLIC-V1 avec mapping émetteur/réseau/boutique,
révision monotone et tombstones. Réception 202 distincte de applied. Ajoute les projections indexées,
catalogue et filtres, fiche produit/service et slot d'offre dans le post. Aucun achat encore simulé.
Respecte prix fixe/intervalle/unité/devis, disponibilité indicative et fraîcheur. Un stock précis
interne ou un prix variant non versionné ne sort pas par accident.

Les médias étrangers suivent une chaîne d'import/admission autorisée, avec type/taille, provenance,
retrait et garde de délivrance. Pas d'URL de stockage voisine directement exposée, pas d'import
de _generated PRO.GA. Carte privée et SSR public conservent les règles de diffusion explicite.

Tests : prix/variante changés, pause sans archivage, site dépublié, consentement retiré, doublon,
événement hors ordre après tombstone, mauvais tenant/réseau, média retenu. Réconciliation bornée
et reprise DLQ essayées. Recette croisée : publier une offre de test, la lire dans ANTSIA, modifier
prix et photo, retirer, puis vérifier tous les lecteurs et anciennes URLs.

Livre références de recette et preuve d'effet appliqué. Une carte reçue dans l'inbox ou créée
manuellement ne termine pas le lot. Préserve les commandes historiques lorsque l'offre est retirée.
```

**Acceptation :** catalogue unique, révisions cohérentes et retrait effectif ; produits, services et prix « sur devis » rendus correctement.
