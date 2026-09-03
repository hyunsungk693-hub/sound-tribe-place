import { ArrowLeft, Heart, MessageSquare, Send, Mail, Pencil, Trash2 } from "lucide-react";
import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import PageShell from "@/components/PageShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { addRecentView } from "@/lib/recentViews";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useKeyboardInset } from "@/hooks/useKeyboardInset";
import { useComposing } from "@/hooks/useComposing";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

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
  const keyboardInset = useKeyboardInset();
  // 입력창에 포커스가 있는 동안 = 키보드가 올라와 있는 동안. 이 사실 하나로 탭바를
  // 내리고(useComposing) 입력 바를 키보드 바로 위에 붙인다.
  const [composing, setComposing] = useState(false);
  const commentInputRef = useRef<HTMLInputElement>(null);
  // 전송 버튼을 누르면 그 순간 입력창의 포커스가 풀린다. 포커스만 보고 자리를 되돌리면
  // 키보드가 아직 닫히는 중인데 입력 바가 먼저 내려가 버려, 손가락 아래에서 버튼이
  // 빠져나가 탭이 빗나간다. 그래서 실측 높이가 0이 될 때까지 — 즉 키보드가 실제로
  // 사라질 때까지 — 열린 것으로 본다.
  const keyboardOpen = composing || keyboardInset > 0;
  useComposing(keyboardOpen);

  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // 삭제 확인은 네이티브 confirm 대신 AlertDialog로 받는다. confirm은 iOS에서 도메인이
  // 박힌 시스템 경고창을 띄워, 앱을 쓰던 사람에게 갑자기 브라우저가 말을 거는 꼴이 된다.
  // 홈 화면에 설치한 PWA에서는 특히 이질적이다. 게다가 confirm이 떠 있는 동안 JS가
  // 통째로 멈춰 화면 뒤의 모든 것이 굳는다.
  const [confirmDeletePost, setConfirmDeletePost] = useState(false);
  // 댓글 삭제는 목록 안에서 부르므로 "어느 댓글인지"를 상태로 들고 있어야 한다.
  // 다이얼로그는 목록 바깥에 하나만 두고 대상만 갈아 끼운다 — 댓글마다 하나씩 두면
  // 댓글 수만큼 포털이 늘어난다.
  const [deleteCommentTarget, setDeleteCommentTarget] = useState<Comment | null>(null);

  const fetchPost = useCallback(async () => {
    if (!postId) return;
    setLoading(true);
    const { data } = await supabase.from("posts").select("*").eq("id", postId).maybeSingle();
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
    // 포커스를 입력창에 붙들어 둔다 — 연달아 달 때 키보드가 내려가지 않게. await보다
    // 앞이어야 한다: iOS는 사용자 제스처가 끝난 뒤의 focus()로 키보드를 올려주지 않는다.
    commentInputRef.current?.focus();
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
    setConfirmDeletePost(false);
    await supabase.from("posts").delete().eq("id", postId).eq("user_id", user.id);
    toast.success("삭제되었습니다");
    navigate(-1);
  };

  const handleDeleteComment = async () => {
    const target = deleteCommentTarget;
    if (!target) return;
    // 먼저 닫아둔다. 삭제 후 fetchMeta로 목록이 갈릴 때까지 다이얼로그가 남아 있으면
    // 이미 사라진 댓글을 가리킨 채 떠 있게 된다.
    setDeleteCommentTarget(null);
    await supabase.from("post_comments").delete().eq("id", target.id);
    toast.success("댓글이 삭제되었습니다");
    await fetchMeta();
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
                {/* 수정·삭제가 바로 옆에 붙어 있어 .tap-44를 쓰면 44px 원이 서로 겹쳐
                    가장자리를 누를 때 어느 쪽이 눌리는지 알 수 없게 된다. 잘못 눌리면
                    글이 지워지는 쪽이라, 여기서는 padding으로 실제 크기를 키우고
                    부모의 gap-2로 두 버튼 사이를 벌려 둔다. */}
                <button onClick={() => { setEditTitle(post.title); setEditContent(post.content); setEditing(true); }} className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-primary transition-colors">
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={() => setConfirmDeletePost(true)} className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
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
                {/* 서버가 원본 비율을 알려주지 않아 h-auto로 두면 이미지가 도착하기 전 높이가
                    0이다. 그림이 뜨는 순간 본문과 댓글이 통째로 아래로 밀려 읽던 줄을 놓치고,
                    그 사이 누른 탭은 엉뚱한 곳에 떨어진다. 4:3으로 자리를 미리 잡아 둔다. */}
                <img src={post.image_url} alt="" className="w-full aspect-[4/3] object-cover" />
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
                          onClick={() => setDeleteCommentTarget(c)}
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

      {/* 하단 고정 댓글 입력.
          평소에는 탭바 위(.composer-pos)에 앉고, 키보드가 올라오면 키보드 바로 위로 붙는다.
          포커스가 있는 동안 bottom을 실측값으로 덮어쓴다 — 인라인 style이 클래스를 이긴다.
          keyboardInset은 브라우저가 visual viewport만 줄일 때(iOS) 가려진 높이가 되고,
          레이아웃 뷰포트까지 줄이는 브라우저(안드로이드)에서는 0이 된다. 후자는 이미
          fixed가 키보드 위로 올라와 있으므로 0이 정답이다 — 그때 .composer-pos의 64px를
          그대로 두면 키보드와 입력 바 사이에 탭바 자리만큼 빈 틈이 생긴다. */}
      <div
        className="fixed composer-pos left-0 right-0 z-50 p-3 bg-background/95 backdrop-blur-sm border-t border-border"
        style={keyboardOpen ? { bottom: keyboardInset } : undefined}
      >
        <div className="max-w-[720px] mx-auto flex gap-2 px-1 lg:px-0">
          <input
            ref={commentInputRef}
            type="text"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSubmitComment()}
            onFocus={() => setComposing(true)}
            onBlur={() => setComposing(false)}
            placeholder="댓글을 입력하세요..."
            enterKeyHint="send"
            className="flex-1 h-11 px-3.5 rounded-lg border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <button
            onClick={handleSubmitComment}
            // 브라우저는 mousedown에서 포커스를 누른 요소로 옮긴다. 그 순간 입력창이
            // 포커스를 잃어 키보드가 내려가고, 보낸 뒤 입력이 비면 이 버튼은 disabled가
            // 되어 포커스가 body로 떨어진다. 기본동작만 막으면 포커스는 입력창에 남고
            // click은 그대로 온다.
            onMouseDown={(e) => e.preventDefault()}
            disabled={submitting || !newComment.trim()}
            className="w-11 h-11 rounded-lg bg-action text-action-foreground flex items-center justify-center disabled:opacity-50 active:scale-[0.96] transition-transform"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 게시물 삭제 확인 — 되돌릴 수 없고 달린 댓글까지 함께 사라진다 */}
      <AlertDialog open={confirmDeletePost} onOpenChange={setConfirmDeletePost}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>게시물을 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              달린 댓글과 좋아요도 함께 사라지고, 삭제한 글은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>돌아가기</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); handleDelete(); }}>삭제하기</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 댓글 삭제 확인 — 목록에서 부르므로 어느 댓글인지 본문을 함께 보여준다.
          댓글은 서로 비슷해 보여서 확인 문구만으로는 잘못 지웠는지 알 수 없다. */}
      <AlertDialog open={!!deleteCommentTarget} onOpenChange={(o) => { if (!o) setDeleteCommentTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>댓글을 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              삭제한 댓글은 되돌릴 수 없습니다.
              {deleteCommentTarget && (
                <span className="block mt-2 text-foreground line-clamp-3">{deleteCommentTarget.content}</span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>돌아가기</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); handleDeleteComment(); }}>삭제하기</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
};

export default PostDetail;
