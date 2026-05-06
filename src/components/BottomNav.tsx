import { Home, Briefcase, Map, MapPin, MessageCircle, Mail, User, Bell, Heart, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState, useCallback } from "react";
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
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  const fetchUnreadMessages = useCallback(async () => {
    if (!user) return;
    const { data: convs } = await supabase
      .from("conversations")
      .select("id")
      .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`);

    if (!convs || convs.length === 0) { setUnreadMessages(0); return; }

    const convIds = convs.map((c: any) => c.id);
    const { count } = await supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .in("conversation_id", convIds)
      .neq("sender_id", user.id)
      .eq("is_read", false);

    setUnreadMessages(count || 0);
  }, [user]);

  const fetchUnreadNotifications = useCallback(async () => {
    if (!user) return;
    const { count } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_read", false);
    setUnreadNotifications(count || 0);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    fetchUnreadMessages();
    fetchUnreadNotifications();

    const msgChannel = supabase
      .channel("unread-msg-badge")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload: any) => {
        fetchUnreadMessages();
        // Show toast for new messages from others
        if (payload.new && payload.new.sender_id !== user.id) {
          toast("💬 새 메시지가 도착했습니다", {
            description: payload.new.content?.slice(0, 50) || "새 메시지",
            duration: 4000,
            action: {
              label: "확인",
              onClick: () => navigate("/messages"),
            },
          });
        }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages" }, () => fetchUnreadMessages())
      .subscribe();

    const notiChannel = supabase
      .channel("unread-noti-badge")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, (payload: any) => {
        fetchUnreadNotifications();
        const n = payload.new;
        if (n) {
          const icon = n.type === "like" ? "❤️" : "💬";
          const action = n.type === "like" ? "좋아요를 눌렀습니다" : "댓글을 달았습니다";
          toast(`${icon} ${n.actor_name || "누군가"}님이 ${action}`, {
            description: n.post_title ? `"${n.post_title}"` : undefined,
            duration: 5000,
          });
        }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, () => fetchUnreadNotifications())
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, () => fetchUnreadNotifications())
      .subscribe();

    return () => {
      supabase.removeChannel(msgChannel);
      supabase.removeChannel(notiChannel);
    };
  }, [user, fetchUnreadMessages, fetchUnreadNotifications]);

  const getBadgeCount = (path: string) => {
    if (path === "/messages") return unreadMessages;
    if (path === "/profile") return unreadNotifications;
    return 0;
  };

  return (
    <nav className="fixed sm:absolute bottom-0 left-0 right-0 z-[2000] bg-card/95 backdrop-blur-lg border-t border-border/50 pb-safe">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
        {navItems.map(({ path, icon: Icon, label }) => {
          const isActive = location.pathname === path;
          const badgeCount = getBadgeCount(path);
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
                {badgeCount > 0 && (
                  <div className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center text-[9px] font-bold">
                    {badgeCount > 99 ? "99+" : badgeCount}
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
