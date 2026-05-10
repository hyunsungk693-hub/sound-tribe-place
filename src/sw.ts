/// <reference lib="webworker" />
import { precacheAndRoute } from "workbox-precaching";

declare const self: ServiceWorkerGlobalScope;

precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// 푸시 수신 → 잠금화면/배너 알림 표시
self.addEventListener("push", (event: PushEvent) => {
  let data: any = {};
  try {
    data = event.data?.json() ?? {};
  } catch {
    data = { title: "instrut", body: event.data?.text() ?? "" };
  }
  const title = data.title || "instrut";
  const options: NotificationOptions = {
    body: data.body || "",
    icon: data.icon || "/pwa-icon-192.png",
    badge: data.badge || "/pwa-icon-192.png",
    tag: data.tag || "instrut",
    data: { url: data.url || "/" },
    // @ts-ignore vibrate is supported on Android
    vibrate: [120, 60, 120],
    renotify: true,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// 알림 탭 → 앱으로 이동(또는 기존 창 포커스)
self.addEventListener("notificationclick", (event: NotificationEvent) => {
  event.notification.close();
  const targetUrl = (event.notification.data as any)?.url || "/";
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of all) {
      if ("focus" in c) {
        try { await (c as WindowClient).navigate(targetUrl); } catch { /* ignore */ }
        return (c as WindowClient).focus();
      }
    }
    return self.clients.openWindow(targetUrl);
  })());
});
