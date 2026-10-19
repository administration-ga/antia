# Recette, étude utilisateur et mesure du résultat

Statut : protocole proposé. **Aucun entretien utilisateur, achat, appel, test applicatif ou déploiement n'a été effectué pour cette étude.** Les audits de sources et le calcul de contraste sont les preuves nouvelles produites ici.

## 1. Faire valider les tâches, pas seulement l'apparence

Préparer un pilote de recherche avec 12 personnes consentantes : quatre acheteurs dont au moins deux peu habitués aux achats en ligne, quatre vendeurs/prestataires, deux employeurs/recruteurs et deux personnes en recherche d'emploi. Inclure des appareils Android modestes, un iPhone, un ordinateur, des besoins de zoom et au moins une évaluation assistée avec lecteur d'écran. Ces nombres sont un recrutement proposé, pas un échantillon déjà étudié ni une validation statistique.

Scénarios à observer sans dicter les clics :

1. Comprendre le contenu d'un post, changer de photo, enregistrer puis retrouver.
2. Faire défiler, ouvrir une boutique et revenir au même contenu.
3. Préparer sa vitrine sans compte de gestion préalable ; comprendre les étapes restantes.
4. Demander le prix/disponibilité, reconnaître qui répond et démarrer un appel consenti.
5. Commander un produit avec variante et frais, puis expliquer le statut de paiement.
6. Réserver ou demander un devis ; comprendre ce qui est confirmé.
7. Publier une offre d'emploi et candidater sans rendre son CV public.
8. Trouver annulation, blocage, signalement, paramètres et retour au fil.

Relever réussite sans aide, incompréhensions, temps par tâche, erreurs et appréciation d'effort. Ne pas enregistrer une conversation privée ou un paiement réel sans périmètre et consentement appropriés. Privilégier données et fonds de sandbox identifiables.

## 2. Matrice de recette fonctionnelle

| Domaine | Cas nominal | Cas limites obligatoires |
|---|---|---|
| Authentification | Ouverture directe et recharge du fil sans action de reprise | Route froide, réponse tardive, SID remplacé, déconnexion pendant demande ; pas de nouvelle régression du pont de session |
| Thèmes / layout | Clair/sombre/système, cartes lisibles | Portails, clavier virtuel, paysage, zoom 200 %, largeur 320 px, longs libellés FR/EN |
| Publications | Texte, 1 photo, 4 photos, vidéo, partage, offre liée | Média retenu/retiré, faible débit, ratio paysage, galerie sans geste, second lecteur autorisé |
| Scroll | 30 contenus mixtes et pagination | Fin réelle, fenêtre filtrée vide, source plafonnée, post retiré en cours, Retour navigateur |
| Audio / vidéo | Un média actif et pause/reprise | Appel entrant, onglet caché, permission refusée, audio concurrent, perte réseau |
| Boutique | Brouillon déclaré, publication admise, édition par mandataire | Institution protégée, usurpation, rôle révoqué, suspension, accès anonyme borné |
| Fédération | Offre publiée, modifiée, retirée | Signature invalide, mauvais environnement, doublon, ancien événement, trou de révision, DLQ/rejeu |
| Stock / commande | Variante + quantité confirmées | Deux acheteurs du dernier article ; prix modifié ; timeout après commande créée ; double clic |
| Paiement | Autorisation sandbox puis statut serveur confirmé | Retour falsifié, callback double/hors ordre, montant/devise/bénéficiaire erronés, paiement tardif après expiration |
| Service | Demande, devis, acceptation et RDV | Nouvelle version de devis, mauvais client, double créneau, changement de fuseau, annulation |
| Emploi | Offre publiée et candidature privée | Offre clôturée, recruteur désaffilié, CV infecté/retiré, accès d'un autre candidat |
| Données | Export, retrait de consentement et effacement | Reflets publics retirés, conversations expurgées selon politique, pièces commerciales conservées seulement si justifié |
| Mobile natif | Appel sur deux appareils et navigation | Verrouillage, app fermée, réseau changé, Bluetooth, interruption système ; preuves Android/iOS distinctes |

## 3. Tests automatiques utiles

Les contrats et gardes reçoivent des tests négatifs : autre réseau, autre acheteur, mauvais mandat, suspension, contenu privé, conflit d'idempotence. Les machines d'état reçoivent des tests de transitions et de concurrence ; les composants reçoivent des tests de comportement accessibles, pas des snapshots reflétant seulement leur JSX.

Dans ANTSIA : `bun run codegen` avant typage/tests, puis suites du périmètre et cliquets concernés. Pour Convex : config explicite `convex/vitest.config.ts`. Avant commit/livraison d'une implémentation : `bun run verify` sur sources stabilisées, inventaire avant/après, mémoire et workers bornés. Dans PRO.GA : appliquer ses propres scripts et instructions ; ne pas supposer qu'une vérification ANTSIA couvre son backend.

Ne pas écrire un test uniquement pour prouver qu'une couleur littérale est égale à la valeur saisie. Le contrat de tokens, les contrastes calculés et les contrôles réels de rendu sont complémentaires. Cette livraison de documents nécessite validation de liens, couverture et cohérence, pas une nouvelle compilation des applications.

## 4. Budgets de qualité proposés

Ce sont des objectifs de recette initiaux, à mesurer et ajuster ; aucun résultat actuel n'est affirmé.

