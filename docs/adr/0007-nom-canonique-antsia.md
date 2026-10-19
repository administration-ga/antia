# ADR-0007 : Nom canonique ANTSIA et reprise de l’identité existante

- **Statut** : Accepté
- **Date** : 2026-10-16

## Décision

Le propriétaire confirme **ANTSIA**. Le dossier réel du moteur, ses applications,
paquets, thèmes, espaces i18n, commandes et documents utilisent ce nom.
DIASPORALE importe désormais `@antsia/*` depuis le même moteur.

Le renommage conserve les identités : une reprise locale garde la ligne racine,
son networkId et les adhésions. La résolution des deux slugs reconnaît seulement
une racine, refuse les alias de réseaux fermés et reste soumise au statut actif.
Une collision du nouveau slug refuse la reprise sans écriture partielle.

Avant le montage des surfaces, les préférences et brouillons localStorage et
sessionStorage du réseau courant sont copiés vers le nouveau préfixe, sans
écraser une destination existante ni supprimer une source. Les variables de
développement historiques sont acceptées en repli ; la nouvelle valeur prime.
Les gardes locales et de confirmation restent exigées.

## Conséquences

- Les dossiers réels sont `ANTSIA`, `apps/antsia_ga`, `apps/admin_antsia_ga`.
- Le chemin enregistré de ce chat dans Codex est indisponible à la modification
  par l’outil UI. Un lien temporaire `ANTIA → ANTSIA` maintient cette session ;
  il sera supprimé après rattachement de Codex au nouveau chemin réel.
- Secrets, instance Convex locale et cookies Better Auth restent identiques.
- Les ressources distantes, domaines et dépôts GitHub ne sont pas renommés par
  cette correction locale ; aucune publication n’a été demandée.
- Le code historique nécessaire à la reprise et les noms réels des preuves
  passées sont conservés explicitement.

## Preuves

[Rapport du renommage](../RENOMMAGE_ANTSIA_2026-10-16.md).
