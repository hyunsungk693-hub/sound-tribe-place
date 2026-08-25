// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import webpush from "https://esm.sh/web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@instrut.app";

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const supabase = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // 발신자 신원 확인 (verify_jwt=true라도 명시적으로 검증)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return json({ error: "Unauthorized" }, 401);

    const { userId, title, body, url, tag, icon } = await req.json();
    if (!userId || !title) return json({ error: "userId and title required" }, 400);

    // 자기 자신에게는 보낼 필요 없고, 타인에게는 대화 관계가 있어야만 허용
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_RE.test(String(userId))) return json({ error: "invalid userId" }, 400);
    if (userId !== user.id) {
      const { data: conv } = await supabase
        .from("conversations")
        .select("id")
        .or(`and(user1_id.eq.${user.id},user2_id.eq.${userId}),and(user1_id.eq.${userId},user2_id.eq.${user.id})`)
        .limit(1)
        .maybeSingle();
      if (!conv) return json({ error: "Forbidden: no conversation with target user" }, 403);
    }

    const { data: subs, error } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", userId);
    if (error) throw error;

    const payload = JSON.stringify({
      title,
      body: body ?? "",
      url: url ?? "/",
      tag: tag ?? "instrut",
      icon: icon ?? "/pwa-icon-192.png",
      badge: "/pwa-icon-192.png",
    });

    const stale: string[] = [];
    const results = await Promise.allSettled(
      (subs ?? []).map((s: any) =>
        webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
        ).catch((err: any) => {
          if (err?.statusCode === 404 || err?.statusCode === 410) stale.push(s.id);
          throw err;
        })
      ),
    );

    if (stale.length) {
      await supabase.from("push_subscriptions").delete().in("id", stale);
    }

    return json({
      sent: results.filter(r => r.status === "fulfilled").length,
      failed: results.filter(r => r.status === "rejected").length,
      removed: stale.length,
    });
  } catch (e: any) {
    console.error("send-push error", e);
    return json({ error: e?.message ?? String(e) }, 500);
  }
});
