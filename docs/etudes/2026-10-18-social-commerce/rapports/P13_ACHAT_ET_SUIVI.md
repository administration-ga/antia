# P13 — Panier et suivi privé des achats

Date : 18 octobre 2026. **État : implémentation en sources, partielle ; vérifications, recette et activation différées à la demande du propriétaire.**

## Périmètre autorisé

P13 uniquement, dans les vrais checkouts ANTSIA et PRO.GA. Le travail P12 de l’autre session a été libéré avant les raccords. Les sources P10, le manifeste P06, DIASPORALE et le pont de session gelé sont préservés. Aucun changement de branche, commit ou publication.

Bases Git observées pendant ce lot : ANTSIA `9eaff40`, branche existante `codex/pa4-identite-session` ; PRO.GA `9497f22`, branche existante `feat/antsia-social-commerce`. Les changements P13 sont non commités dans des arbres partagés qui contenaient déjà d’autres travaux. Ces identifiants ne désignent pas une livraison P13.

## Architecture retenue

- Panier de dix lignes maximum, un seul vendeur, variantes exactes, quantités bornées. Les prix proviennent du catalogue et le total demeure confirmé par la préparation PRO.GA. Les offres « Sur devis » ne deviennent pas payables à un montant inventé.
- Brouillon de session isolé par réseau et personne, durée de 24 heures, purgé à la déconnexion. Références, quantités et intention seulement ; aucune adresse, donnée d’authentification ou autorisation financière conservée. Une recharge demande de ressaisir l’adresse. L’intention envoyée est recherchée avant sa reprise, avec la même identité et les mêmes arguments. Un abandon serveur clôt uniquement une intention sans préparation : la transaction retrouve d’abord une préparation existante, sinon verrouille définitivement son ancienne clé. Il ne demande aucune annulation PRO.GA.
- Mes achats découle des tentatives P12 liées à de vraies commandes PRO.GA. Les états commande, paiement, stock, remboursement, remise, réception et répartition restent séparés. Une projection ANTSIA ne vaut jamais preuve financière locale.
- `commerce-orders.ts` est un contrat privé jumeau hors du manifeste P06 gelé : corps fermés, scope explicite, HMAC distinct, références et empreinte corrélées, horloge et tailles bornées. Opérations : lecture, recherche d’action, annulation demandée, réception, retour demandé et message au vendeur.
- Le support est rattaché à la commande et reste privé après retrait d’une vitrine. Les gardes générales de messagerie P10 ne sont pas assouplies. PRO.GA garde les décisions durables ; les corps techniques et projections privées ANTSIA expirent.

## Points d’entrée des sources

| Périmètre | Entrées raccordées |
|---|---|
| Contrat jumeau | `packages/social-domain/src/commerce-orders.ts` et `PRO_GA/packages/pro-domain/src/commerce-orders.ts`, export privé dédié |
| Panier ANTSIA | `/panier`, `components/cart/`, `lib/cart-draft.ts`, formulaire P11 multi-lignes, API `checkout.cartContext/findByClientRequestId/stopClientIntent` |
| Achats ANTSIA | `/mes-achats`, `/mes-achats/[purchaseId]`, `components/purchases/`, `shops/purchases*` et `shops/purchase*` |
| PRO.GA | `integrations/commerceOrder*`, `payments/commerceOrderSupport.ts`, six routes privées dans `convex/http.ts`, annulation P06 et recherche durable |
| Interface vendeur PRO.GA | Section `CommerceOrderSupport` montée dans `OrdersBoard`, sous tâches et session de structure |
| Données privées | Cache/demandes achats, verrou de clé de panier ; schéma, quotas, crons, politiques, export et effacement ANTSIA |

Le profil propose Mes achats ; le suivi de paiement mène au même achat. Le remboursement reste dans l’écran P12 existant. Les primitives UI et le thème partagé ne sont pas modifiés pour ce lot.

## Décisions après commande

