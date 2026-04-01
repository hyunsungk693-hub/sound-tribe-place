import { Heart, MessageSquare, Share2, TrendingUp, X, ArrowLeft } from "lucide-react";
import { useState, useEffect } from "react";
import PageShell from "@/components/PageShell";
import CreatePostDialog from "@/components/CreatePostDialog";
import { supabase } from "@/integrations/supabase/client";

const tabs = ["전체", "자유", "질문", "거래"];

const samplePosts = [
  { author: "김재현", time: "2시간 전", tab: "자유", title: "오늘 라이브 후기", content: "홍대에서 첫 라이브 했는데 긴장돼서 손이 떨렸지만 나름 잘 마무리한 것 같아요 ㅎㅎ", likes: 24, comments: 8 },
  { author: "박소연", time: "5시간 전", tab: "질문", title: "이어폰 모니터링 추천", content: "라이브 공연할 때 쓸 인이어 모니터 추천 부탁드립니다. 예산은 30만원 정도예요.", likes: 12, comments: 15 },
  { author: "이동건", time: "1일 전", tab: "자유", title: "주말 합주 멤버 구합니다", content: "토요일 오후 합정에서 합주할 보컬, 기타 구합니다. 장르는 인디록이고 커버 위주예요.", likes: 31, comments: 22 },
  { author: "최유진", time: "3시간 전", tab: "거래", title: "펜더 텔레캐스터 판매", content: "2022년 구매한 펜더 플레이어 텔레캐스터 판매합니다. 상태 A급, 케이스 포함.", likes: 18, comments: 6 },
  { author: "정민호", time: "6시간 전", tab: "자유", title: "녹음 스튜디오 추천", content: "강남 쪽에 가성비 좋은 녹음 스튜디오 아시는 분? 보컬 녹음 위주입니다.", likes: 9, comments: 11 },
];

const communityFields = [
  { key: "title", label: "제목", placeholder: "글 제목을 입력해주세요" },
  { key: "content", label: "내용", placeholder: "내용을 작성해주세요", type: "textarea" as const },
  { key: "category", label: "카테고리", placeholder: "", type: "select" as const, options: ["자유", "질문", "거래"] },
  { key: "author_name", label: "닉네임", placeholder: "닉네임" },
];

const Community = () => {
  const [dbPosts, setDbPosts] = useState<any[]>([]);
  const [selectedTab, setSelectedTab] = useState("전체");
  const [selectedPost, setSelectedPost] = useState<any>(null);

  const fetchPosts = async () => {
    const { data } = await supabase.from("posts").select("*").eq("post_type", "community").order("created_at", { ascending: false });
    setDbPosts(data || []);
  };

  useEffect(() => { fetchPosts(); }, []);

  const allPosts = [
    ...dbPosts.map((p) => ({
      author: p.author_name || "익명",
      time: new Date(p.created_at).toLocaleDateString("ko-KR"),
      tab: p.category || "자유",
      title: p.title,
      content: p.content,
      likes: 0,
      comments: 0,
    })),
    ...samplePosts,
  ];

  const filtered = selectedTab === "전체" ? allPosts : allPosts.filter((p) => p.tab === selectedTab);
  const topPost = [...allPosts].sort((a, b) => b.likes - a.likes)[0];

  return (
    <PageShell title="커뮤니티">
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
          onClick={() => setSelectedPost(topPost)}
        >
          <TrendingUp className="w-4 h-4 text-primary shrink-0" />
          <div className="overflow-hidden">
            <p className="text-[10px] text-primary font-medium mb-0.5">인기글</p>
            <p className="text-xs truncate">{topPost.title} — ♥ {topPost.likes} · 댓글 {topPost.comments}개</p>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {filtered.map((post, i) => (
          <div key={i} className="glass-card p-4 hover:bg-surface-hover transition-colors duration-200 cursor-pointer active:scale-[0.98]" style={{ animation: `reveal 0.5s cubic-bezier(0.16,1,0.3,1) ${0.1 + i * 0.06}s both` }}>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center text-[10px] font-bold">{post.author[0]}</div>
              <span className="text-xs font-medium">{post.author}</span>
              <span className="text-[10px] text-muted-foreground">{post.time}</span>
              <span className="ml-auto text-[10px] font-medium px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">{post.tab}</span>
            </div>
            <h3 className="text-sm font-semibold mb-1">{post.title}</h3>
            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{post.content}</p>
            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border/30">
              <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors active:scale-95"><Heart className="w-3.5 h-3.5" /> {post.likes}</button>
              <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors active:scale-95"><MessageSquare className="w-3.5 h-3.5" /> {post.comments}</button>
              <button className="ml-auto text-muted-foreground hover:text-primary transition-colors active:scale-95"><Share2 className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        ))}
      </div>

      <CreatePostDialog postType="community" fields={communityFields} onCreated={fetchPosts} />
    </PageShell>
  );
};

export default Community;
