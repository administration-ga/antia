# PRO-COMMERCE-CHECKOUT-CONTROL-V1

P11, 18 octobre 2026. Contrat privé jumeau :
`packages/social-domain/src/commerce-checkout.ts` et
`PRO_GA/packages/pro-domain/src/commerce-checkout.ts`. Le manifeste et les commandes P06
restent inchangés. Aucun paiement, commande acceptée ou sortie de stock dans ce protocole.

## Opérations et autorité

POST serveur à serveur sur trois chemins fixes : `/commerce/v1/checkouts/options`,
`/commerce/v1/checkouts/status`, `/commerce/v1/checkouts/release`. Le navigateur fournit
uniquement des choix métier au backend ANTSIA, jamais une origine, un tenant, une signature,
un identifiant de stockage ou un sujet libre.

Chaque requête JSON canonique fermée contient `contract`, `version:1`, `operation`, `source`,
`environment`, `requestId`, `shopRef`, `subject:{kind:"buyer",ref,authVerifiedAt}`, `issuedAt`,
`expiresAt`, `payload`. Le payload est vide pour options ; statut/libération exigent seulement
`checkoutRef`. Le sujet opaque est celui du helper acheteur partagé avec P10, distinct du
mandat vendeur. Fenêtre de requête : 60 secondes ; preuve de connexion : cinq minutes au plus.
Corps et réponses limités à 8 Kio, clés inconnues et JSON non canonique refusés.

Options exige source active, scope `commerce.checkout.prepare`, liaison `receive_orders`,
publication consentie, vendeur vérifié, module effectif et mandat vendeur actuel, politique
de préparation activée et mode de remise admissible. Statut/libération retrouvent seulement
le checkout du même sujet/source/environnement/boutique ; un retrait de vitrine ne doit pas
empêcher de libérer son propre hold. Aucune préparation nouvelle dans cette voie historique.

## Signature et idempotence

En-têtes P08 : `X-Pro-Key-Id`, `X-Pro-Timestamp`, `X-Pro-Nonce`, `X-Pro-Signature`.
HMAC-SHA256 base64url canonique sur composants préfixés par leur longueur : profil
`pro-ga-commerce-checkout-control-hmac/v1`, clé, timestamp, nonce, source, environnement,
audience `pro.ga.commerce.checkout`, scope `commerce.checkout.prepare`, opération, SHA256
des octets exacts. Profil distinct de COMMAND, LINK et CATALOG. Nonce unique, timestamp
récent, clé privée serveur et environnement explicitement configuré obligatoires.

Les reçus techniques lient clé de requête, empreinte, sujet et opération. Une libération
rejouée rend sa réponse sans décrémenter le stock une seconde fois. Options et statut
relisent leur état actuel. Leur rétention courte ne remplace pas l'idempotence métier
durable de `checkout.prepare` ni l'état de la réservation.

## Réponses fermées

Base corrélée : `contract`, `version`, `requestId`, `requestSha256`, `outcome`.

- `accepted` options : `shopRef`, `policyVersion`, établissements de retrait publiés
  `{establishmentRef,label}`, frais XAF entiers et éventuelle livraison vendeur configurée.
- `accepted` statut/libération : `checkoutRef`, `state`, `revision`, `expiresAt`,
  `confirmationRequired`. Une libération réussie est `released` ou `expired` ; `held`
  ou `consumed` ne sont jamais présentés comme un abandon réussi.
- Refus : `refused` ou `unavailable`, raison fermée `access_denied`, `not_available`,
  `not_releasable`, `rate_limited`, `invalid_request`. Le client contrôle également le
  statut HTTP, l'empreinte et la corrélation avant d'afficher le résultat.

Sans cookie, redirection, cache HTTP ni journal de corps privé. ANTSIA relit la session,
l'appartenance et l'autorité de la tentative avant et après chaque échange ; une réponse
tardive ne rétablit pas un droit révoqué. Le paiement demeure indisponible.

## Preuve

Contrat, transport et scénarios de refus/corrélation écrits dans les sources. À la demande
du propriétaire, aucune génération, vérification ou recette réelle n'a été exécutée pour
cette reprise. Ces fichiers ne prouvent aucun échange sandbox ni publication.
