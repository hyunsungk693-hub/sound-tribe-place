import { Briefcase, Music2, Store, MessageCircle, Heart, MessageSquare, ChevronRight, Zap, MapPin } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import PageShell from "@/components/PageShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { HomeSkeleton } from "@/components/skeletons/PostSkeleton";
import NotificationsPanel, { useUnreadCount } from "@/components/NotificationsPanel";
import banner1 from "@/assets/banner-1.png";
import banner3 from "@/assets/banner-3.jpg";
import banner4 from "@/assets/banner-4.jpg";

// 채널 스트립 카테고리 — 라인 픽토그램 + 볼드 타이포
const categories = [
  { icon: Briefcase, label: "구인구직", path: "/jobs" },
  { icon: Music2, label: "연습실", path: "/rooms" },
  { icon: Store, label: "악기사", path: "/shops" },
  { icon: MessageCircle, label: "커뮤니티", path: "/community" },
];

const adBanners = [
  { title: "instrut", desc: "믿을 수 있는 밴드·세션 멤버 찾기", image: banner1, path: "/jobs" },
  { title: "instrut", desc: "합주할 공간이 필요하다면, 연습실 찾기", image: banner3, path: "/rooms" },
  { title: "instrut", desc: "음악인들과 자유롭게 이야기 나누기", image: banner4, path: "/community" },
];

