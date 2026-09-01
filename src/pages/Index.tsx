import { Briefcase, Music2, Store, MessageCircle, Heart, MessageSquare, ChevronRight, MapPin, Bell } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useEffect, useRef, useCallback } from "react";
import PageShell from "@/components/PageShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { HomeSkeleton } from "@/components/skeletons/PostSkeleton";
import NotificationsPanel, { useUnreadCount } from "@/components/NotificationsPanel";
import banner1 from "@/assets/banner-1.png";
import banner3 from "@/assets/banner-3.jpg";
import banner4 from "@/assets/banner-4.jpg";

// 카테고리 — 라인 픽토그램 + EN 라벨 + 볼드 타이포
// 채널 스트립 모티프: 채널마다 hue만 다른 밝고 연한 파스텔 아이콘.
// 색은 아이콘과 hover 테두리에만 쓰고, mono 라벨은 중립 톤으로 둔다.
const categories = [
  { icon: Briefcase, en: "Jobs", label: "구인구직", path: "/jobs",
    tint: "text-ch-jobs", hoverBorder: "hover:border-ch-jobs", hoverText: "group-hover:text-ch-jobs" },
  { icon: Music2, en: "Rooms", label: "연습실", path: "/rooms",
    tint: "text-ch-rooms", hoverBorder: "hover:border-ch-rooms", hoverText: "group-hover:text-ch-rooms" },
  { icon: Store, en: "Shops", label: "악기사", path: "/shops",
    tint: "text-ch-shops", hoverBorder: "hover:border-ch-shops", hoverText: "group-hover:text-ch-shops" },
  { icon: MessageCircle, en: "Community", label: "커뮤니티", path: "/community",
    tint: "text-ch-community", hoverBorder: "hover:border-ch-community", hoverText: "group-hover:text-ch-community" },
];

// 이미지만 있는 배너를 허용한다(20260901000028). 문구가 이미 그려진 제휴 이미지에
// 제목·설명을 덧씌우면 같은 말이 두 번 나오고, 이동시킬 곳이 없는 공지 배너도 있다.
// 그래서 title·desc·path는 전부 null일 수 있다. image만 항상 있다.
type Banner = { title: string | null; desc: string | null; image: string; path: string | null };

// 배너는 관리자가 carousel_slides 테이블에서 관리한다(20260901000027).
// 다만 관리자가 실수로 전부 지웠거나 조회가 실패했을 때 홈 최상단이 빈 채로 남으면
// 안 되므로, 원래 하드코딩돼 있던 3장을 그대로 폴백으로 들고 있는다.
// (이 3장은 셋 다 채워져 있어 아래의 "값 없음" 분기를 타지 않는다)
const fallbackBanners: Banner[] = [
  { title: "Find", desc: "믿을 수 있는 밴드·세션 멤버 찾기", image: banner1, path: "/jobs" },
  { title: "Rooms", desc: "합주할 공간이 필요하다면, 연습실 찾기", image: banner3, path: "/rooms" },
  { title: "Community", desc: "음악인들과 자유롭게 이야기 나누기", image: banner4, path: "/community" },
];

