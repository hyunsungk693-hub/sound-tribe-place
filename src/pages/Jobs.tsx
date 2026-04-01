import { Search, SlidersHorizontal } from "lucide-react";
import { useState, useEffect } from "react";
import PageShell from "@/components/PageShell";
import CreatePostDialog from "@/components/CreatePostDialog";
import { supabase } from "@/integrations/supabase/client";

const categories = ["전체", "공연", "녹음", "레슨", "행사", "기타"];

const sampleJobs = [
  { title: "밴드 기타리스트 모집", venue: "홍대 라이브클럽", tag: "공연", pay: "회당 15만원", date: "3일 전" },
  { title: "레코딩 세션 드러머", venue: "강남 A스튜디오", tag: "녹음", pay: "곡당 10만원", date: "5일 전" },
  { title: "웨딩 싱어 구함", venue: "서울 전 지역", tag: "행사", pay: "회당 20만원", date: "1주일 전" },
  { title: "피아노 레슨 선생님", venue: "분당 음악학원", tag: "레슨", pay: "월 200만원", date: "2일 전" },
  { title: "뮤지컬 오케스트라 바이올린", venue: "대학로 소극장", tag: "공연", pay: "협의", date: "오늘" },
  { title: "교회 찬양팀 베이스", venue: "여의도", tag: "기타", pay: "주 1회 봉사", date: "4일 전" },
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

const Jobs = () => {
  const [dbJobs, setDbJobs] = useState<any[]>([]);
  const [selectedCat, setSelectedCat] = useState("전체");

  const fetchJobs = async () => {
    const { data } = await supabase.from("posts").select("*").eq("post_type", "job").order("created_at", { ascending: false });
    setDbJobs(data || []);
  };

  useEffect(() => { fetchJobs(); }, []);

  const allJobs = [
    ...dbJobs.map((j) => ({
      title: j.title,
      venue: j.venue || "",
      tag: j.category || "기타",
      pay: j.pay || "",
      date: new Date(j.created_at).toLocaleDateString("ko-KR"),
    })),
    ...sampleJobs,
  ];

  const filtered = selectedCat === "전체" ? allJobs : allJobs.filter((j) => j.tag === selectedCat);

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
        {filtered.map((job, i) => (
          <div key={i} className="glass-card p-4 hover:bg-surface-hover transition-colors duration-200 cursor-pointer active:scale-[0.98]" style={{ animation: `reveal 0.5s cubic-bezier(0.16,1,0.3,1) ${i * 0.06}s both` }}>
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
      </div>

      <CreatePostDialog postType="job" fields={jobFields} onCreated={fetchJobs} />
    </PageShell>
  );
};

export default Jobs;
