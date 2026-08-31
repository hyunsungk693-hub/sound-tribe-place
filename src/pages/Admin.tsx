import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAdmin } from "@/hooks/useAdmin";
import BottomNav from "@/components/BottomNav";
import TopNav from "@/components/TopNav";
import CredentialsReview from "@/components/CredentialsReview";
import ReportsReview from "@/components/ReportsReview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Trash2, Pencil, Plus, X, UserPlus, Shield, AlertTriangle } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, Legend, CartesianGrid,
} from "recharts";

type PlaceType = "job" | "room" | "shop";
type Place = {
  id: string;
  type: PlaceType;
  name: string;
  description: string | null;
  address: string | null;
  phone: string | null;
  hours: string | null;
  lat: number;
  lng: number;
};

const typeLabel: Record<PlaceType, string> = { job: "구인구직", room: "연습실", shop: "악기사" };

const placeSchema = z.object({
  type: z.enum(["job", "room", "shop"]),
  name: z.string().trim().min(1, "이름을 입력해주세요").max(100),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  address: z.string().trim().max(200).optional().or(z.literal("")),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  hours: z.string().trim().max(50).optional().or(z.literal("")),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

const empty = {
  type: "job" as PlaceType,
  name: "",
  description: "",
  address: "",
  phone: "",
  hours: "",
  lat: "",
  lng: "",
};

const Admin = () => {
  useDocumentTitle("관리자");
  const { isAdmin, loading } = useAdmin();
  const [places, setPlaces] = useState<Place[]>([]);
  const [form, setForm] = useState<typeof empty>(empty);
  const [editingId, setEditingId] = useState<string | null>(null);
  // 지도 기능이 스코프에서 빠져 상시 업무가 아니다. 등록 폼은 기본으로 접어둔다.
  const [formOpen, setFormOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pendingCreds, setPendingCreds] = useState(0);
  const [pendingReports, setPendingReports] = useState(0);

  const fetchPlaces = async () => {
    const { data } = await supabase.from("places").select("*").order("created_at", { ascending: false });
    if (data) setPlaces(data as Place[]);
  };

  useEffect(() => { if (isAdmin) fetchPlaces(); }, [isAdmin]);

  // 탭을 열지 않아도 대기 건수는 보여야 한다 (Tabs는 비활성 탭을 언마운트한다).
  useEffect(() => {
    if (!isAdmin) return;
    supabase
      .from("profile_credentials" as any)
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
      .then(({ count }) => setPendingCreds(count || 0));
    supabase
      .from("rating_reports" as any)
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
      .then(({ count }) => setPendingReports(count || 0));
  }, [isAdmin]);

  if (loading) return <div className="min-h-app flex items-center justify-center bg-background"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  if (!isAdmin) return <Navigate to="/" replace />;

  const resetForm = () => { setForm(empty); setEditingId(null); };
  // 폼을 접을 때는 입력값도 함께 비운다.
  const closeForm = () => { resetForm(); setFormOpen(false); };
  const openCreateForm = () => { resetForm(); setFormOpen(true); };

  const handleEdit = (p: Place) => {
    setEditingId(p.id);
    setFormOpen(true); // 수정은 이 폼을 쓰므로 접혀 있으면 반드시 펼친다.
    setForm({
      type: p.type,
      name: p.name,
      description: p.description || "",
      address: p.address || "",
      phone: p.phone || "",
      hours: p.hours || "",
      lat: String(p.lat),
      lng: String(p.lng),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("이 장소를 삭제하시겠습니까?")) return;
    const { error } = await supabase.from("places").delete().eq("id", id);
    if (error) return toast.error("삭제 실패");
    toast.success("삭제되었습니다");
    fetchPlaces();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = placeSchema.safeParse({
      ...form,
      lat: parseFloat(form.lat),
      lng: parseFloat(form.lng),
    });
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return toast.error(first.message);
    }
    setSubmitting(true);
    const payload = {
      type: parsed.data.type,
      name: parsed.data.name,
      description: parsed.data.description || null,
      address: parsed.data.address || null,
      phone: parsed.data.phone || null,
      hours: parsed.data.hours || null,
      lat: parsed.data.lat,
      lng: parsed.data.lng,
    };
    let error;
    if (editingId) {
      ({ error } = await supabase.from("places").update(payload).eq("id", editingId));
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      ({ error } = await supabase.from("places").insert({ ...payload, created_by: user?.id }));
    }
    setSubmitting(false);
    if (error) return toast.error(editingId ? "수정 실패" : "등록 실패");
    toast.success(editingId ? "수정되었습니다" : "등록되었습니다");
    closeForm();
    fetchPlaces();
  };

  return (
    <div className="min-h-app bg-background" style={{ paddingBottom: "calc(96px + var(--safe-bottom, 0px))" }}>
      <TopNav />
      <header
        className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b px-4 py-3"
        style={{ paddingTop: "calc(0.75rem + var(--safe-top, 0px))" }}
      >
        <h1 className="text-lg font-bold">관리자</h1>
      </header>

      <Tabs defaultValue="metrics" className="p-4">
        <TabsList className="grid w-full grid-cols-5 mb-4">
          <TabsTrigger value="metrics">지표</TabsTrigger>
          <TabsTrigger value="credentials" className="gap-1">
            증빙 인증
            {pendingCreds > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold tabular-nums">
                {pendingCreds}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="reports" className="gap-1">
            평가 신고
            {pendingReports > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold tabular-nums">
                {pendingReports}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="admins">관리자 권한</TabsTrigger>
          {/* 지도가 없어 상시 운영 업무가 아니다. 맨 뒤로 밀고 라벨도 지도용 데이터임이 드러나게 둔다. */}
          <TabsTrigger
            value="places"
            className="text-muted-foreground/70 data-[state=active]:text-foreground"
          >
            지도 데이터
          </TabsTrigger>
        </TabsList>

        <TabsContent value="metrics" className="mt-0">
          <MetricsPanel />
        </TabsContent>

        <TabsContent value="credentials" className="mt-0">
          <CredentialsReview onPendingCount={setPendingCreds} />
        </TabsContent>

        <TabsContent value="reports" className="mt-0">
          <ReportsReview onPendingCount={setPendingReports} />
        </TabsContent>

        <TabsContent value="places" className="space-y-4 mt-0">
        {/* 지도 기능이 스코프에서 빠진 상태다. 입력한 값이 앱에 안 나온다는 사실을 가장 먼저 알린다. */}
        <div className="rounded-lg border border-amber/30 bg-amber/10 p-3.5">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-amber">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            등록해도 지금은 앱 어디에도 표시되지 않습니다
          </p>
          <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
            지도 기능이 현재 스코프에서 빠져 있어, 여기서 등록한 장소는 사용자 화면에 노출되지 않습니다.
            나중에 지도를 도입할 때 쓰려고 데이터만 미리 쌓아두는 곳입니다.
          </p>
        </div>

        {!formOpen && (
          <Button variant="outline" className="w-full" onClick={openCreateForm}>
            <Plus className="w-4 h-4 mr-2" />
            새 장소 등록
          </Button>
        )}

        {formOpen && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">{editingId ? "장소 수정" : "새 장소 등록"}</h2>
            <Button variant="ghost" size="sm" onClick={closeForm} aria-label="등록 폼 접기">
              <X className="w-4 h-4" />
            </Button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <Label>종류</Label>
              <Select value={form.type} onValueChange={(v: PlaceType) => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="job">구인구직</SelectItem>
                  <SelectItem value="room">연습실</SelectItem>
                  <SelectItem value="shop">악기사</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>이름 *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={100} />
            </div>
            <div>
              <Label>설명</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={500} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>위도(lat) *</Label>
                <Input type="number" step="any" value={form.lat} onChange={(e) => setForm({ ...form, lat: e.target.value })} placeholder="37.5665" />
              </div>
              <div>
                <Label>경도(lng) *</Label>
                <Input type="number" step="any" value={form.lng} onChange={(e) => setForm({ ...form, lng: e.target.value })} placeholder="126.9780" />
              </div>
            </div>
            <div>
              <Label>주소</Label>
              <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} maxLength={200} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>전화번호</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} maxLength={30} />
              </div>
              <div>
                <Label>영업시간</Label>
                <Input value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} maxLength={50} placeholder="10:00 - 22:00" />
              </div>
            </div>
            <Button type="submit" disabled={submitting} className="w-full">
              <Plus className="w-4 h-4 mr-2" />
              {editingId ? "수정 저장" : "등록"}
            </Button>
          </form>
        </Card>
        )}

        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground">쌓아둔 장소 ({places.length})</h2>
          {places.length === 0 && <p className="text-sm text-muted-foreground">아직 등록된 장소가 없습니다.</p>}
          {places.map((p) => (
            <Card key={p.id} className="p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary font-medium">{typeLabel[p.type]}</span>
                    <h3 className="font-semibold truncate">{p.name}</h3>
                  </div>
                  {p.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{p.description}</p>}
                  <p className="text-xs text-muted-foreground mt-1">{p.lat.toFixed(4)}, {p.lng.toFixed(4)}{p.address ? ` · ${p.address}` : ""}</p>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => handleEdit(p)}><Pencil className="w-4 h-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => handleDelete(p.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
        </TabsContent>

        <TabsContent value="admins" className="mt-0">
          <AdminsManager />
        </TabsContent>
      </Tabs>

      <BottomNav />
    </div>
  );
};

type DailyMetric = {
  day: string;
  signups: number;
  job_posts: number;
  room_posts: number;
  community_posts: number;
  promotion_posts: number;
  applications: number;
  new_conversations: number;
  messages_sent: number;
  reservations: number;
};

type Totals = {
  total_users: number;
  total_job_posts: number;
  total_posts: number;
  total_applications: number;
  accepted_applications: number;
  total_conversations: number;
  total_messages: number;
  total_reservations: number;
  weekly_active_users: number;
  weekly_signups: number;
};

const MetricsPanel = () => {
  const [totals, setTotals] = useState<Totals | null>(null);
  const [daily, setDaily] = useState<DailyMetric[]>([]);
  const [adv, setAdv] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [t, d, a] = await Promise.all([
        (supabase as any).rpc("get_hook_totals"),
        (supabase as any).rpc("get_hook_metrics", { days: 30 }),
        (supabase as any).rpc("get_advanced_metrics"),
      ]);
      if (t.error || d.error) {
        toast.error("지표를 불러오지 못했습니다. 마이그레이션이 적용됐는지 확인하세요.");
      } else {
        setTotals(t.data as Totals);
        setDaily((d.data as DailyMetric[]) || []);
        if (!a.error) setAdv(a.data);
      }
      setLoading(false);
    })();
  }, []);

  if (loading) return <p className="text-sm text-muted-foreground py-8 text-center">지표 불러오는 중...</p>;
  if (!totals) return <p className="text-sm text-muted-foreground py-8 text-center">지표를 불러올 수 없습니다.</p>;

  const chartData = daily.map((r) => ({
    ...r,
    label: r.day.slice(5).replace("-", "."),
    posts: r.job_posts + r.room_posts + r.community_posts + r.promotion_posts,
  }));

  const stats: { label: string; value: number; sub?: string }[] = [
    { label: "총 가입", value: totals.total_users, sub: `주간 +${totals.weekly_signups}` },
    { label: "주간 활성", value: totals.weekly_active_users, sub: "최근 7일 활동" },
    { label: "총 게시글", value: totals.total_posts, sub: `구인 ${totals.total_job_posts}` },
    { label: "총 지원", value: totals.total_applications, sub: `수락 ${totals.accepted_applications}` },
    { label: "대화방", value: totals.total_conversations, sub: `메시지 ${totals.total_messages}` },
    { label: "합주실 예약", value: totals.total_reservations },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        {stats.map((s) => (
          <Card key={s.label} className="p-3">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="text-2xl font-bold tabular-nums">{s.value}</p>
            {s.sub && <p className="text-xs text-muted-foreground mt-0.5">{s.sub}</p>}
          </Card>
        ))}
      </div>

      <Card className="p-3">
        <h3 className="text-sm font-semibold mb-2">일별 가입 (30일)</h3>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={chartData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={6} />
            <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="signups" name="가입" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card className="p-3">
        <h3 className="text-sm font-semibold mb-2">일별 활동 (30일)</h3>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chartData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={6} />
            <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="posts" name="글 등록" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="applications" name="지원" stroke="#16a34a" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="new_conversations" name="새 대화" stroke="#d97706" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      {adv && (
        <Card className="p-3">
          <h3 className="text-sm font-semibold mb-2">핵심 지표 (W12 · Kill/Go)</h3>
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2.5 rounded-lg bg-primary/5">
              <p className="text-[11px] text-muted-foreground">NSM · 첫 합주(근사)</p>
              <p className="text-xl font-bold tabular-nums text-primary">{adv.nsm_accepted_matches}</p>
              <p className="text-[10px] text-muted-foreground">주간 +{adv.weekly_accepted_matches} · 수락된 지원</p>
            </div>
            <div className="p-2.5 rounded-lg bg-secondary/50">
              <p className="text-[11px] text-muted-foreground">커뮤 → 구인 전환</p>
              <p className="text-xl font-bold tabular-nums">{adv.community_to_job_rate != null ? `${Math.round(adv.community_to_job_rate * 100)}%` : "–"}</p>
              <p className="text-[10px] text-muted-foreground">{adv.community_to_job_authors}/{adv.community_authors}명</p>
            </div>
            <div className="p-2.5 rounded-lg bg-secondary/50">
              <p className="text-[11px] text-muted-foreground">누적 합주 후기</p>
              <p className="text-xl font-bold tabular-nums">{adv.total_ratings}</p>
              <p className="text-[10px] text-muted-foreground">주간 +{adv.weekly_ratings}{adv.avg_would_again != null ? ` · 재합주 ${Math.round(adv.avg_would_again * 100)}%` : ""}</p>
            </div>
            <div className="p-2.5 rounded-lg bg-secondary/50">
              <p className="text-[11px] text-muted-foreground">파생 예약 비율</p>
              <p className="text-xl font-bold tabular-nums text-muted-foreground">–</p>
              <p className="text-[10px] text-muted-foreground">예약(B) 도입 후 산출</p>
            </div>
          </div>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        방문·체류·재방문 지표는 PostHog 대시보드에서 확인하세요.
      </p>
    </div>
  );
};

type AdminEntry = { user_id: string; email: string | null; created_at: string };

const AdminsManager = () => {
  const [admins, setAdmins] = useState<AdminEntry[]>([]);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("manage-admins", { body: { action: "list" } });
    setLoading(false);
    if (error) return toast.error("관리자 목록 로드 실패");
    setAdmins((data as any)?.admins || []);
  };

  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!email.trim()) return toast.error("이메일을 입력하세요");
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("manage-admins", { body: { action: "add", email: email.trim() } });
    setBusy(false);
    if (error || (data as any)?.error) return toast.error((data as any)?.error || "추가 실패");
    toast.success("관리자로 추가되었습니다");
    setEmail("");
    load();
  };

  const remove = async (targetEmail: string | null) => {
    if (!targetEmail) return toast.error("이메일 정보가 없습니다");
    if (!confirm(`${targetEmail}의 관리자 권한을 해제하시겠습니까?`)) return;
    const { data, error } = await supabase.functions.invoke("manage-admins", { body: { action: "remove", email: targetEmail } });
    if (error || (data as any)?.error) return toast.error((data as any)?.error || "해제 실패");
    toast.success("권한이 해제되었습니다");
    load();
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <h2 className="font-semibold mb-3 flex items-center gap-2"><UserPlus className="w-4 h-4" />관리자 추가</h2>
        <div className="flex gap-2">
          <Input
            type="email"
            placeholder="user@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
          />
          <Button onClick={add} disabled={busy}>추가</Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">해당 이메일로 가입된 사용자가 있어야 합니다.</p>
      </Card>

      <div className="space-y-2">
        <h2 className="font-semibold flex items-center gap-2"><Shield className="w-4 h-4" />현재 관리자 ({admins.length})</h2>
        {loading && <p className="text-sm text-muted-foreground">불러오는 중...</p>}
        {!loading && admins.length === 0 && <p className="text-sm text-muted-foreground">등록된 관리자가 없습니다.</p>}
        {admins.map((a) => (
          <Card key={a.user_id} className="p-3 flex items-center justify-between">
            <div className="min-w-0">
              <p className="font-medium truncate">{a.email || "(이메일 없음)"}</p>
              <p className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleDateString("ko-KR")}</p>
            </div>
            <Button size="icon" variant="ghost" onClick={() => remove(a.email)}>
              <Trash2 className="w-4 h-4 text-destructive" />
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Admin;
