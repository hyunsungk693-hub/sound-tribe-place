import { useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import PageShell from "@/components/PageShell";

const jobMarkerIcon = new L.DivIcon({
  className: "",
  html: `<div style="width:28px;height:28px;border-radius:50%;background:#3b82f6;border:3px solid #fff;box-shadow:0 2px 8px rgba(59,130,246,0.5);display:flex;align-items:center;justify-content:center">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>
  </div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

const roomMarkerIcon = new L.DivIcon({
  className: "",
  html: `<div style="width:28px;height:28px;border-radius:50%;background:#10b981;border:3px solid #fff;box-shadow:0 2px 8px rgba(16,185,129,0.5);display:flex;align-items:center;justify-content:center">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
  </div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

type MarkerData = {
  id: number;
  type: "job" | "room";
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
];

type Filter = "all" | "job" | "room";

const Map = () => {
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = markers.filter((m) => filter === "all" || m.type === filter);

  return (
    <PageShell title="지도">
      {/* Filter */}
      <div className="flex gap-2 mb-4">
        {([
          { key: "all" as Filter, label: "전체" },
          { key: "job" as Filter, label: "구인구직", color: "bg-blue-500" },
          { key: "room" as Filter, label: "연습실", color: "bg-emerald-500" },
        ]).map(({ key, label, color }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`flex items-center gap-1.5 shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-200 active:scale-95 ${
              filter === key
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-surface-hover"
            }`}
          >
            {color && <span className={`w-2 h-2 rounded-full ${color}`} />}
            {label}
          </button>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mb-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-blue-500 border-2 border-white shadow-sm" />
          구인구직
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-emerald-500 border-2 border-white shadow-sm" />
          연습실
        </span>
      </div>

      {/* Map */}
      <div className="rounded-2xl overflow-hidden border border-border/50 shadow-sm" style={{ height: "calc(100vh - 280px)" }}>
        <MapContainer
          center={[37.5505, 126.9680]}
          zoom={12}
          style={{ height: "100%", width: "100%" }}
          zoomControl={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {filtered.map((m) => (
            <Marker
              key={m.id}
              position={[m.lat, m.lng]}
              icon={m.type === "job" ? jobMarkerIcon : roomMarkerIcon}
            >
              <Popup>
                <div className="text-sm">
                  <p className="font-semibold">{m.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{m.desc}</p>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </PageShell>
  );
};

export default Map;
