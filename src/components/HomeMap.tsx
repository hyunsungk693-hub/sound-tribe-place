import { useEffect, useState } from "react";
import { APIProvider, Map, AdvancedMarker, Pin, InfoWindow } from "@vis.gl/react-google-maps";
import { MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Place = {
  id: string;
  title: string;
  lat: number;
  lng: number;
  post_type: string;
  venue?: string | null;
};

const DEFAULT_CENTER = { lat: 37.5665, lng: 126.978 }; // Seoul

const HomeMap = () => {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
  const [center, setCenter] = useState(DEFAULT_CENTER);
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);
  const [places, setPlaces] = useState<Place[]>([]);
  const [selected, setSelected] = useState<Place | null>(null);

  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setUserPos(p);
          setCenter(p);
        },
        () => {},
        { enableHighAccuracy: true, timeout: 5000 }
      );
    }
  }, []);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("posts")
        .select("id,title,lat,lng,post_type,venue")
        .in("post_type", ["job", "room"])
        .not("lat", "is", null)
        .not("lng", "is", null)
        .limit(50);
      if (data) setPlaces(data as Place[]);
    })();
  }, []);

  if (!apiKey) {
    return (
      <div className="glass-card p-6 text-center text-sm text-muted-foreground">
        지도를 불러오려면 VITE_GOOGLE_MAPS_API_KEY가 필요합니다.
      </div>
    );
  }

  return (
    <div className="rounded-2xl overflow-hidden h-[280px] relative">
      <APIProvider apiKey={apiKey}>
        <Map
          center={center}
          defaultZoom={14}
          mapId="instrut-home-map"
          gestureHandling="greedy"
          disableDefaultUI
          onCameraChanged={(e) => setCenter(e.detail.center)}
        >
          {userPos && (
            <AdvancedMarker position={userPos} title="내 위치">
              <div className="relative">
                <div className="w-4 h-4 rounded-full bg-blue-500 border-2 border-white shadow-lg" />
                <div className="absolute inset-0 w-4 h-4 rounded-full bg-blue-500/40 animate-ping" />
              </div>
            </AdvancedMarker>
          )}
          {places.map((p) => (
            <AdvancedMarker key={p.id} position={{ lat: p.lat, lng: p.lng }} onClick={() => setSelected(p)}>
              <Pin
                background={p.post_type === "room" ? "#10b981" : "#3b82f6"}
                borderColor="#ffffff"
                glyphColor="#ffffff"
              />
            </AdvancedMarker>
          ))}
          {selected && (
            <InfoWindow position={{ lat: selected.lat, lng: selected.lng }} onCloseClick={() => setSelected(null)}>
              <div className="text-sm">
                <p className="font-semibold">{selected.title}</p>
                {selected.venue && <p className="text-xs text-gray-600 mt-0.5">{selected.venue}</p>}
              </div>
            </InfoWindow>
          )}
        </Map>
      </APIProvider>
      <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-background/80 backdrop-blur text-xs font-medium">
        <MapPin className="w-3 h-3 text-primary" />
        내 주변
      </div>
    </div>
  );
};

export default HomeMap;
