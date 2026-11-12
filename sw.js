// Garde l'app disponible hors ligne. Change VERSION à chaque mise à jour des fichiers.
// Kalima Up partage le site kurapika936.github.io avec Word Up : ses caches portent le préfixe
// « kalima- » et elle ne touche JAMAIS aux autres caches (ceux de Word Up s'appellent « carnet-vN »).
const PREFIX = "kalima-";
const VERSION = "kalima-v4";
const FILES = ["./", "index.html", "manifest.webmanifest", "kalima-180.png", "kalima-192.png", "kalima-512.png"];

const fill = () => caches.open(VERSION).then(c => c.addAll(FILES.map(f => new Request(f, { cache: "reload" }))));

self.addEventListener("install", e => {
  // cache:"reload" ignore le cache HTTP du navigateur (GitHub Pages garde les fichiers 10 min).
  e.waitUntil(fill().then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith(PREFIX) && k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Réseau d'abord, en revalidant toujours auprès de GitHub ; cache (le sien seulement) hors ligne.
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== location.origin) return;
  // Si le cache a disparu (par ex. effacé par une autre app du même site), on le reconstruit.
  if (e.request.mode === "navigate") e.waitUntil(caches.has(VERSION).then(h => h || fill()).catch(() => {}));
  e.respondWith(
    fetch(e.request, { cache: "no-cache" })
      .then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); }
        return res;
      })
      .catch(() => caches.open(VERSION).then(c => c.match(e.request, { ignoreSearch: true }).then(r => r || c.match("index.html"))))
  );
});
