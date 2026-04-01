import { useEffect, useState } from "react";
import { Settings, ChevronRight, Music, Award, Edit3, Bell, Shield, HelpCircle, LogOut, Heart, MessageSquare } from "lucide-react";
import PageShell from "@/components/PageShell";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

interface Profile {
  display_name: string | null;
  location: string | null;
  instruments: string[] | null;
  genres: string[] | null;
  bio: string | null;
}

const menuItems = [
  { icon: Edit3, label: "프로필 수정" },
  { icon: Bell, label: "알림 설정" },
  { icon: Shield, label: "개인정보 보호" },
  { icon: HelpCircle, label: "고객센터" },
];

const activityTabs = ["내 게시물", "내 댓글"];

const ProfilePage = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [activeTab, setActiveTab] = useState("내 게시물");
  const [myPosts, setMyPosts] = useState<any[]>([]);
  const [myComments, setMyComments] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("display_name, location, instruments, genres, bio")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        if (data) setProfile(data);
      });

    // Fetch my posts
    supabase
      .from("posts")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => setMyPosts(data || []));

    // Fetch my comments
    supabase
      .from("post_comments")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => setMyComments(data || []));
  }, [user]);

  const handleLogout = async () => {
    await signOut();
    navigate("/auth");
  };

  const displayName = profile?.display_name || user?.email || "사용자";
  const initials = displayName.charAt(0).toUpperCase();
  const instruments = profile?.instruments?.length ? profile.instruments : ["악기를 추가해주세요"];
  const genres = profile?.genres?.length ? profile.genres : ["장르를 추가해주세요"];

  return (
    <PageShell title="프로필">
      {/* Profile Card */}
      <div className="glass-card p-5 mb-4" style={{ animation: "reveal 0.6s cubic-bezier(0.16,1,0.3,1) both" }}>
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-xl font-bold text-primary">
            {initials}
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold">{displayName}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {profile?.location || "위치를 설정해주세요"}
            </p>
          </div>
          <button className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center hover:bg-surface-hover transition-colors active:scale-95">
            <Settings className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {profile?.bio && (
          <p className="text-sm text-muted-foreground mb-3">{profile.bio}</p>
        )}
      </div>

      {/* Instruments & Genres */}
      <div className="glass-card p-4 mb-4" style={{ animation: "reveal 0.6s cubic-bezier(0.16,1,0.3,1) 0.08s both" }}>
        <div className="mb-3">
          <div className="flex items-center gap-2 mb-2">
            <Music className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-semibold">악기</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {instruments.map((inst) => (
              <span key={inst} className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-primary/10 text-primary">
                {inst}
              </span>
            ))}
          </div>
        </div>
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Award className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-semibold">장르</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {genres.map((genre) => (
              <span key={genre} className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground">
                {genre}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* My Activity */}
      <div className="glass-card mb-4 overflow-hidden" style={{ animation: "reveal 0.6s cubic-bezier(0.16,1,0.3,1) 0.11s both" }}>
        <div className="flex border-b border-border/40">
          {activityTabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 text-xs font-medium transition-colors ${
                activeTab === tab
                  ? "text-primary border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab} ({tab === "내 게시물" ? myPosts.length : myComments.length})
            </button>
          ))}
        </div>

        <div className="p-3 space-y-2 max-h-[300px] overflow-y-auto">
          {activeTab === "내 게시물" ? (
            myPosts.length > 0 ? (
              myPosts.map((post) => (
                <div
                  key={post.id}
                  onClick={() => navigate(post.post_type === "community" ? "/community" : post.post_type === "job" ? "/jobs" : "/rooms")}
                  className="p-3 rounded-xl bg-secondary/50 hover:bg-surface-hover cursor-pointer transition-colors active:scale-[0.98]"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                      {post.post_type === "community" ? "커뮤니티" : post.post_type === "job" ? "구인" : "연습실"}
                    </span>
                    {post.category && (
                      <span className="text-[10px] text-muted-foreground">{post.category}</span>
                    )}
                    <span className="text-[10px] text-muted-foreground ml-auto">
                      {new Date(post.created_at).toLocaleDateString("ko-KR")}
                    </span>
                  </div>
                  <h4 className="text-sm font-semibold truncate">{post.title}</h4>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{post.content}</p>
                </div>
              ))
            ) : (
              <p className="text-xs text-muted-foreground text-center py-6">작성한 게시물이 없습니다.</p>
            )
          ) : (
            myComments.length > 0 ? (
              myComments.map((comment) => (
                <div
                  key={comment.id}
                  className="p-3 rounded-xl bg-secondary/50"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <MessageSquare className="w-3 h-3 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(comment.created_at).toLocaleDateString("ko-KR")}
                    </span>
                  </div>
                  <p className="text-sm text-foreground">{comment.content}</p>
                </div>
              ))
            ) : (
              <p className="text-xs text-muted-foreground text-center py-6">작성한 댓글이 없습니다.</p>
            )
          )}
        </div>
      </div>

      {/* Menu */}
      <div className="glass-card overflow-hidden" style={{ animation: "reveal 0.6s cubic-bezier(0.16,1,0.3,1) 0.14s both" }}>
        {menuItems.map(({ icon: Icon, label }, i) => (
          <button
            key={label}
            className={`w-full flex items-center gap-3 px-4 py-3.5 hover:bg-surface-hover transition-colors active:scale-[0.99] text-left ${
              i < menuItems.length - 1 ? "border-b border-border/40" : ""
            }`}
          >
            <Icon className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium flex-1">{label}</span>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
        ))}
      </div>

      {/* Logout */}
      <button
        onClick={handleLogout}
        className="w-full mt-4 py-3 text-sm font-medium text-destructive hover:bg-destructive/5 rounded-xl transition-colors active:scale-[0.98]"
      >
        <span className="flex items-center justify-center gap-2">
          <LogOut className="w-4 h-4" />
          로그아웃
        </span>
      </button>
    </PageShell>
  );
};

export default ProfilePage;
