import { Search, MapPin, Clock, Star, Music } from "lucide-react";
import PageShell from "@/components/PageShell";

const rooms = [
  { name: "사운드팩토리", area: "홍대입구역 3분", price: "시간당 1.5만원", rating: 4.8, instruments: ["드럼", "앰프", "PA"], hours: "24시간" },
  { name: "뮤직베이스", area: "강남역 5분", price: "시간당 2만원", rating: 4.6, instruments: ["드럼", "건반", "앰프"], hours: "10:00-02:00" },
  { name: "비트룸", area: "합정역 2분", price: "시간당 1.2만원", rating: 4.4, instruments: ["드럼", "앰프"], hours: "09:00-24:00" },
  { name: "멜로디하우스", area: "건대입구역 7분", price: "시간당 1.8만원", rating: 4.7, instruments: ["드럼", "건반", "앰프", "PA"], hours: "24시간" },
  { name: "리듬스페이스", area: "신촌역 4분", price: "시간당 1.3만원", rating: 4.3, instruments: ["드럼", "앰프"], hours: "11:00-23:00" },
];

const Rooms = () => (
  <PageShell title="연습실">
    {/* Search */}
    <div className="relative mb-5">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
      <input
        type="text"
        placeholder="지역, 연습실 이름 검색..."
        className="w-full h-11 pl-10 pr-4 rounded-xl bg-secondary border-none text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition-shadow"
      />
    </div>

    {/* Room List */}
    <div className="space-y-3">
      {rooms.map((room, i) => (
        <div
          key={i}
          className="glass-card p-4 hover:bg-surface-hover transition-colors duration-200 cursor-pointer active:scale-[0.98]"
          style={{ animation: `reveal 0.5s cubic-bezier(0.16,1,0.3,1) ${i * 0.06}s both` }}
        >
          <div className="flex items-start justify-between mb-2">
            <h3 className="text-sm font-semibold">{room.name}</h3>
            <div className="flex items-center gap-1 shrink-0 ml-2">
              <Star className="w-3.5 h-3.5 text-primary fill-primary" />
              <span className="text-xs font-medium">{room.rating}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />{room.area}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />{room.hours}
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5 mb-3">
            {room.instruments.map((inst) => (
              <span key={inst} className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md bg-secondary text-secondary-foreground">
                <Music className="w-2.5 h-2.5" />{inst}
              </span>
            ))}
          </div>

          <div className="pt-3 border-t border-border/30">
            <span className="text-xs font-medium text-primary">{room.price}</span>
          </div>
        </div>
      ))}
    </div>
  </PageShell>
);

export default Rooms;
