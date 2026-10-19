# P10 — Questions au vendeur et continuité CRM

**Dépendances :** P05, P07, P09. **Spécifications :** [05](../05_MESSAGES_ET_APPELS.md), [06](../06_BOUTIQUES_SERVICES_EMPLOI.md), [08](../08_ARCHITECTURE_INTEGRATION.md).

```text
Depuis la racine ANTSIA, lis et applique le préambule :
docs/etudes/2026-10-18-social-commerce/prompts/PROMPT_COMMUN.md. Implémente seulement P10.

Crée le canal commercial défini en P06 : demandeur, boutique, offre facultative, équipe autorisée,
état de demande/acceptation et blocage. Réutilise les composants et adaptateurs de messagerie.
N'ouvre pas les fils personnels à tous en supprimant leur garde de relation acceptée.

Depuis une offre, Poser une question montre l'objet concerné et permet une demande bornée.
Avant acceptation, limite messages/pièces et n'autorise aucun appel automatique. La boutique
accepte, refuse, bloque ou signale. Quotas par membre/boutique, refus indistinct quand nécessaire.
Les participants de l'équipe relisent leur mandat, droits lecture/réponse distincts du CRM.

Ajoute contexte commercial et statut de demande aux écrans sans divulguer le nom d'un autre client.
Appeler devient possible seulement selon acceptation et préférences du destinataire, en réutilisant
les gardes appels. Une conversation est autorisée dans son réseau et ne se transfère pas dans
un autre réseau par un partage de lien.

Option prévue dans ce lot : transformer une demande en prospect PRO.GA par consentement explicite,
avec seulement texte/coordonnées choisis et référence de corrélation ; pas d'export du fil entier.
Raccorder la commande privée et dédupliquer la demande dans le CRM. Si cette option n'est pas
activée, ne pas prétendre qu'une question ANTSIA est déjà un prospect dans PRO.GA.

Tests : inconnu admis, refus, spam, blocage, équipier révoqué, autre réseau, doublon après timeout,
retrait de consentement et pièces retenues. Recette acheteur/vendeur avec deux comptes de test,
réponse identifiée, recherche du fil, passage à l'appel consenti et retour à l'offre.
Étendre modération/export/effacement dès ce lot. Livre code branché et preuves par état.
```

**Ownership :** messaging/source de communication et domaine boutique ANTSIA ; CRM PRO.GA seulement pour la commande explicitement prévue. **Acceptation :** contact possible sans relation préalable, sans ouverture générale des messages et appels.
