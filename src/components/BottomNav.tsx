import { Home, Briefcase, MapPin, MessageCircle, User } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

const navItems = [
  { path: "/", icon: Home, label: "홈" },
  { path: "/jobs", icon: Briefcase, label: "구인구직" },
  { path: "/rooms", icon: MapPin, label: "연습실" },
  { path: "/community", icon: MessageCircle, label: "커뮤니티" },
  { path: "/profile", icon: User, label: "프로필" },
];

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/90 backdrop-blur-lg border-t border-border/50 pb-safe">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
        {navItems.map(({ path, icon: Icon, label }) => {
          const isActive = location.pathname === path;
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={`relative flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-all duration-200 active:scale-95 ${
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[10px] font-medium">{label}</span>
              {isActive && (
                <div className="absolute bottom-1 w-1 h-1 rounded-full bg-primary" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
