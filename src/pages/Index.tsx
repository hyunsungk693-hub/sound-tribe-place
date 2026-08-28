import { Briefcase, Music2, Store, MessageCircle, Bell, Heart, MessageSquare, ChevronRight, Zap, MapPin } from "lucide-react";
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

// 캐러셀 아래 원형 아이콘 카테고리 (참고 디자인)
const categories = [
  { icon: Briefcase, label: "구인구직", path: "/jobs", color: "bg-blue-500/10 text-blue-600" },
  { icon: Music2, label: "연습실", path: "/rooms", color: "bg-emerald-500/10 text-emerald-600" },
  { icon: Store, label: "악기사", path: "/shops", color: "bg-orange-500/10 text-orange-600" },
  { icon: MessageCircle, label: "커뮤니티", path: "/community", color: "bg-violet-500/10 text-violet-600" },
];

const adBanners = [
  { title: "instrut", desc: "믿을 수 있는 밴드·세션 멤버 찾기", image: banner1, path: "/jobs" },
  { title: "instrut", desc: "합주할 공간이 필요하다면, 연습실 찾기", image: banner3, path: "/rooms" },
  { title: "instrut", desc: "음악인들과 자유롭게 이야기 나누기", image: banner4, path: "/community" },
];

const Index = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [currentBanner, setCurrentBanner] = useState(0);
  const [recentJobs, setRecentJobs] = useState<any[]>([]);
  const [popularPosts, setPopularPosts] = useState<any[]>([]);
  const [studios, setStudios] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [notiOpen, setNotiOpen] = useState(false);
  const { count: unreadCount } = useUnreadCount();

  const fetchData = async () => {
    setLoading(true);
    const [jobRes, commRes, studioRes] = await Promise.all([
      supabase.from("posts").select("id,title,venue,category").eq("post_type", "job").order("created_at", { ascending: false }).limit(4),
      supabase.from("posts").select("id,title,content,author_name").eq("post_type", "community").order("created_at", { ascending: false }).limit(12),
      (supabase as any).from("studios").select("id,name,address,tier").eq("tier", "A").limit(3),
    ]);
    setRecentJobs(jobRes.data || []);
    setStudios(studioRes.data || []);

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
      {/* 상단 고정 헤더: 로고 + 알림/로그인 (메뉴는 아래 아이콘 그리드로) */}
      <div
        className="lg:hidden sticky top-0 z-40 -mx-4 px-4 pb-3 bg-background/95 backdrop-blur-lg border-b border-border/30 mb-4"
        style={{ paddingTop: "calc(1.25rem + var(--safe-top, 0px))" }}
      >
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight text-primary">instrut</h1>
          {user ? (
            <button
              onClick={() => setNotiOpen(true)}
              aria-label="알림"
              className="relative w-10 h-10 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors active:scale-95"
            >
              <Bell className="w-[22px] h-[22px]" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center text-[9px] font-bold">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </button>
          ) : (
            <button onClick={() => navigate("/auth")} className="px-3.5 h-9 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors active:scale-95">
              로그인
            </button>
          )}
        </header>
      </div>

      {loading ? <HomeSkeleton /> : <>
      {/* 배너 캐러셀 */}
      <section className="mb-6" style={{ animation: "reveal 0.5s cubic-bezier(0.16,1,0.3,1) both" }}>
        <div className="relative overflow-hidden rounded-2xl">
          <div className="flex transition-transform duration-500 ease-out" style={{ transform: `translateX(-${currentBanner * 100}%)` }}>
            {adBanners.map((banner, i) => (
              <div key={i} onClick={() => navigate(banner.path)} className="w-full shrink-0 relative overflow-hidden cursor-pointer active:scale-[0.98] transition-transform min-h-[210px] lg:min-h-[280px]">
                <img src={banner.image} alt={banner.title} className="w-full h-full object-cover absolute inset-0" loading="lazy" />
                <div className="relative z-10 p-6 lg:p-8 flex flex-col justify-end min-h-[210px] lg:min-h-[280px] bg-gradient-to-t from-black/65 to-transparent">
                  <p className="text-xs lg:text-sm text-white/80">{banner.title}</p>
                  <p className="font-bold text-xl lg:text-2xl text-white leading-tight">{banner.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
            {adBanners.map((_, i) => (
              <button key={i} onClick={() => setCurrentBanner(i)} className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${i === currentBanner ? "bg-primary w-4" : "bg-muted-foreground/30"}`} />
            ))}
          </div>
        </div>
      </section>

      {/* 원형 아이콘 카테고리 (캐러셀 아래) */}
      <section className="mb-8" style={{ animation: "reveal 0.5s cubic-bezier(0.16,1,0.3,1) 0.05s both" }}>
        <div className="grid grid-cols-4 gap-2">
          {categories.map(({ icon: Icon, label, path, color }) => (
            <button
              key={path}
              onClick={() => navigate(path)}
              className="flex flex-col items-center gap-2 py-2 active:scale-95 transition-transform group"
            >
              <span className={`w-14 h-14 lg:w-16 lg:h-16 rounded-full flex items-center justify-center ${color} group-hover:scale-105 transition-transform`}>
                <Icon className="w-6 h-6 lg:w-7 lg:h-7" />
              </span>
              <span className="text-xs lg:text-[13px] font-medium">{label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* 최근 구인글 */}
      <section className="mb-8" style={{ animation: "reveal 0.5s cubic-bezier(0.16,1,0.3,1) 0.1s both" }}>
        <SectionHead title="최근 구인글" onMore={() => navigate("/jobs")} />
        {recentJobs.length === 0 ? (
          <EmptyRow text="아직 구인글이 없습니다. 첫 공고를 올려보세요!" />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            {recentJobs.map((job) => (
              <div key={job.id} onClick={() => navigate(`/post/${job.id}`)} className="glass-card p-3.5 flex items-center justify-between hover:bg-surface-hover transition-colors duration-200 cursor-pointer active:scale-[0.98]">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{job.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{job.venue || "장소 미정"}</p>
                </div>
                <span className="text-[10px] font-medium px-2.5 py-1 rounded-full bg-primary/10 text-primary shrink-0 ml-2">{job.category || "기타"}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 커뮤니티 인기글 */}
      <section className="mb-8" style={{ animation: "reveal 0.5s cubic-bezier(0.16,1,0.3,1) 0.15s both" }}>
        <SectionHead title="커뮤니티 인기글" onMore={() => navigate("/community")} />
        {popularPosts.length === 0 ? (
          <EmptyRow text="아직 커뮤니티 글이 없습니다. 첫 글을 남겨보세요!" />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            {popularPosts.map((p) => (
              <div key={p.id} onClick={() => navigate(`/post/${p.id}`)} className="glass-card p-3.5 hover:bg-surface-hover transition-colors duration-200 cursor-pointer active:scale-[0.98]">
                <p className="text-sm font-medium truncate">{p.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{p.content}</p>
                <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
                  <span className="truncate max-w-[40%]">{p.author_name || "익명"}</span>
                  <span className="flex items-center gap-1 ml-auto"><Heart className="w-3 h-3" />{p.likes || 0}</span>
                  <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" />{p.comments || 0}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 제휴 연습실 · 즉시예약 */}
      {studios.length > 0 && (
        <section className="mb-6" style={{ animation: "reveal 0.5s cubic-bezier(0.16,1,0.3,1) 0.2s both" }}>
          <SectionHead title="제휴 연습실 · 즉시예약" onMore={() => navigate("/studios")} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            {studios.map((s) => (
              <div key={s.id} onClick={() => navigate("/studios")} className="glass-card p-3.5 flex items-center gap-3 hover:bg-surface-hover transition-colors duration-200 cursor-pointer active:scale-[0.98]">
                <span className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Music2 className="w-5 h-5 text-primary" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{s.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1 truncate"><MapPin className="w-3 h-3 shrink-0" />{s.address}</p>
                </div>
                <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-primary/10 text-primary shrink-0 flex items-center gap-0.5"><Zap className="w-2.5 h-2.5" />즉시예약</span>
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
  <div className="flex items-center justify-between mb-3">
    <h2 className="font-bold text-base lg:text-lg">{title}</h2>
    <button onClick={onMore} className="text-xs text-primary font-medium flex items-center gap-0.5 active:scale-95 transition-transform">
      전체보기 <ChevronRight className="w-3.5 h-3.5" />
    </button>
  </div>
);

const EmptyRow = ({ text }: { text: string }) => (
  <p className="text-xs text-muted-foreground text-center py-6 glass-card">{text}</p>
);

export default Index;
