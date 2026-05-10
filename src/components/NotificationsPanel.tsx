import { useState, useEffect, useCallback } from "react";
import { Bell, Heart, MessageSquare, BellOff, BellRing } from "lucide-react";
import { toast } from "sonner";
import { enablePushNotifications, disablePushNotifications, isPushSupported, getPushPermission } from "@/lib/push";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface Notification {
  id: string;
  actor_name: string;
  type: string;
  post_title: string | null;
  is_read: boolean;
  created_at: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

const NotificationsPanel = ({ open, onClose }: Props) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    setNotifications((data || []) as Notification[]);
  }, [user]);

  useEffect(() => {
    if (open) fetchNotifications();
  }, [open, fetchNotifications]);

  // Realtime subscription
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("my-notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => fetchNotifications()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, fetchNotifications]);

  const markAllRead = async () => {
    if (!user) return;
    await supabase
      .from("notifications")
      .update({ is_read: true } as any)
      .eq("user_id", user.id)
      .eq("is_read", false);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const clearAll = async () => {
    if (!user) return;
    await supabase.from("notifications").delete().eq("user_id", user.id);
    setNotifications([]);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/40 flex items-end justify-center" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-background rounded-t-2xl max-h-[75vh] flex flex-col animate-in slide-in-from-bottom duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 pb-3 border-b border-border/30">
          <h3 className="text-base font-bold flex items-center gap-2">
            <Bell className="w-4 h-4" /> 알림
          </h3>
          <div className="flex items-center gap-2">
            <button onClick={markAllRead} className="text-[11px] text-primary font-medium px-2 py-1 rounded-lg hover:bg-primary/10 transition-colors">
              모두 읽음
            </button>
            <button onClick={clearAll} className="text-[11px] text-muted-foreground font-medium px-2 py-1 rounded-lg hover:bg-destructive/10 hover:text-destructive transition-colors">
              전체 삭제
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {notifications.length > 0 ? (
            notifications.map((n) => (
              <div
                key={n.id}
                className={`flex items-start gap-3 p-3 rounded-xl transition-colors ${
                  n.is_read ? "opacity-60" : "bg-primary/5"
                }`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                  n.type === "like" ? "bg-red-100 text-red-500" : "bg-blue-100 text-blue-500"
                }`}>
                  {n.type === "like" ? <Heart className="w-3.5 h-3.5" /> : <MessageSquare className="w-3.5 h-3.5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs leading-relaxed">
                    <span className="font-semibold">{n.actor_name}</span>
                    {n.type === "like" ? "님이 좋아요를 눌렀습니다" : "님이 댓글을 달았습니다"}
                  </p>
                  {n.post_title && (
                    <p className="text-[11px] text-muted-foreground truncate mt-0.5">{n.post_title}</p>
                  )}
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {new Date(n.created_at).toLocaleDateString("ko-KR")} {new Date(n.created_at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                {!n.is_read && <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />}
              </div>
            ))
          ) : (
            <p className="text-xs text-muted-foreground text-center py-10">알림이 없습니다</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default NotificationsPanel;

// Hook to get unread count
export const useUnreadCount = () => {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  const fetchCount = useCallback(async () => {
    if (!user) return;
    const { count: c } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_read", false);
    setCount(c || 0);
  }, [user]);

  useEffect(() => { fetchCount(); }, [fetchCount]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("unread-count")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => fetchCount()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, fetchCount]);

  return { count, refresh: fetchCount };
};
