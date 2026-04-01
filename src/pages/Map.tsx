import { useState, useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import PageShell from "@/components/PageShell";
import { Search, Plus, Minus, Navigation } from "lucide-react";

type MarkerData = {
  id: number;
  type: "job" | "room" | "shop";
  name: string;
  desc: string;
  lat: number;
  lng: number;
};

const markers: MarkerData[] = [
  { id: 1, type: "job", name: "밴드 기타리스트 모집", desc: "홍대 라이브클럽 · 회당 15만원", lat: 37.5563, lng: 126.9236 },
  { id: 2, type: "job", name: "레코딩 세션 드러머", desc: "강남 A스튜디오 · 곡당 10만원", lat: 37.4979, lng: 127.0276 },
  { id: 3, type: "job", name: "웨딩 싱어 구함", desc: "서울 전 지역 · 회당 20만원", lat: 37.5665, lng: 126.9780 },
  { id: 4, type: "job", name: "피아노 레슨 선생님", desc: "분당 음악학원 · 월 200만원", lat: 37.3825, lng: 127.1194 },
  { id: 5, type: "job", name: "뮤지컬 오케스트라 바이올린", desc: "대학로 소극장 · 협의", lat: 37.5812, lng: 127.0030 },
  { id: 6, type: "room", name: "사운드팩토리", desc: "홍대입구역 3분 · 시간당 1.5만원", lat: 37.5571, lng: 126.9244 },
  { id: 7, type: "room", name: "뮤직베이스", desc: "강남역 5분 · 시간당 2만원", lat: 37.4988, lng: 127.0286 },
  { id: 8, type: "room", name: "비트룸", desc: "합정역 2분 · 시간당 1.2만원", lat: 37.5495, lng: 126.9137 },
  { id: 9, type: "room", name: "멜로디하우스", desc: "건대입구역 7분 · 시간당 1.8만원", lat: 37.5404, lng: 127.0696 },
  { id: 10, type: "room", name: "리듬스페이스", desc: "신촌역 4분 · 시간당 1.3만원", lat: 37.5551, lng: 126.9369 },
  { id: 11, type: "shop", name: "뮤직랜드 홍대점", desc: "기타·베이스·이펙터 전문", lat: 37.5575, lng: 126.9260 },
  { id: 12, type: "shop", name: "세광악기", desc: "피아노·건반·관악기 종합", lat: 37.5690, lng: 126.9920 },
  { id: 13, type: "shop", name: "낙원악기상가", desc: "국내 최대 악기 상가", lat: 37.5720, lng: 126.9870 },
  { id: 14, type: "shop", name: "코스모스악기", desc: "드럼·퍼커션 전문", lat: 37.5010, lng: 127.0300 },
  { id: 15, type: "shop", name: "사운드기어", desc: "음향장비·레코딩 장비", lat: 37.5450, lng: 126.9520 },
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
    html: `<div style="display:flex;flex-direction:column;align-items:center;">
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

const MapPage = () => {
  const [filter, setFilter] = useState<Filter>("all");
  const [searchQuery, setSearchQuery] = useState("");
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
    // Use CartoDB Voyager for a clean, Naver-like appearance
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
        .bindPopup(
          `<div style="font-family:-apple-system,sans-serif;min-width:160px;">
            <div style="font-size:14px;font-weight:700;color:#1a1a1a;margin-bottom:4px;">${m.name}</div>
            <div style="font-size:12px;color:#666;">${m.desc}</div>
          </div>`,
          { closeButton: false, className: "naver-popup" }
        )
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
      {/* Search bar - Naver style */}
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
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: dotColor }}
              />
            )}
            {label}
          </button>
        ))}
      </div>

      {/* Map container */}
      <div className="relative rounded-xl overflow-hidden border border-border shadow-md">
        <div
          ref={containerRef}
          style={{ height: "calc(100vh - 300px)" }}
        />

        {/* Zoom & location controls - Naver style */}
        <div className="absolute right-3 bottom-6 z-[1000] flex flex-col gap-1.5">
          <button
            onClick={handleMyLocation}
            className="w-9 h-9 bg-background rounded-lg shadow-md border border-border flex items-center justify-center hover:bg-secondary active:scale-95 transition-all"
          >
            <Navigation className="w-4 h-4 text-foreground" />
          </button>
          <div className="flex flex-col bg-background rounded-lg shadow-md border border-border overflow-hidden">
            <button
              onClick={handleZoomIn}
              className="w-9 h-9 flex items-center justify-center hover:bg-secondary active:scale-95 transition-all border-b border-border"
            >
              <Plus className="w-4 h-4 text-foreground" />
            </button>
            <button
              onClick={handleZoomOut}
              className="w-9 h-9 flex items-center justify-center hover:bg-secondary active:scale-95 transition-all"
            >
              <Minus className="w-4 h-4 text-foreground" />
            </button>
          </div>
        </div>

        {/* Legend overlay */}
        <div className="absolute left-3 bottom-6 z-[1000] bg-background/90 backdrop-blur-sm rounded-lg px-3 py-2 shadow-md border border-border">
          <div className="flex items-center gap-3 text-[11px] font-medium text-foreground">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: "#1B64DA" }} />
              구인구직
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: "#03C75A" }} />
              연습실
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: "#FF6F0F" }} />
              악기사
            </span>
          </div>
        </div>
      </div>

      <style>{`
        .naver-popup .leaflet-popup-content-wrapper {
          border-radius: 12px;
          box-shadow: 0 4px 16px rgba(0,0,0,0.15);
          padding: 0;
        }
        .naver-popup .leaflet-popup-content {
          margin: 12px 14px;
        }
        .naver-popup .leaflet-popup-tip {
          box-shadow: 0 4px 16px rgba(0,0,0,0.1);
        }
      `}</style>
    </PageShell>
  );
};

export default MapPage;
