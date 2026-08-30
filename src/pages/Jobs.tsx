import { Search, ArrowUpDown, ArrowLeft, Pencil, Trash2, MessageCircle, Check, Navigation, Star, CalendarHeart } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import PageShell from "@/components/PageShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { track } from "@/lib/analytics";
import { naverDirectionsUrl, hasDirections } from "@/lib/directions";
import { addRecentView } from "@/lib/recentViews";
import { toast } from "sonner";
import { JobCardSkeleton } from "@/components/skeletons/PostSkeleton";
import ProfileCard, { ProfileCardData } from "@/components/ProfileCard";
import RatingDialog from "@/components/RatingDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

const categories = ["전체", "공연", "녹음", "레슨", "행사", "종교", "기타"];
// 포지션·카테고리 모두 제외 필터 — 선택 시 미반영 공고는 목록에서 숨긴다
const POSITIONS = ["전체", "보컬", "기타", "베이스", "드럼", "건반", "관악", "현악", "그 외"];

const APPLY_STATUSES: { value: string; label: string; cls: string }[] = [
  { value: "applied", label: "검토중", cls: "bg-primary/10 text-primary" },
  { value: "accepted", label: "합격", cls: "bg-green-500/10 text-green-600" },
  { value: "rejected", label: "불합격", cls: "bg-destructive/10 text-destructive" },
];
const statusMeta = (s: string) => APPLY_STATUSES.find((x) => x.value === s) || APPLY_STATUSES[0];

/** 급구 표식 — 마감이 지난 글은 더 이상 급구로 표시하지 않는다 */
const urgentLabel = (isUrgent: boolean, deadlineAt: string | null) => {
  if (!isUrgent) return null;
  if (!deadlineAt) return "급구";
  const left = new Date(deadlineAt).getTime() - Date.now();
  if (left < 0) return null;
  const days = Math.floor(left / 86400000);
  return days === 0 ? "오늘 마감" : `급구 D-${days}`;
};



type JobItem = {
  id: string | null;
  user_id: string | null;
  title: string;
  venue: string;
  tag: string;
  pay: string;
  date: string;
  createdAt: number;
  content: string;
  isUrgent: boolean;
  deadlineAt: string | null;
  subcategory: string;
  position: string;
  schedule: string;
  image_url: string | null;
  lat: number | null;
  lng: number | null;
};

