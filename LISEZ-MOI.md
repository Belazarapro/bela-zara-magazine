# BELA ZARA — Magazine indépendant

Première version fonctionnelle d'un site éditorial **sans WordPress**. Direction graphique : pamphlet graphique, noir, blanc et rouge, avec une mise en page de magazine.

## 1. Ouvrir le blog sur votre ordinateur

Vous avez besoin de **Node.js 22.13 ou plus récent** (disponible sur nodejs.org). Le projet n'utilise aucune bibliothèque npm externe.

1. Décompressez l'archive dans un dossier.
2. Ouvrez un terminal dans ce dossier.
3. Exécutez `npm start` (ou `node server.mjs`).
4. Dans le navigateur, ouvrez **http://localhost:3000**.

Vous pouvez consulter le magazine, ses rubriques et les exemples d'articles immédiatement. Ces articles sont **des démonstrations**, pas des textes définitifs de l'auteur.

## 2. Activer votre espace d'administration

1. Dans le dossier du blog, dupliquez `.env.example` et renommez la copie en `.env`.
2. Ouvrez `.env` dans un éditeur de texte.
3. Remplacez la valeur de `ADMIN_PASSWORD` par un **mot de passe personnel de 12 caractères minimum**. Ne laissez pas celui de l'exemple.
4. Redémarrez le serveur si nécessaire.
5. Allez sur **http://localhost:3000/admin**.
6. Entrez le mot de passe choisi.

**Ne partagez pas votre fichier `.env` et ne le publiez jamais sur un dépôt public.**

## 3. Publier un article ou un podcast

Dans **Administration > Publications** :

- Créez une nouvelle publication ou modifiez un exemple.
- Renseignez le titre, le résumé, la rubrique et le corps du texte.
- Importez une photo de couverture (JPG, PNG, WebP ou GIF, 6 Mo maximum).
- Pour la mise en forme : `## Intertitre` et `**mot en gras**`.
- Choisissez son type : article, podcast, vidéo ou livre.
- Pour une vidéo YouTube, ajoutez son lien. Pour un podcast MP3, ajoutez son URL audio ; un lien externe est également possible.
- Passez son statut de *Brouillon* à *Publié*.
- Cochez **Mettre à la une** pour en faire le grand article principal.

La rubrique « Grands dossiers » affiche les publications classées dans la catégorie du même nom.

Utilisez les flèches ↑ et ↓ de la liste pour définir l'ordre des publications.

## 4. Changer l'identité ou la disposition

Dans **Administration > Apparence & infos** :

- Modifiez le nom, la devise, la citation et le texte À propos.
- Déplacez la colonne latérale à gauche ou à droite.
- Masquez ou affichez la colonne latérale.
- Affichez 4, 6 ou 8 cartes d'articles en page d'accueil.
- Placez la une avant ou après les cartes.

L'identité **noir, blanc, rouge** et les styles typographiques sont définis dans `public/style.css`. Le menu principal et les mises en page avancées restent à personnaliser dans le code à ce stade. Ce n'est pas encore un éditeur de mise en page glisser-déposer.

## 5. Comprendre les fichiers

- `server.mjs` : serveur, connexion administrateur, API, enregistrement, recherche et import d'images.
- `public/index.html` : structure du site.
- `public/style.css` : identité visuelle et adaptation téléphone/ordinateur.
- `public/app.js` : affichage, navigation, formulaires d'administration.
- `public/assets/` : images de la version de démonstration.
- `data/magazine.sqlite` : base de données créée automatiquement au premier lancement.
- `data/uploads/` : images importées, créées automatiquement.

Pour **sauvegarder** vos contenus, sauvegardez impérativement l'ensemble du dossier `data/`.

## 6. Mise en ligne

Le projet nécessite un hébergement **Node.js 22+** avec un stockage **persistant**, car SQLite et les images importées sont conservés sur disque. Pour éviter de perdre les publications lors d'un redéploiement, ne déployez pas la version telle quelle sur un hébergement dont le disque est éphémère.

Variables d'environnement nécessaires :

- `ADMIN_PASSWORD` : mot de passe d'au moins 12 caractères, défini de manière privée.
- `PORT` : port d'écoute, facultatif (3000 par défaut).
- `DATA_DIR` : dossier persistant de la base et des images, indispensable sur un hébergement avec réinitialisation du disque applicatif.

La configuration de l'hébergement, du domaine et du HTTPS se fera lors de l'étape de publication.

## 7. Sécurité et limites de cette version

- L'espace d'administration est protégé par mot de passe et cookie de session côté serveur.
- Les contenus sont enregistrés sur le serveur, pas seulement dans le navigateur.
- Les articles de démonstration sont des exemples à remplacer.
- Les images du magazine sont issues d'une maquette de démonstration et d'une illustration créées pour le projet.
- Les vidéos ne sont pas hébergées par ce site : elles sont intégrées depuis YouTube ou ouvertes via des liens.
- Les sessions de connexion sont réinitialisées au redémarrage du serveur.
- Avant une ouverture au public à grande échelle, prévoir sauvegardes automatisées, protection contre les tentatives répétées de connexion et gestion durable des médias.
