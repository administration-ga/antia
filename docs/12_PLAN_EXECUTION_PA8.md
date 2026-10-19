# PA8 — Plan d’exécution du réseau public ANTSIA

Date : 2026-10-17. Base : 24d2824 ; branche partagée conservée.
Demande : implémenter PA8 dans les sources servies, en coordination avec DIASPORALE,
puis vérifier. Aucun push, publication, changement d’environnement ou donnée réelle.

## Coordination et ordre

DIASPORALE termine sa tranche confidentialité/retrait et sa recette sur un arbre
figé. Pendant ce créneau : lectures, audits et documentation PA8 seulement.
Les sources PA8 commencent après sa restitution explicite. Son verify ne constitue
pas une preuve du nouveau snapshot PA8. Une seule vérification lourde et un seul
frontend à la fois ; backend local3210 conservé et budget d’analyse15s temporaire
consigné séparément du défaut4s. Aucune modification des délais métier ou des tests.

Propriété : ANTSIA écrit son application et le moteur commun ; DIASPORALE conserve
sa tranche, ses consommateurs, son thème et ses locales. Aucun changement de branche,
de worktree, d’index global ou de fichiers étrangers. Commits par chemins explicites.

## Contrats de confidentialité

1. Les contenus natifs existants `visibility=network` restent membres seulement.
   Autoriser `root` pour un nouveau contenu natif uniquement si l’auteur choisit
   explicitement ce geste avec une audience publique ; aucune migration ni règle
   automatique. Les enfants gardent leur règle et leur contexte d’origine.
2. Les projections anonymes exigent racine active, origine active et liée à cette
   racine, publication vivante, `visibility=root`, audience publique, absence de
   prélecture/retrait de modération et garde des médias. Aucun groupe, abonné,
   contact, facette privée, signataire, état de lecteur ou stockage brut.
3. Profil réduit : publié, non privé, non effacé, admissible dans la racine et non
   modéré. Identité neutre pour l’auteur qui a retiré son profil ; les publications
   conservées restent soumises à leur propre autorisation. Page publique : Officiel,
   active, admise ; aucune page artificielle ni reflet PA9 inventé.
4. Un partage relit son original ; retrait, changement de contexte ou refus rendent
   l’original indisponible. Curseur brut conservé même après une page filtrée vide.
5. Un appel authentifié relit session vivante, sanctions et blocages ; identité
   périmée/refusée ne devient jamais une visite anonyme par repli technique.
6. Corriger également le défaut constaté dans `feed/myFeed` : l’état de modération
   et les droits de l’origine doivent être relus avant enrichissement des candidats.

## Tranches d’implémentation

### A — Moteur public et découverte

- `convex/modules/public/` : prédicats partagés, DTO fermés, lectures annotées
  `@publicProjection`, snapshot public, profils/pages/publications et transparence.
  `networkId` est vérifié comme racine active ; pas d’élargissement de networkQuery.
- API publique cible : `snapshot`, `getPost`, `getProfile`, `getOfficialPage`,
  `listRootPosts`, `pagePosts`, `transparency`. Les listes utilisent une pagination
  native bornée ; payloads datés, refus indistincts et erreurs distinctes des vides.
- `convex/modules/discovery/` : `rootFeed` membre (National, province, tag),
  tendances mesurées bornées et capacité de modération pour l’entrée nationale.
  Réutiliser les cartes de fil et leurs droits, jamais un DTO opérateur brut.
- Province est une attribution volontaire du contenu, stable ; pas de déduction
  depuis l’état civil ni la facette actuelle de l’auteur. Référentiel pur des neuf
  provinces et schéma de facette facultative du réseau racine dans la fondation.
- Agrégats publics matérialisés par tranches chaînées et generation/cursor : aucun
  chiffre en dur, aucune lecture intégrale ou écriture sur document social chaud.
  Tendances indiquent fenêtre/période et éventuelle borne ; petites cohortes masquées.
