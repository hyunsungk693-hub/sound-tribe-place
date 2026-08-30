import { ArrowLeft, Heart, MessageSquare, Send, Mail, Pencil, Trash2 } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import PageShell from "@/components/PageShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { addRecentView } from "@/lib/recentViews";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

type Comment = {
  id: string;
  author_name: string;
  content: string;
  created_at: string;
  user_id: string;
};

const PostDetail = () => {
  const { postId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [post, setPost] = useState<any>(null);
  useDocumentTitle(post?.title);
  const [loading, setLoading] = useState(true);
  const [likeCount, setLikeCount] = useState(0);
  const [commentCount, setCommentCount] = useState(0);
  const [liked, setLiked] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const fetchPost = useCallback(async () => {
    if (!postId) return;
    setLoading(true);
    const { data } = await supabase.from("posts").select("*").eq("id", postId).single();
    setPost(data);
    setLoading(false);
    if (data) addRecentView({ id: data.id, title: data.title, type: data.post_type || "community" });
  }, [postId]);

  const fetchMeta = useCallback(async () => {
    if (!postId) return;
    const [likesRes, commentsRes] = await Promise.all([
      supabase.from("post_likes").select("id, user_id").eq("post_id", postId),
      supabase.from("post_comments").select("*").eq("post_id", postId).order("created_at", { ascending: true }),
    ]);
    const likes = likesRes.data || [];
    setLikeCount(likes.length);
    setLiked(!!user && likes.some((l: any) => l.user_id === user.id));
    const cmts = (commentsRes.data || []) as Comment[];
    setComments(cmts);
    setCommentCount(cmts.length);
  }, [postId, user]);

  useEffect(() => { fetchPost(); }, [fetchPost]);
  useEffect(() => { if (post) fetchMeta(); }, [post, fetchMeta]);

  const handleLike = async () => {
    if (!user) { toast.error("로그인이 필요합니다"); return; }
    if (!postId) return;
    if (liked) {
      await supabase.from("post_likes").delete().eq("post_id", postId).eq("user_id", user.id);
    } else {
      await supabase.from("post_likes").insert({ post_id: postId, user_id: user.id } as any);
      if (post && post.user_id !== user.id) {
        const actor = user.user_metadata?.full_name || user.email?.split("@")[0] || "익명";
        await supabase.from("notifications").insert({
          user_id: post.user_id,
          actor_name: actor,
          type: "like",
          post_id: postId,
          post_title: post.title,
        } as any);
        const { sendPushTo } = await import("@/lib/push");
        sendPushTo({ type: "like", userId: post.user_id, postId: String(postId) });
      }
    }
    await fetchMeta();
  };

  const handleSubmitComment = async () => {
    if (!user) { toast.error("로그인이 필요합니다"); return; }
    if (!postId || !newComment.trim()) return;
    setSubmitting(true);
    const { error } = await supabase.from("post_comments").insert({
      post_id: postId,
      user_id: user.id,
      author_name: user.user_metadata?.full_name || user.email?.split("@")[0] || "익명",
      content: newComment.trim(),
    } as any);
    if (error) {
      toast.error("댓글 작성에 실패했습니다");
    } else {
      toast.success("댓글이 등록되었습니다");
      setNewComment("");
      if (post && post.user_id !== user.id) {
        const actor = user.user_metadata?.full_name || user.email?.split("@")[0] || "익명";
        await supabase.from("notifications").insert({
          user_id: post.user_id,
          actor_name: actor,
          type: "comment",
          post_id: postId,
          post_title: post.title,
        } as any);
        const { sendPushTo } = await import("@/lib/push");
        sendPushTo({ type: "comment", userId: post.user_id, postId: String(postId) });
      }
      await fetchMeta();
    }
    setSubmitting(false);
  };

  const handleSaveEdit = async () => {
    if (!user || !postId) return;
    if (!editTitle.trim() || !editContent.trim()) { toast.error("제목과 내용을 입력해주세요"); return; }
    setSavingEdit(true);
    const { error } = await supabase.from("posts").update({ title: editTitle.trim(), content: editContent.trim() } as any).eq("id", postId).eq("user_id", user.id);
    if (error) { toast.error("수정에 실패했습니다"); }
    else { toast.success("수정되었습니다"); setEditing(false); await fetchPost(); }
    setSavingEdit(false);
  };

  const handleDelete = async () => {
    if (!user || !postId) return;
    if (!confirm("게시물을 삭제하시겠습니까?")) return;
    await supabase.from("posts").delete().eq("id", postId).eq("user_id", user.id);
    toast.success("삭제되었습니다");
    navigate(-1);
  };

  const postTypeLabel = (type: string) => {
    switch (type) {
      case "promotion": return "홍보";
      case "job": return "구인구직";
      case "community": return "커뮤니티";
      default: return type;
    }
  };

  if (loading) {
    return (
      <PageShell>
        <div className="pt-4 space-y-4">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-32 w-full" />
        </div>
      </PageShell>
    );
  }

  if (!post) {
    return (
      <PageShell>
        <div className="pt-10 text-center">
          <p className="text-muted-foreground text-sm mb-4">게시물을 찾을 수 없습니다</p>
          <button onClick={() => navigate(-1)} className="text-primary text-sm font-medium">돌아가기</button>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="pt-4 pb-24 lg:max-w-[720px] lg:mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => navigate(-1)} className="p-1.5 -ml-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            {post.user_id === user?.id && !editing && (
              <>
                <button onClick={() => { setEditTitle(post.title); setEditContent(post.content); setEditing(true); }} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-primary transition-colors">
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={handleDelete} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
            <span className="font-mono text-[10.5px] font-bold tracking-wide px-2 py-1 rounded bg-secondary text-secondary-foreground">
              {post.category || postTypeLabel(post.post_type)}
            </span>
          </div>
        </div>

        {/* Author */}
        <div className="flex items-center gap-2.5 mb-6">
          <div
            className="w-10 h-10 rounded-lg bg-secondary text-secondary-foreground flex items-center justify-center text-sm font-extrabold cursor-pointer"
            onClick={() => navigate(`/profile/${post.user_id}`)}
          >
            {(post.author_name || "익")[0]}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold tracking-tight cursor-pointer hover:text-primary transition-colors" onClick={() => navigate(`/profile/${post.user_id}`)}>
              {post.author_name || "익명"}
            </p>
            <p className="text-[11px] text-muted-foreground font-mono tabular-nums mt-0.5">{new Date(post.created_at).toLocaleDateString("ko-KR")}</p>
          </div>
          {post.user_id !== user?.id && (
            <button
              onClick={() => navigate(`/messages?to=${post.user_id}`)}
              className="flex items-center gap-1.5 px-3.5 h-9 text-xs font-semibold rounded-lg bg-action text-action-foreground hover:bg-action-hover active:scale-95 transition-all"
            >
              <Mail className="w-3.5 h-3.5" /> 메시지
            </button>
          )}
        </div>

        {/* Content */}
        {editing ? (
          <div className="space-y-3 mb-5">
            <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
            <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} rows={6} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
            <div className="flex gap-2">
              <button onClick={() => setEditing(false)} className="flex-1 h-10 rounded-lg border border-border text-sm font-medium hover:bg-secondary transition-colors">취소</button>
              <button onClick={handleSaveEdit} disabled={savingEdit} className="flex-1 h-10 rounded-lg bg-action text-action-foreground text-sm font-medium hover:bg-action-hover disabled:opacity-50 active:scale-95 transition-all">{savingEdit ? "저장 중..." : "저장"}</button>
            </div>
          </div>
        ) : (
          <>
            <h1 className="text-2xl lg:text-[28px] font-extrabold tracking-tight leading-tight mb-4">{post.title}</h1>
            {post.image_url && (
              <div className="mb-4 rounded-lg overflow-hidden border border-border">
                <img src={post.image_url} alt="" className="w-full max-h-72 object-cover" />
              </div>
            )}
            {/* Extra fields for jobs/rooms */}
            {(post.venue || post.pay || post.area || post.price || post.hours) && (
              <div className="flex flex-wrap gap-x-4 gap-y-1.5 mb-4 text-[12.5px] text-muted-foreground font-medium">
                {post.venue && <span className="flex items-center gap-1">📍 {post.venue}</span>}
                {post.pay && <span className="flex items-center gap-1 font-mono tabular-nums">💰 {post.pay}</span>}
                {post.area && <span className="flex items-center gap-1">📍 {post.area}</span>}
                {post.price && <span className="flex items-center gap-1 font-mono tabular-nums">💰 {post.price}</span>}
                {post.hours && <span className="flex items-center gap-1 font-mono tabular-nums">🕐 {post.hours}</span>}
              </div>
            )}
            <p className="text-[15px] text-foreground/80 leading-relaxed whitespace-pre-wrap mt-2">{post.content}</p>
          </>
        )}

        {/* Like / Comment Count */}
        <div className="flex items-center gap-5 mt-6 pt-5 border-t border-border">
          <button onClick={handleLike} className={`flex items-center gap-1.5 text-sm font-mono tabular-nums transition-colors active:scale-95 ${liked ? "text-red-500" : "text-muted-foreground hover:text-primary"}`}>
            <Heart className={`w-4 h-4 ${liked ? "fill-red-500" : ""}`} /> {likeCount}
          </button>
          <span className="flex items-center gap-1.5 text-sm font-mono tabular-nums text-muted-foreground">
            <MessageSquare className="w-4 h-4" /> {commentCount}
          </span>
        </div>

        {/* Comments */}
        <div className="mt-8">
          <div className="flex items-baseline justify-between pb-3 border-b-2 border-foreground mb-2">
            <h2 className="text-lg lg:text-[19px] font-extrabold tracking-tight">댓글</h2>
            <span className="font-mono text-[12px] font-bold text-muted-foreground tabular-nums">{commentCount}</span>
          </div>
          {comments.length > 0 ? (
            <div>
              {comments.map((c) => (
                <div key={c.id} className="flex gap-3 py-4 border-b border-border last:border-b-0">
                  <div className="w-8 h-8 rounded-lg bg-secondary text-secondary-foreground flex items-center justify-center text-xs font-extrabold shrink-0">
                    {c.author_name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-semibold tracking-tight">{c.author_name}</span>
                      <span className="text-[10.5px] text-muted-foreground font-mono tabular-nums">{new Date(c.created_at).toLocaleDateString("ko-KR")}</span>
                      {user && c.user_id === user.id && (
                        <button
                          onClick={async () => {
                            if (!confirm("댓글을 삭제하시겠습니까?")) return;
                            await supabase.from("post_comments").delete().eq("id", c.id);
                            toast.success("댓글이 삭제되었습니다");
                            await fetchMeta();
                          }}
                          className="text-[10.5px] text-muted-foreground hover:text-destructive transition-colors ml-auto"
                        >
                          삭제
                        </button>
                      )}
                    </div>
                    <p className="text-[13.5px] text-foreground/80 mt-1 leading-relaxed">{c.content}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[13px] text-muted-foreground text-center py-8">아직 댓글이 없습니다.</p>
          )}
        </div>
      </div>

      {/* Fixed comment input */}
      <div className="fixed bottom-16 lg:bottom-0 left-0 right-0 z-50 p-3 bg-background/95 backdrop-blur-sm border-t border-border">
        <div className="max-w-[720px] mx-auto flex gap-2 px-1 lg:px-0">
          <input
            type="text"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSubmitComment()}
            placeholder="댓글을 입력하세요..."
            className="flex-1 h-10 px-3.5 rounded-lg border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <button
            onClick={handleSubmitComment}
            disabled={submitting || !newComment.trim()}
            className="w-10 h-10 rounded-lg bg-action text-action-foreground flex items-center justify-center disabled:opacity-50 active:scale-95 transition-all"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </PageShell>
  );
};

export default PostDetail;
