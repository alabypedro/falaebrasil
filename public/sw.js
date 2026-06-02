self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || "Falaê Brasil!";
  const options = {
    body: data.body || "Vamos retomar o English? Lembre-se: inglês transversal é todos os dias. Cheers.",
    icon: "/falae-brasil-logo.png",
    badge: "/app-icon-192.png",
    image: data.image || "/falae-brasil-logo.png",
    vibrate: [100, 50, 100],
    data: {
      url: data.url || "/"
    }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
});

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
