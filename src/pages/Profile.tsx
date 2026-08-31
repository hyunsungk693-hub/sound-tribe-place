import { useEffect, useState } from "react";
import { ChevronRight, Edit3, Shield, HelpCircle, LogOut, Trash2, Calendar, MapPin, Users, Clock, History, IdCard, Star, CalendarHeart, Flag } from "lucide-react";
import { toast } from "sonner";
import PageShell from "@/components/PageShell";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import ProfileEditModal from "@/components/ProfileEditModal";
import RatingDialog from "@/components/RatingDialog";
import { getRecentViews, RecentView } from "@/lib/recentViews";
import { useAdmin } from "@/hooks/useAdmin";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

interface Profile {
  display_name: string | null;
  location: string | null;
  instruments: string[] | null;
  genres: string[] | null;
  bio: string | null;
  avatar_url: string | null;
  video_url?: string | null;
  purpose?: string | null;
  available_times?: string[] | null;
  handle?: string | null;
}

const menuItems = [
  { icon: Shield, label: "개인정보 보호" },
  { icon: HelpCircle, label: "고객센터" },
];

const activityTabs = ["내 게시물", "최근 본"];

const APPLY_STATUS_META: Record<string, { label: string; cls: string }> = {
  applied: { label: "검토중", cls: "bg-primary/10 text-primary" },
  reviewing: { label: "검토중", cls: "bg-primary/10 text-primary" },
  accepted: { label: "합격", cls: "bg-green-500/10 text-green-600" },
  rejected: { label: "불합격", cls: "bg-destructive/10 text-destructive" },
};

// VU 미터 — 세그먼트 게이지 (0~1). 홈(Index)과 동일 패턴.
const VuMeter = ({ level, segs = 12 }: { level: number; segs?: number }) => {
  const on = Math.max(0, Math.min(segs, Math.round(level * segs)));
  return (
    <div className="flex items-center gap-[3px]" aria-hidden>
      {Array.from({ length: segs }).map((_, i) => (
        <span
          key={i}
          className={`w-[3px] h-3.5 rounded-[1px] ${
            i < on ? (i >= segs - 2 ? "bg-amber" : "bg-primary") : "bg-border"
          }`}
        />
      ))}
    </div>
  );
};


