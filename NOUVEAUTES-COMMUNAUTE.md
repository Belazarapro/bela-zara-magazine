# Bela Zara Magazine — extension communauté et médiathèque

## Installation manuelle

1. Décompressez l'archive sur votre ordinateur.
2. Dans le dépôt GitHub **bela-zara-magazine**, importez les fichiers et dossiers de l'archive en conservant leur structure (les fichiers existants seront remplacés). Ne déposez pas le dossier parent `bela-zara-magazine-main` comme sous-dossier du dépôt.
3. Faites un commit. Sur Render, lancez un nouveau déploiement du commit si le déploiement automatique n'est pas activé.
4. Conservez le `DATA_DIR=/var/data` existant et son disque persistant. **Ne supprimez pas le disque Render**, qui contient les inscriptions, publications et fichiers déjà importés.
5. Conservez `ADMIN_PASSWORD` et les éventuelles variables de la boutique. Cette version n'exige aucun package npm supplémentaire.

## Fonctions ajoutées

- **Mon espace** se présente maintenant en trois onglets principaux : « Mon profil & sécurité », « Mes commandes » (avec livres et formations), et « Mes publications » (avec les quatre filtres Articles, Audio, Vidéos, EPUB).
- Administration → **Pages & sous-pages** : création, modification, suppression, publication, attribution à un onglet de menu et choix d'une page parente. Les liens apparaissent dans le menu du magazine.
- Pour relier une page à une autre : ouvrez « Pages & sous-pages », modifiez la page de départ, choisissez la page cible dans la liste « Créer un lien vers une autre page », placez le curseur dans le contenu, cliquez sur « Insérer le lien dans le texte » puis « Enregistrer ». Exemple de format : `[[page:nos-principes|Lire nos principes]]`.
- Administration → **Médiathèque** : dossiers et sous-dossiers, recherche, tri, déplacement des fichiers et nom original à partir des nouveaux imports. Les médias importés avant cette mise à jour n'ont pas leur nom d'origine dans la base : leur identifiant actuel est affiché par défaut, modifiable via l'API.
- Les lecteurs de la médiathèque sont maintenant réunis dans un panneau de lecture sobre, avec titre visible, précédent/suivant et lecture automatique du média suivant. Chaque fiche affiche le nom en grand et permet de le corriger directement. Tous les nouveaux imports, même depuis l'éditeur des publications, mémorisent le nom de fichier original.
- Administration → **Communauté & Newsletter** : lecture, approbation, refus et suppression des commentaires ; abonnés et envois.
- Publication → **Discussion** : lecture publique, écriture par les membres connectés et réponses après modération.
- Publication → **Ajouter à mes articles** : favoris des comptes membres existants.
- Mon espace : onglets Articles, Audio, Vidéos et EPUB pour les favoris. La bibliothèque des achats reste inchangée.
- Publication audio/vidéo : playlist des fichiers MP3/M4A/OGG/WAV et MP4/WebM mis en ligne, avec passage automatique au suivant. Les lecteurs tiers (YouTube, Spotify, etc.) restent intégrés dans chaque publication, sans lecture automatique entre services.
- Pied de page : inscription à la newsletter. Chaque newsletter envoyée possède un lien de désabonnement.

## Activer l'envoi de newsletters (facultatif)

Par défaut **aucun e-mail n'est envoyé**. Pour activer ce service, il faut créer un compte auprès d'un prestataire d'envoi et configurer dans Render :

- `BREVO_API_KEY` : clé API privée de Brevo.
- `NEWSLETTER_SENDER_EMAIL` : adresse d'expéditeur validée chez le prestataire.
- `SITE_ORIGIN` : origine HTTPS du site, par exemple `https://votre-domaine.tld` (à ajuster à votre domaine réel).

Attention : le coût, les quotas et les conditions du prestataire dépendent du compte choisi. Rien n'a été commandé, configuré sur Render ou envoyé par cette livraison. L'inscription newsletter est à consentement simple ; un système de **double confirmation par e-mail** serait recommandé avant un lancement public à grande échelle. Les obligations d'information et de confidentialité doivent être complétées pour votre activité.

## Limites et précautions

- Les médias existants dont le nom original n'avait pas été mémorisé ne peuvent pas retrouver automatiquement ce nom.
- Les grosses vidéos peuvent épuiser le disque persistant Render (actuellement 1 Go dans `render.yaml`).
- Les favoris sont personnels, pas une autorisation d'accès à des contenus payants. La boutique conserve ses propres contrôles d'accès.
- Les commentaires ne deviennent visibles qu'après approbation de l'administrateur.
- La suppression d'un fichier reste bloquée lorsqu'il est référencé par une publication ou les paramètres du site.
- La couleur noire, blanche et rouge et les feuilles de style existantes sont conservées. La nouvelle feuille `community.css` complète ce design.

## Tests sans connexion externe

Avec Node.js 22.13 ou plus :

```
npm test
```

Le test crée temporairement un serveur local avec sa propre base SQLite, puis vérifie inscription, favoris, commentaires, modération, dossiers, import PNG, newsletter et désabonnement.

## Fichiers principaux ajoutés

- `community.mjs` : API et tables SQLite.
- `public/community-ui.js` : affichage et interactions.
- `public/community.css` : style complémentaire.
- `tests/community.test.mjs` : tests d'intégration.

**Important :** test local ≠ validation de production. Avant ouverture publique, effectuer un essai d'inscription et un essai de newsletter avec votre propre adresse, surveiller les logs et vérifier les sauvegardes du disque.
