# Environnement de démonstration d'ANTSIA

> Décision : ADR-0029. Ce document dit ce que le propriétaire crée et pose (projets, secrets),
> puis comment publier et remettre à zéro. Aucun secret ne s'écrit dans le dépôt ni dans un chat :
> chaque valeur se saisit dans le tableau de bord concerné ou dans le terminal du propriétaire.

## Ce que c'est

Un second déploiement complet du moteur et d'antsia.ga, séparé de la production :

| | Production | Démonstration |
|---|---|---|
| Backend Convex | projet de production actuel | projet **distinct** (ex. `antsia-demo`) |
| Site | `antsia.vercel.app` | projet d'hébergement **distinct** (ex. `antsia-demo`) |
| Comptes | vrais membres | les huit comptes fictifs `<acteur>@demo.antsia.test`, partagés |
| Bouton « Comptes de démonstration » | jamais | sur l'écran de connexion et l'accueil |

Le bouton n'apparaît que si le backend annonce `demoAccounts` (configuration de
`modules/platform/authentication`), c'est-à-dire si `ANTSIA_DEMO_DEPLOYMENT` porte le nom même du
déploiement. Sur tout autre déploiement, le catalogue est vide et l'équipement refusé.

## 1. Backend Convex de démonstration (propriétaire)

1. Créer un **nouveau projet** Convex (ex. `antsia-demo`) dans l'équipe, et son déploiement de
   production. Relever son nom dans son adresse : `https://<nom>.convex.cloud`.
2. Générer pour ce projet une **clé de déploiement de production** (tableau de bord Convex ›
   Settings), à garder dans le terminal du propriétaire seulement.
3. Poser les variables du déploiement de démonstration (tableau de bord › Settings ›
   Environment Variables) :

   | Variable | Valeur |
   |---|---|
   | `ANTSIA_DEMO_DEPLOYMENT` | le `<nom>` relevé au point 1, exactement |
   | `SITE_URL` | l'origine du site de démonstration (ex. `https://antsia-demo.vercel.app`) |
   | `BETTER_AUTH_SECRET` | un secret **neuf**, propre à la démonstration (au moins 32 caractères, par ex. `openssl rand -base64 48`) |
   | `ANTSIA_SEEDS_ALLOWED` | `true`, le temps de la graine (point 5), puis la retirer |

   À **ne pas** poser : `ANTSIA_DEV_TOOLS`, `RESEND_*`, `IDN_*`, `SMS_*`. Sans eux, seules les huit
   adresses réservées entrent ; une vraie adresse reçoit « envoi indisponible ».
4. Publier les fonctions depuis `ECOSYSTEMES/ANTSIA`, à jour de `main` :

   ```bash
   git pull && bun install
   CONVEX_DEPLOY_KEY='<clé de production du projet de démonstration>' bunx convex deploy
   ```

5. Poser les fondations (réseau racine), une fois :

   ```bash
   CONVEX_DEPLOY_KEY='<même clé>' bunx convex run seeds/foundations:run '{"confirmNonProduction":"ANTSIA_SEEDS_HORS_PRODUCTION"}'
   ```

   Puis retirer `ANTSIA_SEEDS_ALLOWED` du déploiement.

## 2. Site de démonstration (propriétaire)

1. Créer un **nouveau projet** d'hébergement (ex. `antsia-demo`), avec les mêmes réglages de
   construction que le projet `antsia` de production (dossier racine, commandes d'installation et de
   construction, Node 24).
2. Ses variables (environnement Production) :

   | Variable | Valeur |
   |---|---|
   | `NEXT_PUBLIC_CONVEX_URL` | `https://<nom>.convex.cloud` (démonstration) |
   | `CONVEX_SITE_URL` | `https://<nom>.convex.site` (démonstration) |
   | `NEXT_PUBLIC_SITE_URL` | l'origine du site de démonstration, identique à `SITE_URL` du backend |

   Aucune variable PostHog : la démonstration ne mesure rien.
3. Publier depuis `ECOSYSTEMES`, comme la production, en liant le dossier au projet de
   démonstration (`vercel link --project antsia-demo`, puis `vercel deploy --prod`).
4. Recommandé : protéger l'accès au site (mot de passe ou protection de l'hébergeur) si la
   démonstration ne doit pas être publique.

## 3. Recette

1. Ouvrir le site de démonstration : l'écran de connexion montre « Comptes de démonstration » et la
   phrase « Site de démonstration : comptes et contenus fictifs, partagés par tous les visiteurs. »
2. Un appui sur « Presse » : connexion, accueil rempli seul, page « Gabon Actu Démo » administrée,
   badge Vérifié. Rejouer pour « Administration » (page Officiel) et « Modération ».
3. Sur la production (`antsia.vercel.app`) : aucun panneau de démonstration ;
   `modules/platform/demoAccounts:catalogue` rend `[]`.

## 4. Exploitation

- **Chaque mise en production du moteur** se rejoue sur la démonstration (point 1.4 puis 2.3), pour
  que la démonstration montre le même produit.
- **Remise à zéro** : les comptes étant partagés, effacer périodiquement les données du déploiement
  de démonstration (ou en recréer un), puis rejouer la graine (point 1.5). Les huit comptes se
  recréent au premier appui.
- **Limites connues** : par adresse, trois codes par cinq minutes et cinq connexions par quinze
  minutes (seaux du moteur, non desserrés) — plusieurs visiteurs sur le même compte au même moment
  peuvent attendre quelques minutes. Un domaine personnalisé qui remplacerait l'adresse
  `<nom>.convex.cloud` du backend ferme la démonstration (la garde ne reconnaît plus le nom).
- **Fermer la démonstration** : retirer `ANTSIA_DEMO_DEPLOYMENT` du déploiement — le bouton
  disparaît, le catalogue se vide et l'équipement est refusé aussitôt.
