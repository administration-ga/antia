# PA8 — Réseau public ANTSIA : réalisation et preuves locales

Date : 2026-10-17. Base du moteur : `24d2824`, branche partagée
`codex/pa4-identite-session` conservée. Réalisation dans les sources servies.

## Livraison

Vitrine avec fil d'origine, découverte nationale/province/tag, profils publics
réduits, pages Officiel et leurs publications, publications partageables,
transparence agrégée et textes de travail FR/EN. Le rendu public serveur ne monte
pas un faux contexte membre. Les portées membre et les aliases du cahier restent
dans la coque persistante, les commandes de données hors de cette coque.

Routes publiques : `/`, `/decouvrir`, `/@handle`, `/pages/handle`,
`/publications/id`, `/tags/tag`, `/provinces/slug`, `/transparence`,
`/a-propos`, `/mentions-legales`, `/confidentialite`.
Routes membre : `/fil?portee=national`, province/tag/curseur adressables,
`/moderation`, aliases groupes/évènements/direct/albums ; `/parametres` et
`/parametres/donnees` rejoignent les contrôles personnels existants.

La console membre relit les capacités et les équipes, montre un extrait borné
du contenu assigné, permet classement/retrait/avertissement/suspension datée et
prélecture motivés. La file des recours réseau est réservée à l'administrateur,
avec un autre décideur ; le niveau plateforme demeure dans PA7. Les décisions
réutilisent les gardes, débits, notifications et audits du moteur.

## Contrats vérifiés par les tests

- Natif historique `network` fermé ; nouveau geste explicite `root` avec audience
  publique seulement. Brouillon ancien sans geste = faux, choix invalidé en audience
  incompatible, isolement personne/réseau/cible. Aucune migration de contenu.
- Enfant `network` fermé ; enfant `root` admis avec origine active et contexte
  parent exact. Publication/page retirée, prélecture, origine archivée, suspension,
  blocage et identité résiduelle relus avant enrichissement.
- Profil privé ou retiré fermé ; auteur neutre sans contact ni identité civile.
  Page institutionnelle distincte de son signataire ; original d'un partage relu.
  Les médias passent toujours par la garde des fichiers, jamais de stockage brut.
- Pagination native conservant son curseur après fenêtre filtrée vide ; province
  volontaire du contenu, neuf slugs stricts, aucune résidence déduite.
- Agrégats par générations/tranches25, plafond5000 candidats par étape et50 sujets,
  fenêtre de7jours, aucun auteur dans les jobs. Tendances cohorte≥5 et transparence
  de12jours avec total seul quand cas/auteurs≥5 ; pas d'inférence par souscatégories.
- Reçu HttpOnly ANTSIA corrélé au SID signé et au JWT vérifié, génération fermante
  avant entrée/SSO/OTT/déconnexion. Réponses anciennes, révocation, panne et timeout
  ne deviennent jamais anonymes par repli. Aucune révocation de session étrangère
  par le broker ; déconnexion globale conserve son verrou jusqu'à navigation.

La province et les agrégats sont enregistrés au schéma et à l'inventaire de données.
Les deux tables d'agrégats ne contiennent aucune référence personnelle. Le cron
`public-refresh-aggregates` lance une génération toutes15minutes. Aucun délai UDF,
aucune borne métier ni limite de test n'a été desserré pour cette livraison.

## Coordination DIASPORALE

La tranche DIASPORALE `cf97785`, preuves `276ef86` et documentation `9f7d4bd`,
a précédé les modifications PA8. Son verify6909tests et sa recette Chrome sont
des preuves de son snapshot pré-PA8, jamais une preuve de cette livraison.
Les sessions ont rendu explicitement leurs ressources avant l'écriture du moteur.
Un seul Next3030, backend3210 conservé, une vérification lourde à la fois.

DIASPORALE conserve sa tranche, son application, thème et locales ; ANTSIA n'écrit
aucun de ces chemins. Les nouveaux consommateurs publics ne lisent aucune base
externe, n'ouvrent aucun client Convex croisé et ne fabriquent aucun reflet PA9.

