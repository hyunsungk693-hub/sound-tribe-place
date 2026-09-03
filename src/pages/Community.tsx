import { Heart, MessageSquare, Share2, TrendingUp, Search, X, ArrowUpDown } from "lucide-react";
import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import PageShell from "@/components/PageShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { PostCardSkeleton } from "@/components/skeletons/PostSkeleton";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useFeature } from "@/hooks/useFeatureFlags";

const tabs = ["전체", "자유", "질문", "거래"];

/** 목록 한 페이지 크기 — 서버에서 range()로 끊어 받는다 */
const PAGE_SIZE = 20;

/** PostgREST .or() 필터는 쉼표·괄호로 구문을 나누므로 검색어에서 제거한다 */
const sanitizeSearch = (q: string) => q.trim().replace(/[,()%*\\]/g, " ").replace(/\s+/g, " ").trim();

type PostItem = {
  id: string | null;
  user_id: string | null;
  author: string;
  time: string;
  tab: string;
  title: string;
  content: string;
  image_url: string | null;
  likeCount: number;
  commentCount: number;
  liked: boolean;
};


// E3: "같이 할 사람 찾기" 성격의 글 감지 (규칙 기반 키워드 매칭)
const isRecruitPost = (title: string, content: string) =>
  /(구합|모집|찾습니다|찾아요|멤버|세션|합주할)/.test(`${title} ${content}`);

