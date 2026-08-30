import { useState, useEffect, useRef, useCallback } from "react";
import { ArrowLeft, Send, Paperclip, X, FileText, Film, Image as ImageIcon, Smile } from "lucide-react";
import { ConversationSkeleton } from "@/components/skeletons/PostSkeleton";
import PageShell from "@/components/PageShell";
import { supabase } from "@/integrations/supabase/client";
import ProfileCard, { ProfileCardData } from "@/components/ProfileCard";
import { useAuth } from "@/contexts/AuthContext";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

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
  file_url?: string | null;
  file_type?: string | null;
  file_name?: string | null;
};

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

const getFileCategory = (mimeType: string): "image" | "video" | "file" => {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  return "file";
};

const EMOJI_CATEGORIES: { label: string; emojis: string[] }[] = [
  { label: "😊 자주 쓰는", emojis: ["😀","😂","🥹","😍","🥰","😎","🤔","😅","😭","🥺","😤","🔥","❤️","👍","👏","🙏","💪","✨","🎵","🎶","🎸","🥁","🎤","🎹","🎺","🎷"] },
  { label: "😀 표정", emojis: ["😃","😄","😁","😆","😊","🙂","😉","😌","😋","😜","🤪","😝","🤑","🤗","🤭","🤫","🤨","😐","😑","😶","😏","😒","🙄","😬","😮‍💨","🤥","😔","😪","🤤","😴","😷","🤒","🤕","🤢","🤮","🥴","😵","🤯","🤠","🥳","🥸","😈","👿","💀","☠️","👻","👽","🤖"] },
  { label: "❤️ 하트", emojis: ["❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔","❤️‍🔥","❤️‍🩹","💕","💞","💓","💗","💖","💘","💝"] },
  { label: "👋 손", emojis: ["👋","🤚","🖐️","✋","🖖","👌","🤌","🤏","✌️","🤞","🤟","🤘","🤙","👈","👉","👆","🖕","👇","☝️","👍","👎","✊","👊","🤛","🤜","👐","🙌","🫶","👐","🤝","🙏"] },
  { label: "🎵 음악", emojis: ["🎵","🎶","🎼","🎤","🎧","🎷","🎸","🎹","🎺","🎻","🥁","🪘","🪗","🪕","🎚️","🎛️","🔊","📻","🎙️","🎚️"] },
  { label: "🐱 동물", emojis: ["🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼","🐨","🐯","🦁","🐮","🐷","🐸","🐵","🐔","🐧","🐦","🦅","🦆","🦉","🐴","🦄","🐝","🐛","🦋"] },
  { label: "🍕 음식", emojis: ["🍎","🍐","🍊","🍋","🍌","🍉","🍇","🍓","🫐","🍈","🍒","🍑","🥭","🍍","🥥","🥝","🍅","🥑","🍕","🍔","🍟","🌭","🍿","🧂","🥚","🍳","🧇","🥞","🍰","🎂","🍩","🍪","🍫","🍬","🍭","☕","🍵","🧃","🥤","🍺","🍻","🥂","🍷"] },
];

