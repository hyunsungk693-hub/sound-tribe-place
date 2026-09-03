import { useState } from "react";
import { Bell, Send, User } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import NotificationsPanel, { useUnreadCount } from "@/components/NotificationsPanel";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";
import { FeatureKey, useFeature } from "@/hooks/useFeatureFlags";

// 홈은 스위치가 없다 — 홈까지 닫으면 앱에 들어올 문이 사라진다.
const links: { path: string; label: string; flag?: FeatureKey }[] = [
  { path: "/", label: "홈" },
  { path: "/jobs", label: "구인구직", flag: "jobs" },
  { path: "/rooms", label: "연습실", flag: "rooms" },
  { path: "/shops", label: "악기사", flag: "shops" },
  { path: "/community", label: "커뮤니티", flag: "community" },
];

// 데스크톱(lg 이상) 전용 상단 내비게이션. 모바일은 BottomNav가 담당한다.
// 미니멀 리디자인: 아이콘 제거 → 볼드 워드마크 + 텍스트 링크.
const TopNav = () => {
  const { user } = useAuth();
  const location = useLocation();
  // 모바일은 BottomNav가 같은 일을 한다. 여기를 빠뜨리면 꺼진 기능이 데스크톱 상단에만
  // 남아, 눌러 들어가면 "준비 중" 안내를 만나는 앞뒤 안 맞는 화면이 된다.
  const jobs = useFeature("jobs");
  const rooms = useFeature("rooms");
  const shops = useFeature("shops");
  const community = useFeature("community");
  const flagOn: Partial<Record<FeatureKey, boolean>> = {
    jobs: jobs.on, rooms: rooms.on, shops: shops.on, community: community.on,
  };
  const visibleLinks = links.filter((l) => !l.flag || flagOn[l.flag]);
  const navigate = useNavigate();
  const [notiOpen, setNotiOpen] = useState(false);
  const { count } = useUnreadCount();
  const { count: unreadMessages } = useUnreadMessages();

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
          {visibleLinks.map(({ path, label }) => {
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
        <div className="flex items-center gap-7">
          {user ? (
            <>
              <button
                onClick={() => setNotiOpen(true)}
                aria-label={count > 0 ? `알림 ${count}개` : "알림"}
                className={`${textLink(false)} flex items-center`}
              >
                <Bell className="w-[18px] h-[18px]" strokeWidth={2} />
                {count > 0 && (
                  <span className="absolute -top-1.5 -right-2 min-w-[15px] h-[15px] px-1 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[9px] font-bold font-mono">
                    {count > 99 ? "99+" : count}
                  </span>
                )}
              </button>
              <button
                onClick={() => navigate("/messages")}
                aria-label={unreadMessages > 0 ? `메시지 ${unreadMessages}개` : "메시지"}
                className={`${textLink(location.pathname === "/messages")} flex items-center`}
              >
                <Send className="w-[18px] h-[18px]" strokeWidth={2} />
                {unreadMessages > 0 && (
                  <span className="absolute -top-1.5 -right-2 min-w-[15px] h-[15px] px-1 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[9px] font-bold font-mono">
                    {unreadMessages > 99 ? "99+" : unreadMessages}
                  </span>
                )}
              </button>
              <button
                onClick={() => navigate("/profile")}
                aria-label="프로필"
                className={`${textLink(location.pathname === "/profile")} flex items-center`}
              >
                <User className="w-[18px] h-[18px]" strokeWidth={2} />
              </button>
            </>
          ) : (
            <button
              onClick={() => navigate("/auth")}
              className="px-5 h-9 rounded-lg bg-action text-action-foreground text-sm font-semibold hover:bg-action-hover transition-colors active:scale-95"
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
