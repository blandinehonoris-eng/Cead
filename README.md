# 📱 ONG CEAD — Progressive Web App (PWA)
## Guide d'installation, de test et de déploiement

---

## 📦 Structure des fichiers

```
cead-pwa/
├── index.html          # Application principale (tout-en-un)
├── manifest.json       # Manifeste PWA (installation)
├── sw.js               # Service Worker (cache + offline)
├── offline.html        # Page de fallback hors-ligne
├── icons/
│   ├── icon-72.svg     # Icône app (72×72)
│   ├── icon-96.svg     # Icône app (96×96)
│   ├── icon-128.svg    # Icône app (128×128)
│   ├── icon-144.svg    # Icône app (144×144)
│   ├── icon-152.svg    # Apple Touch Icon
│   ├── icon-192.svg    # Icône standard PWA (maskable)
│   ├── icon-384.svg    # Icône haute résolution
│   └── icon-512.svg    # Icône splash screen (maskable)
└── README.md           # Ce fichier
```

---

## 🚀 Test en local

### Option 1 — Python (recommandé)
```bash
cd cead-pwa
python3 -m http.server 8080
# Ouvrir : http://localhost:8080
```

### Option 2 — Node.js avec serve
```bash
npm install -g serve
serve ./cead-pwa -p 8080
# Ouvrir : http://localhost:8080
```

### Option 3 — VS Code Live Server
- Installer l'extension **Live Server**
- Clic droit sur `index.html` → **Open with Live Server**

> ⚠️ **Important** : Le Service Worker nécessite HTTPS ou `localhost`.
> Ne testez PAS en ouvrant directement le fichier (`file://`).

---

## 📲 Tester les fonctionnalités PWA

### Installation sur mobile (Android)
1. Ouvrir le site dans **Chrome Android**
2. Une bannière « Installer » apparaît après 3 secondes
3. Ou : menu ⋮ → **Ajouter à l'écran d'accueil**

### Installation sur desktop (Chrome/Edge)
1. Ouvrir le site
2. Icône 📥 dans la barre d'adresse → **Installer**
3. Ou : menu → **Installer ONG CEAD**

### Tester le mode hors-ligne
1. Ouvrir le site et le laisser charger complètement
2. DevTools → **Network** → cocher **Offline**
3. Recharger la page → le contenu mis en cache s'affiche
4. Naviguer vers une URL inconnue → `offline.html` s'affiche

### Audit Lighthouse
1. DevTools → **Lighthouse**
2. Sélectionner : Performance, Accessibilité, SEO, PWA
3. Cliquer **Analyze page load**
4. Objectif : **90+** sur tous les critères

---

## 🌐 Déploiement en production

### GitHub Pages (gratuit)
```bash
# Initialiser un repo Git
git init
git add .
git commit -m "Initial PWA commit — ONG CEAD"
git branch -M main
git remote add origin https://github.com/VOTRE_USERNAME/cead-pwa.git
git push -u origin main

# Activer GitHub Pages : Settings → Pages → Branch: main → /root
```

### Netlify (recommandé — HTTPS automatique)
```bash
# Option CLI
npm install -g netlify-cli
netlify deploy --dir=./cead-pwa --prod

# Option glisser-déposer
# → netlify.com/drop → glisser le dossier cead-pwa
```

### Vercel
```bash
npm install -g vercel
cd cead-pwa
vercel --prod
```

### Hébergement classique (OVH, Infomaniak, etc.)
1. Compresser le dossier `cead-pwa`
2. Uploader via FTP/SFTP dans `public_html/`
3. S'assurer que le serveur sert `index.html` par défaut
4. Activer HTTPS (obligatoire pour le SW)

---

## ⚙️ Configuration serveur recommandée

