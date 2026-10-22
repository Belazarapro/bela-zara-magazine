# Bela Zara Magazine — Mise à jour V3

Cette version conserve l'apparence du magazine et les données des versions précédentes. Elle ajoute une boutique et des comptes clients **indépendants du site La Méthode Causale**.

## Pages ajoutées

- `/boutique` : catalogue des livres, podcasts et formations.
- `/mon-espace` : inscription, connexion, bibliothèque personnelle, commandes.
- `/admin` : nouvel onglet **BOUTIQUE & CLIENTS**.
- `/mentions-legales`, `/confidentialite`, `/conditions-de-vente` : textes à compléter dans **APPARENCE & INFOS**.

## EPUB : lecture sur le site

**Aucun bouton « Télécharger l'EPUB » n'est affiché** dans les articles et dans l'espace client. Le lecteur EPUB intégré permet de tourner les pages. Pour les **EPUB commerciaux**, le serveur refuse la route de téléchargement habituelle et n'autorise leur lecture qu'aux comptes disposant d'un accès.

Attention : cette protection gère l'accès et supprime le téléchargement proposé. Un navigateur doit néanmoins recevoir les données du livre pour les afficher. Aucun lecteur web classique ne garantit à 100 % l'impossibilité technique de copier ces données. Pour une vraie protection contre l'extraction il faudrait un service et des licences DRM spécialisés.

Les EPUB de la médiathèque **publique** V2 (`/uploads`) restent techniquement publics. Ne placez donc **jamais un EPUB payant** dans cette médiathèque : utilisez uniquement **BOUTIQUE & CLIENTS > FICHIER PRIVÉ**.

## Ajouter un produit

1. Ouvrir `/admin` et saisir le mot de passe administrateur existant.
2. Choisir **BOUTIQUE & CLIENTS** puis **+ NOUVEAU PRODUIT**.
3. Renseigner le titre, la description, la catégorie, le prix en euros, la couverture facultative, puis cocher « Afficher dans la boutique ».
4. Enregistrer, puis cliquer **FICHIER PRIVÉ** sur le produit pour importer un EPUB, PDF, MP3, M4A, MP4 ou WebM.
5. Vérifier que le produit apparaît sur `/boutique`. Tant que les paiements ne sont pas activés, le produit est marqué « En préparation ».
6. Dans **APPARENCE & INFOS**, renseigner une adresse e-mail de contact, les mentions légales, les conditions générales de vente et la politique de confidentialité. Les inscriptions restent fermées tant que ces textes ne sont pas renseignés (100 caractères au minimum par texte).

## Déploiement sur le Render existant

1. Sauvegarder auparavant les fichiers actuels de GitHub et vérifier que Render possède toujours son disque persistant `/var/data`.
2. **Extraire le ZIP V3** sur votre ordinateur. Ouvrir le dossier `bela-zara-magazine-v3`, sélectionner *son contenu* et remplacer les fichiers de la racine de votre dépôt GitHub existant. Ne téléversez pas le dossier enveloppe en bloc.
3. Vérifier que les fichiers `server-v3.mjs`, `shop.mjs`, `public/shop-ui.js` et `public/shop.css` se trouvent au bon endroit. `package.json` démarre maintenant `server-v3.mjs`.
4. Valider les changements (Commit changes) sur GitHub. Si votre Render est configuré en déploiement automatique, attendre que le nouveau déploiement soit « Live ».
5. Ouvrir `/boutique` puis `/mon-espace`. Le site doit conserver ses anciens articles, photos et réglages.

**Ne créez pas un nouveau projet Render** pour cette mise à jour et **ne supprimez pas le disque** actuel : la V3 ajoute ses tables dans la base SQLite existante et stocke les fichiers vendus dans `/var/data/private-products`.

## Paiement Stripe

La boutique n'encaisse rien par défaut. Quand vos contenus, prix et documents juridiques sont prêts, configurez dans **Render > Web Service > Environment** :

| Variable | Valeur |
|---|---|
| `SITE_ORIGIN` | L'adresse complète exacte de votre magazine : `https://...` |
| `STRIPE_SECRET_KEY` | Clé secrète Stripe, d'abord en mode test |
| `STRIPE_WEBHOOK_SECRET` | Secret de signature de votre webhook Stripe |
| `SHOP_SALES_ENABLED` | `true` après vérification des paramètres |

Configurer dans Stripe le webhook : `https://ADRESSE-DE-VOTRE-MAGAZINE/api/shop/webhook`, pour les événements :

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `charge.refunded`

Une commande n'ouvre les droits de lecture qu'après confirmation du paiement par un événement Stripe signé. Le paiement réel n'a **pas** été testé dans cet environnement. Effectuez les essais Stripe en mode test avant de configurer les clés de production.

N'inscrivez **jamais** les secrets Stripe ni le mot de passe administrateur dans des fichiers publics sur GitHub.

## Limites

- Chaque achat donne accès à une ressource numérique. Une formation correspond ici à un fichier vidéo par produit ; un espace multi-leçons nécessite une évolution.
- Aucun abonnement, facture automatique, courriel de récupération de mot de passe ni remboursement client en libre-service n'est encore développé.
- Prévoir une politique de sauvegarde du disque `/var/data` et une vérification indépendante avant de lancer une boutique commerciale avec paiements réels.
