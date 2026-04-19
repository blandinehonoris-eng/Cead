/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  ONG CEAD — Service Worker v2.0                             ║
 * ║  Stratégie : Cache-First + Network-First + Offline Fallback ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

const CACHE_VERSION    = 'cead-v2.0.0';
const STATIC_CACHE     = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE    = `${CACHE_VERSION}-dynamic`;
const FONTS_CACHE      = `${CACHE_VERSION}-fonts`;
const IMAGES_CACHE     = `${CACHE_VERSION}-images`;
const OFFLINE_URL      = '/offline.html';

/* ── Ressources à précacher au moment de l'installation ── */
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.json',
  '/sw.js',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

/* ── Polices Google Fonts à mettre en cache ── */
const FONT_ORIGINS = [
  'https://fonts.googleapis.com',
  'https://fonts.gstatic.com',
];

/* ── Durée max du cache dynamique ── */
const DYNAMIC_CACHE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 jours
const IMAGES_CACHE_MAX_AGE  = 30 * 24 * 60 * 60 * 1000; // 30 jours

/* ══════════════════════════════════════════
   INSTALLATION — Précache des assets statiques
══════════════════════════════════════════ */
self.addEventListener('install', event => {
  console.log('[SW] Installation — CEAD v2.0.0');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        console.log('[SW] Précache des assets statiques');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[SW] Précache terminé — skip waiting');
        return self.skipWaiting();
      })
      .catch(err => console.error('[SW] Erreur précache:', err))
  );
});

/* ══════════════════════════════════════════
   ACTIVATION — Nettoyage des anciens caches
══════════════════════════════════════════ */
self.addEventListener('activate', event => {
  console.log('[SW] Activation');
  event.waitUntil(
    Promise.all([
      // Supprimer les anciens caches
      caches.keys().then(keys =>
        Promise.all(
          keys
            .filter(key => key.startsWith('cead-') && key !== STATIC_CACHE
              && key !== DYNAMIC_CACHE && key !== FONTS_CACHE && key !== IMAGES_CACHE)
            .map(key => {
              console.log('[SW] Suppression ancien cache:', key);
              return caches.delete(key);
            })
        )
      ),
      // Prendre le contrôle immédiat de toutes les pages
      self.clients.claim()
    ])
  );
});

/* ══════════════════════════════════════════
   FETCH — Routage intelligent des requêtes
══════════════════════════════════════════ */
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorer les requêtes non-HTTP
  if (!request.url.startsWith('http')) return;

  // Ignorer les requêtes POST/PUT/DELETE
  if (request.method !== 'GET') return;

  // 1. Polices Google Fonts → Cache-First longue durée
  if (FONT_ORIGINS.some(origin => request.url.startsWith(origin))) {
    event.respondWith(cacheFirstStrategy(request, FONTS_CACHE));
    return;
  }

  // 2. Images → Cache-First avec fallback SVG
  if (/\.(png|jpg|jpeg|gif|webp|svg|ico)$/i.test(url.pathname)) {
    event.respondWith(imageStrategy(request));
    return;
  }

  // 3. Assets statiques (CSS, JS, polices locales) → Cache-First
  if (/\.(css|js|woff|woff2|ttf|eot)$/i.test(url.pathname)) {
    event.respondWith(cacheFirstStrategy(request, STATIC_CACHE));
    return;
  }

  // 4. Page HTML principale → Network-First avec fallback offline
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(networkFirstStrategy(request));
    return;
  }

  // 5. API / autres → Stale-While-Revalidate
  event.respondWith(staleWhileRevalidate(request));
});

/* ══════════════════════════════════════════
   STRATÉGIES DE CACHE
══════════════════════════════════════════ */

/**
 * Cache-First : retourne depuis le cache, sinon réseau
 */
async function cacheFirstStrategy(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return offlineFallback(request);
  }
}

/**
 * Network-First : essaie le réseau, sinon cache, sinon offline
 */
async function networkFirstStrategy(request) {
  try {
    const response = await fetchWithTimeout(request, 5000);
    if (response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, response.clone());
      await trimCache(DYNAMIC_CACHE, 50);
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;

    // Retourner la page offline si c'est une navigation HTML
    if (request.headers.get('accept')?.includes('text/html')) {
      return caches.match(OFFLINE_URL) || new Response(
        '<h1>Hors ligne</h1><p>Vérifiez votre connexion internet.</p>',
        { headers: { 'Content-Type': 'text/html' } }
      );
    }
    return offlineFallback(request);
  }
}

