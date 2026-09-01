import { useEffect, useState } from "react";
import { ChevronRight, Edit3, Shield, ScrollText, Handshake, HelpCircle, LogOut, Trash2, Calendar, MapPin, Users, Clock, History, IdCard, Star, CalendarHeart, Flag, CalendarX2 } from "lucide-react";
import { toast } from "sonner";
import PageShell from "@/components/PageShell";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import ProfileEditModal from "@/components/ProfileEditModal";
import ProCredentialNotice from "@/components/ProCredentialNotice";
import RatingDialog from "@/components/RatingDialog";
import { GradeBadge, ResponseBadge, TrustBadges, GRADE_LABEL } from "@/components/ProfileCard";
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
  // 배지 판정에 필요한 값들 (남이 보는 카드와 같은 규칙으로 본인 화면에도 배지를 단다)
  credential_verified?: boolean | null;
  updated_at?: string | null;
}

// 설정 메뉴. key로 어떤 안내 시트를 열지 정한다 — App.tsx에 라우트를 더할 수 없으므로
// 별도 페이지 대신 이 파일 안의 다이얼로그로 띄운다.
// 순서는 "내 것 → 규칙 → 사장님 → 사람에게 묻기". 앞의 셋을 읽고도 남는 것이 고객센터라
// 고객센터를 맨 아래에 둔다.
const menuItems = [
  { key: "privacy", icon: Shield, label: "개인정보 보호" },
  { key: "terms", icon: ScrollText, label: "약관 및 정책" },
  { key: "partner", icon: Handshake, label: "제휴 문의" },
  { key: "support", icon: HelpCircle, label: "고객센터" },
] as const;

