import { Search, MapPin, Clock, Star, Music } from "lucide-react";
import { useState, useEffect } from "react";
import PageShell from "@/components/PageShell";
import CreatePostDialog from "@/components/CreatePostDialog";
import { supabase } from "@/integrations/supabase/client";

const sampleRooms = [
  { name: "사운드팩토리", area: "홍대입구역 3분", price: "시간당 1.5만원", rating: 4.8, instruments: ["드럼", "앰프", "PA"], hours: "24시간" },
  { name: "뮤직베이스", area: "강남역 5분", price: "시간당 2만원", rating: 4.6, instruments: ["드럼", "건반", "앰프"], hours: "10:00-02:00" },
  { name: "비트룸", area: "합정역 2분", price: "시간당 1.2만원", rating: 4.4, instruments: ["드럼", "앰프"], hours: "09:00-24:00" },
  { name: "멜로디하우스", area: "건대입구역 7분", price: "시간당 1.8만원", rating: 4.7, instruments: ["드럼", "건반", "앰프", "PA"], hours: "24시간" },
  { name: "리듬스페이스", area: "신촌역 4분", price: "시간당 1.3만원", rating: 4.3, instruments: ["드럼", "앰프"], hours: "11:00-23:00" },
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

const Rooms = () => {
  const [dbRooms, setDbRooms] = useState<any[]>([]);

  const fetchRooms = async () => {
    const { data } = await supabase.from("posts").select("*").eq("post_type", "room").order("created_at", { ascending: false });
    setDbRooms(data || []);
  };

  useEffect(() => { fetchRooms(); }, []);

  const allRooms = [
    ...dbRooms.map((r) => ({
      name: r.title,
      area: r.area || "",
      price: r.price || "",
      rating: 0,
      instruments: r.instruments || [],
      hours: r.hours || "",
    })),
    ...sampleRooms,
  ];

  return (
    <PageShell title="연습실">
      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input type="text" placeholder="지역, 연습실 이름 검색..." className="w-full h-11 pl-10 pr-4 rounded-xl bg-secondary border-none text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition-shadow" />
      </div>

      <div className="space-y-3">
        {allRooms.map((room, i) => (
          <div key={i} className="glass-card p-4 hover:bg-surface-hover transition-colors duration-200 cursor-pointer active:scale-[0.98]" style={{ animation: `reveal 0.5s cubic-bezier(0.16,1,0.3,1) ${i * 0.06}s both` }}>
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
      </div>

      <CreatePostDialog postType="room" fields={roomFields} onCreated={fetchRooms} />
    </PageShell>
  );
};

export default Rooms;
