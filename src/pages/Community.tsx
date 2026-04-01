import { Heart, MessageSquare, Share2, TrendingUp, ArrowLeft, Send, Search, X, Mail } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import PageShell from "@/components/PageShell";
import CreatePostDialog from "@/components/CreatePostDialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const tabs = ["전체", "자유", "질문", "거래"];

const communityFields = [
  { key: "title", label: "제목", placeholder: "글 제목을 입력해주세요" },
  { key: "content", label: "내용", placeholder: "내용을 작성해주세요", type: "textarea" as const },
  { key: "category", label: "카테고리", placeholder: "", type: "select" as const, options: ["자유", "질문", "거래"] },
  { key: "author_name", label: "닉네임", placeholder: "닉네임" },
];

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

type Comment = {
  id: string;
  author_name: string;
  content: string;
  created_at: string;
  user_id: string;
};

const Community = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [dbPosts, setDbPosts] = useState<any[]>([]);
  const [selectedTab, setSelectedTab] = useState("전체");
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [selectedPost, setSelectedPost] = useState<PostItem | null>(null);

  // Like/comment counts from DB
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [userLikes, setUserLikes] = useState<Set<string>>(new Set());

  // Detail modal state
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);

  const fetchPosts = useCallback(async () => {
    const { data } = await supabase
      .from("posts")
      .select("*")
      .eq("post_type", "community")
      .order("created_at", { ascending: false });
    setDbPosts(data || []);
  }, []);

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
    setLikeCounts(lc);

    // Fetch comment counts
    const { data: cmts } = await supabase
      .from("post_comments")
      .select("post_id")
      .in("post_id", postIds);

    const cc: Record<string, number> = {};
    (cmts || []).forEach((c: any) => {
      cc[c.post_id] = (cc[c.post_id] || 0) + 1;
    });
    setCommentCounts(cc);

    // Fetch user's likes
    if (user) {
      const { data: myLikes } = await supabase
        .from("post_likes")
        .select("post_id")
        .eq("user_id", user.id)
        .in("post_id", postIds);
      setUserLikes(new Set((myLikes || []).map((l: any) => l.post_id)));
    }
  }, [user]);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  useEffect(() => {
    const ids = dbPosts.map((p) => p.id);
    fetchLikesAndComments(ids);
  }, [dbPosts, fetchLikesAndComments]);

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
      likeCount: likeCounts[p.id] || 0,
      commentCount: commentCounts[p.id] || 0,
      liked: userLikes.has(p.id),
    })),
    ...[
      { id: null, user_id: null, author: "김재현", time: "2시간 전", tab: "자유", title: "오늘 라이브 후기", content: "홍대에서 첫 라이브 했는데 긴장돼서 손이 떨렸지만 나름 잘 마무리한 것 같아요 ㅎㅎ", image_url: null, likeCount: 24, commentCount: 8, liked: false },
      { id: null, user_id: null, author: "박소연", time: "5시간 전", tab: "질문", title: "이어폰 모니터링 추천", content: "라이브 공연할 때 쓸 인이어 모니터 추천 부탁드립니다. 예산은 30만원 정도예요.", image_url: null, likeCount: 12, commentCount: 15, liked: false },
      { id: null, user_id: null, author: "이동건", time: "1일 전", tab: "자유", title: "주말 합주 멤버 구합니다", content: "토요일 오후 합정에서 합주할 보컬, 기타 구합니다. 장르는 인디록이고 커버 위주예요.", image_url: null, likeCount: 31, commentCount: 22, liked: false },
      { id: null, user_id: null, author: "최유진", time: "3시간 전", tab: "거래", title: "펜더 텔레캐스터 판매", content: "2022년 구매한 펜더 플레이어 텔레캐스터 판매합니다. 상태 A급, 케이스 포함.", image_url: null, likeCount: 18, commentCount: 6, liked: false },
      { id: null, user_id: null, author: "정민호", time: "6시간 전", tab: "자유", title: "녹음 스튜디오 추천", content: "강남 쪽에 가성비 좋은 녹음 스튜디오 아시는 분? 보컬 녹음 위주입니다.", image_url: null, likeCount: 9, commentCount: 11, liked: false },
    ],
  ];

  const query = searchQuery.trim().toLowerCase();
  const searched = query
    ? allPosts.filter((p) => p.title.toLowerCase().includes(query) || p.content.toLowerCase().includes(query) || p.author.toLowerCase().includes(query))
    : allPosts;
  const filtered = selectedTab === "전체" ? searched : searched.filter((p) => p.tab === selectedTab);
  const topPost = [...allPosts].sort((a, b) => b.likeCount - a.likeCount)[0];

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
        await supabase.from("notifications").insert({
          user_id: ownerPost.user_id,
          actor_name: user.user_metadata?.full_name || user.email?.split("@")[0] || "익명",
          type: "like",
          post_id: post.id,
          post_title: post.title,
        } as any);
      }
    }

    // Refresh counts
    const ids = dbPosts.map((p) => p.id);
    await fetchLikesAndComments(ids);

    // Update selected post if open
    if (selectedPost?.id === post.id) {
      setSelectedPost((prev) => prev ? { ...prev, liked: !prev.liked, likeCount: prev.liked ? prev.likeCount - 1 : prev.likeCount + 1 } : null);
    }
  };

  // Fetch comments for detail view
  const fetchComments = async (postId: string) => {
    const { data } = await supabase
      .from("post_comments")
      .select("*")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });
    setComments((data || []) as Comment[]);
  };

  const openPost = (post: PostItem) => {
    setSelectedPost(post);
    setComments([]);
    setNewComment("");
    if (post.id) fetchComments(post.id);
  };

  const handleSubmitComment = async () => {
    if (!user) { toast.error("로그인이 필요합니다"); return; }
    if (!selectedPost?.id) { toast("샘플 게시물에는 댓글을 달 수 없습니다"); return; }
    if (!newComment.trim()) { toast.error("댓글 내용을 입력해주세요"); return; }

    setSubmittingComment(true);
    const { error } = await supabase.from("post_comments").insert({
      post_id: selectedPost.id,
      user_id: user.id,
      author_name: user.user_metadata?.full_name || user.email?.split("@")[0] || "익명",
      content: newComment.trim(),
    } as any);

    if (error) {
      toast.error("댓글 작성에 실패했습니다");
    } else {
      toast.success("댓글이 등록되었습니다");
      setNewComment("");
      await fetchComments(selectedPost.id);
      const ids = dbPosts.map((p) => p.id);
      await fetchLikesAndComments(ids);
      setSelectedPost((prev) => prev ? { ...prev, commentCount: prev.commentCount + 1 } : null);
      // Send notification to post owner
      const ownerPost = dbPosts.find((p) => p.id === selectedPost.id);
      if (ownerPost && ownerPost.user_id !== user.id) {
        await supabase.from("notifications").insert({
          user_id: ownerPost.user_id,
          actor_name: user.user_metadata?.full_name || user.email?.split("@")[0] || "익명",
          type: "comment",
          post_id: selectedPost.id,
          post_title: selectedPost.title,
        } as any);
      }
    }
    setSubmittingComment(false);
  };

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
            <button
              onClick={() => { setSearchQuery(""); setShowSearch(false); }}
              className="p-1 rounded-full hover:bg-secondary"
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

      <div className="flex gap-2 mb-5 overflow-x-auto no-scrollbar pb-1">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setSelectedTab(tab)}
            className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-200 active:scale-95 ${
              tab === selectedTab ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-surface-hover"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {topPost && (
        <div
          className="glass-card p-3.5 mb-5 flex items-center gap-3 cursor-pointer hover:bg-surface-hover active:scale-[0.98] transition-all"
          style={{ animation: "reveal 0.6s cubic-bezier(0.16,1,0.3,1) both" }}
          onClick={() => openPost(topPost)}
        >
          <TrendingUp className="w-4 h-4 text-primary shrink-0" />
          <div className="overflow-hidden">
            <p className="text-[10px] text-primary font-medium mb-0.5">인기글</p>
            <p className="text-xs truncate">{topPost.title} — ♥ {topPost.likeCount} · 댓글 {topPost.commentCount}개</p>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="text-center py-10 text-muted-foreground text-sm">
            {searchQuery ? `"${searchQuery}"에 대한 검색 결과가 없습니다` : "게시물이 없습니다"}
          </div>
        )}
        {filtered.map((post, i) => (
          <div key={post.id || `sample-${i}`} onClick={() => openPost(post)} className="glass-card p-4 hover:bg-surface-hover transition-colors duration-200 cursor-pointer active:scale-[0.98]" style={{ animation: `reveal 0.5s cubic-bezier(0.16,1,0.3,1) ${0.1 + i * 0.06}s both` }}>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center text-[10px] font-bold">{post.author[0]}</div>
              <span className="text-xs font-medium">{post.author}</span>
              <span className="text-[10px] text-muted-foreground">{post.time}</span>
              <span className="ml-auto text-[10px] font-medium px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">{post.tab}</span>
            </div>
            <h3 className="text-sm font-semibold mb-1">{post.title}</h3>
            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{post.content}</p>
            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border/30">
              <button
                onClick={(e) => handleLike(post, e)}
                className={`flex items-center gap-1 text-xs transition-colors active:scale-95 ${post.liked ? "text-red-500" : "text-muted-foreground hover:text-primary"}`}
              >
                <Heart className={`w-3.5 h-3.5 ${post.liked ? "fill-red-500" : ""}`} /> {post.likeCount}
              </button>
              <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors active:scale-95">
                <MessageSquare className="w-3.5 h-3.5" /> {post.commentCount}
              </button>
              <button className="ml-auto text-muted-foreground hover:text-primary transition-colors active:scale-95">
                <Share2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <CreatePostDialog postType="community" fields={communityFields} onCreated={fetchPosts} />

      {/* Post Detail Modal */}
      {selectedPost && (
        <div className="fixed inset-0 z-[9999] bg-black/40 flex items-end justify-center" onClick={() => setSelectedPost(null)}>
          <div
            className="w-full max-w-lg bg-background rounded-t-2xl max-h-[85vh] flex flex-col animate-in slide-in-from-bottom duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-5 pb-0">
              <div className="flex items-center justify-between mb-4">
                <button onClick={() => setSelectedPost(null)} className="p-1 rounded-full hover:bg-secondary">
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <span className="text-[10px] font-medium px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground">{selectedPost.tab}</span>
              </div>

              <div className="flex items-center gap-2 mb-4">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center text-xs font-bold">{selectedPost.author[0]}</div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{selectedPost.author}</p>
                  <p className="text-[10px] text-muted-foreground">{selectedPost.time}</p>
                </div>
                {selectedPost.user_id && selectedPost.user_id !== user?.id && (
                  <button
                    onClick={() => {
                      setSelectedPost(null);
                      navigate(`/messages?to=${selectedPost.user_id}`);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95 transition-all"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    메시지
                  </button>
                )}
              </div>

              <h2 className="text-base font-bold mb-3">{selectedPost.title}</h2>
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{selectedPost.content}</p>

              <div className="flex items-center gap-4 mt-5 pt-4 border-t border-border/30 pb-4">
                <button
                  onClick={() => handleLike(selectedPost)}
                  className={`flex items-center gap-1.5 text-sm transition-colors ${selectedPost.liked ? "text-red-500" : "text-muted-foreground hover:text-primary"}`}
                >
                  <Heart className={`w-4 h-4 ${selectedPost.liked ? "fill-red-500" : ""}`} /> {selectedPost.likeCount}
                </button>
                <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <MessageSquare className="w-4 h-4" /> {selectedPost.commentCount}
                </span>
              </div>
            </div>

            {/* Comments */}
            <div className="flex-1 overflow-y-auto px-5 border-t border-border/30">
              <p className="text-xs font-semibold text-muted-foreground mt-4 mb-3">댓글</p>
              {selectedPost.id ? (
                comments.length > 0 ? (
                  <div className="space-y-3 pb-2">
                    {comments.map((c) => (
                      <div key={c.id} className="flex gap-2">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5">
                          {c.author_name[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium">{c.author_name}</span>
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(c.created_at).toLocaleDateString("ko-KR")}
                            </span>
                            {user && c.user_id === user.id && (
                              <button
                                onClick={async () => {
                                  if (!confirm("댓글을 삭제하시겠습니까?")) return;
                                  await supabase.from("post_comments").delete().eq("id", c.id);
                                  toast.success("댓글이 삭제되었습니다");
                                  await fetchComments(selectedPost!.id!);
                                  const ids = dbPosts.map((p) => p.id);
                                  await fetchLikesAndComments(ids);
                                  setSelectedPost((prev) => prev ? { ...prev, commentCount: prev.commentCount - 1 } : null);
                                }}
                                className="text-[10px] text-muted-foreground hover:text-destructive transition-colors"
                              >
                                삭제
                              </button>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{c.content}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-4">아직 댓글이 없습니다.</p>
                )
              ) : (
                <p className="text-xs text-muted-foreground text-center py-4">샘플 게시물의 댓글은 표시되지 않습니다.</p>
              )}
            </div>

            {/* Comment Input */}
            {selectedPost.id && (
              <div className="p-4 border-t border-border/30 flex gap-2">
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSubmitComment()}
                  placeholder="댓글을 입력하세요..."
                  className="flex-1 h-10 px-3 rounded-lg border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <button
                  onClick={handleSubmitComment}
                  disabled={submittingComment || !newComment.trim()}
                  className="w-10 h-10 rounded-lg bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-50 active:scale-95 transition-all"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </PageShell>
  );
};

export default Community;
