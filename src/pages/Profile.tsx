import { useEffect, useState } from "react";
import { ChevronRight, Music, Award, Edit3, Shield, HelpCircle, LogOut, Trash2, Sun, Moon, Calendar, MapPin, Users, Clock, History, IdCard, Star, CalendarHeart } from "lucide-react";
import { toast } from "sonner";
import PageShell from "@/components/PageShell";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import ProfileEditModal from "@/components/ProfileEditModal";
import RatingDialog from "@/components/RatingDialog";
import { useTheme } from "@/contexts/ThemeContext";
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
  const [cancelAppTarget, setCancelAppTarget] = useState<any | null>(null);
  const [cancellingApp, setCancellingApp] = useState(false);
  const [ratingTarget, setRatingTarget] = useState<{ id: string; name: string; appId: string } | null>(null);
  const [myStats, setMyStats] = useState<any | null>(null);
  const [recentViews] = useState<RecentView[]>(() => getRecentViews());
  const [editOpen, setEditOpen] = useState(false);
  const { setTheme, resolvedTheme } = useTheme();
  const [cancelTarget, setCancelTarget] = useState<any | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [detailTarget, setDetailTarget] = useState<any | null>(null);

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

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .single()
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
      {/* Profile Card */}
      <div className="glass-card p-5 mb-4" style={{ animation: "reveal 0.6s cubic-bezier(0.16,1,0.3,1) both" }}>
        <div className="flex items-center gap-4 mb-4">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="avatar" className="w-16 h-16 rounded-2xl object-cover" />
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-xl font-bold text-primary">
              {initials}
            </div>
          )}
          <div className="flex-1">
            <h2 className="text-lg font-bold">{displayName}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {profile?.location || "위치를 설정해주세요"}
            </p>
          </div>
          <button
            onClick={() => {
              const h = (profile as any)?.handle;
              if (h) navigate(`/u/${h}/card`);
              else { toast.error("먼저 프로필 편집에서 핸들을 설정해주세요"); setEditOpen(true); }
            }}
            className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center hover:bg-surface-hover transition-colors active:scale-95"
            aria-label="내 소개 카드"
          >
            <IdCard className="w-4 h-4 text-muted-foreground" />
          </button>
          <button
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center hover:bg-surface-hover transition-colors active:scale-95"
            aria-label={resolvedTheme === "dark" ? "라이트 모드로 전환" : "다크 모드로 전환"}
          >
            {resolvedTheme === "dark" ? (
              <Sun className="w-4 h-4 text-muted-foreground" />
            ) : (
              <Moon className="w-4 h-4 text-muted-foreground" />
            )}
          </button>
          <button
            onClick={() => setEditOpen(true)}
            className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center hover:bg-surface-hover transition-colors active:scale-95"
          >
            <Edit3 className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {profile?.bio && (
          <p className="text-sm text-muted-foreground mb-3">{profile.bio}</p>
        )}

        {(() => {
          if (!myStats) return null;
          const items: { label: string; value: string }[] = [];
          if (myStats.response_rate != null) items.push({ label: "응답률", value: `${Math.round(myStats.response_rate * 100)}%` });
          if (myStats.sessions_count > 0) items.push({ label: "합주", value: `${myStats.sessions_count}회` });
          if (myStats.partners_count > 0) items.push({ label: "함께한 음악인", value: `${myStats.partners_count}명` });
          if (myStats.rehire_rate != null) items.push({ label: "재합주율", value: `${Math.round(myStats.rehire_rate * 100)}%` });
          if (items.length === 0) return null;
          return (
            <div className="pt-3 border-t border-border/40 grid grid-cols-2 gap-2">
              {items.map((t) => (
                <div key={t.label} className="text-center py-1.5 rounded-lg bg-secondary/50">
                  <p className="text-sm font-bold text-primary">{t.value}</p>
                  <p className="text-[10px] text-muted-foreground">{t.label}</p>
                </div>
              ))}
            </div>
          );
        })()}
      </div>

      {/* Instruments & Genres */}
      <div className="glass-card p-4 mb-4" style={{ animation: "reveal 0.6s cubic-bezier(0.16,1,0.3,1) 0.08s both" }}>
        <div className="mb-3">
          <div className="flex items-center gap-2 mb-2">
            <Music className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-semibold">악기</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {instruments.map((inst) => (
              <span key={inst} className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-primary/10 text-primary">
                {inst}
              </span>
            ))}
          </div>
        </div>
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Award className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-semibold">장르</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {genres.map((genre) => (
              <span key={genre} className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground">
                {genre}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* 나의 INSTRUT: 지원현황 · 예약현황 */}
      <div className="glass-card mb-4 overflow-hidden" style={{ animation: "reveal 0.6s cubic-bezier(0.16,1,0.3,1) 0.1s both" }}>
        <div className="px-4 pt-4 pb-2">
          <h3 className="text-sm font-bold">
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
                          className="p-1 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                          title="지원 취소"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
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
                  <div key={b.id} className="p-3 rounded-xl bg-primary/5 border border-primary/20">
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

      {/* My Activity */}
      <div className="glass-card mb-4 overflow-hidden" style={{ animation: "reveal 0.6s cubic-bezier(0.16,1,0.3,1) 0.11s both" }}>
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
            className={`w-full flex items-center gap-3 px-4 py-3.5 hover:bg-surface-hover transition-colors active:scale-[0.99] text-left ${
              i < arr.length - 1 ? "border-b border-border/40" : ""
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
          className="w-full mt-4 py-3 text-sm font-medium text-primary hover:bg-primary/5 rounded-xl transition-colors active:scale-[0.98] flex items-center justify-center gap-2"
        >
          <Shield className="w-4 h-4" />
          관리자 페이지
        </button>
      )}

      {/* Logout */}
      <button
        onClick={handleLogout}
        className="w-full mt-2 py-3 text-sm font-medium text-destructive hover:bg-destructive/5 rounded-xl transition-colors active:scale-[0.98]"
      >
        <span className="flex items-center justify-center gap-2">
          <LogOut className="w-4 h-4" />
          로그아웃
        </span>
      </button>

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
                        className="flex-1 text-center px-3 py-2 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
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
    </PageShell>
  );
};

export default ProfilePage;
