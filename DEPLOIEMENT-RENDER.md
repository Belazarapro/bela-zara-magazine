# Publier Bela Zara Magazine sur Render

**Préparé pour un hébergement Node.js payant avec disque persistant.**

## Avant de commencer

- Avoir un compte GitHub et un compte Render.
- Ne jamais publier `.env`, les mots de passe ou les fichiers du dossier `data/` sur GitHub.
- Le projet contient des articles fictifs de démonstration. Les remplacer avant d'annoncer publiquement le lancement.

## Etapes

1. Créer un dépôt GitHub (par exemple `bela-zara-magazine`) et y placer les **fichiers contenus dans ce dossier**, en conservant leur arborescence. Le fichier `render.yaml` doit être à la racine du dépôt.
2. Dans Render, ouvrir **New > Blueprint** et choisir le dépôt GitHub. Render détectera `render.yaml`.
3. Vérifier la configuration avant toute création payante. Le Blueprint demande un **web service plan Starter**, avec un disque persistant de **1 Go**. Le prix et la facturation réels sont indiqués par Render lors de la validation.
4. Fournir en privé la variable d'environnement `ADMIN_PASSWORD` (au moins 12 caractères, idéalement générée par un gestionnaire de mots de passe). Ne jamais l'écrire dans le dépôt.
5. Lancer le déploiement et attendre l'état Live. Ne considérer l'opération comme terminée qu'après vérification effective de l'URL.
6. Tester `/api/health` (doit renvoyer `{"ok":true}`), la page d'accueil, le lien `/admin` et la connexion.
7. Depuis l'administration, remplacer les articles de démonstration et vérifier la bonne sauvegarde d'un article. Tester son maintien après un redéploiement.

## Architecture

- Application Node native avec base SQLite.
- Images téléversées et base SQLite sous `DATA_DIR=/var/data`.
- Disque persistant Render monté sur `/var/data`.
- Port détecté par Render à partir de `PORT`.
- **SSL/HTTPS** géré par Render.

## Important

L'offre gratuite Render n'est pas adaptée à cette version : sa base SQLite et ses images disparaîtraient à chaque redémarrage/redéploiement. Si tu veux impérativement un hébergement gratuit, il faudra faire évoluer l'application vers une base hébergée et un stockage externe durable, ou choisir une solution de publication adaptée.

Un disque persistant n'est pas une politique de sauvegarde. Prévoir des sauvegardes externes du répertoire de données et tester une restauration avant une utilisation éditoriale importante.
