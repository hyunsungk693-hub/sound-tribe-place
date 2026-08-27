import { useState } from "react";
import { Bell, Mail, User } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import NotificationsPanel, { useUnreadCount } from "@/components/NotificationsPanel";
import logoIcon from "@/assets/logo-icon.png";

const links = [
  { path: "/", label: "홈" },
  { path: "/jobs", label: "구인구직" },
  { path: "/rooms", label: "연습실" },
  { path: "/shops", label: "악기사" },
  { path: "/community", label: "커뮤니티" },
];

// 데스크톱(lg 이상) 전용 상단 내비게이션. 모바일은 BottomNav가 담당한다.
const TopNav = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [notiOpen, setNotiOpen] = useState(false);
  const { count } = useUnreadCount();

  const iconBtnCls = (active: boolean) =>
    `relative w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
      active ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-surface-hover"
    }`;

  return (
    <div className="hidden lg:block sticky top-0 z-50 bg-card/95 backdrop-blur-lg border-b border-border/50">
      <div className="max-w-5xl mx-auto h-16 px-6 flex items-center gap-8">
        <button onClick={() => navigate("/")} className="flex items-center gap-2.5 shrink-0 active:scale-95 transition-transform">
          <img src={logoIcon} alt="instrut" className="w-9 h-9 rounded-xl" />
          <span className="text-xl font-bold tracking-tight text-primary">instrut</span>
        </button>
        <nav className="flex items-center gap-1 flex-1">
          {links.map(({ path, label }) => (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                location.pathname === path
                  ? "text-primary bg-primary/10"
                  : "text-muted-foreground hover:text-foreground hover:bg-surface-hover"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="flex items-center gap-1.5">
          {user ? (
            <>
              <button onClick={() => setNotiOpen(true)} aria-label="알림" className={iconBtnCls(false)}>
                <Bell className="w-5 h-5" />
                {count > 0 && (
                  <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center text-[9px] font-bold">
                    {count > 99 ? "99+" : count}
                  </span>
                )}
              </button>
              <button onClick={() => navigate("/messages")} aria-label="메시지" className={iconBtnCls(location.pathname === "/messages")}>
                <Mail className="w-5 h-5" />
              </button>
              <button onClick={() => navigate("/profile")} aria-label="프로필" className={iconBtnCls(location.pathname === "/profile")}>
                <User className="w-5 h-5" />
              </button>
            </>
          ) : (
            <button
              onClick={() => navigate("/auth")}
              className="px-4 h-9 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors active:scale-95"
            >
              로그인
            </button>
          )}
        </div>
      </div>
      <NotificationsPanel open={notiOpen} onClose={() => setNotiOpen(false)} />
    </div>
  );
};

export default TopNav;