| Mesure | Cible initiale | Conditions de mesure |
|---|---|---|
| Compréhension de l'action principale | ≥ 80 % des participants terminent la tâche essentielle sans aide | Protocole commun, petits effectifs : constater les cas, pas généraliser statistiquement |
| Préparation du premier brouillon boutique | ≤ 5 minutes médianes | Contenus disponibles, hors création/vérification externe PRO.GA |
| Premier contenu utile | ≤ 3 s p75, ≤ 5 s p95 | Android de référence, scénario 1,6 Mbit/s et RTT 150 ms ; à distinguer de la cible historique 1,5 s du backend |
| Fluidité du lecteur | Viser 60 images/s sur appareil de référence ; aucune longue tâche > 200 ms liée au changement de post | Profilage réel avec 30 médias et économie de données |
| Son simultané | 0 cas | Fil, vocal, appel et reprise de navigation combinés |
| Transaction dupliquée | 0 commande/débit supplémentaire | Tests répétés avec même idempotence, requête perdue et callbacks dupliqués |
| Propagation du catalogue | p95 < 60 s en fonctionnement normal | Révisions source/récepteur corrélées ; panne mesurée séparément |
| Accessibilité | WCAG 2.2 AA comme cible de cette évolution, aucun blocage des parcours essentiels | Audit automatisé + clavier + lecteur d'écran + contraste rendu |

Le nouveau budget réseau de recette ne remplace pas silencieusement les engagements du cahier initial : P00 doit distinguer temps backend, premier rendu client, appareil et réseau, puis acter les objectifs révisés. Le scroll infini n'augmente pas l'exhaustivité du moteur limité à 200 sources ; une limite de couverture doit rester annoncée jusqu'au lot d'échelle.

## 5. Indicateurs produit et commerciaux

| Indicateur | Définition | Instrumentation / lecture |
|---|---|---|
| Activation vendeur | Boutique publiée et au moins une offre publique / brouillons créés | Agrégats métier serveur, par période |
| Demande utile | Questions aboutissant à une réponse du vendeur / demandes admises | Métadonnées bornées, pas analyse du texte privé |
| Achat abouti | Commandes confirmées et non annulées / checkouts préparés | PRO.GA, état canonique et fenêtre temporelle explicite |
| Exécution | Commandes remises/livrées / commandes payées éligibles | PRO.GA, distinction paiement/livraison |
| Service | Devis acceptés ou RDV confirmés / demandes qualifiées | Définition du dénominateur par service |
| Fiabilité | Échecs, délais, remboursements, retards de synchronisation | Mesures techniques minimisées et registre métier |
| Utilisabilité | Réussite sans aide et effort ressenti | Étude consentie ; comparer avant/après avec mêmes tâches |

L'analytique facultative respecte ADR-0010. Toute extension de ses catégories fermées exige un contrat et un consentement adaptés. Les journaux nécessaires à l'exécution d'une commande ne sont pas détournés en profilage publicitaire. Pas de contenu, CV, contact, URL privée ni identifiant civil dans les événements de mesure. Les indicateurs publics sont agrégés avec seuils ; aucun chiffre de démonstration affiché comme résultat.

## 6. Risques qui changent réellement le plan

| Risque concret | Mesure prévue | Porte de sortie |
|---|---|---|
| Refonte partagée affectant DIASPORALE | Variantes opt-in, contrat de tokens compatible, ownership des fichiers | Recette comparative avant P19 |
| Deux maîtres prix/stock | PRO.GA unique autorité, ANTSIA projection | Tests de divergence, prix reconfirmé |
| Faux succès de fédération | Distinguer reçu HTTP, état applied et effet visible | Publication/modification/retrait croisés |
| Page publique trop ouverte | Projection commerciale dédiée, audience et modération relues | Tests anonymes négatifs |
| Harcèlement des vendeurs | Demande initiale limitée, acceptation, blocage, appel consenti | Test de quotas et refus |
| Session régressée | Réutiliser les portes existantes, réponse tardive fermée | Recette ouverture froide et session remplacée |
| Appel annoncé sans réveil natif | Lot P17 et appareils physiques | Ne qualifier que les plateformes éprouvées |
| Commande payée après expiration du stock | Réconciliation et procédure de remboursement | Scénario tardif prouvé en sandbox |
| Documents ou médias privés rendus publics | Garde fichiers et DTO allowlistés | Essais URL/direct/ancien lien/reflet |
| Coût et mémoire excessifs | Fenêtre de rendu, préchargement borné, jobs indexés et seuils | Mesures appareil/backend, activation graduelle |
| Conditions commerciales non définies | Récapitulatif et décisions fournisseur/vendeur avant pilote | Pas d'encaissement réel avant readiness validée |

## 7. Rapport attendu à chaque lot

Consigner : date, commit et inventaire de source, version/schema de contrat, environnement, rôles utilisés, parcours, commandes de vérification, résultat, captures, références de recette non sensibles, limites et retour arrière. Ne jamais joindre cookie, jeton, secret, contact privé ou données de paiement complètes.

Séparer cinq verdicts : **documenté**, **présent dans le code**, **testé automatiquement**, **observé en recette**, **publié et vérifié**. Cette séparation empêche qu'une belle interface soit prise pour une chaîne commerciale ou téléphonique déjà opérationnelle.
