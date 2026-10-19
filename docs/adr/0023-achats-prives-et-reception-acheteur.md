# ADR0023 — Achats privés et réception explicite

Date : 18 octobre 2026. Statut : proposé pour les sources P13 ; contrôles et recette différés à la demande du propriétaire. Numérotation locale, sans nouvelle consultation distante.

## Contexte

P11 prépare un panier et réserve du stock. P12 crée la commande et suit le paiement dans PRO.GA, avec une répartition prévue des fonds collectés par ANTSIA. Ces états ne prouvent ni remise effective ni réception par l’acheteur. La vitrine publique ou la liaison commerciale peut être retirée alors qu’un engagement antérieur subsiste. La messagerie P10 repose sur la publication courante et ne doit pas être ouverte globalement pour contourner cette garde.

## Décision

La commande canonique PRO.GA donne une autorité historique privée à son acheteur opaque, corrélée à la source, l’environnement, la boutique, la préparation et le paiement d’origine. ANTSIA n’en conserve qu’une projection privée et périssable ; aucune comptabilité ni décision financière locale. Les requêtes gardent l’adhésion et la session vivante avant et après le transport. Un retrait de vitrine ne transforme pas cette autorité en accès public.

Le contrôle `PRO-COMMERCE-ORDER-CONTROL-V1` est un contrat jumeau séparé du manifeste P06 gelé. Son profil HMAC propre, ses chemins, son scope explicite, ses nonces et ses bornes empêchent de réutiliser une signature de catalogue, préparation ou paiement. Toute action possède une identité métier stable et une révision ; les décisions durables ne sont pas purgées avec les corps techniques. Après incertitude, rechercher cette identité avant de reprendre les mêmes arguments.

La réception est une déclaration explicite de l’acheteur, sous texte versionné. Le paiement réussi, le stock consommé et une étape vendeur ne la remplacent pas. Sa preuve est distincte de la livraison et de l’allocation financière. Elle ne commande aucun reversement dans P13 ; les connecteurs et la redistribution effective restent fermés.

Annulation, retour et contact disposent d’un canal privé lié à l’engagement dans PRO.GA. Une demande ne vaut ni accord, ni annulation définitive, ni remboursement. Le vendeur garde ses droits de structure ; la décision financière reste à la plateforme selon P12. Les historiques projetés n’incluent pas les notes internes ni les identités de gestionnaires.

Le panier de session est mono-vendeur et borné. Il garde des références, quantités et intentions pour la reprise ; aucune adresse, autorisation financière ou donnée d’authentification. Un partage d’offre utilise uniquement son URL publique. Les achats restent privés et non indexables.

## Conséquences

Les engagements restent consultables après retrait public tant que les autorités privées et le transport sont disponibles. Une absence de transport donne un état indisponible, pas un résultat inventé. Les délais de corps/cache limitent l’exposition ; les preuves contractuelles et financières PRO.GA suivent leur conservation propre. L’effacement ANTSIA révoque les opérations et purge les projections, sans déclencher de mouvement de fonds.

Les captures, le comportement sur appareil, la recette sandbox, le traitement complet des litiges et le reversement rapproché ne sont pas démontrés par la présence de ces sources. Ils restent des étapes explicites avant activation.
