---
title: "ANTSIA — Annexe A6 du document 02 : inventaire contradictoire, front — messagerie, iappel, direct, stories, notifications, primitives, coque et paquets"
date: "2026-10-14"
source: "socle administration.ga, origin/main = ad2e7fdc2, copie propre (git worktree add), lecture seule"
statut: "Rapport d'inventaire brut, produit en lecture seule ; la synthèse décisionnelle est docs/02_OWNER_MAP_DUPLICATION.md"
---

> Annexe A6 de `docs/02_OWNER_MAP_DUPLICATION.md`. Les chemins sont relatifs à la racine d'une copie
> propre du socle sur `origin/main` (`ad2e7fdc2`). Les numéros de ligne valent pour ce commit. Quand une
> décision du document 02 diffère d'une proposition de ce rapport, c'est le document 02 qui fait foi.

# Inventaire contradictoire — surfaces sociales (socle `ad2e7fdc2`, lecture seule)

Ce rapport couvre 235 fichiers sources et 143 tests pour les 5 features, plus les primitives, la coque et les paquets. Les comptes viennent de `wc -l`, les lignes citées de `grep -n`. Aucune écriture, aucun `git fetch`, aucun `bun`. Seule exception de méthode : `git cat-file`/`git diff` en lecture, pour dater l'annexe B.

**Légende**
- Chemins relatifs à `$S`.
- **AF** = `socle/packages/agent-features/src`. **RP** = `AF/features/reseau-personnel`. **SH** = `AF/shell`. **ST** = `AF/stores`. **HK** = `AF/hooks`. **LB** = `AF/lib`. **CP** = `AF/components`. **FS** = `AF/features/floating-surface`.
- **G:api** = `@convex/_generated/api`, **G:dm** = `@convex/_generated/dataModel`, **@w** = `@workspace`.
- Les imports `react`, `lucide-react` et `sonner` sont omis. « int. » désigne les imports internes à la feature.
- **Catégories** : S social · S* social marqué administration · K coque · A administratif.
- **SORT** :
  - **TQ** : tel quel.
  - **TQ\*** : tel quel, avec une branche `scope==="poste"` inerte à élaguer plus tard.
  - **AD** : à adapter.
  - **RW** : à réécrire.
  - **RX** : retirer.
- **Cibles** :
  - **SF** = `packages/social-features/src`, avec `SF/f/<feature>/` pour les features et `SF/shell/…` pour la coque.
  - **UI** = `packages/ui/src/…`.
  - **API** = `packages/api/src/…`.

