import { useEffect, useState } from "react";
import { Settings, ChevronRight, Music, Award, Edit3, Bell, Shield, HelpCircle, LogOut, Heart, MessageSquare, Trash2, Sun, Moon, Monitor, Calendar, MapPin, Users, Clock } from "lucide-react";
import { toast } from "sonner";
import PageShell from "@/components/PageShell";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import ProfileEditModal from "@/components/ProfileEditModal";
import NotificationsPanel, { useUnreadCount } from "@/components/NotificationsPanel";
import { useTheme } from "@/contexts/ThemeContext";
import { useAdmin } from "@/hooks/useAdmin";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

interface Profile {
  display_name: string | null;
  location: string | null;
  instruments: string[] | null;
  genres: string[] | null;
  bio: string | null;
  avatar_url: string | null;
}

const menuItems = [
  { icon: Bell, label: "알림 설정" },
  { icon: Shield, label: "개인정보 보호" },
  { icon: HelpCircle, label: "고객센터" },
];

const activityTabs = ["내 게시물", "내 댓글", "내 예약", "내 지원"];

const APPLY_STATUS_META: Record<string, { label: string; cls: string }> = {
  applied: { label: "검토중", cls: "bg-primary/10 text-primary" },
  reviewing: { label: "검토중", cls: "bg-primary/10 text-primary" },
  accepted: { label: "합격", cls: "bg-green-500/10 text-green-600" },
  rejected: { label: "불합격", cls: "bg-destructive/10 text-destructive" },
};

const ProfilePage = () => {
  const { user, signOut } = useAuth();
  const { isAdmin } = useAdmin();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [activeTab, setActiveTab] = useState("내 게시물");
  const [myPosts, setMyPosts] = useState<any[]>([]);
  const [myComments, setMyComments] = useState<any[]>([]);
  const [myReservations, setMyReservations] = useState<any[]>([]);
  const [myApplications, setMyApplications] = useState<any[]>([]);
  const [cancelAppTarget, setCancelAppTarget] = useState<any | null>(null);
  const [cancellingApp, setCancellingApp] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [notiOpen, setNotiOpen] = useState(false);
  const { count: unreadCount } = useUnreadCount();
  const { theme, setTheme } = useTheme();
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
        .select("id,title,venue,pay,category")
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

  const themeOptions: { value: "light" | "dark" | "system"; icon: typeof Sun; label: string }[] = [
    { value: "light", icon: Sun, label: "라이트" },
    { value: "dark", icon: Moon, label: "다크" },
    { value: "system", icon: Monitor, label: "시스템" },
  ];

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("display_name, location, instruments, genres, bio, avatar_url")
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

    // Fetch my comments
    supabase
      .from("post_comments")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => setMyComments(data || []));

    // Fetch my room reservations (with room title)
    fetchReservations();
    fetchApplications();
  }, [user]);

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
            onClick={() => setEditOpen(true)}
            className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center hover:bg-surface-hover transition-colors active:scale-95"
          >
            <Edit3 className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {profile?.bio && (
          <p className="text-sm text-muted-foreground mb-3">{profile.bio}</p>
        )}
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
              {tab} ({tab === "내 게시물" ? myPosts.length : tab === "내 댓글" ? myComments.length : tab === "내 예약" ? myReservations.length : myApplications.length})
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
          ) : activeTab === "내 댓글" ? (
            myComments.length > 0 ? (
              myComments.map((comment) => (
                <div key={comment.id} className="p-3 rounded-xl bg-secondary/50">
                  <div className="flex items-center gap-2 mb-1">
                    <MessageSquare className="w-3 h-3 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(comment.created_at).toLocaleDateString("ko-KR")}
                    </span>
                    <button
                      onClick={async () => {
                        if (!confirm("댓글을 삭제하시겠습니까?")) return;
                        const { error } = await supabase.from("post_comments").delete().eq("id", comment.id);
                        if (error) { toast.error("삭제에 실패했습니다"); return; }
                        toast.success("댓글이 삭제되었습니다");
                        setMyComments((prev) => prev.filter((c) => c.id !== comment.id));
                      }}
                      className="ml-auto p-1 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-sm text-foreground">{comment.content}</p>
                </div>
              ))
            ) : (
              <p className="text-xs text-muted-foreground text-center py-6">작성한 댓글이 없습니다.</p>
            )
          ) : activeTab === "내 예약" ? (
            myReservations.length > 0 ? (
              myReservations.map((r) => {
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
              })
            ) : (
              <p className="text-xs text-muted-foreground text-center py-6">예약 내역이 없습니다.</p>
            )
          ) : (
            myApplications.length > 0 ? (
              myApplications.map((a) => {
                const meta = APPLY_STATUS_META[a.status] || APPLY_STATUS_META.applied;
                const cancellable = a.status === "applied" || a.status === "reviewing";
                return (
                  <div
                    key={a.id}
                    onClick={() => navigate("/jobs")}
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
                    {a.message && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">"{a.message}"</p>
                    )}
                  </div>
                );
              })
            ) : (
              <p className="text-xs text-muted-foreground text-center py-6">지원 내역이 없습니다.</p>
            )
          )}
        </div>
      </div>

      {/* Theme Switcher */}
      <div className="glass-card p-4 mb-4" style={{ animation: "reveal 0.6s cubic-bezier(0.16,1,0.3,1) 0.13s both" }}>
        <span className="text-xs font-semibold mb-2.5 block">테마</span>
        <div className="flex gap-2">
          {themeOptions.map(({ value, icon: Icon, label }) => (
            <button
              key={value}
              onClick={() => setTheme(value)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all active:scale-95 ${
                theme === value
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-surface-hover"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Menu */}
      <div className="glass-card overflow-hidden" style={{ animation: "reveal 0.6s cubic-bezier(0.16,1,0.3,1) 0.16s both" }}>
        <button
          onClick={() => setNotiOpen(true)}
          className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-surface-hover transition-colors active:scale-[0.99] text-left border-b border-border/40"
        >
          <Bell className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium flex-1">알림</span>
          {unreadCount > 0 && (
            <span className="text-[10px] font-bold bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
              {unreadCount}
            </span>
          )}
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </button>
        {menuItems.filter(m => m.label !== "알림 설정").map(({ icon: Icon, label }, i, arr) => (
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

      <NotificationsPanel open={notiOpen} onClose={() => setNotiOpen(false)} />

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
                        href={`https://map.kakao.com/link/to/${encodeURIComponent(detailTarget.room_title)},${detailTarget.room_lat},${detailTarget.room_lng}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 text-center px-3 py-2 text-xs font-medium rounded-lg bg-secondary text-secondary-foreground hover:bg-surface-hover transition-colors"
                      >
                        카카오맵 길찾기
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
    </PageShell>
  );
};

export default ProfilePage;
