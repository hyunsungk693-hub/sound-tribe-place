import { useState, useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import PageShell from "@/components/PageShell";

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

const createIcon = (color: string) =>
  L.divIcon({
    className: "",
    html: `<div style="width:28px;height:28px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 2px 8px ${color}80;"></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });

const jobIcon = createIcon("#3b82f6");
const roomIcon = createIcon("#10b981");
const shopIcon = createIcon("#f59e0b");

type Filter = "all" | "job" | "room" | "shop";

const MapPage = () => {
  const [filter, setFilter] = useState<Filter>("all");
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
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
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
        .bindPopup(`<b>${m.name}</b><br/><span style="color:#888;font-size:12px">${m.desc}</span>`)
        .addTo(mapRef.current!);
      markersRef.current.push(marker);
    });
  }, [filter]);

  return (
    <PageShell title="지도">
      <div className="flex gap-2 mb-4">
        {([
          { key: "all" as Filter, label: "전체" },
          { key: "job" as Filter, label: "구인구직", color: "bg-blue-500" },
          { key: "room" as Filter, label: "연습실", color: "bg-emerald-500" },
          { key: "shop" as Filter, label: "악기사", color: "bg-amber-500" },
        ]).map(({ key, label, color }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`flex items-center gap-1.5 shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-200 active:scale-95 ${
              filter === key
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground"
            }`}
          >
            {color && <span className={`w-2 h-2 rounded-full ${color}`} />}
            {label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-4 mb-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-blue-500" />
          구인구직
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-emerald-500" />
          연습실
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-amber-500" />
          악기사
        </span>
      </div>

      <div
        ref={containerRef}
        className="rounded-2xl overflow-hidden border border-border/50 shadow-sm"
        style={{ height: "calc(100vh - 280px)" }}
      />
    </PageShell>
  );
};

export default MapPage;
