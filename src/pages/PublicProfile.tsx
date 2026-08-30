import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MessageCircle, LogIn, UserX } from "lucide-react";
import PageShell from "@/components/PageShell";
import ProfileCard, { ProfileCardData } from "@/components/ProfileCard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

// D5: /u/{handle} — 비로그인 공개 프로필 카드 페이지.
// 인스타 스토리·오픈채팅에 붙는 공유 랜딩이므로 로그인 없이 열람 가능해야 한다.
const PublicProfile = () => {
  const { handle } = useParams<{ handle: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [profile, setProfile] = useState<ProfileCardData | null>(null);
  const [loading, setLoading] = useState(true);

  useDocumentTitle(profile?.display_name ? `${profile.display_name} (@${handle})` : null);

  useEffect(() => {
    if (!handle) return;
    setLoading(true);
    (supabase.from("profiles") as any)
      .select("*")
      .eq("handle", handle.toLowerCase())
      .maybeSingle()
      .then(({ data }: { data: ProfileCardData | null }) => {
        setProfile(data ?? null);
        setLoading(false);
      });
  }, [handle]);

  return (
    <PageShell>
      <div className="max-w-lg mx-auto pt-4 lg:pt-8">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !profile ? (
          <div className="text-center py-20">
            <UserX className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-semibold">존재하지 않는 프로필입니다</p>
            <p className="text-xs text-muted-foreground mt-1">@{handle} 핸들을 가진 음악인을 찾을 수 없습니다.</p>
            <button
              onClick={() => navigate("/")}
              className="mt-5 px-4 h-10 rounded-xl bg-action text-action-foreground text-sm font-semibold hover:bg-action-hover transition-colors active:scale-95"
            >
              instrut 둘러보기
            </button>
          </div>
        ) : (
          <>
            {/* stats는 미전달 → full 카드가 user_stats를 단건 조회해 신뢰 영역·배지를 점등 */}
            <ProfileCard profile={profile} variant="full" clickable={false} />

            {/* 카드 보기 */}
            <button
              onClick={() => navigate(`/u/${profile.handle}/card`)}
              className="mt-4 w-full h-11 rounded-xl bg-card border border-border text-sm font-medium hover:bg-surface-hover active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              🪪 소개 카드 보기
            </button>

            {/* CTA */}
            <div className="mt-3">
              {user ? (
                user.id !== profile.user_id && (
                  <button
                    onClick={() => navigate(`/messages?to=${profile.user_id}`)}
                    className="w-full h-11 rounded-xl bg-action text-action-foreground text-sm font-medium hover:bg-action-hover active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                  >
                    <MessageCircle className="w-4 h-4" /> 메시지 보내기
                  </button>
                )
              ) : (
                <button
                  onClick={() => navigate("/auth")}
                  className="w-full h-11 rounded-xl bg-action text-action-foreground text-sm font-medium hover:bg-action-hover active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  <LogIn className="w-4 h-4" /> instrut에서 함께하기
                </button>
              )}
              <p className="text-[11px] text-muted-foreground text-center mt-3">
                믿을 수 있는 밴드·세션 멤버를 찾고, 첫 합주까지 바로 잡는 곳 — instrut
              </p>
            </div>
          </>
        )}
      </div>
    </PageShell>
  );
};

export default PublicProfile;
