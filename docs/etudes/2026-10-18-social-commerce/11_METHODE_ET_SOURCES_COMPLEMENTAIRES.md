# Méthode, sources et limites de l'étude

Date de consultation : **18 octobre 2026**.

## 1. Travail réalisé

- Lecture du cahier ANTSIA, plan PA0–PA10, carte de duplication et annexes, cahier DIASPORALE et décisions du moteur.
- Audit local ANTSIA : surfaces, pages/droits, médias, fil, tokens, communication et fédération.
- Audit local PRO.GA : catalogue/variantes, stock, commandes, paiement, CRM, agenda, recrutement, authentification et échanges.
- Recherche documentaire officielle Instagram/Meta, TikTok, WhatsApp et Facebook : quatorze sources dans [le benchmark](01_BENCHMARK_SOURCES.md).
- Conception des parcours, responsabilités, contrats, états d'erreur, nouvelle palette et critères de recette.
- Calcul de seize associations de contraste sRGB ; aucune mesure navigateur de cette nouvelle palette.
- Production d'un plan ordonné et de vingt prompts d'implémentation.

Skills appliqués : [plan-big-execute-small](/Users/okatech/.agents/skills/plan-big-execute-small/SKILL.md), [design-system](/Users/okatech/.codex/plugins/cache/claude-cowork/design/1.2.0/skills/design-system/SKILL.md), [write-spec](/Users/okatech/.codex/plugins/cache/claude-cowork/product-management/1.2.0/skills/write-spec/SKILL.md), [system-design](/Users/okatech/.codex/plugins/cache/claude-cowork/engineering/1.2.0/skills/system-design/SKILL.md). Trois sous-tâches bornées ont produit les audits et les références ; la stratégie, le plan et la cohérence ont été synthétisés dans le dossier principal.

## 2. Sources primaires complémentaires

| ID | Source directe | Ce qu'elle étaye | Limite |
|---|---|---|---|
| S15 | W3C — [Understanding SC 1.4.3 Contrast Minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) | Seuils de contraste et distinction texte courant/grand texte | N'atteste pas les écrans ANTSIA |
| S16 | W3C — [Understanding SC 2.5.8 Target Size Minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) | Taille/espacement des cibles WCAG 2.2 | La recommandation produit ANTSIA de 44 px est plus confortable que ce minimum |
| S17 | LiveKit — [Encryption overview](https://docs.livekit.io/transport/encryption/) | Configuration E2EE et responsabilité de gestion des clés ; signalisation distincte | Documentation courante, pas audit de la version installée ni du protocole ANTSIA |
| S18 | SingPay — [Documentation de référence API](https://client.singpay.ga/doc/reference/index.html) | Existence de procédures de paiement mobile, lien externe et statut transactionnel | Candidat étudié seulement ; admission marchands, garanties, frais et disponibilité doivent être confirmés |

Ces pages ont été consultées, sans inscription, clé ou appel de transaction. Aucune recommandation tarifaire, aucun avis juridique ni affirmation de couverture réglementaire n'est déduit de l'étude. Les choix de fournisseur et conditions commerciales restent des décisions d'implémentation/pilote à instruire.

## 3. Lecture des preuves locales

Les audits [ANTSIA](02_AUDIT_ANTSIA.md) et [PRO.GA](07_AUDIT_PRO_GA.md) contiennent leurs commits et leurs références `chemin:ligne`. Les fichiers partagés peuvent évoluer pendant une autre session : ces références indiquent ce qui a été lu et doivent être rafraîchies en P00. Aucun résultat historique de tests n'est présenté comme une vérification de la nouvelle architecture.

Le dossier est ajouté uniquement sous `docs/etudes/2026-10-18-social-commerce/`. Aucun changement applicatif, schéma actif, thème servi, session, serveur ou navigateur n'est requis pour le rédiger. Les futurs prompts désignent explicitement les chemins existants et les chemins proposés.

Contrôle documentaire réalisé : **34 fichiers Markdown**, dont **20 prompts numérotés** et un préambule commun ; **117 liens Markdown** examinés, aucune cible locale manquante, aucune référence de source non définie, aucun bloc de code non fermé. L'ordre de dépendances proposé ne comporte pas de cycle. Les cinq empreintes du correctif de session antérieur restent identiques au relevé de gel ; les changements applicatifs d'autres conversations restent étrangers à cette étude.

## 4. Limites utiles à la décision

Il s'agit d'une étude fondée sur documents et sources, pas d'une observation exhaustive des quatre applications avec comptes connectés ni d'une étude terrain déjà conduite. Les conventions recherchées sont transférées en propositions ANTSIA. Aucun design-system privé, algorithme de recommandation, asset de marque ou code tiers n'est supposé accessible.

L'identité visuelle et les parcours sont assez précis pour lancer les premiers lots. Le paiement réel, l'autorité commerciale, la liaison entre comptes, les appels natifs et les obligations de conservation nécessitent leurs décisions et leurs preuves propres. Le plan les rend visibles et séparables sans les présenter comme déjà résolus.
