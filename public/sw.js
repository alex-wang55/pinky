/* Pinky service worker: push notifications, app badge, offline fallback. */
const VERSION = "v2";
const CACHE = `pinky-${VERSION}`;
const OFFLINE_URL = "/offline.html";
const PRECACHE = [OFFLINE_URL, "/icons/icon-192.png", "/icons/apple-touch-icon.png"];

// Don't cache anything on localhost so dev builds never serve stale chunks.
const IS_DEV = ["localhost", "127.0.0.1", "[::1]"].includes(self.location.hostname);

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("pinky-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // Only touch our own origin. Supabase, image uploads etc. go straight to the network.
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  // Page loads: always try the network first so you never see stale pact data.
  // If there's no connection, show the offline page instead of the browser error.
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  if (IS_DEV) return;

  // Next's build output is content-hashed and never changes, and icons rarely do,
  // so serve them from cache and fill the cache on first use.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    e.respondWith(
      caches.open(CACHE).then(async (c) => {
        const hit = await c.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) c.put(req, res.clone());
        return res;
      }),
    );
  }
});

self.addEventListener("push", (e) => {
  let data = {};
  try {
    data = e.data ? e.data.json() : {};
  } catch {
    data = { title: "Pinky", body: e.data ? e.data.text() : "" };
  }
  const jobs = [
    self.registration.showNotification(data.title || "Pinky", {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-96.png",
      tag: data.tag,
      data: { url: data.url || "/" },
    }),
  ];
  // Red dot on the home screen icon until you open the app.
  if (data.tag === "daily-reminder" && "setAppBadge" in self.navigator) {
    jobs.push(self.navigator.setAppBadge(1).catch(() => {}));
  }
  e.waitUntil(Promise.all(jobs));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "/";
  const clearBadge = "clearAppBadge" in self.navigator ? self.navigator.clearAppBadge().catch(() => {}) : Promise.resolve();
  e.waitUntil(
    Promise.all([
      clearBadge,
      self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
        for (const c of list) {
          if ("focus" in c) {
            c.navigate(url);
            return c.focus();
          }
        }
        return self.clients.openWindow(url);
      }),
    ]),
  );
});
