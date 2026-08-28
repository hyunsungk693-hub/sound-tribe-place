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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// 보안: 알림 제목/본문/링크는 전부 서버가 구성한다. 클라이언트는 type과
// 대상 식별자(userId·postId·jobId)만 넘기고, 발신자 이름은 서버가 조회한다.
// → 임의 문자열 피싱·외부 URL 오픈리다이렉트 불가.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return json({ error: "Unauthorized" }, 401);

    const { type, userId, postId, jobId, status } = await req.json();
    if (!UUID_RE.test(String(userId))) return json({ error: "invalid userId" }, 400);
    if (userId === user.id) return json({ ok: true, skipped: "self" }); // 본인 알림 생략

    const actorName = await senderName(user.id);
    let title = "";
    let body = "";
    let url = "/";

    if (type === "message") {
      // 대화 관계가 있어야만 허용
      const { data: conv } = await supabase.from("conversations").select("id")
        .or(`and(user1_id.eq.${user.id},user2_id.eq.${userId}),and(user1_id.eq.${userId},user2_id.eq.${user.id})`)
        .limit(1).maybeSingle();
      if (!conv) return json({ error: "Forbidden" }, 403);
      title = `💬 ${actorName}`;
      body = "새 메시지가 도착했습니다";
      url = "/messages";
    } else if (type === "like" || type === "comment") {
      // caller가 그 글에 실제로 좋아요·댓글을 남겼고, userId가 그 글의 작성자여야 함
      if (!UUID_RE.test(String(postId))) return json({ error: "invalid postId" }, 400);
      const { data: post } = await supabase.from("posts").select("user_id, title").eq("id", postId).maybeSingle();
      if (!post || post.user_id !== userId) return json({ error: "Forbidden" }, 403);
      const table = type === "like" ? "post_likes" : "post_comments";
      const { data: act } = await supabase.from(table).select("id").eq("post_id", postId).eq("user_id", user.id).limit(1).maybeSingle();
      if (!act) return json({ error: "Forbidden" }, 403);
      title = type === "like" ? `❤️ ${actorName}님이 좋아요` : `💬 ${actorName}님의 댓글`;
      body = String(post.title || "").slice(0, 80);
      url = `/post/${postId}`;
    } else if (type === "new_applicant") {
      // caller가 그 공고에 지원했고, userId가 그 공고 작성자여야 함
      if (!UUID_RE.test(String(jobId))) return json({ error: "invalid jobId" }, 400);
      const { data: job } = await supabase.from("posts").select("user_id, title").eq("id", jobId).maybeSingle();
      if (!job || job.user_id !== userId) return json({ error: "Forbidden" }, 403);
      const { data: app } = await supabase.from("job_applications").select("id").eq("job_id", jobId).eq("user_id", user.id).limit(1).maybeSingle();
      if (!app) return json({ error: "Forbidden" }, 403);
      title = `📩 새 지원자: ${actorName}`;
      body = `"${String(job.title || "").slice(0, 60)}" 공고에 지원했습니다`;
      url = "/jobs";
    } else if (type === "apply_status") {
      // caller가 그 공고 작성자여야 하고, userId는 그 공고의 지원자여야 함
      if (!UUID_RE.test(String(jobId))) return json({ error: "invalid jobId" }, 400);
      const { data: job } = await supabase.from("posts").select("user_id, title").eq("id", jobId).maybeSingle();
      if (!job || job.user_id !== user.id) return json({ error: "Forbidden" }, 403);
      const { data: app } = await supabase.from("job_applications").select("id").eq("job_id", jobId).eq("user_id", userId).limit(1).maybeSingle();
      if (!app) return json({ error: "Forbidden" }, 403);
      const label = status === "accepted" ? "🎉 합격" : status === "rejected" ? "지원 결과" : "지원 상태 변경";
      title = label;
      body = `"${String(job.title || "").slice(0, 60)}" 지원 결과가 도착했습니다`;
      url = "/profile";
    } else {
      return json({ error: "invalid type" }, 400);
    }

    const { data: subs, error } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", userId);
    if (error) throw error;

    const payload = JSON.stringify({
      title, body, url, tag: "instrut",
      icon: "/pwa-icon-192.png", badge: "/pwa-icon-192.png",
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
    if (stale.length) await supabase.from("push_subscriptions").delete().in("id", stale);

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

async function senderName(uid: string): Promise<string> {
  const { data } = await supabase.from("profiles").select("display_name").eq("user_id", uid).maybeSingle();
  return data?.display_name || "instrut";
}