## Contrôles de l'arbre final

`bun run verify` final **code0**, terminé le17/10 à15:06 Paris sous Node22 :
**7 018 tests** (somme de ce seul passage), dix espaces typés, neuf lints0erreur.
Log : `/tmp/antsia-pa8-verify-final.log`.

| Suite | Tests |
|---|---:|
| Moteur Convex |1593|
| Cliquets |124|
| Scripts Bun |29|
| Domaine ANTSIA |475|
| Contrats |57|
| API |190|
| UI |86|
| Fonctionnalités ANTSIA |3164|
| Domaine DIASPORALE |238|
| Fonctionnalités DIASPORALE |309|
| Console ANTSIA |78|
| Application ANTSIA |98|
| Application DIASPORALE |577|

La somme inclut1124tests DIASPORALE. Les avertissements de lint ne sont pas cachés :
application ANTSIA8 (référence DOM rendue par un hook : six signalements du
compilateur React désactivé ; ancre du mock de test : un ; formulaire de notifications
préexistant : un), autres paquets avec leurs avertissements hérités ; aucun écart de
validation ni règle désactivée. Images publiques rendues avec `next/image unoptimized`
afin de conserver les URL déjà admises sans proxy d'optimisation supplémentaire.

Le dernier passage a d'abord été interrompu par **ENOSPC** (95fichiers du moteur
non importables, aucune conclusion métier). Reprise dans le périmètre déjà autorisé :
seul Next3030 arrêté, caches `.next` ANTSIA1,5Gio/console193Mio supprimés après
validation de leurs chemins ;1 832 861 627octets de fichiers, gain disque≈1,7Gio,
312Mio→2,0Gio disponibles. Aucun cache DIASPORALE, dépendance, source ou donnée touché.
Le backend local était devenu indisponible pendant cet incident ; relancé sous
Node22 avec ses paramètres conservés. Quatre identifiants et retrait effectif
revérifiés après reprise ; la nouvelle vérification intégrale ci-dessus a passé.

## Recette sur les services réellement servis

Lecture réelle API3210 puis HTML initial3030, sans navigateur ni session humaine,
le17/10 à14:56–14:58 Paris. Les scripts ont séparé le texte visible des scripts
RSC ; les contrôles ne se limitent pas aux statuts HTTP.

| Cas local | Résultat observé |
|---|---|
| Natif `network` et enfant DIASPORALE `network` | Projections anonymes `null`, absents du texte initial de l'accueil |
| Natif `root` et enfant DIASPORALE `root` | Projections présentes, origines `antsia`/`diasporale`, accueil et liens de publication200 avec corps initial |
| Retrait de diffusion du candidat enfant | API publique `null`, accueil sans sa contribution, lien404/noindex sans corps ; natif toujours présent |
| Rejeu de préparation | Quatre identifiants identiques, contribution retirée non réouverte |
| Ancienne query membre appelée sans compte | Refus API, aucun contenu `network` |
| Reçu connu et génération différente | État générique/noindex sans corps, aucun repli anonyme |
| `?ott` sur publication publique | Porte de reprise/noindex sans corps avant adoption |
| Langue `Accept-Language: en-US` | HTML `lang=en`, vitrine traduite |

Treize autres routes GET200 : découverte, tag, province, profil fictif, à propos,
mentions, confidentialité, transparence, santé, entrée, fil, modération et données.
Les trois dernières réponses privées attestent leur rendu initial protégé, pas
une recette métier authentifiée. Les pages Officiel sont éprouvées dans le harnais,
aucune institution fictive n'a été créée pour l'apparence de la vitrine.

Logs locaux : `/tmp/antsia-pa8-recette-before.json`,
`/tmp/antsia-pa8-recette-after.json`, `/tmp/antsia-pa8-next-dev.log`.

