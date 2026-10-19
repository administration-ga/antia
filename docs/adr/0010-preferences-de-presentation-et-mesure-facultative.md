# ADR-0010 : Préférences de présentation et mesure facultative PA6

- **Statut** : Accepté
- **Date** : 2026-10-17
- **Portée** : consolidation PA6 ; complète ADR-0004, ADR-0008 et ADR-0009.

## Contexte

Les sept familles de surfaces sont montées. La préférence personnelle de fuseau
existait au serveur mais plusieurs lecteurs et la composition d'évènement utilisaient
encore le calendrier du navigateur. Le thème et le raccord de mesure facultative
manquaient à la coque. Au remontage, Convex pouvait rester connecté à un ancien
cache TanStack. Les écritures de conversation contournaient son adaptateur de source.

## Décision

1. Le provider de préférences conserve un premier rendu UTC stable, détecte ensuite
   le navigateur et donne priorité au fuseau personnel valide. Changer de langue,
   fuseau ou apparence ne remonte pas les salles ni les brouillons. Le formulaire
   personnel enregistre explicitement et protège une saisie contre les snapshots
   distants et l'ancien snapshot précédant l'écho d'une mutation.
2. Les dates civiles utilisent Intl avec un fuseau explicite. Les saisies sont
   reconverties puis comparées aux parties civiles demandées : une heure inexistante
   est refusée ; une heure saisonnière répétée choisit son premier instant. Les
   dates invalides et les échecs du convertisseur ne créent aucun évènement.
3. L'apparence système/clair/sombre utilise une clé préfixée par réseau, `.dark` et
   `color-scheme`. Le choix non personnel d'apparence reste lors de la sortie ; les
   clés de brouillons voisines continuent à être purgées. Stockage refusé et absence
   de matchMedia conservent un contrôle utilisable.
4. ConvexQueryClient et QueryClient forment un couple connecté une fois par URL
   dans le document client. Aucun couple n'est partagé entre requêtes serveur.
   Les gardes de session et le remplacement complet du document à la sortie restent
   en place. `MessagerieSource.useMessageWrites()` porte les mutations typées et
   injecte le réseau après les arguments du consommateur.
5. La mesure facultative exige une configuration complète et un consentement global
   `usage_analytics`, versionné, horodaté et révocable. La dernière preuve indexée
   seule est effective, pour conserver un accord/retrait fiable au-delà de cent
   cycles sans parcourir toute l’histoire. Une preuve portée par un réseau
   ne l'active jamais ; aucune adhésion ou connexion ne l'accorde. Le retrait arrête
   le navigateur avant sa mutation et annule les requêtes en cours, même si celle-ci
   échoue. Un nouvel accord crée un nouvel UUID sans remettre le quota à zéro.
6. Le transport PostHog natif projette uniquement catégorie d'écran, réseau admis,
   langue et UUID éphémère. Aucun contenu, handle, IDN, identifiant social, URL privée,
   profil de personne, SDK, replay ou persistance. Dix tentatives par minute, cinq
   secondes par requête, aucun retry automatique, cookie, referrer ou redirection.
   Le point de capture et l'origine CSP proviennent de la configuration de l'app.
   Les catégories sont tirées des routes servies ; les funnels détaillés restent PA10.
7. Le fil distingue une erreur réessayable, un résultat vide et une fenêtre lacunaire.
   Origine et évènement sont rendus depuis leur projection réelle, sans inventer une
   adresse de réseau, des participants ni des droits supplémentaires.

## Conséquences et limites

Les paquets sont utilisables sans configuration de mesure. Les autres applications
peuvent adopter leurs providers via les exports publics ; leurs environnements et
sources restent sous leur propriétaire. La réussite d'un test de transport simulé
ne prouve aucune réception PostHog. La configuration réelle, la résidence UE, la
rétention et les tableaux de mesure nécessitent leur décision et leur recette.

La lecture de source et les tests DOM ne valident pas le contraste rendu, le reflow,
VoiceOver ou les médias réels. Le rapport de parité conserve les recettes Chrome,
sombre/AA et LiveKit/Egress ouvertes. Aucun push ou déploiement de production.

## Références

- [Plan PA6](../09_PLAN_EXECUTION_PA6.md), [rapport de parité](../04_RAPPORT_PARITE_FRONT.md).
- Socle `origin/main` lu à `25398f565`, fichiers copiés conservés avec provenance.
- [API HTTP PostHog](https://posthog.com/docs/getting-started/install),
  [évènements sans profil de personne](https://posthog.com/docs/data/anonymous-vs-identified-events).
