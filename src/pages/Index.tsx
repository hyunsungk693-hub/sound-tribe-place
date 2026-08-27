import { Briefcase, Music2, Store, MessageCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import PageShell from "@/components/PageShell";
import { supabase } from "@/integrations/supabase/client";
import { HomeSkeleton } from "@/components/skeletons/PostSkeleton";
import banner1 from "@/assets/banner-1.png";
import banner2 from "@/assets/banner-2.jpg";
import banner3 from "@/assets/banner-3.jpg";
import banner4 from "@/assets/banner-4.jpg";

const menuBar = [
  { icon: Briefcase, label: "구인", path: "/jobs" },
  { icon: Music2, label: "연습실", path: "/rooms" },
  { icon: Store, label: "악기사", path: "/shops" },
  { icon: MessageCircle, label: "커뮤니티", path: "/community" },
];

const adBanners = [
  { title: "음악인을 위한 플랫폼", desc: "함께 만드는 음악의 무대", image: banner1 },
  { title: "🎸 악기 할인 대전", desc: "최대 50% 할인! 봄맞이 특별 세일", image: banner2 },
  { title: "🎵 뮤직 페스티벌 2026", desc: "서울 올림픽공원 · 4월 12~13일", image: banner3 },
  { title: "🎧 온라인 믹싱 클래스", desc: "프로 엔지니어에게 배우는 믹싱 노하우", image: banner4 },
];

const sampleRecentJobs = [
  { title: "밴드 기타리스트 모집", venue: "홍대 라이브클럽", tag: "공연" },
  { title: "레코딩 세션 드러머", venue: "강남 스튜디오", tag: "녹음" },
  { title: "웨딩 싱어 구함", venue: "서울 전 지역", tag: "행사" },
];

const Index = () => {
  const navigate = useNavigate();
  const [currentBanner, setCurrentBanner] = useState(0);
  const [dbRecentJobs, setDbRecentJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

  const recentJobs = [
    ...dbRecentJobs.map((j) => ({
      id: j.id,
      title: j.title,
      venue: j.venue || "",
      tag: j.category || "기타",
    })),
    ...sampleRecentJobs.map((j) => ({ ...j, id: null as string | null })),
  ].slice(0, 5);

  return (
    <PageShell>
      {/* Header: 로고 텍스트만 왼쪽 정렬 */}
      <header className="pt-5 pb-3">
        <h1 className="text-2xl font-bold tracking-tight text-primary">instrut</h1>
      </header>

      {/* 메뉴바 */}
      <nav className="mb-5" style={{ animation: "reveal 0.5s cubic-bezier(0.16,1,0.3,1) both" }}>
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

      {loading ? <HomeSkeleton /> : <>
      {/* Ad Banner Carousel */}
      <section className="mb-6" style={{ animation: "reveal 0.5s cubic-bezier(0.16,1,0.3,1) 0.05s both" }}>
        <div className="relative overflow-hidden rounded-2xl">
          <div className="flex transition-transform duration-500 ease-out" style={{ transform: `translateX(-${currentBanner * 100}%)` }}>
            {adBanners.map((banner, i) => (
              <div key={i} className="w-full shrink-0 relative overflow-hidden cursor-pointer active:scale-[0.98] transition-transform min-h-[140px]">
                <img src={banner.image} alt={banner.title} className="w-full h-full object-cover absolute inset-0" loading="lazy" />
                <div className="relative z-10 p-5 flex flex-col justify-end min-h-[140px] bg-gradient-to-t from-black/60 to-transparent">
                  <p className="text-xs text-white/80">{banner.title}</p>
                  <p className="font-bold text-lg text-white leading-tight">{banner.desc}</p>
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
        <div className="space-y-2">
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
    </PageShell>
  );
};

export default Index;
