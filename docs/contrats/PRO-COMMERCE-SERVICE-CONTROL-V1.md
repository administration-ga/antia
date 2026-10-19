# PRO-COMMERCE-SERVICE-CONTROL-V1

P14, 18 octobre 2026. Contrat privé jumeau, octets identiques dans les deux dépôts :
`packages/social-domain/src/commerce-services.ts` et
`PRO_GA/packages/pro-domain/src/commerce-services.ts` (SHA-256
`cb8f418ce38e262e886c4f2f6444c5281a6f53a2f9f08f1afdfdcbc1e338de6c`, vérifiée par un test
écrit dans chaque dépôt). Le manifeste P06 et ses commandes restent inchangés : les trois
parcours utilisent `inquiry.submit` (kind `quote_request`), `quote.accept` et
`booking.request` tels que gelés ; ce contrat n'ajoute que des lectures du sujet acheteur et
trois extensions fermées. **Aucun paiement ni acompte** n'est ouvert par ce protocole.

## Opérations, chemins et scopes

POST serveur à serveur, chemins fixes ; l'opération signée ne vient jamais de l'URL fournie
ni du navigateur. Chaque opération emprunte un scope machine P06 existant.

| Opération | Chemin | Scope | Nature |
|---|---|---|---|
| `service.options` | `/commerce/v1/services/options` | `commerce.inquiry.submit` | lecture des modes d'une offre de service |
| `booking.slots` | `/commerce/v1/services/bookings/slots` | `commerce.booking.request` | créneaux libres, fenêtre ≤ 14 jours, ≤ 60 |
| `booking.read` | `/commerce/v1/services/bookings/read` | `commerce.booking.request` | rendez-vous du sujet et conséquences |
| `booking.reschedule.request` | `/commerce/v1/services/bookings/reschedule-requests` | `commerce.booking.request` | **extension** : changement de créneau |
| `booking.cancel.request` | `/commerce/v1/services/bookings/cancellation-requests` | `commerce.booking.request` | **extension** : annulation par le client |
| `quote.list` | `/commerce/v1/services/quotes/list` | `commerce.quote.accept` | devis transmis au sujet (≤ 20) |
| `quote.read` | `/commerce/v1/services/quotes/read` | `commerce.quote.accept` | une version précise, lignes et total |
| `service.order.request` | `/commerce/v1/services/orders` | `commerce.checkout.prepare` | **extension** : prestation à tarif fixe, sans créneau ni stock |
| `action.status` | `/commerce/v1/services/actions/status` | `commerce.request.status` | consultation d'une extension après réponse perdue |

Le nom réservé P06 `booking.cancel` reste refusé `unsupported_command` par le contrat P06 :
l'annulation passe ici, avec son consentement propre.

## Demande

JSON canonique fermé, 8 Kio au plus : `contract`, `version:1`, `operation`, `source`,
`environment`, `requestId`, `shopRef` (structure), `subject:{kind:"buyer",ref,authVerifiedAt}`,
`issuedAt`, `expiresAt` (≤ 60 s), `payload`. Le sujet est l'opaque `antsia:sub:` du helper
acheteur partagé P10/P11, distinct de tout mandat vendeur ; preuve de session de cinq minutes
au plus. Champs interdits de P06 (contacts, identifiants de structure ou de tenant, URL,
moyens de paiement) refusés à toute profondeur. Instants en millisecondes UTC, fuseau IANA
explicite (`Africa/Libreville`, celui de l'agenda) dans chaque créneau ; un créneau est futur
et dure au plus 480 minutes.

Consentements versionnés de geste (`COMMERCE_SERVICE_CONSENTS`) : `commerce_quote_acceptance`
(`2026-10-18-p14-quote-v1`), `commerce_booking` (`…-booking-v1`), `commerce_booking_change`
(`…-change-v1`), `commerce_booking_cancel` (`…-cancel-v1`), `commerce_service_order`
(`…-order-v1`) ; textes FR/EN dans `COMMERCE_SERVICE_CONSENT_TEXTS`, empreinte conservée par
PRO.GA avec la preuve d'acceptation d'un devis.

## Signature

En-têtes P08 (`X-Pro-Key-Id`, `X-Pro-Timestamp`, `X-Pro-Nonce`, `X-Pro-Signature`) ; HMAC-SHA256
base64url sur composants préfixés par leur longueur : profil
`pro-ga-commerce-service-control-hmac/v1`, clé, horodatage, nonce, source, environnement,
audience `pro.ga.commerce.service`, scope de l'opération, opération, SHA-256 des octets exacts.
Profil distinct de COMMAND, LINK, CATALOG et CHECKOUT-CONTROL ; nonce unique ; horodatage récent.

## Idempotence et réponse perdue

- **Extensions** : décision DURABLE par `(source, environnement, requestId)`. Même clé + mêmes
  octets → mêmes octets de réponse (même expirée) ; même clé + autres octets → `conflict`
  (409) ; sans décision, une demande expirée est refusée `request_expired`, jamais exécutée.
  `unavailable` n'est jamais enregistré. `action.status` rend `completed` + réponse enregistrée
  et son empreinte, ou `unknown` sans rien révéler, plus l'état privé courant (rendez-vous,
  commande, devis) du seul sujet.
