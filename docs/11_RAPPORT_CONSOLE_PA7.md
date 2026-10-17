# PA7 — Console d'administration du moteur

Date : 2026-10-17. Base locale : 81b8730. Branche partagée conservée :
codex/pa4-identite-session. Sources PA7 : e47df16, dans apps/admin_antsia_ga et Convex.

## Ce qui est raccordé

| Surface | Comportement |
|---|---|
| Entrée et autorité | IDN seule, garantie ≥ 2, session et rôle vivants, accès journalisé avant outils ; reprise et sortie partout |
| Réseaux | Création, politique, visibilité, facettes, pays, portées, thème ; archivage à deux administrateurs distincts |
| Équipes | Création, périmètre, recherche de membre et attribution/retrait ; profils masqués projetés de manière neutre |
| Recours | File plateforme paginée, filtre serveur par réseau, décisions motivées |
| Fédération | Émetteurs et références de clés par environnement, reçus, lettres mortes, résultat de rejeu réel |
| Pages Officiel | Création manuelle d'institution et décisions de confiance/statut motivées et auditées |
| Incidents et journal | Dossiers opérateurs et journal moteur paginés, filtrés, sans corps de contenu |
| Santé | Comptages matérialisés, progression/génération protégées et date du résultat |
| Export | JSON/CSV depuis DTO fermé, périodes agrégées, seuils et compléments masqués |

La navigation et le réseau sont adressables ; tout identifiant de route est résolu
dans la liste autorisée. Les brouillons et décisions en cours préviennent les
changements de section, réseau, historique et fermeture. La sortie volontaire
reste possible. Langue et fuseau personnels, commandes de 44 px, erreurs/focus
et états d'attente sont raccordés, en FR/EN et dans la charte admin existante.
Filtres, pagination, choix d'émetteur et recherche de membre protègent également
les motifs. Une décision en cours bloque le changement de vue ; les décisions
opposées d'un recours partagent un verrou. Une réponse tardive après départ
n'affiche aucun retour dans l'ancien contexte. Le focus de confirmation cible
le champ sur ordinateur et le texte au téléphone, sans ouvrir son clavier.

Les libellés de personnes sont les noms sociaux choisis, sans séparation civile
déduite. Aucun champ nom/prénom civil n'est ajouté par PA7, ni aucune identité
dans l'export agrégé ; organisations et documents certifiés restent distincts
de la convention de casse civile reçue le 17/10.

## Invariants vérifiés

La session OTP ne gagne aucune autorité grâce à un ancien lien IDN. Le callback
ne publie ni profil ni adhésion. La révocation ferme les lectures et écritures.
L'accès est idempotent par session ; les exceptions non journalisées sont limitées
à la projection de sa propre autorité et à son enregistrement.

Une demande d'archivage ne s'approuve pas soi-même. Une autre personne, une autre
demande, une expiration, un réglage modifié ou une première autorité révoquée
font refuser l'acte. Le réseau reste en base et la projection publique se ferme.
Une reconnexion peut déposer une nouvelle demande sur sa propre preuve. Le
demandeur est référencé par un champ personnel typé et effaçable, sans copie
de son identifiant dans les détails du journal de l'approbateur.

En coordination avec DIASPORALE, l'ancienne lecture générique des suggestions
masquées est refusée sur un annuaire gouverné. La façade de sa tranche garde
ses règles d'adhésion, d'annuaire volontaire, de blocage et de retrait ; les
masquages existants sont conservés.

Le réseau créé par les fonctions de console est résolu par getBySlug puis rejoint
par une personne, avec adhésion dérivée racine : ce sont les contrats utilisés
par l'application, sans redéploiement. Cette preuve backend ne constitue pas
une recette navigateur authentifiée sur un client IDN réel.

## Preuves de vérification

- **Verify complet : code 0, 6 786 tests réussis** ; journal
  /tmp/antsia-pa7-verify-final.log. Somme des treize totaux de cette seule passe,
  sans addition des reprises ciblées.
- Backend : 97 fichiers, 1 551 tests ; cliquets : 124 ; scripts : 29.
- Dix espaces de travail typés, neuf analysés sans erreur. Les 82 avertissements
  des surfaces héritées restent visibles ; la console n'en présente aucun.
- Console : neuf fichiers, 78 tests ; admission, formulaires, sorties, erreurs,
  navigation, pagination, décisions motivées et exports. Typage/lint stricts verts.
- Correctif civil coordonné : dix cas du normaliseur partagé, seize de la
  démonstration et cinq du formulaire DIASPORALE inclus dans la passe commune.
  Les champs civils structurés sont normalisés à la saisie, validation, écriture
  et reprise ; pseudonymes, organisations et preuves signées sont préservés.
- Backend local 3210 prêt sous Node 22, sans rattachement cloud. Console 3032 :
  accueil, /entrer et /sante-fonctionnelle **HEAD 200** ; journal
  /tmp/antsia-pa7-console-head.log. Cela prouve le service et la compilation des
  routes, pas une navigation authentifiée ni un audit visuel. Après ce contrôle,
  seul le Next 3032 de cette session a été arrêté pour le créneau DIASPORALE ;
  le backend 3210 est conservé. La disponibilité actuelle du frontend dépend
  de cette coordination, distincte des statuts HEAD constatés.

La preuve porte sur l'arbre partagé gelé, comprenant les cinq fichiers moteur
DIASPORALE conservés hors du commit PA7. Leurs évolutions ultérieures demandent
leur propre vérification. Aucun échec d'assertion n'est assimilé à une limite de
machine : l'attente d'un identifiant superflu dans l'audit a été remplacée par
son absence ; le focus bureau et les libellés ont été corrigés, puis revérifiés.

Le scan d'import conserve la minute prévue pour les cliquets, à la place d'une
ancienne surcharge de vingt secondes. Le scan des sorties ne résout lexicalement
que les noms SDK surveillés ; tous ses cas négatifs sont conservés. Aucun test
supprimé, ignoré ni assertion neutralisée.

Le codegen garde le typage strict via tsgo et la même configuration Convex.
Le contrôle tsc du CLI effectuait deux analyses longues pour recueillir une erreur.
Les options CLI explicites sont conservées, le typage natif reste obligatoire,
et ses erreurs produisent un code de sortie non nul. Verify conserve toutes ses
étapes, avec les espaces de travail en série.

## Limites et préalables externes

- Les clients OIDC IDN de sandbox ne sont pas configurés. La recette réelle avec
  deux administrateurs, leur nomination et les ressources/secrets restent au propriétaire.
- Contraste, reflow et clavier réels ne sont pas revendiqués par les tests DOM.
  La recette Chrome/WCAG reste distincte ; aucun contournement d'accès navigateur.
- Les contrats métier de fédération restent fermés jusqu'aux lots autorisés.
  Un rejeu still_failing n'est pas annoncé comme une livraison.
- Les compteurs sont des instantanés techniques datés, et les lectures sont bornées :
  au plus 100 équipes, 100 références de membre par équipe et 500 au total.
- Seule l'archive de compilation PA6 autorisée a été retirée ; les deux .next
  ANTSIA étaient déjà absents. Sources, dépendances et données conservées.
- DIASPORALE est préservée dans l'arbre partagé. Aucun push, merge, production,
  commande Convex de production, modification manuelle d'environnement ou PA8/PA9.
