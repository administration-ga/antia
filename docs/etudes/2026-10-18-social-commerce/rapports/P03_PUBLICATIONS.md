# P03 — Publications : reprise de la session Claude

18 octobre 2026. Demande : continuer le plan à partir du travail Claude ANTSIA.
Références : [prompt P03](../prompts/P03_PUBLICATIONS.md),
[parcours](../04_PARCOURS_FIL_ET_PUBLICATIONS.md),
[réservations et relais](../EXECUTION.md), ADR-0017.

**Verdict : sources complétées et raccordées ; tests écrits, non exécutés ; recette ouverte.**
Les vérifications restent différées à la demande humaine. Aucune capture, validation de média
chez un second lecteur, compilation ou publication n'est attribuée à cette reprise.

## 1. Point de départ établi

- Session Claude `b8c43fef-d43d-497e-8cf8-7e62e92a3958`, interrompue sur limite de session
  pendant P03/P05/P07 ; historique lu par fenêtres bornées, confronté aux fichiers.
- Branche partagée `codex/pa4-identite-session`, base locale `9eaff40` ; les modifications
  non commises de PA9, DIASPORALE, accueil, partage et « Mon fil » sont préservées.
- P00/P01/P02/P06 possèdent déjà des rapports. Le thème et la navigation sont présents.
  Claude avait déjà branché `postPresentation="media"` dans `NetworkShell`, créé le lecteur
  média et la légende, puis commencé la nouvelle carte connectée.
- L'examen du source a relevé des clés de traduction manquantes, une variante non propagée
  au partage, des états de présentation conservés lors d'un remplacement du contenu et une
  carte publique encore distincte du nouveau lecteur.

## 2. Comportement raccordé

### Carte connectée

La variante ANTSIA conserve l'ordre auteur → média → actions → légende. Les publications
de texte seul restent intégrales à hauteur naturelle. Photos, galerie, vidéo, partage,
événement et direct conservent les composants et les gardes déjà présents.

La présentation s'active par `NetworkProvider postPresentation="media"`. La variante
`classic` reste disponible aux applications qui ne la déclarent pas. Les gestes de partage,
copie du lien, réaction, commentaire, enregistrement et signalement restent raccordés aux
fonctions existantes ; aucune fonction serveur n'est remplacée.

Les cadres suivent les dimensions déclarées ou mesurées, dans les bornes du lecteur, avec
`object-fit: contain`. La galerie propose index, flèches, clavier et visionneuse. La vidéo
garde ses commandes natives, `playsInline` et le préchargement des métadonnées ; aucune
lecture automatique n'est ajoutée. Un changement de série de médias réinitialise sa
présentation, ses erreurs et sa visionneuse. La légende se réinitialise avec son contenu.

La palette des réactions possède un accès explicite au toucher et au clavier. Les
traductions manquantes sont ajoutées dans les deux langues, sans remplacer les clés du partage.

### Carte publique

`public-post-card.tsx` reste une projection serveur : identité, origine, corps, dates et
liens proviennent du DTO public autorisé. Le lecteur `PublicPostMedia` utilise le même
`PostMedia` en variante `media`, avec les seuls médias de ce DTO ; il ne monte ni session,
ni client Convex, ni `NetworkProvider` de substitution.

La carte et le partage public affichent le média avant la légende. La longue légende utilise
une divulgation native `<details>` : le texte complet et ses liens sont présents dans le
HTML initial et restent accessibles sans JavaScript. Un texte sans média est intégral.
L'origine du partage reste distincte de celle de son relais. Une retenue de fichier interdit
toute utilisation de son URL, même si un DTO incohérent en contient une.

### Retour après connexion

Le lien « Entrer pour participer » transporte uniquement un identifiant opaque dans le
paramètre `publication`. `/entrer` et `/bienvenue` le valident et le conservent dans la
connexion IDN, le succès OTP, le changement connexion/inscription et l'accueil d'un membre.
La destination finale est construite par `routes.memberPost`, jamais fournie sous la forme
d'une URL libre. Le moteur relit ensuite les droits de la publication.

