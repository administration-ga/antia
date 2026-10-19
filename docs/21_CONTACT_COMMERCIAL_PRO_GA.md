# P10 — Contact commercial avec PRO.GA

18 octobre 2026. **Implémentation dans les sources partagées ; vérifications, génération et activation différées à la demande du propriétaire.** Ce rapport n’atteste aucun échange HTTP réel, appel, prospect créé, retrait distant, installation ou publication.

## Parcours raccordé

Une vitrine ou une fiche d’offre mène vers « Poser une question ». La connexion conserve une intention fermée `shop_contact` (boutique et offre facultative), sans accepter une URL de redirection arbitraire. La conversation est liée au réseau dans lequel la demande a été ouverte ; partager son adresse ne la déplace pas et ne donne aucun droit.

La première demande contient un seul texte de 1 à 2 000 caractères. Les pièces et appels restent fermés avant acceptation. Le vendeur accepte ou refuse, ferme, bloque ou signale ; le demandeur peut bloquer et clore. Les intentions de blocage des deux côtés restent indépendantes et interdisent de contourner un refus par un nouveau fil. Les demandes et messages portent une intention idempotente liée à l’auteur et aux octets de contenu.

Dans Messages, la source commerciale est injectée par ANTSIA seulement, avec filtre Boutiques, recherche, listes paginées, détail, états d’attente et retour à la fiche. Les composants du composeur et des messages sont réutilisés ; les identifiants commerciaux ne sont jamais convertis en fils personnels. La garde de relation acceptée des conversations personnelles reste en place.

## Autorité et ouverture

`convex/modules/commercialMessaging/` porte les conversations, messages, blocages, lectures, réglages, mandats et appels. Le schéma agrège ces tables et les nouvelles tables CRM. Le module est classé social dans le cliquet de portée réseau.

- Le réseau et la boutique doivent ouvrir ce canal ; l’absence de politique et de réglage signifie fermé. La console, section Pages, porte l’ouverture du réseau avec décision motivée et audit.
- Un gérant règle l’accueil et propose les mandats ; le répondant les accepte. Lecture, réponse, décision et appel sont distincts et relus sur la qualité vivante de signataire, l’adhésion et la révision du mandat. Gérer une boutique ne donne aucun accès implicite à tous les clients.
- Les quotas bornent le membre, la paire membre/boutique et la destination, puis les échanges, mandats et transferts CRM. Une lecture ou un partage de lien n’accorde aucun mandat.
- Après acceptation, les pièces passent par les gardes de dépôt frais, type déclaré, analyse et délivrance existantes. Un fichier retenu conserve un état explicite ; son URL n’est jamais fabriquée dans l’écran.

Les appels utilisent le moteur existant : accord des participants, répondant choisi explicitement, préférences, présence, silence et occupation. L’autorité commerciale est relue avant sonnerie, acceptation, lecture et jeton. La révocation ferme la salle par la porte existante ; les jetons commerciaux expirent après 60 secondes. Un jeton déjà émis n’est pas présenté comme révoqué cryptographiquement à l’instant du retrait. Aucun groupe, promotion ou message vocal ne détourne ce canal.

Le droit de donner son accord d’appel est projeté séparément de l’admission actuelle d’un appel : un répondant sans mandat d’appel ne reçoit pas une case d’activation condamnée au refus. Le journal rappelle par le canal commercial ; l’écran de fin ouvre son fil et ferme le rappel personnel. Sans projection vivante, ces gestes restent fermés. Les réponses indiquent la boutique et l’alias publié du répondant.

## Choix CRM et transport

Le demandeur sélectionne un texte, éventuellement un alias d’affichage, et coche un consentement non prérempli de version `2026-10-18-p10-v1`. Le texte est défini en FR/EN dans le jumeau pur `commerce-inquiry.ts`. Le transfert ne contient ni transcription complète, ni graphe, ni carnet, ni adresse e-mail ou téléphone. Le retour de conversation reste ANTSIA.

L’opération P06 existante `inquiry.submit` crée un prospect dédié dans le CRM PRO.GA, avec provenance ANTSIA. Elle utilise un sujet opaque acheteur, distinct du sujet vendeur de liaison ; le helper `shops/commerceBuyerSubjects.ts` est commun aux lots P10/P11. PRO.GA rejuge source, environnement, scope, liaison `receive_inquiries`, véritable mandat vendeur, structure, offre éventuelle et quotas. Les droits CRM PRO.GA restent ses droits internes ; un mandat de réponse ANTSIA ne les confère pas.

`crm.ts` conserve une intention unique par conversation et les octets canoniques exacts. `crmTransport.ts` utilise la configuration P08 exclusivement serveur, HMAC, nonces frais, délai HTTP de huit secondes, baux et générations. Les arguments planifiés contiennent seulement réseau et référence du transfert. Le backend relit l’accord, la session Better Auth d’origine et les droits vivants avant émission et après retour. Les reprises réutilisent les octets ; après expiration, `request.status` cherche le reçu du même effet, sans créer une nouvelle intention. Huit essais automatiques au maximum ; une relance manuelle conserve l’intention et change la génération du bail.