const Jobs = () => {
  useDocumentTitle("구인구직");
  const { user } = useAuth();
  const navigate = useNavigate();
  const [dbJobs, setDbJobs] = useState<any[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [selectedCat, setSelectedCat] = useState("전체");
  const [selectedPosition, setSelectedPosition] = useState("전체");
  const [query, setQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<"latest" | "oldest">("latest");
  const [selectedJob, setSelectedJob] = useState<JobItem | null>(null);

  // Edit state
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editVenue, setEditVenue] = useState("");
  const [editPay, setEditPay] = useState("");
  const [editPosition, setEditPosition] = useState("");
  const [editSchedule, setEditSchedule] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // Application state
  const [appliedJobIds, setAppliedJobIds] = useState<Set<string>>(new Set());
  const [appliedStatusByJob, setAppliedStatusByJob] = useState<Record<string, string>>({});
  const [applyTarget, setApplyTarget] = useState<JobItem | null>(null);
  const [applyMessage, setApplyMessage] = useState("");
  const [authorProfile, setAuthorProfile] = useState<ProfileCardData | null>(null);
  const [authorStats, setAuthorStats] = useState<any>(undefined);
  const [videoGateOpen, setVideoGateOpen] = useState(false);
  const [proGateOpen, setProGateOpen] = useState(false);
  const [applying, setApplying] = useState(false);
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);
  const [closing, setClosing] = useState(false);

  // 지원 취소: 작성한 지원 메시지는 복구할 수 없으므로 내용이 있을 때만 확인을 받는다.
  const discardApply = () => {
    setConfirmDiscardOpen(false);
    setApplyTarget(null);
    setApplyMessage("");
  };
  const requestDiscardApply = () => {
    if (applyMessage.trim()) setConfirmDiscardOpen(true);
    else discardApply();
  };

  // 모집 마감: 공고가 목록에서 빠지고 이후에는 작성자와 합격자만 열람할 수 있다.
  const closeJob = async () => {
    if (!selectedJob?.id || !user) return;
    setClosing(true);
    const { error } = await supabase
      .from("posts")
      .update({ status: "closed", closed_at: new Date().toISOString() } as any)
      .eq("id", selectedJob.id)
      .eq("user_id", user.id);
    setClosing(false);
    setConfirmCloseOpen(false);
    if (error) {
      toast.error("마감 처리에 실패했습니다");
      return;
    }
    toast.success("모집을 마감했습니다");
    setSelectedJob(null);
    fetchJobs();
  };

  // Owner: applicants for selected job
  const [jobApplicants, setJobApplicants] = useState<any[]>([]);
  const [loadingApplicants, setLoadingApplicants] = useState(false);
  const APPLICANTS_PAGE_SIZE = 10;
  const [applicantsVisible, setApplicantsVisible] = useState(APPLICANTS_PAGE_SIZE);
  const applicantsSentinelRef = useRef<HTMLDivElement | null>(null);
  const [applicantStatusFilter, setApplicantStatusFilter] = useState<string>("all");
  const [applicantSortOrder, setApplicantSortOrder] = useState<"newest" | "oldest">("newest");
  const [ratingTarget, setRatingTarget] = useState<{ id: string; name: string; appId: string } | null>(null);

  const filteredApplicants = jobApplicants
    .filter((a) => applicantStatusFilter === "all" ? true : a.status === applicantStatusFilter)
    .sort((a, b) => {
      const ta = new Date(a.created_at).getTime();
      const tb = new Date(b.created_at).getTime();
      return applicantSortOrder === "newest" ? tb - ta : ta - tb;
    });

  const fetchJobs = async () => {
    setLoadingJobs(true);
    // 마감된 공고는 목록에 노출하지 않는다 (합격자·작성자만 RLS로 열람 가능)
    const { data } = await supabase
      .from("posts")
      .select("*")
      .eq("post_type", "job")
      .eq("status", "open")
      .order("created_at", { ascending: false });
    setDbJobs(data || []);
    setLoadingJobs(false);
  };

  const fetchApplications = async () => {
    if (!user) { setAppliedJobIds(new Set()); setAppliedStatusByJob({}); return; }
    const { data } = await supabase
      .from("job_applications" as any)
      .select("job_id,status")
      .eq("user_id", user.id);
    const list = (data as any[]) || [];
    setAppliedJobIds(new Set(list.map((a) => a.job_id)));
    const m: Record<string, string> = {};
    list.forEach((a) => { m[a.job_id] = a.status; });
    setAppliedStatusByJob(m);
  };

  const fetchJobApplicants = async (jobId: string) => {
    setLoadingApplicants(true);
    const { data: apps } = await supabase
      .from("job_applications" as any)
      .select("*")
      .eq("job_id", jobId)
      .order("created_at", { ascending: false });
    const list = (apps as any[]) || [];
    const userIds = Array.from(new Set(list.map((a) => a.user_id)));
    let profilesById: Record<string, any> = {};
    if (userIds.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("*")
        .in("user_id", userIds);
      (profs || []).forEach((p: any) => { profilesById[p.user_id] = p; });
    }
    // 등급 배지용 집계를 한 번에 조회해 카드에 주입한다 (카드별 단건 조회 = N+1 금지)
    let statsById: Record<string, any> = {};
    if (userIds.length > 0) {
      const { data: stats } = await supabase
        .from("user_stats" as any)
        .select("*")
        .in("user_id", userIds);
      ((stats as any[]) || []).forEach((st) => { statsById[st.user_id] = st; });
    }
    setJobApplicants(list.map((a) => ({
      ...a,
      applicant: profilesById[a.user_id] || null,
      stats: statsById[a.user_id] || null,
    })));
    setLoadingApplicants(false);
  };

  const updateApplicationStatus = async (appId: string, status: string) => {
    const prev = jobApplicants;
    const target = jobApplicants.find((a) => a.id === appId);
    setJobApplicants((cur) => cur.map((a) => a.id === appId ? { ...a, status } : a));
    const { error } = await supabase.from("job_applications" as any).update({ status }).eq("id", appId);
    if (error) {
      toast.error("상태 변경 실패");
      setJobApplicants(prev);
      return;
    }
    toast.success("상태가 변경되었습니다");
    if (target && selectedJob) {
      const label = status === "accepted" ? "✅ 합격" : status === "rejected" ? "❌ 불합격" : "🔍 검토중";
      const { sendPushTo } = await import("@/lib/push");
      sendPushTo({ type: "apply_status", userId: target.user_id, jobId: String(selectedJob.id), status });
    }
  };

  useEffect(() => {
    fetchJobs();
    const handler = (e: any) => { if (e.detail?.type === "job") fetchJobs(); };
    window.addEventListener("post-created", handler);
    return () => window.removeEventListener("post-created", handler);
  }, []);

  useEffect(() => { fetchApplications(); }, [user]);

  // 상세 열람 시 최근 본 게시물 기록
  useEffect(() => {
    if (selectedJob?.id) addRecentView({ id: selectedJob.id, title: selectedJob.title, type: "job" });
  }, [selectedJob?.id]);

  // 상세의 작성자 프로필 카드(D1) 데이터 로드
  useEffect(() => {
    setAuthorProfile(null);
    setAuthorStats(undefined);
    if (!selectedJob?.user_id) return;
    supabase
      .from("profiles")
      .select("*")
      .eq("user_id", selectedJob.user_id)
      .single()
      .then(({ data }) => { if (data) setAuthorProfile(data as ProfileCardData); });
    supabase
      .from("user_stats" as any)
      .select("*")
      .eq("user_id", selectedJob.user_id)
      .maybeSingle()
      .then(({ data }) => setAuthorStats(data ?? null));
  }, [selectedJob?.user_id]);

  useEffect(() => {
    if (selectedJob?.id && selectedJob.user_id === user?.id) {
      fetchJobApplicants(selectedJob.id);
    } else {
      setJobApplicants([]);
    }
    setApplicantsVisible(APPLICANTS_PAGE_SIZE);
    setApplicantStatusFilter("all");
    setApplicantSortOrder("newest");
  }, [selectedJob, user]);

  // Reset pagination when filter/sort changes
  useEffect(() => {
    setApplicantsVisible(APPLICANTS_PAGE_SIZE);
  }, [applicantStatusFilter, applicantSortOrder]);

  // Infinite scroll: load more applicants when sentinel enters viewport
  useEffect(() => {
    const node = applicantsSentinelRef.current;
    if (!node) return;
    if (applicantsVisible >= filteredApplicants.length) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        setApplicantsVisible((v) => Math.min(v + APPLICANTS_PAGE_SIZE, filteredApplicants.length));
      }
    }, { rootMargin: "120px" });
    io.observe(node);
    return () => io.disconnect();
  }, [applicantsVisible, filteredApplicants.length, selectedJob?.id]);

  const openApply = async (job: JobItem) => {
    if (!user) { toast.error("로그인이 필요합니다"); navigate("/auth"); return; }
    if (!job.id || !job.user_id) { toast.error("샘플 공고는 지원할 수 없습니다"); return; }
    if (appliedJobIds.has(job.id)) { toast.info("이미 지원한 공고입니다"); return; }
    // A1: 연주영상 미등록이면 지원 불가 → 프로필 등록 유도
    const { data: me } = await supabase.from("profiles").select("*").eq("user_id", user.id).single();
    if (!(me as any)?.video_url) { setVideoGateOpen(true); return; }
    // 작업 8: 프로 목적인데 증빙 미인증이면 지원 불가 (RLS도 막지만 먼저 안내한다)
    if ((me as any)?.purpose === "pro" && !(me as any)?.credential_verified) {
      setProGateOpen(true);
      return;
    }
    setApplyTarget(job);
    setApplyMessage(`"${job.title}" 공고에 지원합니다. 잘 부탁드립니다!`);
  };

  const submitApply = async () => {
    if (!applyTarget?.id || !user) return;
    setApplying(true);
    const { error } = await supabase.from("job_applications" as any).insert({
      job_id: applyTarget.id,
      user_id: user.id,
      message: applyMessage.trim() || null,
    });
    setApplying(false);
    if (!error) track("job_apply");
    if (error) {
      if ((error as any).code === "23505") {
        toast.info("이미 지원한 공고입니다");
        setAppliedJobIds((prev) => new Set(prev).add(applyTarget.id!));
      } else {
        toast.error("지원에 실패했습니다: " + ((error as any).message || ""));
      }
      return;
    }

    toast.success("지원이 완료되었습니다");
    setAppliedJobIds((prev) => new Set(prev).add(applyTarget.id!));
    setAppliedStatusByJob((prev) => ({ ...prev, [applyTarget.id!]: "applied" }));
    if (applyTarget.user_id && applyTarget.user_id !== user.id) {
      const actor = user.user_metadata?.full_name || user.email?.split("@")[0] || "지원자";
      const { sendPushTo } = await import("@/lib/push");
      sendPushTo({ type: "new_applicant", userId: applyTarget.user_id, jobId: String(applyTarget.id) });
    }
    setApplyTarget(null);
    setApplyMessage("");
    setSelectedJob(null);
  };

  const allJobs: JobItem[] = [
    ...dbJobs.map((j) => ({
      id: j.id,
      user_id: j.user_id,
      title: j.title,
      venue: j.venue || "",
      tag: j.category || "기타",
      pay: j.pay || "",
      date: new Date(j.created_at).toLocaleDateString("ko-KR"),
      createdAt: new Date(j.created_at).getTime(),
      content: j.content || "",
      isUrgent: !!j.is_urgent,
      deadlineAt: j.deadline_at || null,
      subcategory: j.subcategory || "",
      position: j.position || "",
      schedule: j.schedule || "",
      image_url: j.image_url || null,
      lat: j.lat ?? null,
      lng: j.lng ?? null,
    })),
  ];

  const q = query.trim();
  const filtered = allJobs
    .filter((j) => selectedCat === "전체" || j.tag === selectedCat)
    .filter((j) => !q || j.title.includes(q) || j.venue.includes(q) || j.content.includes(q))
    // 포지션도 카테고리와 동일한 제외 필터 — 선택하면 미반영 공고는 목록에서 빠진다
    .filter((j) => selectedPosition === "전체" || j.position === selectedPosition)
    .sort((a, b) => (sortOrder === "latest" ? b.createdAt - a.createdAt : a.createdAt - b.createdAt));

  const startEditing = () => {
    if (!selectedJob) return;
    setEditTitle(selectedJob.title);
    setEditContent(selectedJob.content);
    setEditCategory(selectedJob.tag);
    setEditVenue(selectedJob.venue);
    setEditPay(selectedJob.pay);
    setEditPosition(selectedJob.position);
    setEditSchedule(selectedJob.schedule);
    setEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedJob?.id || !user) return;
    setSavingEdit(true);
    const { error } = await supabase.from("posts").update({
      title: editTitle,
      content: editContent,
      category: editCategory,
      venue: editVenue,
      pay: editPay,
      position: editPosition || null,
      schedule: editSchedule || null,
    } as any).eq("id", selectedJob.id).eq("user_id", user.id);
    setSavingEdit(false);
    if (error) { toast.error("수정에 실패했습니다"); return; }
    toast.success("게시물이 수정되었습니다");
    setEditing(false);
    setSelectedJob(null);
    fetchJobs();
  };

  const handleDelete = async () => {
    if (!selectedJob?.id || !user) return;
    if (!confirm("게시물을 삭제하시겠습니까?")) return;
    const { error } = await supabase.from("posts").delete().eq("id", selectedJob.id).eq("user_id", user.id);
    if (error) { toast.error("삭제에 실패했습니다"); return; }
    toast.success("게시물이 삭제되었습니다");
    setSelectedJob(null);
    fetchJobs();
  };

  return (
    <PageShell title="구인구직">
      <div className="relative mb-4">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="포지션, 악기, 지역 검색..."
          className="w-full h-11 pl-10 pr-4 rounded-lg bg-card border border-border text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
        />
      </div>

      <div className="flex gap-2 mb-4 overflow-x-auto no-scrollbar pb-1 items-center">
        <button
          onClick={() => setSortOrder((o) => (o === "latest" ? "oldest" : "latest"))}
          className="shrink-0 flex items-center gap-1 rounded-lg px-3 py-1.5 text-[13px] font-semibold border border-border text-muted-foreground hover:border-primary transition-colors active:scale-95"
        >
          <ArrowUpDown className="w-3 h-3" />
          {sortOrder === "latest" ? "최신순" : "오래된순"}
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCat(cat)}
            className={`shrink-0 rounded-lg px-3.5 py-1.5 text-[13px] font-semibold transition-colors active:scale-95 ${
              cat === selectedCat ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground hover:border-primary"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* A6: 포지션 우선 노출 — 선택해도 다른 공고는 숨기지 않고 아래에 계속 표시 */}
      <div className="flex gap-2 mb-6 overflow-x-auto no-scrollbar pb-1 items-center">
        <span className="shrink-0 font-mono text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">포지션</span>
        {POSITIONS.map((pos) => (
          <button
            key={pos}
            onClick={() => setSelectedPosition(pos)}
            className={`shrink-0 rounded-lg px-3 py-1 text-[12px] font-semibold transition-colors active:scale-95 ${
              pos === selectedPosition
                ? "border border-primary text-primary"
                : "border border-border text-muted-foreground hover:border-primary"
            }`}
          >
            {pos}
          </button>
        ))}
        {selectedPosition !== "전체" && (
          <span className="shrink-0 text-[10px] text-muted-foreground">· {selectedPosition} 공고만 표시 중</span>
        )}
      </div>

      <div className="flex items-baseline justify-between pb-3 border-b-2 border-foreground mb-4">
        <h2 className="text-lg lg:text-[19px] font-extrabold tracking-tight">전체 공고</h2>
        <span className="font-mono text-[13px] font-semibold text-muted-foreground tabular-nums">{filtered.length}건</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 items-start">
        {loadingJobs ? [...Array(4)].map((_, i) => <JobCardSkeleton key={i} />) : null}
        {!loadingJobs && filtered.map((job, i) => (
          <div
            key={job.id || `sample-${i}`}
            onClick={() => {
              if (!user) { toast.error("자세히 보려면 로그인이 필요합니다"); navigate("/auth"); return; }
              setSelectedJob(job); setEditing(false);
            }}
            className="glass-card overflow-hidden hover:border-primary transition-colors duration-200 cursor-pointer active:scale-[0.98]"
            style={{ animation: `reveal 0.5s cubic-bezier(0.16,1,0.3,1) ${i * 0.06}s both` }}
          >
            {job.image_url && (
              <img src={job.image_url} alt={job.title} className="w-full h-36 object-cover" loading="lazy" />
            )}
            <div className="p-4">
            <div className="flex items-start justify-between gap-2 mb-2">
              <h3 className="text-[15px] font-bold tracking-tight leading-snug">{job.title}</h3>
              <span className="font-mono text-[10.5px] font-bold tracking-wide px-2 py-1 rounded bg-secondary text-secondary-foreground shrink-0">{job.tag}</span>
            </div>
            <p className="text-[12.5px] text-muted-foreground">{job.venue}</p>
            {(job.position || job.schedule) && (
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                {urgentLabel(job.isUrgent, job.deadlineAt) && (
                  <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber/15 text-amber">
                    {urgentLabel(job.isUrgent, job.deadlineAt)}
                  </span>
                )}
                {job.subcategory && (
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-secondary text-secondary-foreground">
                    {job.subcategory}
                  </span>
                )}
                {job.position && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-secondary text-secondary-foreground">
                    🎯 {job.position}
                  </span>
                )}
                {job.schedule && (
                  <span className="text-[10px] text-muted-foreground">🕐 {job.schedule}</span>
                )}
              </div>
            )}
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
              <span className="text-[13px] font-bold font-mono text-primary">{job.pay}</span>
              <span className="text-[10px] text-muted-foreground font-mono tabular-nums">{job.date}</span>
            </div>
            {job.id ? (
              job.user_id === user?.id ? (
                <button
                  onClick={(e) => { e.stopPropagation(); setSelectedJob(job); setEditing(false); }}
                  className="mt-3 w-full h-9 rounded-lg text-xs font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 active:scale-[0.98] transition-all"
                >
                  내 공고 · 지원자 보기
                </button>
              ) : (
                (() => {
                  const applied = appliedJobIds.has(job.id);
                  const meta = applied ? statusMeta(appliedStatusByJob[job.id!] || "applied") : null;
                  return (
                    <button
                      onClick={(e) => { e.stopPropagation(); if (applied) return; openApply(job); }}
                      disabled={applied}
                      className={`mt-3 w-full h-9 rounded-lg text-xs font-medium active:scale-[0.98] transition-all ${
                        applied
                          ? "bg-secondary text-muted-foreground cursor-default"
                          : "bg-action text-action-foreground hover:bg-action-hover"
                      }`}
                    >
                      {applied && meta ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Check className="w-3.5 h-3.5" /> 지원 완료
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${meta.cls}`}>{meta.label}</span>
                        </span>
                      ) : "지원하기"}
                    </button>
                  );
                })()
              )
            ) : null}
            </div>
          </div>
        ))}
        {!loadingJobs && filtered.length === 0 && <div className="col-span-full text-center py-12 text-muted-foreground text-sm">구인글이 없습니다</div>}
      </div>

      

      {/* Detail Modal */}
      {selectedJob && (
        <div className="fixed inset-0 z-[9999] bg-black/40 flex items-end lg:items-center justify-center" onClick={() => { setSelectedJob(null); setEditing(false); }}>
          <div
            className="w-full max-w-lg bg-background rounded-t-2xl lg:rounded-xl max-h-sheet flex flex-col animate-in slide-in-from-bottom duration-300 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <button onClick={() => { setSelectedJob(null); setEditing(false); }} className="p-1 rounded-full hover:bg-secondary">
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-2">
                  {selectedJob.id && selectedJob.user_id === user?.id && !editing && (
                    <>
                      <button onClick={startEditing} className="p-1.5 rounded-full hover:bg-secondary text-muted-foreground hover:text-primary transition-colors">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={handleDelete} className="p-1.5 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                  <span className="font-mono text-[10.5px] font-bold tracking-wide px-2 py-1 rounded bg-secondary text-secondary-foreground">
                    {editing ? editCategory : selectedJob.tag}
                  </span>
                </div>
              </div>

              {editing ? (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">카테고리</label>
                    <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={editCategory} onChange={(e) => setEditCategory(e.target.value)}>
                      {["공연", "녹음", "레슨", "행사", "기타"].map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">제목</label>
                    <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">장소</label>
                    <input value={editVenue} onChange={(e) => setEditVenue(e.target.value)} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">모집 포지션</label>
                    <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={editPosition} onChange={(e) => setEditPosition(e.target.value)}>
                      <option value="">선택 안 함</option>
                      {POSITIONS.filter((p) => p !== "전체").map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">합주 요일/시간</label>
                    <input value={editSchedule} onChange={(e) => setEditSchedule(e.target.value)} placeholder="예: 주말 오후, 협의 가능" className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">급여/페이</label>
                    <input value={editPay} onChange={(e) => setEditPay(e.target.value)} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">상세 내용</label>
                    <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} rows={5} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
                  </div>
                  <div className="flex gap-2 pb-4">
                    <button onClick={() => setEditing(false)} className="flex-1 h-10 rounded-lg border border-border text-sm font-medium hover:bg-secondary transition-colors">취소</button>
                    <button onClick={handleSaveEdit} disabled={savingEdit} className="flex-1 h-10 rounded-lg bg-action text-action-foreground text-sm font-medium hover:bg-action-hover disabled:opacity-50 active:scale-95 transition-all">
                      {savingEdit ? "저장 중..." : "저장"}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {selectedJob.image_url && (
                    <div className="rounded-lg overflow-hidden mb-4 -mt-1">
                      <img src={selectedJob.image_url} alt={selectedJob.title} className="w-full max-h-56 object-cover" />
                    </div>
                  )}
                  {authorProfile && (
                    <div className="mb-3 p-3 rounded-lg border border-border bg-card">
                      <ProfileCard profile={authorProfile} stats={authorStats} variant="compact" onBeforeNavigate={() => setSelectedJob(null)} />
                    </div>
                  )}
                  <h2 className="text-lg font-extrabold tracking-tight mb-2">{selectedJob.title}</h2>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground mb-3">
                    {selectedJob.subcategory && (
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-secondary text-secondary-foreground">{selectedJob.subcategory}</span>
                    )}
                    {selectedJob.position && (
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-primary/10 text-primary">🎯 {selectedJob.position}</span>
                    )}
                    {selectedJob.schedule && <span>🕐 {selectedJob.schedule}</span>}
                    {selectedJob.venue && <span>📍 {selectedJob.venue}</span>}
                    {selectedJob.pay && <span>💰 {selectedJob.pay}</span>}
                    {hasDirections(selectedJob.lat, selectedJob.lng, selectedJob.venue) && (
                      <button
                        onClick={() =>
                          window.open(
                            selectedJob.lat != null && selectedJob.lng != null
                              ? naverDirectionsUrl(selectedJob.venue || selectedJob.title, selectedJob.lat, selectedJob.lng)
                              : naverDirectionsUrl(selectedJob.venue),
                            "_blank", "noopener",
                          )
                        }
                        className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg bg-primary/10 text-primary hover:bg-primary/15 transition-colors active:scale-95"
                      >
                        <Navigation className="w-3 h-3" /> 길찾기
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground mb-4">{selectedJob.date}</p>
                  {selectedJob.content ? (
                    <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{selectedJob.content}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">상세 내용이 없습니다.</p>
                  )}
                  {/* 액션 영역: 작성자 정보가 있고 본인 글이 아닐 때만 노출 (샘플/본인 글은 숨김) */}
                  {!!selectedJob.user_id && selectedJob.user_id !== user?.id && (
                    /* 상세 내용이 길면 지원 CTA가 접힘선 아래로 밀리므로 패널 하단에 고정한다 */
                    <div className="mt-5 flex gap-2 sticky bottom-0 z-10 -mx-5 px-5 pt-3 pb-1 bg-background/95 backdrop-blur-sm border-t border-border/40">
                      <button
                        onClick={() => {
                          if (!user) { toast.error("로그인이 필요합니다"); navigate("/auth"); return; }
                          navigate(`/messages?to=${selectedJob.user_id}`);
                        }}
                        className="flex-1 h-11 rounded-lg border border-border text-secondary-foreground text-sm font-semibold hover:border-primary active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                      >
                        <MessageCircle className="w-4 h-4" /> 메시지
                      </button>
                      {(() => {
                        const applied = !!selectedJob.id && appliedJobIds.has(selectedJob.id);
                        const meta = applied ? statusMeta(appliedStatusByJob[selectedJob.id!] || "applied") : null;
                        return (
                          <button
                            onClick={() => { if (!applied) openApply(selectedJob); }}
                            disabled={applied}
                            className={`flex-1 h-11 rounded-lg text-sm font-semibold active:scale-[0.98] transition-all ${
                              applied
                                ? "bg-secondary text-muted-foreground cursor-default"
                                : "bg-action text-action-foreground hover:bg-action-hover"
                            }`}
                          >
                            {applied && meta ? (
                              <span className="inline-flex items-center justify-center gap-1.5">
                                <Check className="w-4 h-4" /> 지원 완료
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${meta.cls}`}>{meta.label}</span>
                              </span>
                            ) : "지원하기"}
                          </button>
                        );
                      })()}
                    </div>
                  )}

                  {selectedJob.id && selectedJob.user_id === user?.id && (
                    <div className="mt-5 pt-4 border-t border-border">
                      <button
                        onClick={() => setConfirmCloseOpen(true)}
                        className="w-full h-11 mb-4 rounded-lg border border-border text-sm font-semibold text-muted-foreground hover:border-primary hover:text-foreground active:scale-[0.98] transition-all"
                      >
                        모집 마감하기
                      </button>
                      <div className="flex items-baseline justify-between gap-2 pb-2.5 border-b-2 border-foreground mb-3">
                        <h3 className="text-base font-extrabold tracking-tight">받은 지원</h3>
                        <span className="font-mono text-[12px] font-semibold text-muted-foreground tabular-nums">
                          {filteredApplicants.length}{applicantStatusFilter !== "all" ? ` / ${jobApplicants.length}` : ""}
                        </span>
                      </div>
                      {jobApplicants.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2 mb-3">
                          <div className="flex flex-wrap gap-1">
                            {[{ value: "all", label: "전체" }, ...APPLY_STATUSES].map((s) => {
                              const active = applicantStatusFilter === s.value;
                              const count = s.value === "all"
                                ? jobApplicants.length
                                : jobApplicants.filter((a) => a.status === s.value).length;
                              return (
                                <button
                                  key={s.value}
                                  type="button"
                                  onClick={() => setApplicantStatusFilter(s.value)}
                                  className={`h-7 px-2.5 rounded-lg text-[11px] font-semibold transition-colors ${
                                    active
                                      ? "bg-primary text-primary-foreground"
                                      : "border border-border text-muted-foreground hover:border-primary"
                                  }`}
                                >
                                  {s.label} {count}
                                </button>
                              );
                            })}
                          </div>
                          <select
                            value={applicantSortOrder}
                            onChange={(e) => setApplicantSortOrder(e.target.value as "newest" | "oldest")}
                            className="ml-auto h-7 rounded-md border border-input bg-background px-2 text-[11px] outline-none focus:ring-2 focus:ring-primary/30"
                          >
                            <option value="newest">최신 지원순</option>
                            <option value="oldest">오래된 지원순</option>
                          </select>
                        </div>
                      )}
                      {loadingApplicants ? (
                        <p className="text-xs text-muted-foreground py-2">불러오는 중...</p>
                      ) : jobApplicants.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-2">아직 받은 지원이 없습니다.</p>
                      ) : filteredApplicants.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-2">선택한 상태에 해당하는 지원이 없습니다.</p>
                      ) : (
                        <div className="space-y-2">
                          {filteredApplicants.slice(0, applicantsVisible).map((a) => {
                            const meta = statusMeta(a.status);
                            return (
                              <div key={a.id} className="p-3 rounded-lg border border-border bg-card space-y-2">
                                <div className="flex items-center gap-2">
                                  <ProfileCard
                                    stats={a.stats}
                                    profile={(a.applicant as ProfileCardData) || null}
                                    variant="compact"
                                    onBeforeNavigate={() => setSelectedJob(null)}
                                    className="flex-1"
                                  />
                                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 ${meta.cls}`}>{meta.label}</span>
                                </div>
                                {a.message && (
                                  <p className="text-xs text-muted-foreground whitespace-pre-wrap">{a.message}</p>
                                )}
                                <div className="flex items-center gap-2 pt-1">
                                  <span className="text-[10px] text-muted-foreground">{new Date(a.created_at).toLocaleDateString("ko-KR")}</span>
                                  <select
                                    value={a.status}
                                    onChange={(e) => updateApplicationStatus(a.id, e.target.value)}
                                    className="ml-auto h-8 rounded-md border border-input bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-primary/30"
                                  >
                                    {APPLY_STATUSES.map((s) => (
                                      <option key={s.value} value={s.value}>{s.label}</option>
                                    ))}
                                  </select>
                                  <button
                                    onClick={() => navigate(`/messages?to=${a.user_id}`)}
                                    className="h-8 px-2 rounded-md bg-secondary text-secondary-foreground text-xs hover:bg-surface-hover transition-colors flex items-center gap-1"
                                  >
                                    <MessageCircle className="w-3 h-3" /> 메시지
                                  </button>
                                  {a.status === "accepted" && (
                                    <button
                                      onClick={() => setRatingTarget({ id: a.user_id, name: a.applicant?.display_name || "지원자", appId: a.id })}
                                      className="h-8 px-2 rounded-md bg-primary/10 text-primary text-xs hover:bg-primary/15 transition-colors flex items-center gap-1"
                                    >
                                      <Star className="w-3 h-3" /> 후기
                                    </button>
                                  )}
                                </div>
                                {a.status === "accepted" && (
                                  <button
                                    onClick={() => { setSelectedJob(null); navigate(`/first-rehearsal/${a.id}`); }}
                                    className="w-full h-8 rounded-md bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center gap-1 hover:bg-primary/15 transition-colors"
                                  >
                                    <CalendarHeart className="w-3.5 h-3.5" /> 첫 합주 잡기
                                  </button>
                                )}
                              </div>
                            );
                          })}
                          {applicantsVisible < filteredApplicants.length ? (
                            <div ref={applicantsSentinelRef} className="py-3 text-center text-[11px] text-muted-foreground">
                              더 불러오는 중... ({applicantsVisible}/{filteredApplicants.length})
                            </div>
                          ) : filteredApplicants.length > APPLICANTS_PAGE_SIZE ? (
                            <p className="py-2 text-center text-[11px] text-muted-foreground">모든 지원자를 불러왔습니다</p>
                          ) : null}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <Dialog open={!!applyTarget} onOpenChange={(o) => { if (!o) requestDiscardApply(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>구인 지원</DialogTitle>
            <DialogDescription>
              {applyTarget && (
                <>
                  <span className="block font-medium text-foreground">{applyTarget.title}</span>
                  <span className="block text-xs mt-1">{applyTarget.venue}{applyTarget.pay ? ` · ${applyTarget.pay}` : ""}</span>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-xs font-medium">지원 메시지 (선택)</label>
            <Textarea
              value={applyMessage}
              onChange={(e) => setApplyMessage(e.target.value)}
              placeholder="자기소개나 가능한 일정 등을 적어주세요"
              rows={4}
            />
          </div>
          {/* 주 액션(채움)을 위에 두고 취소는 텍스트 링크로 강등 — 24px 이격으로 오탭 방지 */}
          <DialogFooter className="flex flex-col sm:flex-col sm:justify-normal sm:space-x-0 pt-2">
            <button
              onClick={submitApply}
              disabled={applying}
              className="w-full h-12 rounded-lg bg-action text-action-foreground text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {applying ? "지원 중..." : "지원 완료"}
            </button>
            <button
              onClick={requestDiscardApply}
              disabled={applying}
              className="mt-6 self-center px-4 py-3 text-sm font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground transition-colors disabled:opacity-50"
            >
              취소
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 지원 취소 확인 — 작성한 지원 메시지가 사라진다 */}
      <AlertDialog open={confirmDiscardOpen} onOpenChange={setConfirmDiscardOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>지원을 취소할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              작성 중인 지원 메시지는 저장되지 않고 사라집니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>계속 작성</AlertDialogCancel>
            <AlertDialogAction onClick={discardApply}>취소하기</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 모집 마감 확인 — 마감 후에는 공고가 목록에서 사라진다 */}
      <AlertDialog open={confirmCloseOpen} onOpenChange={setConfirmCloseOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>모집을 마감할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              마감하면 이 공고는 구인 목록에서 사라지고, 이후에는 나와 합격자만 볼 수 있습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={closing}>돌아가기</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); closeJob(); }} disabled={closing}>
              {closing ? "마감 중..." : "마감하기"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 작업 8: 프로 증빙 미인증 게이트 */}
      <AlertDialog open={proGateOpen} onOpenChange={setProGateOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>프로 인증이 필요합니다</AlertDialogTitle>
            <AlertDialogDescription>
              활동 목적이 "프로"인 경우 졸업장·합격증·입상내역 중 1건을 인증해야 구인글 작성과 지원이 가능합니다.
              프로필에서 증빙을 제출해주세요.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>나중에</AlertDialogCancel>
            <AlertDialogAction onClick={() => navigate("/profile")}>프로필로 이동</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* A1: 연주영상 등록 유도 게이트 */}
      {videoGateOpen && (
        <div className="fixed inset-0 z-[9999] bg-black/40 flex items-end lg:items-center justify-center" onClick={() => setVideoGateOpen(false)}>
          <div
            className="w-full max-w-sm bg-background rounded-t-2xl lg:rounded-2xl p-6 animate-in slide-in-from-bottom duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-extrabold tracking-tight mb-2">연주영상을 등록해야 지원할 수 있어요</h3>
            <p className="text-sm text-muted-foreground mb-5">
              공고 작성자는 지원자의 연주영상을 보고 판단합니다. 프로필에 YouTube 또는 Instagram 영상 링크 1개를 등록해주세요.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setVideoGateOpen(false)}
                className="flex-1 h-11 rounded-lg border border-border text-secondary-foreground text-sm font-semibold hover:border-primary transition-colors"
              >
                나중에
              </button>
              <button
                onClick={() => { setVideoGateOpen(false); navigate("/profile"); }}
                className="flex-1 h-11 rounded-lg bg-action text-action-foreground text-sm font-semibold hover:bg-action-hover active:scale-[0.98] transition-all"
              >
                프로필에서 등록하기
              </button>
            </div>
          </div>
        </div>
      )}

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

export default Jobs;
