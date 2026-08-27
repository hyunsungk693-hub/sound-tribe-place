import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Mail } from "lucide-react";
import PageShell from "@/components/PageShell";
import ProfileCard, { ProfileCardData } from "@/components/ProfileCard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

const UserProfile = () => {
  useDocumentTitle("프로필");
  const { userId } = useParams<{ userId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileCardData | null>(null);
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
        supabase.from("profiles").select("*").eq("user_id", userId).single(),
        supabase.from("posts").select("id", { count: "exact", head: true }).eq("user_id", userId),
      ]);
      if (profileRes.data) setProfile(profileRes.data as ProfileCardData);
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

  return (
    <PageShell title="프로필">
      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        className="mb-4 p-1.5 rounded-full hover:bg-secondary transition-colors"
      >
        <ArrowLeft className="w-5 h-5" />
      </button>

      <div style={{ animation: "reveal 0.6s cubic-bezier(0.16,1,0.3,1) both" }}>
        {/* D1 full 카드: 정체성 영역 + (데이터 생기면) 신뢰 영역 */}
        <ProfileCard profile={profile} variant="full" clickable={false} className="mb-4" />
      </div>

      <div className="glass-card p-4 flex items-center justify-between" style={{ animation: "reveal 0.6s cubic-bezier(0.16,1,0.3,1) 0.08s both" }}>
        <p className="text-xs text-muted-foreground">게시물 {postCount}개</p>
        {user && (
          <button
            onClick={() => navigate(`/messages?to=${profile.user_id}`)}
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 active:scale-[0.98] transition-all"
          >
            <Mail className="w-4 h-4" />
            메시지 보내기
          </button>
        )}
      </div>
    </PageShell>
  );
};

export default UserProfile;
