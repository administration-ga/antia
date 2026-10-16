# ADR-0005 : Le studio consomme une salle persistante et les droits du serveur

- **Statut** : Accepté
- **Date** : 2026-10-16

## Contexte

F3a possède déjà la salle LiveKit dans la coque du membre. F3b ajoute les vues du
studio, les propositions d'antenne et la gestion de personnes silencieuses. Le socle
appariait certains participants par leur nom ; deux homonymes pouvaient donc recevoir
la mauvaise mise en avant. Un rôle d'intervenant ne donne aucun droit de gestion.

## Décision

Le studio lit la salle du registre existant, sans autre connexion ni rendu audio.
Il associe les pistes aux `speakers[].personId` avec l'attribut `personId` du jeton
(metadata en repli), puis écarte les spectateurs et les rôles retirés. Le partage
reste un contenu distinct de la caméra ; une épingle locale prime sur le programme.

Les volets se montent sur demande et selon `sessions.get.permissions`. L'annuaire
des admissions reste réservé à la modération et décrit l'historique des admissions.
La recherche privée des relations reste réservée à l'hôte. Les candidats aux
délégations passent par une query paginée qui réutilise la règle d'éligibilité de
`grant`, y compris pour une personne déjà invitée ou à l'antenne.

Une promotion ou rétrogradation exige une nouvelle entrée explicite. Une réponse
de jeton est rejugée contre le rôle courant avant d'être conservée. La convergence
des pistes vers l'intention est suivie dans le propriétaire persistant : un micro
coupé à distance ne doit pas se rallumer après reconnexion ou navigation.

## Conséquences

- Aucune caméra ne s'ouvre à la réception ou acceptation d'une invitation.
- Révocation d'un droit : volet et confirmation concernés disparaissent immédiatement.
- Les commandes restent accessibles sous la scène, y compris en plein écran.
- Les changements de vue ne remplacent pas la connexion, et les homonymes restent distincts.
- Le partage peut s'arrêter lors d'une reconnexion LiveKit ; le reprendre exige un geste.
- Les tests avec salle simulée ne prouvent pas une diffusion SFU réelle. La configuration
  média et la recette audio/vidéo/Egress restent à faire.

## Références

- `docs/04_RAPPORT_PARITE_FRONT.md` (F3a/F3b).
- Socle `direct-scene`, `DirectAntennaPanel`, `ParticipantsPanel`, `direct-preflight`
  au commit `ad2e7fdc2`, identiques pour ces fichiers sur `origin/main` relu.
- `convex/modules/live/permissions.ts`, `delegations.ts` et `sessions.ts`.