const Community = () => {
  useDocumentTitle("커뮤니티");
  const communityOn = useFeature("community").on;
  // 아래 "구인글 쓰기" 유도 토스트가 보낼 곳. 구인구직이 닫혀 있으면 권하지 않는다.
  const jobsOn = useFeature("jobs").on;
  const { user } = useAuth();
  const navigate = useNavigate();
  const [dbPosts, setDbPosts] = useState<any[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const postsSentinelRef = useRef<HTMLDivElement | null>(null);
  const postsReqIdRef = useRef(0);
  const [selectedTab, setSelectedTab] = useState("전체");
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [sortBy, setSortBy] = useState<"latest" | "likes" | "comments">("latest");
  // MOST LIKED 배너 — 불러온 페이지가 아니라 전체 기준 1위여야 하므로 별도 단건 조회
  const [topPost, setTopPost] = useState<{ id: string; title: string; likeCount: number; commentCount: number } | null>(null);

  // Like/comment counts from DB
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [userLikes, setUserLikes] = useState<Set<string>>(new Set());

  // Detail modal state

  /** 서버 사이드 페이지네이션 — 탭·검색·최신순을 쿼리로 내린다 */
  const fetchPosts = useCallback(async (pageIndex = 0) => {
    const reqId = ++postsReqIdRef.current;
    if (pageIndex === 0) setLoadingPosts(true);
    else setLoadingMore(true);

    let q = supabase
      .from("posts")
      .select("*", { count: "exact" })
      .eq("post_type", "community");

    if (selectedTab !== "전체") {
      // 카드에서 category가 비면 "자유"로 보여주므로, 자유 선택 시 NULL도 함께 잡는다
      if (selectedTab === "자유") q = q.or("category.eq.자유,category.is.null");
      else q = q.eq("category", selectedTab);
    }

    const term = sanitizeSearch(debouncedSearch);
    if (term) q = q.or(`title.ilike.%${term}%,content.ilike.%${term}%,author_name.ilike.%${term}%`);

    // 정렬도 서버에서 끝낸다. like_count/comment_count는 트리거로 유지되는
    // 비정규화 컬럼이라 페이지 경계와 무관하게 전체 기준으로 정렬된다.
    if (sortBy === "likes") q = q.order("like_count", { ascending: false });
    else if (sortBy === "comments") q = q.order("comment_count", { ascending: false });
    q = q.order("created_at", { ascending: false });

    const from = pageIndex * PAGE_SIZE;
    const { data, count } = await q.range(from, from + PAGE_SIZE - 1);

    if (reqId !== postsReqIdRef.current) return;

    const rows = data || [];
    setDbPosts((prev) => (pageIndex === 0 ? rows : [...prev, ...rows]));
    setTotalCount(count ?? 0);
    setPage(pageIndex);
    setHasMore(rows.length === PAGE_SIZE && from + rows.length < (count ?? 0));
    setLoadingPosts(false);
    setLoadingMore(false);
  }, [selectedTab, debouncedSearch, sortBy]);

  const fetchLikesAndComments = useCallback(async (postIds: string[]) => {
    if (postIds.length === 0) return;

    // Fetch like counts
    const { data: likes } = await supabase
      .from("post_likes")
      .select("post_id")
      .in("post_id", postIds);

    const lc: Record<string, number> = {};
    (likes || []).forEach((l: any) => {
      lc[l.post_id] = (lc[l.post_id] || 0) + 1;
    });
    setLikeCounts((prev) => ({ ...prev, ...lc }));

    // Fetch comment counts
    const { data: cmts } = await supabase
      .from("post_comments")
      .select("post_id")
      .in("post_id", postIds);

    const cc: Record<string, number> = {};
    (cmts || []).forEach((c: any) => {
      cc[c.post_id] = (cc[c.post_id] || 0) + 1;
    });
    setCommentCounts((prev) => ({ ...prev, ...cc }));

    // Fetch user's likes
    if (user) {
      const { data: myLikes } = await supabase
        .from("post_likes")
        .select("post_id")
        .eq("user_id", user.id)
        .in("post_id", postIds);
      setUserLikes((prev) => new Set([...prev, ...(myLikes || []).map((l: any) => l.post_id)]));
    }
  }, [user]);

  useEffect(() => {
    fetchPosts();
    const handler = (e: any) => {
      if (e.detail?.type !== "community") return;
      fetchPosts();
      // E3: 방금 작성한 글이 구인 성격이면 구인구직 작성 유도
      if (!user) return;
      supabase
        .from("posts")
        .select("title,content")
        .eq("post_type", "community")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
        .then(({ data }) => {
          if (data && jobsOn && isRecruitPost(data.title || "", data.content || "")) {
            toast("멤버를 찾고 계신가요?", {
              description: "구인구직에 올리면 더 빨리 찾을 수 있어요",
              duration: 8000,
              action: { label: "구인글 쓰기", onClick: () => navigate("/jobs") },
            });
          }
        });
    };
    window.addEventListener("post-created", handler);
    return () => window.removeEventListener("post-created", handler);
  }, [fetchPosts, user, navigate, jobsOn]);

  useEffect(() => {
    const ids = dbPosts.map((p) => p.id);
    fetchLikesAndComments(ids);
  }, [dbPosts, fetchLikesAndComments]);

  // 검색어 디바운스
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // 탭·검색이 바뀌면 목록을 비우고 첫 페이지부터
  useEffect(() => {
    setDbPosts([]);
    setHasMore(true);
    fetchPosts(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTab, debouncedSearch, sortBy]);

  // 인기글 배너: 좋아요 1위 1건만 (like_count는 트리거로 유지되는 비정규화 컬럼)
  useEffect(() => {
    supabase
      .from("posts")
      .select("id,title,like_count,comment_count")
      .eq("post_type", "community")
      .order("like_count", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        const d = data as { id: string; title: string; like_count: number; comment_count: number } | null;
        setTopPost(d && d.like_count > 0
          ? { id: d.id, title: d.title, likeCount: d.like_count, commentCount: d.comment_count }
          : null);
      });
  }, [dbPosts.length]);

  // 무한 스크롤
  useEffect(() => {
    const node = postsSentinelRef.current;
    if (!node || !hasMore || loadingPosts || loadingMore) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) fetchPosts(page + 1);
    }, { rootMargin: "240px" });
    io.observe(node);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMore, loadingPosts, loadingMore, page, dbPosts.length]);

  const allPosts: PostItem[] = [
    ...dbPosts.map((p) => ({
      id: p.id as string,
      user_id: p.user_id as string,
      author: p.author_name || "익명",
      time: new Date(p.created_at).toLocaleDateString("ko-KR"),
      tab: p.category || "자유",
      title: p.title,
      content: p.content,
      image_url: p.image_url || null,
      likeCount: likeCounts[p.id] ?? p.like_count ?? 0,
      commentCount: commentCounts[p.id] ?? p.comment_count ?? 0,
      liked: userLikes.has(p.id),
    })),
  ];

  // 탭·검색은 서버에서 끝난다
  const filtered = allPosts;

  // 정렬은 서버에서 끝났다. 여기서 다시 정렬하면 페이지 경계에서 순서가 어긋난다.
  const sorted = filtered;

  // Toggle like
  const handleLike = async (post: PostItem, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!user) { toast.error("로그인이 필요합니다"); return; }
    if (!post.id) { toast("샘플 게시물에는 좋아요를 누를 수 없습니다"); return; }

    if (post.liked) {
      await supabase.from("post_likes").delete().eq("post_id", post.id).eq("user_id", user.id);
    } else {
      await supabase.from("post_likes").insert({ post_id: post.id, user_id: user.id } as any);
      // Send notification to post owner
      const ownerPost = dbPosts.find((p) => p.id === post.id);
      if (ownerPost && ownerPost.user_id !== user.id) {
        const actor = user.user_metadata?.full_name || user.email?.split("@")[0] || "익명";
        await supabase.from("notifications").insert({
          user_id: ownerPost.user_id,
          actor_name: actor,
          type: "like",
          post_id: post.id,
          post_title: post.title,
        } as any);
        const { sendPushTo } = await import("@/lib/push");
        sendPushTo({ type: "like", userId: ownerPost.user_id, postId: String(post.id) });
      }
    }

    // Refresh counts
    const ids = dbPosts.map((p) => p.id);
    await fetchLikesAndComments(ids);
  };


  // 카드 공유 — Web Share API가 있으면 OS 공유 시트, 없으면(주로 데스크톱) 링크 복사로 대체한다.
  // 공유 대상은 App.tsx의 /post/:postId 라우트다.
  const handleShare = async (post: PostItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!post.id) { toast("샘플 게시물은 공유할 수 없습니다"); return; }
    const url = `${window.location.origin}/post/${post.id}`;

    if (navigator.share) {
      try {
        await navigator.share({ title: post.title, text: post.content.slice(0, 80), url });
        return;
      } catch (err) {
        // 사용자가 공유 시트를 닫은 것(AbortError)은 실패가 아니므로 조용히 끝낸다
        if ((err as DOMException)?.name === "AbortError") return;
        // 그 외(권한 거부 등)는 아래 링크 복사로 폴백한다
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      toast.success("게시물 링크를 복사했습니다");
    } catch {
      toast.error("링크 복사에 실패했습니다");
    }
  };

  const goPost = (post: PostItem) => {
    if (!user) { toast.error("자세히 보려면 로그인이 필요합니다"); navigate("/auth"); return; }
    if (!post.id) { toast.info("샘플 게시물입니다"); return; }
    navigate(`/post/${post.id}`);
  };

  // 주소로 직접 들어온 경우. 목록을 비워 보여주면 "글이 하나도 없는 서비스"로 읽히고,
  // 404로 보내면 없어진 게시판이 된다. 둘 다 사실이 아니라 닫아뒀다고 그대로 말한다.
  if (!communityOn) {
    return (
      <PageShell title="커뮤니티">
        <div className="text-center py-16 text-sm text-muted-foreground">
          커뮤니티는 지금 준비 중입니다.<br />곧 다시 열립니다.
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell title="커뮤니티">
      {/* Search Bar */}
      <div className="mb-4">
        {showSearch ? (
          <div className="flex items-center gap-2 glass-card px-3 py-2">
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            <input
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="게시물 검색 (제목, 내용, 작성자)"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            {/* 아이콘 16px + p-1이라 실제로 닿는 면이 24px밖에 안 돼 빗맞기 쉽다.
                이 줄에서 유일한 버튼이라 이웃과 겹칠 일이 없으므로, 검색줄이 뚱뚱해지지 않게
                보이는 크기는 두고 닿는 영역만 넓힌다. */}
            <button
              onClick={() => { setSearchQuery(""); setShowSearch(false); }}
              className="tap-44 p-1 rounded-full hover:bg-secondary"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowSearch(true)}
            className="flex items-center gap-2 glass-card px-3 py-2.5 w-full text-left text-xs text-muted-foreground hover:bg-surface-hover transition-colors"
          >
            <Search className="w-4 h-4" />
            <span>게시물 검색...</span>
          </button>
        )}
      </div>

      {/* 가로 스크롤 안의 버튼은 빗맞으면 그냥 안 눌리는 게 아니라 스크롤 제스처로 먹혀
          아무 일도 일어나지 않는다. 그래서 높이를 30px에서 44px 가까이 끌어올린다.
          선택된 칩에도 투명 테두리를 두는 이유: 선택 상태만 테두리가 없으면 칩 높이가 2px
          달라져 탭할 때마다 줄 전체가 들썩인다. */}
      <div className="flex gap-2 mb-5 overflow-x-auto no-scrollbar pb-1">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setSelectedTab(tab)}
            className={`shrink-0 px-3.5 py-2.5 rounded-lg border text-[13px] font-semibold tracking-tight transition-colors active:scale-95 ${
              tab === selectedTab ? "border-transparent bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:border-primary hover:text-foreground"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {topPost && (
        <div
          className="glass-card p-4 mb-5 flex items-center gap-3 cursor-pointer hover:border-primary active:scale-[0.99] transition-colors"
          style={{ animation: "reveal 0.6s cubic-bezier(0.16,1,0.3,1) both" }}
          onClick={() => { const p = allPosts.find((x) => x.id === topPost.id); if (p) goPost(p); else navigate(`/post/${topPost.id}`); }}
        >
          <TrendingUp className="w-4 h-4 text-primary shrink-0" />
          <div className="overflow-hidden flex-1">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-primary mb-0.5">Most Liked</p>
            <p className="text-[13px] truncate tracking-tight"><span className="font-semibold">{topPost.title}</span> <span className="font-mono tabular-nums text-muted-foreground">♥{topPost.likeCount} · 댓글 {topPost.commentCount}</span></p>
          </div>
        </div>
      )}

      {/* 섹션 헤더 — 볼드 하단 라인 + 정렬 */}
      <div className="flex items-baseline justify-between pb-3 border-b-2 border-foreground mb-4">
        <h2 className="text-lg lg:text-[19px] font-extrabold tracking-tight">
          {selectedTab === "전체" ? "전체 글" : selectedTab}
          <span className="ml-2 font-mono text-xs font-semibold text-muted-foreground tabular-nums align-middle">{totalCount}</span>
        </h2>
        <div className="flex items-center gap-1">
          <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground mr-0.5" />
          {([["latest", "최신"], ["likes", "인기"], ["comments", "댓글"]] as const).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setSortBy(value)}
              className={`px-2 py-1 rounded text-[11px] font-mono font-bold uppercase tracking-wide transition-colors active:scale-95 ${
                sortBy === value ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 게시판 형식 — 카드 그리드 대신 구분선으로 끊은 목록.
          항목을 누르면 상세 모달이 아니라 /post/{id} 페이지로 이동한다. */}
      <div className="border-y border-border divide-y divide-border">
        {loadingPosts ? (
          [...Array(6)].map((_, i) => <PostCardSkeleton key={i} />)
        ) : sorted.length === 0 ? (
          <div className="col-span-full text-center py-12 text-muted-foreground text-sm">
            {searchQuery ? `"${searchQuery}"에 대한 검색 결과가 없습니다` : "게시물이 없습니다"}
          </div>
        ) : null}
        {!loadingPosts && sorted.map((post, i) => (
          <div
            key={post.id || `sample-${i}`}
            onClick={() => goPost(post)}
            className="py-3.5 cursor-pointer hover:bg-surface-hover transition-colors active:scale-[0.995]"
          >
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="font-mono text-[10px] font-bold tracking-wide px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground shrink-0">{post.tab}</span>
                  <h3 className="text-[14.5px] font-bold tracking-tight truncate">{post.title}</h3>
                </div>
                <p className="text-[12.5px] text-muted-foreground line-clamp-1">{post.content}</p>
                <div className="flex items-center gap-2 mt-1.5 text-[11px] text-muted-foreground min-w-0">
                  <span
                    className="truncate hover:text-primary transition-colors"
                    onClick={(e) => { e.stopPropagation(); if (post.user_id) navigate(`/profile/${post.user_id}`); }}
                  >
                    {post.author}
                  </span>
                  <span className="font-mono shrink-0">{post.time}</span>
                  <button
                    onClick={(e) => handleLike(post, e)}
                    className={`flex items-center gap-0.5 font-mono tabular-nums shrink-0 transition-colors active:scale-95 ${post.liked ? "text-red-500" : "hover:text-primary"}`}
                  >
                    <Heart className={`w-3 h-3 ${post.liked ? "fill-red-500" : ""}`} /> {post.likeCount}
                  </button>
                  <span className="flex items-center gap-0.5 font-mono tabular-nums shrink-0">
                    <MessageSquare className="w-3 h-3" /> {post.commentCount}
                  </span>
                  <button
                    onClick={(e) => handleShare(post, e)}
                    aria-label="공유"
                    className="ml-auto shrink-0 hover:text-primary transition-colors active:scale-95"
                  >
                    <Share2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
              {post.image_url && (
                <img
                  src={post.image_url}
                  alt=""
                  className="w-14 h-14 rounded-lg object-cover shrink-0 bg-secondary"
                  loading="lazy"
                />
              )}
            </div>
          </div>
        ))}
        {loadingMore && [...Array(2)].map((_, i) => <PostCardSkeleton key={`more-${i}`} />)}
      </div>

      {!loadingPosts && hasMore && (
        <div ref={postsSentinelRef} className="py-6 text-center text-[11px] text-muted-foreground">
          더 불러오는 중... ({sorted.length}/{totalCount})
        </div>
      )}
      {!loadingPosts && !hasMore && totalCount > PAGE_SIZE && (
        <p className="py-6 text-center text-[11px] text-muted-foreground">모든 게시물을 불러왔습니다 ({totalCount}건)</p>
      )}

      

    </PageShell>
  );
};

export default Community;
