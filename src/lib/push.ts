import { supabase } from "@/integrations/supabase/client";

// VAPID 공개 키 (서버의 VAPID_PUBLIC_KEY 시크릿과 동일해야 함)
export const VAPID_PUBLIC_KEY =
  (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined) ||
  "BLG5Ws48HgMZY7wjUgqLwmN3ane7FDcex2TOs90v4nnINrRxseWOLlCaVdESwwMw0NRdeF-96UfwtOJLnAMvro0";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export const isPushSupported = () =>
  typeof window !== "undefined" &&
  "serviceWorker" in navigator &&
  "PushManager" in window &&
  "Notification" in window;

export const getPushPermission = (): NotificationPermission =>
  isPushSupported() ? Notification.permission : "denied";

export async function enablePushNotifications(userId: string): Promise<{ ok: boolean; reason?: string }> {
  if (!isPushSupported()) return { ok: false, reason: "이 기기/브라우저는 푸시 알림을 지원하지 않습니다." };

  const reg = await navigator.serviceWorker.ready;

  let permission = Notification.permission;
  if (permission === "default") permission = await Notification.requestPermission();
  if (permission !== "granted") return { ok: false, reason: "알림 권한이 거부되었습니다." };

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY).buffer as ArrayBuffer,
    });
  }

  const json = sub.toJSON();
  const endpoint = json.endpoint!;
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  if (!p256dh || !auth) return { ok: false, reason: "구독 키 생성에 실패했습니다." };

  const { error } = await supabase
    .from("push_subscriptions")
    .upsert(
      { user_id: userId, endpoint, p256dh, auth, user_agent: navigator.userAgent },
      { onConflict: "endpoint" },
    );
  if (error) return { ok: false, reason: error.message };
  return { ok: true };
}

export async function disablePushNotifications() {
  if (!isPushSupported()) return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (sub) {
    const ep = sub.endpoint;
    await sub.unsubscribe();
    await supabase.from("push_subscriptions").delete().eq("endpoint", ep);
  }
}

export async function sendPushTo(params: {
  userId: string;
  title: string;
  body?: string;
  url?: string;
  tag?: string;
}) {
  try {
    await supabase.functions.invoke("send-push", { body: params });
  } catch (e) {
    console.warn("[push] send failed", e);
  }
}
