import { Home, Briefcase, Music2, MessageCircle, Mail, User, Store } from "lucide-react";
import { toast } from "sonner";
import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const HOLD_MS = 300;

const holdMenuItems = [
  { path: "/jobs", icon: Briefcase, label: "구인", lift: 10 },
  { path: "/rooms", icon: Music2, label: "연습실", lift: 0 },
  { path: "/shops", icon: Store, label: "악기사", lift: 0 },
  { path: "/community", icon: MessageCircle, label: "커뮤", lift: 10 },
];

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuClosing, setMenuClosing] = useState(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openedByHold = useRef(false);

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
          let title: string;
          if (n.type === "apply_accepted") title = "🎉 지원에 합격했습니다!";
          else if (n.type === "apply_rejected") title = "📋 지원 결과가 도착했습니다";
          else if (n.type === "like" || n.type === "comment") {
            const icon = n.type === "like" ? "❤️" : "💬";
            const action = n.type === "like" ? "좋아요를 눌렀습니다" : "댓글을 달았습니다";
            title = `${icon} ${n.actor_name || "누군가"}님이 ${action}`;
          } else title = "🔔 새 알림이 도착했습니다";
          toast(title, {
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

  const closeMenu = useCallback(() => {
    if (!menuOpen) return;
    setMenuClosing(true);
    setTimeout(() => { setMenuOpen(false); setMenuClosing(false); }, 130);
  }, [menuOpen]);

  // 페이지 이동 시 메뉴 정리
  useEffect(() => { setMenuOpen(false); setMenuClosing(false); }, [location.pathname]);

  const startHold = () => {
    openedByHold.current = false;
    holdTimer.current = setTimeout(() => {
      openedByHold.current = true;
      setMenuOpen(true);
      try { navigator.vibrate?.(10); } catch { /* 미지원 무시 */ }
    }, HOLD_MS);
  };

  const endHold = () => {
    if (holdTimer.current) { clearTimeout(holdTimer.current); holdTimer.current = null; }
    if (!openedByHold.current) {
      if (menuOpen) { closeMenu(); return; }
      navigate("/");
    }
  };

  const cancelHold = () => {
    if (holdTimer.current) { clearTimeout(holdTimer.current); holdTimer.current = null; }
  };

  const sideBtnCls = (active: boolean) =>
    `relative flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-colors duration-150 active:scale-95 ${
      active ? "text-primary" : "text-muted-foreground hover:text-foreground"
    }`;

  const Badge = ({ count }: { count: number }) =>
    count > 0 ? (
      <div className="absolute -top-1 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center text-[9px] font-bold">
        {count > 99 ? "99+" : count}
      </div>
    ) : null;

  return (
    <>
      {/* 홀드 메뉴 오버레이 */}
      {menuOpen && (
        <div className="lg:hidden fixed inset-0 z-[1999]" onClick={closeMenu} onPointerUp={closeMenu}>
          <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px]" style={{ animation: menuClosing ? "fade-out 0.12s ease-out both" : "fade-in 0.15s ease both" }} />
          <div
            className="absolute left-1/2 -translate-x-1/2 flex items-end gap-3.5"
            style={{ bottom: "calc(100px + var(--safe-bottom, 0px))" }}
          >
            {holdMenuItems.map(({ path, icon: Icon, label, lift }, i) => (
              <button
                key={path}
                onClick={(e) => { e.stopPropagation(); navigate(path); }}
                onPointerUp={(e) => e.stopPropagation()}
                className={`hold-menu-item ${menuClosing ? "closing" : ""} flex flex-col items-center gap-1.5`}
                style={{ animationDelay: menuClosing ? `${i * 20}ms` : `${i * 40}ms`, transform: `translateY(${lift}px)` }}
              >
                <span className="p-3.5 rounded-2xl bg-card border border-border/60 shadow-lg flex items-center justify-center text-primary">
                  <Icon className="w-6 h-6" />
                </span>
                <span className="text-[11px] font-semibold text-white drop-shadow">{label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-[2000] bg-card/95 backdrop-blur-lg border-t border-border/50 pb-safe">
        <div className="relative flex items-center justify-center gap-44 h-16 max-w-lg mx-auto">
          {/* 메시지 */}
          <button onClick={() => navigate("/messages")} className={sideBtnCls(location.pathname === "/messages")}>
            <div className="relative">
              <Mail className="w-[26px] h-[26px]" strokeWidth={location.pathname === "/messages" ? 2.4 : 2} />
              <Badge count={unreadMessages} />
            </div>
            <span className="text-[11px] font-medium leading-none">메시지</span>
          </button>

          {/* 홈 (중앙, 탭=홈 / 홀드=바로가기 메뉴) */}
          <button
            onPointerDown={startHold}
            onPointerUp={endHold}
            onPointerLeave={cancelHold}
            onPointerCancel={cancelHold}
            onContextMenu={(e) => e.preventDefault()}
            className={`absolute left-1/2 -translate-x-1/2 -top-5 w-16 h-16 rounded-full flex items-center justify-center shadow-lg transition-transform duration-150 active:scale-95 select-none ${
              location.pathname === "/" ? "bg-primary text-primary-foreground" : "bg-primary text-primary-foreground"
            } ${menuOpen ? "scale-95" : ""}`}
            style={{ touchAction: "manipulation", WebkitUserSelect: "none", WebkitTouchCallout: "none" } as React.CSSProperties}
            aria-label="홈 (길게 누르면 바로가기 메뉴)"
          >
            <Home className="w-8 h-8" strokeWidth={2.2} />
          </button>

          {/* 프로필 */}
          <button onClick={() => navigate("/profile")} className={sideBtnCls(location.pathname === "/profile")}>
            <div className="relative">
              <User className="w-[26px] h-[26px]" strokeWidth={location.pathname === "/profile" ? 2.4 : 2} />
            </div>
            <span className="text-[11px] font-medium leading-none">프로필</span>
          </button>
        </div>
      </nav>
    </>
  );
};

export default BottomNav;