Après remise en service15:07–15:09 : accueil200 et corps natif initial conservé,
contribution enfant retirée absente, refus404 traduit FR/noindex. Le broker réel
rejette origine étrangère, génération ancienne et credentials invalides (403,
aucun reçu) ; purge locale204, reçu anonyme HttpOnly/SameSite=Lax sans Domain,
lecture anonyme corrélée admise. Logs : `/tmp/antsia-pa8-recette-final-http.json`
et `/tmp/antsia-pa8-next-restored.log`. Aucun navigateur ni cookie de personne réelle.
Backend3210/PID86052 (session10670) et seul Next3030/PID88642 (session4443) actifs
au dernier contrôle. Ports3031/3032 non démarrés ; disque≈1,8Gio après chauffe.

La fixture locale doublement gardée `public.recette.prepare` n'ajoute que quatre
publications explicitement fictives au compte de recette préexistant, vérifié et
adhérent. Elle ne crée ni compte, session ou adhésion et ne réouvre pas un contenu
au rejeu. `withdrawChildFromRoot` retire uniquement sa propre contribution fictive,
trace `system` et conserve le contenu dans DIASPORALE.

Le backend3210 conserve le budget d'analyse temporaire15s introduit pendant PA7,
distinct du défaut4s, du budget métier UDF1s et des tests30s. Ce paramètre n'a pas
été modifié pour PA8. Le frontend3030 est la baseline restituée dans la coordination,
sans lancer3031/3032 en parallèle.

## Relecture d'interface et limites

Charte et signature dans [05_CHARTE_ANTSIA](05_CHARTE_ANTSIA.md) ; décision dans
[ADR-0012](adr/0012-projections-publiques-et-session-ssr-antsia.md).
Relecture des sources contre frontend-design/web-design-guidelines : lien
d'évitement, titres, focus, contrôles44px, labels, messages/reprises, URL d'état,
images gardées et dimensionnées, contenu long, nombres/dates localisés, sombre.
Les calculs de tokens et tests DOM n'attestent pas le reflow, contraste rendu,
clavier, médias ou AA dans un navigateur. Le refus navigateur antérieur n'est
pas contourné ; aucune recette Chrome propre à PA8 n'est revendiquée.

Calcul sRGB des rôles réellement résolus depuis les feuilles de charte/thème,
sans mesure de pixels :

| Paire | Clair | Sombre |
|---|---:|---:|
| Texte / fond |18,41:1|17,19:1|
| Texte secondaire / carte |6,69:1|6,37:1|
| Texte CTA / remplissage |11,58:1|5,96:1|
| Lien principal / fond |10,71:1|6,37:1|

Le serveur ne lit pas le localStorage du SDK : une requête sans reçu ANTSIA est
anonyme pour lui. Les credentials connus et les transitions de l'application
sont protégés, sans prétendre identifier un visiteur Internet sans credentials.

R1 IDN réelle reste ouverte : clients sandbox ANTSIA/DIASPORALE non créés/configurés,
confirmation du propriétaire. SMS, fournisseurs, médias/LiveKit et appareils réels
gardent leurs recettes externes. A5, projet cloud, hébergement et domaine ne sont
pas décidés ici. Aucune commande de production, push, merge, environnement édité
ou suppression de donnée n'a lieu dans cette livraison.

## Textes et références primaires

Les mentions et la politique sont marquées **version de travail**. Coordonnées
juridiques, bases/durées de traitement, hébergeur et démarches restent à compléter
et valider ; `TODO JURISTE` et A5 bloquent la publication. Aucun audit, conformité,
attestation institutionnelle ou résidence des données n'est revendiqué.

- [Ministère de l'Intérieur — neuf provinces](https://www.interieur.gouv.ga/decoupage-territorial).
- [APDPVP — textes et décisions](https://www.apdpvp.ga/textes-et-decisions/) ;
  [Journal officiel — loi025/2023 du12juillet2023](https://journal-officiel.ga/20085-025-2023-/).
- [EUR-Lex — règlement2016/679](https://eur-lex.europa.eu/eli/reg/2016/679/oj?locale=fr),
  champ d'application notamment article3, soumis à l'examen du traitement concerné.