// VU 미터 — 세그먼트 게이지 (0~1)
const VuMeter = ({ level, segs = 7 }: { level: number; segs?: number }) => {
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

const tierLevel = (tier?: string) => (tier === "A" ? 1 : tier === "B" ? 0.7 : tier === "C" ? 0.45 : 0.55);

const Index = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [currentBanner, setCurrentBanner] = useState(0);
  const [recentJobs, setRecentJobs] = useState<any[]>([]);
  const [popularPosts, setPopularPosts] = useState<any[]>([]);
  const [studios, setStudios] = useState<any[]>([]);
  const [openJobCount, setOpenJobCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [notiOpen, setNotiOpen] = useState(false);
  const { count: unreadCount } = useUnreadCount();

  const fetchData = async () => {
    setLoading(true);
    const [jobRes, commRes, studioRes, jobCountRes] = await Promise.all([
      supabase.from("posts").select("id,title,venue,category").eq("post_type", "job").order("created_at", { ascending: false }).limit(4),
      supabase.from("posts").select("id,title,content,author_name").eq("post_type", "community").order("created_at", { ascending: false }).limit(12),
      (supabase as any).from("studios").select("id,name,address,tier").eq("tier", "A").limit(3),
      supabase.from("posts").select("id", { count: "exact", head: true }).eq("post_type", "job"),
    ]);
    setRecentJobs(jobRes.data || []);
    setStudios(studioRes.data || []);
    setOpenJobCount(jobCountRes.count ?? (jobRes.data?.length ?? 0));

    // 커뮤니티 인기글: 좋아요·댓글 수 합산 상위
    const comm = commRes.data || [];
    const ids = comm.map((p: any) => p.id);
    if (ids.length) {
      const [likesRes, cmtsRes] = await Promise.all([
        supabase.from("post_likes").select("post_id").in("post_id", ids),
        supabase.from("post_comments").select("post_id").in("post_id", ids),
      ]);
      const score: Record<string, { likes: number; comments: number }> = {};
      ids.forEach((id: string) => (score[id] = { likes: 0, comments: 0 }));
      (likesRes.data || []).forEach((l: any) => { if (score[l.post_id]) score[l.post_id].likes++; });
      (cmtsRes.data || []).forEach((c: any) => { if (score[c.post_id]) score[c.post_id].comments++; });
      const ranked = [...comm]
        .map((p: any) => ({ ...p, ...score[p.id] }))
        .sort((a, b) => (b.likes + b.comments) - (a.likes + a.comments))
        .slice(0, 4);
      setPopularPosts(ranked);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    const timer = setInterval(() => {
      setCurrentBanner((prev) => (prev + 1) % adBanners.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  return (
    <PageShell>
      <div className="lg:max-w-3xl lg:mx-auto">
      {/* 모바일 상단 헤더: 워드마크 + 알림/로그인 */}
      <div
        className="lg:hidden sticky top-0 z-40 -mx-4 px-4 pb-3 bg-background/95 backdrop-blur-lg border-b border-border mb-5"
        style={{ paddingTop: "calc(1.25rem + var(--safe-top, 0px))" }}
      >
        <header className="flex items-center justify-between">
          <h1 className="text-[1.6rem] font-extrabold tracking-tight text-foreground leading-none">
            instrut<span className="text-primary">.</span>
          </h1>
          {user ? (
            <button
              onClick={() => setNotiOpen(true)}
              className="relative text-sm font-medium text-muted-foreground hover:text-foreground transition-colors active:scale-95 pr-1"
            >
              알림
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-2 min-w-[15px] h-[15px] px-1 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[9px] font-bold font-mono">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </button>
          ) : (
            <button onClick={() => navigate("/auth")} className="px-4 h-9 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors active:scale-95">
              로그인
            </button>
          )}
        </header>
      </div>

      {loading ? <HomeSkeleton /> : <>
      {/* 배너 캐러셀 */}
      <section className="mb-6" style={{ animation: "reveal 0.5s cubic-bezier(0.16,1,0.3,1) both" }}>
        <div className="relative overflow-hidden rounded-lg">
          <div className="flex transition-transform duration-500 ease-out" style={{ transform: `translateX(-${currentBanner * 100}%)` }}>
            {adBanners.map((banner, i) => (
              <div key={i} onClick={() => navigate(banner.path)} className="w-full shrink-0 relative overflow-hidden cursor-pointer active:scale-[0.98] transition-transform min-h-[210px] lg:min-h-[280px]">
                <img src={banner.image} alt={banner.title} className="w-full h-full object-cover absolute inset-0" loading="lazy" />
                <div className="relative z-10 p-6 lg:p-8 flex flex-col justify-end min-h-[210px] lg:min-h-[280px] bg-gradient-to-t from-black/65 to-transparent">
                  <p className="text-xs lg:text-sm text-white/80 font-mono uppercase tracking-widest">{banner.title}</p>
                  <p className="font-bold text-xl lg:text-2xl text-white leading-tight tracking-tight">{banner.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex gap-1.5">
            {adBanners.map((_, i) => (
              <button key={i} onClick={() => setCurrentBanner(i)} className={`h-1 rounded-full transition-all duration-300 ${i === currentBanner ? "bg-primary w-5" : "bg-white/50 w-1.5"}`} />
            ))}
          </div>
        </div>
      </section>

      {/* 히어로 지표 — 오버사이즈 수치 (지금 열린 구인 공고) */}
      <section className="mb-7" style={{ animation: "reveal 0.5s cubic-bezier(0.16,1,0.3,1) 0.04s both" }}>
        <div className="glass-card px-5 py-6 lg:px-7 lg:py-7 flex items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="mono-label mb-2.5">지금 열린 구인 공고</p>
            <div className="flex items-end gap-3">
              <span className="text-[64px] lg:text-[88px] leading-[0.8] font-extrabold tracking-tighter text-foreground tabular-nums">
                {openJobCount ?? "—"}
              </span>
              <span className="text-sm text-muted-foreground mb-1.5 shrink-0">건이 멤버를<br />기다리는 중</span>
            </div>
          </div>
          <button
            onClick={() => navigate("/jobs")}
            className="shrink-0 px-4 h-10 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors active:scale-95 flex items-center gap-1"
          >
            둘러보기 <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </section>

      {/* 채널 스트립 카테고리 — 라인 픽토그램 + 볼드 타이포 */}
      <section className="mb-8" style={{ animation: "reveal 0.5s cubic-bezier(0.16,1,0.3,1) 0.08s both" }}>
        <div className="grid grid-cols-4 gap-2">
          {categories.map(({ icon: Icon, label, path }, i) => (
            <button
              key={path}
              onClick={() => navigate(path)}
              className="glass-card p-3 lg:p-3.5 flex flex-col gap-4 items-stretch text-left hover:bg-surface-hover transition-colors active:scale-[0.97] group"
            >
              <div className="flex items-center justify-between">
                <span className="mono-label">{String(i + 1).padStart(2, "0")}</span>
                <Icon strokeWidth={1.6} className="w-[18px] h-[18px] text-primary group-hover:scale-110 transition-transform" />
              </div>
              <span className="text-[13px] lg:text-[15px] font-bold tracking-tight leading-tight">{label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* 최근 구인글 */}
      <section className="mb-8" style={{ animation: "reveal 0.5s cubic-bezier(0.16,1,0.3,1) 0.12s both" }}>
        <SectionHead title="최근 구인글" onMore={() => navigate("/jobs")} />
        {recentJobs.length === 0 ? (
          <EmptyRow text="아직 구인글이 없습니다. 첫 공고를 올려보세요!" />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            {recentJobs.map((job) => (
              <div key={job.id} onClick={() => navigate(`/post/${job.id}`)} className="glass-card p-3.5 flex items-center justify-between hover:bg-surface-hover transition-colors duration-200 cursor-pointer active:scale-[0.98]">
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate tracking-tight">{job.title}</p>
                  <p className="text-xs text-muted-foreground mt-1 truncate flex items-center gap-1"><MapPin className="w-3 h-3 shrink-0" />{job.venue || "장소 미정"}</p>
                </div>
                <span className="text-[10px] font-mono font-semibold px-2 py-1 rounded bg-secondary text-secondary-foreground shrink-0 ml-2">{job.category || "기타"}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 커뮤니티 인기글 */}
      <section className="mb-8" style={{ animation: "reveal 0.5s cubic-bezier(0.16,1,0.3,1) 0.16s both" }}>
        <SectionHead title="커뮤니티 인기글" onMore={() => navigate("/community")} />
        {popularPosts.length === 0 ? (
          <EmptyRow text="아직 커뮤니티 글이 없습니다. 첫 글을 남겨보세요!" />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            {popularPosts.map((p) => (
              <div key={p.id} onClick={() => navigate(`/post/${p.id}`)} className="glass-card p-3.5 hover:bg-surface-hover transition-colors duration-200 cursor-pointer active:scale-[0.98]">
                <p className="text-sm font-semibold truncate tracking-tight">{p.title}</p>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{p.content}</p>
                <div className="flex items-center gap-3 mt-2.5 text-[11px] text-muted-foreground">
                  <span className="truncate max-w-[40%]">{p.author_name || "익명"}</span>
                  <span className="flex items-center gap-1 ml-auto font-mono tabular-nums"><Heart className="w-3 h-3" />{p.likes || 0}</span>
                  <span className="flex items-center gap-1 font-mono tabular-nums"><MessageSquare className="w-3 h-3" />{p.comments || 0}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 제휴 연습실 · 즉시예약 (신뢰 등급 = VU 게이지) */}
      {studios.length > 0 && (
        <section className="mb-6" style={{ animation: "reveal 0.5s cubic-bezier(0.16,1,0.3,1) 0.2s both" }}>
          <SectionHead title="제휴 연습실 · 즉시예약" onMore={() => navigate("/studios")} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            {studios.map((s) => (
              <div key={s.id} onClick={() => navigate("/studios")} className="glass-card p-3.5 flex items-center gap-3 hover:bg-surface-hover transition-colors duration-200 cursor-pointer active:scale-[0.98]">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate tracking-tight">{s.name}</p>
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1 truncate"><MapPin className="w-3 h-3 shrink-0" />{s.address}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <VuMeter level={tierLevel(s.tier)} />
                    <span className="mono-label">신뢰 {s.tier || "—"}등급</span>
                  </div>
                </div>
                <span className="text-[10px] font-mono font-bold px-2 py-1 rounded bg-primary/10 text-primary shrink-0 flex items-center gap-0.5"><Zap className="w-2.5 h-2.5" />즉시예약</span>
              </div>
            ))}
          </div>
        </section>
      )}
      </>}

      <NotificationsPanel open={notiOpen} onClose={() => setNotiOpen(false)} />
      </div>
    </PageShell>
  );
};

const SectionHead = ({ title, onMore }: { title: string; onMore: () => void }) => (
  <div className="flex items-center justify-between mb-3.5">
    <h2 className="flex items-center gap-2 font-bold text-base lg:text-lg tracking-tight">
      <span className="w-1 h-4 bg-primary rounded-full" />
      {title}
    </h2>
    <button onClick={onMore} className="mono-label hover:text-foreground flex items-center gap-0.5 active:scale-95 transition-colors">
      전체보기 <ChevronRight className="w-3.5 h-3.5" />
    </button>
  </div>
);

const EmptyRow = ({ text }: { text: string }) => (
  <p className="text-xs text-muted-foreground text-center py-6 glass-card">{text}</p>
);

export default Index;
