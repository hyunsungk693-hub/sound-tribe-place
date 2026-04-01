import { useState, useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import PageShell from "@/components/PageShell";
import { Search, Plus, Minus, Navigation, X, Star, MapPin, Clock, Phone } from "lucide-react";

type MarkerData = {
  id: number;
  type: "job" | "room" | "shop";
  name: string;
  desc: string;
  lat: number;
  lng: number;
  address?: string;
  phone?: string;
  hours?: string;
  rating?: number;
  reviewCount?: number;
  reviews?: { user: string; text: string; rating: number; date: string }[];
};

const markers: MarkerData[] = [
  { id: 1, type: "job", name: "밴드 기타리스트 모집", desc: "홍대 라이브클럽 · 회당 15만원", lat: 37.5563, lng: 126.9236, address: "서울 마포구 와우산로 21길 19", phone: "02-332-1234", rating: 4.2, reviewCount: 8, reviews: [
    { user: "기타러버", text: "분위기 좋고 페이도 괜찮아요. 재계약 의사 있습니다.", rating: 5, date: "2026.03.15" },
    { user: "세션맨", text: "장비 상태가 좋고 사운드 엔지니어가 친절해요.", rating: 4, date: "2026.03.10" },
  ]},
  { id: 2, type: "job", name: "레코딩 세션 드러머", desc: "강남 A스튜디오 · 곡당 10만원", lat: 37.4979, lng: 127.0276, address: "서울 강남구 역삼동 123-4", phone: "02-555-5678", rating: 4.5, reviewCount: 12, reviews: [
    { user: "드러머K", text: "녹음 환경이 최고입니다. 프로듀서도 전문적이에요.", rating: 5, date: "2026.03.20" },
    { user: "비트메이커", text: "곡 작업 속도가 빨라서 효율적입니다.", rating: 4, date: "2026.03.05" },
  ]},
  { id: 3, type: "job", name: "웨딩 싱어 구함", desc: "서울 전 지역 · 회당 20만원", lat: 37.5665, lng: 126.9780, address: "서울 중구 명동길 14", rating: 4.0, reviewCount: 5, reviews: [
    { user: "보컬리스트", text: "스케줄 조율이 유연하고 대우가 좋습니다.", rating: 4, date: "2026.02.28" },
  ]},
  { id: 4, type: "job", name: "피아노 레슨 선생님", desc: "분당 음악학원 · 월 200만원", lat: 37.3825, lng: 127.1194, address: "경기 성남시 분당구 서현로 210", phone: "031-712-3456", rating: 4.7, reviewCount: 15, reviews: [
    { user: "피아니스트M", text: "학원 시설이 좋고 학생들도 열정적이에요.", rating: 5, date: "2026.03.18" },
  ]},
  { id: 5, type: "job", name: "뮤지컬 오케스트라 바이올린", desc: "대학로 소극장 · 협의", lat: 37.5812, lng: 127.0030, address: "서울 종로구 대학로 116", rating: 4.3, reviewCount: 7, reviews: []},
  { id: 6, type: "room", name: "사운드팩토리", desc: "홍대입구역 3분 · 시간당 1.5만원", lat: 37.5571, lng: 126.9244, address: "서울 마포구 양화로 186", phone: "02-332-9876", hours: "10:00 - 02:00", rating: 4.6, reviewCount: 32, reviews: [
    { user: "밴드보이", text: "방음이 잘 되고 장비 상태 최고! 드럼도 좋아요.", rating: 5, date: "2026.03.22" },
    { user: "인디밴드", text: "가격 대비 좋습니다. 주차는 좀 불편해요.", rating: 4, date: "2026.03.15" },
    { user: "기타리스트J", text: "앰프 종류가 다양해서 좋아요.", rating: 4, date: "2026.03.01" },
  ]},
  { id: 7, type: "room", name: "뮤직베이스", desc: "강남역 5분 · 시간당 2만원", lat: 37.4988, lng: 127.0286, address: "서울 강남구 강남대로 328", phone: "02-556-7890", hours: "09:00 - 01:00", rating: 4.8, reviewCount: 45, reviews: [
    { user: "프로뮤지션", text: "강남에서 가성비 최고 연습실. 시설 깨끗합니다.", rating: 5, date: "2026.03.25" },
    { user: "락밴드", text: "녹음도 가능하고 스태프가 친절해요.", rating: 5, date: "2026.03.20" },
  ]},
  { id: 8, type: "room", name: "비트룸", desc: "합정역 2분 · 시간당 1.2만원", lat: 37.5495, lng: 126.9137, address: "서울 마포구 양화로 45", phone: "02-333-4567", hours: "11:00 - 23:00", rating: 4.1, reviewCount: 18, reviews: [
    { user: "드러머S", text: "저렴하고 접근성 좋아요. 방이 좀 작긴 합니다.", rating: 4, date: "2026.03.12" },
  ]},
  { id: 9, type: "room", name: "멜로디하우스", desc: "건대입구역 7분 · 시간당 1.8만원", lat: 37.5404, lng: 127.0696, address: "서울 광진구 능동로 120", phone: "02-446-1234", hours: "10:00 - 00:00", rating: 4.4, reviewCount: 22, reviews: []},
  { id: 10, type: "room", name: "리듬스페이스", desc: "신촌역 4분 · 시간당 1.3만원", lat: 37.5551, lng: 126.9369, address: "서울 서대문구 연세로 11", phone: "02-312-5678", hours: "09:00 - 24:00", rating: 4.3, reviewCount: 28, reviews: [
    { user: "대학밴드", text: "학생 할인도 있고 예약이 편해요!", rating: 5, date: "2026.03.08" },
  ]},
  { id: 11, type: "shop", name: "뮤직랜드 홍대점", desc: "기타·베이스·이펙터 전문", lat: 37.5575, lng: 126.9260, address: "서울 마포구 와우산로 35", phone: "02-336-7777", hours: "11:00 - 21:00", rating: 4.5, reviewCount: 56, reviews: [
    { user: "기타초보", text: "직원분이 친절하게 추천해주셨어요. 입문용 기타 구매!", rating: 5, date: "2026.03.24" },
    { user: "이펙터매니아", text: "이펙터 종류가 정말 많아요. 시연도 가능합니다.", rating: 5, date: "2026.03.18" },
  ]},
  { id: 12, type: "shop", name: "세광악기", desc: "피아노·건반·관악기 종합", lat: 37.5690, lng: 126.9920, address: "서울 종로구 삼일대로 428", phone: "02-765-4321", hours: "10:00 - 20:00", rating: 4.2, reviewCount: 38, reviews: [
    { user: "피아노맘", text: "아이 피아노 구매했는데 AS도 잘 해주세요.", rating: 4, date: "2026.03.10" },
  ]},
  { id: 13, type: "shop", name: "낙원악기상가", desc: "국내 최대 악기 상가", lat: 37.5720, lng: 126.9870, address: "서울 종로구 삼일대로 32길 20", hours: "10:00 - 19:00", rating: 4.6, reviewCount: 120, reviews: [
    { user: "뮤지션A", text: "없는 악기가 없어요. 가격 비교하며 쇼핑하기 좋습니다.", rating: 5, date: "2026.03.22" },
    { user: "색소폰주자", text: "관악기 전문점이 여러 곳이라 선택지가 많아요.", rating: 4, date: "2026.03.15" },
  ]},
  { id: 14, type: "shop", name: "코스모스악기", desc: "드럼·퍼커션 전문", lat: 37.5010, lng: 127.0300, address: "서울 강남구 논현로 512", phone: "02-543-8765", hours: "10:30 - 20:30", rating: 4.4, reviewCount: 25, reviews: [
    { user: "드러머P", text: "시몬스, 펄 등 다양한 브랜드 비교 가능해요.", rating: 4, date: "2026.03.05" },
  ]},
  { id: 15, type: "shop", name: "사운드기어", desc: "음향장비·레코딩 장비", lat: 37.5450, lng: 126.9520, address: "서울 마포구 월드컵북로 21", phone: "02-304-5555", hours: "11:00 - 20:00", rating: 4.3, reviewCount: 19, reviews: [
    { user: "홈레코딩", text: "인터페이스 고를 때 전문적인 상담 받았어요.", rating: 5, date: "2026.03.17" },
  ]},
];

const createIcon = (type: "job" | "room" | "shop") => {
  const configs = {
    job: { bg: "#1B64DA", icon: "💼", label: "구인" },
    room: { bg: "#03C75A", icon: "🎵", label: "연습실" },
    shop: { bg: "#FF6F0F", icon: "🎸", label: "악기" },
  };
  const c = configs[type];
  return L.divIcon({
    className: "",
    html: `<div style="display:flex;flex-direction:column;align-items:center;cursor:pointer;">
      <div style="background:${c.bg};color:#fff;padding:4px 8px;border-radius:8px;font-size:11px;font-weight:600;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.25);display:flex;align-items:center;gap:3px;">
        <span style="font-size:12px">${c.icon}</span>${c.label}
      </div>
      <div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:6px solid ${c.bg};margin-top:-1px;"></div>
    </div>`,
    iconSize: [60, 36],
    iconAnchor: [30, 36],
  });
};

const jobIcon = createIcon("job");
const roomIcon = createIcon("room");
const shopIcon = createIcon("shop");

type Filter = "all" | "job" | "room" | "shop";

const typeLabel = { job: "구인구직", room: "연습실", shop: "악기사" };
const typeColor = { job: "#1B64DA", room: "#03C75A", shop: "#FF6F0F" };

const StarRating = React.memo(({ rating }: { rating: number }) => (
  <div className="flex items-center gap-0.5">
    {[1, 2, 3, 4, 5].map((i) => (
      <Star
        key={i}
        className="w-3.5 h-3.5"
        fill={i <= Math.round(rating) ? "#FBBF24" : "none"}
        stroke={i <= Math.round(rating) ? "#FBBF24" : "#D1D5DB"}
        strokeWidth={1.5}
      />
    ))}
  </div>
);

const MapPage = () => {
  const [filter, setFilter] = useState<Filter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selected, setSelected] = useState<MarkerData | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    mapRef.current = L.map(containerRef.current, {
      center: [37.5505, 126.968],
      zoom: 12,
      zoomControl: false,
    });
    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
      maxZoom: 19,
    }).addTo(mapRef.current);

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const filtered = markers.filter((m) => filter === "all" || m.type === filter);
    filtered.forEach((m) => {
      const icon = m.type === "job" ? jobIcon : m.type === "room" ? roomIcon : shopIcon;
      const marker = L.marker([m.lat, m.lng], { icon })
        .on("click", () => {
          setSelected(m);
          mapRef.current?.panTo([m.lat, m.lng]);
        })
        .addTo(mapRef.current!);
      markersRef.current.push(marker);
    });
  }, [filter]);

  const handleZoomIn = () => mapRef.current?.zoomIn();
  const handleZoomOut = () => mapRef.current?.zoomOut();
  const handleMyLocation = () => {
    navigator.geolocation?.getCurrentPosition((pos) => {
      mapRef.current?.setView([pos.coords.latitude, pos.coords.longitude], 15);
    });
  };

  const filterButtons = [
    { key: "all" as Filter, label: "전체" },
    { key: "job" as Filter, label: "구인구직", dotColor: "#1B64DA" },
    { key: "room" as Filter, label: "연습실", dotColor: "#03C75A" },
    { key: "shop" as Filter, label: "악기사", dotColor: "#FF6F0F" },
  ];

  return (
    <PageShell title="지도">
      {/* Search bar */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="장소, 주소 검색"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-border bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
        />
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 mb-3 overflow-x-auto scrollbar-hide">
        {filterButtons.map(({ key, label, dotColor }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`flex items-center gap-1.5 shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 active:scale-95 border ${
              filter === key
                ? "bg-foreground text-background border-foreground shadow-sm"
                : "bg-background text-foreground border-border hover:bg-secondary"
            }`}
          >
            {dotColor && (
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: dotColor }} />
            )}
            {label}
          </button>
        ))}
      </div>

      {/* Map container */}
      <div className="relative rounded-xl overflow-hidden border border-border shadow-md">
        <div ref={containerRef} style={{ height: "calc(100vh - 300px)" }} />

        {/* Zoom & location controls */}
        <div className="absolute right-3 bottom-6 z-[1000] flex flex-col gap-1.5">
          <button onClick={handleMyLocation} className="w-9 h-9 bg-background rounded-lg shadow-md border border-border flex items-center justify-center hover:bg-secondary active:scale-95 transition-all">
            <Navigation className="w-4 h-4 text-foreground" />
          </button>
          <div className="flex flex-col bg-background rounded-lg shadow-md border border-border overflow-hidden">
            <button onClick={handleZoomIn} className="w-9 h-9 flex items-center justify-center hover:bg-secondary active:scale-95 transition-all border-b border-border">
              <Plus className="w-4 h-4 text-foreground" />
            </button>
            <button onClick={handleZoomOut} className="w-9 h-9 flex items-center justify-center hover:bg-secondary active:scale-95 transition-all">
              <Minus className="w-4 h-4 text-foreground" />
            </button>
          </div>
        </div>

        {/* Legend */}
        <div className="absolute left-3 bottom-6 z-[1000] bg-background/90 backdrop-blur-sm rounded-lg px-3 py-2 shadow-md border border-border">
          <div className="flex items-center gap-3 text-[11px] font-medium text-foreground">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: "#1B64DA" }} />구인구직</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: "#03C75A" }} />연습실</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: "#FF6F0F" }} />악기사</span>
          </div>
        </div>

        {/* Detail panel (bottom sheet style) */}
        {selected && (
          <div className="absolute bottom-0 left-0 right-0 z-[1001] animate-in slide-in-from-bottom duration-300">
            <div className="bg-background border-t border-border rounded-t-2xl shadow-2xl max-h-[60vh] overflow-y-auto">
              {/* Handle bar */}
              <div className="flex justify-center pt-2 pb-1">
                <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
              </div>

              <div className="px-4 pb-4">
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
                        style={{ backgroundColor: typeColor[selected.type] }}
                      >
                        {typeLabel[selected.type]}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-foreground leading-tight">{selected.name}</h3>
                    <p className="text-sm text-muted-foreground mt-0.5">{selected.desc}</p>
                  </div>
                  <button
                    onClick={() => setSelected(null)}
                    className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0 ml-2 hover:bg-muted active:scale-95 transition-all"
                  >
                    <X className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>

                {/* Rating */}
                {selected.rating && (
                  <div className="flex items-center gap-2 mb-3">
                    <StarRating rating={selected.rating} />
                    <span className="text-sm font-semibold text-foreground">{selected.rating}</span>
                    <span className="text-xs text-muted-foreground">리뷰 {selected.reviewCount}개</span>
                  </div>
                )}

                {/* Info */}
                <div className="space-y-2 mb-4">
                  {selected.address && (
                    <div className="flex items-center gap-2 text-sm text-foreground">
                      <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
                      {selected.address}
                    </div>
                  )}
                  {selected.hours && (
                    <div className="flex items-center gap-2 text-sm text-foreground">
                      <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                      {selected.hours}
                    </div>
                  )}
                  {selected.phone && (
                    <div className="flex items-center gap-2 text-sm text-foreground">
                      <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
                      {selected.phone}
                    </div>
                  )}
                </div>

                {/* Reviews */}
                {selected.reviews && selected.reviews.length > 0 && (
                  <div>
                    <h4 className="text-sm font-bold text-foreground mb-2">리뷰</h4>
                    <div className="space-y-3">
                      {selected.reviews.map((r, i) => (
                        <div key={i} className="bg-secondary/50 rounded-xl p-3">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-foreground">{r.user}</span>
                              <StarRating rating={r.rating} />
                            </div>
                            <span className="text-[11px] text-muted-foreground">{r.date}</span>
                          </div>
                          <p className="text-sm text-foreground/80 leading-relaxed">{r.text}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selected.reviews && selected.reviews.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">아직 리뷰가 없습니다.</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .naver-popup .leaflet-popup-content-wrapper {
          border-radius: 12px;
          box-shadow: 0 4px 16px rgba(0,0,0,0.15);
          padding: 0;
        }
        .naver-popup .leaflet-popup-content { margin: 12px 14px; }
        .naver-popup .leaflet-popup-tip { box-shadow: 0 4px 16px rgba(0,0,0,0.1); }
      `}</style>
    </PageShell>
  );
};

export default MapPage;
