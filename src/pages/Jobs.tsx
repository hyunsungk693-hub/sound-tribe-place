import { Search, SlidersHorizontal, ArrowLeft, Pencil, Trash2, MessageCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import PageShell from "@/components/PageShell";
import CreatePostDialog from "@/components/CreatePostDialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { JobCardSkeleton } from "@/components/skeletons/PostSkeleton";

const categories = ["전체", "공연", "녹음", "레슨", "행사", "기타"];

const SAMPLE_AUTHORS = [
  "4cef9ad6-633d-42b6-adf6-a352853b05a5",
  "c2c088e8-341c-46f4-b0cf-b7683f35f0e8",
  "4552f73b-5d17-436f-9c39-4f29d7a3320b",
];

const sampleJobs = [
  { id: null, user_id: SAMPLE_AUTHORS[0], title: "밴드 기타리스트 모집", venue: "홍대 라이브클럽", tag: "공연", pay: "회당 15만원", date: "3일 전", content: "" },
  { id: null, user_id: SAMPLE_AUTHORS[1], title: "레코딩 세션 드러머", venue: "강남 A스튜디오", tag: "녹음", pay: "곡당 10만원", date: "5일 전", content: "" },
  { id: null, user_id: SAMPLE_AUTHORS[2], title: "웨딩 싱어 구함", venue: "서울 전 지역", tag: "행사", pay: "회당 20만원", date: "1주일 전", content: "" },
  { id: null, user_id: SAMPLE_AUTHORS[0], title: "피아노 레슨 선생님", venue: "분당 음악학원", tag: "레슨", pay: "월 200만원", date: "2일 전", content: "" },
  { id: null, user_id: SAMPLE_AUTHORS[1], title: "뮤지컬 오케스트라 바이올린", venue: "대학로 소극장", tag: "공연", pay: "협의", date: "오늘", content: "" },
  { id: null, user_id: SAMPLE_AUTHORS[2], title: "교회 찬양팀 베이스", venue: "여의도", tag: "기타", pay: "주 1회 봉사", date: "4일 전", content: "" },
];

const jobFields = [
  { key: "title", label: "제목", placeholder: "예: 밴드 기타리스트 모집" },
  { key: "content", label: "상세 내용", placeholder: "구인 상세 내용을 작성해주세요", type: "textarea" as const },
  { key: "category", label: "카테고리", placeholder: "", type: "select" as const, options: ["공연", "녹음", "레슨", "행사", "기타"] },
  { key: "venue", label: "장소", placeholder: "예: 홍대 라이브클럽" },
  { key: "pay", label: "급여/페이", placeholder: "예: 회당 15만원" },
  { key: "author_name", label: "작성자명", placeholder: "닉네임" },
  { key: "location", label: "지도 위치 (선택)", placeholder: "", type: "location" as const },
];

type JobItem = {
  id: string | null;
  user_id: string | null;
  title: string;
  venue: string;
  tag: string;
  pay: string;
  date: string;
  content: string;
};

const Jobs = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [dbJobs, setDbJobs] = useState<any[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [selectedCat, setSelectedCat] = useState("전체");
  const [selectedJob, setSelectedJob] = useState<JobItem | null>(null);

  // Edit state
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editVenue, setEditVenue] = useState("");
  const [editPay, setEditPay] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const fetchJobs = async () => {
    setLoadingJobs(true);
    const { data } = await supabase.from("posts").select("*").eq("post_type", "job").order("created_at", { ascending: false });
    setDbJobs(data || []);
    setLoadingJobs(false);
  };

  useEffect(() => {
    fetchJobs();
    const handler = (e: any) => { if (e.detail?.type === "job") fetchJobs(); };
    window.addEventListener("post-created", handler);
    return () => window.removeEventListener("post-created", handler);
  }, []);

  const allJobs: JobItem[] = [
    ...dbJobs.map((j) => ({
      id: j.id,
      user_id: j.user_id,
      title: j.title,
      venue: j.venue || "",
      tag: j.category || "기타",
      pay: j.pay || "",
      date: new Date(j.created_at).toLocaleDateString("ko-KR"),
      content: j.content || "",
    })),
    ...sampleJobs,
  ];

  const filtered = selectedCat === "전체" ? allJobs : allJobs.filter((j) => j.tag === selectedCat);

  const startEditing = () => {
    if (!selectedJob) return;
    setEditTitle(selectedJob.title);
    setEditContent(selectedJob.content);
    setEditCategory(selectedJob.tag);
    setEditVenue(selectedJob.venue);
    setEditPay(selectedJob.pay);
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
    }).eq("id", selectedJob.id).eq("user_id", user.id);
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
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input type="text" placeholder="포지션, 악기, 지역 검색..." className="w-full h-11 pl-10 pr-10 rounded-xl bg-secondary border-none text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition-shadow" />
        <button className="absolute right-3 top-1/2 -translate-y-1/2 active:scale-90 transition-transform">
          <SlidersHorizontal className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      <div className="flex gap-2 mb-5 overflow-x-auto no-scrollbar pb-1">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCat(cat)}
            className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-200 active:scale-95 ${
              cat === selectedCat ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-surface-hover"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {loadingJobs ? [...Array(4)].map((_, i) => <JobCardSkeleton key={i} />) : null}
        {!loadingJobs && filtered.map((job, i) => (
          <div
            key={job.id || `sample-${i}`}
            onClick={() => { setSelectedJob(job); setEditing(false); }}
            className="glass-card p-4 hover:bg-surface-hover transition-colors duration-200 cursor-pointer active:scale-[0.98]"
            style={{ animation: `reveal 0.5s cubic-bezier(0.16,1,0.3,1) ${i * 0.06}s both` }}
          >
            <div className="flex items-start justify-between mb-2">
              <h3 className="text-sm font-semibold">{job.title}</h3>
              <span className="text-[10px] font-medium px-2.5 py-1 rounded-full bg-primary/10 text-primary shrink-0 ml-2">{job.tag}</span>
            </div>
            <p className="text-xs text-muted-foreground">{job.venue}</p>
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/30">
              <span className="text-xs font-medium text-primary">{job.pay}</span>
              <span className="text-[10px] text-muted-foreground">{job.date}</span>
            </div>
          </div>
        ))}
        {!loadingJobs && filtered.length === 0 && <div className="text-center py-10 text-muted-foreground text-sm">구인글이 없습니다</div>}
      </div>

      <CreatePostDialog postType="job" fields={jobFields} onCreated={fetchJobs} />

      {/* Detail Modal */}
      {selectedJob && (
        <div className="fixed inset-0 z-[9999] bg-black/40 flex items-end justify-center" onClick={() => { setSelectedJob(null); setEditing(false); }}>
          <div
            className="w-full max-w-lg bg-background rounded-t-2xl max-h-[85vh] flex flex-col animate-in slide-in-from-bottom duration-300 overflow-y-auto"
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
                  <span className="text-[10px] font-medium px-2.5 py-1 rounded-full bg-primary/10 text-primary">
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
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">급여/페이</label>
                    <input value={editPay} onChange={(e) => setEditPay(e.target.value)} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">상세 내용</label>
                    <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} rows={5} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
                  </div>
                  <div className="flex gap-2 pb-4">
                    <button onClick={() => setEditing(false)} className="flex-1 h-10 rounded-lg border border-border text-sm font-medium hover:bg-secondary transition-colors">취소</button>
                    <button onClick={handleSaveEdit} disabled={savingEdit} className="flex-1 h-10 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 active:scale-95 transition-all">
                      {savingEdit ? "저장 중..." : "저장"}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <h2 className="text-base font-bold mb-2">{selectedJob.title}</h2>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                    {selectedJob.venue && <span>📍 {selectedJob.venue}</span>}
                    {selectedJob.pay && <span>💰 {selectedJob.pay}</span>}
                  </div>
                  <p className="text-[10px] text-muted-foreground mb-4">{selectedJob.date}</p>
                  {selectedJob.content ? (
                    <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{selectedJob.content}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">상세 내용이 없습니다.</p>
                  )}
                  {selectedJob.user_id !== user?.id && (
                    <button
                      onClick={() => {
                        if (!user) { toast.error("로그인이 필요합니다"); navigate("/auth"); return; }
                        if (!selectedJob.user_id) { toast.error("샘플 공고는 메시지를 보낼 수 없습니다"); return; }
                        navigate(`/messages?to=${selectedJob.user_id}`);
                      }}
                      className="mt-5 w-full h-11 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                    >
                      <MessageCircle className="w-4 h-4" /> 메시지 보내기
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
};

export default Jobs;