La réception exige une déclaration de l’acheteur sous texte versionné et des preuves concordantes de paiement et de remise. Un clic au retour du fournisseur, une réserve consommée ou une étape vendeur ne la remplace pas. Cette déclaration ne lance aucun reversement : les fonds restent soumis aux portes financières P12 et au futur rapprochement fournisseur.

Le texte/version de réception est distinct de l’accord de préparation d’origine : confirmer une réception ne réécrit pas les conditions de vente.

Annulation et retour sont des demandes selon les capacités calculées. Les sommes incertaines ne sont pas supposées annulées ; un remboursement demandé n’est jamais affiché comme effectué. Les demandes financières réutilisent P12 et son autorisation plateforme. Le contact vendeur est un échange privé propre à l’engagement, sans copie dans un profil public.

Les réponses perdues donnent un état inconnu. Une recherche corrélée précède la reprise de la même action ; une nouvelle identité ne sert pas à contourner une incertitude. Hors ligne, conserver le brouillon et suspendre les écritures. Le partage ne porte que sur le lien public d’une offre ; les pages d’achats ont des métadonnées génériques et sans indexation.

Le cache refuse une modification des références, du vendeur figé, des lignes, frais ou montant et toute régression des révisions de commande/paiement ou de la date source. L’expiration réelle d’une réserve peut cependant changer le stock et les capacités sans nouvelle révision financière : ces observations restent distinctes du montant contractuel. Les messages et corps techniques ANTSIA sont masqués à échéance et purgés par tranches ; une action expurgée reste recherchable mais n’est plus reconstruite arbitrairement.

## Preuves et limites

Des scénarios sont écrits pour les contrats et les parcours ajoutés. **Aucun n’est exécuté.** Aucun codegen, test, typage, lint, audit, build, navigateur, service, commande Convex, requête interproduit réelle, transaction, remboursement ou versement n’est lancé pendant ce lot. Les références API générées ne sont pas éditées à la main.

Le fond blanc et les cartes beige restent fondés sur les jetons ANTSIA existants. Il n’existe aucune nouvelle preuve visuelle, mobile, clavier ou lecteur d’écran. Les captures et la recette sandbox à deux variantes, refus puis succès, reprise, retrait de boutique et suivi croisé restent à réaliser lorsque le propriétaire redemandera les contrôles.

Les fournisseurs P12 restent sans connecteur concret actif ; aucune disponibilité d’un moyen de paiement n’est déduite de son nom. Le reversement effectif, les obligations et durées de conservation financières, ainsi que la procédure complète de litige ne sont pas déclarés livrés par P13.

Les engagements anciens peuvent manquer du nom vendeur figé, du mode de remise ou du délai : ces valeurs restent inconnues, sans relire des conditions commerciales courantes pour réécrire l’histoire. Le délai n’était pas conservé dans le modèle P11 ; il reste visible avant engagement dans les options disponibles, mais n’est pas inventé dans le suivi historique.

PRO.GA borne opérationnellement le texte du support à 90 jours, avec masque de lecture et purge de contenu distincte des preuves, états et clés d’anti-rejeu. Cette borne n’est pas une validation juridique de conservation. Aucun pipeline général PRO.GA d’export/effacement de ces textes n’a été identifié dans le périmètre repris ; cette intégration reste une limite explicite. L’effacement et l’export ANTSIA intègrent en revanche les nouvelles projections et demandes.

## Retour arrière

Fermer les nouvelles écritures par les capacités/portes serveur sans effacer les engagements existants ni leurs preuves. Conserver la lecture et le rapprochement historiques ; ne pas assimiler la purge d’un corps technique à l’effacement d’une décision métier ou d’une écriture financière. Ne supprimer aucune donnée pour revenir sur l’interface.

Références : [plan d’exécution](P13_PLAN_EXECUTION.md), [prompt P13](../prompts/P13_PARCOURS_ACHAT.md), [rapport P12](P12_PAIEMENT.md), [ADR0023](../../../adr/0023-achats-prives-et-reception-acheteur.md).