Une session restreinte conserve sa priorité vers les données et recours. La barrière de
déconnexion incomplète reste active. En l'absence de continuation, les destinations
historiques restent les mêmes. Aucun des cinq fichiers du pont de session gelés n'est modifié.

## 3. Périmètre des fichiers

| Domaine | Fichiers principaux |
|---|---|
| Carte connectée et états | `packages/social-features/src/features/reseau-personnel/PostCard.tsx`, `PostCardCaption.tsx`, `PostMedia.tsx`, `PostMediaPresentation.tsx`, `PostReactionControl.tsx`, `post-card-caption.ts`, `post-media-frame.ts` |
| Traductions partagées | `packages/social-features/src/i18n/locales/{fr,en}/reseau.fil.json` |
| Projection publique | `apps/antsia_ga/src/components/public/{public-post-card,public-post-media}.tsx`, locales `{fr,en}/publicNetwork.json` |
| Continuation fermée | `apps/antsia_ga/src/lib/{routes,public-post-continuation}.ts`, pages `entrer`/`bienvenue`, composants `access-home-screen`, `sign-in-screen`, `welcome-screen` |
| Documentation | Ce rapport, `EXECUTION.md`, lien d'avancement du README de l'étude |

Les ajouts existants de Claude aux jetons, surfaces et déclarations de capacité ne sont pas
réattribués à cette reprise. Aucun fichier serveur Convex, schéma, contrat de fédération,
configuration d'environnement ou dépendance n'est modifié ici. PA9B reste réservé à sa
conversation et pourra faire évoluer ses DTO sous ses propres gardes.

## 4. Tests écrits et preuve disponible

Les suites de présentation couvrent légende, changement de contenu, galerie, clavier,
visionneuse, erreurs de média et accès aux réactions. La suite publique conserve ses cas
historiques et ajoute l'ordre de lecture, la légende intégrale dans le HTML initial,
le texte seul, les retenues, quatre images en FR/EN, la vidéo sans lecture automatique,
l'origine et l'échappement du contenu.

Trois suites de continuation couvrent la validation pure, la propagation par les pages
et les destinations des composants. Ces fichiers sont **écrits mais non exécutés**.
Les résultats historiques de P01/P02/P06 ne constituent pas une validation de ces changements.

Commandes de vérification exécutées pendant cette reprise : **aucune**. Aucun test, codegen,
typecheck, lint, build ou recette navigateur. Relecture des sources et des changements seulement.
Pas de commit, push, merge, déploiement ni changement de service.

## 5. Recette et clôture restantes

1. Après levée du gel : codegen officiel, tests ciblés, typage et lint des surfaces concernées,
   puis vérification commune sur inventaire stable avant un éventuel commit.
2. Photo, quatre images et vidéo de recette exactes : création, rechargement et lecture depuis
   un second compte autorisé ; retenue puis retrait ; origine et droits du partage.
3. Téléphone et bureau en clair/sombre : flèches, balayage, focus, Échap, légende longue,
   texte sans média, zoom, absence de débordement, restitution de focus de la visionneuse.
4. Connexion IDN/OTP et inscription avec continuation ; restriction de session ; publication
   devenue inaccessible pendant la connexion. Les tests de source ne prouvent pas ces parcours.

P03 reste donc **ouvert pour vérification et recette**, malgré le raccordement des sources.
P05 et P07 restent commencés ; P04 et P08 ne sont pas exécutés par cette reprise.

## 6. Activation et retour arrière

Le réseau ANTSIA déclare déjà la variante `media`. Retirer cette capacité rend la carte
connectée historique sans supprimer de contenu. La carte publique réutilise seulement le
lecteur de présentation ; son retour arrière est limité à ses fichiers de vue, sans élargir
les DTO ni les droits de lecture. La continuation de connexion reste une destination interne
facultative. Aucun engagement commercial, donnée, compte ou session n'est créé pour ce lot.
