# Partager et copier le lien — ANTSIA, 18 octobre 2026

Demande du propriétaire : ajouter **Partager → Copier le lien** dans ANTSIA sur ordinateur et téléphone, comme dans DIASPORALE.

## Implémentation dans les sources servies

- Le pied de carte affiche maintenant le texte **Partager**, à la place du seul pictogramme accessible sous le nom « Relayer ».
- Le dialogue propose le lien membre en lecture seule et **Copier le lien**. L'origine vient du navigateur et le chemin de la route injectée `engineRoutes.post = routes.memberPost` : aucune URL de déploiement codée en dur.
- Une copie réussie affiche **Lien copié.** ; en cas de refus ou d'absence du presse-papiers, un message explicite sélectionne le lien pour une copie manuelle. Un verrou borne une copie en attente à une seule écriture et `aria-disabled` conserve le focus.
- **Partager dans mon fil** ouvre le formulaire de citation existant sur geste explicite. Il reste réservé à une publication d'audience publique dont la citation est disponible ; le moteur conserve ses gardes au moment de publier.
- Copier un lien ne change ni l'audience, ni la visibilité, ni les droits de lecture. Le lien reste disponible pour une publication lisible mais non citable.
- La route du contrat moteur est optionnelle pour préserver les applications existantes. Sans route ni citation disponible, le bouton est masqué plutôt que d'ouvrir une boîte vide.
- Le dialogue réutilise `EspaceDialog`, son portail, sa fermeture, son piège de focus et son défilement borné. Aucune primitive, aucun thème, aucune session et aucun backend n'ont été modifiés par ce chantier.

## Recette dans Chrome

Compte déjà connecté : `recette.f3`. Publication contrôlée : **Recette F3 — conférence locale**, identifiant `kn76atpj963yt2xrmte3k17z418gd0dt`.

| Contrôle | Constat |
| --- | --- |
| Ordinateur, 1470 × 690 | Partager visible ; dialogue de 560 px ; copie confirmée par Lien copié. |
| Lien copié | `http://localhost:3030/fil?post=kn76atpj963yt2xrmte3k17z418gd0dt` |
| Ouverture du lien | Publication ouverte et article exact, dans la session existante. |
| Téléphone émulé, iPhone SE, 375 × 667 | Partager visible ; dialogue de 343 px, bord gauche 16, haut 164,81, bas 502,19 ; confirmation Lien copié. |
| Débordement horizontal | Largeur du document 375 px pour un viewport de 375 px. |
| Formulaire de citation | Ouvert puis refermé, sans saisie ni publication lors de la recette navigateur. |
| Fermeture par Échap | Dialogue fermé ; focus revenu au bouton Partager, sur ordinateur et téléphone. |
| Restauration | Mode téléphone désactivé sur le seul onglet de test, inspecteur fermé, vue normale 1470 × 690. |

Captures : [ordinateur](ordinateur-partage.jpg), [téléphone](telephone-partage.jpg).

Le bouton de copie mobile a été activé au clavier dans l'émulation Chrome ; aucune recette sur appareil physique n'est revendiquée. Aucun téléversement, publication, connexion à un autre compte ou changement de permission n'a été effectué.

## Contrôles ciblés du dernier état

- Codegen officiel du moteur local : code 0.
- Typage de `@antsia/social-features` : code 0.
- 23 tests : `PostCard.test.tsx`, `SharePostDialog.test.tsx`, `i18n.test.ts` ; code 0. Couverture FR/EN, route injectée, copie réussie/refusée/indisponible, lien sélectionné, verrou de copie et focus, citation explicite avec réseau et audience, compatibilité sans route et citation indisponible.
- 7 tests de routes ANTSIA : code 0.
- 11 assertions dans 5 cliquets (`i18n-locales`, `no-hardcoded-strings`, `no-hardcoded-colors`, `no-hardcoded-urls`, `provenance-headers`) : code 0.
- Lint des 4 fichiers TSX concernés : code 0, aucune erreur, un avertissement préexistant sur `latestContext.current` dans `PostCard.tsx`.
- `git diff --check` : réussi.

Soit **41 tests et assertions ciblés réussis**. Journaux : `/tmp/partage-antsia-{codegen,tests,typecheck,routes,ratchets,lint}-20261018.log`. Le résultat d'une vérification globale antérieure n'est pas attribué à ce nouveau changement. Une nouvelle passe globale commune est pilotée par le coordinateur après le gel ci-dessous.

## Gel des neuf sources après contrôles

```text
4d7f799cf0373078d4737536289fa3a02111f7f8219026b214618477bfd660f5  packages/api/src/network.tsx
31a546b724704c34040e7f6590b970db66e2b017207a070268af375cb811f433  apps/antsia_ga/src/lib/routes.ts
dd45abe8755a505b423f6380532f21c50939d545e0e2bb338dc8b33026f0e98e  apps/antsia_ga/src/lib/routes.test.ts
ec2b49fb5df5e2a3197e3f55b1e0d072a379d7888ac02785265beaf7032507d9  packages/social-features/src/features/reseau-personnel/PostCard.tsx
4a2159e233f383e9abef55c23a27e72d832e2416cd8b342cac8ff597921b2c3d  packages/social-features/src/features/reseau-personnel/PostCard.test.tsx
15abc155580a92bd186f57b6484cb04f59849e4a3a5423275365ca499fd696f9  packages/social-features/src/features/reseau-personnel/SharePostDialog.tsx
406eeacd7c663e216a932c36194af3b60a8a46bfc5bb7612fe5d351f879838cc  packages/social-features/src/features/reseau-personnel/SharePostDialog.test.tsx
59d2ad9e09c32fe162b71bcd377fc0cdc2639d2e29cb3b29886bdf387b68857d  packages/social-features/src/i18n/locales/fr/reseau.fil.json
e6ded2a2d151c2ad0a583822bc6e528075223dd65b5991509711c71a30256d94  packages/social-features/src/i18n/locales/en/reseau.fil.json
```

Les modifications préexistantes d'autres sessions sont conservées, notamment dans les fichiers de routes. Aucun commit, push, déploiement ou modification d'environnement n'est inclus.
