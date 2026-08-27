import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Music, Award, ArrowLeft, Mail } from "lucide-react";
import PageShell from "@/components/PageShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

interface Profile {
  display_name: string | null;
  location: string | null;
  instruments: string[] | null;
  genres: string[] | null;
  bio: string | null;
  avatar_url: string | null;
  user_id: string;
}

const UserProfile = () => {
  useDocumentTitle("프로필");
  const { userId } = useParams<{ userId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [postCount, setPostCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    // Redirect to own profile page
    if (user?.id === userId) {
      navigate("/profile", { replace: true });
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      const [profileRes, postCountRes] = await Promise.all([
        supabase.from("profiles").select("display_name, location, instruments, genres, bio, avatar_url, user_id").eq("user_id", userId).single(),
        supabase.from("posts").select("id", { count: "exact", head: true }).eq("user_id", userId),
      ]);
      if (profileRes.data) setProfile(profileRes.data);
      setPostCount(postCountRes.count || 0);
      setLoading(false);
    };
    fetchData();
  }, [userId, user, navigate]);

  if (loading) {
    return (
      <PageShell title="프로필">
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </PageShell>
    );
  }

  if (!profile) {
    return (
      <PageShell title="프로필">
        <div className="text-center py-20 text-muted-foreground text-sm">
          사용자를 찾을 수 없습니다.
        </div>
      </PageShell>
    );
  }

  const displayName = profile.display_name || "사용자";
  const initials = displayName.charAt(0).toUpperCase();
  const instruments = profile.instruments?.length ? profile.instruments : [];
  const genres = profile.genres?.length ? profile.genres : [];

  return (
    <PageShell title="프로필">
      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        className="mb-4 p-1.5 rounded-full hover:bg-secondary transition-colors"
      >
        <ArrowLeft className="w-5 h-5" />
      </button>

      {/* Profile Card */}
      <div className="glass-card p-5 mb-4" style={{ animation: "reveal 0.6s cubic-bezier(0.16,1,0.3,1) both" }}>
        <div className="flex items-center gap-4 mb-4">
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt="avatar" className="w-16 h-16 rounded-2xl object-cover" />
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-xl font-bold text-primary">
              {initials}
            </div>
          )}
          <div className="flex-1">
            <h2 className="text-lg font-bold">{displayName}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {profile.location || "위치 미설정"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">게시물 {postCount}개</p>
          </div>
        </div>

        {profile.bio && (
          <p className="text-sm text-muted-foreground mb-3">{profile.bio}</p>
        )}

        {user && (
          <button
            onClick={() => navigate(`/messages?to=${profile.user_id}`)}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 active:scale-[0.98] transition-all"
          >
            <Mail className="w-4 h-4" />
            메시지 보내기
          </button>
        )}
      </div>

      {/* Instruments & Genres */}
      {(instruments.length > 0 || genres.length > 0) && (
        <div className="glass-card p-4 mb-4" style={{ animation: "reveal 0.6s cubic-bezier(0.16,1,0.3,1) 0.08s both" }}>
          {instruments.length > 0 && (
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
          )}
          {genres.length > 0 && (
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
          )}
        </div>
      )}
    </PageShell>
  );
};

export default UserProfile;