const ProfilePage = () => {
  useDocumentTitle("프로필");
  const { user, signOut } = useAuth();
  const { isAdmin } = useAdmin();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [activeTab, setActiveTab] = useState("내 게시물");
  const [myPosts, setMyPosts] = useState<any[]>([]);
  const [myReservations, setMyReservations] = useState<any[]>([]);
  const [myBookings, setMyBookings] = useState<any[]>([]);
  const [myApplications, setMyApplications] = useState<any[]>([]);
  const [instrutTab, setInstrutTab] = useState<"apply" | "reserve">("apply");
  // 작업 2 이의 제기: 내가 받은 평가와 신고 폼
  const [myRatings, setMyRatings] = useState<any[]>([]);
  const [reportTarget, setReportTarget] = useState<any>(null);
  const [reportReason, setReportReason] = useState("");
  const [reporting, setReporting] = useState(false);
  const [cancelAppTarget, setCancelAppTarget] = useState<any | null>(null);
  const [cancellingApp, setCancellingApp] = useState(false);
  const [ratingTarget, setRatingTarget] = useState<{ id: string; name: string; appId: string } | null>(null);
  const [myStats, setMyStats] = useState<any | null>(null);
  const [recentViews] = useState<RecentView[]>(() => getRecentViews());
  const [editOpen, setEditOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<any | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [detailTarget, setDetailTarget] = useState<any | null>(null);
  const [paidDetail, setPaidDetail] = useState<any | null>(null);

  const fetchReservations = async () => {
    if (!user) return;
    const { data: rsv } = await supabase
      .from("room_reservations" as any)
      .select("*")
      .eq("user_id", user.id)
      .order("start_at", { ascending: false });
    const rsvList = (rsv as any[]) || [];
    const roomIds = Array.from(new Set(rsvList.map((r) => r.room_id))).filter(Boolean);
    let roomsById: Record<string, any> = {};
    if (roomIds.length > 0) {
      const { data: rooms } = await supabase
        .from("posts")
        .select("id,title,venue,area,lat,lng")
        .in("id", roomIds);
      (rooms || []).forEach((p: any) => { roomsById[p.id] = p; });
    }
    setMyReservations(rsvList.map((r) => {
      const room = roomsById[r.room_id];
      return {
        ...r,
        room_title: room?.title || room?.venue || "삭제된 연습실",
        room_address: room?.area || room?.venue || "",
        room_lat: room?.lat ?? null,
        room_lng: room?.lng ?? null,
      };
    }));
  };

  const confirmCancel = async () => {
    if (!cancelTarget) return;
    if (!cancelReason.trim()) {
      toast.error("취소 사유를 입력해주세요");
      return;
    }
    setCancelling(true);
    const { error } = await supabase.from("room_reservations" as any).delete().eq("id", cancelTarget.id);
    setCancelling(false);
    if (error) { toast.error("취소 실패"); return; }
    toast.success(`예약이 취소되었습니다 (사유: ${cancelReason.trim()})`);
    setCancelTarget(null);
    setCancelReason("");
    await fetchReservations();
  };

  const fetchApplications = async () => {
    if (!user) return;
    const { data: apps } = await supabase
      .from("job_applications" as any)
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    const list = (apps as any[]) || [];
    const jobIds = Array.from(new Set(list.map((a) => a.job_id))).filter(Boolean);
    let jobsById: Record<string, any> = {};
    if (jobIds.length > 0) {
      const { data: jobs } = await supabase
        .from("posts")
        .select("id,title,venue,pay,category,user_id,author_name")
        .in("id", jobIds);
      (jobs || []).forEach((j: any) => { jobsById[j.id] = j; });
    }
    setMyApplications(list.map((a) => ({ ...a, job: jobsById[a.job_id] || null })));
  };

  const confirmCancelApplication = async () => {
    if (!cancelAppTarget) return;
    setCancellingApp(true);
    const { error } = await supabase.from("job_applications" as any).delete().eq("id", cancelAppTarget.id);
    setCancellingApp(false);
    if (error) { toast.error("지원 취소에 실패했습니다"); return; }
    toast.success("지원이 취소되었습니다");
    setCancelAppTarget(null);
    await fetchApplications();
  };

  // 최근 본 게시물 → 유형별 목록/상세로 이동
  const openRecent = (v: RecentView) => {
    if (v.type === "job") navigate("/jobs");
    else if (v.type === "room") navigate("/rooms");
    else if (v.type === "shop") navigate("/shops");
    else navigate(`/post/${v.id}`);
  };

  const typeLabel = (t: string) =>
    t === "job" ? "구인" : t === "room" ? "연습실" : t === "shop" ? "악기사" : "커뮤니티";

  const fetchMyRatings = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("peer_ratings" as any)
      .select("*")
      .eq("ratee_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);
    const list = (data as any[]) || [];
    const raterIds = Array.from(new Set(list.map((r) => r.rater_id)));
    let nameById: Record<string, string> = {};
    if (raterIds.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", raterIds);
      (profs || []).forEach((pr: any) => { nameById[pr.user_id] = pr.display_name || "익명"; });
    }
    setMyRatings(list.map((r) => ({ ...r, raterName: nameById[r.rater_id] || "익명" })));
  };

  const submitReport = async () => {
    if (!user || !reportTarget || !reportReason.trim()) return;
    setReporting(true);
    const { error } = await supabase.from("rating_reports" as any).insert({
      rating_id: reportTarget.id,
      reporter_id: user.id,
      reason: reportReason.trim(),
    } as any);
    setReporting(false);
    if (error) {
      toast.error(error.code === "23505" ? "이미 신고한 평가입니다" : "신고에 실패했습니다");
      return;
    }
    toast.success("신고가 접수되었습니다. 확인 전까지 이 평가는 등급 산정에서 제외됩니다.");
    setReportTarget(null);
    setReportReason("");
    fetchMyRatings();
  };

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setProfile(data);
      });

    // Fetch my posts
    supabase
      .from("posts")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => setMyPosts(data || []));

    // 내가 받은 평가 (이의 제기 대상)
    fetchMyRatings();

    // Fetch my room reservations (with room title)
    fetchReservations();
    fetchApplications();

    fetchPaidBookings();

    // 신뢰 지표(D3): 내 프로필에도 응답률·재합주율 등을 노출
    (supabase as any)
      .from("user_stats")
      .select("response_rate, median_response_h, sessions_count, partners_count, rehire_rate, no_show_count")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }: any) => setMyStats(data || null));
  }, [user]);

  // 제휴 연습실 유료 예약 (bookings) + 배정 PIN
  const fetchPaidBookings = async () => {
    if (!user) return;
    const { data } = await (supabase as any)
      .from("bookings")
      .select("*, rooms(name, studios(name, address)), door_pins(pin)")
      .eq("user_id", user.id)
      .in("status", ["held", "confirmed", "completed", "no_show"])
      .order("created_at", { ascending: false });
    setMyBookings((data as any[]) || []);
  };

  const handleLogout = async () => {
    await signOut();
    navigate("/auth");
  };

  const displayName = profile?.display_name || user?.email || "사용자";
  const initials = displayName.charAt(0).toUpperCase();
  const instruments = profile?.instruments?.length ? profile.instruments : ["악기를 추가해주세요"];
  const genres = profile?.genres?.length ? profile.genres : ["장르를 추가해주세요"];

  return (
    <PageShell title="프로필">
      <div className="lg:grid lg:grid-cols-[340px_1fr] lg:gap-6 lg:items-start">
      {/* ── LEFT: 정체성 · 신뢰 · 악기 ── */}
      <div className="space-y-4 lg:sticky lg:top-24">
        {/* 정체성 */}
        <div className="glass-card p-5" style={{ animation: "reveal 0.6s cubic-bezier(0.16,1,0.3,1) both" }}>
          <div className="flex items-center gap-4 mb-4">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="avatar" className="w-16 h-16 rounded-lg object-cover" />
            ) : (
              <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-2xl font-extrabold text-primary">
                {initials}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-extrabold tracking-tight truncate">{displayName}</h2>
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1 truncate">
                <MapPin className="w-3 h-3 shrink-0" />{profile?.location || "위치를 설정해주세요"}
              </p>
            </div>
          </div>

          {profile?.bio && (
            <p className="text-sm text-muted-foreground mb-4 leading-relaxed">{profile.bio}</p>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => {
                const h = (profile as any)?.handle;
                if (h) navigate(`/u/${h}/card`);
                else { toast.error("먼저 프로필 편집에서 핸들을 설정해주세요"); setEditOpen(true); }
              }}
              className="flex-1 h-9 rounded-lg bg-secondary text-secondary-foreground flex items-center justify-center gap-1.5 text-xs font-semibold hover:bg-surface-hover transition-colors active:scale-[0.98]"
            >
              <IdCard className="w-4 h-4" /> 소개 카드
            </button>
            <button
              onClick={() => setEditOpen(true)}
              className="flex-1 h-9 rounded-lg bg-secondary text-secondary-foreground flex items-center justify-center gap-1.5 text-xs font-semibold hover:bg-surface-hover transition-colors active:scale-[0.98]"
            >
              <Edit3 className="w-4 h-4" /> 프로필 편집
            </button>
          </div>
        </div>

        {/* 신뢰 지표 — VU 게이지 */}
        {(() => {
          if (!myStats) return null;
          const hasRate = myStats.response_rate != null || myStats.rehire_rate != null;
          const hasCount = myStats.sessions_count > 0 || myStats.partners_count > 0;
          if (!hasRate && !hasCount) return null;
          return (
            <div className="glass-card p-5" style={{ animation: "reveal 0.6s cubic-bezier(0.16,1,0.3,1) 0.06s both" }}>
              <p className="mono-label mb-4">신뢰 지표</p>
              {hasRate && (
                <div className="space-y-3.5">
                  {myStats.response_rate != null && (
                    <div>
                      <div className="flex justify-between items-baseline mb-1.5">
                        <span className="mono-label">응답률</span>
                        <span className="font-mono font-bold text-sm tabular-nums">{Math.round(myStats.response_rate * 100)}%</span>
                      </div>
                      <VuMeter level={myStats.response_rate} />
                    </div>
                  )}
                  {myStats.rehire_rate != null && (
                    <div>
                      <div className="flex justify-between items-baseline mb-1.5">
                        <span className="mono-label">재합주율</span>
                        <span className="font-mono font-bold text-sm tabular-nums">{Math.round(myStats.rehire_rate * 100)}%</span>
                      </div>
                      <VuMeter level={myStats.rehire_rate} />
                    </div>
                  )}
                </div>
              )}
              {hasCount && (
                <div className={`grid grid-cols-2 gap-3 ${hasRate ? "mt-4 pt-4 border-t border-border" : ""}`}>
                  {myStats.sessions_count > 0 && (
                    <div>
                      <p className="font-mono text-2xl font-extrabold tabular-nums leading-none">{myStats.sessions_count}<span className="text-xs text-muted-foreground font-sans ml-0.5">회</span></p>
                      <p className="mono-label mt-1.5">합주</p>
                    </div>
                  )}
                  {myStats.partners_count > 0 && (
                    <div>
                      <p className="font-mono text-2xl font-extrabold tabular-nums leading-none">{myStats.partners_count}<span className="text-xs text-muted-foreground font-sans ml-0.5">명</span></p>
                      <p className="mono-label mt-1.5">함께한 음악인</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })()}

        {/* 악기 · 장르 */}
        <div className="glass-card p-5" style={{ animation: "reveal 0.6s cubic-bezier(0.16,1,0.3,1) 0.1s both" }}>
          <div className="mb-4">
            <p className="mono-label mb-2.5">악기 · Instruments</p>
            <div className="flex flex-wrap gap-1.5">
              {instruments.map((inst) => (
                <span key={inst} className="text-[12px] font-semibold px-2.5 py-1 rounded-md bg-primary/10 text-primary">
                  {inst}
                </span>
              ))}
            </div>
          </div>
          <div>
            <p className="mono-label mb-2.5">장르 · Genres</p>
            <div className="flex flex-wrap gap-1.5">
              {genres.map((genre) => (
                <span key={genre} className="text-[12px] font-semibold px-2.5 py-1 rounded-md bg-secondary text-secondary-foreground">
                  {genre}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>{/* /left column */}

      {/* ── RIGHT: 나의 INSTRUT · 활동 · 설정 ── */}
      <div className="space-y-4 mt-4 lg:mt-0">

      {/* 나의 INSTRUT: 지원현황 · 예약현황 */}
      <div className="glass-card overflow-hidden" style={{ animation: "reveal 0.6s cubic-bezier(0.16,1,0.3,1) 0.1s both" }}>
        <div className="px-5 pt-5 pb-3">
          <h3 className="text-lg font-extrabold tracking-tight">
            나의 <span className="text-primary">INSTRUT</span>
          </h3>
        </div>
        <div className="flex border-b border-border/40">
          {([["apply", `지원현황 (${myApplications.length})`], ["reserve", `예약현황 (${myBookings.length + myReservations.length})`]] as ["apply" | "reserve", string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setInstrutTab(key)}
              className={`flex-1 py-2.5 text-xs font-medium transition-colors ${
                instrutTab === key
                  ? "text-primary border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="p-3 space-y-2 max-h-[300px] overflow-y-auto">
          {instrutTab === "apply" ? (
            myApplications.length > 0 ? (
              myApplications.map((a) => {
                const meta = APPLY_STATUS_META[a.status] || APPLY_STATUS_META.applied;
                const cancellable = a.status === "applied" || a.status === "reviewing";
                return (
                  <div
                    key={a.id}
                    onClick={() => a.job_id ? navigate(`/post/${a.job_id}`) : navigate("/jobs")}
                    className="p-3 rounded-xl bg-secondary/50 hover:bg-surface-hover cursor-pointer transition-colors active:scale-[0.98]"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${meta.cls}`}>
                        {meta.label}
                      </span>
                      {a.job?.category && (
                        <span className="text-[10px] text-muted-foreground">{a.job.category}</span>
                      )}
                      <span className="text-[10px] text-muted-foreground ml-auto">
                        {new Date(a.created_at).toLocaleDateString("ko-KR")}
                      </span>
                      {cancellable && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setCancelAppTarget(a); }}
                          className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                        >
                          <Trash2 className="w-3 h-3" /> 지원 취소
                        </button>
                      )}
                    </div>
                    <h4 className="text-sm font-semibold truncate">{a.job?.title || "삭제된 공고"}</h4>
                    {a.job?.venue && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{a.job.venue}{a.job.pay ? ` · ${a.job.pay}` : ""}</p>
                    )}

                    {a.status === "accepted" && (
                      <div className="mt-2 flex flex-col gap-1.5">
                        <button
                          onClick={(e) => { e.stopPropagation(); navigate(`/first-rehearsal/${a.id}`); }}
                          className="w-full h-9 rounded-lg bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-primary/15 active:scale-[0.98] transition-all"
                        >
                          <CalendarHeart className="w-3.5 h-3.5" /> 첫 합주 잡기
                        </button>
                        {a.job?.user_id && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setRatingTarget({ id: a.job.user_id, name: a.job?.author_name || "공고 작성자", appId: a.id }); }}
                            className="inline-flex items-center justify-center gap-1 h-7 px-2.5 rounded-lg bg-secondary text-secondary-foreground text-[11px] font-medium hover:bg-surface-hover transition-colors"
                          >
                            <Star className="w-3 h-3" /> 합주 후기 남기기
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <p className="text-xs text-muted-foreground text-center py-6">지원 내역이 없습니다.</p>
            )
          ) : (
            (myBookings.length > 0 || myReservations.length > 0) ? (
              <>
              {myBookings.map((b) => {
                const [start] = (b.period || "").replace(/[[)"]/g, "").split(",");
                const startD = start ? new Date(start.trim()) : null;
                const pin = b.door_pins?.pin || (Array.isArray(b.door_pins) ? b.door_pins[0]?.pin : null);
                const stMap: Record<string, string> = { held: "결제대기", confirmed: "확정", completed: "이용완료", no_show: "노쇼" };
                return (
                  <div
                    key={b.id}
                    onClick={() => setPaidDetail({ ...b, _pin: pin, _startD: startD })}
                    className="p-3 rounded-xl bg-primary/5 border border-primary/20 hover:bg-primary/10 cursor-pointer transition-colors active:scale-[0.98]"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">제휴예약</span>
                      <span className="text-[10px] text-muted-foreground">{stMap[b.status] || b.status}</span>
                      <span className="text-[10px] text-muted-foreground ml-auto">{(b.amount || 0).toLocaleString("ko-KR")}원</span>
                    </div>
                    <h4 className="text-sm font-semibold truncate">{b.rooms?.studios?.name || "연습실"} · {b.rooms?.name || ""}</h4>
                    {startD && <p className="text-xs text-muted-foreground mt-0.5">{startD.toLocaleString("ko-KR", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p>}
                    {b.status === "confirmed" && pin && (
                      <p className="text-xs mt-1">도어락 PIN <span className="font-bold tracking-widest">{pin}</span></p>
                    )}
                  </div>
                );
              })}
              {myReservations.map((r) => {
                const s = new Date(r.start_at);
                const e = new Date(r.end_at);
                const fmtT = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
                const upcoming = e.getTime() > Date.now();
                return (
                  <div
                    key={r.id}
                    onClick={() => setDetailTarget(r)}
                    className="p-3 rounded-xl bg-secondary/50 hover:bg-surface-hover cursor-pointer transition-colors active:scale-[0.98]"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Calendar className="w-3 h-3 text-primary" />
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${upcoming ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                        {upcoming ? "예정" : "지난 예약"}
                      </span>
                      <span className="text-[10px] text-muted-foreground ml-auto">
                        {s.toLocaleDateString("ko-KR")}
                      </span>
                      {upcoming && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setCancelTarget(r); setCancelReason(""); }}
                          className="p-1 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <h4 className="text-sm font-semibold truncate">{r.room_title}</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">{fmtT(s)} - {fmtT(e)}</p>
                  </div>
                );
              })}
              </>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-6">예약 내역이 없습니다.</p>
            )
          )}
        </div>
      </div>

      {/* 받은 평가 — 이의 제기 창구 (작업 2) */}
      {myRatings.length > 0 && (
        <div className="glass-card overflow-hidden" style={{ animation: "reveal 0.6s cubic-bezier(0.16,1,0.3,1) 0.105s both" }}>
          <div className="px-5 pt-5 pb-3">
            <h3 className="text-lg font-extrabold tracking-tight">받은 평가 ({myRatings.length})</h3>
            <p className="text-[11px] text-muted-foreground mt-1">
              사실과 다른 평가는 신고할 수 있습니다. 신고된 평가는 확인 전까지 등급 산정에서 제외됩니다.
            </p>
          </div>
          <div className="p-3 pt-0 space-y-2 max-h-[300px] overflow-y-auto">
            {myRatings.map((r) => (
              <div key={r.id} className="p-3 rounded-xl bg-secondary/50">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold truncate">{r.raterName}</span>
                  <span className="font-mono text-[10px] text-muted-foreground shrink-0">
                    {new Date(r.created_at).toLocaleDateString("ko-KR")}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {/* 후기 항목은 예/아니오/무응답 3상태다(20260901000016). 미선택을 false로
                      그리면 상대가 하지 않은 "아니오" 답을 만들어내게 되므로 따로 표시한다. */}
                  {([["약속 지킴", r.kept_promise], ["실력 일치", r.skill_matched], ["또 하고 싶음", r.would_again]] as [string, boolean | null][]).map(([label, ans]) => (
                    <span
                      key={label}
                      className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                        ans === true
                          ? "bg-signal/15 text-signal"
                          : ans === false
                            ? "bg-negative text-negative-foreground"
                            : "bg-muted text-muted-foreground/70"
                      }`}
                    >
                      {ans === true ? "\u2713" : ans === false ? "\u2717" : "\u2013"} {label}
                    </span>
                  ))}
                </div>
                <div className="mt-2 flex justify-end">
                  {r.disputed ? (
                    <span className="text-[10px] font-medium text-muted-foreground">신고 접수됨 · 산정 제외 중</span>
                  ) : (
                    <button
                      onClick={() => { setReportTarget(r); setReportReason(""); }}
                      className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Flag className="w-3 h-3" /> 신고
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* My Activity */}
      <div className="glass-card overflow-hidden" style={{ animation: "reveal 0.6s cubic-bezier(0.16,1,0.3,1) 0.11s both" }}>
        <div className="flex border-b border-border/40">
          {activityTabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 text-xs font-medium transition-colors ${
                activeTab === tab
                  ? "text-primary border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab} ({tab === "내 게시물" ? myPosts.length : recentViews.length})
            </button>
          ))}
        </div>

        <div className="p-3 space-y-2 max-h-[300px] overflow-y-auto">
          {activeTab === "내 게시물" ? (
            myPosts.length > 0 ? (
              myPosts.map((post) => (
                <div
                  key={post.id}
                  onClick={() => navigate(post.post_type === "community" ? "/community" : post.post_type === "job" ? "/jobs" : "/rooms")}
                  className="p-3 rounded-xl bg-secondary/50 hover:bg-surface-hover cursor-pointer transition-colors active:scale-[0.98]"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                      {post.post_type === "community" ? "커뮤니티" : post.post_type === "job" ? "구인" : "연습실"}
                    </span>
                    {post.category && (
                      <span className="text-[10px] text-muted-foreground">{post.category}</span>
                    )}
                    <span className="text-[10px] text-muted-foreground ml-auto">
                      {new Date(post.created_at).toLocaleDateString("ko-KR")}
                    </span>
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (!confirm("정말 삭제하시겠습니까?")) return;
                        const { error } = await supabase.from("posts").delete().eq("id", post.id);
                        if (error) { toast.error("삭제에 실패했습니다"); return; }
                        toast.success("게시물이 삭제되었습니다");
                        setMyPosts((prev) => prev.filter((p) => p.id !== post.id));
                      }}
                      className="p-1 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <h4 className="text-sm font-semibold truncate">{post.title}</h4>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{post.content}</p>
                </div>
              ))
            ) : (
              <p className="text-xs text-muted-foreground text-center py-6">작성한 게시물이 없습니다.</p>
            )
          ) : (
            recentViews.length > 0 ? (
              recentViews.map((v) => (
                <div
                  key={v.id}
                  onClick={() => openRecent(v)}
                  className="p-3 rounded-xl bg-secondary/50 hover:bg-surface-hover cursor-pointer transition-colors active:scale-[0.98]"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <History className="w-3 h-3 text-muted-foreground" />
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                      {typeLabel(v.type)}
                    </span>
                    <span className="text-[10px] text-muted-foreground ml-auto">
                      {new Date(v.at).toLocaleDateString("ko-KR")}
                    </span>
                  </div>
                  <h4 className="text-sm font-semibold truncate">{v.title}</h4>
                </div>
              ))
            ) : (
              <p className="text-xs text-muted-foreground text-center py-6">최근 본 게시물이 없습니다.</p>
            )
          )}
        </div>
      </div>

      {/* Menu */}
      <div className="glass-card overflow-hidden" style={{ animation: "reveal 0.6s cubic-bezier(0.16,1,0.3,1) 0.16s both" }}>
        {menuItems.map(({ icon: Icon, label }, i, arr) => (
          <button
            key={label}
            className={`w-full flex items-center gap-3 px-5 py-4 hover:bg-surface-hover transition-colors active:scale-[0.99] text-left ${
              i < arr.length - 1 ? "border-b border-border" : ""
            }`}
          >
            <Icon className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium flex-1">{label}</span>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
        ))}
      </div>

      {/* Admin link */}
      {isAdmin && (
        <button
          onClick={() => navigate("/admin")}
          className="w-full py-3 text-sm font-semibold text-primary border border-border hover:border-primary rounded-lg transition-colors active:scale-[0.98] flex items-center justify-center gap-2"
        >
          <Shield className="w-4 h-4" />
          관리자 페이지
        </button>
      )}

      {/* Logout */}
      <button
        onClick={handleLogout}
        className="w-full py-3 text-sm font-semibold text-destructive hover:bg-destructive/5 border border-border hover:border-destructive/40 rounded-lg transition-colors active:scale-[0.98]"
      >
        <span className="flex items-center justify-center gap-2">
          <LogOut className="w-4 h-4" />
          로그아웃
        </span>
      </button>
      </div>{/* /right column */}
      </div>{/* /grid */}

      {editOpen && profile && user && (
        <ProfileEditModal
          userId={user.id}
          profile={profile}
          onClose={() => setEditOpen(false)}
          onSaved={(updated) => setProfile(updated)}
        />
      )}

      <Dialog open={!!cancelTarget} onOpenChange={(o) => { if (!o) { setCancelTarget(null); setCancelReason(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>예약 취소</DialogTitle>
            <DialogDescription>
              {cancelTarget && (
                <>
                  <span className="block font-medium text-foreground">{cancelTarget.room_title}</span>
                  <span className="block text-xs mt-1">
                    {new Date(cancelTarget.start_at).toLocaleString("ko-KR")} ~ {new Date(cancelTarget.end_at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-xs font-medium">취소 사유 <span className="text-destructive">*</span></label>
            <Textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="취소 사유를 입력해주세요"
              rows={3}
            />
          </div>
          <DialogFooter>
            <button
              onClick={() => { setCancelTarget(null); setCancelReason(""); }}
              disabled={cancelling}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-secondary text-secondary-foreground hover:bg-surface-hover transition-colors"
            >
              닫기
            </button>
            <button
              onClick={confirmCancel}
              disabled={cancelling || !cancelReason.trim()}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-destructive text-destructive-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {cancelling ? "취소 중..." : "예약 취소"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detailTarget} onOpenChange={(o) => { if (!o) setDetailTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>예약 상세</DialogTitle>
          </DialogHeader>
          {detailTarget && (() => {
            const s = new Date(detailTarget.start_at);
            const e = new Date(detailTarget.end_at);
            const now = Date.now();
            const status = e.getTime() < now ? { label: "완료", cls: "bg-muted text-muted-foreground" }
              : s.getTime() <= now ? { label: "이용 중", cls: "bg-green-500/10 text-green-600" }
              : { label: "예정", cls: "bg-primary/10 text-primary" };
            const fmtT = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
            return (
              <div className="space-y-3 text-sm">
                <div>
                  <h3 className="font-semibold text-base">{detailTarget.room_title}</h3>
                  <span className={`inline-block mt-1.5 text-[10px] font-medium px-2 py-0.5 rounded-full ${status.cls}`}>
                    {status.label}
                  </span>
                </div>
                <div className="flex items-start gap-2 text-muted-foreground">
                  <MapPin className="w-4 h-4 mt-0.5 shrink-0" />
                  <span className="text-xs">{detailTarget.room_address || "주소 정보 없음"}</span>
                </div>
                <div className="flex items-start gap-2 text-muted-foreground">
                  <Calendar className="w-4 h-4 mt-0.5 shrink-0" />
                  <span className="text-xs">{s.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "short" })}</span>
                </div>
                <div className="flex items-start gap-2 text-muted-foreground">
                  <Clock className="w-4 h-4 mt-0.5 shrink-0" />
                  <span className="text-xs">{fmtT(s)} ~ {fmtT(e)}</span>
                </div>
                <div className="flex items-start gap-2 text-muted-foreground">
                  <Users className="w-4 h-4 mt-0.5 shrink-0" />
                  <span className="text-xs">{detailTarget.note || "인원 정보 없음"}</span>
                </div>
                {detailTarget.room_lat != null && detailTarget.room_lng != null ? (
                  <div className="space-y-2 pt-1">
                    <div className="rounded-xl overflow-hidden border border-border/40">
                      <iframe
                        title="연습실 위치"
                        src={`https://www.openstreetmap.org/export/embed.html?bbox=${detailTarget.room_lng - 0.005},${detailTarget.room_lat - 0.003},${detailTarget.room_lng + 0.005},${detailTarget.room_lat + 0.003}&layer=mapnik&marker=${detailTarget.room_lat},${detailTarget.room_lng}`}
                        className="w-full h-44 border-0"
                        loading="lazy"
                      />
                    </div>
                    <div className="flex gap-2">
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${detailTarget.room_lat},${detailTarget.room_lng}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 text-center px-3 py-2 text-xs font-medium rounded-lg bg-action text-action-foreground hover:opacity-90 transition-opacity"
                      >
                        Google 지도 길찾기
                      </a>
                      <a
                        href={`https://map.naver.com/p/directions/-/${detailTarget.room_lng},${detailTarget.room_lat},${encodeURIComponent(detailTarget.room_title)}/-/transit`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 text-center px-3 py-2 text-xs font-medium rounded-lg bg-secondary text-secondary-foreground hover:bg-surface-hover transition-colors"
                      >
                        네이버 지도 길찾기
                      </a>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground pt-1">위치 좌표가 등록되어 있지 않습니다.</p>
                )}
              </div>
            );
          })()}
          <DialogFooter>
            <button
              onClick={() => setDetailTarget(null)}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-secondary text-secondary-foreground hover:bg-surface-hover transition-colors"
            >
              닫기
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 제휴(유료) 예약 상세 */}
      <Dialog open={!!paidDetail} onOpenChange={(o) => { if (!o) setPaidDetail(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>제휴 예약 상세</DialogTitle>
          </DialogHeader>
          {paidDetail && (() => {
            const studio = paidDetail.rooms?.studios;
            const startD: Date | null = paidDetail._startD || null;
            const endD = startD && paidDetail.period
              ? (() => { const parts = String(paidDetail.period).replace(/[[\])"]/g, "").split(","); return parts[1] ? new Date(parts[1].trim()) : null; })()
              : null;
            const stMap: Record<string, { label: string; cls: string }> = {
              held: { label: "결제 대기", cls: "bg-yellow-500/10 text-yellow-600" },
              confirmed: { label: "예약 확정", cls: "bg-green-500/10 text-green-600" },
              completed: { label: "이용 완료", cls: "bg-muted text-muted-foreground" },
              no_show: { label: "노쇼", cls: "bg-destructive/10 text-destructive" },
              cancelled: { label: "취소됨", cls: "bg-muted text-muted-foreground" },
            };
            const st = stMap[paidDetail.status] || { label: paidDetail.status, cls: "bg-muted text-muted-foreground" };
            const fmtT = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
            const addr = studio?.address || null;
            return (
              <div className="space-y-3 text-sm">
                <div>
                  <h3 className="font-semibold text-base">{studio?.name || "연습실"} · {paidDetail.rooms?.name || ""}</h3>
                  <span className={`inline-block mt-1.5 text-[10px] font-medium px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                </div>
                {addr && (
                  <div className="flex items-start gap-2 text-muted-foreground">
                    <MapPin className="w-4 h-4 mt-0.5 shrink-0" />
                    <span className="text-xs">{addr}</span>
                  </div>
                )}
                {startD && (
                  <div className="flex items-start gap-2 text-muted-foreground">
                    <Calendar className="w-4 h-4 mt-0.5 shrink-0" />
                    <span className="text-xs">{startD.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "short" })}</span>
                  </div>
                )}
                {startD && endD && (
                  <div className="flex items-start gap-2 text-muted-foreground">
                    <Clock className="w-4 h-4 mt-0.5 shrink-0" />
                    <span className="text-xs">{fmtT(startD)} ~ {fmtT(endD)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between pt-1 border-t border-border/40">
                  <span className="text-xs text-muted-foreground">결제 금액</span>
                  <span className="text-sm font-semibold">{(paidDetail.amount || 0).toLocaleString("ko-KR")}원</span>
                </div>
                {paidDetail.status === "confirmed" && paidDetail._pin && (
                  <div className="rounded-xl bg-primary/5 border border-primary/20 p-3 text-center">
                    <p className="text-[11px] text-muted-foreground mb-1">도어락 PIN</p>
                    <p className="text-2xl font-bold tracking-[0.3em] text-primary">{paidDetail._pin}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">이용 시간에 입력하세요</p>
                  </div>
                )}
                {addr && (
                  <a
                    href={`https://map.naver.com/p/search/${encodeURIComponent(`${studio?.name || ""} ${addr}`)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="block text-center px-3 py-2.5 text-xs font-semibold rounded-lg bg-action text-action-foreground hover:opacity-90 transition-opacity"
                  >
                    네이버 지도 길찾기
                  </a>
                )}
                <p className="text-[10px] text-muted-foreground pt-1 leading-relaxed">
                  취소 정책: 이용 24시간 전 100% / 12시간 전 50% / 이후 환불 불가. (현재 모의결제)
                </p>
              </div>
            );
          })()}
          <DialogFooter>
            <button
              onClick={() => setPaidDetail(null)}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-secondary text-secondary-foreground hover:bg-surface-hover transition-colors"
            >
              닫기
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!cancelAppTarget} onOpenChange={(o) => { if (!o) setCancelAppTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>지원 취소</DialogTitle>
            <DialogDescription>
              {cancelAppTarget && (
                <>
                  <span className="block font-medium text-foreground">{cancelAppTarget.job?.title || "삭제된 공고"}</span>
                  <span className="block text-xs mt-1">정말로 이 공고에 대한 지원을 취소하시겠습니까? 취소 후에는 다시 지원할 수 있습니다.</span>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              onClick={() => setCancelAppTarget(null)}
              disabled={cancellingApp}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-secondary text-secondary-foreground hover:bg-surface-hover transition-colors"
            >
              닫기
            </button>
            <button
              onClick={confirmCancelApplication}
              disabled={cancellingApp}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-destructive text-destructive-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {cancellingApp ? "취소 중..." : "지원 취소"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {ratingTarget && (
        <RatingDialog
          open={!!ratingTarget}
          onClose={() => setRatingTarget(null)}
          rateeId={ratingTarget.id}
          rateeName={ratingTarget.name}
          jobApplicationId={ratingTarget.appId}
        />
      )}
      {/* 평가 신고 폼 */}
      <Dialog open={!!reportTarget} onOpenChange={(o) => { if (!o) { setReportTarget(null); setReportReason(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>평가 신고</DialogTitle>
            <DialogDescription>
              어떤 점이 사실과 다른지 알려주세요. 접수되면 이 평가는 확인 전까지 등급 산정에서 제외됩니다.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={reportReason}
            onChange={(e) => setReportReason(e.target.value)}
            placeholder="예: 합주에 참석했는데 노쇼로 평가되었습니다"
            rows={4}
            maxLength={500}
          />
          <DialogFooter className="flex flex-col sm:flex-col sm:justify-normal sm:space-x-0 pt-2">
            <button
              onClick={submitReport}
              disabled={reporting || !reportReason.trim()}
              className="w-full h-12 rounded-lg bg-action text-action-foreground text-sm font-semibold hover:bg-action-hover transition-colors disabled:opacity-50"
            >
              {reporting ? "접수 중..." : "신고 접수"}
            </button>
            <button
              onClick={() => { setReportTarget(null); setReportReason(""); }}
              disabled={reporting}
              className="mt-6 self-center px-4 py-3 text-sm font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground transition-colors"
            >
              취소
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
};

export default ProfilePage;
