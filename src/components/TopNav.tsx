import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import NotificationsPanel, { useUnreadCount } from "@/components/NotificationsPanel";

const links = [
  { path: "/", label: "홈" },
  { path: "/jobs", label: "구인구직" },
  { path: "/rooms", label: "연습실" },
  { path: "/shops", label: "악기사" },
  { path: "/community", label: "커뮤니티" },
];

// 데스크톱(lg 이상) 전용 상단 내비게이션. 모바일은 BottomNav가 담당한다.
// 미니멀 리디자인: 아이콘 제거 → 볼드 워드마크 + 텍스트 링크.
const TopNav = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [notiOpen, setNotiOpen] = useState(false);
  const { count } = useUnreadCount();

  const textLink = (active: boolean) =>
    `relative text-sm font-medium transition-colors ${
      active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
    }`;

  return (
    <div className="hidden lg:block sticky top-0 z-50 bg-card/95 backdrop-blur-lg border-b border-border">
      <div className="max-w-[1180px] mx-auto h-16 px-6 lg:px-8 flex items-center gap-10">
        <button
          onClick={() => navigate("/")}
          className="shrink-0 active:scale-95 transition-transform"
          aria-label="instrut 홈"
        >
          <span className="text-[1.4rem] font-extrabold tracking-tight text-foreground leading-none">
            instrut<span className="text-primary">.</span>
          </span>
        </button>
        <nav className="flex items-center gap-7 flex-1">
          {links.map(({ path, label }) => {
            const active = location.pathname === path;
            return (
              <button
                key={path}
                onClick={() => navigate(path)}
                className={`relative py-1 text-sm font-semibold tracking-tight transition-colors ${
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
                {active && (
                  <span className="absolute -bottom-[21px] left-0 right-0 h-0.5 bg-primary rounded-full" />
                )}
              </button>
            );
          })}
        </nav>
        <div className="flex items-center gap-6">
          {user ? (
            <>
              <button onClick={() => setNotiOpen(true)} className={textLink(false)}>
                알림
                {count > 0 && (
                  <span className="absolute -top-1.5 -right-3 min-w-[15px] h-[15px] px-1 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[9px] font-bold font-mono">
                    {count > 99 ? "99+" : count}
                  </span>
                )}
              </button>
              <button onClick={() => navigate("/messages")} className={textLink(location.pathname === "/messages")}>
                메시지
              </button>
              <button onClick={() => navigate("/profile")} className={textLink(location.pathname === "/profile")}>
                프로필
              </button>
            </>
          ) : (
            <button
              onClick={() => navigate("/auth")}
              className="px-5 h-9 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors active:scale-95"
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
