# P08 — Liaison volontaire et transport entre produits

**Dépendance :** P06. **Spécification :** [08](../08_ARCHITECTURE_INTEGRATION.md), §§3–6. **Ownership :** responsables séparés ANTSIA/PRO.GA ; interfaces gelées avant travail parallèle.

```text
Depuis la racine ANTSIA, lis et applique
docs/etudes/2026-10-18-social-commerce/prompts/PROMPT_COMMUN.md et les instructions PRO.GA. Implémente uniquement P08, découpé en deux
sous-tranches séquentielles : double preuve de liaison, puis transport contractuel.

Liaison : session ANTSIA vivante, défi state/nonce à usage unique et durée courte, retour allowlisté,
authentification PRO.GA réelle, choix d'une structure autorisée, consentement aux scopes, échange
serveur du code avec preuve de possession. Aucun mot de passe ajouté à ANTSIA ni SSO supposé.
Conserve le pont de session corrigé ; un code ancien ou une réponse tardive d'une autre session
ne lie rien. Un compte PRO.GA peut avoir plusieurs structures : le choix et le mandat sont explicites.
Persiste lien/consentement/révocation ; toute action sensible relit le mandat à destination.

Transport : raccorde un chemin unique de l'outbox métier PRO.GA à sa fondation d'intégration,
avec octets persistés, leasing, backoff, DLQ et reçu corrélé. Implémente l'adaptateur HTTP/signature
pour ANTSIA et la route privée de commandes côté PRO.GA, selon P06. Aucun import croisé de base.
Les clés sont fournies par le propriétaire via la procédure existante, jamais écrites dans .env
par l'agent. Sans configuration, statut indisponible explicite, aucun envoi vers production.
Le récepteur doit distinguer received/applied/rejected ; les handlers catalogue viennent en P09.

Tests : rejeu, expiration, échange de mauvais compte/structure, retour malveillant, session remplacée,
mandat révoqué, signature et environnement incorrects, conflit de corps, crash avant/après reçu,
reprise d'un bail et absence de double émission. Pas de contenu privé dans logs.

Recette locale/sandbox coordonnée entre les deux backends : lien consenti, révocation et événement
contractuel de test traité par un handler de recette explicitement hors production. Ne pas compter
ce handler comme le raccord du catalogue. Livre preuves et limites, puis arrête le lot.
```

**Acceptation :** une liaison n'est admise qu'avec les deux preuves et un mandat ; transport réellement essayé en environnement autorisé. **Blocage ciblé :** configuration manquante interdit la preuve de transport réel, pas les tests de contrat.