const EmojiPicker = ({ onSelect }: { onSelect: (emoji: string) => void }) => {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <div className="p-2">
      <div className="flex gap-1 mb-2 overflow-x-auto pb-1 scrollbar-hide">
        {EMOJI_CATEGORIES.map((cat, i) => (
          <button
            key={i}
            onClick={() => setActiveTab(i)}
            className={`px-2 py-1 text-xs rounded-full whitespace-nowrap transition-colors ${
              activeTab === i ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:bg-secondary/80"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-8 gap-1 max-h-40 overflow-y-auto">
        {EMOJI_CATEGORIES[activeTab].emojis.map((emoji, i) => (
          <button
            key={i}
            onClick={() => onSelect(emoji)}
            className="w-9 h-9 flex items-center justify-center text-xl hover:bg-secondary rounded-lg active:scale-90 transition-transform"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
};

const Messages = () => {
  useDocumentTitle("메시지");
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const targetUserId = searchParams.get("to");
  const prefillText = searchParams.get("prefill");
  const targetConvId = searchParams.get("c");
  const handledTargetRef = useRef<string | null>(null);
  const handledConvRef = useRef<string | null>(null);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [chatPartnerProfile, setChatPartnerProfile] = useState<ProfileCardData | null>(null);
  const [chatPartnerStats, setChatPartnerStats] = useState<any>(undefined);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMsg, setNewMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const emojiRef = useRef<HTMLDivElement>(null);

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
      const lastContent = lastMsg?.file_url
        ? lastMsg?.file_type?.startsWith("image/") ? "📷 사진" : lastMsg?.file_type?.startsWith("video/") ? "🎬 영상" : "📎 파일"
        : lastMsg?.content || "";
      return {
        id: c.id,
        otherUserId: otherId,
        otherUserName: profile?.display_name || "사용자",
        otherUserAvatar: profile?.avatar_url || null,
        lastMessage: lastContent,
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
    if (targetUserId === user.id) {
      toast.error("자기 자신에게는 메시지를 보낼 수 없습니다");
      setSearchParams({}, { replace: true });
      return;
    }
    if (handledTargetRef.current === targetUserId) return;
    handledTargetRef.current = targetUserId;

    const openOrCreate = async () => {
      const existingConv = conversations.find((c) => c.otherUserId === targetUserId);
      if (existingConv) {
        setSelectedConv(existingConv);
        if (prefillText) setNewMsg(prefillText);
        setSearchParams({}, { replace: true });
        return;
      }

      const sorted = [user.id, targetUserId].sort();
      const { data, error } = await supabase
        .from("conversations")
        .insert({ user1_id: sorted[0], user2_id: sorted[1] } as any)
        .select()
        .single();

      let convRow = data;
      if (!error) {
        const { track } = await import("@/lib/analytics");
        track("dm_start");
      }
      if (error && error.code === "23505") {
        const { data: existing } = await supabase
          .from("conversations")
          .select("*")
          .or(
            `and(user1_id.eq.${sorted[0]},user2_id.eq.${sorted[1]}),and(user1_id.eq.${sorted[1]},user2_id.eq.${sorted[0]})`
          )
          .maybeSingle();
        convRow = existing;
      } else if (error) {
        toast.error("대화를 시작할 수 없습니다");
        handledTargetRef.current = null;
        return;
      }

      if (!convRow) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name, avatar_url")
        .eq("user_id", targetUserId)
        .maybeSingle();

      setSelectedConv({
        id: convRow.id,
        otherUserId: targetUserId,
        otherUserName: profile?.display_name || "사용자",
        otherUserAvatar: profile?.avatar_url || null,
        lastMessage: "",
        lastMessageAt: convRow.created_at,
        unreadCount: 0,
      });
      if (prefillText) setNewMsg(prefillText);
      setSearchParams({}, { replace: true });
      fetchConversations();
    };

    openOrCreate();
  }, [targetUserId, user, loading, conversations, setSearchParams, fetchConversations]);

  // 새 메시지 토스트 딥링크: ?c=<conversation_id> 로 해당 대화를 바로 연다
  useEffect(() => {
    if (!targetConvId || !user || loading) return;
    if (handledConvRef.current === targetConvId) return;
    const conv = conversations.find((c) => c.id === targetConvId);
    if (!conv) return;
    handledConvRef.current = targetConvId;
    setSelectedConv(conv);
    setSearchParams({}, { replace: true });
  }, [targetConvId, user, loading, conversations, setSearchParams]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const fetchMessages = useCallback(async () => {
    if (!selectedConv) return;
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", selectedConv.id)
      .order("created_at", { ascending: true });
    setMessages((data as Message[]) || []);

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

  // 채팅 상단 프로필 카드(D1) 데이터 로드
  useEffect(() => {
    setChatPartnerProfile(null);
    if (!selectedConv?.otherUserId) return;
    supabase
      .from("profiles")
      .select("*")
      .eq("user_id", selectedConv.otherUserId)
      .single()
      .then(({ data }) => { if (data) setChatPartnerProfile(data as ProfileCardData); });
    supabase
      .from("user_stats" as any)
      .select("*")
      .eq("user_id", selectedConv.otherUserId)
      .maybeSingle()
      .then(({ data }) => setChatPartnerStats(data ?? null));
  }, [selectedConv?.otherUserId]);

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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      toast.error("파일 크기는 20MB 이하만 가능합니다");
      return;
    }

    setSelectedFile(file);

    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (ev) => setFilePreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    } else if (file.type.startsWith("video/")) {
      setFilePreview("video");
    } else {
      setFilePreview("file");
    }

    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const clearFile = () => {
    setSelectedFile(null);
    setFilePreview(null);
  };

  const uploadFile = async (file: File): Promise<{ url: string; type: string; name: string } | null> => {
    if (!user) return null;
    const ext = file.name.split(".").pop() || "bin";
    const path = `${user.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

    const { error } = await supabase.storage
      .from("message-files")
      .upload(path, file, { contentType: file.type });

    if (error) {
      toast.error("파일 업로드 실패");
      console.error(error);
      return null;
    }

    const { data: urlData } = supabase.storage
      .from("message-files")
      .getPublicUrl(path);

    return {
      url: urlData.publicUrl,
      type: file.type,
      name: file.name,
    };
  };

  const handleSend = async () => {
    if (!user || !selectedConv || sending) return;
    if (!newMsg.trim() && !selectedFile) return;

    setSending(true);
    setUploading(!!selectedFile);

    let fileData: { url: string; type: string; name: string } | null = null;
    if (selectedFile) {
      fileData = await uploadFile(selectedFile);
      if (!fileData) {
        setSending(false);
        setUploading(false);
        return;
      }
    }

    await supabase.from("messages").insert({
      conversation_id: selectedConv.id,
      sender_id: user.id,
      content: newMsg.trim() || (fileData ? fileData.name : ""),
      file_url: fileData?.url || null,
      file_type: fileData?.type || null,
      file_name: fileData?.name || null,
    } as any);

    await supabase
      .from("conversations")
      .update({ updated_at: new Date().toISOString() } as any)
      .eq("id", selectedConv.id);

    // 잠금화면 푸시 알림 (수신자에게)
    const otherId = selectedConv.otherUserId;
    if (otherId) {
      const { sendPushTo } = await import("@/lib/push");
      sendPushTo({ type: "message", userId: otherId });
    }

    setNewMsg("");
    clearFile();
    setSending(false);
    setUploading(false);
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

  const renderMessageContent = (msg: Message, isMine: boolean) => {
    const category = msg.file_type ? getFileCategory(msg.file_type) : null;

    return (
      <>
        {msg.file_url && category === "image" && (
          <a href={msg.file_url} target="_blank" rel="noopener noreferrer" className="block mb-1.5">
            <img
              src={msg.file_url}
              alt={msg.file_name || "이미지"}
              className="max-w-full rounded-lg max-h-60 object-cover"
              loading="lazy"
            />
          </a>
        )}
        {msg.file_url && category === "video" && (
          <video
            src={msg.file_url}
            controls
            className="max-w-full rounded-lg max-h-60 mb-1.5"
            preload="metadata"
          />
        )}
        {msg.file_url && category === "file" && (
          <a
            href={msg.file_url}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex items-center gap-2 mb-1.5 px-3 py-2 rounded-lg text-xs ${
              isMine ? "bg-primary-foreground/10" : "bg-background/50"
            }`}
          >
            <FileText className="w-4 h-4 shrink-0" />
            <span className="truncate">{msg.file_name || "파일"}</span>
          </a>
        )}
        {msg.content && !(msg.file_url && msg.content === msg.file_name) && (
          <span>{msg.content}</span>
        )}
      </>
    );
  };

  // 대화 목록 (모바일: 전체 폭 / 데스크톱: 좌측 340px 페인)
  const listPane = (
    loading ? (
      <div className="space-y-1">
        {[...Array(5)].map((_, i) => <ConversationSkeleton key={i} />)}
      </div>
    ) : conversations.length === 0 ? (
      <div className="text-center py-20 text-muted-foreground text-sm">
        <p className="mb-1">아직 대화가 없습니다</p>
        <p className="text-xs">커뮤니티 게시물에서 작성자에게 메시지를 보내보세요!</p>
      </div>
    ) : (
      <div>
        {conversations.map((conv) => {
          const active = selectedConv?.id === conv.id;
          return (
            <div
              key={conv.id}
              onClick={() => setSelectedConv(conv)}
              className={`flex items-center gap-3 py-3.5 px-2 -mx-2 rounded border-b border-border last:border-b-0 cursor-pointer transition-colors ${
                active ? "bg-surface-hover" : "hover:bg-surface-hover"
              }`}
            >
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center text-sm font-bold shrink-0 overflow-hidden">
                {conv.otherUserAvatar ? (
                  <img src={conv.otherUserAvatar} className="w-full h-full object-cover" />
                ) : (
                  conv.otherUserName[0]
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[15px] font-semibold tracking-tight truncate">{conv.otherUserName}</span>
                  <span className="font-mono text-[11px] text-muted-foreground shrink-0 tabular-nums">
                    {formatTime(conv.lastMessageAt)}
                  </span>
                </div>
                <p className="text-[12.5px] text-muted-foreground truncate mt-0.5">
                  {conv.lastMessage || "대화를 시작해보세요"}
                </p>
              </div>
              {conv.unreadCount > 0 && (
                <div className="min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-bold font-mono shrink-0">
                  {conv.unreadCount}
                </div>
              )}
            </div>
          );
        })}
      </div>
    )
  );

  // 대화 스레드 (모바일: 전체화면 오버레이 / 데스크톱: 우측 페인)
  const threadPane = selectedConv && (
    <div className="absolute inset-0 z-[2500] lg:static lg:inset-auto lg:z-auto flex flex-col bg-background lg:flex-1 lg:min-w-0 lg:h-full">
      {/* Header */}
      <div
        className="flex items-center gap-3 p-4 border-b border-border bg-card/80 backdrop-blur-lg shrink-0"
        style={{ paddingTop: "calc(1rem + var(--safe-top, 0px))" }}
      >
        <button
          onClick={() => {
            setSelectedConv(null);
            fetchConversations();
          }}
          className="p-1 rounded-lg hover:bg-secondary lg:hidden"
          aria-label="뒤로"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        {chatPartnerProfile ? (
          <ProfileCard profile={chatPartnerProfile} stats={chatPartnerStats} variant="compact" className="flex-1" />
        ) : (
          <>
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center text-xs font-bold overflow-hidden shrink-0">
              {selectedConv.otherUserAvatar ? (
                <img src={selectedConv.otherUserAvatar} className="w-full h-full object-cover" />
              ) : (
                selectedConv.otherUserName[0]
              )}
            </div>
            <span className="text-[15px] font-extrabold tracking-tight truncate">{selectedConv.otherUserName}</span>
          </>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
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
                className={`max-w-[75%] lg:max-w-[70%] px-3.5 py-2.5 rounded-lg text-sm leading-relaxed break-words ${
                  isMine
                    ? "bg-primary text-primary-foreground rounded-br-sm"
                    : "bg-secondary text-secondary-foreground rounded-bl-sm"
                }`}
              >
                {renderMessageContent(msg, isMine)}
                <div
                  className={`font-mono text-[10px] tabular-nums mt-1 ${
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

      {/* File Preview */}
      {selectedFile && (
        <div className="px-3 pt-2 border-t border-border bg-card/60 shrink-0">
          <div className="flex items-center gap-2 bg-secondary rounded-lg px-3 py-2">
            {filePreview && filePreview !== "video" && filePreview !== "file" ? (
              <img src={filePreview} alt="미리보기" className="w-12 h-12 rounded object-cover" />
            ) : filePreview === "video" ? (
              <div className="w-12 h-12 rounded bg-muted flex items-center justify-center">
                <Film className="w-5 h-5 text-muted-foreground" />
              </div>
            ) : (
              <div className="w-12 h-12 rounded bg-muted flex items-center justify-center">
                <FileText className="w-5 h-5 text-muted-foreground" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{selectedFile.name}</p>
              <p className="font-mono text-[10px] text-muted-foreground tabular-nums">
                {(selectedFile.size / 1024 / 1024).toFixed(1)} MB
              </p>
            </div>
            <button onClick={clearFile} className="p-1 rounded-lg hover:bg-background/50">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Emoji Picker */}
      {showEmoji && (
        <div ref={emojiRef} className="border-t border-border bg-card/95 backdrop-blur-lg shrink-0">
          <EmojiPicker onSelect={(emoji) => { setNewMsg((prev) => prev + emoji); }} />
        </div>
      )}

      {/* Input */}
      <div className="p-3 border-t border-border bg-card/80 backdrop-blur-lg pb-safe shrink-0">
        <div className="flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-10 h-10 rounded-lg flex items-center justify-center hover:bg-secondary transition-colors shrink-0"
          >
            <Paperclip className="w-5 h-5 text-muted-foreground" />
          </button>
          <button
            onClick={() => setShowEmoji((v) => !v)}
            className={`w-10 h-10 rounded-lg flex items-center justify-center hover:bg-secondary transition-colors shrink-0 ${showEmoji ? "bg-secondary" : ""}`}
          >
            <Smile className="w-5 h-5 text-muted-foreground" />
          </button>
          <input
            value={newMsg}
            onChange={(e) => setNewMsg(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            onFocus={() => setShowEmoji(false)}
            placeholder="메시지를 입력하세요..."
            className="flex-1 min-w-0 bg-secondary rounded-lg px-4 py-2.5 text-sm outline-none placeholder:text-muted-foreground"
          />
          <button
            onClick={handleSend}
            disabled={(!newMsg.trim() && !selectedFile) || sending}
            className="w-10 h-10 rounded-lg bg-action text-action-foreground flex items-center justify-center disabled:opacity-50 active:scale-95 transition-transform shrink-0"
          >
            {uploading ? (
              <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <PageShell title="메시지">
      <div className="lg:flex lg:h-[calc(100dvh-11rem)] lg:border lg:border-border lg:rounded-lg lg:overflow-hidden">
        {/* 좌측: 대화 목록 */}
        <aside className="lg:w-[340px] lg:shrink-0 lg:border-r lg:border-border lg:overflow-y-auto lg:p-3">
          {listPane}
        </aside>
        {/* 우측: 스레드 (모바일은 오버레이) / 미선택 시 데스크톱 빈 상태 */}
        {selectedConv ? threadPane : (
          <div className="hidden lg:flex flex-1 items-center justify-center text-muted-foreground text-sm">
            왼쪽에서 대화를 선택하세요
          </div>
        )}
      </div>
    </PageShell>
  );
};

export default Messages;