Le contrat privé `PRO-COMMERCE-INQUIRY-CONSENT-V1`, hors manifeste P06 figé, porte le retrait sur `/commerce/v1/inquiry-consents`. Il réutilise le profil HMAC P08 `inquiry.submit`, lié aux octets et à une enveloppe différente. Le nom réservé P06 `inquiry.withdraw` reste inexécutable. Les octets d’un essai de retrait sont conservés pendant sa fenêtre ; une nouvelle fenêtre reçoit une nouvelle référence technique, tandis que l’effet de retrait reste idempotent sur la demande originale.

PRO.GA garde une preuve externe versionnée (horodatage déclaré et empreinte du bundle FR/EN), sans la transformer en consentement marketing ni lui substituer sa politique locale courante. Une table durable conserve le reçu métier après la purge des reçus techniques. Un retrait arrivé avant une émission tardive crée une tombe qui interdit la résurrection du prospect.

## Retrait, données et modération

Le retrait efface immédiatement le texte, l’alias et le corps d’émission locaux et ferme les émissions nouvelles. Le statut distingue l’attente du reçu distant et sa confirmation. PRO.GA minimise la seule copie dédiée du prospect et retire l’accord de contact ; les engagements et les clients déjà constitués restent distincts. Aucun contact de carnet n’est créé automatiquement depuis l’alias.

« Mes données » propose aussi la liste personnelle des accords, leur retrait et leur relance, sans exiger une adhésion active à la boutique ou au réseau. Le blocage, la clôture, le retrait du profil social et la demande d’effacement amorcent le retrait CRM. L’effacement final attend le reçu de retrait avant d’effacer les éléments de corrélation ; une panne ou une configuration manquante laisse donc une attente explicite, jamais une suppression externe prétendue acquise.

L’inventaire d’export et d’effacement classe chaque nouvelle table. L’export ne donne pas le fil des clients à un administrateur ou signataire ; les sujets opaques techniques, corps signés et identifiants de session sont exclus. Les fichiers suivent la purge des messages. Après 90 jours, la purge traite les fils clos/refusés/bloqués par tranches de 20 messages ; une intention de blocage conserve un fil minimal sans contenu jusqu’au déblocage. Une attente de retrait CRM reporte la purge sans monopoliser les autres fils.

Le signalement cible un `commercialMessage`. L’aperçu réservé au dossier de modération ne donne que ce message, aucune pièce, aucun participant ni voisin. Le contenu retenu est distingué d’un contenu supprimé. La cloche utilise un genre sans contenu ni nom de client copié, rejuge l’accès au fil à l’émission, à la livraison et à l’ouverture ; son adresse commerciale n’est injectée que par ANTSIA.

## Fichiers et passation

- ANTSIA : `convex/modules/commercialMessaging/`, `shops/commerceBuyerSubjects.ts`, contrat pur `packages/social-domain/src/commerce-inquiry.ts`, CRM personnel, modération/notifications/données/quotas et crons ; `components/shops/contact-*`, source et vue commerciales de la messagerie, routes et continuation d’entrée ; réglage console Pages.
- PRO.GA : `convex/modules/integrations/commerceInquiry*.ts`, dispatcher COMMAND, route HTTP, tables et rétention, provenance/consentement du CRM, documentation `../PRO_GA/docs/21_CONTACT_COMMERCIAL_ANTSIA.md`.
- Tests nouveaux ou adaptés : domaine, backend commercial et CRM, protocole privé, routes/continuation, vues/source et parcours PRO.GA. **Écrits uniquement, jamais exécutés pour P10.**

Le lot P11 appartient à l’autre conversation et conserve ses fichiers checkout, ses tables et ses raccords additifs. P10 lui transmet le helper de sujet acheteur et libère les ancres PRO ainsi que le slot d’offre membre. Les travaux PA9/PA10, DIASPORALE et les cinq fichiers du pont de session ont été préservés.

## Restes explicites

1. Génération officielle des API puis contrôles demandés explicitement sur un état de sources figé ; aucune validité de compilation ou exécution n’est affirmée ici.
2. Configuration/provisionnement par le propriétaire et ouverture ciblée des politiques/mandats. Aucun secret, environnement réel, lien, service, prospect ni politique n’a été manipulé pour ce lot.
3. Recette deux comptes : inconnu, première demande, refus/spam, autre réseau, révocation du répondant, blocage réciproque, double clic/timeout, pièces retenues, appel et révocation en cours, retrait avant/après réponse CRM, export et effacement.
4. PRO.GA ne possède pas encore de contrat général d’export/effacement externe de tout le sujet opaque. P10 minimise la copie dédiée et conserve les preuves/rattachements minimaux ; le cycle général et la politique de conservation juridique restent à expliciter, sans annoncer un effacement universel.
5. Réponse humaine côté ANTSIA et droits CRM séparés ; aucun faux transport automatique de réponses PRO.GA ni preuve de réception sur appareil. Aucun paiement, encaissement ou engagement de devis n’est activé par P10.

Aucun test, codegen, typage, lint, build, audit automatique, recette navigateur, serveur, installation, commande Convex, commit ou publication n’a été exécuté pour cette livraison.
