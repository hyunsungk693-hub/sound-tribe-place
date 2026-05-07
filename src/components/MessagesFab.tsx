import { Mail } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const MessagesFab = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [unread, setUnread] = useState(0);

  const fetchUnread = useCallback(async () => {
    if (!user) return;
    const { data: convs } = await supabase
      .from("conversations")
      .select("id")
      .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`);
    if (!convs || convs.length === 0) { setUnread(0); return; }
    const convIds = convs.map((c: any) => c.id);
    const { count } = await supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .in("conversation_id", convIds)
      .neq("sender_id", user.id)
      .eq("is_read", false);
    setUnread(count || 0);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    fetchUnread();
    const ch = supabase
      .channel("fab-msg-badge")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => fetchUnread())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages" }, () => fetchUnread())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, fetchUnread]);

  if (!user) return null;
  const hideOn = ["/messages", "/map", "/profile"];
  if (hideOn.some((p) => location.pathname === p || location.pathname.startsWith(p + "/"))) return null;

  return (
    <button
      onClick={() => navigate("/messages")}
      aria-label="메시지"
      className="absolute top-3 right-3 z-[2100] w-9 h-9 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center active:scale-95 transition-transform"
    >
      <Mail className="w-4 h-4" />
      {unread > 0 && (
        <div className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center text-[9px] font-bold border-2 border-background">
          {unread > 99 ? "99+" : unread}
        </div>
      )}
    </button>
  );
};

export default MessagesFab;