// VU 미터 — 세그먼트 게이지 (0~1)
/** 급구 표식 — 마감까지 남은 일수만 표기(D-3 / D-DAY). 마감이 지나면 표시하지 않는다 */
const urgentLabel = (job: { is_urgent?: boolean; deadline_at?: string | null }) => {
  if (!job.is_urgent || !job.deadline_at) return null;
  const left = new Date(job.deadline_at).getTime() - Date.now();
  if (left < 0) return null;
  const days = Math.ceil(left / 86400000);
  return days <= 0 ? "D-DAY" : `D-${days}`;
};

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
  const [dragDx, setDragDx] = useState(0);
  const autoTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const swipedRef = useRef(false);
  const dragRef = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const suppressClickRef = useRef(false);
  const [slides, setSlides] = useState<Banner[]>([]);
  const bannerCountRef = useRef(fallbackBanners.length);
  const [recentJobs, setRecentJobs] = useState<any[]>([]);
  const [popularPosts, setPopularPosts] = useState<any[]>([]);
  const [studios, setStudios] = useState<any[]>([]);
  const [openJobCount, setOpenJobCount] = useState<number | null>(null);
  const [communityCount, setCommunityCount] = useState<number | null>(null);
  const [studioCount, setStudioCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [notiOpen, setNotiOpen] = useState(false);
  const { count: unreadCount } = useUnreadCount();

  const fetchData = async () => {
    setLoading(true);
    const [jobRes, commRes, studioRes, jobCountRes, commCountRes, studioCountRes, slideRes] = await Promise.all([
      // 급구 우선 → 그중 마감 임박순 → 급구가 부족하면 최근순으로 채운다.
      // 단일 쿼리 다중 정렬이므로 급구가 0건이어도 최근 글로 채워져 섹션이 비지 않는다.
      supabase
        .from("posts")
        .select("id,title,venue,category,is_urgent,deadline_at")
        .eq("post_type", "job")
        .eq("status", "open")
        .order("is_urgent", { ascending: false })
        .order("deadline_at", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(5),
      // 인기글: 전체 기준 정렬. popularity(=like_count+comment_count)는 생성 컬럼이고
      // 두 카운트는 트리거로 유지되므로, 최근 N건만 훑던 이전 방식과 달리 오래된
      // 인기글도 후보에 들어온다.
      supabase
        .from("posts")
        .select("id,title,content,author_name,like_count,comment_count")
        .eq("post_type", "community")
        .order("popularity", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(5),
      (supabase as any).from("studios").select("id,name,address,tier").eq("tier", "A").limit(3),
      supabase.from("posts").select("id", { count: "exact", head: true }).eq("post_type", "job").eq("status", "open"),
      supabase.from("posts").select("id", { count: "exact", head: true }).eq("post_type", "community"),
      (supabase as any).from("studios").select("id", { count: "exact", head: true }),
      // 배너도 같은 묶음에서 받는다. 나중에 따로 받아오면 스켈레톤이 걷힌 뒤에
      // 배너만 한 번 더 바뀌면서 화면이 튄다.
      (supabase as any)
        .from("carousel_slides")
        .select("id,title,description,image_url,link")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
    ]);
    setRecentJobs(jobRes.data || []);
    // 조회가 실패하면 data가 없다 → 빈 배열 → 아래에서 폴백 배너로 그린다.
    setSlides(
      // title·description·link는 NULL일 수 있다. 여기서 ""로 바꾸지 않는다 —
      // 빈 문자열도 truthy 판정만 피할 뿐, 아래 분기를 null 하나로 통일해 두는 편이
      // 읽기 쉽다.
      ((slideRes.data as any[]) || []).map((s) => ({
        title: s.title ?? null,
        desc: s.description ?? null,
        image: s.image_url,
        path: s.link ?? null,
      }))
    );
    setStudios(studioRes.data || []);
    setOpenJobCount(jobCountRes.count ?? (jobRes.data?.length ?? 0));
    setCommunityCount(commCountRes.count ?? null);
    setStudioCount(studioCountRes.count ?? null);

    // 커뮤니티 인기글: 서버가 이미 popularity 순으로 5건을 준다.
    // (예전에는 최근 12건을 받아 클라이언트에서 재정렬해, 13번째 이후의
    //  인기글이 후보에서 빠지는 문제가 있었다)
    setPopularPosts((commRes.data || []).map((p: any) => ({
      ...p,
      likes: p.like_count ?? 0,
      comments: p.comment_count ?? 0,
    })));
    setLoading(false);
  };

  // 수동 스와이프가 한 번이라도 일어나면 해당 세션 동안 자동 전환을 멈춘다.
  const stopAuto = useCallback(() => {
    swipedRef.current = true;
    if (autoTimerRef.current) {
      clearInterval(autoTimerRef.current);
      autoTimerRef.current = null;
    }
  }, []);

  // 관리자가 등록한 슬라이드가 한 장이라도 있으면 그걸, 없으면 기본 배너를 쓴다.
  // 어느 쪽이든 최소 1장이라 배너 자리가 비는 경우는 없다.
  const banners = slides.length > 0 ? slides : fallbackBanners;

  useEffect(() => {
    fetchData();
    if (swipedRef.current) return;
    // 자동 전환 타이머는 한 번만 만들고 개수는 ref로 읽는다.
    // 배너 개수가 나중에 바뀌므로 여기서 값을 캡처하면 옛날 개수로 계속 돈다.
    autoTimerRef.current = setInterval(() => {
      setCurrentBanner((prev) => (prev + 1) % Math.max(1, bannerCountRef.current));
    }, 4000);
    return () => {
      if (autoTimerRef.current) clearInterval(autoTimerRef.current);
      autoTimerRef.current = null;
    };
  }, []);

  // 슬라이드가 로드되며 개수가 줄면(폴백 3장 → DB 2장) 현재 인덱스가 범위를 벗어난다.
  useEffect(() => {
    bannerCountRef.current = banners.length;
    setCurrentBanner((prev) => (prev >= banners.length ? 0 : prev));
  }, [banners.length]);

  // 배너 드래그: 터치·마우스 공통(Pointer Events). 40px 이상 끌면 한 장 넘긴다.
  const SWIPE_THRESHOLD = 40;

  const onBannerPointerDown = (e: React.PointerEvent) => {
    suppressClickRef.current = false;
    dragRef.current = { x: e.clientX, y: e.clientY, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onBannerPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    // 세로 의도가 명확하면 드래그를 포기하고 페이지 스크롤에 양보한다
    if (!d.moved && Math.abs(dy) > Math.abs(dx)) {
      dragRef.current = null;
      setDragDx(0);
      return;
    }
    if (!d.moved && Math.abs(dx) > 4) d.moved = true;
    if (d.moved) {
      stopAuto();
      suppressClickRef.current = true;
      setDragDx(dx);
    }
  };

  const onBannerPointerUp = (e: React.PointerEvent) => {
    const d = dragRef.current;
    dragRef.current = null;
    setDragDx(0);
    if (!d || !d.moved) return; // 움직임이 없으면 탭 → onClick이 처리
    const dx = e.clientX - d.x;
    if (Math.abs(dx) >= SWIPE_THRESHOLD) {
      // 개수는 이 렌더의 banners에서 읽는다(고정 3장이 아니다).
      const n = banners.length;
      setCurrentBanner((prev) => (dx < 0 ? (prev + 1) % n : (prev - 1 + n) % n));
    }
  };

  const onBannerPointerCancel = () => {
    dragRef.current = null;
    setDragDx(0);
  };

  const onBannerClick = (path: string | null) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    // 이동 경로가 없는 배너는 눌러도 아무 일도 일어나지 않는다.
    // navigate(undefined)를 부르면 라우터가 현재 경로로 되돌아가며 화면이 깜빡인다.
    if (!path) return;
    navigate(path);
  };

  return (
    <PageShell>
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
              aria-label={unreadCount > 0 ? `알림 ${unreadCount}개` : "알림"}
              className="relative text-muted-foreground hover:text-foreground transition-colors active:scale-95 pr-1"
            >
              <Bell className="w-5 h-5" strokeWidth={2} />
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-2 min-w-[15px] h-[15px] px-1 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[9px] font-bold font-mono">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </button>
          ) : (
            <button onClick={() => navigate("/auth")} className="px-4 h-9 rounded-lg bg-action text-action-foreground text-xs font-semibold hover:bg-action-hover transition-colors active:scale-95">
              로그인
            </button>
          )}
        </header>
      </div>

      {loading ? <HomeSkeleton /> : <>
      {/* 히어로: 배너(1fr) + 지표 카드(340px) */}
      <section className="mb-9 lg:mb-14 grid gap-4 lg:grid-cols-[1fr_340px] lg:gap-5" style={{ animation: "reveal 0.5s cubic-bezier(0.16,1,0.3,1) both" }}>
        <div
          className="relative overflow-hidden rounded-lg h-[210px] lg:h-auto lg:min-h-[300px] touch-pan-y select-none"
          onPointerDown={onBannerPointerDown}
          onPointerMove={onBannerPointerMove}
          onPointerUp={onBannerPointerUp}
          onPointerCancel={onBannerPointerCancel}
        >
          <div
            className={`flex h-full ease-out ${dragDx === 0 ? "transition-transform duration-500" : ""}`}
            style={{ transform: `translateX(calc(-${currentBanner * 100}% + ${dragDx}px))` }}
          >
            {banners.map((banner, i) => {
              // 경로가 없으면 클릭 대상이 아니다. 핸들러를 떼는 것으로 끝내지 않고
              // 커서와 role에서도 드러내, 눌러도 되는 배너처럼 보이지 않게 한다.
              // (tabIndex는 주지 않는다 — 화면 밖 슬라이드에 포커스가 들어가면
              //  overflow-hidden 컨테이너가 스크롤되어 transform 위치와 어긋난다)
              const clickable = !!banner.path;
              // 문구가 하나라도 있을 때만 어둡게 깔리는 그라디언트를 얹는다.
              // 문구가 없는데 깔면 이미지만 이유 없이 어두워진다.
              const hasText = !!(banner.title || banner.desc);
              return (
                <div
                  key={i}
                  onClick={clickable ? () => onBannerClick(banner.path) : undefined}
                  role={clickable ? "link" : undefined}
                  aria-label={clickable ? banner.desc || banner.title || "배너" : undefined}
                  className={`w-full h-full shrink-0 relative overflow-hidden transition-transform ${
                    clickable ? "cursor-pointer active:scale-[0.99]" : "cursor-default"
                  }`}
                >
                  {/* 설명이 없는 배너는 장식 이미지로 취급한다. alt를 빼면(undefined)
                      스크린리더가 파일명을 읽으므로 빈 문자열을 명시한다. */}
                  <img src={banner.image} alt={banner.desc ?? ""} className="w-full h-full object-cover absolute inset-0" loading="lazy" />
                  {hasText && (
                    <div className="relative z-10 h-full p-6 lg:p-8 flex flex-col justify-end bg-gradient-to-t from-black/65 to-transparent">
                      {banner.title && (
                        <p className={`text-[11px] lg:text-xs text-white/85 font-mono uppercase tracking-widest ${banner.desc ? "mb-1.5" : ""}`}>
                          {banner.title}
                        </p>
                      )}
                      {banner.desc && (
                        <p className="font-extrabold text-xl lg:text-[28px] text-white leading-tight tracking-tight">{banner.desc}</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {/* 인디케이터에 그림자를 준다. 문구 없는 배너는 아래쪽 그라디언트를 깔지
              않으므로, 밝은 이미지 위에서 흰 점이 그냥 사라져버린다. */}
          <div className="absolute bottom-4 right-5 flex gap-1.5">
            {banners.map((_, i) => (
              <button
                key={i}
                onClick={() => { stopAuto(); setCurrentBanner(i); }}
                aria-label={`${i + 1}번 배너로 이동`}
                className={`h-1.5 rounded-full transition-all duration-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)] ${i === currentBanner ? "bg-white w-5" : "bg-white/50 w-1.5"}`}
              />
            ))}
          </div>
        </div>

        {/* 지표 카드 — 오버사이즈 수치 (실측). 모바일에서는 숨김(데스크톱 전용) */}
        <div className="glass-card px-6 py-6 lg:py-7 hidden lg:flex flex-col justify-center">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.09em] text-primary mb-2">지금 열린 구인 공고</p>
          <span className="text-[64px] lg:text-[92px] font-extrabold leading-[0.82] tracking-tighter text-foreground tabular-nums">
            {openJobCount ?? "—"}
          </span>
          <p className="text-[13.5px] text-muted-foreground mt-4 leading-relaxed">지원부터 첫 합주까지, 지금 멤버를 기다리는 공고</p>
          <div className="h-px bg-border my-5" />
          <div className="flex justify-between items-baseline mb-2.5">
            <span className="text-[13px] text-muted-foreground font-medium">커뮤니티 글</span>
            <b className="font-bold text-base tabular-nums">{communityCount ?? "—"}</b>
          </div>
          <div className="flex justify-between items-baseline">
            <span className="text-[13px] text-muted-foreground font-medium">제휴 연습실</span>
            <b className="font-bold text-base tabular-nums">{studioCount ?? "—"}</b>
          </div>
        </div>
      </section>

      {/* 카테고리 — 픽토그램 + EN + 볼드 타이포 카드 */}
      <section className="mb-10 lg:mb-14" style={{ animation: "reveal 0.5s cubic-bezier(0.16,1,0.3,1) 0.06s both" }}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 lg:gap-3">
          {categories.map(({ icon: Icon, en, label, path, tint, hoverBorder, hoverText }) => (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={`glass-card relative p-4 lg:p-5 flex flex-col text-left transition-colors active:scale-[0.98] group ${hoverBorder}`}
            >
              <Icon strokeWidth={2} className={`w-7 h-7 lg:w-8 lg:h-8 mb-3 group-hover:scale-110 transition-transform ${tint}`} />
              <span className="font-mono text-[10px] lg:text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">{en}</span>
              <span className="text-lg lg:text-[21px] font-extrabold tracking-tight leading-tight mt-0.5">{label}</span>
              <ChevronRight className={`absolute top-4 right-3.5 w-4 h-4 text-muted-foreground/50 transition-colors ${hoverText}`} />
            </button>
          ))}
        </div>
      </section>

      {/* 급구 구인글 + 커뮤니티 인기글 — 2단 배치 */}
      <div className="grid gap-9 lg:grid-cols-2 lg:gap-11 mb-10 lg:mb-14">
        <section style={{ animation: "reveal 0.5s cubic-bezier(0.16,1,0.3,1) 0.1s both" }}>
          <SectionHead title="급구 구인글" onMore={() => navigate("/jobs")} />
          {recentJobs.length === 0 ? (
            <EmptyRow text="아직 구인글이 없습니다. 첫 공고를 올려보세요!" />
          ) : (
            <div>
              {recentJobs.map((job) => (
                <div key={job.id} onClick={() => navigate(`/post/${job.id}`)} className="flex items-center gap-3.5 py-4 -mx-2 px-2 rounded border-b border-border last:border-b-0 cursor-pointer hover:bg-surface-hover transition-colors">
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-semibold truncate tracking-tight">
                      {urgentLabel(job) && (
                        <span className="font-mono text-[10px] font-bold align-middle mr-1.5 px-1.5 py-0.5 rounded bg-amber/15 text-amber">
                          {urgentLabel(job)}
                        </span>
                      )}
                      {job.title}
                    </p>
                    <p className="text-[12.5px] text-muted-foreground mt-0.5 truncate flex items-center gap-1"><MapPin className="w-3 h-3 shrink-0" />{job.venue || "장소 미정"}</p>
                  </div>
                  <span className="font-mono text-[10.5px] font-bold tracking-wide text-secondary-foreground bg-secondary rounded px-2 py-1 shrink-0">{job.category || "기타"}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section style={{ animation: "reveal 0.5s cubic-bezier(0.16,1,0.3,1) 0.14s both" }}>
          <SectionHead title="커뮤니티 인기글" onMore={() => navigate("/community")} />
          {popularPosts.length === 0 ? (
            <EmptyRow text="아직 커뮤니티 글이 없습니다. 첫 글을 남겨보세요!" />
          ) : (
            <div>
              {popularPosts.map((p) => (
                <div key={p.id} onClick={() => navigate(`/post/${p.id}`)} className="py-4 -mx-2 px-2 rounded border-b border-border last:border-b-0 cursor-pointer hover:bg-surface-hover transition-colors">
                  <p className="text-[15px] font-semibold truncate tracking-tight">{p.title}</p>
                  <p className="text-[12.5px] text-muted-foreground mt-1 line-clamp-1">{p.content}</p>
                  <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
                    <span className="truncate max-w-[45%]">{p.author_name || "익명"}</span>
                    <span className="flex items-center gap-1 ml-auto font-mono tabular-nums"><Heart className="w-3 h-3" />{p.likes || 0}</span>
                    <span className="flex items-center gap-1 font-mono tabular-nums"><MessageSquare className="w-3 h-3" />{p.comments || 0}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* 제휴 연습실 · 즉시예약 — 3단 배치 (신뢰 등급 = VU 게이지) */}
      {studios.length > 0 && (
        <section className="mb-6" style={{ animation: "reveal 0.5s cubic-bezier(0.16,1,0.3,1) 0.18s both" }}>
          <SectionHead title="제휴 연습실 · 즉시예약" onMore={() => navigate("/studios")} />
          <div className="grid gap-2.5 lg:grid-cols-3 lg:gap-3.5 mt-4">
            {studios.map((s) => (
              <div key={s.id} onClick={() => navigate("/studios")} className="glass-card p-4 flex items-center justify-between gap-3 hover:border-primary transition-colors cursor-pointer">
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-bold truncate tracking-tight">{s.name}</p>
                  <p className="text-[12.5px] text-muted-foreground mt-0.5 flex items-center gap-1 truncate"><MapPin className="w-3 h-3 shrink-0" />{s.address}</p>
                  <div className="flex items-center gap-2 mt-2.5">
                    <VuMeter level={tierLevel(s.tier)} />
                    <span className="font-mono text-[10px] font-bold uppercase tracking-[0.06em] text-muted-foreground">신뢰 {s.tier || "—"}등급</span>
                  </div>
                </div>
                <span className="font-mono text-[10px] font-bold tracking-wide text-signal bg-signal/10 rounded px-2 py-1 shrink-0">즉시예약</span>
              </div>
            ))}
          </div>
        </section>
      )}
      </>}

      <NotificationsPanel open={notiOpen} onClose={() => setNotiOpen(false)} />
    </PageShell>
  );
};

const SectionHead = ({ title, onMore }: { title: string; onMore: () => void }) => (
  <div className="flex items-baseline justify-between pb-3 border-b-2 border-foreground mb-1">
    <h2 className="text-lg lg:text-[19px] font-extrabold tracking-tight">{title}</h2>
    <button onClick={onMore} className="text-[13px] font-semibold text-muted-foreground hover:text-foreground transition-colors flex items-center gap-0.5 active:scale-95">
      전체보기 <ChevronRight className="w-3.5 h-3.5" />
    </button>
  </div>
);

const EmptyRow = ({ text }: { text: string }) => (
  <p className="text-[13px] text-muted-foreground text-center py-8">{text}</p>
);

export default Index;