type MenuKey = (typeof menuItems)[number]["key"];

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
  // 편집 모달에서 증빙을 제출하면 저장 없이도 상태가 달라진다. 모달을 닫을 때
  // 값을 올려 증빙 안내 카드가 제출 이력을 다시 읽게 한다.
  const [credRefresh, setCredRefresh] = useState(0);
  const [cancelTarget, setCancelTarget] = useState<any | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [detailTarget, setDetailTarget] = useState<any | null>(null);
  const [paidDetail, setPaidDetail] = useState<any | null>(null);
  // 내가 올린 연습실에 들어온 예약 취소 (사유 포함)
  const [roomCancels, setRoomCancels] = useState<any[]>([]);
  // 설정 메뉴에서 연 안내 시트
  const [menuSheet, setMenuSheet] = useState<MenuKey | null>(null);
  // 고객센터 문의를 받을 관리자 id. null이면 창구가 없다는 뜻이라 버튼을 감춘다.
  const [supportAdminId, setSupportAdminId] = useState<string | null>(null);

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

  // 내 연습실 게시물에 들어온 취소 기록. 사유는 RLS상 취소한 본인·방 주인·관리자만 읽는다
  // (20260901000019). 방 주인이 사유를 확인할 화면이 여기밖에 없어서 프로필에 둔다.
  const fetchRoomCancellations = async () => {
    if (!user) return;
    const { data: myRooms } = await supabase
      .from("posts")
      .select("id,title,venue")
      .eq("user_id", user.id)
      .eq("post_type", "room");
    const rooms = (myRooms as any[]) || [];
    if (rooms.length === 0) { setRoomCancels([]); return; }
    const roomById: Record<string, any> = {};
    rooms.forEach((r) => { roomById[r.id] = r; });

    const { data } = await supabase
      .from("room_reservation_cancellations" as any)
      .select("*")
      .in("room_id", Object.keys(roomById))
      .order("created_at", { ascending: false })
      .limit(20);
    const list = (data as any[]) || [];

    // 취소한 사람 이름은 profiles에서 한 번에 (fetchMyRatings와 같은 방식)
    const userIds = Array.from(new Set(list.map((c) => c.user_id)));
    const nameById: Record<string, string> = {};
    if (userIds.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", userIds);
      (profs || []).forEach((pr: any) => { nameById[pr.user_id] = pr.display_name || "익명"; });
    }
    setRoomCancels(list.map((c) => ({
      ...c,
      room_title: roomById[c.room_id]?.title || roomById[c.room_id]?.venue || "연습실",
      cancellerName: nameById[c.user_id] || "익명",
    })));
  };

  const confirmCancel = async () => {
    if (!cancelTarget) return;
    if (!cancelReason.trim()) {
      toast.error("취소 사유를 입력해주세요");
      return;
    }
    setCancelling(true);
    // 예약 행 삭제와 사유 기록이 갈라지지 않도록 RPC 하나로 처리한다(20260901000019).
    // 예전처럼 delete()만 하면 입력받은 사유가 그대로 버려진다.
    const { error } = await (supabase as any).rpc("cancel_room_reservation", {
      p_reservation_id: cancelTarget.id,
      p_reason: cancelReason.trim(),
    });
    setCancelling(false);
    if (error) { toast.error(error.message || "취소 실패"); return; }
    toast.success("예약이 취소되었습니다. 취소 사유는 연습실 주인에게 전달됩니다.");
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
    fetchRoomCancellations();

    // 신뢰 지표(D3): 내 프로필에도 응답률·재합주율 등을 노출.
    // grade / no_show_count는 배지 판정에, 나머지는 아래 신뢰 지표 카드에 그대로 쓴다
    // (조회만 하고 안 쓰는 컬럼이 없도록 화면에 필요한 것만 가져온다).
    (supabase as any)
      .from("user_stats")
      .select("response_rate, median_response_h, sessions_count, partners_count, rehire_rate, no_show_count, grade, positive_rate, review_count")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }: any) => setMyStats(data || null));
  }, [user]);

  // 고객센터·제휴 문의를 열 때만 문의받을 관리자 id를 물어본다. 두 창구가 같은 사람에게 간다 —
  // get_support_admin_id가 애초에 "문의를 받는 관리자 한 명"만 돌려주기 때문에(20260901000023)
  // 창구를 나눌 근거가 없다.
  // user_roles는 일반 사용자에게 닫혀 있어 이 RPC로만 알 수 있고,
  // 관리자가 없으면 NULL이 온다 — 그때는 버튼 없이 안내 문구만 남는다.
  useEffect(() => {
    if ((menuSheet !== "support" && menuSheet !== "partner") || !user) return;
    let alive = true;
    (supabase as any).rpc("get_support_admin_id").then(({ data, error }: any) => {
      if (!alive) return;
      setSupportAdminId(error ? null : ((data as string | null) ?? null));
    });
    return () => { alive = false; };
  }, [menuSheet, user]);

  // 제휴 연습실 유료 예약 (bookings) + 배정 PIN
  const fetchPaidBookings = async () => {
    if (!user) return;
    const { data } = await (supabase as any)
      .from("bookings")
      .select("*, rooms(name, studios(name, address)), door_pins(pin)")
      .eq("user_id", user.id)
      .in("status", ["requested", "held", "confirmed", "completed", "no_show"])
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
          <div className="flex items-center gap-4">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="avatar" className="w-16 h-16 rounded-lg object-cover" />
            ) : (
              <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-2xl font-extrabold text-primary">
                {initials}
              </div>
            )}
            <div className="flex-1 min-w-0">
              {/* 남이 보는 내 카드에는 붙는 등급·응답 배지가 정작 본인 화면에만 없었다.
                  ProfileCard와 같은 컴포넌트를 불러 쓰면 판정 규칙이 두 벌이 되지 않는다. */}
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-extrabold tracking-tight truncate">{displayName}</h2>
                <ResponseBadge rate={myStats?.response_rate} size="md" />
                <GradeBadge grade={myStats?.grade} size="md" />
              </div>
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1 truncate">
                <MapPin className="w-3 h-3 shrink-0" />{profile?.location || "위치를 설정해주세요"}
              </p>
            </div>
          </div>

          {/* 인증 완료 · 빠른 응답 · 노쇼 0 배지와 주의 등급 회복 안내 */}
          <TrustBadges profile={profile} stats={myStats} />

          {profile?.bio && (
            <p className="text-sm text-muted-foreground mt-3 leading-relaxed">{profile.bio}</p>
          )}

          <div className="flex gap-2 mt-4">
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

        {/* 증빙 미인증 프로 안내 (작업 8 이전 가입자) — 프로필 비공개·구인글 작성·지원이
            모두 막힌 상태를 본인 화면에서 알 길이 없었다. 조건을 만족할 때만 그려진다. */}
        {profile && user && (
          <ProCredentialNotice
            userId={user.id}
            purpose={profile.purpose}
            credentialVerified={profile.credential_verified}
            refreshKey={credRefresh}
            onSubmitCredential={() => setEditOpen(true)}
            onSwitchedToHobby={() => setProfile((p) => (p ? { ...p, purpose: "hobby" } : p))}
          />
        )}

        {/* 신뢰 지표 — VU 게이지 */}
        {(() => {
          if (!myStats) return null;
          const hasRate = myStats.response_rate != null || myStats.rehire_rate != null || myStats.positive_rate != null;
          const hasCount = myStats.sessions_count > 0 || myStats.partners_count > 0 || !!myStats.grade;
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
                  {/* 20260901000016에서 "답한 칸만 분모"로 바뀐 값이다.
                      후기 건수를 함께 적지 않으면 몇 건짜리 비율인지 알 수 없다. */}
                  {myStats.positive_rate != null && (
                    <div>
                      <div className="flex justify-between items-baseline mb-1.5">
                        <span className="mono-label">후기 긍정률</span>
                        <span className="font-mono font-bold text-sm tabular-nums">{Math.round(myStats.positive_rate * 100)}%</span>
                      </div>
                      <VuMeter level={myStats.positive_rate} />
                      <p className="text-[10px] text-muted-foreground mt-1.5">
                        후기 {myStats.review_count ?? 0}건 중 답한 항목만 셈
                      </p>
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
                  {myStats.grade && (
                    <div>
                      <p className="text-2xl font-extrabold leading-none">{GRADE_LABEL[myStats.grade] ?? myStats.grade}</p>
                      <p className="mono-label mt-1.5">신뢰등급</p>
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

      {/* 내 연습실에 들어온 취소 — 사유를 읽을 수 있는 유일한 화면 */}
      {roomCancels.length > 0 && (
        <div className="glass-card overflow-hidden" style={{ animation: "reveal 0.6s cubic-bezier(0.16,1,0.3,1) 0.107s both" }}>
          <div className="px-5 pt-5 pb-3">
            <h3 className="text-lg font-extrabold tracking-tight">내 연습실 예약 취소 ({roomCancels.length})</h3>
            <p className="text-[11px] text-muted-foreground mt-1">
              내가 올린 연습실의 예약이 취소되면 사유가 여기에 남습니다. 해당 시간대는 다시 예약할 수 있습니다.
            </p>
          </div>
          <div className="p-3 pt-0 space-y-2 max-h-[300px] overflow-y-auto">
            {roomCancels.map((c) => {
              const s = new Date(c.start_at);
              const e = new Date(c.end_at);
              const fmtT = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
              return (
                <div key={c.id} className="p-3 rounded-xl bg-secondary/50">
                  <div className="flex items-center gap-2">
                    <CalendarX2 className="w-3 h-3 shrink-0 text-muted-foreground" />
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-negative text-negative-foreground shrink-0">취소</span>
                    <span className="text-xs font-semibold truncate">{c.room_title}</span>
                    <span className="font-mono text-[10px] text-muted-foreground shrink-0 ml-auto">
                      {new Date(c.created_at).toLocaleDateString("ko-KR")}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5">
                    {s.toLocaleDateString("ko-KR", { month: "long", day: "numeric" })} {fmtT(s)} - {fmtT(e)} · {c.cancellerName}
                  </p>
                  <p className="text-sm mt-1.5 leading-relaxed whitespace-pre-wrap break-words">{c.reason}</p>
                </div>
              );
            })}
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
        {menuItems.map(({ key, icon: Icon, label }, i, arr) => (
          <button
            key={label}
            onClick={() => setMenuSheet(key)}
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
          onClose={() => { setEditOpen(false); setCredRefresh((k) => k + 1); }}
          // 모달이 돌려주는 값에는 credential_verified·updated_at이 없다. 통째로
          // 갈아끼우면 인증된 프로가 저장만 해도 인증 배지와 판정이 사라져
          // 아래 증빙 안내 카드가 잘못 뜬다. 받은 필드만 덮어쓴다.
          onSaved={(updated) => setProfile((p) => ({ ...(p || ({} as Profile)), ...updated }))}
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
              maxLength={500}
            />
            <p className="text-[11px] text-muted-foreground">
              입력한 사유는 이 연습실을 올린 사람에게 전달됩니다.
            </p>
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

      {/* 개인정보 보호 — 지금 코드가 실제로 하는 일만 적는다.
          앞으로의 계획이나 관행적인 약관 문구를 넣으면 그 자체가 거짓말이 된다. */}
      <Dialog open={menuSheet === "privacy"} onOpenChange={(o) => { if (!o) setMenuSheet(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>개인정보 보호</DialogTitle>
            <DialogDescription>
              INSTRUT이 실제로 저장하고 보여주는 것만 적었습니다.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[55dvh] overflow-y-auto pr-1 space-y-4 text-sm leading-relaxed">
            <section>
              <p className="mono-label mb-1.5">누구나 볼 수 있는 것</p>
              <p className="text-muted-foreground">
                프로필에 직접 적은 이름·지역·악기·장르·소개·합주 가능 시간과 연주영상 링크,
                그리고 작성한 게시물은 다른 이용자에게 공개됩니다. 핸들(@)을 설정하면
                로그인 없이 열람할 수 있는 소개 카드 주소가 만들어집니다.
                프로필을 &lsquo;프로&rsquo;로 두고 증빙 인증을 받지 않으면 프로필은 본인과 관리자에게만 보입니다.
                무료 연습실 예약은 어느 시간대가 찼는지 알아야 예약이 되므로 열려 있습니다 —
                화면에는 시간대만 보이지만 예약한 사람의 식별자도 함께 공개됩니다.
              </p>
            </section>
            <section>
              <p className="mono-label mb-1.5">접속 상태</p>
              <p className="text-muted-foreground">
                앱을 열어둔 동안 마지막 접속 시각이 2분 간격으로 기록되고, 그 값이 5분 이내이면
                프로필 카드에 &lsquo;활동 중&rsquo;으로 보입니다. 시각 자체는 어디에도 표시하지 않습니다.
                &lsquo;프로필 수정&rsquo;에서 접속 상태 숨기기를 켜면 화면에서 가리는 것이 아니라
                기록을 남기는 일 자체를 멈추고, 켜는 순간 남아 있던 값도 함께 비웁니다.
              </p>
            </section>
            <section>
              <p className="mono-label mb-1.5">본인과 관리자만 보는 것</p>
              <p className="text-muted-foreground">
                증빙 서류는 공개되지 않는 저장소에 올라가 본인과 관리자만 열 수 있습니다.
                검증이 끝나면 30일 뒤 원본을 자동으로 파기하고 인증 종류·검증 일시·통과 여부만 남깁니다.
                다른 이용자에게는 어떤 서류로 인증했는지는 보이지 않고 &lsquo;인증 완료&rsquo; 배지만 보입니다.
              </p>
            </section>
            <section>
              <p className="mono-label mb-1.5">당사자만 보는 것</p>
              <p className="text-muted-foreground">
                구인 지원 내역과 지원서에 쓴 내용은 본인과 그 공고를 올린 사람만 볼 수 있습니다.
                메시지와 메시지에 붙인 파일은 대화 상대만 열 수 있습니다.
                예약 취소 사유는 취소한 본인과 그 연습실을 올린 사람만 봅니다.
                제휴 연습실을 예약하면 그 업소를 등록한 사장님이 예약 시간 · 금액 · 상태를 보고,
                이용 완료나 노쇼를 표시할 수 있습니다.
              </p>
            </section>
            <section>
              <p className="mono-label mb-1.5">알림을 켰을 때</p>
              <p className="text-muted-foreground">
                브라우저 알림을 켜면 알림을 보낼 주소와 브라우저 정보가 저장됩니다.
                이 값은 본인만 읽을 수 있고, 알림을 끄면 그 자리에서 지워집니다.
              </p>
            </section>
            <section>
              <p className="mono-label mb-1.5">사용 지표</p>
              <p className="text-muted-foreground">
                어떤 화면을 보고 언제 떠나는지, 그리고 가입 · 글 작성 · 지원 · 대화 시작
                네 가지 동작을 PostHog로 집계합니다. 글 작성 시 함께 보내는 값은 게시물 유형뿐이며,
                게시물 내용 · 메시지 본문 · 이메일은 보내지 않습니다.
              </p>
            </section>
            <section>
              <p className="mono-label mb-1.5">이 기기에만 남는 것</p>
              <p className="text-muted-foreground">
                &lsquo;최근 본&rsquo; 목록은 서버로 보내지 않고 이 브라우저에만 최대 20개까지 저장됩니다.
                브라우저 데이터를 지우면 함께 사라집니다.
              </p>
            </section>
            <section>
              <p className="mono-label mb-1.5">평가와 등급</p>
              <p className="text-muted-foreground">
                합주 후기(약속 지킴 · 실력 일치 · 또 하고 싶음)는 집계되어 신뢰 등급과 지표로 표시됩니다.
                내가 받은 후기는 이 화면의 &lsquo;받은 평가&rsquo;에서 확인할 수 있고,
                사실과 다르면 신고해 등급 산정에서 빼도록 요청할 수 있습니다.
              </p>
            </section>
          </div>
          <DialogFooter>
            <button
              onClick={() => setMenuSheet(null)}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-secondary text-secondary-foreground hover:bg-surface-hover transition-colors"
            >
              닫기
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 약관 및 정책 — 법률 문서가 아니다.
          책임 제한 · 손해배상 · 준거법 · 관할 · 청약철회 같은 조항을 그럴듯하게 적어두면
          검토받은 약관으로 오인되고, 그 오인 자체가 실제 법적 위험이 된다. 그래서 여기에는
          코드가 실제로 강제하는 규칙만 적는다 — 각 항목은 마이그레이션과 RLS 정책에서
          확인한 것이고, 확인하지 못한 것은 쓰지 않았다.
          정식 이용약관 · 개인정보처리방침은 따로 마련해 검토받아야 하며, 그 사실을 맨 위에 밝힌다. */}
      <Dialog open={menuSheet === "terms"} onOpenChange={(o) => { if (!o) setMenuSheet(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>약관 및 정책</DialogTitle>
            <DialogDescription>
              INSTRUT이 실제로 강제하는 운영 규칙입니다.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[55dvh] overflow-y-auto pr-1 space-y-4 text-sm leading-relaxed">
            <div className="rounded-lg border border-amber/40 bg-amber/5 p-3">
              <p className="font-semibold text-amber">법률 검토를 받은 문서가 아닙니다</p>
              <p className="text-xs text-muted-foreground mt-1">
                이 문서는 서비스가 코드로 강제하고 있는 운영 규칙을 정리한 것입니다.
                이용약관도, 개인정보처리방침도 아닙니다. 책임 제한 · 손해배상 · 청약철회 · 준거법 ·
                관할 같은 법률 조항은 여기에 들어 있지 않고, 들어 있는 척하지도 않습니다.
                정식 약관과 개인정보처리방침은 별도로 마련해 법률 검토를 받아야 합니다.
              </p>
            </div>

            <section>
              <p className="mono-label mb-1.5">계정과 인증</p>
              <ul className="text-muted-foreground space-y-1.5 list-disc pl-4">
                <li>
                  활동 목적을 &lsquo;프로&rsquo;로 두면 증빙 인증을 받기 전까지 프로필이 본인과 관리자에게만
                  보이고, 게시물 작성과 지원도 막힙니다. &lsquo;취미&rsquo;에는 이 제한이 없습니다.
                </li>
                <li>
                  증빙(졸업 · 재학 · 수상)은 공개되지 않는 저장소에 올라가고 관리자가 직접 확인합니다.
                  자동 판독은 하지 않습니다.
                </li>
                <li>
                  인증이 끝나면(통과든 반려든) 30일 뒤 원본을 파기하고, 인증 종류 · 검증 일시 ·
                  검증자 · 통과 여부만 남깁니다. 다른 이용자에게는 인증 여부만 배지로 보입니다.
                </li>
                <li>
                  접속 상태는 앱을 열어둔 동안 기록되고 5분 이내면 &lsquo;활동 중&rsquo;으로 보입니다.
                  프로필 수정에서 숨기기를 켜면 기록 자체를 남기지 않습니다.
                </li>
              </ul>
            </section>

            <section>
              <p className="mono-label mb-1.5">구인과 지원</p>
              <ul className="text-muted-foreground space-y-1.5 list-disc pl-4">
                <li>
                  구인글에는 지원 자격을 &lsquo;누구나&rsquo; 또는 &lsquo;인증된 프로만&rsquo; 중에서 정할 수 있습니다.
                  프로 전용 공고는 목적이 프로이고 증빙 인증을 마친 사람만 지원할 수 있습니다.
                </li>
                <li>
                  급구는 마감까지 3일 이하인 공고만 등록됩니다. 마감일시가 없거나 이미 지났으면
                  급구로 올릴 수 없습니다.
                </li>
                <li>
                  모집을 마감하면 그 공고는 목록에서 빠지고, 작성자와 합격한 지원자만 볼 수 있습니다.
                </li>
                <li>
                  지원서 내용은 본인과 그 공고를 올린 사람만 봅니다. 지원을 취소하면 기록이 지워지고,
                  공고 작성자의 응답률 계산에서도 함께 빠집니다.
                </li>
              </ul>
            </section>

            <section>
              <p className="mono-label mb-1.5">후기와 평판</p>
              <ul className="text-muted-foreground space-y-1.5 list-disc pl-4">
                <li>
                  합주 후기는 지원이 수락되어 실제로 매칭된 상대에게만 남길 수 있습니다.
                  같은 매칭에 한 번만 쓸 수 있고, 자기 자신에게는 쓸 수 없습니다.
                </li>
                <li>
                  세 항목(약속 지킴 · 실력 일치 · 또 하고 싶음)은 각각 예 · 아니오 · 미선택이며,
                  최소 한 항목은 답해야 저장됩니다. 답하지 않은 항목은 집계에서 분모로도 세지 않습니다.
                </li>
                <li>
                  등급은 최근 20건의 후기만으로 산정합니다. 오래된 후기는 자동으로 빠지므로
                  등급이 내려갈 수도 있습니다.
                </li>
                <li>
                  <span className="text-foreground font-medium">주의</span> — &lsquo;약속 지킴&rsquo;에 아니오가
                  3건 이상이거나, 후기 3건 이상이면서 긍정률 40% 이하일 때.{" "}
                  <span className="text-foreground font-medium">신뢰</span> — 후기 10건 이상 +
                  긍정률 90% 이상 + &lsquo;약속 지킴&rsquo; 아니오 0건.{" "}
                  <span className="text-foreground font-medium">안정</span> — 후기 5건 이상.
                  그 밖에는 <span className="text-foreground font-medium">산정 전</span>입니다.
                </li>
                <li>
                  받은 후기가 사실과 다르면 그 후기를 받은 당사자가 신고할 수 있습니다.
                  접수되는 즉시 그 후기는 등급 산정에서 빠지고, 관리자가 인정하면 계속 빠진 채로,
                  기각하면 다시 산정에 들어갑니다.
                </li>
              </ul>
            </section>

            <section>
              <p className="mono-label mb-1.5">예약과 취소</p>
              <ul className="text-muted-foreground space-y-1.5 list-disc pl-4">
                <li>
                  무료 연습실 예약은 같은 방에서 시간대가 겹치면 등록되지 않습니다.
                </li>
                <li>
                  무료 예약을 취소하려면 사유(1~500자)를 적어야 합니다. 사유는 취소한 본인과
                  그 연습실을 올린 사람, 관리자만 봅니다. 예약자 본인뿐 아니라 연습실을 올린 사람도
                  취소할 수 있고, 어느 쪽이 취소해도 사유가 남습니다.
                </li>
                <li>
                  제휴 연습실은 업소 등급에 따라 예약 방식이 다릅니다 — A는 즉시 확정, B는 사장님
                  승인 후 확정, C는 예약을 받지 않습니다. 자세한 내용은 &lsquo;제휴 문의&rsquo;에 적어두었습니다.
                </li>
                <li>
                  A등급의 결제 대기는 5분, B등급의 승인 대기는 24시간(합주 시작 시각이 더 빠르면
                  그때)이 지나면 자동으로 취소되고 시간대가 다시 열립니다. 요청의 결과 —
                  승인 · 거절 · 자동 취소 — 는 알림으로 전달됩니다.
                </li>
                <li>
                  제휴 연습실 사장님은 지난 예약에 이용 완료나 노쇼를 표시할 수 있습니다.
                </li>
                <li>
                  예약 화면에 적힌 환불 기준(이용 24시간 전 100% · 12시간 전 50% · 이후 불가)은
                  결제가 붙은 뒤에 적용될 기준입니다. 지금은 실제 결제가 이뤄지지 않으므로
                  환불 처리도 없습니다.
                </li>
              </ul>
            </section>

            <p className="text-xs text-muted-foreground border-t border-border pt-3">
              다시 한 번 — 위 내용은 코드에서 확인한 운영 규칙일 뿐, 법률 검토를 받은 약관이 아닙니다.
              여기에 적히지 않은 사항은 &lsquo;정해져 있지 않다&rsquo;는 뜻입니다.
            </p>
          </div>
          <DialogFooter>
            <button
              onClick={() => setMenuSheet(null)}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-secondary text-secondary-foreground hover:bg-surface-hover transition-colors"
            >
              닫기
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 제휴 문의 — 연습실 · 악기사 사장님용 창구.
          /partner(사장님 콘솔)는 App.tsx에 라우트만 있고 앱 어디에도 링크가 없어서
          주소를 직접 쳐야만 들어갈 수 있었다. 여기가 그 입구다.
          관리자 메시지는 고객센터와 같은 supportAdminId를 쓴다 — 문의를 받는 관리자가
          한 명뿐이라(20260901000023) 창구를 둘로 나눌 이유가 없다.
          결제가 아직 없다는 사실을 숨기지 않는다. 제휴를 검토하는 사장님에게는
          "예약은 되는데 PIN은 안 나간다"가 가장 먼저 알아야 할 조건이다. */}
      <Dialog open={menuSheet === "partner"} onOpenChange={(o) => { if (!o) setMenuSheet(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>제휴 문의</DialogTitle>
            <DialogDescription>
              연습실 · 악기사를 운영하신다면 여기서 시작하세요.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[55dvh] overflow-y-auto pr-1 space-y-3 text-sm leading-relaxed">
            <div className="rounded-lg border border-border p-3">
              <p className="font-semibold">무엇을 제휴하나요</p>
              <p className="text-xs text-muted-foreground mt-1">
                업소와 합주실, 그리고 비어 있는 시간대를 등록하면 앱의 &lsquo;제휴 연습실 예약&rsquo;에
                노출되고 이용자가 그 시간대를 예약합니다. 업소에 매긴 등급이 곧 예약이 들어오는
                방식이 됩니다.
              </p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="font-semibold">등급이 곧 예약 방식입니다</p>
              <div className="mt-2 space-y-2.5 text-xs text-muted-foreground">
                <p>
                  <span className="font-mono text-[11px] font-bold tracking-[0.06em] text-foreground">A · 즉시예약</span><br />
                  이용자가 시간대를 고르면 그 자리가 5분간 잠기고, 그 안에 결제 단계를 마치면
                  바로 확정됩니다. 5분을 넘기면 자동으로 취소되어 시간대가 다시 열립니다.
                </p>
                <p>
                  <span className="font-mono text-[11px] font-bold tracking-[0.06em] text-foreground">B · 요청예약</span><br />
                  고른 시간대가 &lsquo;요청&rsquo;으로 접수되고, 사장님이 승인해야 확정됩니다. 검토하는
                  동안 그 시간대는 다른 사람에게 열리지 않습니다.
                  <span className="text-amber font-medium"> 24시간 안에 답하지 않으면 요청은 자동 취소됩니다</span>
                  {" "}(합주 시작 시각이 더 빠르면 그때).
                </p>
                <p>
                  <span className="font-mono text-[11px] font-bold tracking-[0.06em] text-foreground">C · 정보 노출</span><br />
                  예약을 받지 않습니다. 이름 · 주소 · 전화 · 소개와 길찾기만 노출되고, 예약 화면
                  자체가 열리지 않습니다. 문의는 이용자가 업소로 직접 전화합니다.
                </p>
                <p className="pt-0.5">
                  이 규칙은 화면 배지가 아니라 서버가 강제합니다. C등급 업소에 예약을 밀어 넣거나
                  B등급을 승인 없이 확정하는 우회는 되지 않습니다. 등급은 등록 후에도 바꿀 수 있습니다.
                </p>
              </div>
            </div>
            <div className="rounded-lg border border-amber/40 bg-amber/5 p-3">
              <p className="font-semibold text-amber">아직 결제가 이뤄지지 않습니다</p>
              <p className="text-xs text-muted-foreground mt-1">
                결제대행(PG) 연동 전이라 예약 화면의 결제 단계에서 실제로 돈이 오가지 않습니다.
                예약은 만들어지고 시간대도 잡히지만, 결제가 확인되지 않은 예약으로 남기 때문에
                <span className="font-medium text-foreground"> 출입 PIN이 발급되지 않습니다</span> —
                콘솔에 PIN을 등록해 두어도 배정되지 않습니다. 그래서 환불 기준도 아직 적용될 일이
                없습니다. 제휴를 검토하실 때 이 점을 먼저 감안해주세요.
              </p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="font-semibold">제휴를 문의하려면</p>
              {supportAdminId && supportAdminId !== user?.id ? (
                <>
                  <p className="text-xs text-muted-foreground mt-1">
                    운영자에게 앱 내 메시지로 보내주세요. 업소 이름 · 위치 · 연락처와 원하시는 등급을
                    함께 적어주시면 확인이 빠릅니다. 답변은 &lsquo;메시지&rsquo;에 같은 대화로 옵니다.
                  </p>
                  <button
                    onClick={() => { setMenuSheet(null); navigate(`/messages?to=${supportAdminId}`); }}
                    className="mt-3 w-full h-11 rounded-xl bg-action text-action-foreground text-sm font-semibold hover:bg-action-hover active:scale-[0.98] transition-all"
                  >
                    관리자에게 문의하기
                  </button>
                </>
              ) : supportAdminId ? (
                <p className="text-xs text-muted-foreground mt-1">
                  회원님이 문의를 받는 관리자입니다. 제휴 문의도 &lsquo;메시지&rsquo;로 들어옵니다.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground mt-1">
                  아직 운영자에게 문의를 접수할 창구가 없습니다. 받는 사람이 없는 주소를 적어두면
                  답을 기다리게만 되므로 적지 않았습니다. 그동안에도 아래 사장님 콘솔에서 업소를
                  직접 등록해두실 수 있고, 창구가 열리면 이 화면에 먼저 안내하겠습니다.
                </p>
              )}
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="font-semibold">직접 등록해보려면</p>
              <p className="text-xs text-muted-foreground mt-1">
                사장님 콘솔에서 업소와 합주실, 비어 있는 시간대를 직접 등록할 수 있습니다.
                들어온 예약 요청을 승인 · 거절하고, 이용 완료 · 노쇼를 표시하고, 출입 PIN 풀을
                관리하는 것도 같은 화면입니다. 등록한 업소는 &lsquo;제휴 연습실 예약&rsquo;에 바로 보입니다.
              </p>
              <button
                onClick={() => { setMenuSheet(null); navigate("/partner"); }}
                className="mt-3 w-full h-11 rounded-xl border border-border text-sm font-semibold hover:bg-surface-hover active:scale-[0.98] transition-all"
              >
                사장님 콘솔 열기
              </button>
            </div>
          </div>
          <DialogFooter>
            <button
              onClick={() => setMenuSheet(null)}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-secondary text-secondary-foreground hover:bg-surface-hover transition-colors"
            >
              닫기
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 고객센터 — 새 문의 폼이나 메일 주소는 여전히 만들지 않는다. 접수 백엔드도,
          받는 사람이 있는 메일 계정도 없기 때문이다. 대신 이미 사람이 읽는 창구인
          앱 내 메시지로 보낸다: get_support_admin_id RPC(20260901000023 마이그레이션)가
          문의를 받을 관리자 한 명의 id만 돌려주고, 그 id로 /messages?to= 대화를 연다.
          관리자가 없으면 RPC가 NULL을 주므로 버튼 없이 "창구가 없다"는 안내만 남는다 —
          동작하지 않는 버튼은 두지 않는다. */}
      <Dialog open={menuSheet === "support"} onOpenChange={(o) => { if (!o) setMenuSheet(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>고객센터</DialogTitle>
            <DialogDescription>
              앱 안에서 바로 처리되는 것부터 확인해보세요.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[55dvh] overflow-y-auto pr-1 space-y-3 text-sm leading-relaxed">
            <div className="rounded-lg border border-border p-3">
              <p className="font-semibold">받은 평가가 사실과 다를 때</p>
              <p className="text-xs text-muted-foreground mt-1">
                이 화면의 &lsquo;받은 평가&rsquo;에서 해당 평가를 신고하세요.
                접수되는 즉시 그 평가는 확인 전까지 등급 산정에서 빠집니다.
              </p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="font-semibold">예약을 취소해야 할 때</p>
              <p className="text-xs text-muted-foreground mt-1">
                &lsquo;나의 INSTRUT &rsaquo; 예약현황&rsquo;에서 취소하면 사유가 연습실 주인에게 전달됩니다.
                제휴 예약은 이용 24시간 전 100%, 12시간 전 50% 환불이며 이후에는 환불되지 않습니다.
              </p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="font-semibold">공고를 올린 사람 · 연습실 주인에게 물어볼 때</p>
              <p className="text-xs text-muted-foreground mt-1">
                게시물이나 프로필에서 &lsquo;메시지 보내기&rsquo;로 직접 연락할 수 있습니다.
              </p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="font-semibold">내가 올린 것을 지우고 싶을 때</p>
              <p className="text-xs text-muted-foreground mt-1">
                프로필에 적은 내용은 이 화면의 &lsquo;프로필 수정&rsquo;에서 언제든 고치거나 비울 수 있습니다.
                올린 게시물은 &lsquo;내 게시물&rsquo;에서 삭제하고, 넣은 지원은 &lsquo;나의 INSTRUT &rsaquo; 지원현황&rsquo;에서 취소하면
                그 즉시 다른 사람에게도 보이지 않습니다.
              </p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="font-semibold">연습실 · 악기사를 운영하고 계실 때</p>
              <p className="text-xs text-muted-foreground mt-1">
                제휴, 업소 등록, 들어온 예약 요청 처리에 관한 것은 &lsquo;제휴 문의&rsquo;에 따로
                정리해두었습니다. 같은 운영자에게 닿지만, 필요한 안내가 먼저 있는 쪽으로 가세요.
              </p>
              <button
                onClick={() => setMenuSheet("partner")}
                className="mt-2 text-xs font-semibold text-primary underline underline-offset-4 hover:text-foreground transition-colors"
              >
                제휴 문의 열기
              </button>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="font-semibold">그 밖의 문의 · 계정 삭제 요청</p>
              {supportAdminId && supportAdminId !== user?.id ? (
                <>
                  <p className="text-xs text-muted-foreground mt-1">
                    위에서 해결되지 않는 문의는 운영자에게 직접 메시지로 보내주세요.
                    계정 삭제 요청도 이 대화로 받습니다 — 앱에서 바로 지우는 기능은 아직 없어
                    운영자가 확인 후 처리합니다. 답변은 &lsquo;메시지&rsquo;에 같은 대화로 옵니다.
                  </p>
                  <button
                    onClick={() => { setMenuSheet(null); navigate(`/messages?to=${supportAdminId}`); }}
                    className="mt-3 w-full h-11 rounded-xl bg-action text-action-foreground text-sm font-semibold hover:bg-action-hover active:scale-[0.98] transition-all"
                  >
                    관리자에게 문의하기
                  </button>
                </>
              ) : supportAdminId ? (
                <p className="text-xs text-muted-foreground mt-1">
                  회원님이 문의를 받는 관리자입니다. 다른 사용자가 보낸 문의는 &lsquo;메시지&rsquo;로 들어옵니다.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground mt-1">
                  아직 운영자에게 문의를 접수할 창구가 없습니다. 받는 사람이 없는 주소를 적어두면
                  답을 기다리게만 되므로, 준비될 때까지는 적지 않았습니다. 창구가 열리면 이 화면에 먼저 안내하겠습니다.
                  그때까지 계정 자체를 지우는 것은 앱에서 처리할 수 없습니다. 위 방법으로 프로필과 게시물을 비워두면
                  다른 사람에게 보이는 내용은 남지 않습니다.
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <button
              onClick={() => setMenuSheet(null)}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-secondary text-secondary-foreground hover:bg-surface-hover transition-colors"
            >
              닫기
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
};

export default ProfilePage;
