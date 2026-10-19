# P05 — Ergonomie des messages et appels Web

**Dépendance :** P02. **Spécification :** [05](../05_MESSAGES_ET_APPELS.md). **Ownership :** messagerie, hôte d'appel et notification Web ; pas de nouveau protocole de chiffrement.

```text
Depuis la racine ANTSIA, lis et applique le préambule :
docs/etudes/2026-10-18-social-commerce/prompts/PROMPT_COMMUN.md. Implémente seulement P05.

Réutilise MessagesRoute, MessagerieConversationView, MessageComposer, l'adaptateur de source
et l'hôte/pool de communication existants. Présente Conversations/Appels/Contacts, filtres et
recherche ; téléphone pleine page, bureau liste/détail. Les filtres commerciaux attendent P10.
Améliore pièces jointes, vocal et états envoyés/livrés/lus selon les preuves réellement disponibles.
Pas de statut livré ou lu fabriqué par une animation. Conserve brouillons et droits existants.

Clarifie entrant/sortant/sonnerie/connexion/connecté/reconnexion/terminé. Micro, caméra, sortie,
réduction et raccrochage sont accessibles et efficaces. La durée part de la connexion réelle.
Conserve les appels de groupe, leur plafond contractuel et la sortie individuelle ; vérifie
rejoindre/quitter avec trois comptes de recette sans attribuer de droits supplémentaires.
Un appel persiste pendant navigation et thème ; le raccrochage libère les pistes, la déconnexion
ferme définitivement. Ne pas activer la caméra pour un simple appel audio.

Adapte les notifications Web vers une destination ciblée autorisée, sans contenu privé dans
le push, avec revalidation de la session et de l'appel vivant. Ne pas annoncer une sonnerie
native/arrière-plan, ni E2EE, sur cette seule base.

Tests : permissions refusées, jeton tardif, appel occupé, reconnexion, double acceptation,
fin tardive, navigation et absence de remount. Recette audio/vidéo dans les deux sens entre
deux sessions consenties, notification reçue et ouverte si fournisseur disponible. Sinon qualifier
clairement la partie UI/test et conserver la recette externe ouverte.

Livre captures et tableau des scénarios réellement observés. Le contact commercial d'inconnus
est P10 ; ne pas ouvrir les gardes personnelles pour faire fonctionner un bouton vendeur.
```

**Acceptation :** lisibilité et continuité, absence de micro/caméra résiduels après fin, preuves Web distinctes des preuves natives.
