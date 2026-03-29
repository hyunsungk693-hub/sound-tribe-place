import { useEffect, useState } from "react";
import { Settings, ChevronRight, Music, Award, MapPin, Calendar, Edit3, Bell, Shield, HelpCircle, LogOut } from "lucide-react";
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

const ProfilePage = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);

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