/**
 * Stale-While-Revalidate : retourne le cache, puis met à jour en arrière-plan
 */
async function staleWhileRevalidate(request) {
  const cache = await caches.open(DYNAMIC_CACHE);
  const cached = await cache.match(request);

  const networkPromise = fetch(request).then(response => {
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => cached);

  return cached || networkPromise;
}

/**
 * Stratégie Images : Cache-First avec fallback SVG placeholder
 */
async function imageStrategy(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(IMAGES_CACHE);
      cache.put(request, response.clone());
      await trimCache(IMAGES_CACHE, 100);
    }
    return response;
  } catch {
    // Retourner une image placeholder SVG en cas d'échec
    return new Response(
      `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
        <rect width="400" height="300" fill="#0b1929"/>
        <text x="200" y="140" fill="#2a4a6b" text-anchor="middle" font-family="Arial" font-size="14">Image non disponible</text>
        <text x="200" y="165" fill="#2a4a6b" text-anchor="middle" font-family="Arial" font-size="11">Mode hors ligne</text>
        <text x="200" y="190" fill="#00c8ff" text-anchor="middle" font-family="Arial" font-size="12">ONG CEAD</text>
      </svg>`,
      { headers: { 'Content-Type': 'image/svg+xml' } }
    );
  }
}

/* ══════════════════════════════════════════
   UTILITAIRES
══════════════════════════════════════════ */

/** Fetch avec timeout */
async function fetchWithTimeout(request, timeout = 5000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(request, { signal: controller.signal });
    clearTimeout(timer);
    return response;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

/** Limiter le nombre d'entrées dans un cache */
async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > maxEntries) {
    await cache.delete(keys[0]);
    await trimCache(cacheName, maxEntries);
  }
}

/** Fallback générique hors ligne */
async function offlineFallback(request) {
  const cached = await caches.match(request);
  return cached || caches.match(OFFLINE_URL);
}

/* ══════════════════════════════════════════
   SYNCHRONISATION EN ARRIÈRE-PLAN
══════════════════════════════════════════ */
self.addEventListener('sync', event => {
  if (event.tag === 'sync-contact-form') {
    event.waitUntil(syncContactForm());
  }
});

async function syncContactForm() {
  try {
    const db = await openIDB();
    const pendingForms = await getAllPending(db);
    for (const form of pendingForms) {
      try {
        await fetch('/api/contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form.data)
        });
        await deletePending(db, form.id);
        console.log('[SW] Formulaire synchronisé:', form.id);
      } catch (e) {
        console.warn('[SW] Échec sync formulaire:', e);
      }
    }
  } catch (e) {
    console.error('[SW] Erreur sync:', e);
  }
}

/* ══════════════════════════════════════════
   NOTIFICATIONS PUSH
══════════════════════════════════════════ */
self.addEventListener('push', event => {
  if (!event.data) return;

  const data = event.data.json();
  const options = {
    body: data.body || 'Nouvelle actualité du CEAD',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-72.png',
    image: data.image || null,
    vibrate: [200, 100, 200],
    tag: data.tag || 'cead-notification',
    renotify: true,
    requireInteraction: false,
    actions: [
      { action: 'open', title: 'Voir', icon: '/icons/icon-72.png' },
      { action: 'close', title: 'Fermer' }
    ],
    data: { url: data.url || '/' }
  };

  event.waitUntil(
    self.registration.showNotification(
      data.title || 'ONG CEAD',
      options
    )
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  if (event.action === 'close') return;

  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        for (const client of clientList) {
          if (client.url === url && 'focus' in client) return client.focus();
        }
        return clients.openWindow(url);
      })
  );
});

/* ══════════════════════════════════════════
   IndexedDB helpers (pour le formulaire offline)
══════════════════════════════════════════ */
function openIDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('cead-offline', 1);
    req.onupgradeneeded = e => {
      e.target.result.createObjectStore('pending', { keyPath: 'id', autoIncrement: true });
    };
    req.onsuccess = e => resolve(e.target.result);
    req.onerror = e => reject(e.target.error);
  });
}

function getAllPending(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('pending', 'readonly');
    const req = tx.objectStore('pending').getAll();
    req.onsuccess = e => resolve(e.target.result);
    req.onerror = e => reject(e.target.error);
  });
}

function deletePending(db, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('pending', 'readwrite');
    const req = tx.objectStore('pending').delete(id);
    req.onsuccess = () => resolve();
    req.onerror = e => reject(e.target.error);
  });
}

console.log('✦ ONG CEAD Service Worker v2.0.0 — Actif ✦');
