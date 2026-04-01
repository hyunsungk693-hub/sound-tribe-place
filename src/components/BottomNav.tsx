import { Home, Briefcase, Map, MapPin, MessageCircle, Mail, User } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const navItems = [
  { path: "/", icon: Home, label: "홈" },
  { path: "/jobs", icon: Briefcase, label: "구인구직" },
  { path: "/rooms", icon: MapPin, label: "연습실" },
  { path: "/map", icon: Map, label: "지도" },
  { path: "/community", icon: MessageCircle, label: "커뮤니티" },
  { path: "/messages", icon: Mail, label: "메시지" },
  { path: "/profile", icon: User, label: "프로필" },
];

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;

    const fetchUnread = async () => {
      // Get user's conversations
      const { data: convs } = await supabase
        .from("conversations")
        .select("id")
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`);

      if (!convs || convs.length === 0) { setUnreadCount(0); return; }

      const convIds = convs.map((c: any) => c.id);
      const { count } = await supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .in("conversation_id", convIds)
        .neq("sender_id", user.id)
        .eq("is_read", false);

      setUnreadCount(count || 0);
    };

    fetchUnread();

    // Realtime subscription for new messages
    const channel = supabase
      .channel("unread-badge")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        () => fetchUnread()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/90 backdrop-blur-lg border-t border-border/50 pb-safe">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
        {navItems.map(({ path, icon: Icon, label }) => {
          const isActive = location.pathname === path;
          const showBadge = path === "/messages" && unreadCount > 0;
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
              <div className="relative">
                <Icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 2} />
                {showBadge && (
                  <div className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center text-[9px] font-bold">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </div>
                )}
              </div>
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
