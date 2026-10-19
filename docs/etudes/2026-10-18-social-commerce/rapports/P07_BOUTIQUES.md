# P07 — Boutique progressive et vitrine publique

18 octobre 2026. Reprise du travail Claude sur demande du propriétaire :
« Continue le lot boutiques (P07) à partir du travail de Claude, sans relancer les vérifications. »
Références : [prompt P07](../prompts/P07_BOUTIQUES.md),
[modèle produit](../06_BOUTIQUES_SERVICES_EMPLOI.md),
[journal d'exécution](../EXECUTION.md), [ADR-0019](../../../adr/0019-boutique-progressive-et-canal-commercial.md).

**Verdict : sources raccordées ; tests écrits/étendus, non exécutés ; recette réelle ouverte.**
La politique de publication reste **fermée par défaut**. Préparation, publication de vitrine
et encaissement sont trois autorisations distinctes. Aucun catalogue ni compte PRO.GA n'est
créé, aucun paiement n'est activé et aucune politique de réseau n'est modifiée par cette reprise.

## 1. Parcours raccordés

Depuis **Profil → Ma boutique**, le membre rejoint ses boutiques gérées et le formulaire de
création. Le membre déclaré actif peut préparer un brouillon sans créer de page sociale.
Il peut aussi choisir une page existante réellement admissible, qu'il administre encore.
Les listes de gestion annoncent leur éventuelle troncature ; elles ne prétendent pas être
exhaustives au-delà de leur borne serveur.

L'éditeur suit les quatre étapes prévues :

1. **Mon activité** : commerce de produits ou services sur devis ; choix explicite du modèle.
2. **Ma présentation** : nom commercial, description, spécialité, zone choisie, horaires et logo ;
   aperçu en largeur téléphone ou bureau des champs du brouillon, y compris non enregistrés.
   Le logo montré dans cet aperçu est celui actuellement enregistré, sans publication implicite.
3. **Mes offres** : blocs du modèle et étapes restantes de la liaison PRO.GA, avec retour utile
   vers la présentation. Les offres canoniques ne sont pas simulées dans ANTSIA.
4. **Publier** : état de la vitrine, conditions manquantes, politique du réseau, audience et
   consentement versionné à la lecture sans compte. Les gestes de demande, annulation et
   retrait suivent les états et droits rendus par le serveur.

L'éditeur protège les modifications non enregistrées et les actions en attente. Les réponses
tardives sont bornées au contexte courant ; un changement de personne, réseau ou boutique
recrée la surface de gestion. Les erreurs de droits et les refus métier sont traduits.
Les textes FR/EN de la boutique sont chargés dans le même espace `shops` côté serveur et client.
Les surfaces réemploient les jetons de la charte ANTSIA : fond blanc et cartes beige en clair,
avec la variante sombre existante. Aucun rendu navigateur n'est revendiqué pour cette reprise.

**Découvrir → Boutiques** affiche un annuaire de vraies vitrines publiées, paginé côté serveur.
Une fenêtre dont tous les candidats sont filtrés garde sa continuation si le serveur en
propose une. L'annuaire ne contient pas d'offres P09, de devis ni de panier. Services et
Emplois restent dans leur périmètre ultérieur ; Mes achats et Candidatures restent réservés.

## 2. Pages membre et publique

| Surface | Route centralisée | Rôle |
|---|---|---|
| Mes boutiques | `/mes-boutiques` | Créer un brouillon, retrouver les boutiques administrées |
| Éditeur | `/mes-boutiques/[id]` | Modifier la présentation et piloter l'état de publication |
| Annuaire membre | `/explorer#boutiques` | Découvrir les vitrines actuellement lisibles |
| Vitrine membre | `/boutique/[handle]` | Présentation et accès à la page sociale selon ses droits |
| Vitrine publique | `/boutiques/[handle]` | Projection commerciale consentie, rendue côté serveur |

Les segments variables sont encodés par `routes.ts`. La gestion relève de la destination
Profil ; une vitrine membre relève de Découvrir. Aucun identifiant de boutique ou handle
n'est ajouté à une mesure d'usage.

La projection publique possède son propre DTO strict : identité commerciale, présentation,
médias servis, badge calculé, modèle et réseau d'origine. Aucun signataire, contact privé,
identifiant de stockage ou état de client ne sort dans ce DTO. La lecture anonyme des
publications communautaires n'est pas élargie ; seuls les blocs effectivement disponibles
sont affichés. Les métadonnées reflètent le contenu admis ; une vitrine retirée ou refusée
ne garde pas de métadonnées commerciales indexables.

Le chargeur SSR réutilise la porte commune de projections : session, sujet et transfert OTT
conservent leur décision. Une session authentifiée refusée ne devient pas une visite anonyme.
Les cinq fichiers gelés du pont de session ne sont pas modifiés.

## 3. Gardes et cycle de vie

Le moteur existant préparé par Claude est complété, sans retirer la règle `verifiee` de
`pages.createPage` et sans ouvrir la création de page institutionnelle ou officielle.

- Toutes les fonctions membre exigent le réseau et une adhésion active ; les écritures
  passent les gardes sociales, la limitation de débit puis le droit de gestion.
- Sans page, le brouillon appartient à son propriétaire. Avec une page, son administration
  vivante fait autorité ; le préparateur historique ne conserve pas un mandat implicite.
- Nom, description et logo utilisent la page comme source unique dès son rattachement.
  Le texte commercial est relu par la modération de cette page.
- Une admission peut créer la page native sous la politique commerciale ciblée. Elle ne
  donne aucun badge, droit d'encaissement ni mandat PRO.GA.
- Une vitrine lisible exige publication admise, politique ouverte, page active, modération
  admissible et au moins un administrateur vivant. La suspension racine reste opposable.
- La racine ne lit une vitrine d'un réseau enfant que si l'origine est active et sa portée
  est explicitement `root`. La projection publique exige en plus le consentement courant,
  non révoqué, et refuse les prélectures de modération, même à leur auteur.
- Retirer le consentement horodate aussi la révocation d'une ancienne version de texte.
  Rétablir une vitrine suspendue relit les conditions d'admission ; ce n'est pas un simple
  changement d'état. Les pages reflétées ne deviennent pas des boutiques natives.
- Le logo passe par les gardes de dépôt, de fraîcheur, d'admission et de délivrance. Les
  médias non servis ne reçoivent pas d'URL de contournement.
- Retrait, suspension, fermeture du réseau ou perte d'administrateur retirent la lecture
  de la vitrine sans effacer silencieusement la page ni ses obligations futures.

Les portes opérateur de politique, admission et suspension restent réservées aux opérateurs
habilités, avec motif et journal d'audit. Cette reprise ne les appelle pas et n'ajoute pas
d'interface d'administration commerciale distincte.

## 4. Export, effacement et inventaires

Les tables `shops` et `shopNetworkPolicies`, les limites `shop.*` et les actions d'audit
préparées par Claude sont conservées. Le module `shops` est ajouté à la classification des
fonctions sociales du cliquet ; aucune exemption de garde n'est introduite.

Le brouillon sans page est exportable en entier par son seul propriétaire et relève de
son effacement, logo compris par l'inventaire dérivé du schéma. Une boutique portée par une
page n'appartient pas à son ancien préparateur : son export personnel est limité à ses
propres traces de préparation ou de consentement. Il ne reçoit ni la présentation actuelle,
ni une décision privée, ni le consentement d'un autre gérant. L'effacement retire les
références personnelles facultatives sans supprimer la boutique partagée d'une page.

Les ajouts PA9 et les sources P03/P05 de l'arbre partagé sont préservés. Aucun changement
visuel ni métier DIASPORALE n'est réalisé dans ce lot.

## 5. Vérification et suites

Les tests nouveaux ou étendus accompagnent les gardes boutiques, la projection publique,
les données personnelles, les routes, les formulaires et les surfaces de découverte/profil.
Les cas serveur préparés couvrent notamment le lecteur courant, la modération et ses masques,
le consentement et sa version, l'origine et la portée, les médias retenus, les bornes de
gestion et l'annuaire racine avec continuation après filtrage.
Ils sont **écrits, non exécutés**. Aucun résultat antérieur de Claude n'est présenté comme
une preuve de cette reprise.

**Commandes de vérification exécutées : aucune.** Aucun codegen, test, typage, lint, build,
recette navigateur, relance de serveur ou commande Convex. Aucun commit, push ou déploiement.
Les références API nouvelles attendent la génération officielle lors d'une prochaine phase
de vérification ; les fichiers générés ne sont pas réécrits à la main.

La clôture de recette reste ouverte : génération et contrôles sur source stable, déclaré et
vérifié, autre personne, révocation de mandat, suspension, origine fermée, consentement absent
ou périmé, retrait et logo interdit ; création, édition et retrait réels en clair/sombre sur
téléphone et ordinateur. Aucune réussite de ces parcours n'est revendiquée ici.

La publication attend une décision explicite sur l'ADR-0019 et la politique d'admission du
réseau. Le rattachement PRO.GA, les offres canoniques, le contact commercial et l'encaissement
restent respectivement dans les lots P08/P09, P10 et suivants. P07 ne les ouvre pas par une
simple présentation de boutique.
