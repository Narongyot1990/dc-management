// Service Worker for Dock Management PWA
const CACHE_NAME = 'dock-mgmt-v1';
const OFFLINE_URL = '/offline.html';

// Static assets to cache immediately
const STATIC_CACHE = [
  '/',
  '/driver',
  '/planner',
  '/bookingmanagement',
  '/offline.html',
  '/manifest.json'
];

// API routes to cache with network-first strategy
const API_CACHE_ROUTES = [
  '/api/jobs',
  '/api/bookings'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Install');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_CACHE);
    })
  );
  self.skipWaiting();
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activate');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - handle requests
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests for caching (but handle offline queue separately)
  if (request.method !== 'GET') {
    // For POST/PUT/DELETE, try network first, queue if offline
    if (url.pathname.startsWith('/api/')) {
      event.respondWith(handleMutationRequest(request));
    }
    return;
  }

  // API requests - Network first, fallback to cache
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstWithCache(request));
    return;
  }

  // Static assets - Cache first, fallback to network
  event.respondWith(cacheFirstWithNetwork(request));
});

// Network first strategy (for API)
async function networkFirstWithCache(request) {
  try {
    const response = await fetch(request);
    // Clone and cache successful responses
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.log('[SW] Network failed, trying cache:', request.url);
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    // Return offline JSON for API
    return new Response(
      JSON.stringify({
        success: false,
        offline: true,
        error: 'You are offline',
        cached: false
      }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// Cache first strategy (for static assets)
async function cacheFirstWithNetwork(request) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.log('[SW] Offline, returning offline page');
    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      return caches.match(OFFLINE_URL);
    }
    throw error;
  }
}

// Handle mutation requests (POST, PUT, DELETE)
async function handleMutationRequest(request) {
  try {
    return await fetch(request);
  } catch (error) {
    // Queue the request for later
    const requestData = await serializeRequest(request);
    await queueRequest(requestData);

    return new Response(
      JSON.stringify({
        success: true,
        queued: true,
        message: 'Request queued for sync when online'
      }),
      {
        status: 202,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// Serialize request for storage
async function serializeRequest(request) {
  const body = await request.clone().text();
  return {
    url: request.url,
    method: request.method,
    headers: Object.fromEntries(request.headers.entries()),
    body: body,
    timestamp: Date.now()
  };
}

// Queue request in IndexedDB
async function queueRequest(requestData) {
  const db = await openDB();
  const tx = db.transaction('offlineQueue', 'readwrite');
  const store = tx.objectStore('offlineQueue');
  store.add(requestData);
}

// Open IndexedDB
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('DockMgmtOffline', 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('offlineQueue')) {
        db.createObjectStore('offlineQueue', { keyPath: 'timestamp' });
      }
      if (!db.objectStoreNames.contains('cachedData')) {
        db.createObjectStore('cachedData', { keyPath: 'key' });
      }
    };
  });
}

// Background sync - process queued requests when online
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-offline-queue') {
    console.log('[SW] Background sync triggered');
    event.waitUntil(processOfflineQueue());
  }
});

// Process offline queue
async function processOfflineQueue() {
  const db = await openDB();
  const tx = db.transaction('offlineQueue', 'readwrite');
  const store = tx.objectStore('offlineQueue');
  const requests = await getAllFromStore(store);

  for (const requestData of requests) {
    try {
      const response = await fetch(requestData.url, {
        method: requestData.method,
        headers: requestData.headers,
        body: requestData.body
      });

      if (response.ok) {
        // Remove from queue on success
        const deleteTx = db.transaction('offlineQueue', 'readwrite');
        deleteTx.objectStore('offlineQueue').delete(requestData.timestamp);
        console.log('[SW] Synced queued request:', requestData.url);

        // Notify clients
        self.clients.matchAll().then(clients => {
          clients.forEach(client => {
            client.postMessage({
              type: 'SYNC_COMPLETE',
              url: requestData.url
            });
          });
        });
      }
    } catch (error) {
      console.log('[SW] Failed to sync:', requestData.url, error);
    }
  }
}

// Helper to get all items from store
function getAllFromStore(store) {
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Listen for messages from clients
self.addEventListener('message', (event) => {
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data.type === 'GET_QUEUE_COUNT') {
    getQueueCount().then(count => {
      event.ports[0].postMessage({ count });
    });
  }
});

// Get count of queued items
async function getQueueCount() {
  try {
    const db = await openDB();
    const tx = db.transaction('offlineQueue', 'readonly');
    const store = tx.objectStore('offlineQueue');
    return new Promise((resolve) => {
      const request = store.count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(0);
    });
  } catch {
    return 0;
  }
}
