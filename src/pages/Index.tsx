import { Briefcase, Music2, Store, MessageCircle, Bell } from "lucide-react";
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

const menuBar = [
  { icon: Briefcase, label: "구인", path: "/jobs" },
  { icon: Music2, label: "연습실", path: "/rooms" },
  { icon: Store, label: "악기사", path: "/shops" },
  { icon: MessageCircle, label: "커뮤니티", path: "/community" },
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
  const [dbRecentJobs, setDbRecentJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [notiOpen, setNotiOpen] = useState(false);
  const { count: unreadCount } = useUnreadCount();

  const fetchData = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("posts")
      .select("*")
      .eq("post_type", "job")
      .order("created_at", { ascending: false })
      .limit(5);
    setDbRecentJobs(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    const timer = setInterval(() => {
      setCurrentBanner((prev) => (prev + 1) % adBanners.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  const recentJobs = dbRecentJobs.map((j) => ({
    id: j.id as string,
    title: j.title,
    venue: j.venue || "",
    tag: j.category || "기타",
  }));

  return (
    <PageShell>
      <div className="lg:max-w-2xl lg:mx-auto lg:pt-4">
      {/* 상단 고정 영역: 로고 + 카테고리 메뉴바 */}
      <div
        className="lg:hidden sticky top-0 z-40 -mx-4 px-4 pb-3 bg-background/95 backdrop-blur-lg border-b border-border/30 mb-5"
        style={{ paddingTop: "calc(1.25rem + var(--safe-top, 0px))" }}
      >
        <header className="pb-3 flex items-center justify-between">
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
            <button
              onClick={() => navigate("/auth")}
              className="px-3.5 h-9 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors active:scale-95"
            >
              로그인
            </button>
          )}
        </header>
        <nav style={{ animation: "reveal 0.5s cubic-bezier(0.16,1,0.3,1) both" }}>
          <div className="grid grid-cols-4 gap-2">
            {menuBar.map(({ icon: Icon, label, path }) => (
              <button
                key={path}
                onClick={() => navigate(path)}
                className="flex flex-col items-center gap-1.5 py-3 rounded-2xl bg-card border border-border/60 hover:bg-surface-hover transition-colors duration-150 active:scale-95"
              >
                <span className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Icon className="w-[18px] h-[18px] text-primary" />
                </span>
                <span className="text-[11px] font-semibold">{label}</span>
              </button>
            ))}
          </div>
        </nav>
      </div>

      {loading ? <HomeSkeleton /> : <>
      {/* Ad Banner Carousel */}
      <section className="mb-6" style={{ animation: "reveal 0.5s cubic-bezier(0.16,1,0.3,1) 0.05s both" }}>
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

      {/* Recent Jobs */}
      <section className="mb-6" style={{ animation: "reveal 0.5s cubic-bezier(0.16,1,0.3,1) 0.1s both" }}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-sm">최근 구인글</h2>
          <button onClick={() => navigate("/jobs")} className="text-xs text-primary font-medium active:scale-95 transition-transform">전체보기</button>
        </div>
        {recentJobs.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-6">아직 구인글이 없습니다. 첫 공고를 올려보세요!</p>
        )}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
          {recentJobs.map((job, i) => (
            <div key={i} onClick={() => job.id ? navigate(`/post/${job.id}`) : navigate("/jobs")} className="glass-card p-3.5 flex items-center justify-between hover:bg-surface-hover transition-colors duration-200 cursor-pointer active:scale-[0.98]">
              <div>
                <p className="text-sm font-medium">{job.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{job.venue}</p>
              </div>
              <span className="text-[10px] font-medium px-2.5 py-1 rounded-full bg-primary/10 text-primary shrink-0">{job.tag}</span>
            </div>
          ))}
        </div>
      </section>
      </>}

      <NotificationsPanel open={notiOpen} onClose={() => setNotiOpen(false)} />
      </div>
    </PageShell>
  );
};

export default Index;
