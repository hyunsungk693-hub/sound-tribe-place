import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { Bell, Heart, MessageSquare, BellOff, BellRing, BadgeCheck, XCircle } from "lucide-react";
import { toast } from "sonner";
import { enablePushNotifications, disablePushNotifications, isPushSupported, getPushPermission } from "@/lib/push";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface Notification {
  id: string;
  actor_name: string;
  type: string;
  post_id: string | null;
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
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // 알림 클릭: 읽음 처리 후 해당 게시물로 이동
  const openNotification = async (n: Notification) => {
    if (!n.is_read) {
      supabase.from("notifications").update({ is_read: true } as any).eq("id", n.id).then(() => {});
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
    }
    if (n.post_id) {
      onClose();
      navigate(`/post/${n.post_id}`);
    }
  };

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

  // 푸시 구독 상태
  const [pushPerm, setPushPerm] = useState<NotificationPermission>("default");
  const [subscribed, setSubscribed] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);

  useEffect(() => {
    if (!open || !isPushSupported()) return;
    setPushPerm(getPushPermission());
    navigator.serviceWorker.ready.then(async (reg) => {
      const s = await reg.pushManager.getSubscription();
      setSubscribed(!!s);
    });
  }, [open]);

  const togglePush = async () => {
    if (!user || pushBusy) return;
    setPushBusy(true);
    if (subscribed) {
      await disablePushNotifications();
      setSubscribed(false);
      toast.success("잠금화면 알림을 껐습니다");
    } else {
      const r = await enablePushNotifications(user.id);
      if (r.ok) {
        setSubscribed(true);
        setPushPerm("granted");
        toast.success("잠금화면 알림이 켜졌습니다");
      } else {
        toast.error(r.reason || "알림을 켜지 못했습니다");
      }
    }
    setPushBusy(false);
  };

  if (!open) return null;

  // TopNav 등 backdrop-filter가 걸린 조상 안에서 렌더되면 position:fixed의
  // 컨테이닝 블록이 그 조상 박스(높이 64px)가 되어 패널이 잘린다.
  // 어디서 호출되든 안전하도록 오버레이를 body로 포털한다.
  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-black/40 flex items-end lg:items-center justify-center lg:p-8" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-background rounded-t-2xl lg:rounded-2xl flex flex-col animate-in slide-in-from-bottom lg:zoom-in-95 lg:slide-in-from-bottom-0 duration-300 max-h-sheet lg:max-h-[calc(100dvh-8rem)] lg:shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 pb-3 border-b border-border/30 shrink-0">
          <h3 className="text-base font-bold flex items-center gap-2">
            <Bell className="w-4 h-4" /> 알림
          </h3>
          <div className="flex items-center gap-2">
            {isPushSupported() && (
              <button
                onClick={togglePush}
                disabled={pushBusy || pushPerm === "denied"}
                className={`text-[11px] font-medium px-2 py-1 rounded-lg transition-colors flex items-center gap-1 ${
                  subscribed ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"
                } ${pushPerm === "denied" ? "opacity-50 cursor-not-allowed" : ""}`}
                title={pushPerm === "denied" ? "브라우저 설정에서 알림 권한을 허용하세요" : ""}
              >
                {subscribed ? <BellRing className="w-3 h-3" /> : <BellOff className="w-3 h-3" />}
                {pushPerm === "denied" ? "권한 차단됨" : subscribed ? "잠금화면 ON" : "잠금화면 알림"}
              </button>
            )}
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
                onClick={() => openNotification(n)}
                className={`flex items-start gap-3 p-3 rounded-xl transition-colors active:scale-[0.98] ${
                  n.is_read ? "opacity-60" : "bg-primary/5"
                } ${n.post_id ? "cursor-pointer hover:bg-surface-hover" : ""}`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                  n.type === "like" ? "bg-red-100 text-red-500"
                    : n.type === "apply_accepted" ? "bg-green-100 text-green-600"
                    : n.type === "apply_rejected" ? "bg-gray-200 text-gray-500"
                    : "bg-blue-100 text-blue-500"
                }`}>
                  {n.type === "like" ? <Heart className="w-3.5 h-3.5" />
                    : n.type === "apply_accepted" ? <BadgeCheck className="w-3.5 h-3.5" />
                    : n.type === "apply_rejected" ? <XCircle className="w-3.5 h-3.5" />
                    : <MessageSquare className="w-3.5 h-3.5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs leading-relaxed">
                    {n.type === "apply_accepted" ? (
                      <>축하합니다! 지원에 <span className="font-semibold text-green-600">합격</span>했습니다 🎉</>
                    ) : n.type === "apply_rejected" ? (
                      <>아쉽지만 이번 지원은 <span className="font-semibold">불합격</span>했습니다</>
                    ) : n.type === "like" || n.type === "comment" ? (
                      <>
                        <span className="font-semibold">{n.actor_name}</span>
                        {n.type === "like" ? "님이 좋아요를 눌렀습니다" : "님이 댓글을 달았습니다"}
                      </>
                    ) : (
                      <>새 알림이 도착했습니다</>
                    )}
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
    </div>,
    document.body,
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
