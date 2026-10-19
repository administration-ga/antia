# Correction du nom : ANTSIA — 16/10/2026

Le nom est confirmé par le propriétaire. Les sources réelles du moteur et de
DIASPORALE, leurs manifestes/imports, thèmes, traductions, scripts, Dockerfiles,
catalogue et documentation ont été corrigés. Le dossier principal est ANTSIA,
les applications sont `apps/antsia_ga` et `apps/admin_antsia_ga`, les paquets sont
`@antsia/*`. Les versions des dépendances n’ont pas changé.

## Conservation des données

- Déplacement en place : 4 550 fichiers locaux de configuration/données comparés
  avant/après, identiques. Aucun environnement réel édité par l’agent.
- Reprise locale de la racine sur la même ligne : networkId inchangé, aucune
  racine ni aucun réseau supplémentaire créé ; nom/slug/thème ANTSIA/antsia.
- Les profils, adhésions, contenus, blobs et l’identité du backend sont conservés.
- Préférences/brouillons migrés avant hydratation des stores, indépendamment pour
  localStorage/sessionStorage ; sources conservées et destination existante prioritaire.
- Compatibilité des variables de développement historiques, priorité à la nouvelle
  valeur ; double garde des graines et condition locale des outils intactes.

## Vérification

- Installation puis installation avec lockfile figé : code 0 ; 45 liens `@antsia`
  contrôlés dans les espaces du moteur et DIASPORALE.
- `bun run verify` final : **code 0**. Codegen Node22, typage Convex/tests et dix
  espaces, 1 111 tests moteur, 53 cliquets, 24 scripts, 50 tests API (sept nouveaux),
  2 891 social-features et tous les autres espaces verts ; lint neuf espaces sans
  erreur. Avertissements hérités inchangés : six UI et 69 social-features.
- Quatre cas moteur nouveaux : résolution/reprise sans doublon, collision avec
  transaction inchangée, refus d’alias fermé/archivé, gardes et priorité des variables.
- HTTP local 3030 : 200, titre ANTSIA, `data-charte="antsia"` et CSS compilée/servie.
  L’utilitaire Tailwind `antialiased` et la licence restent intacts.
- Log final : `/tmp/antsia-rename-verify.log`. Le navigateur Chrome refuse la prise
  en charge de l’onglet (délai CDP) : aucune recette visuelle authentifiée nouvelle
  n’est revendiquée. Les preuves HTTP et moteur sont actuelles.

## Exceptions explicites

Le code historique restant sert uniquement la reprise du slug, des préfixes et
des variables, avec ses tests. Les preuves F3 et le dépôt GitHub historique gardent
leurs noms réels. Les termes `antialiased`, `substantial` et `substantially` ne sont
pas des noms de projet et restent inchangés.

Codex conserve le projet enregistré sous son ancien chemin. L’outil UI bloque
la modification de cette application : un lien temporaire `ANTIA → ANTSIA` garde
ce chat fonctionnel. Il n’existe qu’un dossier réel, ANTSIA. Le rattachement du
projet Codex au nouveau chemin permettra de retirer ce lien. Aucun push,
déploiement, changement de domaine ou renommage de ressource distante effectué.
