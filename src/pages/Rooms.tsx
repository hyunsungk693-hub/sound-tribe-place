import { Search, MapPin, Clock, Star, Music, ArrowLeft, Pencil, Trash2, MessageCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import PageShell from "@/components/PageShell";
import CreatePostDialog from "@/components/CreatePostDialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { RoomCardSkeleton } from "@/components/skeletons/PostSkeleton";

const SAMPLE_AUTHORS = [
  "4cef9ad6-633d-42b6-adf6-a352853b05a5",
  "c2c088e8-341c-46f4-b0cf-b7683f35f0e8",
  "4552f73b-5d17-436f-9c39-4f29d7a3320b",
];

const sampleRooms = [
  { id: null, user_id: SAMPLE_AUTHORS[0], name: "사운드팩토리", area: "홍대입구역 3분", price: "시간당 1.5만원", rating: 4.8, instruments: ["드럼", "앰프", "PA"], hours: "24시간", content: "" },
  { id: null, user_id: SAMPLE_AUTHORS[1], name: "뮤직베이스", area: "강남역 5분", price: "시간당 2만원", rating: 4.6, instruments: ["드럼", "건반", "앰프"], hours: "10:00-02:00", content: "" },
  { id: null, user_id: SAMPLE_AUTHORS[2], name: "비트룸", area: "합정역 2분", price: "시간당 1.2만원", rating: 4.4, instruments: ["드럼", "앰프"], hours: "09:00-24:00", content: "" },
  { id: null, user_id: SAMPLE_AUTHORS[0], name: "멜로디하우스", area: "건대입구역 7분", price: "시간당 1.8만원", rating: 4.7, instruments: ["드럼", "건반", "앰프", "PA"], hours: "24시간", content: "" },
  { id: null, user_id: SAMPLE_AUTHORS[1], name: "리듬스페이스", area: "신촌역 4분", price: "시간당 1.3만원", rating: 4.3, instruments: ["드럼", "앰프"], hours: "11:00-23:00", content: "" },
];

const roomFields = [
  { key: "title", label: "연습실 이름", placeholder: "예: 사운드팩토리" },
  { key: "content", label: "상세 설명", placeholder: "연습실 소개를 작성해주세요", type: "textarea" as const },
  { key: "area", label: "위치", placeholder: "예: 홍대입구역 3분" },
  { key: "price", label: "가격", placeholder: "예: 시간당 1.5만원" },
  { key: "hours", label: "운영시간", placeholder: "예: 24시간" },
  { key: "instruments", label: "보유 장비 (쉼표 구분)", placeholder: "예: 드럼, 앰프, PA" },
  { key: "author_name", label: "작성자명", placeholder: "닉네임" },
  { key: "location", label: "지도 위치 (선택)", placeholder: "", type: "location" as const },
];

type RoomItem = {
  id: string | null;
  user_id: string | null;
  name: string;
  area: string;
  price: string;
  rating: number;
  instruments: string[];
  hours: string;
  content: string;
};

const Rooms = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [dbRooms, setDbRooms] = useState<any[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [selectedRoom, setSelectedRoom] = useState<RoomItem | null>(null);

  // Edit state
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editArea, setEditArea] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editHours, setEditHours] = useState("");
  const [editInstruments, setEditInstruments] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const fetchRooms = async () => {
    setLoadingRooms(true);
    const { data } = await supabase.from("posts").select("*").eq("post_type", "room").order("created_at", { ascending: false });
    setDbRooms(data || []);
    setLoadingRooms(false);
  };

  useEffect(() => {
    fetchRooms();
    const handler = (e: any) => { if (e.detail?.type === "room") fetchRooms(); };
    window.addEventListener("post-created", handler);
    return () => window.removeEventListener("post-created", handler);
  }, []);

  const allRooms: RoomItem[] = [
    ...dbRooms.map((r) => ({
      id: r.id,
      user_id: r.user_id,
      name: r.title,
      area: r.area || "",
      price: r.price || "",
      rating: 0,
      instruments: r.instruments || [],
      hours: r.hours || "",
      content: r.content || "",
    })),
    ...sampleRooms,
  ];

  const startEditing = () => {
    if (!selectedRoom) return;
    setEditName(selectedRoom.name);
    setEditContent(selectedRoom.content);
    setEditArea(selectedRoom.area);
    setEditPrice(selectedRoom.price);
    setEditHours(selectedRoom.hours);
    setEditInstruments(selectedRoom.instruments.join(", "));
    setEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedRoom?.id || !user) return;
    setSavingEdit(true);
    const { error } = await supabase.from("posts").update({
      title: editName,
      content: editContent,
      area: editArea,
      price: editPrice,
      hours: editHours,
      instruments: editInstruments.split(",").map((s) => s.trim()).filter(Boolean),
    }).eq("id", selectedRoom.id).eq("user_id", user.id);
    setSavingEdit(false);
    if (error) { toast.error("수정에 실패했습니다"); return; }
    toast.success("게시물이 수정되었습니다");
    setEditing(false);
    setSelectedRoom(null);
    fetchRooms();
  };

  const handleDelete = async () => {
    if (!selectedRoom?.id || !user) return;
    if (!confirm("게시물을 삭제하시겠습니까?")) return;
    const { error } = await supabase.from("posts").delete().eq("id", selectedRoom.id).eq("user_id", user.id);
    if (error) { toast.error("삭제에 실패했습니다"); return; }
    toast.success("게시물이 삭제되었습니다");
    setSelectedRoom(null);
    fetchRooms();
  };

  return (
    <PageShell title="연습실">
      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input type="text" placeholder="지역, 연습실 이름 검색..." className="w-full h-11 pl-10 pr-4 rounded-xl bg-secondary border-none text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition-shadow" />
      </div>

      <div className="space-y-3">
        {loadingRooms ? [...Array(4)].map((_, i) => <RoomCardSkeleton key={i} />) : null}
        {!loadingRooms && allRooms.map((room, i) => (
          <div
            key={room.id || `sample-${i}`}
            onClick={() => { setSelectedRoom(room); setEditing(false); }}
            className="glass-card p-4 hover:bg-surface-hover transition-colors duration-200 cursor-pointer active:scale-[0.98]"
            style={{ animation: `reveal 0.5s cubic-bezier(0.16,1,0.3,1) ${i * 0.06}s both` }}
          >
            <div className="flex items-start justify-between mb-2">
              <h3 className="text-sm font-semibold">{room.name}</h3>
              {room.rating > 0 && (
                <div className="flex items-center gap-1 shrink-0 ml-2">
                  <Star className="w-3.5 h-3.5 text-primary fill-primary" />
                  <span className="text-xs font-medium">{room.rating}</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
              {room.area && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{room.area}</span>}
              {room.hours && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{room.hours}</span>}
            </div>
            {room.instruments.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {room.instruments.map((inst: string) => (
                  <span key={inst} className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md bg-secondary text-secondary-foreground">
                    <Music className="w-2.5 h-2.5" />{inst}
                  </span>
                ))}
              </div>
            )}
            {room.price && (
              <div className="pt-3 border-t border-border/30">
                <span className="text-xs font-medium text-primary">{room.price}</span>
              </div>
            )}
          </div>
        ))}
        {!loadingRooms && allRooms.length === 0 && <div className="text-center py-10 text-muted-foreground text-sm">연습실이 없습니다</div>}
      </div>

      <CreatePostDialog postType="room" fields={roomFields} onCreated={fetchRooms} />

      {/* Detail Modal */}
      {selectedRoom && (
        <div className="fixed inset-0 z-[9999] bg-black/40 flex items-end justify-center" onClick={() => { setSelectedRoom(null); setEditing(false); }}>
          <div
            className="w-full max-w-lg bg-background rounded-t-2xl max-h-[85vh] flex flex-col animate-in slide-in-from-bottom duration-300 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <button onClick={() => { setSelectedRoom(null); setEditing(false); }} className="p-1 rounded-full hover:bg-secondary">
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-2">
                  {selectedRoom.id && selectedRoom.user_id === user?.id && !editing && (
                    <>
                      <button onClick={startEditing} className="p-1.5 rounded-full hover:bg-secondary text-muted-foreground hover:text-primary transition-colors">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={handleDelete} className="p-1.5 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {editing ? (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">연습실 이름</label>
                    <input value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">위치</label>
                    <input value={editArea} onChange={(e) => setEditArea(e.target.value)} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">가격</label>
                    <input value={editPrice} onChange={(e) => setEditPrice(e.target.value)} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">운영시간</label>
                    <input value={editHours} onChange={(e) => setEditHours(e.target.value)} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">보유 장비 (쉼표 구분)</label>
                    <input value={editInstruments} onChange={(e) => setEditInstruments(e.target.value)} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">상세 설명</label>
                    <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} rows={5} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
                  </div>
                  <div className="flex gap-2 pb-4">
                    <button onClick={() => setEditing(false)} className="flex-1 h-10 rounded-lg border border-border text-sm font-medium hover:bg-secondary transition-colors">취소</button>
                    <button onClick={handleSaveEdit} disabled={savingEdit} className="flex-1 h-10 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 active:scale-95 transition-all">
                      {savingEdit ? "저장 중..." : "저장"}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <h2 className="text-base font-bold mb-2">{selectedRoom.name}</h2>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
                    {selectedRoom.area && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{selectedRoom.area}</span>}
                    {selectedRoom.hours && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{selectedRoom.hours}</span>}
                  </div>
                  {selectedRoom.instruments.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {selectedRoom.instruments.map((inst) => (
                        <span key={inst} className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md bg-secondary text-secondary-foreground">
                          <Music className="w-2.5 h-2.5" />{inst}
                        </span>
                      ))}
                    </div>
                  )}
                  {selectedRoom.price && (
                    <p className="text-sm font-medium text-primary mb-4">{selectedRoom.price}</p>
                  )}
                  {selectedRoom.content ? (
                    <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{selectedRoom.content}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">상세 설명이 없습니다.</p>
                  )}
                  {selectedRoom.user_id !== user?.id && (
                    <button
                      onClick={() => {
                        if (!user) { toast.error("로그인이 필요합니다"); navigate("/auth"); return; }
                        if (!selectedRoom.user_id) { toast.error("샘플 연습실은 메시지를 보낼 수 없습니다"); return; }
                        navigate(`/messages?to=${selectedRoom.user_id}`);
                      }}
                      className="mt-5 w-full h-11 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                    >
                      <MessageCircle className="w-4 h-4" /> 메시지 보내기
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
};

export default Rooms;
