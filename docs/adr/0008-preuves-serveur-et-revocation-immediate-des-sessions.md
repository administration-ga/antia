# ADR-0008 : Preuves serveur et révocation immédiate des sessions

- **Statut** : Accepté
- **Date** : 2026-10-16
- **Portée** : PA4, précise ADR-0002 sans le remplacer.

## Contexte

Le moteur partage son identité entre plusieurs origines. Un JWT de trente minutes et un résidu local ne suffisent pas à prouver une session encore active. Un rattachement implicite par e-mail peut aussi réunir deux identités sans geste explicite ; un compte SMS possède une adresse technique non vérifiée.

## Décision

- Better Auth reste l'unique émetteur. Le callback OIDC central est stable sur `SITE_URL` ; le portail IDN et les secrets restent au propriétaire.
- Une autorisation relit toujours la session Better Auth désignée par `sessionId`, son sujet et son expiration. La garde commune ne possède aucune exception locale.
- La preuve IDN vient exclusivement du callback `/userinfo` puis d'un compte IDN corrélé. Les fonctions publiques de liaison n'acceptent ni `sub` ni contact.
- Les liens sociaux locaux gardent seulement l'empreinte d'un canal actuellement vérifié. Aucun nom civil ni profil ne se crée depuis une preuve externe.
- Le rattachement IDN à un compte léger exige une session de ce compte et un parcours IDN explicite. Les adresses peuvent différer ; la fusion implicite par e-mail est désactivée. Les collisions entre personnes sont refusées.
- Le transfert entre origines est fermé sur une liste d'origines explicites, une consommation unique et la stabilité de la session pendant la requête.
- La déconnexion révoque toutes les sessions serveur puis purge nominalement l'origine courante et recharge. Les autres onglets perdent l'autorisation serveur immédiatement ; leur garde réactive recharge la session et nettoie les résidus.

## Conséquences

Chaque accès protégé coûte une lecture du composant de session. Une panne est propagée, jamais convertie en autorisation. L'arrivée après un transfert périmé exige une nouvelle connexion. Une session OTP ne peut revendiquer un badge IDN par ses arguments. Le harnais de tests construit de vraies sessions du composant, sans échappatoire dans le code de production.

Les preuves IDN restent minimales mais personnelles : leur effacement effectif doit être inclus dans PA5. La preuve de fonctionnement chez IDN reste une recette sandbox distincte des tests locaux, impossible tant que les clients ne sont pas configurés.

## Références

- [Rapport PA4](../05_RAPPORT_IDENTITE_PA4.md).
- [ADR-0002](0002-identite-idn-unique-comptes-legers-badges-calcules.md).
