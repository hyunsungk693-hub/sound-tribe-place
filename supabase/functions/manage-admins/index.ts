import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller is an admin
    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: roleRow } = await admin.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json();
    const action = body.action as "list" | "add" | "remove";

    if (action === "list") {
      const { data: roles } = await admin.from("user_roles").select("user_id, role, created_at").eq("role", "admin").order("created_at", { ascending: false });
      const result: any[] = [];
      for (const r of roles || []) {
        const { data: u } = await admin.auth.admin.getUserById(r.user_id);
        result.push({ user_id: r.user_id, email: u.user?.email || null, created_at: r.created_at });
      }
      return new Response(JSON.stringify({ admins: result }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "add" || action === "remove") {
      const email = String(body.email || "").trim().toLowerCase();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return new Response(JSON.stringify({ error: "이메일 형식이 올바르지 않습니다" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      // Find user by email (paginate up to 1000)
      let foundId: string | null = null;
      let page = 1;
      while (page <= 10 && !foundId) {
        const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 });
        if (error) break;
        const match = data.users.find((u) => (u.email || "").toLowerCase() === email);
        if (match) foundId = match.id;
        if (data.users.length < 100) break;
        page++;
      }
      if (!foundId) {
        return new Response(JSON.stringify({ error: "해당 이메일의 사용자를 찾을 수 없습니다" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (action === "add") {
        const { error } = await admin.from("user_roles").insert({ user_id: foundId, role: "admin" });
        if (error && !error.message.includes("duplicate")) {
          return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      } else {
        if (foundId === user.id) {
          return new Response(JSON.stringify({ error: "본인의 관리자 권한은 해제할 수 없습니다" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        const { error } = await admin.from("user_roles").delete().eq("user_id", foundId).eq("role", "admin");
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
