
self.addEventListener("push", (event) => {
  let payload = {};

  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {
      body: event.data ? event.data.text() : "",
    };
  }

  const title = payload.title || "PlayTurf";
  const options = {
    body: payload.body || "A slot you were watching may now be available.",
    icon: "/playturf-logo.webp",
    badge: "/playturf-logo.webp",
    tag: payload.tag || `playturf-${payload.reminderId || "slot-alert"}`,
    data: {
      url: payload.url || "/",
    },
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  event.waitUntil(
    (async () => {
      let targetUrl;

      try {
        targetUrl = new URL(
          event.notification.data?.url || "/",
          self.location.origin
        );

        if (targetUrl.origin !== self.location.origin) {
          targetUrl = new URL("/", self.location.origin);
        }
      } catch {
        targetUrl = new URL("/", self.location.origin);
      }

      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      for (const client of windows) {
        if ("focus" in client) {
          await client.focus();

          if ("navigate" in client) {
            await client.navigate(targetUrl.href);
          }

          return;
        }
      }

      await self.clients.openWindow(targetUrl.href);
    })()
  );
});
