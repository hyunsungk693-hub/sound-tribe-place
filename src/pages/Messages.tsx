import { useState, useEffect, useRef, useCallback } from "react";
import { ArrowLeft, Send } from "lucide-react";
import PageShell from "@/components/PageShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSearchParams } from "react-router-dom";

type Conversation = {
  id: string;
  otherUserId: string;
  otherUserName: string;
  otherUserAvatar: string | null;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
};

type Message = {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  is_read: boolean;
};

const Messages = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const targetUserId = searchParams.get("to");

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMsg, setNewMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchConversations = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const { data: convs } = await supabase
      .from("conversations")
      .select("*")
      .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
      .order("updated_at", { ascending: false });

    if (!convs || convs.length === 0) {
      setConversations([]);
      setLoading(false);
      return;
    }

    const otherIds = convs.map((c: any) =>
      c.user1_id === user.id ? c.user2_id : c.user1_id
    );

    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, display_name, avatar_url")
      .in("user_id", otherIds);

    const profileMap: Record<string, any> = {};
    (profiles || []).forEach((p: any) => {
      profileMap[p.user_id] = p;
    });

    // Fetch last messages
    const convIds = convs.map((c: any) => c.id);
    const { data: allMsgs } = await supabase
      .from("messages")
      .select("*")
      .in("conversation_id", convIds)
      .order("created_at", { ascending: false });

    const lastMsgMap: Record<string, any> = {};
    const unreadMap: Record<string, number> = {};
    (allMsgs || []).forEach((m: any) => {
      if (!lastMsgMap[m.conversation_id]) {
        lastMsgMap[m.conversation_id] = m;
      }
      if (!m.is_read && m.sender_id !== user.id) {
        unreadMap[m.conversation_id] = (unreadMap[m.conversation_id] || 0) + 1;
      }
    });

    const mapped: Conversation[] = convs.map((c: any) => {
      const otherId = c.user1_id === user.id ? c.user2_id : c.user1_id;
      const profile = profileMap[otherId];
      const lastMsg = lastMsgMap[c.id];
      return {
        id: c.id,
        otherUserId: otherId,
        otherUserName: profile?.display_name || "사용자",
        otherUserAvatar: profile?.avatar_url || null,
        lastMessage: lastMsg?.content || "",
        lastMessageAt: lastMsg?.created_at || c.created_at,
        unreadCount: unreadMap[c.id] || 0,
      };
    });

    setConversations(mapped);
    setLoading(false);
  }, [user]);

  // Auto-open conversation if ?to= param exists
  useEffect(() => {
    if (!targetUserId || !user || loading) return;

    const existingConv = conversations.find(
      (c) => c.otherUserId === targetUserId
    );
    if (existingConv) {
      setSelectedConv(existingConv);
    } else {
      // Create new conversation
      const createConv = async () => {
        const sorted = [user.id, targetUserId].sort();
        const { data, error } = await supabase
          .from("conversations")
          .insert({ user1_id: sorted[0], user2_id: sorted[1] } as any)
          .select()
          .single();

        if (error && error.code === "23505") {
          // Already exists, fetch it
          const { data: existing } = await supabase
            .from("conversations")
            .select("*")
            .or(
              `and(user1_id.eq.${sorted[0]},user2_id.eq.${sorted[1]}),and(user1_id.eq.${sorted[1]},user2_id.eq.${sorted[0]})`
            )
            .single();
          if (existing) {
            const { data: profile } = await supabase
              .from("profiles")
              .select("display_name, avatar_url")
              .eq("user_id", targetUserId)
              .single();
            setSelectedConv({
              id: existing.id,
              otherUserId: targetUserId,
              otherUserName: profile?.display_name || "사용자",
              otherUserAvatar: profile?.avatar_url || null,
              lastMessage: "",
              lastMessageAt: existing.created_at,
              unreadCount: 0,
            });
          }
        } else if (data) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("display_name, avatar_url")
            .eq("user_id", targetUserId)
            .single();
          setSelectedConv({
            id: data.id,
            otherUserId: targetUserId,
            otherUserName: profile?.display_name || "사용자",
            otherUserAvatar: profile?.avatar_url || null,
            lastMessage: "",
            lastMessageAt: data.created_at,
            unreadCount: 0,
          });
        }
      };
      createConv();
    }
  }, [targetUserId, user, loading, conversations]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Fetch messages for selected conversation
  const fetchMessages = useCallback(async () => {
    if (!selectedConv) return;
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", selectedConv.id)
      .order("created_at", { ascending: true });
    setMessages((data as Message[]) || []);

    // Mark as read
    if (user) {
      await supabase
        .from("messages")
        .update({ is_read: true } as any)
        .eq("conversation_id", selectedConv.id)
        .neq("sender_id", user.id)
        .eq("is_read", false);
    }
  }, [selectedConv, user]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Realtime subscription
  useEffect(() => {
    if (!selectedConv) return;
    const channel = supabase
      .channel(`messages-${selectedConv.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${selectedConv.id}`,
        },
        (payload) => {
          const newMessage = payload.new as Message;
          setMessages((prev) => [...prev, newMessage]);
          // Mark as read if from other user
          if (user && newMessage.sender_id !== user.id) {
            supabase
              .from("messages")
              .update({ is_read: true } as any)
              .eq("id", newMessage.id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedConv, user]);

  // Auto scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!user || !selectedConv || !newMsg.trim() || sending) return;
    setSending(true);

    await supabase.from("messages").insert({
      conversation_id: selectedConv.id,
      sender_id: user.id,
      content: newMsg.trim(),
    } as any);

    // Update conversation timestamp
    await supabase
      .from("conversations")
      .update({ updated_at: new Date().toISOString() } as any)
      .eq("id", selectedConv.id);

    setNewMsg("");
    setSending(false);
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60000) return "방금";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}분 전`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}시간 전`;
    return d.toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
  };

  // Chat view
  if (selectedConv) {
    return (
      <div className="flex flex-col h-[100dvh] bg-background">
        {/* Header */}
        <div className="flex items-center gap-3 p-4 border-b border-border/50 bg-card/80 backdrop-blur-lg">
          <button
            onClick={() => {
              setSelectedConv(null);
              fetchConversations();
            }}
            className="p-1 rounded-full hover:bg-secondary"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center text-xs font-bold overflow-hidden">
            {selectedConv.otherUserAvatar ? (
              <img src={selectedConv.otherUserAvatar} className="w-full h-full object-cover" />
            ) : (
              selectedConv.otherUserName[0]
            )}
          </div>
          <span className="text-sm font-semibold">{selectedConv.otherUserName}</span>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 && (
            <div className="text-center text-muted-foreground text-xs py-10">
              대화를 시작해보세요 👋
            </div>
          )}
          {messages.map((msg) => {
            const isMine = msg.sender_id === user?.id;
            return (
              <div
                key={msg.id}
                className={`flex ${isMine ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[75%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                    isMine
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : "bg-secondary text-secondary-foreground rounded-bl-md"
                  }`}
                >
                  {msg.content}
                  <div
                    className={`text-[10px] mt-1 ${
                      isMine ? "text-primary-foreground/60" : "text-muted-foreground"
                    }`}
                  >
                    {formatTime(msg.created_at)}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="p-3 border-t border-border/50 bg-card/80 backdrop-blur-lg pb-safe">
          <div className="flex items-center gap-2">
            <input
              value={newMsg}
              onChange={(e) => setNewMsg(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
              placeholder="메시지를 입력하세요..."
              className="flex-1 bg-secondary rounded-full px-4 py-2.5 text-sm outline-none placeholder:text-muted-foreground"
            />
            <button
              onClick={handleSend}
              disabled={!newMsg.trim() || sending}
              className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-50 active:scale-95 transition-transform"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Conversation list
  return (
    <PageShell title="메시지">
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : conversations.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground text-sm">
          <p className="mb-1">아직 대화가 없습니다</p>
          <p className="text-xs">커뮤니티 게시물에서 작성자에게 메시지를 보내보세요!</p>
        </div>
      ) : (
        <div className="space-y-1">
          {conversations.map((conv) => (
            <div
              key={conv.id}
              onClick={() => setSelectedConv(conv)}
              className="flex items-center gap-3 p-3.5 rounded-xl hover:bg-surface-hover cursor-pointer active:scale-[0.98] transition-all"
            >
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center text-sm font-bold shrink-0 overflow-hidden">
                {conv.otherUserAvatar ? (
                  <img src={conv.otherUserAvatar} className="w-full h-full object-cover" />
                ) : (
                  conv.otherUserName[0]
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">{conv.otherUserName}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {formatTime(conv.lastMessageAt)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {conv.lastMessage || "대화를 시작해보세요"}
                </p>
              </div>
              {conv.unreadCount > 0 && (
                <div className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-bold shrink-0">
                  {conv.unreadCount}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </PageShell>
  );
};

export default Messages;
