import { Briefcase, MapPin, MessageCircle, ChevronRight, Megaphone, Star } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import PageShell from "@/components/PageShell";
import CreatePostDialog from "@/components/CreatePostDialog";
import { supabase } from "@/integrations/supabase/client";
import { HomeSkeleton } from "@/components/skeletons/PostSkeleton";
import logoIcon from "@/assets/logo-icon.png";
import banner1 from "@/assets/banner-1.png";
import banner2 from "@/assets/banner-2.jpg";
import banner3 from "@/assets/banner-3.jpg";
import banner4 from "@/assets/banner-4.jpg";
import HomeMap from "@/components/HomeMap";

const quickActions = [
  { icon: Briefcase, label: "구인구직", desc: "음악 관련 일자리 탐색", path: "/jobs", color: "from-blue-500/10 to-blue-600/5" },
  { icon: MapPin, label: "연습실", desc: "가까운 연습실 찾기", path: "/rooms", color: "from-emerald-500/10 to-emerald-600/5" },
  { icon: MessageCircle, label: "커뮤니티", desc: "음악인과 소통", path: "/community", color: "from-orange-500/10 to-orange-600/5" },
];

const adBanners = [
  { title: "음악인을 위한 플랫폼", desc: "함께 만드는 음악의 무대", image: banner1 },
  { title: "🎸 악기 할인 대전", desc: "최대 50% 할인! 봄맞이 특별 세일", image: banner2 },
  { title: "🎵 뮤직 페스티벌 2026", desc: "서울 올림픽공원 · 4월 12~13일", image: banner3 },
  { title: "🎧 온라인 믹싱 클래스", desc: "프로 엔지니어에게 배우는 믹싱 노하우", image: banner4 },
];

const samplePromotions = [
  { title: "홍대 재즈바 오픈 기념 공연", author: "블루노트 서울", date: "3일 전", hot: true },
  { title: "신촌 버스킹 팀원 모집", author: "스트릿뮤직", date: "5일 전", hot: false },
  { title: "인디밴드 새 앨범 발매 기념 공연", author: "에코사운드", date: "1주 전", hot: true },
  { title: "음악 장비 중고 마켓 오픈", author: "기어마켓", date: "1주 전", hot: false },
];

const sampleRecentJobs = [
  { title: "밴드 기타리스트 모집", venue: "홍대 라이브클럽", tag: "공연" },
  { title: "레코딩 세션 드러머", venue: "강남 스튜디오", tag: "녹음" },
  { title: "웨딩 싱어 구함", venue: "서울 전 지역", tag: "행사" },
];

const promoFields = [
  { key: "title", label: "제목", placeholder: "홍보글 제목을 입력해주세요" },
  { key: "content", label: "내용", placeholder: "홍보 내용을 작성해주세요", type: "textarea" as const },
  { key: "author_name", label: "작성자/단체명", placeholder: "예: 블루노트 서울" },
];

const Index = () => {
  const navigate = useNavigate();
  const [currentBanner, setCurrentBanner] = useState(0);
  const [dbPromos, setDbPromos] = useState<any[]>([]);
  const [dbRecentJobs, setDbRecentJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    const [promoRes, jobRes] = await Promise.all([
      supabase.from("posts").select("*").eq("post_type", "promotion").order("created_at", { ascending: false }).limit(5),
      supabase.from("posts").select("*").eq("post_type", "job").order("created_at", { ascending: false }).limit(3),
    ]);
    setDbPromos(promoRes.data || []);
    setDbRecentJobs(jobRes.data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    const timer = setInterval(() => {
      setCurrentBanner((prev) => (prev + 1) % adBanners.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  const promotions = [
    ...dbPromos.map((p) => ({
      id: p.id,
      title: p.title,
      author: p.author_name || "익명",
      date: new Date(p.created_at).toLocaleDateString("ko-KR"),
      hot: false,
    })),
    ...samplePromotions.map((p) => ({ ...p, id: null as string | null })),
  ];

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
      {/* Hero */}
      <div className="pt-6 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl overflow-hidden">
            <img src={logoIcon} alt="instrut" className="w-full h-full object-cover" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">instrut</h1>
            <p className="text-xs text-muted-foreground">음악인을 위한 플랫폼</p>
          </div>
        </div>
      </div>

      {loading ? <HomeSkeleton /> : <>
      {/* Ad Banner Carousel */}
      <section className="mb-6" style={{ animation: "reveal 0.6s cubic-bezier(0.16,1,0.3,1) 0.05s both" }}>
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

      {/* Promotion Board */}
      <section className="mb-6" style={{ animation: "reveal 0.6s cubic-bezier(0.16,1,0.3,1) 0.1s both" }}>
        <div className="flex items-center gap-2 mb-3">
          <Megaphone className="w-4 h-4 text-primary" />
          <h2 className="font-semibold text-sm">홍보 게시판</h2>
        </div>
        <div className="space-y-2">
          {promotions.map((promo, i) => (
            <div key={i} onClick={() => promo.id ? navigate(`/post/${promo.id}`) : null} className="glass-card p-3.5 flex items-start justify-between hover:bg-surface-hover transition-colors duration-200 cursor-pointer active:scale-[0.98]">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  {promo.hot && <Star className="w-3 h-3 text-primary fill-primary shrink-0" />}
                  <p className="text-sm font-medium truncate">{promo.title}</p>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{promo.author} · {promo.date}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Recent Jobs */}
      <section className="mb-6" style={{ animation: "reveal 0.6s cubic-bezier(0.16,1,0.3,1) 0.15s both" }}>
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

      {/* Quick Actions */}
      <section className="space-y-3 mb-6" style={{ animation: "reveal 0.6s cubic-bezier(0.16,1,0.3,1) 0.2s both" }}>
        {quickActions.map(({ icon: Icon, label, desc, path, color }) => (
          <button key={path} onClick={() => navigate(path)} className="w-full glass-card p-4 flex items-center gap-4 hover:bg-surface-hover transition-colors duration-200 active:scale-[0.98] text-left">
            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center shrink-0`}>
              <Icon className="w-5 h-5 text-foreground/70" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="font-semibold text-sm">{label}</span>
              <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
          </button>
        ))}
      </section>

      <CreatePostDialog postType="promotion" fields={promoFields} onCreated={fetchData} />
      </>}
    </PageShell>
  );
};

export default Index;