- Transparence : périodes récentes fixes et total uniquement quand cas et auteurs
  atteignent le seuil ; pas de souscatégories permettant une inférence par différence.
- ANTSIA coordonne schéma, crons, inventaire d’effacement et classification des modules.

### B — Parcours membres et publication choisie

- National, province, tags et découverte adressables, choix province explicite,
  pagination réelle et retour aux portées existantes Pour vous/Récents.
- Choix de publication sans compte à false par défaut ; brouillon personne/réseau,
  remise à false si audience incompatible, retour clair sur l’audience de diffusion.
  Même geste explicite pour une publication native de page ; aucune ouverture implicite.
- `/moderation` : capacités serveur, équipe/périmètre, files/relecture et décisions
  motivées ; les refus et erreurs restent visibles, pas de rôle inventé côté client.
- File des recours réseau réservée à `network_admin`, sans identité ni contenu
  voisin ; la mutation existante exige un décideur indépendant. Motif du recours,
  décision initiale et sanctions permettent le réexamen ; niveau plateforme reste PA7.
- Alias groupes/évènements/direct/albums et paramètres ; droits personnels restent
  accessibles hors coque membre aux personnes suspendues. Coque montée une seule fois.

### C — Application publique, SSR et charte

- Charte documentée dans `05_CHARTE_ANTSIA.md`, tokens du contrat uniquement.
  Vitrine réelle, découverte, profils réduits `/@handle`, pages Officiel `/pages/handle`,
  publications partageables et textes publics ; états vides/refus/indisponibilité.
- Présentation/i18n/apparence au root ; providers de session autour des routes privées
  et d’entrée. Les enfants publics restent présents dans le HTML initial serveur.
- Broker de reçu même origine opt-in pour ANTSIA, corrélé au SDK/session et testé ;
  le transport DIASPORALE par défaut demeure sous sa propriété. Préserver SSO, adoption
  OTT, purge/déconnexion globale et refus d’une identité résiduelle avant adoption.
- Loader par requête, sans cache durable, jeton vivant si credentials présents,
  aucune panne transformée en visite anonyme. Métadonnées et rendu lisent le même DTO,
  canonical depuis origine configurée seulement, refus noindex et titre générique.
- `[publicHandle]` vérifie le préfixe @ : un dossier `@[handle]` serait un slot Next.
- Textes légaux FR/EN : coordonnées/conditions à compléter et validation juriste
  explicitement ouverte. Aucune conformité, résidence ou validation institutionnelle
  affirmée. Sources primaires APDPVP/Journal officiel et EUR-Lex consignées au rapport.

## Vérification et preuve attendue

Après intégration : codegen puis typages/tests/lints obligatoires. Tests d’anonymat
et de non-régression : natif ancien fermé, opt-in nouveau ouvert, enfant network
fermé/root ouvert/retrait propagé, privé/blocage/sanction/origine archivée, page
non Officiel ou retirée, original cité retiré, médias retenus, pagination filtrée
vide, cohorte supprimée, cookie/OTT/session révoquée et panne de jeton fail-closed.

`bun run verify` complet du snapshot partagé ; aucun total additionné aux reprises.
Service3030 et HTML initial réel contrôlés ; routes privées testées sans compte,
SSR/métadonnées publics et refus réels après changements fictifs autorisés en local.
Relecture frontend-design/web-design-guidelines, cliquets de communication et charte.
Chrome/AA, IDN sandbox et médias réels restent des preuves distinctes : un test DOM,
HTML ou statut200 ne les remplace pas. Un refus navigateur antérieur n’est pas contourné.

## Sortie

Rapport `13_RAPPORT_RESEAU_PUBLIC_PA8.md`, ADR dédié, plan d’exécution actualisé,
commits locaux ciblés et Cortex. Mise en ligne seulement sur décision explicite du
propriétaire, A5 et textes juridiques validés ; ici livraison et recette locales.