**Constats transverses (valables pour tout le périmètre)**
- **Couleurs littérales** : une seule source. `messagerie/messagerie-styles.tsx` l.1235 (`rgb(14 26 43 / .3)`) et l.1930-1931 (`white` et `black`, contraste obligé du QR). Partout ailleurs, ce sont des jetons `var(--…)` (il existe un cliquet « aucune couleur littérale dans la couche d'appel »).
- **`next/link` direct** : aucun. Tout passe par `@w/routing` : `useRouter` ×13, `usePathname` ×6, `useSearchParams` ×5, `Link` ×5.
- **i18n** : toutes les chaînes d'interface sont du français en dur. Seule exception : `EspaceFloatingCard`, qui utilise `t("common.close")` l.231 et `t("common.stepProgress")` l.298.
- **`Africa/Libreville`** : 3 occurrences.
  - `messagerie/groupe-gestion.ts:264`
  - `iappel/settings/poste-hours-form.ts:127`
  - `direct/direct-playback.ts:174`
- **`Intl…("fr-FR")` en dur** :
  - `messagerie-liste.ts:64,68,72`
  - `groupe-gestion.ts:261`
  - `messagerie-bulles.ts:86,91,243`
  - `IappelJournal.tsx:80`
  - `call-timer.ts:93,101`
  - `poste-hours-form.ts:107,123`
  - `direct-playback.ts:170`
  - `my-presence-row.tsx:28`
- **`makeFunctionReference`** :
  - `messagerie/transfert-api.ts:21,48,54`
  - `direct/use-direct-presence.ts:31,48,55`
  - `direct/use-direct-host-heartbeat.ts:25,48,55`
- **Résolution par chaîne sur `api` (anyApi)** :
  - `direct/ParticipantsPanel.tsx:113-169` (`resolveRef`, `directQueryRef`, `mutationRef`).
  - `direct/ReplayManagementPanel.tsx:144-155` (`directActionRef`).
- **`/sw-push.js` et « ADMINISTRATION.GA »** :
  - `LB/push-subscription.ts:72`.
  - `plateforme/espace/espace_administration_ga/public/sw-push.js` l.2, 33, 42 (titre), 45 (icône `/administration_ga.png`), 47 et 66 (url par défaut `/espace`).
  - `app/layout.tsx` l.66-111 (metadata).
- **Deux formats téléphone coexistent (contradiction à lever)** :
  - L'iCom flottant `.icom-float` est en **390 × 844** : `messagerie-styles.tsx:1220-1224` (`min(390px…)`, `min(844px…)`), verrouillé par `messagerie-floating-contract.test.ts:92-103`.
  - L'appel flottant `.iappel-float` est en **440 × 956** : `socle/packages/ui/src/styles/globals.css:2692-2702`, avec `--iappel-float-w: clamp(300px, min(440px, calc((100dvh - 64px) * .46), calc(100vw - 32px)), 440px)` et une hauteur `/0.46`. Il est verrouillé par `iappel-surface.ratchet.test.ts:1412-1417`.
  - Les autres « 390 » ne sont que des commentaires ou des scénarios de test : `call-host.ts:50`, `group-stage.ts:206,235-236,259,382`, `GroupCallGrid.tsx:231`, `ConferenceHintCard.tsx:287`, `direct-scene.ts:164-166`, `DirectPage.tsx:318`, et les tests `group-stage.test.ts:233-234,441-445,542-544`, `GroupCallGrid.test.tsx:603-604,625,712`, `direct-scene.test.ts:16-17,197,473`.
- **Jetons CSS requis** : `--ink-*`, `--primary-*`, `--danger-*`, `--success-*`, `--warning-*`, `--esp-immersive-on-ink`, `--esp-immersive-ink`, `--esp-surface-card`, `--esp-reseau-tabbar-inset`, `--vv-height`, `--iappel-bottom-inset`.
  - Ils sont définis dans `socle/packages/ui/src/styles/globals.css` (4 221 l.) et `socle/packages/ui-v2/src/styles/tokens.css`.
  - `--rp-surface-radius` est défini par `RP/ReseauAgentPage.tsx`, et `--icom-anchored-height` par `messagerie-styles.tsx`.
  - Classes d'appel dans globals.css : `.call-hero-dark` l.2544, `.iappel-*` l.2666 à environ 4100 (197 occurrences, dont `.iappel-layer` en z 10010), `.esp-*` l.1917-2126, et la charte scopée `[data-charte="espace-personnel"]` l.458-1066.

---

## 1. Totaux et écart avec l'annexe B du 14/10

| Feature | Sources | Tests | Total | Annexe B | Écart |
|---|---|---|---|---|---|
| messagerie | **67 / 17 812** | 49 / 8 138 | 116 / 25 950 | 67 / 17 812 | 0 |
| iappel | **83 / 15 750** | 42 / 9 941 | 125 / 25 691 | 79 / 14 920 | **+4 fichiers / +830 l.** |
| direct | 50 / 16 526 | 38 / 9 207 | 88 / 25 733 | — | — |
| stories | 19 / 4 761 | 6 / 1 537 | 25 / 6 298 | — | — |
| notifications | 16 / 2 933 | 8 / 2 470 | 24 / 5 403 | — | — |
| direct + stories + notifications | **85 / 24 220** | 52 / 13 214 | 137 / 37 434 | 85 / 24 220 | 0 |
| **Total des 5 features** | **235 / 57 782** | **143 / 31 293** | 378 / 89 075 | 231 / 56 952 | +4 / +830 |

**Explication de l'écart sur iappel (vérifiée par git)**
- L'annexe B a été comptée sur `d5942856c` (= `f11b53248^`, 2026-10-04) : à ce commit, iappel compte exactement **79 / 14 920**. Les autres features n'ont pas bougé depuis.
- Depuis, `git diff --stat f11b53248^ HEAD` sur les sources d'iappel donne +851 / −21, dans 15 fichiers. Cela se décompose en quatre fichiers nouveaux, plus 123 lignes nettes de modifications dans 11 fichiers existants.
- Les quatre fichiers nouveaux :
  - `call-environment.tsx` (62), ADR-0213, du 04/10 ;
  - `settings/PrioritairePicker.tsx` (186), ADR-0217, du 07/10 ;
  - `settings/PrioritairesSection.tsx` (327), ADR-0217 ;
  - `settings/prioritaires-model.ts` (132), ADR-0217.
- Les 11 fichiers modifiés : `IappelJournal` +6, `IncomingCallBanner` 13, `IncomingCallCard` 16, `call-journal` 47, `call-types` +12, `presence-dot` 34, `PolitiqueAppelSection` 3, `settings/index` +4, `use-call-slot-connector` 11, `use-iappel-actions` 12, `use-incoming-calls` 7.
- **Ces quatre nouveaux fichiers sont tous A (RX)**, et les modifications touchent l'environnement back-office et les prioritaires de poste.

**Volume à reprendre (sources, hors RX)**

| Feature | Lignes reprises | Lignes retirées |
|---|---|---|
| messagerie | 17 357 | 455 |
| iappel | 12 975 | 2 775 |
| direct | 16 526 | 0 |
| stories | 4 761 | 0 |
| notifications | 1 730 | 1 203 |

**Dépendances obligatoires absentes de l'annexe B**
- RP : environ 3 857 l. (§6.4).
- FS : 1 163 l.
- Stores : 2 562 l., dont environ 1 535 utiles.
- Hôtes de coque et `components/direct` : 2 045 l.
- Hooks et lib : environ 1 480 l.

---

## 2. A) `AF/features/messagerie` — 67 sources

| Fichier | l. | Rôle | Cat | Imports hors feature (ligne) / int. | api.* (ligne) | Points d'accroche (ligne) | SORT | Cible |
|---|---|---|---|---|---|---|---|---|
| AttachFromVaultDialog.tsx | 133 | « Joindre depuis iDocument » (ADR-0160) | A | G:api 14, G:dm 15, @w/ui button 16 et dialog 25, convex/react 26, `../icorrespondance/_shared/IDocumentPicker` 30, `idocument-picker-model` 31 | functions.documents.getDocumentsByIds 66 | iDocument 4-6, 30-31, 101, 108 | **RX** | — |
| ConversationHeader.tsx | 240 | En-tête de conversation (retour, identité, appels) | S* | int. call-actions, messagerie-views | — | fonction au-dessus du titre (ADR-0021) 41-43, 159-160 | TQ\* | SF/f/messagerie/ |
| ForwardMessageSheet.tsx | 222 | Transfert vers une cible explicite (ADR-0143) | S | @w/ui sheet 31, RP/use-relation-search 34 ; int. forward-targets | — | — | TQ | idem |
| GroupCallInviteePicker.tsx | 386 | Qui appeler dans un grand groupe (IC-08) | S | iappel/ConferenceHintCard 41, iappel/conference-hint 46, iappel/group-call-capacity 47, RP/Avatar 48 ; int. groupe-appel-selection, groupe-gestion, messagerie-views | — | — | TQ | idem |
| GroupeAvatar.tsx | 42 | Avatar de groupe | S | RP/Avatar 4 | — | — | TQ | idem |
| IcomActusPanel.tsx | 167 | Brique Statuts d'iCom (ADR-0079) | S | G:api 28, @w/api/hooks 29, @w/routing 30, stories/stories-entry 33, stories/stories-styles 34, stories/StoriesTray 35, stories/StoryCreateSheet 36 ; int. IcomBrickHeader, IcomPublicReminders | reseauPersonnel.people.getMyProfile 56 | `/espace/actus?surface=icom` 72, `/espace/actus?auteur=…&surface=icom` 73 | AD (routes) | idem |
| IcomAppelJournal.tsx | 91 | Journal d'appels câblé pour rappeler | S | G:api 20, G:dm 21, convex/react 22, LB/call-errors 25, ST/call-store 26, iappel/IappelJournal 27, iappel/call-phase 28 | **functions.meetings.callCitizenById 36** | callCitizenById 12, 36 ; commentaire poste 83 | TQ (parité serveur) | idem |
| IcomBrickHeader.tsx | 133 | En-tête commun aux 4 briques | S | int. dock-store, icom-dock | — | — | TQ | idem |
| IcomMobileTabBar.tsx | 145 | Barre basse d'iCom au téléphone (1er emplacement = menu principal) | **K** | @w/routing 32, @w/ui-v2 33, **SH/espace-mobile-volets-row 35**, **SH/personal-nav 36** ; int. icom-mobile-tabs | — | `<EspaceMobileVoletsRow activeVolet="icom">` 106, `mobileNavVisibilityClass(true)`, « Menu principal de l'espace » | **RW** | SF/shell/mobile/ |
| IcomPublicReminders.tsx | 263 | Rappels publics sous les Statuts | S | G:api 11, @w/api/hooks 12, @w/routing 13, @w/ui-v2 14, RP/Avatar 16, RP/reseau-agent-nav 17 ; int. icom-public-reminders | reseauPages.followedUpdates.list 249 | — | TQ | SF/f/messagerie/ |
| IcomRelationsPanel.tsx | 571 | Relations personnelles (briques iAppel et Relations) | S* | G:api 21, @w/api/hooks 22, convex/react 23, CP/identity 27, LB/call-errors 28, **SH/org-provider 29**, ST/call-store 30, RP/Avatar 31, RP/ReseauQueryError 32, RP/use-dual-connection-pagination 33, RP/use-relation-search 34, iappel/call-phase 42, iappel/presence-dot 43 ; int. IcomBrickHeader, GroupeAvatar, messagerie-liste, messagerie-recipients | reseauPersonnel.messagerie.callByHandle 136 ; reseauPersonnel.groupes.listMyGroupThreads 178 | **useOptionalOrg 29, 161** ; scope poste/personnel 162 | AD | idem |
| MessageActionsSheet.tsx | 128 | Feuille d'appui long | S | @convex/schemas/messageReactions 31, @w/ui sheet 38 ; int. message-actions | — | — | TQ | idem |
| MessageAttachment.tsx | 178 | Pièce jointe par type | S* | @convex/modules/fileGuard/policy 24-25 ; int. messagerie-composer, voice-note | — | iDocument 44, 53, 89-90 | AD (élaguer iDocument) | idem |
| MessageBubble.tsx | 381 | Bulle, réactions, citation | S* | @convex/schemas/chatMessages 39, @convex/schemas/messageReactions 45, RP/mobile/gestures/usePointerSwipe 48 ; int. messagerie-bulles, MessageAttachment, MessageActionsSheet, message-actions, ReplyPreview | — | canSaveToVault 111 | AD (iDocument) | idem |
| MessageComposer.tsx | 811 | Saisie, pièces jointes, micro | S* | @w/chat/use-chat-attachments 51 (type PendingAttachment) ; int. messagerie-media-draft, messagerie-composer, ReplyPreview, VoiceRecorderButton | — | « Joindre depuis iDocument » 83, 182, 686, 736-737 ; commentaire IcomPosteDraftView / **IcomChannelsTab** 37-38 | AD | idem |
| MessagerieComposePage.tsx | 51 | Composeurs plein écran (mobile) | S | int. dock-store, MessagerieComposeView, MessagerieGroupeCompose, messagerie-styles, use-messagerie-router-nav | — | — | TQ | idem |
| MessagerieComposeView.tsx | 242 | Choix d'un destinataire | S | RP/Avatar 20, RP/ReseauQueryError 21, RP/use-dual-connection-pagination 22, RP/use-relation-search 23 ; int. dock-store, messagerie-dock, messagerie-recipients, messagerie-styles, messagerie-views | — | — | TQ | idem |
| MessagerieConversationPage.tsx | 75 | Conversation plein écran (mobile) | S | @w/routing 33 ; int. dock-store, MessagerieConversationView, messagerie-dock, messagerie-styles, messagerie-routes, use-infos-panneau, use-messagerie-router-nav | — | `/espace/profil/<handle>` 62 | AD (route) | idem |
| **MessagerieConversationView.tsx** | **1885** | LA conversation : 1:1, brouillon, groupe, en carte ou en page | S* | voir détail ① | voir détail ② | voir détail ③ | **AD (lourd)** | idem |
| MessagerieDesktopPage.tsx | 39 | Passerelle des anciens liens vers le téléphone iCom | S | @w/routing 3 ; int. icom-desktop-entry, messagerie-dock | — | « Ouverture d'iCom… » 23, 38 | AD | idem |
| **MessagerieDock.tsx** | 592 | IcomDock : carte 4 onglets, ancrée dans le rail ou détachée (portail `body`), hôte d'appel « icom-agent » | **K**/S | voir détail ④ | reseauPersonnel.messagerie.listMyThreads 229 ; reseauPersonnel.groupes.listMyGroupThreads 233 | voir détail ⑤ | AD | SF/f/messagerie/ (monté par SF/shell) |
| MessagerieGroupeCompose.tsx | 819 | Composer un groupe | S | G:api 22, G:dm 23, @w/api/hooks 27, @w/chat/use-idempotency-key 28, RP/Avatar 40, RP/shared 44 ; int. dock-store, groupe-composeur, groupe-creation, messagerie-erreur, messagerie-views, messagerie-liste | reseauPersonnel.groupes.listMyConnectionsForGroup 111, createGroup 115 ; reseauPersonnel.media.generateUploadUrl 118 | — | TQ | idem |
| MessagerieGroupeInfos.tsx | 685 | Fiche de groupe (membres, rôles, lien QR) | S | G:api 11, G:dm 12, @w/api/hooks 16, convex/react 17, **react-qr-code 43**, RP/Avatar 44, RP/shared 48 ; int. ×8 | reseauPersonnel.groupes.* : getGroupThread 126, listMyConnectionsForGroup 130, paginateGroupMessages 134, renameGroup 143, inviteToGroup 144, removeGroupMember 145, setGroupMemberRole 146, leaveGroup 147, deleteGroup 148, clearGroupConversation 149, setGroupAvatar 150, setGroupDescription 151, getOrCreateGroupInviteLink 152, resetGroupInviteLink 153 ; reseauPersonnel.media.generateUploadUrl 154 | « Groupe iCom » 289-290, 362 ; « espace agent » 373 | AD (libellés) | idem |
| MessagerieGroupeInvitations.tsx | 125 | Invitations de groupe en tête de liste | S | G:api 27, G:dm 28, @w/api/hooks 32, RP/Avatar 35 ; int. messagerie-dock, messagerie-erreur, messagerie-views | reseauPersonnel.groupes.myGroupInvites 42, respondGroupInvite 46 | — | TQ | idem |
| MessagerieGroupeInvite.tsx | 327 | Rejoindre par lien | S | G:api 3, @w/api/hooks 7 ; int. GroupeAvatar, messagerie-erreur | reseauPersonnel.groupes.previewGroupInvite 144, joinGroupViaInviteLink 148 | libellé iCom | TQ | idem |
| MessagerieListPage.tsx | 173 | iCom au téléphone (liste des 4 briques) | S | G:api 45, @w/api/hooks 46, @w/routing 47, RP/mobile/mobile-styles 49, RP/mobile/reseau-mobile-tabs 50 ; int. ×14 (dont IcomMobileTabBar) | reseauPersonnel.stories.tray 98 | commentaire `/espace/messages` 31 | AD (barre mobile de la coque) | idem |
| MessagerieListView.tsx | 554 | Liste des conversations | S* | iappel/presence-dot 30, RP/Avatar 31, RP/ReseauQueryError 54, RP/query-state 58 ; int. GroupeAvatar, IcomBrickHeader, MessagerieGroupeInvitations, groupe-liste, messagerie-dock, messagerie-liste, messagerie-styles, messagerie-source, messagerie-views | — | `poste?.positionTitle` 408-413 ; commentaires 107, 142, 210 | TQ\* | idem |
| MessagesRoute.tsx | 84 | Aiguillage de `/espace/messages…` | S | RP/mobile/useIsReseauMobile 29 ; int. ×6 | — | commentaires 4, 22-23, 77 | AD (routes) | idem |
| NewMessagesPill.tsx | 41 | « n nouveaux messages » | S | int. conversation-scroll | — | — | TQ | idem |
| PinnedMessageBanner.tsx | 70 | Message épinglé | S | — | — | — | TQ | idem |
| ReplyPreview.tsx | 86 | Extrait cité | S | int. messagerie-bulles | — | — | TQ | idem |
| SaveToIDocumentDialog.tsx | 225 | « Enregistrer dans iDocument » | A | G:api 16, G:dm 17, @w/api/hooks 18, @w/ui button 19, checkbox 20, choice-tile 21, dialog 30, radio-group 31, `../idocument/import-runner` 35 | functions.documentVault.getOrgFolders 64 ; idocument.saveFromSurface.saveChatAttachmentToVault 67 | iDocument partout | **RX** | — |
| VoiceRecorderButton.tsx | 202 | Micro du composeur (consommé aussi par iappel/VoicemailRecorder) | S | int. voice-note | — | — | TQ | idem |
| call-actions.ts | 126 | Boutons d'appel de l'en-tête | S | — | — | — | TQ | idem |
| conversation-scroll.ts | 181 | Suivi du bas du fil | S | — | — | — | TQ | idem |
| dock-store.ts | 249 | Singleton d'état du dock (`useSyncExternalStore`) | S/K | int. messagerie-media-draft, messagerie-dock | — | localStorage « espace:messagerie-dock:v6 » 69 ; sessionStorage « espace:icom-floating-placement:v1 » 76-78 | AD (préfixe de clé par réseau) | idem |
| forward-targets.ts | 193 | Cibles de transfert | S* | — | — | `poste?.positionTitle` 43, 73-74 | TQ\* | idem |
| groupe-appel-selection.ts | 148 | Sélection des appelés (IC-08) | S | @convex/modules/iappel/group 30, iappel/group-call-capacity 35 | — | commentaire GroupCallLauncher 20 | TQ | idem |
| groupe-composeur.ts | 101 | Décisions du composeur de groupe | S | @convex/lib/groupCapacity 20 | — | — | TQ | idem |
| groupe-creation.ts | 59 | Suite après création | S | int. messagerie-dock | — | — | TQ | idem |
| groupe-gestion.ts | 316 | Droits dans un groupe | S | @convex/modules/reseauPersonnel/domain 33 ; int. groupe-composeur | — | **Africa/Libreville 264**, fr-FR 261 | AD (fuseau) | idem |
| groupe-invitation-link.ts | 71 | Lien d'invitation (paramètre de requête) | S | int. messagerie-routes | — | — | TQ | idem |
| groupe-liste.ts | 157 | Fusion des fils 1:1 et des groupes | S | int. messagerie-liste | — | — | TQ | idem |
| groupe-ressources.ts | 57 | Ressources du groupe | S | — | — | — | TQ | idem |
| icom-desktop-entry.ts | 73 | Anciennes adresses → `?icom=` | S | int. ×4 | — | `` `/espace?…` `` 36 | AD | idem |
| icom-dock.ts | 105 | Règles des onglets de la carte | S/K | — | — | commentaire hub `/icom` 7-9, 27 | TQ | idem |
| icom-hub-tabs.ts | 97 | 6 volets du hub `/icom` (back-office) | **A** | — | — | consommé par icom-poste et iasted | **RX** | — |
| icom-mobile-tabs.ts | 200 | 5 emplacements de la barre iCom | S/K | @w/ui-v2 42, RP/shared 43 ; int. icom-dock | — | `/espace/messages…` 155, 157, 159, 161 | AD (routes) | idem |
| icom-public-reminders.ts | 101 | Adaptateur des rappels publics | S | RP/author-link 14, RP/shared 15 | — | — | TQ | idem |
| index.ts | 73 | Barrel | — | ≈35 réexports | — | exporte icom-hub-tabs 68 et messagerie-source (SOURCE_POSTE) 71 | **RW** | idem |
| message-actions.ts | 261 | Actions permises sur une bulle | S* | — | — | « enregistrerDansIDocument » 60, 79, 93, 153, 227 | AD | idem |
| messagerie-bulles.ts | 252 | Salves et séparateurs de date | S | — | — | fr-FR 86, 91, 243 | TQ | idem |
| messagerie-composer.ts | 199 | MIME, refus | S | @convex/modules/reseauPersonnel/messagerie/attachments 35 | — | — | TQ | idem |
| messagerie-dock.ts | 473 | État pur (clés, transitions, brouillons) | S | int. messagerie-media-draft | — | — | TQ | idem |
| messagerie-erreur.ts | 48 | Texte de refus affichable | S | — | — | — | TQ | idem |
| messagerie-liste.ts | 131 | Filtre et datation | S* | — | — | recherche par fonction de poste 15-16, 49-50 ; commentaire 123 ; fr-FR 64-72 | TQ\* | idem |
| messagerie-media-draft.ts | 399 | Brouillons de pièces | S | — | — | — | TQ | idem |
| messagerie-recipients.ts | 122 | Filtre local des destinataires (consommé aussi par iappel/AddToCallPanel) | S | — | — | — | TQ | idem |
| messagerie-routes.ts | 240 | Correspondance clé ↔ URL | S | int. messagerie-dock | — | **`MESSAGES_URL="/espace/messages"` 48** ; `hubChatHref` → `/icom?tab=ichat…` 228-240 (A) | AD (base injectée, retirer hubChatHref) | idem |
| **messagerie-source.ts** | 632 | D'où viennent les fils | S* | G:api 48, G:dm 49, @convex/modules/reseauPersonnel/messagerie 53 (ThreadsPageCursor, ThreadsPageSideCursor), @w/api/hooks 57, iappel/call-types 59, **SH/org-provider 60**, RP/query-state 61 ; int. groupe-liste | voir détail ⑥ | **SOURCE_POSTE 494-632** ; type MessagerieEspace "poste" 64 ; **useOptionalOrg 60, 501, 526, 595** ; « Aucune administration active… » 603-605 | **AD : garder SOURCE_AGENT seul** | idem |
| messagerie-styles.tsx | 2055 | Feuille unique des vues | S | — | — | **390×844 1220-1224** ; rgb 1235 ; white/black 1930-1931 ; 242 `var(--…)` | AD (440×956) | idem |
| messagerie-typing.ts | 35 | Cadence de l'indicateur « écrit… » | S | — | — | — | TQ | idem |
| messagerie-views.ts | 73 | Contrat partagé entre dock et pages | S | int. messagerie-dock | — | commentaire icom-poste 26 | TQ | idem |
| transfert-api.ts | 59 | Références de transfert typées à la main | S | convex/server 21 | `modules/messagerieScope/transfert:forwardChatMessage` 48-52, `:forwardGroupMessage` 54-58 | **makeFunctionReference 21, 48, 54** | AD (passer à api.* quand la génération repasse) | idem |
| use-infos-panneau.ts | 59 | Paramètre `?infos=1` | S | @w/routing 25 ; int. messagerie-routes | — | — | TQ | idem |
| use-messagerie-router-nav.ts | 45 | Navigation version pages | S | @w/routing 18 ; int. ×3 | — | — | TQ | idem |
| voice-note.ts | 256 | Décisions du message vocal | S | — | — | — | TQ | idem |

**Détails des lignes chargées**

① *MessagerieConversationView.tsx — imports hors feature* :
- G:api 42, G:dm 43, @convex/schemas/messageReactions 44, @w/api/hooks 48, @w/chat/use-idempotency-key 49, convex/react 50.
- ST/call-store 61, RP/Avatar 62, RP/mobile/useVisualViewport 63.
- CP/identity 102 (postEyebrow), **SH/org-provider 103**.
- @convex/modules/fileGuard/policy 104, @convex/modules/reseauPersonnel/messagerie/attachments 108.
- iappel/call-phase 111, iappel/ConferenceHintCard 112, iappel/conference-hint 113, iappel/group-call-capacity 114, iappel/presence-dot 115, iappel/use-launch-conference 116.
- 27 imports internes, dont AttachFromVaultDialog 109 et SaveToIDocumentDialog 110.

② *MessagerieConversationView.tsx — appels api.\** :
- idocument.importSettings.getImportSettings 297 ; reseauPersonnel.people.getPublicProfile 307.
- functions.chats.* : paginateMessages 312, listTyping 330, getPinnedMessage 412, sendMessage 449, markRead 454, setTyping 456, clearTyping 457, generateAttachmentUploadUrl 459, deleteMessage 461, editMessage 462, deleteMessageForMe 464, toggleMessageReaction 467, setPinnedMessage 502.
- reseauPersonnel.groupes.* : getGroupThread 336, paginateGroupMessages 381, listGroupTyping 399, sendGroupMessage 472, markGroupRead 475, setGroupTyping 478, clearGroupTyping 481, generateAttachmentUploadUrl 484, toggleGroupMessageReaction 487, deleteGroupMessageForMe 490, editGroupMessage 495, deleteGroupMessage 498, setGroupPinnedMessage 504.
- reseauPersonnel.messagerie.startThreadWithHandle 451.
- iappel.groupCalls.threadCallCapacity 351, startFromThread 516.
- `messagerieScope/transfert` via transfertApi 507-514.

③ *MessagerieConversationView.tsx — points d'accroche* :
- useOptionalOrg 289 ; vaultOrgId et importSettings 290-302 ; scopeCommunication 303-304.
- « enregistrerDansIDocument » 956 ; `source.espace` 1148, 1176.
- Texte « échanges de poste… espace de poste » 1527-1528 ; `poste?.positionTitle` et `orgName` 1558-1561.
- canSaveToVault 1744 ; onAttachFromVault 1787 ; dialogues iDocument 1847, 1869.

④ *MessagerieDock.tsx — imports hors feature* : G:api 45, @w/api/hooks 46, @w/routing 47 (useSearchParams 162), react-dom 59, ST/call-store 60, FS/use-surface-drag 61, iappel/call-host 67, iappel/call-host-store 72 (registerCallHost 289), iappel/call-types 73, RP/mobile/useIsReseauMobile 74, plus 16 imports internes.

⑤ *MessagerieDock.tsx — points d'accroche* :
- `ICOM_AGENT_CALL_HOST_ID="icom-agent"` 137, avec scopes `["personnel"]`.
- `data-charte="espace-personnel"` 541.
- Libellés iCom 351, 371-372, 474, 530, 544, 579-580.
- Commentaires `/espace/messages` 22, 36, 171.

⑥ *messagerie-source.ts — appels api.\** :
- SOURCE_AGENT : reseauPersonnel.messagerie.listMyThreads 316, listMyThreadsPage 351 et 355, getThread 412, totalUnread 439, callByHandle 462 ; reseauPersonnel.groupes.listMyGroupThreads 424, totalUnread 443.
- SOURCE_POSTE (A) : reseauPersonnel.messagerie.listMyPosteThreads 504, getPosteThread 529 ; functions.meetings.callUser 597.

**Bilan des SORT** : TQ 37 · TQ\* 4 · AD 21 · RW 2 · RX 3 (455 l.).

### Tests de messagerie — 49 fichiers / 8 138 l.

`environment` vaut `node` par défaut (vitest.config.ts). La mention jsdom vient de `// @vitest-environment jsdom`. Abréviation : « int. » désigne un mock de module interne.

| Test | l. | cas | env | Mocks (`vi.mock`) | Cliquet de source | SORT |
|---|---|---|---|---|---|---|
| ConversationHeader.test.tsx | 116 | 4 | jsdom | — | — | TQ |
| ForwardMessageSheet.test.tsx | 143 | 8 | jsdom | RP/use-relation-search | — | TQ |
| GroupCallInviteePicker.test.tsx | 408 | 23 | jsdom | iappel/ConferenceHintCard, RP/Avatar | — | TQ |
| IcomAppelJournal.test.tsx | 80 | 1 | jsdom | G:api, convex/react, @w/api/hooks, sonner, ST/call-store | — | TQ |
| IcomMobileTabBar.test.tsx | 69 | 1 | jsdom | @w/routing, @w/ui-v2, SH/espace-mobile-volets-row, SH/personal-nav | — | RW |
| IcomPublicReminders.test.tsx | 77 | 2 | jsdom | @w/routing | — | TQ |
| IcomRelationsPanel.test.tsx | 435 | 7 | jsdom | G:api, @w/api/hooks, convex/react, sonner, **SH/org-provider**, ST/call-store, CP/identity, RP/Avatar, RP/ReseauQueryError, RP/use-dual-connection-pagination, RP/use-relation-search, int. IcomBrickHeader | — | AD |
| MessageComposer.test.tsx | 197 | 12 | jsdom | int. VoiceRecorderButton | — | AD (iDocument) |
| MessagerieComposeView.test.tsx | 262 | 5 | jsdom | G:api, @w/api/hooks, @w/ui-v2, int. dock-store, int. messagerie-styles, RP/Avatar | — | TQ |
| MessagerieGroupeInvite.test.tsx | 162 | 4 | jsdom | G:api, @w/api/hooks, int. GroupeAvatar | — | TQ |
| MessagerieListView.test.tsx | 370 | 8 | jsdom | G:api, @w/api/hooks, **SH/org-provider**, int. MessagerieGroupeInvitations, int. messagerie-styles, int. IcomBrickHeader, RP/Avatar, int. GroupeAvatar, @w/ui-v2 | — | AD |
| PinnedMessageBanner.test.tsx | 68 | 4 | jsdom | — | — | TQ |
| call-actions.test.ts | 149 | 14 | node | — | — | TQ |
| call-channel.test.ts | 152 | 5 | node | — | MessagerieConversationView, IcomRelationsPanel, messagerie-source | AD |
| conversation-scroll.test.ts | 242 | 25 | node | — | — | TQ |
| dock-store.test.ts | 173 | 9 | jsdom | — | — | TQ |
| forward-targets.test.ts | 158 | 9 | node | — | — | TQ |
| groupe-appel-selection.test.ts | 155 | 17 | node | — (importe @convex/modules/iappel/group) | — | TQ |
| groupe-composeur.test.ts | 107 | 14 | node | — | — | TQ |
| groupe-creation.test.ts | 33 | 4 | node | — | — | TQ |
| groupe-gestion.test.ts | 336 | 23 | node | — | — | TQ |
| groupe-invitation-link.test.ts | 59 | 4 | node | — | — | TQ |
| groupe-liste.test.ts | 164 | 15 | node | — | — | TQ |
| groupe-ressources.test.ts | 31 | 2 | node | — | — | TQ |
| icom-annuaire-frontiere.test.ts | 103 | 5 | node | — | IcomRelationsPanel, **CP/iasted-host/IAstedContactTab.tsx** (A) | RW (garder la moitié RELATIONS) |
| icom-desktop-entry.test.ts | 72 | 5 | node | — | — | AD (base de route) |
| icom-dock.test.ts | 88 | 10 | node | — | — | TQ |
| icom-hub-tabs.test.ts | 82 | 8 | node | — | — | **RX** |
| icom-mobile-tabs.test.ts | 132 | 14 | node | — | — | AD (URLs) |
| icom-public-reminders.test.ts | 74 | 5 | node | — | — | TQ |
| message-actions.test.ts | 307 | 40 | node | — (importe @convex/schemas/chatMessages) | — | AD (iDocument) |
| messagerie-bulles.test.ts | 312 | 32 | node | — | — | TQ |
| messagerie-compose-relations.test.ts | 20 | 2 | node | — | MessagerieComposeView | TQ |
| messagerie-composer.test.ts | 210 | 32 | node | — | — | TQ |
| messagerie-conversation-filters.test.ts | 122 | 8 | node | — | MessagerieListView, MessagerieConversationView, MessagerieGroupeInfos, GroupeAvatar, MessagerieDock, messagerie-styles, **RP/SuggestionsPanel.tsx**, **iappel/IappelJournal.tsx** | AD |
| messagerie-dock.test.ts | 594 | 54 | node | — | — | TQ |
| messagerie-erreur.test.ts | 61 | 4 | node | — | — | TQ |
| messagerie-floating-contract.test.ts | 195 | 11 | node | — | MessagerieDock, messagerie-styles, IcomBrickHeader, MessagerieDesktopPage, FS/*, iappel/{surface-drag, use-surface-drag, use-surface-insets}, **icom-poste/IcomPosteWindow.tsx** (A) ; **assertions « min(390px » et « min(844px » 92-103** | **RW (440×956, sans icom-poste)** |
| messagerie-group-infos-scroll.test.ts | 154 | 9 | node | — | MessagerieGroupeInfos, messagerie-styles | TQ |
| messagerie-liste.test.ts | 112 | 15 | node | — | — | TQ |
| messagerie-media-draft.test.ts | 299 | 23 | node | — | — | TQ |
| messagerie-nav-contrat.test.ts | 115 | 5 | node | — | les 4 vues | TQ |
| messagerie-query-states.test.ts | 199 | 18 | node | — | messagerie-source, MessagerieListView, MessagerieConversationView, MessagerieListPage, MessagerieDock, **RP/ReseauDesktopIcomLink.tsx**, **SH/espace-mobile-volets-row.tsx** | AD (chemins de la coque) |
| messagerie-recipients.test.ts | 162 | 11 | node | — | — | TQ |
| messagerie-routes.test.ts | 202 | 28 | node | — | — | AD (base de route) |
| messagerie-source.test.ts | 96 | 7 | node | — | les 4 vues et messagerie-source (« les deux sources se distinguent ») | **RW** |
| messagerie-typing.test.ts | 31 | 4 | node | — | — | TQ |
| messagerie-views.test.ts | 26 | 3 | node | — | — | TQ |
| voice-note.test.ts | 224 | 33 | node | — | — | TQ |

---

## 3. B) `AF/features/iappel` — 83 sources

| Fichier | l. | Rôle | Cat | Imports hors feature (ligne) / int. | api.* (ligne) | Points d'accroche (ligne) | SORT | Cible |
|---|---|---|---|---|---|---|---|---|
| AddToCallPanel.tsx | 525 | Ajouter une personne à l'appel (ADR-0099) | S* | G:api 41, G:dm 42, @w/api/hooks 43, @w/ui-v2 44, **HK/useContactSearch 55**, ST/call-store 56, FS/escape-stack 57, FS/use-escape-layer 58, messagerie/messagerie-recipients 59, RP/ReseauQueryError 60, RP/use-dual-connection-pagination 61 ; int. add-to-call-candidates, call-seats, call-types, group-stage | iappel.groupCalls.addInvitee 157 | `AddToCallPosteList` (annuaire, `useContactSearch` → **`useOrg` lève hors OrgProvider**) 89, 122, 241, 358-360, 467-494 | AD (relations seules) | SF/f/iappel/ |
| CallConnectionQuality.tsx | 37 | Puce de qualité du lien | S | int. call-controls | — | — | TQ | idem |
| CallControlButton.tsx | 123 | Bouton rond de commande (`.iappel-ctl`) | S | — | — | — | TQ | idem |
| CallEndScreen.tsx | 150 | Écran de fin d'appel | S* | int. call-phase, call-types, call-peer | — | positionTitle si poste 80 | TQ\* | idem |
| CallMinimizedPill.tsx | 193 | Pilule réduite | S | int. use-surface-drag, call-timer | — | storageKey « iappel:pill » 84 ; `--iappel-bottom-inset` | TQ | idem |
| CallStage.tsx | 1059 | L'appel en cours | S* | @livekit/components-react 46, livekit-client 47, RP/Avatar 65 ; int. ×18 (CallConnectionQuality, CallControlButton, SpeakerPickerPanel, audio-route, GroupCallGrid, call-seats, group-stage, LocalPip, RemoteVideoStage, call-controls, call-phase, call-peer, call-timer, call-types, participant-identity, remote-video, use-camera-flip, use-speaker-output) | — | poste, routedFor, secrétariat 163, 442, 510-526, 700-701, 781-836 | TQ\* | idem |
| CallSurface.tsx | 243 | La surface : plein écran, fenêtre ou pilule | S/K | @livekit/components-react 42, **RP/mobile/ImmersiveOverlay 44**, ST/call-room-registry 45, ST/call-store 46, G:dm 52 ; int. call-host, call-host-store, call-surface-plan, CallMinimizedPill, use-surface-drag | — | storageKey « iappel:float » 208 | TQ | idem |
| CallWaitingChip.tsx | 67 | Second appel pendant une communication | S* | int. call-peer, call-types | — | positionTitle 41-42 | TQ\* | idem |
| ConferenceHintCard.tsx | 336 | Carte Conférence T1/T2/T3 (ADR-0149) | S | @w/ui-v2 33, FS/escape-stack 35, FS/use-escape-layer 36 ; int. conference-hint | — | contexte team/thread 49 ; commentaires 86, 287 | TQ | idem |
| GroupCallGrid.tsx | 601 | Grille d'appel de groupe | S | @livekit/components-react 77, RP/Avatar 80 ; int. call-types, ConferenceHintCard, conference-hint, group-stage, remote-video, use-stage-size | — | commentaire 390 px 231 | TQ | idem |
| GroupCallLauncher.tsx | 499 | Appeler plusieurs collègues depuis un espace de poste | **A** | G:api 44, G:dm 45, @w/api/hooks 49, HK/useContactSearch 53, **SH/org-provider 54**, ST/call-store 55, FS 56-57, @convex/modules/iappel/group 67 ; int. ×4 | iappel.groupCalls.startAdHoc 115, myCallCapacity 132 ; functions.users.getMe 144 | `useOrg` 92 | **RX** | — |
| HeldCallChips.tsx | 83 | Appels en attente | S | int. call-timer | — | — | TQ | idem |
| IappelJournal.tsx | 423 | Journal (mise en forme) | S* | G:api 19, @w/api/hooks 20, convex/react 21 ; int. call-journal, call-peer, call-timer | functions.users.getMe 196, functions.meetings.listCallHistory 197, iappel.preferences.markJournalSeen 198 | refus automatiques et secrétariat 140-185 ; « Appel poste · … » 240-246 ; fr-FR 80 | TQ\* | idem |
| IncomingCallBanner.tsx | 238 | Appel entrant au bureau | S* | RP/Avatar 19 ; int. call-peer, call-types, incoming-group | — | fonction et administration 61-63 | TQ\* | idem |
| IncomingCallCard.tsx | 431 | Appel entrant au téléphone | S* | RP/Avatar 39 ; int. CallControlButton, call-peer, call-types, incoming-group | — | poste et routage 92-95, 212-253 | TQ\* | idem |
| LocalPip.tsx | 89 | Vignette caméra locale | S | @livekit/components-react 14 | — | — | TQ | idem |
| RemoteVideoStage.tsx | 77 | Vidéo distante | S | @livekit/components-react 16 ; int. remote-video | — | — | TQ | idem |
| SpeakerPickerPanel.tsx | 125 | Choix de la sortie audio | S | @w/ui-v2 31, FS 32-33 ; int. audio-route | — | — | TQ | idem |
| VoicemailRecorder.tsx | 123 | Laisser un message vocal | S | G:api 27, G:dm 28, @w/api/hooks 29, **messagerie/VoiceRecorderButton 35** | reseauPersonnel.media.generateUploadUrl 54 ; iappel.voicemail.leave 57 | — | TQ | idem |
| add-to-call-candidates.ts | 140 | Candidats à l'ajout (relations + annuaire) | S* | — | — | contactGroupsToCandidates (annuaire de poste) 38, 71 | TQ\* | idem |
| audio-route.ts | 337 | Écouteur ou haut-parleur | S | int. call-types | — | — | TQ | idem |
| call-controls.ts | 271 | Commandes affichées ou masquées | S | int. call-types | — | — | TQ | idem |
| call-environment.tsx | 62 | Environnement back-office ou agent (ADR-0213) | **A** | @convex/modules/iappel/scope 27 | — | — | **RX** (et ôter `callEnvironmentArgs` des hooks) | — |
| call-host-store.ts | 167 | Registre des cartes hôtes : registerCallHost 87, publishCallHosting 115, publishCallRinging 130, useCallHostFor 145, useCallRinging 157 | S/K | int. call-host, call-types | — | — | TQ | idem |
| call-host.ts | 202 | Où un appel se dessine | S/K | int. call-surface-plan, call-types | — | commentaire « 390 × 844 » 50 ; « icom-poste » 61 | TQ\* (documentation) | idem |
| call-inbox.ts | 174 | Plusieurs entrants simultanés | S* | @w/livekit/use-ringtone 31 ; int. call-types | — | poste avant personnel 107 | TQ\* | idem |
| call-journal.ts | 247 | Classement du journal | S* | **@convex/modules/iappel/scope 31** (callSideOf, CallEnvironment) ; int. call-types | — | poste, routage, environnement 65-74, 95-106, 128, 201-204 | AD | idem |
| call-kind-reconcile.ts | 83 | Genre de l'appel lu sur le meeting | S | ST/call-store 25 ; int. call-types | — | — | TQ | idem |
| call-line-sync.ts | 219 | Remettre le serveur d'accord | S | int. call-types | — | — | TQ | idem |
| call-media-live.ts | 49 | Publie-t-il, entend-il | S | — | — | — | TQ | idem |
| call-peer.ts | 110 | Nommer l'autre bout | S* | int. call-types | — | « au titre du poste … » 81-85, 109 | TQ\* | idem |
| call-phase.ts | 547 | État et phrase de fin | S* | int. call-types | — | horaires de poste et secrétariat 80-82, 130, 309-372, 452, 545 | TQ\* | idem |
| call-seats.ts | 203 | Places d'un appel | S | @convex/modules/iappel/group 38 ; int. call-types | — | — | TQ | idem |
| call-surface-plan.ts | 171 | Pose de la surface | S | int. call-types | — | `kind==="queue"` 82 | TQ\* | idem |
| call-timer.ts | 106 | Chronomètre | S | — | — | fr-FR 93, 101 | TQ | idem |
| call-types.ts | 330 | Vocabulaire partagé | S* | G:dm 12 | — (api cité en commentaire 190) | CallScope "poste" 28 ; CallSlotKind "queue" 129 ; RoutedCall et secrétariat 294-317 | TQ\* | idem |
| conference-hint.ts | 152 | Quand orienter vers la conférence | S | int. group-call-capacity | — | — | TQ | idem |
| conference-launch-store.ts | 331 | Magasin « ouvrir une conférence » | S* | int. call-types | — | `planConferenceLaunch` (posteHosted, personalMode, activeOrgId) 79-88 ; commentaire `/espace/conference` 62 | AD | idem |
| dnd-presets.ts | 43 | Préréglages « Ne pas déranger » | S* | @convex/modules/iappel/validators 12, convex/values 13 | — | option « Appels poste seulement » 19 | AD | idem |
| group-call-capacity.ts | 89 | Plafond d'un appel de groupe | S | @convex/lib/groupCapacity 27, @convex/modules/iappel/group 28 | — | — | TQ | idem |
| group-stage.ts | 597 | Ce que montre la grille | S | int. call-types | — | commentaires 390 px | TQ | idem |
| incoming-group.ts | 133 | Entrant de groupe | S | int. call-peer, call-types, group-stage | — | — | TQ | idem |
| index.ts | 350 | Barrel | — | ≈50 réexports, dont FS 341, 345 | — | exporte GroupCallLauncher 252 et `ringingFromListMine` 157 | **RW** | idem |
| media-errors.ts | 172 | Erreurs `getUserMedia` | S | — | — | — | TQ | idem |
| media-watchdog.ts | 58 | La caméra a-t-elle répondu | S | — | — | — | TQ | idem |
| my-presence-row.tsx | 126 | « Mon statut » (menu avatar) | **K** | G:api 18, @w/api/hooks 19, convex/react 20, ST/call-store 23 ; int. dnd-presets, presence-dot | iappel.preferences.getMine 36, setDnd 39 | fr-FR 28 | AD | SF/shell/account/ |
| participant-identity.ts | 77 | Identité métier d'un participant LiveKit | S | — | — | — | TQ | SF/f/iappel/ |
| presence-dot.tsx | 223 | Pastille de présence + hooks | S* | G:api 29, @w/api/hooks 30, convex/react 31, G:dm 33 | iappel.presence.forMyConnections 99, offlineHints 110, **forOrgContacts 154/173**, **forOrgMembers 168/174** | useOrgContactsPresence et useOrgMembersPresence 150-212 (A) | AD (garder useConnectionsPresence) | idem |
| queue-ring.ts | 93 | Sonnerie de la file du centre d'appels | **A** | — | — | consommé par SH/global-queue-pill et CallCenterShell | **RX** | — |
| remote-video.ts | 160 | État de la vidéo distante | S | — | — | — | TQ | idem |
| ringing-signal.ts | 144 | Vibration + repli `ringingFromListMine` | S* | @w/livekit/use-ringtone 23, G:dm 24 ; int. call-types | — (api en commentaire 7) | scope poste et orgId 40, 63, 132-137 ; le repli n'est utilisé nulle part | AD (garder vibrationPatternFor) | idem |
| settings/AppelEnAttenteSection.tsx | 35 | Réglage « Appel en attente » | S | @w/ui-v2 5 ; int. settings-surface | — | — | TQ | SF/f/iappel/settings/ |
| settings/AppelsHorsRelationsSection.tsx | 85 | Réglage « Appels hors relations » | S | @w/ui-v2 20 | — | commentaire callCitizenById 9 | TQ | idem |
| settings/DisponibiliteSection.tsx | 129 | Réglage « Ne pas déranger » et sa portée | S* | @w/ui-v2 15, ../dnd-presets 20, **./poste-hours-form 21** (formatLocalTime) | — | portée poste et defaultScope 29-31 | AD | idem |
| settings/MessagerieVocaleSection.tsx | 29 | Réglage « Messagerie vocale » | S | @w/ui-v2 5 | — | — | TQ | idem |
| settings/NotificationsPushSection.tsx | 88 | Web Push des appels | S | @w/ui-v2 11, **HK/use-call-push 13** ; int. push-copy | — | — | TQ | idem |
| settings/PolitiqueAppelSection.tsx | 522 | Politique d'appel du poste (lot 6) | **A** | G:api 36, G:dm 37, @w/api/hooks 38, @w/ui-v2 39, convex/react 40 ; int. poste-policy-model, PostePicker | iappel.postePolicy.getForMyPoste 120, authoritiesPreview 124, upsert 127 | **postePolicy** | **RX** | — |
| settings/PosteHoursSection.tsx | 216 | Horaires de poste | **A** | @convex/modules/iappel/validators 12, @convex/lib/scheduleMatching 13, @w/ui-v2 14 | — | **posteHours** | **RX** | — |
| settings/PostePicker.tsx | 252 | Choisir un poste | **A** | G:api 33, G:dm 34, @w/api/hooks 35, @w/ui-v2 36, CP/identity 39 | iappel.postePolicy.listClusterOrgs 133 ; directory.contacts.searchPositions 142 | — | **RX** | — |
| settings/PresencePartageeSection.tsx | 46 | Présence partagée | S | @w/ui-v2 13 | — | — | TQ | idem |
| settings/PrioritairePicker.tsx | 186 | Désigner un prioritaire (ADR-0217) | **A** | G:api 21, @w/api/hooks 22, @w/ui-v2 23, CP/identity 26 | directory.contacts.searchPositions 90 | — | **RX** | — |
| settings/PrioritairesSection.tsx | 327 | Appels prioritaires du poste | **A** | G:api 22, G:dm 23, @w/api/hooks 24, @w/ui-v2 25, convex/react 26 | iappel.priorityCallers.getForMyPoste 87, addForMyPoste 90, removeForMyPoste 91 | — | **RX** | — |
| settings/ReponsesRapidesSection.tsx | 107 | Réponses rapides | S | @convex/modules/iappel/validators 22, @w/ui-v2 23 | — | — | TQ | idem |
| settings/SonnerieSection.tsx | 58 | Sonnerie et vibration | S | @w/ui-v2 13 | — | — | TQ | idem |
| settings/index.ts | 103 | Barrel | — | — | — | exporte la politique, les horaires et les prioritaires | **RW** | idem |
| settings/poste-hours-form.ts | 134 | Formulaire des horaires de poste | **A** | G:api 16, G:dm 17, @convex/lib/scheduleMatching 18, convex/server 19 | types posteHours.listMine 23 et upsert 28 | **Africa/Libreville 127** ; fr-FR 107, 123 | **RX** (extraire `formatLocalTime`) | — |
| settings/poste-policy-model.ts | 352 | Modèle de la politique de poste | **A** | G:dm 27, @convex/modules/iappel/validators 31 | — | — | **RX** | — |
| settings/prioritaires-model.ts | 132 | Modèle des prioritaires | **A** | G:dm 12 ; int. poste-policy-model | — | — | **RX** | — |
| settings/push-copy.ts | 62 | Textes du Web Push | S | HK/use-call-push 20 | — | — | TQ | idem |
| settings/settings-surface.ts | 47 | Adaptateur de charte pour 2 surfaces (Paramètres et iCom Pro) | S* | — | — | deuxième surface iCom Pro 7 | AD | idem |
| surface-drag.ts | 5 | Shim vers FS/surface-drag | — | FS 5 | — | — | TQ (ou RX) | SF/f/iappel/ |
| use-call-line-sync.ts | 170 | Synchronisation de ligne | S | G:api 36, G:dm 37, @w/api/hooks 38, ST/call-store 40 ; int. call-line-sync | iappel.calls.hold 56, resume 59 | — | TQ | idem |
| use-call-slot-connector.ts | 96 | Donne sa salle à chaque appel | S* | G:api 19, G:dm 20, @w/api/hooks 24, LB/call-errors 26, ST/call-store 27, ./call-environment 28 | functions.meetings.join 33 ; actions.livekit.requestToken 36 | callEnvironmentArgs 41, 55-62, 84 | AD | idem |
| use-camera-flip.ts | 83 | Caméra avant ou arrière | S | @livekit/components-react 22 ; int. call-controls | — | — | TQ | idem |
| use-iappel-actions.ts | 160 | Gestes d'un appel | S* | G:api 16, G:dm 17, @w/api/hooks 18, **HK/use-call-center 21**, ST/call-store 22, ./call-environment 23 ; int. call-types | functions.meetings.leave 60, declineCall 63 ; iappel.groupCalls.decline 66 | file d'attente (`slot.kind==="queue"` → hangupQueueCall) 58, 109-110 ; environnement 70, 101 | AD | idem |
| use-incoming-calls.ts | 103 | Ce qui sonne, s'entend et vibre | S* | G:api 17, G:dm 18, @w/api/hooks 19, @w/livekit/audio-unlock 20, @w/livekit/use-ringtone 21, @w/livekit/use-waiting-beep 22, HK/use-ringtone-muted-pref 24, ST/call-store 25 ; int. call-inbox, call-environment, call-types, use-ring-vibration | **iappel.calls.listRinging 56** | environnement 54-57 | AD | idem |
| use-launch-conference.ts | 139 | Geste « Lancer une conférence » | S* | **CP/iasted-host/meeting-intent 50**, **SH/org-provider 51**, ST/call-store 52, **icom-poste/icom-poste-open 53**, **icom-poste/icom-poste-store 54** ; int. call-types, conference-launch-store | — | useOptionalOrg 96-99 ; branche poste (requestMeetingInvite, openIcom) 119-124 | AD (branche personnelle seule) | idem |
| use-ring-vibration.ts | 49 | Vibration | S | @w/livekit/use-ringtone 16-17 ; int. ringing-signal | — | — | TQ | idem |
| use-speaker-output.ts | 257 | Sortie audio | S | @livekit/components-react 35, livekit-client 36, ST/call-store 39 ; int. audio-route, call-types | — | — | TQ | idem |
| use-stage-size.ts | 69 | Taille réelle de la scène | S | — | — | — | TQ | idem |
| use-surface-drag.ts | 7 | Shim vers FS | — | FS 7 | — | — | TQ (ou RX) | idem |
| use-surface-insets.ts | 7 | Shim vers FS | — | FS 7 | — | — | TQ (ou RX) | idem |
| useRingRelation.ts | 107 | Appeler une relation | S | G:api 27, convex/react 28, LB/call-errors 31, ST/call-store 32 ; int. call-phase | reseauPersonnel.messagerie.callByHandle 56 | commentaire callCitizenById 8 | TQ | idem |

**Bilan des SORT** : TQ 44 · TQ\* 13 · AD 13 · RW 2 · RX 11 (2 775 l.).

### Tests d'iappel — 42 fichiers / 9 941 l.

| Test | l. | cas | env | Mocks | Cliquet | SORT |
|---|---|---|---|---|---|---|
| AddToCallPanel.test.tsx | 212 | 7 | jsdom | G:api, @w/api/hooks, @w/ui-v2, sonner, RP/use-dual-connection-pagination, **HK/useContactSearch**, RP/ReseauQueryError, ST/call-store | — | AD |
| ConferenceHintCard.test.tsx | 303 | 14 | jsdom | @w/ui-v2 | — | TQ |
| GroupCallGrid.test.tsx | 787 | 34 | jsdom | @livekit/components-react, RP/Avatar, int. ConferenceHintCard ; scène 390×580 603-712 | — | TQ |
| IncomingCallCard.test.tsx | 213 | 17 | jsdom | RP/Avatar | — | TQ |
| add-to-call-candidates.test.ts | 194 | 12 | node | — | — | AD (annuaire) |
| audio-route.test.ts | 257 | 25 | node | — | — | TQ |
| audio-unlock.test.ts | 153 | 11 | node | — (teste @w/livekit/audio-unlock) | — | TQ (suit livekit) |
| call-controls.test.ts | 365 | 41 | node | — | — | TQ |
| call-environment.test.ts | 16 | 2 | node | — | — | **RX** |
| call-host.test.ts | 167 | 15 | node | — | — | TQ |
| call-inbox.test.ts | 199 | 22 | node | — | — | TQ |
| call-journal.test.ts | 288 | 29 | node | — | — | AD (secrétariat, environnement) |
| call-kind-reconcile.test.ts | 138 | 9 | node | — | — | TQ |
| call-line-sync.test.ts | 263 | 21 | node | — | — | TQ |
| call-media-live.test.ts | 32 | 5 | node | — | — | TQ |
| call-peer.test.ts | 148 | 27 | node | — | — | TQ |
| call-phase.test.ts | 445 | 45 | node | — | — | TQ |
| call-seats.test.ts | 247 | 15 | node | — | — | TQ |
| call-surface-plan.test.ts | 178 | 19 | node | — | — | TQ |
| call-timer.test.ts | 112 | 22 | node | — | — | TQ |
| conference-hint.test.ts | 151 | 18 | node | — | — | TQ |
| conference-launch-store.test.ts | 312 | 30 | node | — | — | AD |
| group-call-capacity.test.ts | 85 | 11 | node | — (importe @convex/lib/groupCapacity et @convex/modules/iappel/group) | — | TQ |
| group-stage.test.ts | 588 | 57 | node | — | — | TQ |
| **iappel-surface.ratchet.test.ts** | **1677** | **96** | node | — | voir détail ⑦ | **RW** |
| incoming-group.test.ts | 181 | 14 | node | — | — | TQ |
| media-errors.test.ts | 243 | 34 | node | — | — | TQ |
| media-watchdog.test.ts | 48 | 5 | node | — | — | TQ |
| participant-identity.test.ts | 62 | 7 | node | — | — | TQ |
| queue-ring.test.ts | 65 | 8 | node | — | — | **RX** |
| remote-video.test.ts | 165 | 16 | node | — | — | TQ |
| ringing-signal.test.ts | 138 | 15 | node | — | — | AD |
| settings/AppelsHorsRelationsSection.test.tsx | 86 | 4 | jsdom | — | — | TQ |
| settings/NotificationsPushSection.test.tsx | 86 | 3 | jsdom | — | — | TQ |
| settings/PolitiqueAppelSection.test.tsx | 174 | 5 | jsdom | G:api, @w/api/hooks, convex/react, sonner, int. PostePicker | — | **RX** |
| settings/PrioritairesSection.test.tsx | 181 | 4 | jsdom | idem, int. PrioritairePicker | — | **RX** |
| settings/poste-hours-form.test.ts | 152 | 11 | node | — | — | **RX** |
| settings/poste-policy-model.test.ts | 277 | 16 | node | — | — | **RX** |
| settings/prioritaires-model.test.ts | 103 | 4 | node | — | — | **RX** |
| settings/settings-surface-ids.test.tsx | 168 | 4 | jsdom | — | — | AD (« Disponibilité montée deux fois ») |
| surface-drag.test.ts | 212 | 20 | node | — | — | TQ |
| useRingRelation.test.tsx | 70 | 1 | jsdom | G:api, convex/react, sonner, ST/call-store | — | TQ |

⑦ *Cliquet de iappel-surface.ratchet.test.ts* — le test lit, via `readdirSync` et `readFileSync` :
- tous les `.tsx` d'iappel ;
- **SH/global-call-surface-host.tsx (×21)**, **SH/app-shell.tsx (×4)**, SH/conference-launch-host.tsx, SH/iasted-window.tsx ;
- icom-poste/IcomPosteWindow.tsx ;
- CP/call-center/CallRoomMount.tsx (×6) et CallCenterShell.tsx ;
- HK/use-call-center.ts et CP/iasted-host/* ;
- `ui/src/styles/globals.css` (×5, dont `.iappel-float` 440×956 aux l.1396-1417) ;
- messagerie : MessagerieConversationView, GroupCallInviteePicker, groupe-appel-selection, IcomRelationsPanel, IcomAppelJournal.

### Paquet `socle/packages/livekit` — 8 sources / 813 l., plus csp.mjs (90). Aucun test dans le paquet.

| Fichier | l. | Rôle | Exports | Consommateurs dans le périmètre | Accroche | SORT | Cible |
|---|---|---|---|---|---|---|---|
| package.json | 37 | 9 sous-chemins exportés ; pairs @livekit/components-react ^2.9, livekit-client ^2.17 | — | — | — | TQ | `packages/livekit` (ou SF/lib/livekit) |
| csp.mjs | 90 | Origines LiveKit pour `connect-src` | DEFAULT_LIVEKIT_WS_URL, livekitCspOrigins | next.config des applications | URL d'un serveur LiveKit du programme (retirée de ce document public) 47 ; `NEXT_PUBLIC_LIVEKIT_WS_URL` et `LIVEKIT_WS_URL` 70 | AD (URL par défaut) | idem |
| src/audio-unlock.ts | 157 | AudioContext partagé, déverrouillé au premier geste | installAudioUnlock 95, useRingtoneAudioBlocked 137, getSharedAudioContext… | global host 31, use-incoming-calls 20 | — | TQ | idem |
| src/room-options.ts | 110 | Profils de salle | LIVEKIT_CALL_ROOM_OPTIONS 65 (DirectRoomMount), LIVEKIT_DIRECT_CALL_ROOM_OPTIONS 93 (global host) | — | — | TQ | idem |
| src/use-busy-tone.ts | 103 | Tonalité « occupé » | useBusyTone | global host | — | TQ | idem |
| src/use-hold-tone.ts | 102 | Tonalité d'attente | useHoldTone | global host | — | TQ | idem |
| src/use-livekit-disconnect-guard.ts | 66 | Garde contre la fermeture prématurée | useLiveKitDisconnectGuard | DirectRoomMount | — | TQ | idem |
| src/use-ringback.ts | 84 | Tonalité de retour | useRingback | global host | — | TQ | idem |
| src/use-ringtone.ts | 111 | Sonnerie Web Audio | RingtoneVariant, RINGTONE_PROFILES, useRingtone | call-inbox, ringing-signal, use-incoming-calls, use-ring-vibration | variante **"poste"** 20, 33-37 | TQ (variante inerte) | idem |
| src/use-waiting-beep.ts | 80 | Bip d'appel en attente | useWaitingBeep | use-incoming-calls | — | TQ | idem |

---

## 4. C) direct (50), stories (19), notifications (16)

### 4.1 `AF/features/direct` — 50 sources

| Fichier | l. | Rôle | Cat | Imports hors feature (ligne) / int. | api.* (ligne) | Accroches (ligne) | SORT |
|---|---|---|---|---|---|---|---|
| AntennaInvitePicker.tsx | 338 | Inviter à l'antenne (D-10) | S | G:api 38, G:dm 39, @w/api/hooks 40, @w/ui-v2 41, HK/useDebouncedValue 43 ; int. direct-antenna | direct.antenna.searchInviteCandidates 95 | — | TQ |
| CreateDirectDialog.tsx | 744 | Création d'une conférence + DirectLaunchButton | S | G:api 24, G:dm 25, @w/api/hooks 26, @w/routing 27, @w/ui-v2 37, convex/react 38, FS/escape-stack 42, FS/use-escape-layer 43 ; int. direct-audience, direct-conference-prefill, direct-stage-format, DirectInviteesPanel, ParticipantsPanel | direct.sessions.create 217 ; chaîne `invitees.checkEligibility` 283-288 | `router.push("/espace/conference/${id}")` 410 ; `data-charte="espace-personnel"` 431 | AD (route) |
| DirectAntennaPanel.tsx | 928 | Antenne participative (D-02) | S | G:api 38, G:dm 39, @convex/modules/direct/antenna 40, @convex/modules/direct/permissions 41, @w/api/hooks 42, @w/ui-v2 43, @w/ui/lib/convex-error 44, convex/react 45, RP/Avatar 49 ; int. AntennaInvitePicker, direct-antenna, direct-role, direct-status, ParticipantsPanel | voir détail ⑧ | — | TQ |
| DirectCommentsPanel.tsx | 557 | Conversation du direct | S | G:api 24, G:dm 25, @w/api/hooks 26, @w/ui-v2 27, @w/ui/lib/convex-error 28, convex/react 29, RP/Avatar 32, RP/design-styles 33, RP/ReseauQueryError 34, RP/shared 35, @convex/modules/direct/permissions 36 ; int. direct-antenna, direct-role, direct-status, ParticipantsPanel, direct-comments | direct.comments.list 251, remove 254, send 499 ; direct.antenna.inviteUser 255, inviteStatesForUsers 275 ; direct.moderation.ban 256 ; chaîne `sessions.setChatMode` 105 | — | TQ |
| DirectControls.tsx | 303 | Barre de commandes du lecteur | S | @livekit/components-react 36 ; int. ×5 | — | — | TQ |
| DirectDialog.tsx | 366 | Carte flottante de la conférence | S | @w/ui-v2 46, RP/design-styles 59 | — | `data-charte={charte}` 311 | TQ |
| DirectExitDialog.tsx | 76 | Confirmation de sortie | S | int. DirectDialog, direct-exit | — | — | TQ |
| DirectFloatingCard.tsx | 562 | La conférence qui continue en fenêtre | S/K | G:api 40, G:dm 41, @livekit/components-react 50, @w/api/hooks 51, @w/routing 52, convex/react 53, livekit-client 54, ST/direct-room-registry 70, ST/direct-session-store 77, FS 78-80, RP/Avatar 81, RP/mobile/useIsReseauMobile 82 ; int. ×6 | direct.sessions.get 137, end 141 ; direct.antenna.leaveAntenna 142 | `data-charte` 368 | TQ |
| DirectInviteDialog.tsx | 59 | Inviter (carte) | S | G:dm 15 ; int. ×5 | — | — | TQ |
| DirectInviteesPanel.tsx | 677 | Invités nominatifs (ADR-0150) | S | G:dm 32, @w/api/hooks 33, @w/ui-v2 34, convex/react 35, HK/useDebouncedValue 38, RP/Avatar 39 ; int. ×4 | chaînes `invitees.searchCandidates` 133, `listForSession` 427, `add` 432, `revoke` 433 | — | TQ |
| **DirectPage.tsx** | **1686** | Page `/espace/conference/<id>` | S | voir détail ⑨ | direct.sessions.get 210, end 250, goLive 1028 ; direct.antenna.leaveAntenna 251, myState 345 | commentaires `/espace/conference` 4-5 et 844×390 318 | TQ |
| DirectParticipantsPanel.tsx | 253 | Les personnes en un volet | S | G:dm 36, @w/ui-v2 37 ; int. ×7 | — | — | TQ |
| DirectPreflightPanel.tsx | 384 | Préparation du matériel (D-06) | S | @livekit/components-react 36, @w/ui-v2 37, livekit-client 38, RP/design-styles 47, ST/direct-session-store 53 ; int. direct-preflight | — | — | TQ |
| DirectPresentationTile.tsx | 213 | Contenu dominant (D-05) | S | @livekit/components-react 42/47, livekit-client 49 | — | — | TQ |
| DirectReactionsBar.tsx | 263 | Réactions en rafales | S | G:api 26, G:dm 27, @w/api/hooks 28, @w/ui-v2 29, convex/react 30, RP/design-styles 33, RP/shared 34 ; int. direct-role, direct-status, direct-reactions | direct.reactions.summary 58, react 61 | — | TQ |
| DirectScene.tsx | 686 | Scène mesurée sur son conteneur | S | @livekit/components-react 51/58, @w/ui-v2 59, livekit-client 61, RP/Avatar 71 ; int. ×5 | — | — | TQ |
| DirectSidePanel.tsx | 398 | Panneau du studio (2 volets) | S | G:dm 32, @w/ui-v2 33, RP/mobile/ImmersiveOverlay 42 ; int. ×9 | — | — | TQ |
| DirectStudioLayout.tsx | 88 | Studio de bureau | S | @w/ui-v2 24 ; int. direct-scene-styles, direct-rail | — | — | TQ |
| DirectViewMenu.tsx | 161 | Sélecteur de vue | S | int. direct-view | — | — | TQ |
| ParticipantsPanel.tsx | 496 | La salle (D-11) + aides de résolution des références | S | G:api 37, G:dm 38, @convex/modules/direct/permissions 39, @w/api/hooks 40, convex/server 41, @w/ui-v2 42, @w/ui/lib/convex-error 43, convex/react 44 ; int. direct-role | chaînes `sessions.get` 189/208, `moderation.listAdmitted` 229-233, `moderation.ban` 241, `reinstate` 242, `muteChat` 243, `unmuteChat` 244, `speakers.demote` 245 | **resolveRef sur anyApi 113-169** | AD (références typées) |
| ReplayDecisionDialog.tsx | 92 | « Que faire de l'enregistrement ? » (ADR-0158) | S | G:dm 22, @w/ui/lib/convex-error 23, convex/react 24 ; int. ×3 | chaîne `sessions.decideReplayPublication` 56 | — | TQ |
| ReplayManagementPanel.tsx | 535 | Gérer la rediffusion | S | G:api 37, G:dm 38, @convex/modules/direct/replayComposition 50, @w/ui-v2 51, @w/ui/lib/convex-error 52, convex/server 53, convex/react 54, RP/design-styles 57 ; int. ×3 | chaînes `sessions.setReplayVisibility` 164, `withdrawReplay` 166, `retryReplay` 167, `decideReplayPublication` 168 ; **actions.livekitDirect.importReplayCaptions** 176 | directActionRef 144-155 | AD |
| direct-antenna.ts | 227 | Règles locales de l'antenne | S | — | — | — | TQ |
| direct-audience.ts | 472 | Qui voit, qui est invité, qui parle | S* | @convex/modules/direct/domain 33/40, @convex/modules/direct/permissions 41 ; int. direct-role | — | audience « organisation » = « Les agents de l'administration » 106, 162 | AD |
| direct-call-coexistence.ts | 124 | Appel pendant un direct | S | — | — | — | TQ |
| direct-comments.ts | 138 | File de conversation | S | — | — | préfixe « direct-comment-draft: » 92 | TQ |
| direct-conference-prefill.ts | 140 | Préremplissage depuis un appel | S | int. direct-audience | — | — | TQ |
| direct-controls.ts | 142 | Commandes de la barre | S | int. ×2 | — | — | TQ |
| direct-exit.ts | 252 | Sortie d'un direct | S | int. ×2 | — | — | TQ |
| direct-floating-styles.tsx | 332 | Feuille de la carte flottante (360/320 px) | S | — | — | 27 `var(--…)` | TQ |
| direct-floating.ts | 113 | Direct en fenêtre | S | — | — | `/espace/conference/`, `/espace/direct/` 51, 74 ; clé « espace:direct-floating-placement:v1 » 105 | AD |
| direct-host-presence.ts | 126 | Bail de l'hôte (pur) | S | ST/direct-session-store 27 ; int. direct-role | — | — | TQ |
| direct-immersive.ts | 195 | Page ou plein écran | S | int. ×2 | — | — | TQ |
| direct-playback.ts | 392 | Lecteur de rediffusion | S* | — | — | **Africa/Libreville 174** ; fr-FR 170 ; « Les agents de l'administration » 218, 241 | AD |
| direct-preflight.ts | 283 | Préparation (pur) | S | ST/direct-session-store 23, iappel/media-errors 29 | — | — | TQ |
| direct-presence.ts | 73 | Présence du spectateur (pur) | S | ST/direct-session-store 26 | — | — | TQ |
| direct-rail.ts | 205 | Rail du studio | S | int. ×2 | — | clé « direct-rail-collapsed » 67 | TQ |
| direct-reactions.ts | 54 | Accumulateur de rafales | S | — | — | — | TQ |
| direct-role.ts | 310 | Un prédicat par geste | S | @convex/modules/direct/permissions 14 ; int. ×3 | — | — | TQ |
| direct-scene-styles.tsx | 1100 | Feuille du studio | S | — | — | 95 `var(--…)` | TQ |
| direct-scene.ts | 446 | Plan de scène | S | int. ×3 | — | commentaires 390×844 164-166 | TQ |
| direct-stage-format.ts | 223 | Occupation de l'antenne | S | — | — | — | TQ |
| direct-status.ts | 243 | État d'une session | S | int. direct-host-presence | — | — | TQ |
| direct-view.ts | 116 | Disposition demandée | S | — | — | clé « direct-scene-view » 54 | TQ |
| index.ts | 168 | Barrel (44 exports) | — | — | — | commentaire `/espace/conference/[id]` 55 | TQ |
| use-direct-exit.ts | 225 | Contrôleur de sortie | S | int. ×3 | — | — | TQ |
| use-direct-fullscreen.ts | 136 | Plein écran de la scène | S | — | — | — | TQ |
| use-direct-host-heartbeat.ts | 110 | Bail de l'hôte, battu depuis l'écran | S | G:dm 23, convex/react 24, convex/server 25, ST/direct-session-store 27 ; int. ×2 | `modules/direct/hostPresence:heartbeat` 48-52, `:presence` 55-69 | **makeFunctionReference** | AD |
| use-direct-presence.ts | 148 | Bail du spectateur | S | G:dm 29, convex/react 30, convex/server 31, ST/direct-session-store 33 ; int. direct-presence | `modules/direct/presence:heartbeat` 48-52, `:leave` 55-59 | **makeFunctionReference** | AD |
| use-direct-session.ts | 168 | Contrôleur de connexion | S | G:api 17, convex/react 18, LB/call-errors 20, ST/direct-session-store 27 ; int. ×3 | actions.livekitDirect.requestDirectToken 67 | — | TQ |

⑧ *DirectAntennaPanel.tsx — appels api.\** :
- direct.antenna.* : respondToInvitation 296, cancelHand 324, raiseHand 365, hostState 466/685, respondToRequest 467, revokeInvitation 469/688, inviteUser 686, inviteByHandle 687.
- direct.speakers.demote 468.
- Par chaîne : `sessions.setSpotlight` 479, `speakers.muteMicrophone` 480, `delegations.listForSession` 764-768, `delegations.grant` 774, `delegations.revoke` 775.

⑨ *DirectPage.tsx — imports hors feature* : G:api 43, G:dm 44, `@livekit/components-styles` 41 (import à effet de bord), @livekit/components-react 49, @w/api/hooks 50, @w/ui-v2 51, convex/react 52, livekit-client 53, ST/direct-room-registry 56, ST/direct-session-store 62, RP/Avatar 85, RP/design-styles 86, @w/routing 87, RP/mobile/ImmersiveOverlay 88, RP/mobile/useIsReseauMobile 89, RP/mobile/useVisualViewport 90, plus 29 imports internes.

**Bilan des SORT de direct** : TQ 42 · AD 8 · aucun RX. Aucune dépendance org ou poste dans le code ; le seul résidu est l'audience « organisation » (serveur `convex/modules/direct/domain.ts:320`).

**Tests de direct (38 fichiers / 9 207 l.)**

| Test | l. | cas | env | Mocks / imports | Cliquet | SORT |
|---|---|---|---|---|---|---|
| AntennaInvitePicker.test.tsx | 287 | 6 | jsdom | G:api, @w/api/hooks, @w/ui-v2 | — | TQ |
| CreateDirectDialog.test.tsx | 369 | 6 | jsdom | G:api, @w/api/hooks, convex/react, @w/routing, sonner, FS/use-escape-layer, HK/useDebouncedValue, RP/Avatar, @w/ui-v2 | — | TQ |
| DirectCommentsPanel.test.tsx | 261 | 7 | jsdom | G:api, @w/api/hooks, convex/react, @w/ui-v2, @w/ui/lib/convex-error, sonner | — | TQ |
| DirectControls.test.tsx | 284 | 14 | jsdom | @livekit/components-react | — | TQ |
| DirectDialog.test.tsx | 190 | 10 | jsdom | @w/ui-v2 | — | TQ |
| DirectInviteesPanel.test.tsx | 314 | 10 | jsdom | G:api, @w/api/hooks, convex/react, sonner, HK/useDebouncedValue, RP/Avatar, @w/ui-v2 ; @convex/modules/direct/permissions | — | TQ |
| DirectPage.test.tsx | 396 | 10 | jsdom | G:api, @w/api/hooks, convex/react, @livekit/components-react, @livekit/components-styles, livekit-client, @w/livekit/room-options, @w/livekit/use-livekit-disconnect-guard, @w/ui-v2, @w/routing, sonner, RP/mobile/useIsReseauMobile, RP/mobile/ImmersiveOverlay, int. DirectCommentsPanel, int. DirectReactionsBar ; **monte SH/direct-session-host 205** | — | AD (chemin de l'hôte) |
| DirectParticipantsPanel.test.tsx | 189 | 7 | jsdom | G:api, @w/api/hooks, convex/react, @w/ui-v2, sonner | — | TQ |
| DirectPreflightPanel.test.tsx | 262 | 6 | jsdom | @livekit/components-react, livekit-client, @w/ui-v2 | — | TQ |
| DirectScene.test.tsx | 531 | 21 | jsdom | idem | — | TQ |
| DirectSidePanel.test.tsx | 416 | 15 | jsdom | G:api, @w/api/hooks, convex/react, @w/ui-v2, sonner, int. DirectCommentsPanel, RP/mobile/ImmersiveOverlay | — | TQ |
| ParticipantsPanel.test.tsx | 390 | 12 | jsdom | G:api, @w/api/hooks, convex/react, @w/ui-v2, @w/ui/lib/convex-error, sonner ; permissions | — | TQ |
| ReplayManagementPanel.test.tsx | 387 | 16 | jsdom | idem | — | TQ |
| direct-antenna.test.ts | 159 | 9 | node | — | **lit `socle/convex/modules/direct/validators.ts`** (chemin `../../../../../convex`, l.108-111) | AD (chemin serveur) |
| direct-audience.test.ts | 334 | 24 | node | @convex/modules/direct/permissions | — | TQ |
| direct-call-coexistence.test.ts | 118 | 12 | node | — | — | TQ |
| direct-comments.test.ts | 132 | 10 | node | @convex/modules/direct/domain (constantes alignées) | — | TQ |
| direct-conference-prefill.test.ts | 101 | 9 | node | domain | — | TQ |
| direct-controls.test.ts | 206 | 13 | node | — | — | TQ |
| direct-exit.test.ts | 245 | 15 | node | — | DirectPage.tsx (202-210) | TQ |
| direct-floating.test.ts | 86 | 8 | node | — | — | AD (routes) |
| direct-host-presence.test.ts | 202 | 13 | node | domain | DirectPage.tsx 135, **CP/direct/DirectSessionLeases.tsx 150** | AD (chemin) |
| direct-immersive.test.ts | 164 | 20 | node | — | — | TQ |
| direct-playback.test.ts | 240 | 15 | node | — | — | AD (fuseau, libellé org) |
| direct-preflight.test.ts | 290 | 23 | node | — | — | TQ |
| direct-presence.test.ts | 97 | 8 | node | domain | — | TQ |
| direct-query-states.test.ts | 27 | 1 | node | — | DirectCommentsPanel… | TQ |
| direct-rail.test.ts | 197 | 18 | node | permissions | — | TQ |
| direct-reactions.test.ts | 55 | 5 | node | domain | — | TQ |
| direct-role.test.ts | 338 | 24 | node | permissions | — | TQ |
| direct-room.ratchet.test.ts | 194 | 14 | node | — | sources de direct, **CP/direct/DirectRoomMount 33**, **DirectSessionLeases 178**, **SH/direct-session-host 36**, **SH/app-shell 38** | **RW (viser la coque)** |
| direct-scene.test.ts | 572 | 46 | node | — | direct-scene.ts, DirectScene.tsx (329-348) ; formats 390×844 16-17 | TQ |
| direct-stage-format.test.ts | 177 | 9 | node | — | — | TQ |
| direct-status.test.ts | 166 | 16 | node | — | — | TQ |
| direct-studio.ratchet.test.ts | 322 | 20 | node | — | 8 sources de direct + **CP/direct/DirectRoomMount 27** | AD (chemin) |
| direct-view.test.ts | 94 | 6 | node | — | — | TQ |
| use-direct-exit.test.tsx | 241 | 16 | jsdom | @w/routing | — | TQ |
| use-direct-presence.test.tsx | 174 | 9 | jsdom | convex/react | — | TQ |

### 4.2 `AF/features/stories` — 19 sources

| Fichier | l. | Rôle | Cat | Imports hors feature / int. | api.* | Accroches | SORT |
|---|---|---|---|---|---|---|---|
| LiveDirectSlide.tsx | 86 | Direct en cours dans le pager | S | @w/ui-v2 20, RP/Avatar 21 ; int. stories-viewer | — | — | TQ |
| StoriesTray.tsx | 203 | Barre de stories | S | G:api 37, @convex/modules/reseauPersonnel/domain 38, @w/api/hooks 39, @w/ui-v2 40 ; int. StoryRing, stories-tray | reseauPersonnel.stories.tray 82 | — | TQ |
| StoriesViewerPage.tsx | 326 | Lecteur plein écran vertical `/espace/actus` | S | G:api 37, @w/routing 38, @w/api/hooks 39, @w/ui-v2 40, RP/mobile/ImmersiveOverlay 42, RP/mobile/VerticalPager 43 (utilise `motion/react`), RP/mobile/useIsReseauMobile 44 ; int. ×7 | reseauPersonnel.stories.tray 109 ; **direct.sessions.listLive 113** ; reseauPersonnel.people.getMyProfile 117 | `RESEAU_URL="/espace"` 70 ; `/espace/conference/${id}` 193 | AD (routes) |
| StoryCreateSheet.tsx | 665 | Publier une story | S | G:api 39, G:dm 40, @convex/modules/reseauPersonnel/domain 41, @w/ui-v2 42, convex/react 43, RP/mobile/ImmersiveOverlay 46, RP/mobile/useIsReseauMobile 47, RP/shared 52 ; int. ×4 | reseauPersonnel.stories.publish 184 ; reseauPersonnel.media.generateUploadUrl 186 | — | TQ |
| StoryOverlay.tsx | 117 | Bandeaux posés sur une story | S | @w/routing 19, RP/Avatar 21 | — | `/espace/profil/…` 85 | AD |
| StoryProgressBar.tsx | 67 | Progression | S | — | — | — | TQ |
| StoryRing.tsx | 65 | Anneau de vignette | S | @w/ui-v2 18, RP/Avatar 19 ; int. stories-tray | — | — | TQ |
| StoryViewer.tsx | 632 | Série d'un auteur | S | G:api 39, @convex/modules/reseauPersonnel/domain 40, @w/api/hooks 41, @w/ui-v2 42, convex/react 43, RP/mobile/gestures 46 ; int. ×6 | reseauPersonnel.stories.myActive 109, listByAuthor 113, markSeen 123, remove 124 | — | TQ |
| StoryViewersSheet.tsx | 179 | Liste « Vu par » | S | G:api 22, G:dm 23, @w/api/hooks 24, @w/ui sheet 30, @w/ui-v2 31, RP/Avatar 33, RP/shared 34 | reseauPersonnel.stories.viewers 98 | — | TQ |
| index.ts | 30 | Barrel | — | — | — | — | TQ |
| stories-entry.ts | 38 | Drapeau « ouvert depuis l'app » | S | — | — | commentaire `/espace` 6 | TQ |
| stories-progress.ts | 263 | Déroulé d'une story | S | — | — | — | TQ |
| stories-styles.tsx | 498 | Feuille des stories | S | — | — | 24 `var(--…)` | TQ |
| stories-tray.ts | 217 | Ordre de la barre | S | — | — (api en commentaire 45) | — | TQ |
| stories-viewer.ts | 243 | Ce que le pager empile | S | @convex/modules/reseauPersonnel/domain 34 ; int. stories-tray | — (commentaire 52) | paramètre `surface` 38 | TQ |
| story-create.ts | 397 | Règles de publication | S | @convex/modules/reseauPersonnel/domain 47 | — | libellés « iRéseau » et « iCom (Statuts) » 365-380 ; commentaire 313 | AD (libellés du réseau) |
| story-video-codecs.ts | 197 | Lecture du codec MP4 | S | — | — | — | TQ |
| story-video-policy.ts | 274 | Politique vidéo | S | @convex/modules/reseauPersonnel/domain 40 | — | — | TQ |
| story-video-probe.ts | 264 | Sonde et conversion | S | int. ×2 | — | — | TQ |

**Bilan des SORT** : TQ 16 · AD 3.

**Tests de stories (6 fichiers / 1 537 l.)** : tous en node, sans mock ni cliquet, tous TQ.
- stories-progress.test 263 l. / 37 cas
- stories-tray.test 231 l. / 31 cas
- stories-viewer.test 236 l. / 27 cas
- story-create.test 345 l. / 39 cas (importe @convex/modules/reseauPersonnel/domain)
- story-video-codecs.test 244 l. / 17 cas
- story-video-policy.test 218 l. / 18 cas (importe domain)

### 4.3 `AF/features/notifications` — 16 sources

| Fichier | l. | Rôle | Cat | Imports hors feature / int. | api.* | Accroches | SORT | Cible |
|---|---|---|---|---|---|---|---|---|
| AdministrationNotificationRow.tsx | 195 | Ligne de la table centrale | A | @w/ui-v2 21, RP/shared 23 ; int. ×4 | — | — | **RX** | — |
| AdministrationNotificationsList.tsx | 119 | Onglet Administration | A | G:api 17, @w/api/hooks 18, @w/ui-v2 19, RP/ReseauPaginatedErrorBoundary 20 | notificationCenter.queries.paginateForEspace 55 | — | **RX** | — |
| NotificationBell.tsx | 236 | La cloche (ouvre une carte flottante) | S*/K | G:api 30, @w/api/hooks 31, **espace-personnel/EspaceFloatingCard 41** ; int. NotificationsCenter, notification-center-store, notification-center-tabs | reseauPersonnel.notifications.unreadCount 122 ; **notificationCenter.queries.unreadCountForEspace 128** | CHROME_CLASS `--poste-chip`/`--esp-neutral-chip` ; lecture de `data-charte` 143-144 | AD (une seule source) | SF/f/notifications/ (montée par SF/shell) |
| NotificationsCenter.tsx | 209 | Contenu à deux onglets | S* | G:api 23, @w/api/hooks 24, @w/ui-v2 25, convex/react 26, **SH/org-provider 29**, **icom-poste/icom-poste-store 30** ; int. ×7 | reseauPersonnel.notifications.unreadCount 70, markAllRead 78 ; notificationCenter.queries.unreadCountForEspace 74 ; notificationCenter.mutations.markAllRead 81 | useOptionalOrg 84 ; useIcomPosteHosted 91 | **RW** (onglet Réseau seul) | idem |
| NotificationsList.tsx | 230 | Liste sociale | S | G:api 23, G:dm 24, @w/api/hooks 28, @w/routing 29, @w/ui-v2 30, convex/react 31, RP/ReseauPaginatedErrorBoundary 33, RP/shared 37 ; int. ×2 | reseauPersonnel.notifications.paginateNotifications 85, unreadCount 90, markRead 94, markAllRead 97 | — | TQ | idem |
| ReseauNotificationRow.tsx | 317 | Ligne sociale + invitation de relation | S | G:api 25, G:dm 26, @w/routing 27, @w/ui-v2 28, convex/react 29, RP/shared 36 ; int. ×2 | reseauPersonnel.connections.respond 250, pendingState 259 | — | TQ | idem |
| index.ts | 109 | Barrel | — | — | — | — | **RW** | idem |
| notification-center-store.ts | 113 | Ouvert ou fermé (magasin) | S/K | int. notification-center-tabs (type CenterTab) | — | commentaire `/espace?tab=activite` 6 | AD | idem |
| notification-center-tabs.ts | 163 | Onglets « Réseau » et « Administration » | S* | int. notification-links (type) | — | CENTER_TABS 17-28 ; combineUnread 125 | **RW** (garder tabBadge) | idem |
| notification-icons.ts | 46 | Icônes des lignes administratives | A | int. | — | — | **RX** | — |
| notification-links.ts | 548 | Destinations administratives | A | messagerie/messagerie-dock 31 | — | `PERSONAL_ROOT="/espace"` 103 ; `/espace/solde…` 117-140 ; `/idocument` 56 | **RX** | — |
| notification-open.ts | 52 | Intention iCom de poste | A | icom-poste/icom-poste-open 11 | — | — | **RX** | — |
| notification-presentation.ts | 91 | Présentation administrative | A | — | — | — | **RX** | — |
| notification-routes-context.tsx | 45 | Routes de poste servies | A | — | — | — | **RX** | — |
| notification-targets.ts | 353 | Cible d'une notification sociale | S | messagerie/messagerie-dock 22, messagerie/messagerie-routes 23, RP/reseau-agent-nav 27, RP/shared 28 | — | `/espace/conference/…` 158 ; `/espace/profil/…` 204 ; reseauBaseHref 94-116 | AD (routes) | idem |
| use-administration-notification-actions.ts | 107 | Ouvrir ou marquer lu (table centrale) | A | G:api 25, G:dm 26, @w/routing 27, convex/react 28, SH/org-provider 31, icom-poste 32-33 | notificationCenter.mutations.markRead 57 | — | **RX** | — |

**Bilan des SORT** : TQ 2 · AD 3 · RW 3 · RX 8 (1 203 l.).

**Tests de notifications (8 fichiers / 2 470 l.)**

| Test | l. | cas | env | Mocks | SORT |
|---|---|---|---|---|---|
| NotificationBell.test.tsx | 346 | 13 | jsdom | G:api, @w/api/hooks, convex/react, @w/routing, **SH/org-provider**, @w/ui-v2, react-i18next, RP/mobile/useBodyScrollLock, RP/mobile/useVisualViewport, sonner | RW |
| NotificationsCenter.test.tsx | 652 | 27 | jsdom | idem, sans i18n ; importe icom-poste-store 168 | RW |
| notification-center-store.test.ts | 106 | 9 | node | — | AD |
| notification-center-tabs.test.ts | 214 | 19 | node | — | RW ou RX |
| notification-links.test.ts | 621 | 42 | node | — | RX |
| notification-open.test.ts | 49 | 3 | node | — | RX |
| notification-presentation.test.ts | 102 | 6 | node | — | RX |
| notification-targets.test.ts | 380 | 20 | node | — | AD (routes) |

---

## 5. D) Primitives et coque

Volume : sources 7 287 l. (espace-kit, FS, components/direct et stores : 5 189 ; carte, overlay, hôtes et CallRoomMount : 2 098). Tests : 1 783 l.

| Fichier | l. | Rôle | Cat | Imports (ligne) | api.* | Accroches | SORT | Cible |
|---|---|---|---|---|---|---|---|---|
| **components/espace-kit/** (10 sources / 1 115 l.) — utilisé par RP (ReseauAgentPage, DirectsPanel, PeoplePanel, GroupsPanel, PagesPanel, EvenementsPanel, ProfilPersonnePage, BookmarksPanel, FeedPages), pas directement par les 5 features | | | | | | | | |
| EspaceCard.tsx | 58 | Carte `.esk-card` | K | @w/ui-v2 3 ; int. espace-card | — | — | TQ | UI/espace-kit/ |
| EspaceDialog.tsx | 128 | Dialogue du kit | K | **@w/ui/components/overlay-scope 28**, @w/ui-v2 29 | — | — | TQ | idem |
| EspaceDossierTabs.tsx | 114 | Onglets de dossier | K | — | — | — | TQ | idem |
| EspaceEmptyState.tsx | 63 | État vide | K | — | — | — | TQ | idem |
| EspacePagination.tsx | 93 | Pagination | K | int. espace-pagination | — | — | TQ | idem |
| espace-card.ts | 32 | Constantes de surface | K | — | — | — | TQ | idem |
| espace-kit-styles.tsx | 440 | `<style href="espace-kit">` | K | — | — | jetons seulement | TQ | idem |
| espace-list-state.ts | 28 | État d'une liste | K | — | — | — | TQ | idem |
| espace-pagination.ts | 137 | Pagination pure | K | — | — | — | TQ | idem |
| index.ts | 22 | Barrel | K | — | — | — | TQ | idem |
| **features/floating-surface/** (5 sources / 1 163 l.) | | | | | | | | |
| escape-stack.ts | 158 | Pile Échap unique (IC-12) | K | — | — | singleton `escapeStack` 158 | TQ | SF/shell/floating-surface/ |
| surface-drag.ts | 323 | Placement (pur) | K | — | — | — | TQ | idem |
| use-escape-layer.ts | 77 | Inscription dans la pile | K | int. | — | — | TQ | idem |
| use-surface-drag.ts | 512 | Déplacement (local/session storage) | K | int. surface-drag, use-surface-insets | — | — | TQ | idem |
| use-surface-insets.ts | 93 | Obstacles à éviter | K | int. | — | `[data-iasted-avoid-left]` 27 ; `[data-mobile-nav], .esp-mobile-bar, .rm-tabbar` 26 | AD (sélecteurs fournis par la coque) | idem |
| features/espace-personnel/EspaceFloatingCard.tsx | 306 | Carte flottante de l'espace (ImmersiveOverlay + charte) | K | @w/ui-v2 36, **react-i18next 38** (`common.close` 231, `common.stepProgress` 298), RP/mobile/ImmersiveOverlay 39, RP/mobile/useIsReseauMobile 40, ./floating-card 41 | — | `[data-charte="espace-structure"]` 119 (A) ; min(430px) 65 | AD | SF/shell/floating-card/ |
| features/espace-personnel/floating-card.ts | 41 | Pose card ou fullscreen (pur) | K | — | — | — | TQ | idem |
| features/reseau-personnel/mobile/ImmersiveOverlay.tsx | 175 | Surface plein écran portalisée (verrou, focus, Échap, visualViewport) | K | @w/ui-v2 39 (useModalA11y), ./useBodyScrollLock 42 (49 l.), ./useVisualViewport 43 (84 l.) | — | charte par défaut « espace-personnel » ; couche `iappel-layer` 10010 ; commentaires iAsted 50/9999, sélecteur dev 10000 70-73 | AD (charte du réseau) | UI/overlay/ |
| (dépendance) RP/mobile/useIsReseauMobile.ts, mobile-shell.ts, **SH/poste-breakpoint.ts** | 62 + 81 + 12 | Point de rupture ≤ 959 px (`POSTE_MOBILE_MAX_PX`) | K | — | — | nommage « poste » | AD (renommer) | UI/overlay/ |
| **shell/global-call-surface-host.tsx** | **1037** | Hôte UNIQUE de la couche d'appel : pool, connecteur, entrants, surface, tonalités, audio-unlock | K | voir détail ⑩ | voir détail ⑪ | voir détail ⑫ | **AD (lourd)** | SF/shell/communication/ |
| shell/direct-session-host.tsx | 56 | Hôte UNIQUE de la conférence en cours | K | CP/direct/DirectCallCoexistence 33, DirectRoomMount 34, DirectSessionLeases 35, direct/DirectFloatingCard 36, ST/direct-session-store 37 | — | — | TQ | idem |
| (dépendance) shell/conference-launch-host.tsx | 120 | Rend CreateDirectDialog sur demande | K | direct/CreateDirectDialog 43, direct/direct-conference-prefill 47, iappel/conference-launch-store 51, **SH/org-provider 52** | — | useOptionalOrg et personalSpaceIsElsewhere 56-58 | AD (toujours « foyer ») | idem |
| components/call-center/CallRoomMount.tsx | 483 | `CallRoomMount` 91 et pool `CallRoomPool` 450 de salles LiveKit | K | @livekit/components-react 9, **@livekit/components-styles 10**, livekit-client 16, G:dm 19, ST/call-room-registry 20, ST/call-store 26, iappel/media-errors 32, call-media-live 33, audio-route 37, call-types 38, media-watchdog 43, **CP/iasted-bridge 44** | — | `IAstedLiveKitBridge` 249 | AD (retirer le pont iAsted) | SF/f/iappel/CallRoomMount.tsx |
| components/direct/DirectCallCoexistence.tsx | 56 | Cohabitation entre appel et direct | K | ST/call-store 20, ST/direct-session-store 24, direct/direct-call-coexistence 28 | — | — | TQ | SF/f/direct/room/ |
| components/direct/DirectRoomMount.tsx | 257 | Propriétaire unique de la salle du direct | K | @livekit/components-react 39, @livekit/components-styles 40, @w/livekit/room-options 41, @w/livekit/use-livekit-disconnect-guard 42, livekit-client 43, iappel/media-errors 50, LB/call-errors 51, direct/direct-call-coexistence 55, ST/call-store 56, ST/direct-room-registry 57, ST/direct-session-store 64 | — | — | TQ | idem |
| components/direct/DirectSessionLeases.tsx | 36 | Baux de l'hôte et du spectateur | K | G:api 21, @w/api/hooks 22, direct/direct-role 23, direct/use-direct-host-heartbeat 24, direct/use-direct-presence 25, ST/direct-session-store 26 | direct.sessions.get 29 | — | TQ | idem |
| **stores/** (8 sources / 2 562 l.) | | | | | | | | |
| call-store.ts | 1018 | Magasin d'appel multi-slots | S/K | G:dm 1, **@w/iasted/voice-call-presence 3** (setVoiceCallSource 250), iappel/call-types 14 | — | `kind "queue"` 59, 367-377 ; routedFor 110, 138, 825 ; commentaire `iasted:join-meeting` 836 ; « iappel:audio-route » 283 | AD (retirer la file et iAsted) | SF/stores/ |
| call-room-registry.ts | 66 | Salle par meeting | K | livekit-client 17, G:dm 19 | — | — | TQ | idem |
| direct-room-registry.ts | 70 | Salle du direct | K | livekit-client 18, G:dm 20 | — | — | TQ | idem |
| direct-session-store.ts | 381 | Session de direct | S/K | G:dm 30, **@w/iasted/voice-call-presence 31**, direct/direct-antenna 37, direct/direct-call-coexistence 38 | — | iAsted 155-157 | AD (retirer iAsted) | idem |
| active-meeting-store.ts | 126 | Réunion iRéunion active | A | G:dm 3, @w/iasted/voice-call-presence 5 | — | — | RX (sauf si l'on garde les invitations `kind "meeting"`) | — |
| iasted-ask-store.ts | 55 | Événements `iasted:open` et `iasted:ask` | A | — | — | 34-36 | RX | — |
| page-context-store.ts | 782 | Contexte de page pour iAsted | A | @w/iasted/page-action-risk 2, `@workspace/agent-features/stores` 674 | — | — | RX | — |
| index.ts | 64 | Barrel | — | — | — | — | RW | idem |
| **hooks/** utilisés | | | | | | | | |
| use-agent-presence.ts | 85 | Battement de présence, **par organisation**, toutes les 30 s | K | @w/api/hooks 2, G:api 3, G:dm 4, ST/call-store 5 | functions.agentPresence.heartbeat 21, setOffline 24 | **sort sans rien faire si orgIds est vide (l.36)** ; `orgId` 49-56, 70-72 ; appelé par `app-shell.tsx:392` | **RW (présence sans organisation)** | SF/shell/presence/ |
| use-ringtone-muted-pref.ts | 155 | Sonnerie muette et vibration | S | G:api 31, @w/api/hooks 35, ./ringtone-pref 41 | iappel.preferences.getMine 101, update 105 | clés « call-center-ringtone-muted » 43 et « …-changed » 44 | AD (nommage) | SF/f/iappel/hooks/ |
| ringtone-pref.ts | 56 | Modèle pur | S | — | — | — | TQ | idem |
| use-call-push.ts | 111 | Web Push d'appel | S | G:api 26, @w/api/hooks 30, LB/push-subscription 37 | iappel.preferences.getMine 50 ; functions.pushSubscriptions.subscribe 54, unsubscribe 57 ; iappel.preferences.update 60 | — | TQ | idem |
| useDebouncedValue.ts | 23 | Valeur temporisée (debounce) | S | — | — | — | TQ | UI ou SF/lib |
| use-active-meeting-connection.ts | 100 | Réunion iRéunion (`kind "meeting"`) | A | G:api, G:dm, @w/api/hooks, ST/active-meeting-store, LB/call-errors | functions.meetings.join 24, leave 27, end 29 ; actions.livekit.requestToken 31 | — | RX | — |
| use-call-center.ts | 452 | Centre d'appels (file) | A | — | functions.callCenter.* ×10 ; functions.meetings.callUser… | — | **RX** (couper use-iappel-actions) | — |
| useContactSearch.ts | 250 | Annuaire institutionnel | A | **SH/org-provider 21 (useOrg 119)** | functions.contactSearch.searchContacts 156, getAvailableCountries 190 ; directory.contacts.searchPositions 180 | `useOrg` lève hors provider | **RX** | — |
| lib/call-errors.ts | 124 | Messages d'erreur d'appel | S | — | — | — | TQ | SF/f/iappel/ |
| lib/push-subscription.ts | 124 | Abonnement Web Push | K | — | — | **`register("/sw-push.js")` 72** ; `NEXT_PUBLIC_VAPID_PUBLIC_KEY` 68 | AD (chemin du service worker par réseau) | SF/shell/push/ |
| **Application espace** (`plateforme/espace/espace_administration_ga/…`) | | | | | | | | |
| src/app/layout.tsx | 162 | Racine Next : 5 polices `next/font`, metadata, viewport `viewportFit:"cover"`, `force-dynamic`, nonce CSP via `x-nonce` | K | @/lib/brand 10, @/components/providers 11, ./globals.css 12, @w/ui-v2/tokens.css 14, @w/ui-v2/fonts.css 15 | — | **« ADMINISTRATION.GA » 66-111** ; themeColor #ffffff/#18181b 124-125 | RW (marque du réseau) | app du réseau |
| src/components/providers.tsx (**`app/providers.tsx` n'existe pas**) | 56 | Arbre des providers (voir §8) | K | G:api 3, react-i18next 4, @workspace/i18n/config 5, @w/ui/components/sonner 6, @w/routing/adapters/next 7, @/lib/convex-provider 8, @/components/theme-provider 9, @/integrations/posthog/provider 10, @/components/auth/DevAccountSwitcher 11 | **functions.users.ensureUser 44** | DevAccountSwitcher (dev) | AD | SF/shell/providers/ |
| src/components/theme-provider.tsx | 16 | next-themes | K | next-themes 3 | — | — | TQ | idem |
| src/components/app-layout.tsx | 234 | Shim AppShell | A/K | @w/agent-features/shell (AppShell), components/iasted-host, call-center, espace-personnel (EspaceTopBar, PersonalSpaceLanding), notifications (NotificationRoutesProvider), dcrh-sectoriel, ndjobi, `next/navigation` 23 | — | NOTIFICATION_ROUTES 67-79 ; `terminalAppKey` 144 ; `notificationsHref="/espace?notifications=1"` 154 ; iAsted 191-201 ; hiddenNavUrls | **RX** (remplacé par la coque légère) | — |
| src/lib/convex-provider.tsx | 95 | AppConvexProvider Next (`NEXT_PUBLIC_CONVEX_URL`, QueryClient avec staleTime 5 min, StableConvexBetterAuthProvider, AuthSync) | K | @w/api/stable-convex-better-auth-provider 3, @convex-dev/react-query 4, @tanstack/react-query 5, convex/react 6, ./auth-client 8 | ensureUser (prop) | — | TQ | API/next-provider.tsx |
| src/lib/auth-client.ts | 56 | Better Auth crossDomain (convexClient, crossDomainClient, genericOAuthClient « idn », phoneNumberClient) + type AuthClientCompatible | K | @convex-dev/better-auth/client/plugins 3-6, better-auth/client/plugins 7-10, better-auth/react 11 | — | fournisseur « idn » souverain 26-30 | AD (plugins du réseau) | API/ ou app |
| src/lib/push-subscription.ts | 16 | Réexport | — | @w/agent-features/lib/push-subscription | — | — | RX | — |
| public/sw-push.js | 98 | Service worker Push | K | — | — | **« ADMINISTRATION.GA » 2, 33, 42 ; /administration_ga.png 45 ; "/espace" 47, 66** | AD (marque et routes du réseau) | public/ de l'app |

⑩ *global-call-surface-host.tsx — imports* :
- G:api 27, iappel 28, G:dm 29, @w/api/hooks 30.
- @w/livekit/audio-unlock 31, room-options 32, use-busy-tone 33, use-hold-tone 34, use-ringback 35.
- @convex/lib/groupCapacity 36, **@w/shared/feature-flags 37**, @w/routing 38, LB/call-errors 42/83.
- CP/call-center/CallRoomMount 43, FS 44-45.
- iappel (≈30 modules, 46-79).
- **icom-poste/icom-poste-store 80**, messagerie/messagerie-dock 81, messagerie/messagerie-routes 82.
- **HK/use-active-meeting-connection 84**, HK/use-ringtone-muted-pref 85, RP/mobile/useIsReseauMobile 86, ST/call-store 87.
- SH/conference-launch-host 88, **SH/org-provider 89**, **SH/global-call-alert 90**, **global-call-pill 91**, **global-call-room-host 92**, **global-outgoing-call-window 93** (ces quatre derniers sont A).

⑪ *global-call-surface-host.tsx — appels api.\** : iappel.groupCalls.decline 175, listParticipants 355 ; functions.meetings.get 315, setCallRinging 384, **callCitizenById 387**, **callUser 390 (A)** ; functions.users.getMe 380.

⑫ *global-call-surface-host.tsx — points d'accroche* :
- Disjoncteur `FEATURES.iappelV2` 106-121, avec une branche v1 entièrement A.
- **useIcomPosteHosted 163**, **useOptionalOrg 162 et 950-953**.
- `iasted:close-call-window` 423-431.
- `joinMeeting` (réunion) 173-195.
- Appel de poste (callPoste), secrétariat et routage 796-848 ; contexte team/thread 945.
- `conversationHref(draftKey)` 781-784.

**Tests D (1 783 l.)**

| Test | l. | cas | env | SORT |
|---|---|---|---|---|
| espace-kit : espace-list-state.test | 38 | 5 | node | TQ |
| espace-kit : espace-pagination.test | 208 | 29 | node | TQ |
| FS : escape-stack.test | 209 | 11 | node | TQ |
| FS : surface-drag.test | 76 | 5 | node | TQ |
| FS : use-escape-layer.test.tsx | 164 | 5 | jsdom | TQ |
| floating-card.test | 38 | 7 | node | TQ |
| ST : call-store.test | 479 | 39 | node | AD |
| ST : direct-session-store.test | 326 | 22 | node | TQ |
| ST : active-meeting-store.test | 133 | 9 | node | RX |
| ST : page-context-store.test | 44 | 2 | node | RX |
| ST : voice-call-presence-sources.test | 68 | 4 | node | RX ou RW |

Aucun test pour ImmersiveOverlay, global-call-surface-host, direct-session-host ni CallRoomMount en propre : ils sont couverts par les cliquets iappel-surface et direct-room, et par DirectPage.test.

Tests en dehors de D mais rattachés au périmètre : `hooks/ringtone-pref.test.ts` (55 l. / 6 cas) et `lib/call-errors.test.ts` (154 l. / 16 cas), tous deux TQ.

---

## 6. E) Paquets

| Paquet / fichier | l. | Exports | Utilisé par le périmètre | À reprendre |
|---|---|---|---|---|
| **api/src** (7 sources / 1 079 l. ; tests `bun test src` : 2 / 551 l.) | | | | |
| hooks.ts | 168 | useStableConvexAuth 35, usePaginatedConvexQuery 65, useAuthenticatedPaginatedQuery 84, useConvexQuery 107, useAuthenticatedConvexQuery 124, useConvexMutationQuery 145, useConvexActionQuery 159, et en réexport convexQuery et useConvexMutation | useAuthenticatedConvexQuery ×42, useConvexMutationQuery ×18, useConvexActionQuery ×2, useAuthenticatedPaginatedQuery ×2 ; useStableConvexAuth par la porte d'authentification | TQ → API/hooks.ts |
| provider.tsx | 106 | AppConvexProvider version SPA (`import.meta.env.VITE_CONVEX_URL`), convexQueryClient | non (l'app Next utilise sa propre `lib/convex-provider.tsx`) | AD : fusionner avec la variante Next |
| stable-convex-better-auth-provider.tsx | 162 | StableConvexBetterAuthProvider (amorçage OTT et refresh cross-domain) | oui, via convex-provider | TQ |
| cross-domain-session-bootstrap.ts | 443 (+ test 405 / 24 cas) | takeOneTimeToken, refreshCrossDomainSession, … | dépendance du précédent | TQ |
| sign-out-everywhere.ts | 158 (+ test 146 / 9 cas) | signOutEverywhere, personalStateKeys, PERSONAL_STATE_STORAGE_PREFIXES 59-71 | déconnexion de la coque | AD : remplacer les préfixes (`consulat-active-org`, `backoffice-active-org`, `itravail:`, `demarche-space-mode`, `citizen_jurisdiction`, `iasted.dnd.`) par ceux du moteur (`espace:messagerie-dock`, `espace:icom-floating-placement`, `iappel:*`, `direct-*`, `call-center-ringtone-muted`) |
| auth-client.ts | 30 | authClient SPA (`VITE_SITE_URL`, emailOTP, X-App-Language) | non | RX ou AD |
| index.ts | 12 | barrel | — | TQ |
| **routing/src** (8 / 280, sans test) | | | | |
| index 5, hooks 20, provider 30, link 9, types 37, use-tab-query-state 51 | | RouterProvider, useRouterImplementation, Link, useRouter, usePathname, useSearchParams, useParams, useTabQueryState | oui (voir §0) | TQ |
| adapters/next.tsx | 59 | NextRouterAdapter (`next/link`, `next/navigation`) | oui | TQ |
| adapters/react-router.tsx | 69 | ReactRouterAdapter | non | facultatif |
| **sso/src** (1 / 73) : use-cross-domain-handoff.ts | 73 | useCrossDomainHandoff (OTT inter-domaines) | non (seul `SH/use-sso-navigate.ts` l'utilise) | seulement si navigation entre applications |
| **chat/src** (4 / 404) | | | | |
| use-idempotency-key.ts | 33 | useIdempotencyKey | MessagerieConversationView 49, MessagerieGroupeCompose 28 | TQ |
| use-chat-attachments.ts | 153 | type PendingAttachment, MAX_ATTACHMENT_SIZE_BYTES… | MessageComposer 51 (type seulement) | TQ |
| safe-markdown.tsx 88, inline-message-editor.tsx 130 | | | non (iAsted, ndjobi) | ne pas reprendre |
| **i18n/src** (2 / 53 ; locales fr 10 585 l. et en 9 958 l.) | | config.ts 43 (détection localStorage puis htmlTag, repli fr), provider.tsx 10 | seules les clés `common.close` et `common.stepProgress` sont utilisées | AD (dictionnaire réduit) |
| **livekit** | | | | voir §3 |

### 6.4 Dépendances hors périmètre mais indispensables

**RP — environ 3 857 l.**
- Avatar 94, ReseauQueryError 25, use-dual-connection-pagination 201, use-relation-search 100 (importe `HK/useDebouncedValue`), shared 563, design-styles 77, query-state 163, author-link 163, reseau-agent-nav 620, ReseauPaginatedErrorBoundary 41.
- mobile/ : ImmersiveOverlay 175, VerticalPager 199 (`motion/react`), useIsReseauMobile 62, useVisualViewport 84, useBodyScrollLock 49, mobile-styles 370, reseau-mobile-tabs 366 (**importe SH/personal-nav et SH/personal-chrome**), gestures (index 2 + swipe 275 + usePointerSwipe 147), mobile-shell 81.
- Plus SH/poste-breakpoint 12.

**Autres**
- CP/identity (PostIdentityLines 124, post-identity 82, index 8) : AD.
- SH/conference-launch-host 120.

**À ne pas reprendre (A)** : icom-poste/*, CP/iasted-host/meeting-intent, CP/iasted-bridge (79), icorrespondance/_shared/IDocumentPicker, idocument/import-runner, SH/global-call-alert, global-call-pill, global-call-room-host, global-outgoing-call-window, global-queue-pill.

---

## 7. Synthèses demandées

### (1) Totaux

Voir §1. Le périmètre utile hors RX est d'environ **54 300 l.** de sources de features, auxquelles s'ajoutent environ 7 300 l. de primitives, hôtes et stores (D), 2 600 l. de paquets (E hors locales) et environ 3 860 l. de RP.

L'écart avec l'annexe B se limite à iappel : +4 fichiers et +830 l., tous administratifs (ADR-0213 et ADR-0217), plus des retouches sur l'environnement et les prioritaires.

### (2) Liste exhaustive des `@convex/*` importés

`_generated` exclu ; sources et tests de tout le périmètre.

- **`@convex/_generated/api`** : messagerie 14 fichiers, iappel 16, direct 10, stories 5, notifications 6. Également : global host, DirectSessionLeases, use-agent-presence, use-ringtone-muted-pref, use-call-push, use-active-meeting-connection, useContactSearch, use-call-center, providers.tsx.
- **`@convex/_generated/dataModel`** : messagerie 8 fichiers, iappel 17, direct 16, stories 2, notifications 3. Également : stores (call-store, call-room-registry, direct-room-registry, direct-session-store, active-meeting-store), CallRoomMount, global host.
  - Tables référencées par `Id<>` : `chats`, `chatMessages`, `reseauPersonnel_groupThreads`, `reseauPersonnel_groupMessages`, `users`, `orgs`, `_storage`, `documents`, `documentFolders`, `meetings`, `positions`, `directoryEntries`, `iappel_priorityCallers`, `direct_sessions`, `direct_antenna_invitations`, `direct_antenna_requests`, `reseauPersonnel_stories`, `reseauPersonnel_notifications`, `notifications`, `connections`.

Modules serveur importés :

1. `@convex/schemas/messageReactions` : MessageActionsSheet 31, MessageBubble 45, MessagerieConversationView 44.
2. `@convex/schemas/chatMessages` : MessageBubble 39 ; test message-actions.
3. `@convex/modules/fileGuard/policy` : MessageAttachment 24-25, MessagerieConversationView 104.
4. `@convex/modules/reseauPersonnel/messagerie/attachments` : MessagerieConversationView 108, messagerie-composer 35.
5. `@convex/modules/reseauPersonnel/messagerie` : messagerie-source 53.
6. `@convex/modules/reseauPersonnel/domain` : groupe-gestion 33, StoriesTray 38, StoryCreateSheet 41, StoryViewer 40, stories-viewer 34, story-create 47, story-video-policy 40 ; tests story-create et story-video-policy.
7. `@convex/lib/groupCapacity` : groupe-composeur 20, group-call-capacity 27, global host 36 ; test group-call-capacity.
8. `@convex/modules/iappel/group` : groupe-appel-selection 30, GroupCallLauncher 67 (A), call-seats 38, group-call-capacity 28 ; tests.
9. `@convex/modules/iappel/validators` : dnd-presets 12, PosteHoursSection 12 (A), ReponsesRapidesSection 22, poste-policy-model 31 (A).
10. `@convex/modules/iappel/scope` : call-environment 27 (A), call-journal 31.
11. `@convex/lib/scheduleMatching` : PosteHoursSection 13 et poste-hours-form 18 (tous deux A).
12. `@convex/modules/direct/antenna` : DirectAntennaPanel 40.
13. `@convex/modules/direct/permissions` : DirectAntennaPanel 41, DirectCommentsPanel 36, ParticipantsPanel 39, direct-audience 41, direct-role 14 ; tests.
14. `@convex/modules/direct/domain` : direct-audience 33/40 ; tests direct-comments, direct-conference-prefill, direct-host-presence, direct-presence, direct-reactions.
15. `@convex/modules/direct/replayComposition` : ReplayManagementPanel 50.
16. Fichier serveur lu par un test : `socle/convex/modules/direct/validators.ts` (direct-antenna.test).

Paquets convex importés directement : `convex/values` (dnd-presets 13) ; `convex/server` (transfert-api, ParticipantsPanel, ReplayManagementPanel, use-direct-*, poste-hours-form) ; `convex/react` (useMutation ×25, useConvex ×3, usePaginatedQuery ×2, useConvexAuth ×2, useAction ×2).

### (3) `api.*` appelés, par feature (parité backend)

Les références par chaîne sont marquées ¹ ; celles par `makeFunctionReference` sont marquées ².

**messagerie — à garder**
- `functions.chats` : paginateMessages, listTyping, getPinnedMessage, sendMessage, markRead, setTyping, clearTyping, generateAttachmentUploadUrl, deleteMessage, editMessage, deleteMessageForMe, toggleMessageReaction, setPinnedMessage.
- `modules.reseauPersonnel.messagerie` : listMyThreads, listMyThreadsPage, getThread, totalUnread, callByHandle, startThreadWithHandle.
- `modules.reseauPersonnel.groupes` : listMyGroupThreads, totalUnread, getGroupThread, listMyConnectionsForGroup, paginateGroupMessages, createGroup, renameGroup, inviteToGroup, removeGroupMember, setGroupMemberRole, leaveGroup, deleteGroup, clearGroupConversation, setGroupAvatar, setGroupDescription, getOrCreateGroupInviteLink, resetGroupInviteLink, myGroupInvites, respondGroupInvite, previewGroupInvite, joinGroupViaInviteLink, listGroupTyping, sendGroupMessage, markGroupRead, setGroupTyping, clearGroupTyping, generateAttachmentUploadUrl, toggleGroupMessageReaction, deleteGroupMessageForMe, editGroupMessage, deleteGroupMessage, setGroupPinnedMessage.
- `modules.reseauPersonnel.media.generateUploadUrl` ; `reseauPersonnel.people` : getMyProfile, getPublicProfile ; `reseauPersonnel.stories.tray` ; `modules.reseauPages.followedUpdates.list`.
- `modules.iappel.groupCalls` : threadCallCapacity, startFromThread.
- `functions.meetings.callCitizenById`.
- `modules/messagerieScope/transfert` : forwardChatMessage², forwardGroupMessage².

**messagerie — à retirer (A)** : reseauPersonnel.messagerie.listMyPosteThreads et getPosteThread ; functions.meetings.callUser ; functions.documents.getDocumentsByIds ; functions.documentVault.getOrgFolders ; idocument.importSettings.getImportSettings ; idocument.saveFromSurface.saveChatAttachmentToVault.

**iappel — à garder**
- `modules.iappel.calls` : listRinging, hold, resume.
- `modules.iappel.groupCalls` : addInvitee, decline, ainsi que listParticipants (global host).
- `modules.iappel.preferences` : getMine, setDnd, markJournalSeen, ainsi que update (hooks).
- `modules.iappel.presence` : forMyConnections, offlineHints.
- `modules.iappel.voicemail.leave`.
- `modules.reseauPersonnel.media.generateUploadUrl` ; `modules.reseauPersonnel.messagerie.callByHandle`.
- `functions.meetings` : join, leave, declineCall, listCallHistory, ainsi que get, setCallRinging et callCitizenById (global host).
- `functions.users.getMe` ; `actions.livekit.requestToken`.

**iappel — à retirer (A)**
- iappel.groupCalls.startAdHoc et myCallCapacity.
- iappel.posteHours : listMine, upsert.
- iappel.postePolicy : getForMyPoste, authoritiesPreview, upsert, listClusterOrgs.
- iappel.priorityCallers : getForMyPoste, addForMyPoste, removeForMyPoste.
- iappel.presence.forOrgContacts et forOrgMembers.
- directory.contacts.searchPositions.
- functions.contactSearch.* et functions.callCenter.* (×10, via les hooks).
- functions.meetings.callUser.
- Paramètre `environment` de listRinging, join et declineCall.

**direct — tout est à garder**
- `modules.direct.sessions` : create, get, end, goLive, listLive (stories), setChatMode¹, setSpotlight¹, setReplayVisibility¹, withdrawReplay¹, retryReplay¹, decideReplayPublication¹.
- `modules.direct.antenna` : searchInviteCandidates, respondToInvitation, cancelHand, raiseHand, hostState, respondToRequest, revokeInvitation, inviteUser, inviteByHandle, inviteStatesForUsers, leaveAntenna, myState.
- `modules.direct.speakers` : demote, muteMicrophone¹.
- `modules.direct.comments` : list, remove, send.
- `modules.direct.moderation` : ban, listAdmitted¹, reinstate¹, muteChat¹, unmuteChat¹.
- `modules.direct.reactions` : summary, react.
- `modules.direct.invitees` : searchCandidates¹, listForSession¹, add¹, revoke¹, checkEligibility¹.
- `modules.direct.delegations` : listForSession¹, grant¹, revoke¹.
- `modules.direct.presence` : heartbeat², leave².
- `modules.direct.hostPresence` : heartbeat², presence².
- `actions.livekitDirect` : requestDirectToken, importReplayCaptions¹.
- Audience serveur « organisation » à neutraliser.

**stories — tout est à garder**
- `modules.reseauPersonnel.stories` : tray, myActive, listByAuthor, markSeen, remove, publish, viewers.
- `reseauPersonnel.media.generateUploadUrl` ; `reseauPersonnel.people.getMyProfile` ; `direct.sessions.listLive`.

**notifications**
- À garder : `modules.reseauPersonnel.notifications` (paginateNotifications, unreadCount, markRead, markAllRead) ; `reseauPersonnel.connections` (respond, pendingState).
- À retirer (A) : `modules.notificationCenter.queries` (paginateForEspace, unreadCountForEspace) et `.mutations` (markRead, markAllRead).

**Coque**
- `functions.users.ensureUser` (providers) ; `modules.direct.sessions.get` (DirectSessionLeases).
- `functions.agentPresence.heartbeat` et `setOffline` (**RW serveur et client : présence sans `orgId`**).
- `functions.pushSubscriptions.subscribe` et `unsubscribe`.

### (4) Dépendances et ordre de duplication

**Graphe des imports, sources seules**
- messagerie dépend de :
  - iappel : call-phase ×3, presence-dot ×3, group-call-capacity ×3, ConferenceHintCard ×2, conference-hint ×2, call-types ×2, IappelJournal, use-launch-conference, call-host, call-host-store ;
  - stories : StoriesTray, StoryCreateSheet, stories-entry, stories-styles ;
  - FS : use-surface-drag ;
  - RP : Avatar ×10, shared ×4, use-relation-search ×3, ReseauQueryError ×3, …
  - ST/call-store ×4, LB/call-errors ×2, CP/identity ×2 ;
  - SH : org-provider ×3, espace-mobile-volets-row, personal-nav ;
  - A : icorrespondance, idocument.
- iappel dépend de :
  - **messagerie (VoiceRecorderButton, messagerie-recipients) → cycle iappel ↔ messagerie** ;
  - FS ×13, ST/call-store ×12, ST/call-room-registry ;
  - RP : Avatar ×4, ImmersiveOverlay, … ;
  - HK : useContactSearch ×2, use-call-push ×2, use-ringtone-muted-pref, use-call-center ;
  - LB/call-errors ×2, SH/org-provider ×2 ;
  - A : icom-poste ×2, iasted-host/meeting-intent, CP/identity ×2.
- direct dépend de :
  - iappel/media-errors ;
  - ST/direct-session-store ×9, ST/direct-room-registry ×2 ;
  - FS ×5 ;
  - RP : Avatar ×6, design-styles ×6, … ;
  - HK/useDebouncedValue ×2, LB/call-errors.
- stories dépend de RP seulement ; côté serveur, de `direct.sessions.listLive`.
- notifications dépend de messagerie (messagerie-dock ×2, messagerie-routes), espace-personnel/EspaceFloatingCard, RP et, côté A, de icom-poste ×4 et SH/org-provider ×2.
- Les stores dépendent de :
  - iappel/call-types (call-store) **→ cycle stores ↔ iappel** ;
  - direct/direct-antenna et direct-call-coexistence (direct-session-store) **→ cycle stores ↔ direct** ;
  - `@w/iasted/voice-call-presence` ×3 (module pur de 92 l. à remplacer par un no-op).
- La coque dépend de iappel (≈30 modules), direct (7 modules), messagerie (dock et routes), CallRoomMount, components/direct, stores et hooks.

**Ordre de duplication**
0. Paquets : `api`, `routing`, `chat` (2 fichiers), `livekit`, `i18n` (réduit), CSS de `ui/globals.css` (tokens, charte `espace-personnel`, `.esp-*`, `.iappel-*`, `.call-hero-dark`) et `ui-v2/tokens.css` et `fonts.css`.
1. Primitives : `poste-breakpoint` (renommé), `mobile-shell`, `useIsReseauMobile`, `useVisualViewport`, `useBodyScrollLock`, `ImmersiveOverlay` ; FS (5) ; `floating-card` et `EspaceFloatingCard` ; `espace-kit` ; `useDebouncedValue` ; `lib/call-errors`.
2. Partie de RP utilisée par les features (Avatar, shared, design-styles, query-state, ReseauQueryError, use-dual-connection-pagination, use-relation-search, author-link, reseau-agent-nav, ReseauPaginatedErrorBoundary, gestures, VerticalPager, mobile-styles, reseau-mobile-tabs) ; à coordonner avec l'inventaire de reseau-personnel.
3. Un lot unique, à cause des trois cycles : stores (`call-store`, `call-room-registry`, `direct-session-store`, `direct-room-registry`) + iappel + messagerie. Pour casser le cycle avec messagerie, on peut extraire `VoiceRecorderButton`, `voice-note` et `messagerie-recipients` dans un module commun.
4. stories (requis par `IcomActusPanel`), à placer avant messagerie ou dans le même lot.
5. direct, y compris `components/direct/*` (dépend de `iappel/media-errors` et des stores).
6. notifications (dépend des routes de messagerie et d'`EspaceFloatingCard`).
7. Hôtes de la coque : `CallRoomMount`, `global-call-surface-host`, `conference-launch-host` (dépend de `CreateDirectDialog`), `direct-session-host`.
8. Coque légère : providers, NetworkProvider, chrome iRéseau, `IcomMobileTabBar` réécrit, cloche, dock, présence.

### (5) Contrat minimal de la coque légère, sans AppShell

**Providers, de l'extérieur vers l'intérieur** (aujourd'hui dans `components/providers.tsx` puis `AppShell`)
1. `<html>` avec les variables de polices (`--font-familjen-grotesk`, `--font-dm-mono`, `--font-inter-tight`, `--font-jetbrains-mono`, `--font-public-inter`), `viewportFit:"cover"` (sinon les safe-areas valent 0), les CSS de `@w/ui` globals et de `@w/ui-v2` tokens et fonts, et le nonce CSP.
2. `ThemeProvider` (next-themes, `attribute={["class","data-theme"]}`, `defaultTheme="light"`, `enableSystem`, nonce).
3. `I18nextProvider` (`@workspace/i18n/config`).
4. `AppConvexProvider`, qui assemble :
   - QueryClient TanStack (`queryKeyHashFn` et `queryFn` de ConvexQueryClient) ;
   - `StableConvexBetterAuthProvider` avec un authClient crossDomain ;
   - `AuthSync` (`api.functions.users.ensureUser`).
   C'est indispensable : `@w/api/hooks` repose sur TanStack et `useConvexAuth`, et `convex/react` est utilisé directement.
5. `PostHogProvider` (facultatif).
6. `NextRouterAdapter` (`@w/routing`).
7. `<Toaster>` (sonner, utilisé dans les 5 features et l'hôte).
8. Porte d'authentification : `useStableConvexAuth`, avec chargement pendant `isPending` et rendu déconnecté sinon (patron d'`app-shell.tsx:240-253`).
9. Un **NetworkProvider** en remplacement d'OrgProvider. Les consommateurs actuels ne lisent que trois champs :
   - `personalMode` (constant à `true`) ;
   - `personalSpaceIsElsewhere` (constant à `false`) ;
   - `activeOrgId` (constant à `null`).
   Ces consommateurs sont IcomRelationsPanel, MessagerieConversationView, messagerie-source, use-launch-conference, conference-launch-host, global-call-surface-host et NotificationsCenter. NetworkProvider doit en plus porter les bases de route et les libellés du réseau (liste plus bas).

**Points de montage globaux** (une seule instance, à une position stable de l'arbre, hors de toute branche de route — doctrine d'`app-shell.tsx:270-330`)
- `CommunicationLayer` = `<GlobalCallSurfaceHost/>` (branche v2 seule) + `<DirectSessionHost/>`.
  - L'hôte d'appel monte lui-même `CallRoomPool` (`LIVEKIT_DIRECT_CALL_ROOM_OPTIONS`), `ConferenceLaunchHost`, `installAudioUnlock`, `useCallSlotConnector`, `useCallLineSync`, `useIncomingCalls`, les tonalités (ringback, busy, hold) et l'échelon Échap SURFACE.
  - `DirectSessionHost` monte `DirectRoomMount`, `DirectSessionLeases`, `DirectCallCoexistence` et `DirectFloatingCard`.
- Le dock `MessagerieDock` doit être monté sous `<Suspense>` (il lit `useSearchParams` l.162). Il se déclare `registerCallHost` avec l'id `"icom-agent"` et le scope `personnel`, se portalise vers `body` avec `data-charte`, et utilise `useIsReseauMobile` (vaut `null` au rendu serveur).
- La cloche `NotificationBell` (EspaceFloatingCard + NotificationsCenter réduit à l'onglet Réseau) ; la prop `reseauBaseHref` est à fournir.
- Le battement de présence **sans organisation** remplace `useAgentPresence(orgIds)`, aujourd'hui inactif sans org (l.36).
- La coquille mobile remplace `EspaceMobileVoletsRow` et `personal-nav` pour `IcomMobileTabBar` et les barres d'iRéseau, avec le même point de rupture ≤ 959 px (`min-[960px]:hidden`).

**Magasins** (singletons de module via `useSyncExternalStore`, sans provider, mais à n'avoir qu'**une seule copie dans le bundle**) :
- `callStore`, `callRoomRegistry`, `directSessionStore`, `directRoomRegistry` ;
- `dockStore` (localStorage « espace:messagerie-dock:v6 », sessionStorage « espace:icom-floating-placement:v1 ») ;
- `notification-center-store`, `call-host-store`, `conference-launch-store` ;
- `escapeStack` ;
- le drapeau de module `stories-entry` ;
- `voice-call-presence`, à remplacer par un no-op.

**Contrats DOM et CSS**
- Racine `[data-charte="espace-personnel"]`, redéclarée par les portails (ImmersiveOverlay, DirectDialog, CreateDirectDialog 431, DirectFloatingCard 368, MessagerieDock 541).
- Conteneur `.rp-scope` (dont le `container-type` piège les éléments `fixed`).
- Barres basses `[data-mobile-nav]`, `.esp-mobile-bar`, `.rm-tabbar`, mesurées par `use-surface-insets` et la pilule d'appel.
- Rail gauche `[data-iasted-avoid-left]`.
- Variables `--vv-height`, `--kb-inset`, `--iappel-bottom-inset`, `--esp-reseau-tabbar-inset`.
- Pile des z-index : barres 40 < iAsted 50 < `.icom-float` 55 < dialogues 60 < PiP 80 < `iappel-layer` 10010.

**Routes que l'application doit servir**
- `/espace/messages`, `/espace/messages/nouveau`, `/espace/messages/nouveau-groupe` et `/espace/messages/[kind]/[id]` → `MessagesRoute`.
- `/espace/actus` et `/espace/actus/nouvelle` → `StoriesViewerPage`.
- `/espace/conference/[id]` → `DirectPage`.
- Redirections `/espace/direct/[id]` et `/espace/stories`.
- Cibles de liens `/espace/profil/[handle]`.
- `/espace`, avec les paramètres `?icom=` et `?notifications=1`.

Ces bases sont aujourd'hui en dur à 17 endroits (listés en §2 et §4) ; elles doivent être injectées.

**Environnement**
- `NEXT_PUBLIC_CONVEX_URL`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `NEXT_PUBLIC_LIVEKIT_WS_URL` (CSP).
- `NEXT_PUBLIC_FEATURE_IAPPEL_V2` devient sans objet une fois la branche v1 retirée.
- `/sw-push.js` dans le `public/` de chaque application, avec son titre, son icône et son url par réseau.

**À retirer de la couche de communication**
- L'écoute de l'événement `iasted:close-call-window`.
- La branche « meeting » (iRéunion : `useActiveMeetingConnection`, `FloatingMeetingWindow`, `active-meeting-store`), à moins que `listRinging` continue de servir le genre `meeting` dans le moteur social.
- Les appels de poste (`callUser`), la file d'attente (`use-call-center`) et `call-environment`.

**Points de vigilance (contradictoires)**
- **Format téléphone** : la messagerie est en 390×844, l'appel en 440×956. Deux cliquets se contredisent : `messagerie-floating-contract` et `iappel-surface.ratchet`.
- **Cliquets qui lisent des fichiers A ou la coque** : `iappel-surface.ratchet` (app-shell, IcomPosteWindow, CallCenterShell, use-call-center, iasted-*), `messagerie-floating-contract` (IcomPosteWindow), `icom-annuaire-frontiere` (IAstedContactTab), `direct-room.ratchet` (app-shell, direct-session-host), `messagerie-query-states` (espace-mobile-volets-row) et `direct-antenna.test` (chemin relatif vers `convex/`). Tous casseront à la copie.
- **`useOrg()` lève hors OrgProvider** : `GroupCallLauncher` et `useContactSearch` doivent impérativement disparaître. `AddToCallPosteList` n'est monté que si `scope==="poste"`, mais son import reste à couper.
