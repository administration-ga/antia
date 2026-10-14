---
title: "ANTIA — Prompt de lancement de la session de construction"
version: "1.0"
date: "2026-10-14"
statut: "Prompt de démarrage (session Claude Code, Opus 5.5, effort maximal)"
projet: "ANTIA"
---

# ANTIA — Prompt de lancement de la session de construction

> Ce texte est le premier message de la session qui construit le moteur social national et le
> réseau public ANTIA. Il est conservé ici pour la traçabilité. Une session jumelle construit
> DIASPORALE en parallèle (`../DIASPORALE/docs/02_LANCEMENT_SESSION_2026-10-14.md`).

```text
Tu construis ANTIA : le moteur social national (backend Convex + paquets) et le réseau social public
gabonais. Tu travailles dans « Digital GABON/DIGITAL_GOUV/NTSAGUI_DIGITAL/ECOSYSTEMES/ANTIA » (dépôt GitHub
PUBLIC administration-ga/antia : aucun secret, aucune donnée réelle, aucun identifiant interne de
déploiement n'y entre jamais). Au départ il n'y a aucun code : seulement les documents.

LIS D'ABORD, EN ENTIER, DANS CET ORDRE
1. CLAUDE.md et README.md du dossier.
2. docs/00_CAHIER_DES_CHARGES_ANTIA.md (le moteur en partie A, le réseau public en partie B : invariants,
   tables, autorisation, lots A0–A6, parcours R1–R10, arbitrages).
3. docs/01_PLAN_IMPLEMENTATION_PROMPTS_ANTIA.md (les prompts PA0 → PA10 et le préambule commun §2).
4. ../../../Documentation/RESEAUX_SOCIAUX/00_PLAN_RESEAUX_DANS_LE_RESEAU_DIASPORALE_ANTIA_2026-10-14.md et ses
   annexes A (backend du socle), B (front du socle), D (conventions, ADR, gabarit, identite.ga).
5. ../DIASPORALE/docs/00_CAHIER_DES_CHARGES_DIASPORALE.md (le premier réseau servi : sa tranche backend
   `convex/modules/diaspora/` vit chez toi).
6. ../PRO_GA/docs/11_PLAN_IMPLEMENTATION_PROMPTS_PRO_GA.md §2 (les dix règles de duplication) et §4 (la forme).
7. Le socle administration.ga sur origin/main (lecture seule, depuis une copie propre) : c'est la source de
   duplication. Jamais l'arbre de travail partagé ../../ADMINISTRATION_GA, qui est en retard et modifié.

MISSION : implémenter de bout en bout, dans l'ordre, un prompt à la fois, chacun précédé du préambule commun
(docs/01 §2) : PA0 → PA10. Tu ne t'arrêtes pas entre deux prompts pour demander l'accord ; tu t'arrêtes seulement
quand un préalable externe manque (compte, projet Convex, secret, décision juridique) — et alors tu fais tout ce
qui n'en dépend pas et tu dis exactement ce qui manque.

PRIORITÉ : UNE APPLICATION WEB TESTABLE AU PLUS TÔT. Dès PA0 (scaffold) et PA2 (fondations multi-réseaux),
livre une tranche verticale minimale dans apps/antia_ga sur le réseau `antia` : entrer (compte léger OTP en dev,
IDN si le client sandbox existe), choisir un handle, publier un texte, lire le fil, réagir. Le propriétaire doit
pouvoir ouvrir http://localhost:3030 et tester. Puis poursuis PA3 (duplication complète du backend), PA4 à PA7,
en gardant l'application testable à chaque étape. Après PA7, attends que la session DIASPORALE ait livré son lot
D1 avant PA8 si elle est proche ; sinon enchaîne PA8 → PA10. Le mobile vient après le web.

ÉTAT D'AVANCEMENT : tiens à jour dans docs/01 un encart « État » (tableau Prompt | Clos le | Commit), comme PRO.GA
l'a fait, et rends compte au propriétaire en français après chaque prompt : ce qui est livré, ce qui est vérifié,
ce qui manque.

SESSION JUMELLE : une session nommée « diasporale » construit ../DIASPORALE en parallèle et doit écrire chez toi la
tranche `convex/modules/diaspora/`, le thème `packages/ui/src/themes/diasporale.css` et ses locales. Règles de
l'arbre partagé dans ANTIA :
- tu es propriétaire de tout le dépôt ANTIA sauf ces chemins-là ;
- aucun `git add -A` : toujours `git add -- <chemins>` puis `git commit -- <chemins>` ; aucun changement de
  branche dans ANTIA tant que les deux sessions y écrivent (on reste sur main pendant le bootstrap PA0 → PA3 ;
  à partir de PA4, branches dédiées + PR si une seule session écrit encore) ;
- les fichiers partagés (package.json, bun.lock, convex/schema.ts, convex/convex.config.ts, catalogue de
  déploiement) ne sont modifiés que par toi : la session diasporale te demande par message (SendMessage vers
  « diasporale », elle t'écrit vers « antia ») et tu appliques ;
- annonce-lui par message la clôture de PA2 (fondations : networks, persons, memberships, cliquet), de PA3
  (backend complet) et de PA7 (console) : ce sont ses jalons de dépendance.

LIVRAISON : vérifié = `bun run verify` vert (codegen, typecheck, tests, lint) + cliquets du cahier. Commits en
français, puis push sur origin (dépôt public) ; aucune publication Convex en production sans décision du
propriétaire (le déploiement dev suffit à tout le bootstrap). Modèle : Opus pour tout le code, jamais de
sous-agent Sonnet ; sous-agents Opus en lecture seule pour l'inventaire (PA1) si utile.

Commence par lire, puis exécute PA0.
```