### Apache (.htaccess)
```apache
# Compression GZIP
<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE text/html text/css application/javascript
</IfModule>

# Cache-Control
<IfModule mod_headers.c>
  # Cache long pour assets statiques
  <FilesMatch "\.(css|js|svg|png|jpg|woff2)$">
    Header set Cache-Control "max-age=31536000, immutable"
  </FilesMatch>
  # Pas de cache pour HTML et SW
  <FilesMatch "\.(html|json)$">
    Header set Cache-Control "no-cache, no-store, must-revalidate"
  </FilesMatch>
  # SW doit être non-caché
  <Files "sw.js">
    Header set Cache-Control "no-cache, no-store"
  </Files>
</IfModule>

# HTTPS redirect
RewriteEngine On
RewriteCond %{HTTPS} off
RewriteRule ^ https://%{HTTP_HOST}%{REQUEST_URI} [R=301,L]
```

### Nginx
```nginx
server {
  listen 443 ssl http2;
  server_name ceadguinee.org www.ceadguinee.org;

  gzip on;
  gzip_types text/html text/css application/javascript image/svg+xml;

  location ~* \.(css|js|svg|png|jpg|woff2)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
  }
  location ~ (sw\.js|manifest\.json)$ {
    add_header Cache-Control "no-cache, no-store";
  }
  location / {
    try_files $uri $uri/ /index.html;
    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-Content-Type-Options "nosniff";
  }
}
```

---

## 🎯 Checklist Lighthouse — Bonnes pratiques

### ✅ Performance
- [x] Chargement HTML inline (pas de CSS/JS externe bloquant)
- [x] `preconnect` pour Google Fonts
- [x] `preload` pour la feuille de style des polices
- [x] Images lazy-loaded avec `data-src`
- [x] Service Worker avec cache intelligent

### ✅ Accessibilité
- [x] Rôles ARIA sur tous les éléments interactifs
- [x] `aria-label` sur les boutons icône
- [x] `aria-live` pour les notifications dynamiques
- [x] Contraste suffisant (texte sur fond sombre)
- [x] Navigation clavier complète (tabindex, keydown)
- [x] `<h1>` unique par page, hiérarchie correcte
- [x] `<form>` avec `<label>` associés via `for`/`id`
- [x] `lang="fr"` sur `<html>`

### ✅ SEO
- [x] Meta `description` et `keywords`
- [x] Open Graph (Facebook, LinkedIn)
- [x] Twitter Card
- [x] Schema.org JSON-LD (NGO)
- [x] `<link rel="canonical">`
- [x] Sitemap recommandé
- [x] `robots` meta tag

### ✅ PWA
- [x] `manifest.json` complet
- [x] Icônes 192px et 512px (maskable)
- [x] `theme-color` meta
- [x] Service Worker enregistré
- [x] Fonctionne hors-ligne
- [x] HTTPS (en production)
- [x] `apple-mobile-web-app-capable`

---

## 🔔 Activer les Notifications Push (optionnel)

Pour activer les vraies notifications push, il faut un serveur VAPID :

```bash
# Générer les clés VAPID
npm install web-push -g
web-push generate-vapid-keys
```

Puis dans le SW (`sw.js`), remplacer la section `push` par votre logique backend.

---

## 📊 Mettre à jour le cache (versionning)

Lors d'une mise à jour du site, incrémenter `CACHE_VERSION` dans `sw.js` :
```javascript
const CACHE_VERSION = 'cead-v2.1.0'; // ← Changer ce numéro
```
Cela forcera le re-téléchargement de tous les assets mis en cache.

---

## 🛠️ Technologies utilisées

| Technologie | Usage |
|-------------|-------|
| HTML5 sémantique | Structure accessible |
| CSS3 Variables + Grid + Flexbox | Layout responsive |
| CSS animations | Micro-interactions |
| Vanilla JavaScript ES2020 | Interactivité |
| Service Worker API | Cache + Offline |
| IndexedDB | Stockage formulaire offline |
| Web App Manifest | Installation PWA |
| IntersectionObserver | Scroll animations |
| Background Sync | Sync formulaire offline |
| Push API | Notifications (optionnel) |

---

## 📞 Support

Pour toute question technique :
- **Email** : contact@ceadguinee.org
- **Site** : www.ceadguinee.org
- **Docs PWA** : https://web.dev/progressive-web-apps/

---

*ONG CEAD — Centre d'Étude et d'Appui au Développement*
*N'Zérékoré, Guinée — © 2025*