- **Lectures** : reçu technique court (réutilisation d'un identifiant avec d'autres octets →
  conflit), aucune écriture métier.
- **P06** (`booking.request`, `quote.accept`) : même règle de rejeu durable côté PRO.GA ;
  `request.status` rend la réponse enregistrée.
- ANTSIA persiste les octets exacts (30 minutes au plus), consulte d'abord, renvoie ensuite les
  MÊMES octets tant que la demande peut s'exécuter, et ne frappe jamais un second identifiant
  pour la même intention.

## Réponses fermées

Base corrélée : `contract`, `version`, `requestId`, `requestSha256`, `respondedAt`,
`outcome` ∈ {`accepted`, `reconfirm_required` (commande de prestation seulement), `refused`,
`unavailable`, `conflict`}, puis `result` ou `reason` (liste fermée par opération,
`access_denied` indistinct). Statuts HTTP : 200, 200, 422, 503, 409. ANTSIA rejette toute
réponse non corrélée, non canonique, hors bornes ou incohérente :

- **Rendez-vous** : `{appointmentRef, serviceRef, serviceLabel, resourceLabel, startAt, endAt,
  timeZone, state, holdExpiresAt, revision, updatedAt, cancellation, replacementRef, replacesRef,
  policy:{cancelUntil, changeUntil, changeRequiresConfirmation, deposit:"unavailable"}}`. Seule
  une demande `requested` retient son créneau (`holdExpiresAt`) ; un rendez-vous fermé n'a plus
  de délai ; `cancellation` ⟺ état annulé.
- **Changement** : `{previous, current}` — échange immédiat (ancien `cancelled_by_client` /
  `rescheduled`) OU remplacement en attente (ancien `confirmed` avec `replacementRef`, nouveau
  `requested` avec `replacesRef`). Un refus ne modifie rien : l'ancien rendez-vous est conservé.
- **Annulation** : état `cancelled_by_client` / `client`, révision strictement supérieure ; une
  demande de remplacement en attente est retirée avec lui.
- **Devis** : version, total, lignes (somme exacte), validité, état (jamais `draft`),
  `current`, `acceptable` (dernière version transmise, non expirée, non acceptée) et preuve
  d'acceptation du client (version et total exacts).
- **Commande de prestation** : une ligne au prix et à la révision attendus, total exact,
  `state:"pending"` ; `reconfirm_required` seulement si le prix ou la révision ont changé.

## Autorité PRO.GA

Source active, scope de l'opération, unique liaison active portant la permission du parcours
(`receive_bookings`, `receive_inquiries`, `receive_orders`) et mandat vivant de son titulaire
(contexte de structure et tâche : `agenda.appointments.manage` ou `quotes.send`), structure
active et publiée (vérifiée pour une commande), module effectif (`agenda` ou `commerce`), site
publié. Un rendez-vous, un devis ou une commande ne se lit et ne se gère que par le sujet qui
l'a obtenu, dans la même boutique, source et environnement. L'annulation d'un engagement
existant n'exige pas la permission vivante (fermeture des nouvelles réservations).

## Preuve

Tests ÉCRITS, NON EXÉCUTÉS (décision du propriétaire du 18/10/2026) :
`packages/social-domain/src/commerce-services.test.ts`, `serviceTime.test.ts`,
`convex/modules/shops/services.test.ts` ; PRO.GA `packages/pro-domain/tests/commerce-services.test.ts`,
`convex/modules/integrations/commerceServices.test.ts`. Aucun résultat n'est annoncé.
