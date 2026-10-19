# P06 — Contrats commerciaux et modèles d'autorité

**Dépendance :** P00. **Spécifications :** [06](../06_BOUTIQUES_SERVICES_EMPLOI.md), [08](../08_ARCHITECTURE_INTEGRATION.md). **Ownership :** contrats purs/docs des deux produits, interfaces et fixtures ; aucune activation commerciale.

```text
Depuis la racine ANTSIA, lis et applique le préambule :
docs/etudes/2026-10-18-social-commerce/prompts/PROMPT_COMMUN.md. Exécute seulement P06 après lecture de 07 et des instructions PRO.GA.

Formalise PRO-COMMERCE-PUBLIC-V1 et PRO-COMMERCE-COMMAND-V1. Sépare projection publique et données
privées de commande/prospect/candidature. Chaque événement/commande a un schéma fermé, des bornes,
un responsable, un cycle de vie, une autorité et une réponse déterministe. Types inconnus refusés.
Définis prix fixed/range/unit/quote, XAF, variantes stables, révision de catalogue et tombstones.
Fixe les mappings personne/réseau ANTSIA, sujet acheteur opaque, tenant/structure PRO.GA, mandat,
page/boutique, consentement. Pas de fusion par e-mail ni d'assimilation badge/autorisation vendeur.

Spécifie idempotence même clé/même corps et conflit même clé/autre corps, séquencement/rejeu,
octets persistés, profils de signature distincts, objectRef compatible et refus hors environnement.
Le réseau est résolu par configuration d'émetteur ; les commandes privées portent des scopes
minimaux et revalident le contexte à destination. Définis les réponses de statut après timeout.

Définis les capacités brouillon/vitrine/contact/achat et les états de liaison, publication,
demande, réservation, paiement et commande. Documente migrations additives, clients anciens,
projections anonymes et privées, export/effacement/rétention, quotas et journal minimal.

Implémente uniquement les validateurs/types purs et fixtures contractuelles nécessaires dans
les emplacements confirmés des deux repos ; aucune dépendance runtime vers le repo voisin.
Ne modifie pas l'inbox générale pour rendre permissifs les contacts ou IDs actuellement refusés.
Tests partagés par fixtures copiées/versionnées : payload imbriqué interdit, révision retardée,
référence invalide, montant/devise incohérents, événement inconnu et duplication conflictuelle.

Livre spécification, exemples synthétiques non sensibles, compatibilité et tests. Les handlers,
transport et projections restent P08/P09. Aucune déclaration « synchronisation livrée » ici.
```

**Acceptation :** les deux équipes peuvent implémenter sans inventer la portée ni les formats ; les écarts des deux protocoles existants sont résolus explicitement.
