# Démo intégrée et brouillon Messages — livraison du 21 octobre 2026

Le sous-domaine `antsia-demo.vercel.app` est supprimé de la configuration Vercel ; **HTTP 404 confirmé après la dernière publication**. Les comptes fictifs sont accessibles sur [ANTSIA /demo](https://antsia.vercel.app/demo), sous l’adresse principale. Le projet technique enfant protégé et ses données sont conservés.

## Recette connectée constatée

Connexion avec un compte fictif existant, destinataire issu d’une relation déjà acceptée. Aucun profil, contact, lien social, conversation ni message créé. Le vrai composeur affichait « Nouvelle conversation. Votre premier message l’ouvrira. » ; le contrôle porte sur son texte, et non sur un champ de recherche destinataire.

| Étape Chrome | Dimensions | Texte | Focus / sélection | Composeur visible | Débordement horizontal |
|---|---|---|---|---|---|
| Téléphone | 390 × 844 | 85 caractères conservés | conservés, 84–85 | oui | aucun |
| Tablette | 834 × 1112 | conservé | conservés | oui | aucun |
| Ordinateur | 1440 × 1000 | conservé | conservés | oui | aucun |
| Retour tablette | 834 × 1112 | conservé | conservés | oui | aucun |
| Retour téléphone | 390 × 844 | conservé | conservés | oui | aucun |

Le brouillon initial était vide. Le texte de recette a été retiré et ce vide restauré. Aucun clic d’envoi ni touche Entrée. Aucun avertissement ni erreur capturé dans la console après cette recette. Le passage vers ANTSIA retrouve le compte réel existant ; le retour vers `/demo/messages/a/commercant.demo` retrouve le compte fictif sans nouvelle connexion, avec composeur vide et visible. La démo reste ouverte sur téléphone. Il s’agit d’émulation Chrome, pas d’appareils physiques ; la persistance d’un brouillon après rechargement n’est pas annoncée.

## Corrections livrées

- Deux builds du même source, relais serveur sous `/demo`, déploiement enfant protégé, backend fictif distinct. Aucun iframe ni nouvelle adresse publique.
- Cookies et vues de stockage propres à la démo ; navigation document entre zones, sans adoption ni purge de la session principale.
- Chemins physiques des transports, médias et partages préfixés ; routes Next logiques conservées. Le Route Handler auth accepte le préfixe exact normalisé par Next et conserve toutes ses gardes.
- Le bandeau démo mesurait 121 px sur téléphone et 61 px aux deux autres formats. Sa hauteur est maintenant retranchée des espaces bornés : le pied du composeur est exactement à 844/1112/1000 px. La mesure n’utilise aucun état React et ne remonte pas le composeur.
- La pagination des connexions publiée par l’autre session et le catalogue/médias de démonstration sont préservés dans les deux candidats.

Voir [ADR-0032](../../adr/0032-demo-sur-adresse-principale.md).

## Vérifications et limites

Dernière correction : **987 tests app principale et 1023 tests app démo**, typages et lint des cinq fichiers touchés réussis. Les deux compilations Vercel sont READY. Avant cette dernière correction, 291 tests API, 144 cliquets par candidat, typages/lint des six espaces requis et compilations locales réussissaient. Le transport auth normalisé possède ses tests de régression.

Le passage global de l’arbre partagé s’est arrêté sur trois déclarations du catalogue natif de la session parallèle ; il n’est pas présenté comme vert. Les 2 850 tests serveur passaient lors de ce passage. Le présent correctif ne modifie ni ne publie le code backend, le natif, l’admin ou DIASPORALE. Aucun fichier `.env*` privé n’a été édité. Le seul paramètre backend modifié est le `SITE_URL` de la démonstration, vers l’origine principale. Les variables serveur Vercel ont été actualisées sans exposer leurs valeurs.

## Publication et préservation

| Élément | Version | Source | Déploiement |
|---|---|---|---|
| Principal | `demo-path-20261021-production-282e26b0a9e64f29` | `58de1ebcd24b356da8905df37e0c3acd4172af2f` | `dpl_FdLMA2wAQfQRx5PKcFRRUv4ncooM` |
| Enfant privé /demo | `demo-path-20261021-demo-9c2ca9be3e566a4b` | `71c7dacf93a28bed26ad3a1fe77fb1eaefe62960` | `dpl_Fe3aJ8kWBe1RoQXaxQnf4XBpFkJ4` |

Branches poussées : `codex/demo-adresse-principale-20261021` et `codex/demo-integree-20261021`. Seul le principal est promu. Les points de santé publics répondent HTTP 200 avec les versions exactes et les CSP des backends respectifs. L’ancien domaine répond 404. Le secret du relais n’apparaît pas dans les en-têtes retournés.

Les commits utilisent des index séparés, sans changer la branche, le HEAD ni l’index réels du répertoire partagé. La publication vérifie sa version publique de départ pour refuser l’écrasement d’une livraison concurrente. Les captures du navigateur restent locales et sont exclues du commit.

## Preuves sans contenu privé

- [Mesures du brouillon](mesures-sans-contenu-prive.json)
- [Séparation des sessions](separation-sessions.json)
- [Validation](validation.json)
- [Publication](publication.json)
- [Suppression du domaine](suppression-domaine.json)
- [Préservation des connexions parallèles](preservation-connexions-paralleles.json)
- [Noms des paramètres, sans valeurs](configuration-sans-secrets.json)
