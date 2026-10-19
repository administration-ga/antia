# P16 — Confiance, modération et cycle des données

**Dépendances :** P07–P15 applicables à la version candidate, avec leurs gardes déjà livrées. **Spécifications :** [06](../06_BOUTIQUES_SERVICES_EMPLOI.md), [08](../08_ARCHITECTURE_INTEGRATION.md), [10](../10_RECETTE_MESURES_ET_RISQUES.md). **Ownership :** revue transverse ; corrections attribuées aux propriétaires ANTSIA/PRO.GA, console et contrats.

```text
Depuis la racine ANTSIA, lis et applique le préambule :
docs/etudes/2026-10-18-social-commerce/prompts/PROMPT_COMMUN.md. Exécute seulement P16 sur une version candidate identifiée.
Les gardes, la modération et l'effacement sont obligatoires dès chaque lot ; cette revue ne
permet ni de les reporter ni de clôturer des dépendances manquantes. Liste les lots applicables,
leurs preuves et les exclusions justifiées avant toute correction.

Relis 02_AUDIT_ANTSIA.md, 07_AUDIT_PRO_GA.md, les ADR adoptés, convex/modules/pages,
public, federation, people/erasure.test.ts et les domaines commerciaux effectivement ajoutés.
Inventorie chaque nouvelle table, index, fichier, projection, événement et job : propriétaire,
networkId ou tenant/structure, accès, pagination bornée, export, retrait, rétention et effacement.
Complète les inventaires et cliquets existants ; aucune table commerciale ne reste hors couverture.

Formalise les décisions de modération commerce : admission d'une vitrine déclarée, secteurs
restreints, usurpation, signalement, décision motivée, recours et accès minimal du support.
Ne déduis ni mandat vendeur ni encaissement d'un badge. La lecture anonyme d'une boutique admise
passe par sa projection allowlistée ; brouillons, signataires, clients, achats, CV et conversations
restent privés. N'ouvre pas globalement les pages institutionnelles ou la messagerie personnelle.

Vérifie la révocation d'un mandat, d'une liaison, du consentement et la suspension racine pendant
conversation, checkout et traitement asynchrone. Ferme les nouvelles opérations immédiatement
côté autorité ; invalide les capacités et retire les projections sans résurrection par événement
ancien. Préserve une voie habilitée pour suivi, annulation, remboursement et obligations antérieures.

Distingue retrait public, minimisation sociale et conservation transactionnelle justifiée.
Consigne responsable, finalité, accès et durée validée ; n'invente aucune durée légale. Ne détruis
ni facture ni engagement nécessaire, ne réécris aucune pièce signée. Prévois purge bornée,
réconciliation des reflets et expurgation des copies selon la politique adoptée.

Tests négatifs : autre réseau/structure/acheteur, mandat révoqué, membre suspendu, accès anonyme,
ancien lien média, signature/environnement invalides, rejeu et conflit d'idempotence. Vérifie prix
reconfirmé, dernier stock concurrent, retrait pendant paiement, callback tardif et absence de
fuite dans logs/push. Une signature de service ne remplace jamais l'autorisation métier.

Livre matrice menace → garde → test → preuve, décisions restantes et corrections vérifiées.
Utilise codegen et suites ciblées selon le préambule, puis verify sur sources stabilisées.
Une politique non validée bloque sa capacité ; aucun encaissement réel ni suppression de données
n'est autorisé par ce prompt.
```

**Acceptation :** aucune lacune critique ouverte sur les capacités annoncées ; révocation et cycle des données éprouvés. **Limite :** la revue technique ne vaut ni validation juridique ni publication.
